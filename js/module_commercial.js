(function (global) {
"use strict";

function getCommercialNowMs(userId) {
    const id = String(userId || global.AURORA_ACCOUNT_USER_ID || "").trim();

    if (
        global.AuroraCloudSync &&
        typeof global.AuroraCloudSync.getCommercialNowMs === "function"
    ) {
        return global.AuroraCloudSync.getCommercialNowMs(id);
    }

    const offlineLicense = global.AuroraOfflineLicense;

    if (
        offlineLicense &&
        typeof offlineLicense.getEstimatedTrustedNowMs === "function"
    ) {
        const trusted = Number(offlineLicense.getEstimatedTrustedNowMs(id));

        if (Number.isFinite(trusted)) {
            return trusted;
        }
    }

    return Date.now();
}

function parseEndsAtMs(module) {
    if (!module || module.ends_at == null || module.ends_at === "") {
        return null;
    }

    const parsed = Date.parse(String(module.ends_at));
    return Number.isFinite(parsed) ? parsed : null;
}

function isOfflineAuthority(options) {
    if (options && options.offlineSnapshot === true) {
        return true;
    }

    return typeof navigator !== "undefined" && navigator.onLine === false;
}

function evaluateModuleCommercial(module, options) {
    options = options || {};
    const userId = String(options.userId || global.AURORA_ACCOUNT_USER_ID || "").trim();
    const canAccessFlag = Boolean(module && module.can_access === true);
    const accessStatus = String(module && module.access_status || "").trim().toLowerCase();
    const endsAtMs = parseEndsAtMs(module);
    const commercialNow = getCommercialNowMs(userId);
    const endsAtExpired = endsAtMs != null && commercialNow >= endsAtMs;
    const offlineAuthority = isOfflineAuthority(options);

    let canStartNewWork;

    if (offlineAuthority) {
        canStartNewWork = canAccessFlag && !endsAtExpired;
    } else {
        canStartNewWork = canAccessFlag;

        if (canAccessFlag && endsAtExpired) {
            console.warn(
                "[AuroraModuleCommercial] Servidor retornou can_access=true com ends_at vencido.",
                module && module.module_code ? module.module_code : "unknown"
            );
        }
    }

    const demonstrationEnded = Boolean(
        endsAtExpired ||
        accessStatus === "expired" ||
        (!canStartNewWork && accessStatus !== "available" && accessStatus !== "locked" && Boolean(module))
    );

    return {
        module_code: module && module.module_code ? String(module.module_code) : "",
        can_access_flag: canAccessFlag,
        ends_at_ms: endsAtMs,
        ends_at_expired: endsAtExpired,
        can_start_new_work: canStartNewWork,
        demonstration_ended: demonstrationEnded,
        offline_authority: offlineAuthority,
        access_status: accessStatus
    };
}

function enrichModule(module, options) {
    if (!module || typeof module !== "object") {
        return module;
    }

    const evaluation = evaluateModuleCommercial(module, options);

    return Object.assign({}, module, {
        effective_can_start_new_work: evaluation.can_start_new_work,
        effective_demonstration_ended: evaluation.demonstration_ended,
        effective_ends_at_expired: evaluation.ends_at_expired
    });
}

function enrichModules(modules, options) {
    return (Array.isArray(modules) ? modules : []).map((item) => enrichModule(item, options));
}

function canStartNewWork(module, options) {
    if (!module) {
        return false;
    }

    if (module.effective_can_start_new_work != null) {
        return module.effective_can_start_new_work === true;
    }

    return evaluateModuleCommercial(module, options).can_start_new_work;
}

function isDemonstrationEnded(module, options) {
    if (!module) {
        return false;
    }

    if (module.effective_demonstration_ended != null) {
        return module.effective_demonstration_ended === true;
    }

    return evaluateModuleCommercial(module, options).demonstration_ended;
}

function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function removeModal(root) {
    if (!root || !root.parentNode) {
        return;
    }

    root.classList.add("is-leaving");

    window.setTimeout(() => {
        root.remove();
        document.documentElement.classList.remove("aurora-module-commercial-open");
    }, 180);
}

function openSupport() {
    if (typeof global.AuroraOpenSupport === "function") {
        global.AuroraOpenSupport();
        return;
    }

    if (global.AuroraSupport && typeof global.AuroraSupport.open === "function") {
        global.AuroraSupport.open();
    }
}

function showCommercialModal(config) {
    return new Promise((resolve) => {
        const root = document.createElement("section");
        root.className = "aurora-module-gate aurora-module-commercial-modal";
        root.innerHTML = [
            '<div class="aurora-module-gate__veil"></div>',
            '<article class="aurora-module-gate__panel aurora-module-commercial-modal__panel" role="dialog" aria-modal="true">',
            "<header><span>✦ Aurora</span><h1>", escapeHtml(config.title || "Mensagem"), "</h1>",
            "<p>", escapeHtml(config.message || ""), "</p></header>",
            '<div class="aurora-module-commercial-modal__actions">',
            (config.actions || []).map((action, index) => [
                '<button type="button" class="',
                action.primary ? "aurora-module-empty__primary" : "aurora-module-empty__secondary",
                '" data-commercial-action="', index, '">',
                escapeHtml(action.label || "OK"),
                "</button>"
            ].join("")).join(""),
            "</div></article>"
        ].join("");

        document.body.appendChild(root);
        document.documentElement.classList.add("aurora-module-commercial-open");

        root.querySelectorAll("[data-commercial-action]").forEach((button) => {
            button.addEventListener("click", async () => {
                const index = Number(button.dataset.commercialAction);
                const action = (config.actions || [])[index];

                if (action && typeof action.run === "function") {
                    await action.run();
                }

                removeModal(root);
                resolve(action && action.id ? action.id : "closed");
            });
        });
    });
}

function showModuleExpiredModal(module) {
    const moduleTitle = module && (module.title || module.module_code) ? (module.title || module.module_code) : "módulo";

    return showCommercialModal({
        title: "Sua demonstração terminou",
        message: [
            `O período de demonstração do módulo ${moduleTitle} foi encerrado.`,
            "Seus atendimentos e relatórios continuam disponíveis.",
            "Para continuar criando novos atendimentos, solicite a ativação ou fale com nosso suporte."
        ].join(" "),
        actions: [
            {
                id: "modules",
                label: "Ver meus módulos",
                run: () => global.AuroraModuleAccess && global.AuroraModuleAccess.openManager(
                    module && module.module_code ? module.module_code : ""
                )
            },
            {
                id: "support",
                label: "Falar com suporte",
                primary: true,
                run: () => openSupport()
            },
            {
                id: "continue",
                label: "Continuar na Aurora",
                run: () => undefined
            }
        ]
    });
}

function showActivateModuleModal(module) {
    const moduleTitle = module && (module.title || module.module_code) ? (module.title || module.module_code) : "módulo";

    return showCommercialModal({
        title: `Ativar ${moduleTitle}`,
        message: [
            "A contratação online estará disponível em breve.",
            "Enquanto isso, fale com nosso suporte para ativar este módulo ou solicitar mais alguns dias de demonstração."
        ].join(" "),
        actions: [
            {
                id: "support",
                label: "Falar com suporte",
                primary: true,
                run: () => openSupport()
            },
            {
                id: "close",
                label: "Fechar",
                run: () => undefined
            }
        ]
    });
}

async function resolveModuleRecord(moduleCode, options) {
    const targetCode = String(moduleCode || "").trim();

    async function selectCompatibleModule(modules) {
        if (!targetCode) {
            return modules[0] || null;
        }

        const candidates = [];

        for (const module of modules) {
            const moduleCode = String(module && module.module_code || "").trim();
            let matchKind = moduleCode === targetCode ? "exact" : "";

            if (
                !matchKind &&
                global.AuroraModuleAccess &&
                typeof global.AuroraModuleAccess.resolveOperationalActivation === "function"
            ) {
                const activation = await global.AuroraModuleAccess.resolveOperationalActivation(module);
                const profile = String(activation && activation.profile || "").trim();
                const serviceIds = Array.isArray(activation && activation.serviceIds)
                    ? activation.serviceIds.map((item) => String(item || "").trim())
                    : [];

                if (serviceIds.includes(targetCode)) {
                    matchKind = "service";
                } else if (profile === targetCode && serviceIds.includes(moduleCode)) {
                    matchKind = "profile";
                }
            }

            if (matchKind) {
                candidates.push({ module, matchKind });
            }
        }

        candidates.sort((left, right) => {
            const score = (candidate) => {
                const module = candidate.module || {};
                const allowed = canStartNewWork(module, options) ? 1 : 0;
                const included = String(module.access_status || "").trim().toLowerCase() === "included" ? 1 : 0;
                const company = String(module.access_source || "").trim() === "company_entitlement" ? 1 : 0;
                const exact = candidate.matchKind === "exact" ? 1 : 0;
                return (allowed * 1000) + (included * 100) + (company * 10) + exact;
            };

            return score(right) - score(left);
        });

        return candidates.length ? candidates[0].module : null;
    }

    if (
        global.AuroraModuleAccess &&
        typeof global.AuroraModuleAccess.loadModulesForUi === "function"
    ) {
        const result = await global.AuroraModuleAccess.loadModulesForUi();
        const modules = enrichModules(result.modules, {
            offlineSnapshot: result.offlineSnapshot,
            userId: options && options.userId
        });

        return selectCompatibleModule(modules);
    }

    if (global.AuroraModulesApi && typeof global.AuroraModulesApi.listMyModules === "function") {
        const modules = enrichModules(await global.AuroraModulesApi.listMyModules(), options);

        return selectCompatibleModule(modules);
    }

    return null;
}

async function gateNewWork(moduleCode, options) {
    options = options || {};
    const module = options.module || await resolveModuleRecord(moduleCode, options);

    if (!module) {
        if (!options.silent) {
            await global.AuroraDialog.alert(
                "Não foi possível verificar a licença deste módulo. Tente novamente com internet.",
                { title: "Módulo indisponível" }
            );
        }

        return false;
    }

    if (canStartNewWork(module, options)) {
        return true;
    }

    if (!options.silent) {
        await showModuleExpiredModal(module);
    }

    return false;
}

function isSameCaseIdentity(existingCase, candidateCase) {
    const left = String(existingCase && existingCase.id || "").trim();
    const right = String(candidateCase && candidateCase.id || "").trim();
    return Boolean(left && right && left === right);
}

global.AuroraModuleCommercial = {
    getCommercialNowMs,
    evaluateModuleCommercial,
    enrichModule,
    enrichModules,
    canStartNewWork,
    isDemonstrationEnded,
    showModuleExpiredModal,
    showActivateModuleModal,
    openSupport,
    resolveModuleRecord,
    gateNewWork,
    isSameCaseIdentity
};

})(window);

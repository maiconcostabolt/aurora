(function (global) {
"use strict";

const ACTIVE_KEY = "aurora_active_module_v1";
const ONBOARDING_CONFIG_URL = "./config/onboarding.json";
const EXPLICIT_SESSION_KEY = "aurora_explicit_module_session_v1";
let onboardingSegmentsPromise = null;
let registeredOnboardingSegments = null;
function r44trace(event,data,phase){try{if(global.AuroraR44ModuleTrace)global.AuroraR44ModuleTrace.mark(event,data,phase||"module_access")}catch(_){}}

const STATUS_LABELS = {
    included: "Licença ativa",
    trial: "Demonstração",
    available: "Demonstração disponível · 7 dias",
    locked: "Bloqueado",
    expired: "Demonstração encerrada",
    company_authorized: "Licença ativa"
};

function commercialApi() {
    return global.AuroraModuleCommercial || null;
}

function enrichModulesList(modules, offlineSnapshot) {
    const api = commercialApi();

    if (!api || typeof api.enrichModules !== "function") {
        return modules;
    }

    return api.enrichModules(modules, {
        offlineSnapshot,
        userId: global.AURORA_ACCOUNT_USER_ID
    });
}

function canStartNewWork(module, offlineSnapshot) {
    const api = commercialApi();

    if (api && typeof api.canStartNewWork === "function") {
        return api.canStartNewWork(module, { offlineSnapshot });
    }

    return Boolean(module && module.can_access === true);
}

function isDemonstrationEnded(module, offlineSnapshot) {
    const api = commercialApi();

    if (api && typeof api.isDemonstrationEnded === "function") {
        return api.isDemonstrationEnded(module, { offlineSnapshot });
    }

    return false;
}

function activeStorageKey() {
    return `${ACTIVE_KEY}:${String(global.AURORA_ACCOUNT_USER_ID || "anonymous")}`;
}

/* V168 — snapshot local dos ambientes efetivamente autorizados.
 * É atualizado SOMENTE a partir de uma leitura online já filtrada/autorizada e
 * serve apenas para o switcher/runtime quando navigator.onLine === false.
 * Não altera bootstrap, sessão, AuthReady ou decisão de cold-start. */
function moduleUiSnapshotKey(userId) {
    return `aurora_module_ui_snapshot_v168:${String(userId || global.AURORA_ACCOUNT_USER_ID || "anonymous")}`;
}

function saveModuleUiSnapshot(userId, modules) {
    const safe = (Array.isArray(modules) ? modules : []).filter((item) => item && item.can_access === true).map((item) => ({
        module_code: String(item.module_code || "").trim(),
        license_module_code: String(item.license_module_code || item.module_code || "").trim(),
        title: String(item.title || ""),
        icon: String(item.icon || ""),
        can_access: true,
        access_status: String(item.access_status || "included"),
        ends_at: item.ends_at || null,
        operational_profile: String(item.operational_profile || ""),
        operational_services: Array.isArray(item.operational_services) ? item.operational_services.slice() : [],
        access_source: String(item.access_source || "offline_authorized_snapshot")
    })).filter((item) => item.module_code);
    if (!safe.length) return;
    try { localStorage.setItem(moduleUiSnapshotKey(userId), JSON.stringify({ saved_at: Date.now(), modules: safe })); } catch (_) {}
}

function readModuleUiSnapshot(userId) {
    try {
        const raw = JSON.parse(localStorage.getItem(moduleUiSnapshotKey(userId)) || "null");
        return raw && Array.isArray(raw.modules) ? raw.modules : [];
    } catch (_) { return []; }
}

function readActive() {
    try {
        const key = activeStorageKey();
        const value = sessionStorage.getItem(key) || localStorage.getItem(key) || "";
        r44trace("LICENSE_MODULE_READ", { authority: "readActive", key, value });
        return value;
    } catch (_) { return ""; }
}

function saveActive(code) {
    const value = String(code || "");
    const before = readActive();
    try { sessionStorage.setItem(activeStorageKey(), value); } catch (_) {}
    try { localStorage.setItem(activeStorageKey(), value); } catch (_) {}
    r44trace(before && before !== value ? "MODULE_OVERRIDE" : "AFTER_PERSIST",{authority:"saveActive",previous:before,next:value,key:activeStorageKey(),read_after:readActive()});
}

function clearActiveForCurrentUser() {
    const key = activeStorageKey();
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { sessionStorage.removeItem(`${EXPLICIT_SESSION_KEY}:${String(global.AURORA_ACCOUNT_USER_ID || "anonymous")}`); } catch (_) {}
    try { localStorage.removeItem(key); } catch (_) {}
}

/* V43 — QR aberto pela câmera pode chegar antes de AURORA_ACCOUNT_USER_ID estar
 * disponível. Nesse caso saveActive() gravava em :anonymous e o reload voltava
 * ao módulo anterior, criando um ciclo infinito. Esta entrada grava a seleção
 * diretamente na chave canônica do usuário autenticado. */
function activateForUser(code, userId) {
    const value = String(code || "").trim();
    const uid = String(userId || "").trim();
    if (!value || !uid) return false;
    const key = `${ACTIVE_KEY}:${uid}`;
    let before="";try{before=sessionStorage.getItem(key)||localStorage.getItem(key)||""}catch(_){}
    try { sessionStorage.setItem(key, value); } catch (_) {}
    try { localStorage.setItem(key, value); } catch (_) {}
    let after="";try{after=sessionStorage.getItem(key)||localStorage.getItem(key)||""}catch(_){}
    r44trace(before && before !== value ? "MODULE_OVERRIDE" : "AFTER_PERSIST",{authority:"activateForUser",uid,key,previous:before,next:value,read_after:after});
    return true;
}

function clearActive() {
    try { sessionStorage.removeItem(activeStorageKey()); } catch (_) {}
    try { sessionStorage.removeItem(explicitSessionKey()); } catch (_) {}
    try { localStorage.removeItem(activeStorageKey()); } catch (_) {}
}

function explicitSessionKey(userId) {
    return `${EXPLICIT_SESSION_KEY}:${String(userId || global.AURORA_ACCOUNT_USER_ID || "anonymous")}`;
}

function markExplicitSessionModule(code) {
    try { sessionStorage.setItem(explicitSessionKey(), String(code || "")); } catch (_) {}
}

/* R39 — a troca manual pode acontecer antes/depois de diferentes publicações do
 * global AURORA_ACCOUNT_USER_ID. Para sobreviver ao reload offline, grave/leia o
 * marcador de sessão pela UID autenticada que o bootstrap já conhece. */
function markExplicitSessionModuleForUser(code, userId) {
    const uid = String(userId || "").trim();
    if (!uid) return false;
    try {const key=explicitSessionKey(uid),previous=sessionStorage.getItem(key)||"",next=String(code||"");sessionStorage.setItem(key,next);r44trace(previous&&previous!==next?"MODULE_OVERRIDE":"AFTER_PERSIST",{authority:"markExplicitSessionModuleForUser",uid,key,previous,next,read_after:sessionStorage.getItem(key)||""});return true;} catch (_) { return false; }
}

function readExplicitSessionModule(userId) {
    try {const key=explicitSessionKey(userId),value=String(sessionStorage.getItem(key)||"");r44trace("EXPLICIT_MODULE_READ",{userId:String(userId||""),key,value});return value;} catch (_) { return ""; }
}

function usable(module, offlineSnapshot) {
    return canStartNewWork(module, offlineSnapshot);
}

function canStartTrial(module) {
    return Boolean(module && module.access_status === "available");
}

function moduleAccessPriority(module) {
    const status = String(module && module.access_status || "").trim().toLowerCase();
    if (status === "included") return 0;
    if (status === "trial") return 1;
    return 2;
}

function pickPreferredAccessibleModule(modules) {
    const accessible = (Array.isArray(modules) ? modules : []).filter((item) => item.can_access === true);
    if (!accessible.length) return null;
    const included = accessible.filter((item) => moduleAccessPriority(item) === 0);
    return included[0] || accessible[0];
}

function registerOnboardingSegments(segments) {
    registeredOnboardingSegments = Array.isArray(segments) ? segments.slice() : [];
}

function loadOnboardingSegments() {
    if (registeredOnboardingSegments) {
        return Promise.resolve(registeredOnboardingSegments);
    }
    if (!onboardingSegmentsPromise) {
        onboardingSegmentsPromise = fetch(ONBOARDING_CONFIG_URL, { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : { segments: [] }))
            .then((config) => (Array.isArray(config.segments) ? config.segments : []))
            .catch(() => []);
    }
    return onboardingSegmentsPromise;
}

/**
 * Licença empresarial (module_code em aurora_modules) pode mapear para um segmento
 * operacional + serviço (ex.: eletrica_tupy → electrical + eletrica_tupy).
 * Deriva do onboarding.json — sem hardcode de empresa ou módulo.
 */
async function resolveOperationalActivation(licenseModule) {
    const code = String(licenseModule && licenseModule.module_code || "").trim();
    r44trace("MODULE_RESOLUTION",{authority:"resolveOperationalActivation:start",requested_module:code,license_module:licenseModule});
    if (!code) {
        return { profile: "", serviceIds: [] };
    }

    // Vistoria veicular é um produto/licença independente, mas reutiliza
    // o fluxo operacional já validado de veículo da Oficina.
    if (code === "vehicle_inspection") {
        return { profile: "workshop", serviceIds: ["vehicle_inspection"] };
    }

    /* V172 — ROTEADOR DE APLICATIVOS INTERNOS.
     * Atividades Rotineiras Tupy é um ambiente/aplicativo autorizado próprio.
     * Tecnicamente ele reutiliza o profile electrical + service eletrica_tupy já
     * existente e aprovado; não depende de onboarding.json para descobrir essa
     * entrada e não mistura os seis serviços da Elétrica com o bloco Tupy. */
    if (code === "eletrica_tupy") {
        const result={ profile: "electrical", serviceIds: ["eletrica_tupy"] };r44trace("PROFILE_RESOLUTION",{authority:"resolveOperationalActivation:eletrica_tupy",requested_module:code,result});return result;
    }

    const segments = await loadOnboardingSegments();
    const segmentIds = new Set(segments.map((segment) => String(segment.id || "").trim()));

    if (segmentIds.has(code)) {
        return { profile: code, serviceIds: [] };
    }

    for (const segment of segments) {
        const services = Array.isArray(segment.services) ? segment.services : [];
        const match = services.find((service) => String(service.id || "").trim() === code);
        if (match) {
            return { profile: String(segment.id), serviceIds: [code] };
        }
    }

    return { profile: code, serviceIds: [] };
}

function activeCompanyEntitlementCodes(access) {
    if (!access || access.loaded !== true || !access.company_id) return [];
    if (String(access.status || "").trim().toLowerCase() !== "active") return [];

    const entitlements = access.entitlements && typeof access.entitlements === "object"
        ? access.entitlements
        : {};
    const codes = Array.isArray(entitlements.modules)
        ? entitlements.modules.map((code) => String(code || "").trim()).filter(Boolean)
        : [];

    Object.keys(entitlements).forEach((code) => {
        if (code !== "modules" && entitlements[code] === true) {
            codes.push(String(code).trim());
        }
    });

    return Array.from(new Set(codes.filter(Boolean)));
}

async function resolveCompanyEntitlementModules(access) {
    let entitlementCodes = activeCompanyEntitlementCodes(access);
    if (!entitlementCodes.length) return [];

    /* V45 — para COMPANY_USER, a licença da empresa define apenas o que o ADMIN
     * pode oferecer. A autorização efetiva do funcionário vem exclusivamente de
     * aurora_company_member_modules. Nunca herdar preferred_module/selected_services
     * nem todos os entitlements da empresa. */
    const companyRole = String(access && access.role || "").trim().toUpperCase();
    const offlineStartup = global.AURORA_OFFLINE_STARTUP_CTX;
    const validSignedOfflineStartup = Boolean(
        offlineStartup &&
        offlineStartup.ok === true &&
        offlineStartup.mode === "cold_start_offline_ticket_valid" &&
        offlineStartup.verification &&
        offlineStartup.verification.valid === true
    );
    if (["COMPANY_USER", "USER_BOLT"].includes(companyRole)) {
        /* V73 — no cold-start físico sem rede, o License Ticket assinado já contém
         * exatamente os módulos autorizados do membro. Não iniciar RPC empresarial:
         * no Android/Chrome instalado a conexão pode ficar pendente em vez de falhar
         * imediatamente, bloqueando a Home. */
        if (validSignedOfflineStartup) {
            const allowed = new Set((Array.isArray(offlineStartup.modules) ? offlineStartup.modules : [])
                .filter((row) => row && row.can_access === true)
                .map((row) => String(row.module_code || "").trim())
                .filter(Boolean));
            entitlementCodes = entitlementCodes.filter((code) => allowed.has(String(code).trim()));
        } else try {
            const c = global.AuroraCloudSync && global.AuroraCloudSync.client;
            if (!c || typeof c.rpc !== "function") return [];
            const r = await c.rpc("aurora_my_company_authorized_modules");
            if (r && r.error) throw r.error;
            const allowed = new Set((Array.isArray(r && r.data) ? r.data : [])
                .map((row) => String(row && row.module_code || "").trim())
                .filter(Boolean));
            entitlementCodes = entitlementCodes.filter((code) => allowed.has(String(code).trim()));
        } catch (error) {
            console.warn("Aurora: autorização dos ambientes do membro indisponível; acesso negado por segurança.", error);
            entitlementCodes = [];
        }
        if (!entitlementCodes.length) return [];
    }

    const segments = await loadOnboardingSegments();
    const resolved = [];

    entitlementCodes.forEach((code) => {
        let match = null;

        for (const segment of segments) {
            if (String(segment.id || "").trim() === code) {
                match = {
                    profile: code,
                    serviceIds: [],
                    title: segment.title || code,
                    icon: segment.icon || "✦"
                };
                break;
            }

            const services = Array.isArray(segment.services) ? segment.services : [];
            const service = services.find((item) => String(item.id || "").trim() === code);
            if (service) {
                match = {
                    profile: String(segment.id || "").trim(),
                    serviceIds: [code],
                    title: service.title || code,
                    icon: service.icon || segment.icon || "✦"
                };
                break;
            }
        }

        if (!match) return;

        resolved.push({
            module_code: code,
            license_module_code: code,
            title: match.title,
            icon: match.icon,
            can_access: true,
            access_status: "included",
            operational_profile: match.profile,
            operational_services: match.serviceIds,
            access_source: "company_entitlement",
            company_id: access.company_id,
            company_role: access.role || null
        });
    });

    return resolved;
}

async function resolveCompanyEntitlementAccess(access) {
    const modules = await resolveCompanyEntitlementModules(access);
    return modules[0] || null;
}

async function mergeCompanyEntitlementAccess(modules) {
    const personalModules = Array.isArray(modules) ? modules.slice() : [];
    const access = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
        ? global.AuroraCompanyAccess.get()
        : (global.AURORA_COMPANY_ACCESS || null);
    const companyModules = await resolveCompanyEntitlementModules(access);

    companyModules.forEach((companyModule) => {
        const index = personalModules.findIndex((item) =>
            String(item && item.module_code || "").trim() === companyModule.module_code
        );
        if (index === -1) {
            personalModules.push(companyModule);
            return;
        }
        personalModules[index] = Object.assign({}, personalModules[index], companyModule);
    });

    return personalModules;
}

async function enrichModuleSelection(module) {
    if (!module) return module;
    const activation = await resolveOperationalActivation(module);
    return Object.assign({}, module, {
        operational_profile: activation.profile,
        operational_services: activation.serviceIds,
        license_module_code: module.module_code
    });
}

async function finalizeModuleSelection(module) {
    const enriched = await enrichModuleSelection(module);
    saveActive(enriched.license_module_code || enriched.module_code);
    return enriched;
}

function remainingText(module) {
    if (!module.ends_at) return "";
    const end = new Date(module.ends_at);
    if (Number.isNaN(end.getTime())) return "";
    return `Até ${end.toLocaleDateString("pt-BR")}`;
}

function statusLabel(item, offlineSnapshot) {
    if (isDemonstrationEnded(item, offlineSnapshot)) {
        return STATUS_LABELS.expired;
    }

    return STATUS_LABELS[item.access_status] || item.access_status;
}

function actionLabel(item, options) {
    if (isDemonstrationEnded(item, options.offlineSnapshot)) {
        return options.manager ? "Ativar módulo" : "Consultar";
    }

    if (usable(item, options.offlineSnapshot)) {
        return item.module_code === options.current ? "Atual" : "Entrar";
    }

    if (canStartTrial(item)) {
        return options.offlineSnapshot ? "Requer internet" : "Testar 7 dias";
    }

    return "Teste utilizado";
}

function modulePresentation(item) {
    const code = String(item && item.module_code || "").trim().toLowerCase();
    if (code === "eletrica_tupy") {
        return { title: "ATIVIDADES ROTINEIRAS TUPY", icon: "🏭" };
    }
    return { title: item && item.title || "", icon: item && item.icon || "✦" };
}

function canSelectModule(item, options) {
    if (usable(item, options.offlineSnapshot)) {
        return true;
    }

    if (isDemonstrationEnded(item, options.offlineSnapshot)) {
        return Boolean(options.manager || !options.switcher);
    }

    return !options.switcher && canStartTrial(item) && !options.offlineSnapshot;
}

function choose(modules, options = {}) {
    modules = enrichModulesList(modules, options.offlineSnapshot);

    /* R19 — Atividades Rotineiras é ambiente privado empresarial.
     * Não altera a resolução/licença já aprovada da Bolt e não cria nova
     * autoridade de acesso. Apenas impede que `eletrica_tupy` apareça no
     * catálogo público quando a própria resolução oficial já o considera
     * indisponível/bloqueado.
     *
     * Assim:
     * - ADMIN/USER Bolt legitimamente autorizado mantém o módulo e todo o
     *   contexto empresarial já existente (Home, Minha Equipe e catálogos);
     * - conta externa com licença removida não vê um card privado
     *   "Bloqueado / Teste utilizado".
     */
    modules = modules.filter((item) => {
        const code = String(item && item.module_code || "").trim().toLowerCase();
        if (code !== "eletrica_tupy") return true;
        return usable(item, options.offlineSnapshot);
    });

    const available = modules.filter((item) => usable(item, options.offlineSnapshot));
    return new Promise((resolve, reject) => {
        const root = document.createElement("section");
        root.className = "aurora-module-gate";
        root.innerHTML = [
            '<div class="aurora-module-gate__veil"></div>',
            '<article class="aurora-module-gate__panel" role="dialog" aria-modal="true">',
            '<header><span>✦ Módulos Aurora</span><h1>',
            options.switcher ? "Trocar segmento" : options.manager ? "Seus módulos" : "Em qual serviço você deseja trabalhar?",
            '</h1><p>',
            options.switcher
                ? "Escolha um dos segmentos que você já ativou e configurou."
                : options.manager
                ? (options.offlineSnapshot
                    ? "Exibindo licenças da última validação online. Conecte-se à internet para atualizar ou ativar demonstrações."
                    : "Consulte suas licenças, inicie uma demonstração disponível ou troque o ambiente ativo.")
                : "Escolha um módulo. Cada demonstração dura 7 dias e pode ser utilizada uma única vez nesta conta.",
            '</p></header>',
            '<div class="aurora-module-list">',
            modules.map((item) => {
                const presentation = modulePresentation(item);
                return [
                '<button type="button" data-module="', item.module_code, '" ',
                canSelectModule(item, options) ? "" : "disabled",
                isDemonstrationEnded(item, options.offlineSnapshot) ? ' data-module-expired="1"' : "",
                '>',
                '<b>', presentation.icon, '</b><div><strong>', presentation.title, '</strong><small>',
                statusLabel(item, options.offlineSnapshot),
                remainingText(item) && !isDemonstrationEnded(item, options.offlineSnapshot) ? ` · ${remainingText(item)}` : "",
                '</small></div><span>', actionLabel(item, options), '</span>',
                '</button>'
                ].join("");
            }).join(""),
            '</div>',
            (options.manager || options.switcher) ? '<button class="aurora-module-gate__close" type="button" data-module-close>Fechar</button>' : "",
            '</article>'
        ].join("");
        document.body.appendChild(root);

        const refresh = root.querySelector("[data-module-refresh]");
        if (refresh) refresh.addEventListener("click", () => global.location.reload());
        const signout = root.querySelector("[data-module-signout]");
        if (signout) signout.addEventListener("click", () => {
            global.dispatchEvent(new CustomEvent("aurora:account-signout-request"));
        });

        root.querySelectorAll("[data-module]").forEach((button) => {
            button.addEventListener("click", async () => {
                let selected = modules.find((item) => item.module_code === button.dataset.module);
                if (!selected || !canSelectModule(selected, options)) return;

                if (options.manager && isDemonstrationEnded(selected, options.offlineSnapshot)) {
                    if (commercialApi() && typeof commercialApi().showActivateModuleModal === "function") {
                        await commercialApi().showActivateModuleModal(selected);
                    }
                    return;
                }

                if (canStartTrial(selected)) {
                    if (options.offlineSnapshot) {
                        await global.AuroraDialog.alert(
                            "Conecte-se à internet para ativar esta demonstração ou módulo.",
                            { title: "Conexão necessária" }
                        );
                        return;
                    }
                    const confirmed = await global.AuroraDialog.confirm(`A demonstração de 7 dias de ${selected.title} poderá ser utilizada somente uma vez nesta conta.`, { title: "Iniciar demonstração?", confirmLabel: "Iniciar" });
                    if (!confirmed) return;
                    button.disabled = true;
                    const previous = button.querySelector("span").textContent;
                    button.querySelector("span").textContent = "Ativando…";
                    try {
                        await global.AuroraModulesApi.startModuleTrial(selected.module_code);
                        const refreshed = enrichModulesList(await global.AuroraModulesApi.listMyModules(), false);
                        selected = refreshed.find((item) => item.module_code === selected.module_code);
                        if (!usable(selected, false)) throw new Error("A demonstração não foi liberada.");
                        saveActive(selected.module_code);
                    } catch (error) {
                        button.disabled = false;
                        button.querySelector("span").textContent = previous;
                        await global.AuroraDialog.alert(error.message || error, { title: "Não foi possível iniciar", tone: "danger" });
                        return;
                    }
                }
                if (!options.manager) saveActive(selected.module_code);
                root.classList.add("is-leaving");
                setTimeout(() => { root.remove(); resolve(selected); }, 220);
            });
        });
        const close = root.querySelector("[data-module-close]");
        if (close) close.addEventListener("click", () => {
            root.remove();
            resolve(null);
        });
    });
}

async function filterMemberAllowedModules(modules) {
    const list = Array.isArray(modules) ? modules : [];
    const claim = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
        ? global.AuroraCompanyAccess.get()
        : (global.AURORA_COMPANY_ACCESS || {});
    const role = String(claim && claim.role || "").trim().toUpperCase();
    const companyId = String(claim && claim.company_id || "").trim();
    const userId = String(global.AURORA_ACCOUNT_USER_ID || "").trim();
    const isAdmin = ["COMPANY_ADMIN", "ADMIN_BOLT", "OWNER"].includes(role);
    const isCompanyUser = ["COMPANY_USER", "USER_BOLT"].includes(role);
    const cacheKey = "aurora_member_allowed_modules_v2:" + (userId || "unknown");

    if (isAdmin) return list;

    /* V48 — autorização de membro é fail-closed e por usuário.
     * A V45/V47 usava um cache global e, em falha/boot antecipado da RPC,
     * devolvia a lista original. Isso permitia que módulos pessoais antigos
     * (ex.: electrical/panel) sobrevivessem mesmo com zero ambientes marcados.
     * Para COMPANY_USER, somente a RPC empresarial pode liberar módulos. */
    if (isCompanyUser && companyId) {
        const offlineStartup = global.AURORA_OFFLINE_STARTUP_CTX;
        const validSignedOfflineStartup = Boolean(
            offlineStartup &&
            offlineStartup.ok === true &&
            offlineStartup.mode === "cold_start_offline_ticket_valid" &&
            offlineStartup.verification &&
            offlineStartup.verification.valid === true
        );
        if (validSignedOfflineStartup) {
            const allowed = new Set((Array.isArray(offlineStartup.modules) ? offlineStartup.modules : [])
                .filter((row) => row && row.can_access === true)
                .map((row) => String(row.module_code || "").trim())
                .filter(Boolean));
            global.AURORA_MEMBER_AWAITING_ENVIRONMENT = allowed.size === 0;
            return list.filter((m) => allowed.has(String(m && m.module_code || "").trim()));
        }
        /* V168 — durante uso offline em runtime, nunca abrir RPC para decidir o
         * switcher. O cache abaixo foi gravado pela própria RPC quando online. */
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            try {
                const raw = localStorage.getItem(cacheKey);
                if (raw !== null) {
                    const cached = new Set((JSON.parse(raw) || []).map((x) => String(x || "").trim()).filter(Boolean));
                    global.AURORA_MEMBER_AWAITING_ENVIRONMENT = cached.size === 0;
                    return list.filter((m) => cached.has(String(m && m.module_code || "").trim()));
                }
            } catch (_) {}
            /* Sem cache de grants, mantém fail-closed. */
            global.AURORA_MEMBER_AWAITING_ENVIRONMENT = true;
            return [];
        }
        try {
            const c = global.AuroraCloudSync && global.AuroraCloudSync.client;
            if (!c || typeof c.rpc !== "function") throw new Error("AURORA_MEMBER_MODULES_NOT_READY");
            const r = await c.rpc("aurora_my_company_authorized_modules");
            if (r && r.error) throw r.error;
            const allowed = new Set((Array.isArray(r && r.data) ? r.data : [])
                .map((x) => String(x && x.module_code || "").trim())
                .filter(Boolean));
            try { localStorage.setItem(cacheKey, JSON.stringify([...allowed])); } catch (_) {}
            if (!allowed.size) {
                global.AURORA_MEMBER_AWAITING_ENVIRONMENT = true;
                clearActiveForCurrentUser();
                return [];
            }
            global.AURORA_MEMBER_AWAITING_ENVIRONMENT = false;
            return list.filter((m) => allowed.has(String(m && m.module_code || "").trim()));
        } catch (error) {
            console.warn("Aurora: ambientes do membro ainda não confirmados; acesso negado por segurança.", error);
            try {
                const raw = localStorage.getItem(cacheKey);
                if (raw !== null) {
                    const cached = new Set((JSON.parse(raw) || []).map((x) => String(x || "").trim()).filter(Boolean));
                    if (!cached.size) {
                        global.AURORA_MEMBER_AWAITING_ENVIRONMENT = true;
                        clearActiveForCurrentUser();
                        return [];
                    }
                    return list.filter((m) => cached.has(String(m && m.module_code || "").trim()));
                }
            } catch (_) {}
            global.AURORA_MEMBER_AWAITING_ENVIRONMENT = true;
            clearActiveForCurrentUser();
            return [];
        }
    }

    /* Conta ainda sem claim empresarial confirmado: não reutiliza cache de outro
     * usuário. Contas pessoais continuam com o comportamento original. */
    return list;
}

async function loadModulesForUi() {
    if (!global.AuroraModulesApi) {
        throw new Error("A conexão dos Módulos Aurora não está disponível.");
    }

    const userId = String(global.AURORA_ACCOUNT_USER_ID || "").trim();
    const offlineLicense = global.AuroraOfflineLicense;
    const hasOfflineFallback = Boolean(
        userId &&
        offlineLicense &&
        typeof offlineLicense.loadModulesForOfflineStartup === "function"
    );
    const networkOffline = typeof navigator !== "undefined" && navigator.onLine === false;

    if (!hasOfflineFallback) {
        return {
            modules: enrichModulesList(
                await filterMemberAllowedModules(await mergeCompanyEntitlementAccess(await global.AuroraModulesApi.listMyModules())),
                false
            ),
            offlineSnapshot: false
        };
    }

    if (networkOffline) {
        const cached = readModuleUiSnapshot(userId);
        const source = cached.length ? cached : await offlineLicense.loadModulesForOfflineStartup(userId);
        const modules = enrichModulesList(await filterMemberAllowedModules(source), true);
        try { if (global.AuroraBootDiagV78) global.AuroraBootDiagV78.mark("V168_MODULES_OFFLINE", `cached=${cached.length} usable=${modules.length}`); } catch (_) {}
        return { modules, offlineSnapshot: true };
    }

    try {
        const modules = enrichModulesList(
            await filterMemberAllowedModules(await mergeCompanyEntitlementAccess(await global.AuroraModulesApi.listMyModules())),
            false
        );
        saveModuleUiSnapshot(userId, modules);
        try { if (global.AuroraBootDiagV78) global.AuroraBootDiagV78.mark("V168_MODULES_ONLINE_CACHED", `count=${modules.length}`); } catch (_) {}
        return { modules, offlineSnapshot: false };
    } catch (error) {
        if (
            global.AuroraCloudSync &&
            typeof global.AuroraCloudSync.isRetryableNetworkError === "function" &&
            global.AuroraCloudSync.isRetryableNetworkError(error)
        ) {
            return {
                modules: enrichModulesList(
                    await filterMemberAllowedModules(await mergeCompanyEntitlementAccess(await offlineLicense.loadModulesForOfflineStartup(userId))),
                    true
                ),
                offlineSnapshot: true
            };
        }

        throw error;
    }
}

async function loadOrClaim(identity) {
    const result = await loadModulesForUi();
    return result.modules;
}

async function resolve(identity) {
    const { modules, offlineSnapshot } = await loadModulesForUi();
    const workable = modules.filter((item) => usable(item, offlineSnapshot));

    // A escolha explícita do usuário sempre tem prioridade sobre a ordem das licenças.
    // Antes, o primeiro módulo "included" (normalmente Oficina) era retornado aqui
    // antes de ler aurora_active_module_v1, fazendo TODA troca voltar para Oficina.
    let stored = readActive();

    if (workable.length > 1 &&
        !stored &&
        global.AuroraOfflineLicense &&
        typeof global.AuroraOfflineLicense.resolveColdStartTicketContext === "function") {
        const startupContext = global.AURORA_OFFLINE_STARTUP_CTX ||
            await global.AuroraOfflineLicense.resolveColdStartTicketContext(
                String(global.AURORA_ACCOUNT_USER_ID || "").trim()
            );
        if (startupContext && startupContext.ok && startupContext.active_module) {
            stored = String(startupContext.active_module);
        }
    }

    if (stored) {
        const storedByCode = workable.find((item) => item.module_code === stored);
        if (storedByCode) return finalizeModuleSelection(storedByCode);

        for (const item of workable) {
            const activation = await resolveOperationalActivation(item);
            if (activation.profile === stored) return finalizeModuleSelection(item);
        }
    }

    if (workable.length === 1) {
        return finalizeModuleSelection(workable[0]);
    }

    if (workable.length > 1) {

        const chosen = await choose(modules, { offlineSnapshot });
        return chosen ? finalizeModuleSelection(chosen) : null;
    }

    const fallbackStored = readActive();
    const fallback = modules.find((item) => item.module_code === fallbackStored) || modules[0] || null;

    if (fallback) {
        return finalizeModuleSelection(fallback);
    }

    /* V44 — COMPANY_USER recém-convidado sem ambiente concedido pelo ADMIN.
     * Membership já foi aceita, portanto nunca abrir o gate comercial de módulos.
     * A Home empresarial sobe em estado restrito até Minha Equipe conceder um ambiente. */
    const companyClaim = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
        ? global.AuroraCompanyAccess.get()
        : (global.AURORA_COMPANY_ACCESS || {});
    const companyRole = String(companyClaim && companyClaim.role || "").trim().toUpperCase();
    if (["COMPANY_USER", "USER_BOLT"].includes(companyRole) && companyClaim.company_id) {
        global.AURORA_MEMBER_AWAITING_ENVIRONMENT = true;
        return null;
    }

    const chosen = await choose(modules, { offlineSnapshot });
    return chosen ? finalizeModuleSelection(chosen) : null;
}

async function openManager(current) {
    const { modules, offlineSnapshot } = await loadModulesForUi();
    const selected = await choose(modules, { manager: true, current, offlineSnapshot });
    if (selected && selected.module_code) markExplicitSessionModule(selected.module_code);
    return selected || null;
}

async function openSwitcher(current, configuredModuleCodes) {
    let { modules, offlineSnapshot } = await loadModulesForUi();
    const companyClaim = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
        ? global.AuroraCompanyAccess.get()
        : (global.AURORA_COMPANY_ACCESS || global.AURORA_COMPANY_CLAIM || {});
    const companyRole = String(companyClaim.role || global.AURORA_ACCOUNT_ROLE || "").trim().toUpperCase();
    const isCompanyUser = ["COMPANY_USER", "USER_BOLT"].includes(companyRole);

    /* V137 — no modo empresarial, o switcher usa como autoridade a lista efetiva
     * devolvida por aurora_my_modules. A RPC já combina licença da empresa + grants
     * de Minha Equipe. Assim electrical e eletrica_tupy permanecem módulos distintos
     * e qualquer quantidade futura de módulos autorizados aparece dinamicamente. */
    const isCompanyAdmin = Boolean(
        global.AuroraCompanyAccess &&
        typeof global.AuroraCompanyAccess.canManageUsers === "function" &&
        global.AuroraCompanyAccess.canManageUsers()
    );
    if ((isCompanyUser || isCompanyAdmin) && !offlineSnapshot && global.AuroraModulesApi && typeof global.AuroraModulesApi.listMyModules === "function") {
        const effective = await global.AuroraModulesApi.listMyModules();
        modules = enrichModulesList(
            (Array.isArray(effective) ? effective : []).filter((item) => item && item.can_access === true),
            false
        );
    }

    /* V50 — para funcionário convidado, loadModulesForUi() já devolve SOMENTE os
     * ambientes concedidos pelo ADMIN. Não voltamos a filtrar pela seleção antiga
     * do perfil (selected_services_by_module), pois isso poderia esconder Oficina
     * mesmo estando autorizada em Minha Equipe. ADMIN/conta pessoal preservam o
     * comportamento anterior. */
    const allowed = new Set((configuredModuleCodes || []).map((code) => String(code || "").trim()));
    const configured = modules.filter((item) => {
        /* V172 — quando a lista veio do snapshot autorizado offline, ela própria é
         * a autoridade do painel de aplicativos. Não voltar a filtrá-la pelo mapa
         * legado selected_services_by_module, que foi exatamente o que escondia
         * Bolt/Atividades Rotineiras e deixava apenas Elétrica no switcher. */
        if (offlineSnapshot) return usable(item, true);

        /* V124 — COMPANY_ADMIN usa as licenças reais carregadas do Supabase como
         * autoridade do switcher. Não usar selected_services_by_module legado, pois
         * ele pode conter demonstrações antigas (ex.: Drone) e omitir licença privada. */
        if (!isCompanyUser && !isCompanyAdmin && !allowed.has(String(item.module_code || "").trim())) {
            return false;
        }
        if (isCompanyAdmin) return usable(item, false);
        return usable(item, false) || isDemonstrationEnded(item, false);
    });
    if (!configured.length) return null;
    const selected = await choose(configured, { switcher: true, current, offlineSnapshot });
    if (!selected) return null;

    /* V141 — Trocar segmento e Módulos Aurora passam pela MESMA resolução
     * operacional. Antes, openManager() resolvia eletrica_tupy -> electrical +
     * [eletrica_tupy], enquanto openSwitcher() devolvia apenas o módulo bruto.
     * Isso fazia o switcher tratar Atividades Rotineiras como um segmento sem
     * serviços configurados. O retorno enriquecido elimina os dois caminhos. */
    const enriched = await enrichModuleSelection(selected);
    if (enriched && enriched.module_code) markExplicitSessionModule(enriched.module_code);
    return enriched || null;
}

global.AuroraModuleAccess = {
    resolve,
    openManager,
    openSwitcher,
    clearActive,
    activate: saveActive,
    activateForUser,
    clearActiveForCurrentUser,
    loadModulesForUi,
    enrichModulesList,
    resolveOperationalActivation,
    resolveCompanyEntitlementAccess,
    resolveCompanyEntitlementModules,
    mergeCompanyEntitlementAccess,
    enrichModuleSelection,
    pickPreferredAccessibleModule,
    moduleAccessPriority,
    registerOnboardingSegments,
    readExplicitSessionModule,
    markExplicitSessionModuleForUser
};

})(window);

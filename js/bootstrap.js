try{window.AuroraBootDiagV78&&window.AuroraBootDiagV78.mark("ENTER_BOOTSTRAP","js/bootstrap.js iniciou")}catch(_){}
(async function (global) {
"use strict";
    try { global.__AURORA_BOOTSTRAP_BUILD__ = "AURORA V47 RC1 R59 CANONICAL REPORT COMPACTION"; } catch (_) {}
    const v78mark = (stage, detail) => {
        try {
            if (global.AuroraBootDiagV78 && typeof global.AuroraBootDiagV78.mark === "function") {
                global.AuroraBootDiagV78.mark(stage, detail || "");
            }
        } catch (_) {}
    };

const status =
    document.getElementById(
        "app-status"
    );

let auroraBootStage = "BOOT_START";
let auroraLastCompletedStage = "BOOT_START";

function r46mark(event, detail, phase) {
    try {
        if (global.AuroraR47ColdStartTrace && typeof global.AuroraR47ColdStartTrace.mark === "function") {
            global.AuroraR47ColdStartTrace.mark(event, detail || {}, phase || "bootstrap");
        }
    } catch (_) {}
}

function auroraBootMark(stage, detail) {
    auroraBootStage = stage;
    if (stage !== "BOOT_ERROR" && !/_START$/.test(String(stage || ""))) auroraLastCompletedStage = stage;
    const payload =
        detail && typeof detail === "object"
            ? { stage, ...detail }
            : { stage };
    console.log("AURORA_BOOT", payload);
    try {
        const key = "aurora_boot_trace_v1";
        const trace = JSON.parse(
            global.sessionStorage.getItem(key) || "[]"
        );
        trace.push({
            ...payload,
            at: new Date().toISOString()
        });
        global.sessionStorage.setItem(
            key,
            JSON.stringify(trace.slice(-24))
        );
    } catch (bootTraceError) {
        console.warn("AURORA_BOOT trace unavailable", bootTraceError);
    }
    r46mark(stage, payload, "bootstrap");
}

function auroraBootError(stage, error) {
    auroraBootMark("BOOT_ERROR", {
        stage,
        error_name: error && error.name ? String(error.name) : "",
        message:
            error && error.message
                ? String(error.message)
                : String(error || "unknown"),
        stack:
            error && error.stack
                ? String(error.stack)
                : "",
        last_completed_stage: auroraLastCompletedStage,
        navigator_online: navigator.onLine
    });
}

function auroraBootFailureMessage(stage, error) {
    const message = String(
        (error && error.message) || ""
    ).toLowerCase();

    if (error && error.code === "AURORA_COMPANY_MODULE_INACTIVE") {
        return "Seu acesso à equipe está confirmado, mas o módulo da empresa precisa ser ativado ou renovado pelo administrador.";
    }

    if (
        stage === "BOOT_AUTH" ||
        message.includes("conta autenticada")
    ) {
        return "Não foi possível validar sua sessão local. Entre novamente quando puder.";
    }

    if (
        message.includes("quota") ||
        message.includes("storage") ||
        message.includes("localstorage")
    ) {
        return "Não foi possível usar o armazenamento local deste aparelho. Libere espaço e tente novamente.";
    }

    if (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("offline") ||
        message.includes("conex")
    ) {
        return "A Aurora não conseguiu concluir a abertura agora. Verifique sua conexão e tente novamente.";
    }

    return "A Aurora encontrou um erro interno ao iniciar. Atualize a página e, se persistir, reinstale a versão mais recente.";
}

auroraBootMark("BOOT_HTML_READY");

const config =
    global.AURORA_RUNTIME_CONFIG;

const COMPANY_STORAGE_KEY =
    "aurora_company_identity_rc1_5";

const REPORTS_STORAGE_KEY =
    "aurora_reports";

const CUSTOM_SERVICES_STORAGE_KEY =
    "aurora_custom_services_v1";

const repository =
    new global.LocalCaseRepository({
        storageKey:
            config.storage.case_key
    });

function clone(value) {
    return JSON.parse(
        JSON.stringify(value)
    );
}

function resolveLoggedInUserFullName() {
    if (
        global.AuroraUserProfile &&
        typeof global.AuroraUserProfile.getUserFullName === "function"
    ) {
        return String(
            global.AuroraUserProfile.getUserFullName() || ""
        ).trim();
    }

    return "";
}

function resolveLoggedInUserId() {
    if (
        global.AuroraUserProfile &&
        typeof global.AuroraUserProfile.getUserId === "function"
    ) {
        return String(
            global.AuroraUserProfile.getUserId() || ""
        ).trim();
    }

    return String(global.AURORA_ACCOUNT_USER_ID || "").trim();
}

function hasActiveCompanyMembershipEntitlement() {
    var access = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
        ? global.AuroraCompanyAccess.get()
        : (global.AURORA_COMPANY_ACCESS || null);
    if (!access || access.loaded !== true || !access.company_id) return false;
    if (String(access.status || "").toLowerCase() !== "active") return false;
    var ent = access.entitlements || {};
    if (Array.isArray(ent.modules) && ent.modules.length > 0) return true;
    return Object.keys(ent).some(function (key) {
        return key !== "modules" && ent[key] === true;
    });
}

function hasActiveCompanyMembership() {
    var access = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
        ? global.AuroraCompanyAccess.get()
        : (global.AURORA_COMPANY_ACCESS || null);
    if (!access || access.loaded !== true || !access.company_id) return false;
    return String(access.status || "").toLowerCase() === "active";
}

function companyModuleUnavailableError() {
    const error = new Error(
        "O vínculo com a empresa está ativo, mas a empresa não possui um módulo Aurora disponível no momento."
    );
    error.code = "AURORA_COMPANY_MODULE_INACTIVE";
    return error;
}

function isCompanyOperationalUser() {
    var access = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
        ? global.AuroraCompanyAccess.get()
        : (global.AURORA_COMPANY_ACCESS || null);
    if (!access || access.loaded !== true || !access.company_id) return false;
    if (String(access.status || "").toLowerCase() !== "active") return false;
    var role = String(access.role || "").trim().toUpperCase();
    return role === "COMPANY_USER" || role === "USER_BOLT";
}

function canEnterEletricaTupyOperationalFlow() {
    var access = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
        ? global.AuroraCompanyAccess.get()
        : (global.AURORA_COMPANY_ACCESS || null);
    if (!access || access.loaded !== true || !access.company_id) return false;
    if (String(access.status || "").toLowerCase() !== "active") return false;
    var ent = access.entitlements || {};
    return ent.eletrica_tupy === true ||
        (Array.isArray(ent.modules) && ent.modules.indexOf("eletrica_tupy") !== -1);
}

function canExplicitlyOpenEletricaTupyOffline() {
    /* V155 — autorização offline SOMENTE para ação explícita de abrir/editar
     * um trabalho Tupy. Não participa do bootstrap nem da seleção automática
     * de módulo, evitando a regressão de tela azul observada na V154. */
    var offline = global.AURORA_OFFLINE_STARTUP_CTX;
    if (!offline || offline.ok !== true ||
        offline.mode !== "cold_start_offline_ticket_valid" ||
        !offline.verification || offline.verification.valid !== true) {
        return false;
    }
    return (Array.isArray(offline.modules) ? offline.modules : []).some(function (row) {
        return row && String(row.module_code || "").trim() === "eletrica_tupy" && row.can_access === true;
    });
}

function denyEletricaTupyOperationalAccess() {
    showStatus("Esta conta não possui acesso empresarial às Atividades Rotineiras Tupy.", 3600);
}

function pickPreferredAccessibleModule(modules) {
    if (
        global.AuroraModuleAccess &&
        typeof global.AuroraModuleAccess.pickPreferredAccessibleModule === "function"
    ) {
        return global.AuroraModuleAccess.pickPreferredAccessibleModule(modules);
    }
    return (modules || []).find((item) => item.can_access === true) || null;
}

async function applySelectedModuleToIdentity(identity, selectedModule) {
    const profileCode = String(
        selectedModule.operational_profile || selectedModule.module_code || ""
    ).trim();
    const licenseCode = String(
        selectedModule.license_module_code || selectedModule.module_code || profileCode
    ).trim();

    let moduleSelectedServices = Array.isArray(selectedModule.operational_services) &&
        selectedModule.operational_services.length
        ? selectedModule.operational_services.map((item) => String(item))
        : selectedServicesForModule(identity, profileCode);

    if (licenseCode === "workshop") {
        moduleSelectedServices = moduleSelectedServices.filter((id) => String(id) !== "vehicle_inspection");
    }

    /* V140 — a configuração empresarial é a fonte de verdade dos serviços.
     * Remove serviços locais incompatíveis com o módulo atual (ex.: eletrica_tupy
     * herdado dentro de electrical) e consulta a seleção corporativa SEM depender
     * da hidratação prévia de AuroraCompanyAccess. Para conta não empresarial a RPC
     * retorna {}, preservando o fluxo pessoal legado. */
    const validCompanyServiceIds = new Set(
        servicesForProfile(profileCode).map((service) => String(service && service.id || ""))
    );
    moduleSelectedServices = moduleSelectedServices
        .map((item) => String(item || "").trim())
        .filter((item) => validCompanyServiceIds.has(item));

    const selectedModuleUsesCompanyServices = Boolean(
        String(selectedModule.source || "").trim() === "company" ||
        String(selectedModule.access_source || "").trim() === "company" ||
        String(selectedModule.access_status || "").trim() === "company_authorized"
    );
    if (selectedModuleUsesCompanyServices &&
        global.AuroraCloudSync && typeof global.AuroraCloudSync.getCompanyServices === "function" &&
        !(typeof navigator !== "undefined" && navigator.onLine === false)) {
        try {
            const companyServicesByModule = await global.AuroraCloudSync.getCompanyServices();
            const configured = Array.isArray(companyServicesByModule && companyServicesByModule[licenseCode])
                ? companyServicesByModule[licenseCode]
                : (Array.isArray(companyServicesByModule && companyServicesByModule[profileCode])
                    ? companyServicesByModule[profileCode]
                    : []);
            const accepted = configured
                .map((item) => String(item || "").trim())
                .filter((item) => validCompanyServiceIds.has(item));
            if (accepted.length) {
                moduleSelectedServices = accepted;
            }
            try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("11 APPLY COMPANY SERVICES V14", { module: licenseCode, profile: profileCode, configured: configured, accepted: accepted, applied: moduleSelectedServices }); } catch (_) {}
        } catch (error) {
            console.warn("Aurora: serviços empresariais indisponíveis antes da aplicação do módulo.", error);
        }
    }

    /* V151 — cold start empresarial offline: a ausência de RPC não significa
     * "serviços ainda não configurados". Reutiliza o último snapshot corporativo
     * confirmado online antes de abrir novamente o onboarding. */
    if (selectedModuleUsesCompanyServices && !moduleSelectedServices.length &&
        typeof navigator !== "undefined" && navigator.onLine === false &&
        global.AuroraCloudSync && typeof global.AuroraCloudSync.getCompanyServicesCached === "function") {
        const cachedCompanyServices = global.AuroraCloudSync.getCompanyServicesCached();
        const cached = Array.isArray(cachedCompanyServices[licenseCode])
            ? cachedCompanyServices[licenseCode]
            : (Array.isArray(cachedCompanyServices[profileCode]) ? cachedCompanyServices[profileCode] : []);
        moduleSelectedServices = cached
            .map((item) => String(item || "").trim())
            .filter((item) => validCompanyServiceIds.has(item));
    }

    if (!moduleSelectedServices.length) {
        const selection = normalizeServiceSelectionResult(
            await chooseServicesForModule(profileCode, { required: true })
        );
        moduleSelectedServices = selection.services;
        if (!moduleSelectedServices || !moduleSelectedServices.length) {
            throw new Error("Selecione ao menos um serviço para continuar.");
        }
    }

    const profileServices = servicesForProfile(profileCode);
    const preferredService = String(moduleSelectedServices[0] || "");
    const preferredMeta = profileServices.find(
        (service) => String(service.id) === preferredService
    ) || {};

    const moduleSelections = {
        ...(identity.selected_services_by_module || {}),
        [profileCode]: moduleSelectedServices,
        ...(licenseCode && licenseCode !== profileCode ? { [licenseCode]: moduleSelectedServices } : {})
    };

    if (global.AuroraModuleAccess && typeof global.AuroraModuleAccess.activate === "function") {
        global.AuroraModuleAccess.activate(licenseCode);
    }

    return {
        ...identity,
        profile: profileCode,
        preferred_service: preferredService,
        preferred_service_title: preferredMeta.title || "",
        active_module_title: selectedModule.title,
        active_module_access_status: selectedModule.access_status,
        active_module_ends_at: selectedModule.ends_at || "",
        active_license_module_code: licenseCode,
        selected_services: moduleSelectedServices,
        selected_services_by_module: moduleSelections
    };
}

function syncUserProfileFromIdentity(identity) {
    if (
        !identity ||
        !global.AuroraUserProfile ||
        typeof global.AuroraUserProfile.setFullName !== "function"
    ) {
        return;
    }

    const existing = String(
        global.AuroraUserProfile.getUserFullName() || ""
    ).trim();

    if (existing) {
        return;
    }

    const legacyName = String(identity.professional || "").trim();
    if (legacyName) {
        global.AuroraUserProfile.setFullName(legacyName);
    }
}

function escapeHTML(value) {
    return String(
        value ?? ""
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showStatus(
    message,
    duration = 1800
) {
    if (!status) {
        return;
    }

    status.textContent =
        message;

    status.classList.add(
        "is-visible"
    );

    clearTimeout(
        showStatus.timer
    );

    showStatus.timer =
        setTimeout(
            () => {
                status.classList.remove(
                    "is-visible"
                );
            },
            duration
        );
}

function createCaseId() {
    const now =
        new Date();

    const date =
        [
            now.getFullYear(),
            String(
                now.getMonth() + 1
            ).padStart(2, "0"),
            String(
                now.getDate()
            ).padStart(2, "0")
        ].join("");

    const time =
        [
            String(
                now.getHours()
            ).padStart(2, "0"),
            String(
                now.getMinutes()
            ).padStart(2, "0"),
            String(
                now.getSeconds()
            ).padStart(2, "0")
        ].join("");

    const suffix =
        Math.random()
            .toString(36)
            .slice(2, 6)
            .toUpperCase();

    return [
        "ATD",
        date,
        time,
        suffix
    ].join("-");
}

function getInitialCase() {
    const saved =
        repository.load();

    if (
        saved &&
        saved.case
    ) {
        showStatus(
            "Atendimento retomado."
        );

        return saved.case;
    }

    const newCase =
        clone(
            config.default_case
        );

    /*
     * Cada nova inspeção recebe uma identificação exclusiva.
     * Isso impede que fotos de trabalhos anteriores sejam lidas
     * como se pertencessem ao atendimento atual.
     */
    newCase.id =
        createCaseId();

    newCase.status =
        "Em andamento";

    newCase.evidence_groups =
        [];

    newCase.evidences =
        [];

    newCase.occurrence =
        {};

    newCase.diagnostic =
        {};

    newCase.approval =
        {};

    return newCase;
}

function createBlankCaseForService(
    serviceId,
    serviceTitle,
    profileId,
    professionalName,
    serviceMeta
) {
    const nextCase =
        clone(
            config.default_case
        );

    /*
     * Um serviço novo nunca deve herdar textos, ocorrências, fotos ou
     * diagnósticos do atendimento anterior. O novo identificador também
     * separa definitivamente as evidências no armazenamento.
     */
    nextCase.id =
        createCaseId();

    nextCase.profile_id =
        profileId;

    nextCase.module_id =
        profileId;

    nextCase.status =
        "Em andamento";

    nextCase.created_at =
        new Date().toISOString();

    nextCase.updated_at =
        nextCase.created_at;

    serviceMeta = serviceMeta || {};

    nextCase.service = {
        id: serviceId,
        title: serviceTitle,
        profile: profileId,
        operation_type: serviceMeta.operationType || "inspection",
        flow_template: serviceMeta.flowTemplate || "technical",
        record_section_title: serviceMeta.recordSectionTitle || "Registros técnicos",
        custom_fields: Array.isArray(serviceMeta.customFields) ? serviceMeta.customFields : [],
        description: serviceMeta.description || "",
        custom: Boolean(serviceMeta.custom)
    };

    nextCase.operation_type = nextCase.service.operation_type;
    nextCase.flow_template = nextCase.service.flow_template;
    nextCase.record_section_title = nextCase.service.record_section_title;
    nextCase.custom_fields = nextCase.service.custom_fields;
    nextCase.custom_values = {};

    const loggedInUserId =
        resolveLoggedInUserId() || null;
    const loggedInUserName =
        resolveLoggedInUserFullName();
    const isVehicleInspection =
        String(serviceId || "").toLowerCase() === "vehicle_inspection";

    nextCase.user_id = loggedInUserId;

    nextCase.customer = {
        name: "",
        phone: "",
        email: "",
        person_type: "Pessoa Física",
        address: ""
    };

    if (String(serviceId || "").toLowerCase() === "sofa_cleaning") {
        nextCase.asset = {
            location: "",
            sofa_type: "",
            seats: "",
            material: "",
            color: "",
            mechanism_condition: "",
            loose_cushions: "",
            stain_profile: "",
            odor_level: "",
            contracted_services: "",
            notes: "",
            entry_date: new Date().toISOString().slice(0, 10),
            identification: ""
        };

        nextCase.intake = {
            reason: "",
            initial_condition: "",
            customer_request: "",
            responsible: "",
            entry_date: "",
            priority: "Normal",
            confirmed: false
        };
    } else {
        nextCase.asset = {
            identification: "",
            plate: "",
            year_model: "",
            color: "",
            mileage: "",
            notes: ""
        };

        nextCase.intake = {
            reason: "",
            initial_condition: "",
            customer_request: "",
            responsible: isVehicleInspection
                ? loggedInUserName
                : (professionalName || ""),
            entry_date: "",
            priority: "Normal",
            confirmed: false
        };

        if (isVehicleInspection) {
            nextCase.performed_by_user_id = loggedInUserId;
            nextCase.performed_by_name = loggedInUserName;
        }
    }

    if (String(serviceId || "").toLowerCase() === "eletrica_tupy") {
        /*
         * company_id só do claim autenticado (AuroraCompanyAccess).
         * Nunca aceitar company_id digitado/escolhido na UI.
         */
        const claimedCompanyId = global.AuroraCompanyAccess
            && typeof global.AuroraCompanyAccess.resolvedCompanyId === "function"
            ? global.AuroraCompanyAccess.resolvedCompanyId()
            : null;
        if (claimedCompanyId) {
            nextCase.company_id = claimedCompanyId;
        }

        nextCase.eletrica_tupy = {
            servico: {
                empresa: "Bolt Soluções Elétricas",
                cliente: "Tupy S.A.",
                responsavel: "",
                solicitante: "",
                setor: "",
                local: "",
                ponto_referencia: "",
                titulo: "",
                descricao: "",
                data_inicio: "",
                budget_number: null
            },
            atividades: {
                iluminacao: false,
                ventiladores: false,
                escritorio: false,
                outros: false
            },
            detalhes: {
                iluminacao: { description_id: "", descricao: "", quantidade: "", data: "", day_type: "", tipo_dia: "" },
                ventiladores: { description_id: "", descricao: "", quantidade: "", data: "", day_type: "", tipo_dia: "" },
                escritorio: { description_id: "", descricao: "", quantidade: "", data: "", day_type: "", tipo_dia: "" },
                outros: { description_id: "", nome_trabalho: "", descricao: "", quantidade: "", data: "", day_type: "", tipo_dia: "" }
            },
            materiais: {},
            conclusao: {
                status: "",
                descricao: "",
                pendencias: "",
                observacoes: "",
                data: "",
                responsavel: loggedInUserName || "",
                status_auto_from_photo: false
            },
            workflow_state: "IN_PROGRESS",
            audit: {
                created_by: loggedInUserId || null,
                created_at: new Date().toISOString(),
                updated_by: null,
                updated_at: null,
                reviewed_by: null,
                reviewed_at: null,
                finalized_by: null,
                finalized_at: null
            }
        };
    }

    nextCase.occurrence = {};
    nextCase.occurrences = [];
    nextCase.evidence_groups = [];
    nextCase.evidences = [];

    nextCase.diagnostic = {
        summary: "",
        conclusion: "",
        scope: "",
        limitations: "",
        requires_approval: false
    };

    nextCase.approval = {
        status: "Pendente",
        approved_by: "",
        approval_date: "",
        notes: "",
        signature_confirmed: false
    };

    return nextCase;
}


function applyServiceFlowTemplate(runtime, service) {
    if (!runtime || !Array.isArray(runtime.steps)) return;

    if (!runtime.__auroraBaseSteps) {
        runtime.__auroraBaseSteps = clone(runtime.steps);
    }

    const baseSteps = clone(runtime.__auroraBaseSteps);

    if (!service || !service.custom) {
        runtime.steps = baseSteps;
        runtime.currentIndex = 0;
        return;
    }

    const templates = {
        quick: ["customer", "asset", "evidence", "approval"],
        technical: ["customer", "asset", "intake", "evidence", "diagnostic"],
        checklist: ["customer", "asset", "evidence", "approval"],
        budget: ["customer", "asset", "evidence", "diagnostic"]
    };

    const templateId = service.flow_template || "quick";
    const allowed = templates[templateId] || templates.quick;
    const labels = {
        customer: "Cliente",
        asset: "Dados do serviço",
        intake: "Condições iniciais",
        evidence: templateId === "budget" ? "Levantamento e fotos" : "Registros e fotos",
        diagnostic: templateId === "budget" ? "Resumo do orçamento e conclusão" : "Diagnóstico e conclusão",
        approval: "Finalização"
    };

    runtime.steps = baseSteps
        .filter((step) => allowed.includes(step.id))
        .map((step) => ({ ...step, label: labels[step.id] || step.label }));
    runtime.currentIndex = 0;
}

function getIdentity() {
    const fallback = {
        company:
            config.app.company_name ||
            "",
        professional:
            config.app.user_name ||
            "",
        profile:
            config.app.profile ||
            "",
        phone: "",
        whatsapp: "",
        email: "",
        document: "",
        registration: "",
        address: "",
        city: "",
        state: "",
        zip_code: "",
        website: "",
        description: "",
        specialties: "",
        tagline: "",
        logo: "",
        logo_transparency: 70,
        logo_report_scale: 200,
        cover_photo_report_scale: 150
    };

    try {
        const raw =
            localStorage.getItem(
                COMPANY_STORAGE_KEY
            );

        if (!raw) {
            return fallback;
        }

        return {
            ...fallback,
            ...JSON.parse(raw)
        };
    } catch (error) {
        return fallback;
    }
}

function saveIdentity(identity) {
    try {
        const serialized =
            JSON.stringify(identity);

        localStorage.setItem(
            COMPANY_STORAGE_KEY,
            serialized
        );

        if (
            localStorage.getItem(
                COMPANY_STORAGE_KEY
            ) !== serialized
        ) {
            return false;
        }

        return true;
    } catch (error) {
        console.warn(
            "Não foi possível salvar a identidade.",
            error
        );
        return false;
    }
}

function hasPendingModuleServiceSelection(userId, moduleCode) {
    const key = `aurora_module_service_selection_pending_v1:${String(userId || "").trim()}:${String(moduleCode || "").trim()}`;
    try {
        return Boolean(localStorage.getItem(key));
    } catch (_) {
        return false;
    }
}

function readCompanyLogoFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () =>
            reject(reader.error || new Error("Falha ao ler a logo."));
        reader.readAsDataURL(file);
    });
}

function loadCompanyLogoImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
            reject(new Error("Não foi possível abrir a imagem da logo."));
        image.src = source;
    });
}

function renderCompanyLogoDataURL(image, maxDimension, type, quality) {
    const scale = Math.min(
        1,
        maxDimension / Math.max(image.naturalWidth, image.naturalHeight, 1)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");

    if (type === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(type, quality);
}

async function compressCompanyLogoFile(file) {
    const source = await readCompanyLogoFileAsDataURL(file);
    const image = await loadCompanyLogoImage(source);
    const prefersPng =
        /image\/png/i.test(file.type || "") ||
        /^data:image\/png/i.test(source);
    let maxDimension = 512;
    let quality = 0.84;
    let type = prefersPng ? "image/png" : "image/jpeg";
    let dataUrl = renderCompanyLogoDataURL(
        image,
        maxDimension,
        type,
        quality
    );
    const maxChars = 180000;
    let guard = 0;

    while (dataUrl.length > maxChars && guard < 6) {
        maxDimension = Math.max(160, Math.round(maxDimension * 0.72));
        quality = Math.max(0.55, quality - 0.1);
        type = "image/jpeg";
        dataUrl = renderCompanyLogoDataURL(
            image,
            maxDimension,
            type,
            quality
        );
        guard += 1;
    }

    return dataUrl;
}

function shrinkCompanyLogoDataURL(dataUrl, maxChars) {
    if (!dataUrl || dataUrl.length <= maxChars) {
        return dataUrl;
    }

    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            let maxDimension = 320;
            let quality = 0.72;
            let next = renderCompanyLogoDataURL(
                image,
                maxDimension,
                "image/jpeg",
                quality
            );
            let guard = 0;

            while (next.length > maxChars && guard < 5) {
                maxDimension = Math.max(120, Math.round(maxDimension * 0.7));
                quality = Math.max(0.5, quality - 0.1);
                next = renderCompanyLogoDataURL(
                    image,
                    maxDimension,
                    "image/jpeg",
                    quality
                );
                guard += 1;
            }

            resolve(next);
        };
        image.onerror = () => resolve(dataUrl);
        image.src = dataUrl;
    });
}

function getReports() {
    try {
        const raw =
            localStorage.getItem(
                REPORTS_STORAGE_KEY
            );

        return raw
            ? JSON.parse(raw)
            : [];
    } catch (error) {
        return [];
    }
}

function saveReports(reports) {
    try {
        localStorage.setItem(
            REPORTS_STORAGE_KEY,
            JSON.stringify(reports)
        );
    } catch (error) {
        console.warn(
            "Não foi possível salvar os relatórios.",
            error
        );
    }
}

/* R26 — RASCUNHO UNIVERSAL
 * O atendimento em andamento passa a usar a MESMA coleção canônica que já
 * alimenta Atendimentos recentes. Não existe segundo storage de rascunhos.
 * ReportEngine compacta o snapshot e mantém fotos completas no EvidenceStore.
 */
function isCompletedCase(caseData) {
    const status = String(caseData && caseData.status || "").trim().toLowerCase();
    return ["concluído", "concluido", "completed"].includes(status);
}

function hasMeaningfulDraftData(caseData) {
    if (!caseData || !caseData.id || !caseData.service || !caseData.service.id) return false;
    const customer = caseData.customer || {};
    const asset = caseData.asset || {};
    const intake = caseData.intake || {};
    const occurrence = caseData.occurrence || {};
    const dynamic = caseData.dynamic_fields || caseData.custom_values || {};
    const groups = Array.isArray(caseData.evidence_groups) ? caseData.evidence_groups : [];
    const occurrences = Array.isArray(caseData.occurrences) ? caseData.occurrences : [];
    const text = [customer.name, customer.company_name, customer.company, customer.phone, customer.email,
        asset.name, asset.identification, asset.tag, asset.code, asset.plate].some((value) => String(value || "").trim());
    return Boolean(text || Object.keys(intake).length || Object.keys(occurrence).length ||
        Object.keys(dynamic).length || groups.length || occurrences.length);
}

function persistUniversalDraft(caseData) {
    if (!caseData || caseData.admin_review === true || isCompletedCase(caseData) || !hasMeaningfulDraftData(caseData)) return null;
    const feature = global.AuroraReportFeature;
    const engine = feature && feature.engine;
    if (!engine || typeof engine.createFromCase !== "function") return null;
    const existing = getReports().find((item) => String(item && item.id || "") === String(caseData.id));
    const createdAt = existing && existing.created_at ? existing.created_at : (caseData.created_at || new Date().toISOString());
    const options = { status: "Rascunho", id: caseData.id, createdAt };
    if (existing && existing.public_id) options.publicId = existing.public_id;
    const report = engine.createFromCase(caseData, options);
    return report;
}


function getCustomServices(profile) {
    try {
        const raw =
            localStorage.getItem(
                CUSTOM_SERVICES_STORAGE_KEY
            );

        const all =
            raw
                ? JSON.parse(raw)
                : {};

        return Array.isArray(
            all[profile]
        )
            ? all[profile]
            : [];
    } catch (error) {
        return [];
    }
}

function saveCustomService(
    profile,
    service
) {
    const raw =
        localStorage.getItem(
            CUSTOM_SERVICES_STORAGE_KEY
        );

    let all = {};

    try {
        all = raw
            ? JSON.parse(raw)
            : {};
    } catch (error) {
        all = {};
    }

    const current =
        Array.isArray(
            all[profile]
        )
            ? all[profile]
            : [];

    all[profile] = [
        ...current,
        service
    ];

    localStorage.setItem(
        CUSTOM_SERVICES_STORAGE_KEY,
        JSON.stringify(all)
    );
}

function createServiceId(title) {
    const slug =
        String(title || "servico")
            .normalize("NFD")
            .replace(/[\\u0300-\\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

    return [
        "custom",
        slug || "servico",
        Date.now().toString(36)
    ].join("-");
}

function profilePresentation(profile) {
    const presentations = {
        workshop: {
            label:
                "Oficina mecânica",
            module:
                "Oficina",
            subtitle:
                "Oficina mecânica · Atendimento"
        },

        vehicle_inspection: {
            label:
                "Vistoria veicular",
            module:
                "Vistoria veicular",
            subtitle:
                "Vistoria veicular · Atendimento"
        },

        electrical: {
            label:
                "Serviços elétricos",
            module:
                "Elétrica",
            subtitle:
                "Serviços elétricos · Atendimento"
        },

        grounding_equipotentialization: {
            label:
                "Aterramento e Equipotencialização",
            module:
                "Aterramento e Equipotencialização",
            subtitle:
                "Aterramento e Equipotencialização · Atendimento"
        },

        industrial: {
            label:
                "Inspeção industrial",
            module:
                "Industrial",
            subtitle:
                "Inspeção industrial · Atendimento"
        },

        car_wash: {
            label:
                "Lavação automotiva",
            module:
                "Lavação automotiva",
            subtitle:
                "Lavação automotiva · Atendimento"
        },

        upholstery_cleaning: {
            label:
                "Sofás e estofados",
            module:
                "Estofados",
            subtitle:
                "Sofás e estofados · Atendimento"
        },

        curtains_blinds: {
            label:
                "Cortinas e persianas",
            module:
                "Cortinas e persianas",
            subtitle:
                "Cortinas e persianas · Atendimento"
        },

        repairs_maintenance: {
            label:
                "Reparos e manutenção",
            module:
                "Reparos e manutenção",
            subtitle:
                "Reparos e manutenção · Atendimento"
        },

        condominiums: {
            label:
                "Condomínios",
            module:
                "Condomínios",
            subtitle:
                "Gestão e inspeção predial · Atendimento"
        },

        drone: {
            label:
                "Inspeção aérea",
            module:
                "Drone",
            subtitle:
                "Inspeção aérea · Atendimento"
        }
    };

    return (
        presentations[profile] ||
        presentations.workshop
    );
}

function servicesForProfile(profile) {
    const catalog = {
        workshop: [
            {
                id: "vehicle_inspection",
                icon: "🚘",
                title: "Vistoria veicular",
                description:
                    "Recebimento, checklist, avarias, acessórios e fotos."
            },
            {
                id: "suspension",
                icon: "🛞",
                title: "Suspensão",
                description:
                    "Amortecedores, molas, buchas, pivôs e bieletas."
            },
            {
                id: "engine",
                icon: "⚙️",
                title: "Motor",
                description:
                    "Ruídos, vazamentos, desempenho e componentes."
            },
            {
                id: "brakes",
                icon: "🛑",
                title: "Freios",
                description:
                    "Discos, pastilhas, fluido, ABS e segurança."
            },
            {
                id: "steering",
                icon: "↔",
                title: "Direção",
                description:
                    "Folgas, terminais, caixa e alinhamento."
            },
            {
                id: "vehicle_electrical",
                icon: "🔌",
                title: "Elétrica automotiva",
                description:
                    "Bateria, alternador, iluminação e módulos."
            },
            {
                id: "air_conditioning",
                icon: "❄️",
                title: "Ar-condicionado",
                description:
                    "Temperatura, pressão, carga e vazamentos."
            }
        ],

        electrical: [
            {
                id: "panel",
                icon: "▦",
                title: "Painel elétrico",
                description:
                    "Componentes, proteção, manobra e conexões."
            },
            {
                id: "electric_motor",
                icon: "⚡",
                title: "Motor elétrico",
                description:
                    "Corrente, temperatura, vibração e isolamento."
            },
            {
                id: "thermography",
                icon: "🌡",
                title: "Termografia",
                description:
                    "Pontos quentes, Delta T e anomalias térmicas."
            },
            {
                id: "installation",
                icon: "🔌",
                title: "Instalação elétrica",
                description:
                    "Circuitos, cabos, tomadas, DR e DPS."
            },
            {
                id: "lighting",
                icon: "💡",
                title: "Iluminação",
                description:
                    "Níveis, emergência, comandos e eficiência."
            }
        ],

        grounding_equipotentialization: [
            {
                id: "grounding_equipotentialization",
                icon: "⏚",
                title: "Aterramento e Equipotencialização",
                description:
                    "Inspeções, aferições e documentação técnica de sistemas de aterramento e equipotencialização."
            }
        ],

        industrial: [
            {
                id: "machine",
                icon: "⚙️",
                title: "Máquina",
                description:
                    "Condição, segurança, vibração e funcionamento."
            },
            {
                id: "pipeline",
                icon: "〰",
                title: "Tubulação",
                description:
                    "Corrosão, vazamentos, suportes e isolamento."
            },
            {
                id: "structure",
                icon: "🏗",
                title: "Estrutura",
                description:
                    "Soldas, corrosão, deformações e integridade."
            },
            {
                id: "tank",
                icon: "◉",
                title: "Tanque",
                description:
                    "Revestimento, bocais, corrosão e segurança."
            }
        ],

        car_wash: [
            { id: "basic_wash", icon: "🚿", title: "Lavação simples", description: "Lavagem externa, rodas, vidros e acabamento." },
            { id: "complete_wash", icon: "✨", title: "Lavação completa", description: "Exterior, interior, aspiração e finalização." },
            { id: "technical_wash", icon: "🧽", title: "Lavação técnica", description: "Descontaminação e limpeza detalhada segura." },
            { id: "interior_detailing", icon: "🪑", title: "Higienização interna", description: "Bancos, carpetes, teto, painel e odores." },
            { id: "polishing", icon: "💎", title: "Polimento", description: "Correção de brilho, riscos leves e hologramas." },
            { id: "paint_protection", icon: "🛡️", title: "Proteção da pintura", description: "Cera, selante, cristalização ou vitrificação." }
        ],

        upholstery_cleaning: [
            { id: "sofa_cleaning", icon: "🛋️", title: "Sofá", description: "Higienização, manchas, odores e secagem." },
            { id: "mattress_cleaning", icon: "🛏️", title: "Colchão", description: "Limpeza profunda, ácaros, odores e manchas." },
            { id: "armchair_cleaning", icon: "💺", title: "Poltrona", description: "Limpeza técnica e preservação do tecido." },
            { id: "chair_cleaning", icon: "🪑", title: "Cadeiras", description: "Assentos residenciais, comerciais e corporativos." },
            { id: "auto_upholstery", icon: "🚗", title: "Banco automotivo", description: "Bancos, carpetes, teto e acabamento interno." },
            { id: "carpet_cleaning", icon: "🧶", title: "Tapete e carpete", description: "Sujeira, manchas, odores e revitalização." }
        ],

        curtains_blinds: [
            { id: "curtain_installation", icon: "🪟", title: "Instalação de cortina", description: "Medição, fixação, nivelamento e acabamento." },
            { id: "blind_installation", icon: "▤", title: "Instalação de persiana", description: "Persianas rolô, vertical, horizontal e romana." },
            { id: "curtain_maintenance", icon: "🧰", title: "Manutenção de cortina", description: "Trilhos, rodízios, tecidos e regulagens." },
            { id: "blind_maintenance", icon: "🔧", title: "Manutenção de persiana", description: "Cordões, correntes, lâminas e suportes." },
            { id: "motorized_system", icon: "⚡", title: "Sistema motorizado", description: "Motores, controles, limites e automação." },
            { id: "track_and_rod", icon: "↔️", title: "Trilho e varão", description: "Instalação, troca, reforço e nivelamento." }
        ],

        repairs_maintenance: [
            { id: "small_repairs", icon: "🔧", title: "Pequenos reparos", description: "Correções rápidas, ajustes, fixações e acabamentos." },
            { id: "masonry", icon: "🧱", title: "Alvenaria", description: "Paredes, reboco, trincas, vãos e reparos estruturais leves." },
            { id: "painting", icon: "🎨", title: "Pintura", description: "Preparação, correções, pintura interna e externa." },
            { id: "flooring", icon: "◫", title: "Pisos e revestimentos", description: "Assentamento, troca, rejunte e acabamento." },
            { id: "minor_renovation", icon: "🏠", title: "Pequena reforma", description: "Reforma de ambientes com várias etapas de execução." },
            { id: "general_maintenance", icon: "🛠️", title: "Manutenção geral", description: "Manutenção residencial ou comercial sob demanda." }
        ],

        condominiums: [
            { id: "common_areas", icon: "🏢", title: "Áreas comuns", description: "Corredores, halls, escadas, sinalização e conservação." },
            { id: "electrical_system", icon: "⚡", title: "Sistema elétrico", description: "Quadros, iluminação, circuitos e condições elétricas." },
            { id: "hydraulic_system", icon: "💧", title: "Sistema hidráulico", description: "Tubulações, registros, vazamentos e reservatórios." },
            { id: "pump_room", icon: "⚙️", title: "Bombas e casa de máquinas", description: "Bombas, motores, comandos, ruídos e vazamentos." },
            { id: "elevators", icon: "↕️", title: "Elevadores", description: "Condição aparente, portas, sinalização e ocorrências." },
            { id: "fire_safety", icon: "🧯", title: "Sistema de incêndio", description: "Extintores, hidrantes, portas corta-fogo e emergência." },
            { id: "facade_roof", icon: "🏠", title: "Fachada e cobertura", description: "Fachadas, telhados, calhas, infiltrações e estruturas." },
            { id: "garage", icon: "🚗", title: "Garagem", description: "Iluminação, pisos, drenagem, sinalização e segurança." },
            { id: "access_gates", icon: "🚪", title: "Portões e acessos", description: "Portões, interfones, controles, fechaduras e acessibilidade." },
            { id: "leisure_area", icon: "🏊", title: "Piscina e área de lazer", description: "Piscina, playground, salão, academia e áreas de convivência." },
            { id: "maintenance_occurrences", icon: "🛠️", title: "Ocorrências e manutenção", description: "Registro, acompanhamento e evidências de manutenção predial." },
        ],

        drone: [
            {
                id: "roof",
                icon: "⌂",
                title: "Telhado",
                description:
                    "Telhas, calhas, infiltrações e estruturas."
            },
            {
                id: "facade",
                icon: "▥",
                title: "Fachada",
                description:
                    "Trincas, juntas, revestimentos e desprendimentos."
            },
            {
                id: "tower",
                icon: "🗼",
                title: "Torre",
                description:
                    "Estrutura, antenas, corrosão e fixações."
            },
            {
                id: "solar",
                icon: "☀",
                title: "Usina solar",
                description:
                    "Módulos, sujeira, estruturas e anomalias."
            }
        ]
    };
    return catalog[profile] || catalog.workshop;
}

function selectedServicesForModule(identity, moduleCode) {
    const validIds = new Set(servicesForProfile(moduleCode)
        .filter((service) => String(service && service.id || "") !== "eletrica_tupy" || canEnterEletricaTupyOperationalFlow())
        .map((service) => String(service.id)));
    const validOnly = (items) => items.map((item) => String(item)).filter((item) => validIds.has(item));
    const map = identity && identity.selected_services_by_module;
    if (map && typeof map === "object" && !Array.isArray(map) && Array.isArray(map[moduleCode])) {
        return validOnly(map[moduleCode]);
    }
    if (identity && identity.profile === moduleCode && Array.isArray(identity.selected_services)) {
        return validOnly(identity.selected_services);
    }
    return [];
}

/* R44 — autoridade universal dos serviços da Home.
 * Um módulo já resolvido pode compartilhar o profile operacional com outros
 * produtos. Nesse caso operational_services é mais específico que o catálogo
 * genérico do profile. Defaults só entram quando não há serviços operacionais
 * explícitos nem seleção válida persistida. */
function resolveHomeServicesAuthority(identity, selectedModule) {
    const profileCode = String(identity && identity.profile || "").trim();
    const activeLicenseCode = String(identity && identity.active_license_module_code || selectedModule && (selectedModule.license_module_code || selectedModule.module_code) || "").trim();
    const profileDefaults = servicesForProfile(profileCode);

    /* R48 — separação definitiva de conceitos: eletrica_tupy é o ID legado do
     * ambiente empresarial privado ATIVIDADES ROTINEIRAS TUPY. Não é um serviço
     * do catálogo Elétrica e nunca deve ser convertido em card genérico da Home. */
    if (activeLicenseCode === "eletrica_tupy") {
        return {
            moduleCode: activeLicenseCode,
            profileCode,
            operationalServices: [],
            selectedServices: [],
            profileDefaultServices: profileDefaults.map((service) => String(service && service.id || "")),
            chosenIds: [],
            chosenAuthority: "private_company_environment",
            catalog: profileDefaults,
            services: []
        };
    }
    const operationalServices = Array.from(new Set(
        (Array.isArray(selectedModule && selectedModule.operational_services)
            ? selectedModule.operational_services : [])
            .map((item) => String(item || "").trim()).filter(Boolean)
    ));
    const selectedServices = selectedServicesForModule(identity, profileCode);
    const chosenIds = operationalServices.length ? operationalServices : selectedServices;
    const chosenAuthority = operationalServices.length
        ? "explicit_operational_services"
        : (selectedServices.length ? "selected_services" : "profile_defaults");
    const byId = new Map(profileDefaults.map((service) => [String(service && service.id || ""), service]));

    if (operationalServices.length) {
        const moduleCode = String(selectedModule && (selectedModule.license_module_code || selectedModule.module_code) || "").trim();
        const moduleTitle = String(selectedModule && selectedModule.title || moduleCode || "Serviço").trim();
        operationalServices.forEach((serviceId) => {
            if (byId.has(serviceId)) return;
            byId.set(serviceId, {
                id: serviceId,
                icon: String(selectedModule && selectedModule.icon || "▣"),
                title: operationalServices.length === 1 ? moduleTitle : serviceId.replace(/[_-]+/g, " "),
                description: String(selectedModule && selectedModule.description || `Abrir ${moduleTitle}.`),
                operation_type: String(selectedModule && selectedModule.operation_type || "inspection"),
                flow_template: String(selectedModule && selectedModule.flow_template || "technical"),
                record_section_title: String(selectedModule && selectedModule.record_section_title || "Registros técnicos")
            });
        });
    }

    const catalog = Array.from(byId.values());
    const services = chosenIds.length
        ? chosenIds.map((id) => byId.get(id)).filter(Boolean)
        : profileDefaults;
    return {
        moduleCode: String(identity && identity.active_license_module_code || selectedModule && selectedModule.module_code || "").trim(),
        profileCode,
        operationalServices,
        selectedServices: Array.isArray(identity && identity.selected_services) ? identity.selected_services.map(String) : [],
        profileDefaultServices: profileDefaults.map((service) => String(service && service.id || "")),
        chosenIds: services.map((service) => String(service && service.id || "")),
        chosenAuthority,
        catalog,
        services
    };
}

function normalizeServiceSelectionResult(result) {
    if (!result) {
        return { services: null, pending: false };
    }

    if (Array.isArray(result)) {
        return { services: result, pending: false };
    }

    if (result && Array.isArray(result.services)) {
        return {
            services: result.services,
            pending: Boolean(result.pending)
        };
    }

    return { services: null, pending: false };
}

function chooseServicesForModule(moduleCode, options = {}) {
    const services = servicesForProfile(moduleCode).filter((service) => {
        const id = String(service && service.id || "");
        if (String(moduleCode) === "workshop" && id === "vehicle_inspection") return false;
        return id !== "eletrica_tupy" || canEnterEletricaTupyOperationalFlow();
    });
    return new Promise((resolve) => {
        const validIds = new Set(services.map((service) => String(service.id)));
        const selected = new Set(
            (Array.isArray(options.selectedServices) ? options.selectedServices : [])
                .map((item) => String(item))
                .filter((item) => validIds.has(item))
        );
        const root = document.createElement("section");
        root.className = "aurora-onboarding aurora-module-services";
        const presentation = profilePresentation(moduleCode);
        root.innerHTML = [
            '<div class="aurora-onboarding__shell">',
            '<header><span>✦ ', escapeHTML(presentation.module), '</span><h1>Qual serviço você oferece?</h1>',
            '<p>', options.editing
                ? 'Marque ou desmarque os serviços que você oferece. A alteração não reinicia sua demonstração nem apaga relatórios.'
                : 'Selecione todos os serviços que você oferece. Somente os itens marcados serão exibidos neste módulo.',
            '</p></header>',
            '<div class="aurora-onboarding__services">',
            services.map((service) => [
                '<button type="button" data-module-service="', escapeHTML(service.id), '" data-title="', escapeHTML(service.title), '"',
                selected.has(String(service.id)) ? ' class="is-active"' : '', '>',
                '<b>', service.icon, '</b><strong>', escapeHTML(service.title), '</strong><span>',
                selected.has(String(service.id)) ? 'Selecionado ✓' : 'Toque para selecionar', '</span></button>'
            ].join("")).join(""),
            '</div><div class="aurora-onboarding__actions">',
            options.required ? '' : '<button type="button" data-module-services-cancel>Cancelar</button>',
            '<button type="button" data-module-services-save', selected.size ? '' : ' disabled', '>',
            options.editing ? 'Salvar alterações ✓' : 'Continuar para a Aurora ✦', '</button>',
            '</div></div>'
        ].join("");
        document.body.appendChild(root);
        const save = root.querySelector("[data-module-services-save]");
        root.querySelectorAll("[data-module-service]").forEach((button) => {
            button.addEventListener("click", () => {
                const id = String(button.dataset.moduleService);
                if (selected.has(id)) {
                    selected.delete(id);
                    button.classList.remove("is-active");
                    button.querySelector("span").textContent = "Toque para selecionar";
                } else {
                    selected.add(id);
                    button.classList.add("is-active");
                    button.querySelector("span").textContent = "Selecionado ✓";
                }
                save.disabled = selected.size === 0;
            });
        });
        const cancel = root.querySelector("[data-module-services-cancel]");
        if (cancel) cancel.addEventListener("click", () => {
            root.remove();
            resolve(null);
        });
        save.addEventListener("click", async () => {
            save.disabled = true;
            save.textContent = "Salvando serviços…";
            try {
                const ids = Array.from(selected);
                if (!global.AuroraModulesApi) {
                    throw new Error("A conexão dos Módulos Aurora não está disponível.");
                }
                const api = global.AuroraModulesApi;
                const saveServices = typeof api.saveModuleServicesResilient === "function"
                    ? api.saveModuleServicesResilient.bind(api)
                    : api.saveModuleServices.bind(api);
                const result = await saveServices(moduleCode, ids);
                root.classList.add("is-leaving");
                setTimeout(() => {
                    root.remove();
                    resolve({
                        services: ids,
                        pending: Boolean(result && result.pending),
                        synced: !result || result.synced !== false
                    });
                }, 300);
            } catch (error) {
                save.disabled = false;
                save.textContent = options.editing ? "Salvar alterações ✓" : "Continuar para a Aurora ✦";
                await global.AuroraDialog.alert(error.message || error, { title: "Não foi possível salvar", tone: "danger" });
            }
        });
    });
}


function auroraServiceLabel(serviceId, fallback) {
    const i18n = global.AuroraI18n;
    if (i18n && typeof i18n.serviceLabel === "function") return i18n.serviceLabel(serviceId, fallback);
    return String(fallback || serviceId || "Atendimento");
}

function formatDate(value) {
    if (!value) {
        return "Sem data";
    }

    try {
        return new Intl.DateTimeFormat(
            "pt-BR",
            {
                dateStyle: "short",
                timeStyle: "short"
            }
        ).format(
            new Date(value)
        );
    } catch (error) {
        return value;
    }
}

function reportServiceId(report) {
    return String(
        (report && report.service_id) ||
        (report && report.service && report.service.id) ||
        (report && report.snapshot && report.snapshot.service && report.snapshot.service.id) ||
        ""
    ).toLowerCase();
}

function reportIsEletricaTupy(report) {
    return reportServiceId(report) === "eletrica_tupy";
}

function reportTupyState(report) {
    if (!report) return null;
    if (report.eletrica_tupy && typeof report.eletrica_tupy === "object") {
        return report.eletrica_tupy;
    }
    if (
        report.snapshot &&
        report.snapshot.eletrica_tupy &&
        typeof report.snapshot.eletrica_tupy === "object"
    ) {
        return report.snapshot.eletrica_tupy;
    }
    return null;
}

function reportCustomerName(report) {
    if (reportIsEletricaTupy(report)) {
        const tupy = reportTupyState(report);
        const titulo =
            (tupy && tupy.servico && tupy.servico.titulo) ||
            (report.approval && report.approval.report_title) ||
            report.report_title ||
            "";
        const setor =
            (tupy && tupy.servico && tupy.servico.setor) ||
            (report.asset && report.asset.setor) ||
            "";
        const title = [titulo, setor].filter(Boolean).join(" – ");
        if (title) return title;
    }

    const customer =
        report && report.customer;

    if (typeof customer === "string") {
        return customer;
    }

    if (customer && typeof customer === "object") {
        return customer.name ||
            customer.company_name ||
            customer.company ||
            "Cliente";
    }

    return "Cliente";
}

function reportServiceTitle(report) {
    if (reportIsEletricaTupy(report)) {
        const tupy = reportTupyState(report);
        const responsavel =
            (tupy && tupy.servico && tupy.servico.solicitante) ||
            (report.customer && report.customer.responsible) ||
            "";
        const budget =
            tupy && tupy.servico && tupy.servico.budget_number != null
                ? String(tupy.servico.budget_number)
                : "";
        const parts = [];
        if (responsavel) parts.push("Responsável Tupy: " + responsavel);
        if (budget) parts.push("Orçamento nº " + budget);
        if (parts.length) return parts.join(" · ");
        return "Elétrica Tupy";
    }

    if (report && typeof report.title === "string") {
        return report.title;
    }

    if (
        report &&
        report.service &&
        typeof report.service === "object"
    ) {
        return report.service.title ||
            "Inspeção";
    }

    return "Inspeção";
}

const recentCloudTransient = new Map();
const auroraIcons = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7"/><path d="M10 11v5m4-5v5"/></svg>',
    cloudUpload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18H6a4 4 0 0 1-.4-8A6.5 6.5 0 0 1 18 8.5 4.5 4.5 0 0 1 18.5 18H17"/><path d="M12 20V11m-3 3 3-3 3 3"/></svg>',
    cloudCheck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18H6a4 4 0 0 1-.4-8A6.5 6.5 0 0 1 18 8.5 4.5 4.5 0 0 1 18.5 18H9"/><path d="m10 15 2 2 4-4"/></svg>',
    cloudError: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18H6a4 4 0 0 1-.4-8A6.5 6.5 0 0 1 18 8.5 4.5 4.5 0 0 1 18.5 18H9"/><path d="M12 12v3m0 3h.01"/></svg>'
};

function recentCloudState(report) {
    const transient = recentCloudTransient.get(String(report.id));
    if (transient) return transient;
    const api = global.AuroraCloudSync;
    if (!api || typeof api.getSyncStatus !== "function" || !report.snapshot) return "pending";
    const cloudData = Object.assign({}, report.snapshot, {
        status: report.status || report.snapshot.status
    });
    return (api.getSyncStatus(cloudData) || {}).state || "pending";
}

function recentCloudButton(report) {
    const state = recentCloudState(report);
    const config = {
        pending: { label: "Salvar", title: "Salvar atendimento na nuvem", icon: auroraIcons.cloudUpload },
        update: { label: "Atualizar", title: "Atualizar atendimento na nuvem", icon: auroraIcons.cloudUpload },
        syncing: { label: "Enviando", title: "Sincronizando atendimento", icon: auroraIcons.cloudUpload },
        synced: { label: "Na nuvem", title: "Atendimento sincronizado", icon: auroraIcons.cloudCheck },
        error: { label: "Tentar novamente", title: "Tentar sincronizar novamente", icon: auroraIcons.cloudError }
    }[state] || null;
    const disabled = state === "synced" || state === "syncing";
    return `<button type="button" class="aurora-recent-cloud is-${state}" data-recent-cloud="${escapeHTML(report.id)}" data-cloud-state="${state}" aria-label="${config.title}" title="${config.title}" ${disabled ? "disabled" : ""}>${config.icon}<span>${config.label}</span></button>`;
}

function recentActionsMarkup(report) {
    return `<div class="aurora-recent-card__actions"><button type="button" class="aurora-recent-action" data-recent-edit="${escapeHTML(report.id)}" aria-label="Editar atendimento" title="Editar atendimento">${auroraIcons.edit}</button>${recentCloudButton(report)}<button type="button" class="aurora-recent-action is-danger" data-recent-delete="${escapeHTML(report.id)}" aria-label="Excluir atendimento" title="Excluir atendimento">${auroraIcons.trash}</button></div>`;
}

function reportDisplayId(report) {
    if (report && report.public_id) {
        return String(report.public_id);
    }

    const created = new Date(
        report && report.created_at
            ? report.created_at
            : Date.now()
    );

    const year = Number.isNaN(created.getTime())
        ? new Date().getFullYear()
        : created.getFullYear();

    const source = String(
        (report && report.id) ||
        "AURORA"
    );

    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
        hash = (hash * 31 + source.charCodeAt(index)) % 10000;
    }

    return `AUR-${year}-${String(hash || 1).padStart(4, "0")}`;
}

function createDemoReports(identity) {
    /*
     * RC7.4 — não gerar atendimentos fictícios.
     * A Home deve mostrar somente dados realmente criados pelo usuário.
     */
    return getReports();
}

function reportProfileId(report) {
    if (!report || typeof report !== "object") {
        return "";
    }

    const explicit = String(
        report.profile_id ||
        report.module_id ||
        (report.service && (report.service.profile || report.service.profile_id)) ||
        (report.snapshot && (
            report.snapshot.profile_id ||
            report.snapshot.module_id ||
            (report.snapshot.service && (
                report.snapshot.service.profile ||
                report.snapshot.service.profile_id
            ))
        )) ||
        ""
    );

    if (explicit) {
        return explicit;
    }

    /* Migração segura para relatórios antigos sem profile_id. */
    const serviceId = String(
        (report.service && report.service.id) ||
        (report.snapshot && report.snapshot.service && report.snapshot.service.id) ||
        ""
    ).toLowerCase();

    const title = String(
        reportServiceTitle(report) || ""
    ).toLowerCase();

    const catalogs = {
        car_wash: ["basic_wash", "complete_wash", "technical_wash", "interior_detailing", "polishing", "paint_protection", "lavação", "lavagem", "higienização interna", "polimento", "proteção da pintura"],
        upholstery_cleaning: ["sofa_cleaning", "mattress_cleaning", "armchair_cleaning", "chair_cleaning", "auto_upholstery", "carpet_cleaning", "sofá", "colchão", "poltrona", "cadeiras", "banco automotivo", "tapete", "carpete"],
        curtains_blinds: ["curtain_installation", "blind_installation", "curtain_maintenance", "blind_maintenance", "motorized_system", "track_and_rod", "cortina", "persiana", "trilho", "varão", "sistema motorizado"],
        repairs_maintenance: ["small_repairs", "masonry", "painting", "flooring", "minor_renovation", "general_maintenance", "pequenos reparos", "alvenaria", "pintura", "pisos", "revestimentos", "pequena reforma", "manutenção geral"],
        condominiums: ["common_areas", "electrical_system", "hydraulic_system", "pump_room", "elevators", "fire_safety", "facade_roof", "garage", "access_gates", "leisure_area", "maintenance_occurrences", "condomínio", "áreas comuns", "sistema de incêndio", "garagem", "casa de máquinas"],
        workshop: ["vehicle_inspection", "suspension", "engine", "brakes", "steering", "vehicle_electrical", "air_conditioning", "vistoria veicular", "recebimento do veículo", "suspensão", "motor", "freios", "direção", "elétrica automotiva", "ar-condicionado"],
        electrical: ["panel", "electric_motor", "thermography", "installation", "lighting",  "painel elétrico", "motor elétrico", "termografia", "instalação elétrica", "iluminação", "elétrica tupy", "tupy"],
        grounding_equipotentialization: ["grounding_equipotentialization", "aterramento e equipotencialização", "aterramento", "equipotencialização"],
        industrial: ["machine", "pipeline", "structure", "tank", "máquina", "tubulação", "estrutura", "tanque"],
        drone: ["roof", "facade", "tower", "solar_plant", "telhado", "fachada", "torre", "usina solar"]
    };

    for (const [profile, terms] of Object.entries(catalogs)) {
        if (terms.some((term) => serviceId === term || title.includes(term))) {
            return profile;
        }
    }

    return "";
}

function reportsForProfile(reports, profileId) {
    const profile = String(profileId || "");

    return (Array.isArray(reports) ? reports : []).filter((report) => {
        const reportProfile = reportProfileId(report);

        /* MOLDE SHAPE — o módulo atual é fronteira absoluta de contexto.
         * Mesmo backups restaurados permanecem visíveis apenas no módulo ao
         * qual pertencem; isso impede trabalhos de Elétrica/Oficina vazarem
         * para Condomínios, Drone e demais shapes. */

        /*
         * Registros antigos sem identificação de módulo não devem vazar
         * para todos os ambientes. Eles ficam visíveis apenas quando há
         * uma identificação compatível no serviço/snapshot.
         */
        return Boolean(reportProfile) && reportProfile === profile;
    }).sort((a, b) =>
        Date.parse((b && (b.updated_at || b.created_at)) || 0) -
        Date.parse((a && (a.updated_at || a.created_at)) || 0)
    );
}

function installQuickSuggestions(container) {
    /*
     * RC7.4 — as sugestões são instaladas pelo seletor contextual de
     * rc6_patch.js. Não criar mais a biblioteca genérica, pois ela fazia
     * frases industriais aparecerem em lavação, estofados e outros módulos.
     */
    if (!container) return;

    container.querySelectorAll("textarea").forEach((field) => {
        if (!field.placeholder) {
            field.placeholder = "Selecione uma sugestão ou escreva sua observação.";
        }
    });
}

function canManageEletricaTupyUi() {
    try {
        if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.canManageEletricaTupy === "function") {
            return global.AuroraCompanyAccess.canManageEletricaTupy() === true;
        }
        if (global.AuroraEletricaTupy && typeof global.AuroraEletricaTupy.canManageEletricaTupy === "function") {
            return global.AuroraEletricaTupy.canManageEletricaTupy() === true;
        }
        if (global.AuroraEletricaTupyDomain && typeof global.AuroraEletricaTupyDomain.canManageEletricaTupy === "function") {
            return global.AuroraEletricaTupyDomain.canManageEletricaTupy() === true;
        }
    } catch (error) { /* default deny */ }
    return false;
}

function auroraAssetCatalogForProfile(profile, services) {
    const id = String(profile || "").toLowerCase();
    const hasEligible = (Array.isArray(services) ? services : []).some((service) => {
        const sid = String(service && service.id || "").toLowerCase();
        return sid && sid !== "vehicle_inspection" && sid !== "eletrica_tupy";
    });
    if (!hasEligible || id === "vehicle_inspection") return null;
    const map = {
        workshop: { title: "Veículos", section: "Veículos", subtitle: "Identificação, serviços e histórico dos veículos" },
        electrical: { title: "Painéis e equipamentos", section: "Equipamentos", subtitle: "Histórico e identificação dos equipamentos" },
        eletrica: { title: "Painéis e equipamentos", section: "Equipamentos", subtitle: "Histórico e identificação dos equipamentos" },
        industrial: { title: "Máquinas e equipamentos", section: "Equipamentos", subtitle: "Identificação, serviços e histórico industrial" },
        drone: { title: "Estruturas inspecionadas", section: "Estruturas", subtitle: "Identificação, inspeções e histórico das estruturas" },
        car_wash: { title: "Veículos", section: "Veículos", subtitle: "Identificação, serviços e histórico dos veículos" },
        upholstery_cleaning: { title: "Estofados cadastrados", section: "Estofados", subtitle: "Identificação, serviços e histórico dos estofados" },
        curtains_blinds: { title: "Cortinas e persianas", section: "Itens cadastrados", subtitle: "Identificação, serviços e histórico dos itens" },
        repairs_maintenance: { title: "Locais e manutenções", section: "Locais", subtitle: "Locais cadastrados e histórico de manutenções" },
        condominiums: { title: "Áreas e equipamentos", section: "Áreas e equipamentos", subtitle: "Identificação, serviços e histórico do condomínio" }
    };
    return map[id] || null;
}

function renderHome(
    identity,
    runtime,
    selectedModule
) {
    const displayUserName =
        String(identity.professional || "").trim() ||
        resolveLoggedInUserFullName() ||
        "Usuário";
    const displayUserInitial =
        displayUserName.charAt(0).toUpperCase();

    /*
     * Fonte canônica para a janela da nuvem. Assim, "Selecionar projeto para
     * sincronizar" usa a mesma lista filtrada que Atendimentos recentes e não
     * expõe relatórios de outro módulo nem snapshots internos já removidos.
     */
    global.AuroraVisibleCloudSyncReports = () =>
        reportsForProfile(
            getReports(),
            identity.profile
        );

    const shell =
        runtime.shell;

    const shellMain =
        shell.container.querySelector(
            ".aurora-shell__main"
        );

    const contentHost =
        shell.getContentHost();

    if (
        !shellMain ||
        !contentHost
    ) {
        throw new Error(
            "AppShell incompleto."
        );
    }

    const workflowLayer =
        document.createElement(
            "div"
        );

    workflowLayer.className =
        "aurora-workflow-layer";

    while (
        contentHost.firstChild
    ) {
        workflowLayer.appendChild(
            contentHost.firstChild
        );
    }

    /*
     * CORREÇÃO RC1.5
     *
     * O Runtime iniciou Cliente dentro de contentHost. Depois que os
     * nós são movidos para workflowLayer, o controller atual também
     * precisa passar a apontar para workflowLayer.
     *
     * Sem isso, ao avançar, ModuleController.unmount() limpa
     * contentHost inteiro e apaga Home, Relatórios e as demais camadas.
     */
    const mountedController =
        runtime.viewManager
            .getCurrentController();

    if (mountedController) {
        mountedController.container =
            workflowLayer;
    }

    const homeLayer =
        document.createElement(
            "section"
        );

    homeLayer.className =
        "aurora-home-layer";

    const reportsLayer =
        document.createElement(
            "section"
        );

    reportsLayer.className =
        "aurora-reports-layer";

    const homeServicesAuthority = resolveHomeServicesAuthority(identity, selectedModule);
    const selectedServiceIds = new Set(homeServicesAuthority.chosenIds);
    const services = homeServicesAuthority.services;
    try {
        if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("HOME_SERVICE_AUTHORITY", {
            module_code: homeServicesAuthority.moduleCode,
            profile: homeServicesAuthority.profileCode,
            selected_services: homeServicesAuthority.selectedServices,
            operational_services: homeServicesAuthority.operationalServices,
            profile_default_services: homeServicesAuthority.profileDefaultServices,
            chosen_services: homeServicesAuthority.chosenIds,
            chosen_authority: homeServicesAuthority.chosenAuthority,
            reason: homeServicesAuthority.chosenAuthority === "explicit_operational_services"
                ? "O módulo resolvido forneceu operational_services explícitos."
                : (homeServicesAuthority.chosenAuthority === "selected_services"
                    ? "A seleção persistida é válida no catálogo do profile."
                    : "Não há seleção operacional explícita válida; usando defaults do profile.")
        });
    } catch (_) {}
    const availableServiceCount = services.length;

    const reports =
        reportsForProfile(
            createDemoReports(identity),
            identity.profile
        );

    try { const api = global.AuroraTraceV35 || global.AuroraBoltTraceV140; if (api && api.mark) api.mark("V35 RECENT_SOURCE", reports.slice(0,3).map(r => ({ id:r.id, public_id:r.public_id, updated_at:r.updated_at, created_at:r.created_at, snapshot_updated_at:r.snapshot&&r.snapshot.updated_at, customer:r.customer, snapshot_customer:r.snapshot&&r.snapshot.customer }))); } catch (_) {}

    const openReports =
        reports.filter(
            (item) =>
                item.status !==
                "Concluído"
        ).length;

    const completedReports =
        reports.filter(
            (item) =>
                item.status ===
                "Concluído"
        ).length;

    const isAetPrivateEnvironment = String(identity.active_license_module_code || "").trim() === "eletrica_tupy";
    const isAetAdminHome = isAetPrivateEnvironment && canManageEletricaTupyUi();
    const isAetAuthorizedHome = isAetPrivateEnvironment && (canEnterEletricaTupyOperationalFlow() || canExplicitlyOpenEletricaTupyOffline());
    const assetCatalog = auroraAssetCatalogForProfile(identity.profile, services);
    const isGenericCompanyAdminHome = !isAetAdminHome && Boolean(
        global.AuroraCompanyAccess
        && typeof global.AuroraCompanyAccess.canManageUsers === "function"
        && global.AuroraCompanyAccess.canManageUsers()
    );

    /* R11.7 — identidade empresarial centralizada.
       O nome profissional pertence ao membro; a logo pertence à empresa. */
    if (global.AuroraCloudSync) {
        if (typeof global.AuroraCloudSync.syncMyProfile === "function") {
            Promise.resolve(global.AuroraCloudSync.syncMyProfile(identity)).catch(() => {});
        }
        if (typeof global.AuroraCloudSync.getCompanyIdentity === "function") {
            Promise.resolve(global.AuroraCloudSync.getCompanyIdentity()).then(async (companyIdentity) => {
                if (!companyIdentity || !companyIdentity.company_id) return;
                const adminCanManage = global.AuroraCompanyAccess
                    && typeof global.AuroraCompanyAccess.canManageUsers === "function"
                    && global.AuroraCompanyAccess.canManageUsers();
                let nextLogo = String(companyIdentity.logo || "");
                let nextTransparency = Number(companyIdentity.logo_transparency ?? 0.70);
                if (nextTransparency <= 1) nextTransparency *= 100;
                /* Primeira adoção: preserva a logo que o ADMIN já tinha localmente e
                   publica na empresa, em vez de apagar o marco visual existente. */
                if (adminCanManage && !nextLogo && identity.logo && typeof global.AuroraCloudSync.updateCompanyIdentity === "function") {
                    await global.AuroraCloudSync.updateCompanyIdentity(identity);
                    nextLogo = String(identity.logo || "");
                    nextTransparency = Number(identity.logo_transparency ?? 70);
                }
                if (identity.logo === nextLogo && Number(identity.logo_transparency ?? 70) === nextTransparency) return;
                identity.logo = nextLogo;
                identity.logo_transparency = nextTransparency;
                saveIdentity(identity);
                const hero = homeLayer.querySelector(".aurora-home-hero");
                if (hero) {
                    hero.style.setProperty("--aurora-user-logo-opacity", String(Math.max(0.1, 1 - nextTransparency / 100)));
                    let img = hero.querySelector(".aurora-home-hero__company-logo");
                    if (nextLogo) {
                        if (!img) { img = document.createElement("img"); img.className = "aurora-home-hero__company-logo"; img.alt = "Logo da empresa"; hero.insertBefore(img, hero.firstChild); }
                        img.src = nextLogo;
                    } else if (img) { img.remove(); }
                }
            }).catch(() => {});
        }
    }

    homeLayer.innerHTML = [
        `<section class="aurora-home-hero" style="--aurora-user-logo-opacity:${Math.max(0.1, Math.min(1, 1 - (Number(identity.logo_transparency ?? 70) / 100)))}">`,
        identity.logo ? `<img class="aurora-home-hero__company-logo" src="${escapeHTML(identity.logo)}" alt="Logo da empresa">` : '',
        '<h2>Bem-vindo à Aurora</h2>',
        `<strong>${escapeHTML(identity.company)}</strong>`,
        '<button type="button" class="aurora-home-refresh" data-aurora-refresh aria-label="Atualizar dados" title="Atualizar dados">↻ <span>Atualizar</span></button>',
        isAetPrivateEnvironment
            ? (isAetAdminHome ? '<p>Acesse a administração e as últimas atividades da equipe.</p>' : '<p>Acesse suas atividades rotineiras autorizadas para a Tupy.</p>')
            : '<p>Escolha um dos serviços habilitados ou continue um atendimento recente.</p>',
        isAetPrivateEnvironment
            ? `<span class="aurora-home-hero__count">Atividades Rotineiras Tupy · ${identity.active_module_access_status === "trial" ? "Demonstração" : "Ambiente autorizado"}</span>`
            : `<div class="aurora-home-hero__badges"><span class="aurora-home-hero__count">${escapeHTML(profilePresentation(identity.profile).module)} · ${identity.active_module_access_status === "trial" ? "Demonstração" : "Ambiente licenciado"}</span><span class="aurora-home-hero__count" data-home-service-count>${availableServiceCount} serviços disponíveis</span></div>`,
        '</section>',
        isAetAdminHome ? [
            '<section class="aurora-dashboard-metrics">',
            '<article><span>Em andamento</span>', `<strong>${openReports}</strong>`, '<small>atendimentos ativos</small></article>',
            '<article><span>Concluídos</span>', `<strong>${completedReports}</strong>`, '<small>relatórios disponíveis</small></article>',
            '<article><span>Ambiente</span>', `<strong>${isAetPrivateEnvironment ? "Atividades Rotineiras Tupy" : escapeHTML(profilePresentation(identity.profile).module)}</strong>`, `<small>${identity.active_module_access_status === "trial" ? "demonstração" : "ambiente autorizado"}</small></article>`,
            '</section>'
        ].join("") : "",
        /* ADMIN: não renderiza bloco operacional "Seu ambiente" / Elétrica Tupy. USER: preservado. */
        isAetPrivateEnvironment
            ? ""
            : [
                `<section class="aurora-home-section${isGenericCompanyAdminHome ? ' aurora-home-section--company-admin-services' : ''}">`,
                '<div class="aurora-home-section__header">',
                '<div>',
                '<span>Seu ambiente</span>',
                '<h3>Qual serviço será executado?</h3>',
                '</div>',
                '</div>',
                `<div class="aurora-service-grid${services.filter(service => !(selectedServiceIds.size && !selectedServiceIds.has(String(service.id)))).length === 1 ? ' aurora-service-grid--single' : ''}" data-operational-service-grid>`,
                services.map(
                    (service) => [
                        '<button type="button" class="aurora-service-card',
                        service.id === identity.preferred_service ? ' is-preferred' : '',
                        '"',
                        ` style="--service-accent:${escapeHTML(service.color || "#64f0e5")}"`,
                        ` data-service-id="${escapeHTML(service.id)}"`,
                        ` data-service-title="${escapeHTML(service.title)}"`,
                        ` data-operation-type="${escapeHTML(service.operation_type || "inspection")}"`,
                        ` data-flow-template="${escapeHTML(service.flow_template || "technical")}"`,
                        ` data-record-section-title="${escapeHTML(service.record_section_title || "Registros técnicos")}"`,
                        ` data-custom-fields="${escapeHTML(JSON.stringify(service.custom_fields || []))}"`,
                        ` data-service-description="${escapeHTML(service.description || "")}"`,
                        ` data-service-custom="${service.custom ? "true" : "false"}"`,
                        selectedServiceIds.size && !selectedServiceIds.has(String(service.id)) ? ' hidden' : '',
                        '>',
                        `<span class="aurora-service-card__icon">${service.icon}</span>`,
                        '<span class="aurora-service-card__content">',
                        `<strong>${escapeHTML(service.title)}</strong>`,
                        isGenericCompanyAdminHome ? '' : `<small>${escapeHTML(service.description)}</small>`,
                        '</span>',
                        '<span class="aurora-service-card__arrow">›</span>',
                        '</button>'
                    ].join("")
                ).join(""),
                '</div>',
                '</section>'
            ].join(""),
        (!isAetAdminHome && !isGenericCompanyAdminHome && assetCatalog)
            ? [
                '<section class="aurora-home-section aurora-company-management aurora-company-assets-member">',
                `<div class="aurora-home-section__header"><div><span>${escapeHTML(assetCatalog.section)}</span><h3>${escapeHTML(assetCatalog.title)}</h3></div></div>`,
                '<div class="aurora-company-management__grid">',
                `<button type="button" class="aurora-company-management__card is-assets" data-open-assets data-assets-profile="${escapeHTML(identity.profile)}" data-assets-title="${escapeHTML(assetCatalog.title)}"><span class="aurora-company-management__icon">▣</span><span><strong>${escapeHTML(assetCatalog.title)} <i class="aurora-assets-info" data-assets-info role="button" tabindex="0" aria-label="O que é ${escapeHTML(assetCatalog.title)}?">ⓘ</i></strong><small>Identificação, vistorias e histórico conforme suas permissões</small></span><b>›</b></button>`,
                '</div></section>'
              ].join("") : "",
        /* V47 R13 — restaura o card ADMIN já existente de criação Tupy.
         * Não cria rota, shape ou fluxo novo: reaproveita o mesmo [data-service-id="eletrica_tupy"]
         * e o handler canônico já usado pela Aurora. O fallback generic company admin é
         * necessário porque a Home atual pode classificar o ADMIN Bolt como administração
         * empresarial genérica mesmo dentro do módulo privado eletrica_tupy. */
        (isAetPrivateEnvironment && isAetAuthorizedHome)
            ? [
                '<section class="aurora-home-section" data-aet-gestao-home>',
                '<div class="aurora-home-section__header">',
                '<div>',
                '<span>Administração</span>',
                '<h3>ATIVIDADES ROTINEIRAS TUPY</h3>',
                '</div>',
                '</div>',
                '<div class="aurora-service-grid aurora-service-grid--aet-admin">',
                '<button type="button" class="aurora-service-card" data-service-id="eletrica_tupy" data-service-title="ATIVIDADES ROTINEIRAS TUPY" data-operation-type="inspection" data-flow-template="technical" data-record-section-title="Registros técnicos" data-custom-fields="[]" data-service-description="Executar uma nova atividade rotineira." data-service-custom="false" style="--service-accent:#64f0e5">',
                '<span class="aurora-service-card__icon">＋</span>',
                '<span class="aurora-service-card__content">',
                '<strong>Nova atividade</strong>',
                '<small>Executar uma atividade rotineira como administrador.</small>',
                '</span>',
                '<span class="aurora-service-card__arrow">›</span>',
                '</button>',
                isAetAdminHome ? [
                    '<button type="button" class="aurora-service-card" data-open-aet-gestao style="--service-accent:#64f0e5">',
                    '<span class="aurora-service-card__icon">▣</span>',
                    '<span class="aurora-service-card__content">',
                    '<strong>Gestão dos trabalhos</strong>',
                    '<small>Revisar atividades da equipe e informações administrativas.</small>',
                    '</span>',
                    '<span class="aurora-service-card__arrow">›</span>',
                    '</button>'
                ].join("") : '',
                '</div>',
                '</section>'
            ].join("")
            : "",
        isAetAdminHome
            ? [
                '<section class="aurora-home-section" data-aet-home-recent-section>',
                '<div class="aurora-home-section__header aurora-home-section__header--inline">',
                '<div>',
                '<span>Atalhos</span>',
                '<h3>Últimas atividades adicionadas</h3>',
                '</div>',
                '<button type="button" data-open-aet-gestao>Ver todos</button>',
                '</div>',
                '<div class="aurora-recent-list aet-home-recent-admin" data-aet-home-recent-admin>',
                '<p class="aet-hint">Carregando atividades…</p>',
                '</div>',
                '</section>'
            ].join("")
            : isGenericCompanyAdminHome
            ? [
                '<section class="aurora-home-section aurora-company-management">',
                '<div class="aurora-home-section__header"><div><span>Administração</span><h3>Gestão</h3></div></div>',
                '<div class="aurora-company-management__grid">',
                '<button type="button" class="aurora-company-management__card is-team" data-open-company-team><span class="aurora-company-management__icon">👥</span><span><strong>Todos os trabalhos</strong><small data-company-team-summary>Carregando empresa…</small></span><b>›</b></button>',
                (assetCatalog
                    ? `<button type="button" class="aurora-company-management__card is-assets" data-open-assets data-assets-profile="${escapeHTML(identity.profile)}" data-assets-title="${escapeHTML(assetCatalog.title)}"><span class="aurora-company-management__icon">▣</span><span><strong>${escapeHTML(assetCatalog.title)} <i class="aurora-assets-info" data-assets-info role="button" tabindex="0" aria-label="O que é ${escapeHTML(assetCatalog.title)}?">ⓘ</i></strong><small>${escapeHTML(assetCatalog.subtitle)}</small></span><b>›</b></button>`
                    : ''),
                '</div></section>',
                '<section class="aurora-home-section">',
                '<div class="aurora-home-section__header aurora-home-section__header--inline"><div><h3>Atendimentos recentes</h3></div><button type="button" data-open-company-team>Ver todos</button></div>',
                '<div class="aurora-recent-list" data-company-overview-recent><p>Carregando atendimentos da empresa…</p></div>',
                '</div></section>',
                '<section class="aurora-company-team-panel" data-company-team-panel hidden>',
                '<div class="aurora-company-team-panel__top"><button type="button" class="aurora-company-team-back" data-close-company-team>← Início</button><div><span>Administração empresarial</span><h3>Todos os trabalhos</h3></div></div>',
                '<div class="aurora-company-team-filters" data-company-team-filters>',
                '<label class="aurora-company-team-search"><span>Buscar</span><input type="search" data-company-team-search placeholder="Atendimento ou funcionário"></label>',
                '<label><span>Usuário</span><select data-company-team-user><option value="">Todos os usuários</option></select></label>',
                '<label><span>Serviço</span><select data-company-team-service><option value="">Todos os serviços</option></select></label>',
                '<label><span>Status</span><select data-company-team-status><option value="">Todos os status</option><option value="open">Em andamento</option><option value="completed">Concluídos</option></select></label>',
                '<label><span>Período</span><select data-company-team-period><option value="30">Últimos 30 dias</option><option value="1">Hoje</option><option value="7">Últimos 7 dias</option><option value="all">Todo o período</option></select></label>',
                '</div>',
                '<div class="aurora-company-team-result" data-company-team-result></div>',
                '<div class="aurora-recent-list" data-company-home-recent><p>Carregando atendimentos da empresa…</p></div>',
                '</section>'
            ].join("")
            : [
                '<section class="aurora-home-section">',
                '<div class="aurora-home-section__header aurora-home-section__header--inline">',
                '<div>',
                '<span>Retomar trabalho</span>',
                '<h3>Atendimentos recentes</h3>',
                '</div>',
                '<button type="button" data-open-reports>Ver todos</button>',
                '</div>',
                '<div class="aurora-recent-list">',
                reports.slice(0, 3).map(
                    (report) => [
                        '<article class="aurora-recent-card" data-report-id="',
                        escapeHTML(report.id),
                        '">',
                        `<button type="button" class="aurora-recent-card__main" data-recent-open="${escapeHTML(report.id)}" aria-label="Abrir relatório">`,
                        '<span class="aurora-recent-card__icon">▤</span>',
                        '<span>',
                        `<strong>${escapeHTML(reportCustomerName(report))}</strong>`,
                        `<small>${escapeHTML(reportServiceTitle(report))} · Feito por ${escapeHTML(identity.professional || "Usuário")} · ${formatDate(report.updated_at || report.created_at)}${report.snapshot && report.snapshot.aurora_moderation && report.snapshot.aurora_moderation.altered_by_name ? ` · Alterado por ${escapeHTML(report.snapshot.aurora_moderation.altered_by_name)}` : ""}</small>`,
                        '</span>',
                        `<b class="${report.status === "Concluído" ? "is-done" : "is-open"}">${escapeHTML(report.status)}</b>`,
                        '</button>',
                        recentActionsMarkup(report),
                        '</article>'
                    ].join("")
                ).join(""),
                '</div>',
                '</section>'
            ].join("")
    ].join("");


    if (isGenericCompanyAdminHome) {
        global.AuroraCompanyHomeReady = Promise.resolve().then(async () => {
            const host = homeLayer.querySelector("[data-company-home-recent]");
            const access = global.AuroraCompanyAccess;
            const apiClient = global.AuroraCloudSync && global.AuroraCloudSync.client
                ? global.AuroraCloudSync.client
                : (global.AURORA_SUPABASE_CLIENT || null);
            if (!host || !access || typeof access.listMyCompanyProjectSummaries !== "function") return;
            try {
                const rows = await access.listMyCompanyProjectSummaries(apiClient);
                let profileRows = rows.filter((row) => String(row.service_profile || "") === String(identity.profile || ""));
                const overviewHost = homeLayer.querySelector("[data-company-overview-recent]");
                const openCount = profileRows.filter((row) => String(row.status || "") !== "completed").length;
                const completedCount = profileRows.filter((row) => String(row.status || "") === "completed").length;
                const openNode = homeLayer.querySelector("[data-home-open-count]");
                const completedNode = homeLayer.querySelector("[data-home-completed-count]");
                if (openNode) openNode.textContent = String(openCount);
                if (completedNode) completedNode.textContent = String(completedCount);
                if (!profileRows.length) {
                    const teamSummary = homeLayer.querySelector("[data-company-team-summary]");
                    if (teamSummary) teamSummary.textContent = "Nenhum trabalho da equipe";
                    host.innerHTML = '<p>Nenhum atendimento da empresa encontrado.</p>';
                    if (overviewHost) overviewHost.innerHTML = '<p>Nenhum atendimento da empresa encontrado.</p>';
                    return;
                }
                const teamSummary = homeLayer.querySelector("[data-company-team-summary]");
                if (teamSummary) {
                    const people = new Set(profileRows.map((row) => String(row.creator_name || "Usuário")));
                    teamSummary.textContent = `${people.size} funcionário${people.size === 1 ? "" : "s"} · ${openCount} em andamento`;
                }
                const teamSearch = homeLayer.querySelector("[data-company-team-search]");
                const teamUser = homeLayer.querySelector("[data-company-team-user]");
                const teamService = homeLayer.querySelector("[data-company-team-service]");
                const teamStatus = homeLayer.querySelector("[data-company-team-status]");
                const teamPeriod = homeLayer.querySelector("[data-company-team-period]");
                const teamResult = homeLayer.querySelector("[data-company-team-result]");
                const creatorNames = Array.from(new Set(profileRows.map((row) => String(row.creator_name || "Usuário").trim()).filter(Boolean))).sort((a,b) => a.localeCompare(b, "pt-BR"));
                const serviceNames = Array.from(new Set(profileRows.map((row) => auroraServiceLabel(row.service_type, "Atendimento").trim()).filter(Boolean))).sort((a,b) => a.localeCompare(b, "pt-BR"));
                if (teamUser) teamUser.innerHTML = '<option value="">Todos os usuários</option>' + creatorNames.map((name) => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join("");
                if (teamService) teamService.innerHTML = '<option value="">Todos os serviços</option>' + serviceNames.map((name) => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join("");

                let visibleLimit = 10;
                function rowServiceLabel(row) {
                    return auroraServiceLabel(row.service_type, "Atendimento");
                }
                function filteredCompanyRows() {
                    const query = String(teamSearch && teamSearch.value || "").trim().toLocaleLowerCase("pt-BR");
                    const user = String(teamUser && teamUser.value || "");
                    const service = String(teamService && teamService.value || "");
                    const status = String(teamStatus && teamStatus.value || "");
                    const period = String(teamPeriod && teamPeriod.value || "30");
                    const now = Date.now();
                    return profileRows.filter((row) => {
                        const creator = String(row.creator_name || "Usuário");
                        const title = String(row.title || "Atendimento");
                        const serviceLabel = rowServiceLabel(row);
                        const completed = String(row.status || "") === "completed";
                        if (query && !`${title} ${creator} ${serviceLabel}`.toLocaleLowerCase("pt-BR").includes(query)) return false;
                        if (user && creator !== user) return false;
                        if (service && serviceLabel !== service) return false;
                        if (status === "completed" && !completed) return false;
                        if (status === "open" && completed) return false;
                        if (period !== "all") {
                            const stamp = Date.parse(row.updated_at || row.created_at || "");
                            const days = Number(period || 30);
                            if (Number.isFinite(stamp) && stamp < now - days * 86400000) return false;
                        }
                        return true;
                    }).sort((a, b) =>
                        Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0)
                    );
                }
                function companyRowMarkup(row) {
                    return [
                        `<article class="aurora-recent-card" data-company-project-id="${escapeHTML(row.id)}">`,
                        `<button type="button" class="aurora-recent-card__main" data-company-project-open="${escapeHTML(row.id)}" aria-label="Abrir atendimento">`,
                        '<span class="aurora-recent-card__icon">▤</span><span>',
                        `<strong>${escapeHTML(row.title || "Atendimento")}</strong>`,
                        `<small>${escapeHTML(rowServiceLabel(row))} · Feito por ${escapeHTML(row.creator_name || "Usuário")} · ${formatDate(row.updated_at || row.created_at)}</small>`,
                        '</span>',
                        `<b class="${String(row.status || "") === "completed" ? "is-done" : "is-open"}">${String(row.status || "") === "completed" ? "Concluído" : "Em andamento"}</b>`,
                        '</button><div class="aurora-recent-card__actions">',
                        `<button type="button" class="aurora-recent-action" data-company-project-edit="${escapeHTML(row.id)}" aria-label="Editar atendimento" title="Editar atendimento">${auroraIcons.edit}</button>`,
                        `<button type="button" class="aurora-recent-cloud is-synced" disabled aria-label="Atendimento sincronizado" title="Atendimento sincronizado">${auroraIcons.cloudCheck}<span>Na nuvem</span></button>`,
                        `<button type="button" class="aurora-recent-action is-danger" data-company-project-delete="${escapeHTML(row.id)}" aria-label="Excluir atendimento" title="Excluir atendimento">${auroraIcons.trash}</button>`,
                        '</div></article>'
                    ].join("");
                }
                function updateCompanySummary() {
                    const currentOpen = profileRows.filter((row) => String(row.status || "") !== "completed").length;
                    const currentCompleted = profileRows.filter((row) => String(row.status || "") === "completed").length;
                    const openNode = homeLayer.querySelector("[data-home-open-count]");
                    const completedNode = homeLayer.querySelector("[data-home-completed-count]");
                    if (openNode) openNode.textContent = String(currentOpen);
                    if (completedNode) completedNode.textContent = String(currentCompleted);
                    const people = new Set(profileRows.map((row) => String(row.creator_name || "Usuário")));
                    const summary = homeLayer.querySelector("[data-company-team-summary]");
                    if (summary) summary.textContent = profileRows.length
                        ? `${people.size} usuário${people.size === 1 ? "" : "s"} · ${currentOpen} em andamento`
                        : "Nenhum trabalho da equipe";
                    return people;
                }
                function bindCompanyProjectActions(root = host) {
                    root.querySelectorAll("[data-company-project-open]").forEach((button) => {
                        button.onclick = () => openCompanyProject(button.dataset.companyProjectOpen, false);
                    });
                    root.querySelectorAll("[data-company-project-edit]").forEach((button) => {
                        button.onclick = () => openCompanyProject(button.dataset.companyProjectEdit, true);
                    });
                    root.querySelectorAll("[data-company-project-delete]").forEach((button) => {
                        button.onclick = async () => {
                            const projectId = button.dataset.companyProjectDelete;
                            if (!await global.AuroraDialog.confirm("Este atendimento da empresa será excluído da nuvem.", { title: "Excluir atendimento?", confirmLabel: "Excluir", tone: "danger" })) return;
                            try {
                                const apiClient = global.AuroraCloudSync && global.AuroraCloudSync.client ? global.AuroraCloudSync.client : global.AURORA_SUPABASE_CLIENT;
                                const row = profileRows.find((item) => String(item.id) === String(projectId));
                                const ownerId = String(row && row.created_by || "");
                                const currentUserId = String(global.AURORA_ACCOUNT_USER_ID || "");
                                const rpcName = ownerId && ownerId !== currentUserId
                                    ? "aurora_company_hide_projects"
                                    : "aurora_company_soft_delete_projects";
                                const result = await apiClient.rpc(rpcName, { p_project_ids: [projectId] });
                                if (result.error) throw result.error;
                                profileRows = profileRows.filter((item) => String(item.id) !== String(projectId));
                                updateCompanySummary();
                                renderCompanyRows(false);
                                renderCompanyOverview();
                                showStatus(rpcName === "aurora_company_hide_projects" ? "Atendimento removido da gestão." : "Atendimento excluído.", 2400);
                            } catch (error) {
                                console.error("[EMPRESA] Falha ao excluir atendimento", error);
                                showStatus("Não foi possível excluir o atendimento.", 3200);
                            }
                        };
                    });
                }
                function renderCompanyOverview() {
                    if (!overviewHost) return;
                    const recent = profileRows.slice().sort((a, b) =>
                        Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0)
                    ).slice(0, 3);
                    overviewHost.innerHTML = recent.length
                        ? recent.map(companyRowMarkup).join("")
                        : '<p>Nenhum atendimento da empresa encontrado.</p>';
                    bindCompanyProjectActions(overviewHost);
                }
                function renderCompanyRows(resetLimit) {
                    if (resetLimit) visibleLimit = 10;
                    const filtered = filteredCompanyRows();
                    const visible = filtered.slice(0, visibleLimit);
                    if (teamResult) teamResult.textContent = `${filtered.length} atendimento${filtered.length === 1 ? "" : "s"} encontrado${filtered.length === 1 ? "" : "s"}`;
                    if (!visible.length) {
                        host.innerHTML = '<p class="aurora-company-team-empty">Nenhum atendimento encontrado com estes filtros.</p>';
                        return;
                    }
                    host.innerHTML = visible.map(companyRowMarkup).join("") + (filtered.length > visible.length ? `<div class="aurora-company-team-more"><button type="button" data-company-team-more>Carregar mais ${Math.min(10, filtered.length-visible.length)}</button></div>` : "");
                    bindCompanyProjectActions();
                    const more = host.querySelector("[data-company-team-more]");
                    if (more) more.onclick = () => { visibleLimit += 10; renderCompanyRows(false); };
                }
                [teamSearch, teamUser, teamService, teamStatus, teamPeriod].filter(Boolean).forEach((control) => {
                    control.addEventListener(control === teamSearch ? "input" : "change", () => renderCompanyRows(true));
                });
                renderCompanyRows(true);
                renderCompanyOverview();
                global.AuroraCompanyHomeReconcile = async () => {
                    const freshRows = await access.listMyCompanyProjectSummaries(apiClient);
                    /* FIX7 — uma única lista fresca alimenta tanto Todos os trabalhos
                     * quanto Atendimentos recentes. A ordem é sempre pela última
                     * alteração confirmada na nuvem, sem depender de F5. */
                    profileRows = freshRows
                        .filter((row) => String(row.service_profile || "") === String(identity.profile || ""))
                        .sort((a, b) =>
                            Date.parse(b.updated_at || b.created_at || 0) -
                            Date.parse(a.updated_at || a.created_at || 0)
                        );
                    const people = updateCompanySummary();
                    if (teamUser) {
                        const names = Array.from(people).filter(Boolean).sort((a,b) => a.localeCompare(b, "pt-BR"));
                        teamUser.innerHTML = '<option value="">Todos os usuários</option>' + names.map((name) => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join("");
                    }
                    renderCompanyRows(true);
                    renderCompanyOverview();
                    return profileRows.length;
                };

                /* Revalida a visão administrativa ao retornar ao app. Isso cobre
                   alterações feitas por outro membro sem exigir F5 e sem polling. */
                if (!global.__auroraCompanyHomeVisibilityRefreshBound) {
                    global.__auroraCompanyHomeVisibilityRefreshBound = true;
                    document.addEventListener("visibilitychange", () => {
                        if (document.visibilityState !== "visible") return;
                        if (typeof global.AuroraCompanyHomeReconcile === "function") {
                            global.AuroraCompanyHomeReconcile().catch((error) =>
                                console.warn("[EMPRESA] Falha ao atualizar recentes ao retornar ao app.", error)
                            );
                        }
                    });
                }

                async function openCompanyProject(projectId, editAfterOpen) {
                    const cloud = global.AuroraCloudSync;
                    if (!cloud || typeof cloud.restoreCompanyProjectForAdmin !== "function") {
                        showStatus("Abertura empresarial indisponível.", 2600); return;
                    }
                    try {
                        showStatus("Abrindo atendimento da equipe…", 1800);
                        const isTupyRoutine = String(identity.profile || identity.active_license_module_code || "").trim().toLowerCase() === "eletrica_tupy";

                        /* V47 R14 — migração controlada da primeira shape para a porta oficial.
                         * Somente a ABERTURA de Atividades Rotineiras converge agora em
                         * openReportPreview(). Edição e demais serviços preservam a rota R13
                         * até passarem por teste humano individual. */
                        if (!editAfterOpen && isTupyRoutine) {
                            await openReportPreview("", {
                                projectId: String(projectId || ""),
                                source: "company_project"
                            });
                            return;
                        }

                        const result = await cloud.restoreCompanyProjectForAdmin(projectId);
                        if (editAfterOpen) {
                            const local = getReports().find((item) => String((item.snapshot && item.snapshot.id) || item.case_id || item.id || "") === String(result.caseData.id));
                            if (local) window.dispatchEvent(new CustomEvent("aurora:edit-report", { detail: { report: local } }));
                        } else {
                            const local = getReports().find((item) => String((item.snapshot && item.snapshot.id) || item.case_id || item.id || "") === String(result.caseData.id));
                            if (local) openReportPreview(local.id);
                        }
                    } catch (error) {
                        console.error("[EMPRESA] Falha ao abrir atendimento", error);
                        showStatus(String(error && error.message || "Não foi possível abrir o atendimento."), 3600);
                    }
                }
            } catch (error) {
                console.error("[EMPRESA] Falha ao listar atendimentos", error);
                const teamSummary = homeLayer.querySelector("[data-company-team-summary]");
                if (teamSummary) teamSummary.textContent = "Não foi possível carregar";
                host.innerHTML = '<p>Não foi possível carregar os atendimentos da empresa.</p>';
                const overviewHost = homeLayer.querySelector("[data-company-overview-recent]");
                if (overviewHost) overviewHost.innerHTML = '<p>Não foi possível carregar os atendimentos da empresa.</p>';
            }
        });
    }


    reportsLayer.innerHTML = [
        '<section class="aurora-reports-header">',
        '<div>',
        '<span>Documentos Aurora</span>',
        '<h2>Relatórios</h2>',
        '<p>Consulte atendimentos concluídos e em andamento.</p>',
        '</div>',
        '<label class="aurora-report-search">',
        '<span>⌕</span>',
        '<input type="search" placeholder="Pesquisar cliente ou serviço" data-report-search>',
        '</label>',
        '</section>',
        '<div class="aurora-report-tools">',
        '<div class="aurora-report-filters">',
        '<button type="button" class="is-active" data-report-filter="all">Todos</button>',
        '<button type="button" data-report-filter="Concluído">Concluídos</button>',
        '<button type="button" data-report-filter="Em andamento">Em andamento</button>',
        '</div>',
        '<div class="aurora-report-selection-actions">',
        '<button type="button" data-report-select-mode>Selecionar</button>',
        '<button type="button" class="is-danger" data-report-delete-selected hidden>Excluir selecionados</button>',
        '</div>',
        '</div>',
        '<div class="aurora-report-selection-summary" data-report-selection-summary hidden>0 relatórios selecionados</div>',
        '<div class="aurora-report-list" data-report-list>',
        '</div>'
    ].join("");

    const customServiceModal =
        document.createElement(
            "div"
        );

    customServiceModal.className =
        "aurora-custom-service-modal";

    customServiceModal.innerHTML = [
        '<button type="button" class="aurora-custom-service-modal__backdrop" data-custom-service-close aria-label="Fechar"></button>',
        '<form class="aurora-custom-service-sheet" data-custom-service-form>',
        '<header><div><span>Shape personalizada</span><h2>Criar meu serviço</h2><p>Este serviço ficará disponível somente no segmento atual.</p></div><button type="button" data-custom-service-close>×</button></header>',
        '<label><span>Nome do serviço</span><input name="title" required maxlength="48" placeholder="Ex.: Inspeção de reservatório"></label>',
        '<label><span>Descrição</span><textarea name="description" required maxlength="180" placeholder="Ex.: Verificação de soldas, corrosão, pintura e válvulas."></textarea></label>',
        '<label><span>Modelo de fluxo</span><select name="flow_template"><option value="quick">Registro rápido — cliente, dados, registros e finalização</option><option value="technical">Inspeção técnica — inclui condições e diagnóstico</option><option value="checklist">Checklist operacional — dados, checklist/registros e finalização</option><option value="budget">Orçamento técnico — levantamento, fotos e resumo técnico</option></select><small>O modelo define quais telas aparecerão no atendimento.</small></label>',
        '<div class="aurora-custom-service-grid">',
        '<label><span>Tipo de operação</span><select name="operation_type"><option value="inspection">Inspeção técnica</option><option value="technical_visit">Visita técnica</option><option value="budget">Orçamento técnico</option><option value="survey">Levantamento em campo</option><option value="audit">Auditoria</option><option value="checklist">Checklist operacional</option><option value="delivery">Entrega / recebimento</option><option value="maintenance">Manutenção</option><option value="inventory">Inventário</option></select></label>',
        '<label><span>Título no relatório</span><select name="record_section_title"><option>Registros técnicos</option><option>Levantamento realizado</option><option>Itens avaliados</option><option>Serviços executados</option><option>Condições registradas</option></select></label>',
        '</div>',
        '<label><span>Campos do serviço</span><textarea name="custom_fields" maxlength="500" placeholder="Um campo por linha. Ex.:\nModelo do equipamento\nNúmero de série\nCondição encontrada"></textarea><small>Esses campos ficam vinculados somente a esta shape.</small></label>',
        '<div class="aurora-custom-service-grid">',
        '<label><span>Ícone</span><select name="icon"><option>⚙️</option><option>🏭</option><option>🏗️</option><option>🔧</option><option>⚡</option><option>🚁</option><option>☀️</option><option>📦</option><option>🌡️</option><option>🔍</option></select></label>',
        '<label><span>Cor</span><input name="color" type="color" value="#64f0e5"></label>',
        '</div>',
        '<footer><button type="button" data-custom-service-close>Cancelar</button><button type="submit">Salvar serviço</button></footer>',
        '</form>'
    ].join("");

    document.body.appendChild(
        customServiceModal
    );

    contentHost.appendChild(
        workflowLayer
    );

    /*
     * CORREÇÃO ESTRUTURAL RC1.4
     *
     * Antes, o ViewManager continuava montando cada módulo diretamente
     * em contentHost. ModuleController.mount() substitui innerHTML,
     * então Cliente, Ativo, Evidências etc. apagavam Home e Relatórios.
     *
     * A partir daqui somente workflowLayer recebe os módulos.
     * Home e Relatórios permanecem vivos durante todo o atendimento.
     */
    runtime.viewManager.container =
        workflowLayer;

    runtime.viewManager.on(
        "shown",
        (event) => {
            console.log(
                "Aurora workflow:",
                event.id,
                "aberto em workflowLayer"
            );
            requestAnimationFrame(() => installQuickSuggestions(workflowLayer));
        }
    );

    contentHost.appendChild(
        homeLayer
    );

    contentHost.appendChild(
        reportsLayer
    );

    const gestaoLayer =
        document.createElement(
            "section"
        );

    gestaoLayer.className =
        "aurora-reports-layer aurora-gestao-layer";
    gestaoLayer.hidden = true;
    gestaoLayer.setAttribute("data-aet-gestao-layer", "");
    gestaoLayer.innerHTML = [
        '<section class="aurora-reports-header aet-gestao-header">',
        '<div>',
        '<button type="button" data-aet-gestao-back>← Voltar</button>',
        '<span>Administração</span>',
        '<h2>GESTÃO DOS TRABALHOS</h2>',
        '<p>ATIVIDADES ROTINEIRAS TUPY</p>',
        '</div>',
        '</section>',
        '<div class="aurora-gestao-body" data-aet-gestao-body></div>'
    ].join("");

    contentHost.appendChild(
        gestaoLayer
    );

    const dock =
        document.createElement(
            "div"
        );

    dock.className =
        "aurora-workflow-dock";

    dock.innerHTML = [
        '<button type="button" data-workflow-previous>← Anterior</button>',
        '<span data-workflow-progress>Etapa atual</span>',
        '<button type="button" data-workflow-next>Próximo →</button>'
    ].join("");

    shellMain.appendChild(
        dock
    );

    const settings =
        document.createElement(
            "div"
        );

    settings.className =
        "aurora-settings-modal";

    settings.innerHTML = [
        '<button type="button" class="aurora-settings-modal__backdrop" data-settings-close aria-label="Fechar"></button>',
        '<section class="aurora-settings-sheet">',
        '<header>',
        '<div>',
        '<h2>Perfil e configurações</h2>',
        '<p>Gerencie sua conta e os módulos da Aurora.</p>',
        '</div>',
        '<button type="button" data-settings-close>×</button>',
        '</header>',
        '<div class="aurora-settings-profile">',
        `<span>${escapeHTML(displayUserInitial)}</span>`,
        '<div>',
        `<strong>${escapeHTML(displayUserName)}</strong>`,
        `<small>${escapeHTML(identity.company)}</small>`,
        '</div>',
        '</div>',
        '<nav class="aurora-settings-nav">',
        '<button type="button" data-settings-identity>',
        '<span>⚙</span>',
        '<div><strong>Minha empresa</strong><small>Empresa e contato</small></div>',
        '<b>›</b>',
        '</button>',
        '<button type="button" data-settings-team' + (isGenericCompanyAdminHome ? '' : ' hidden') + '><span>👥</span><div><strong>Minha Equipe</strong><small>Membros e convites</small></div><b>›</b></button>',
        '<button type="button" data-onboarding-reset>',
        '<span>↺</span>',
        '<div><strong>Trocar segmento</strong><small>Alternar entre módulos ativos</small></div>',
        '<b>›</b>',
        '</button>',
        '<button type="button" data-edit-segment-services>',
        '<span>☑</span>',
        '<div><strong>Editar serviços do segmento</strong><small>Adicionar ou remover serviços oferecidos</small></div>',
        '<b>›</b>',
        '</button>',
        '<button type="button" data-demo-info>',
        '<span>✦</span>',
        '<div><strong>Módulos Aurora</strong><small>Licenças e demonstrações</small></div>',
        '<b>›</b>',
        '</button>',
        '<button type="button" data-theme-settings>',
        '<span>◐</span>',
        '<div><strong>Tema</strong><small>Alternar aparência</small></div>',
        '<b>›</b>',
        '</button>',
        '<button type="button" data-support-messages data-support-native>',
        '<span>💬</span>',
        '<div><strong>Mensagens e suporte</strong><small>Envie sugestões ou fale com a Aurora</small></div>',
        '<b>›</b>',
        '</button>',
        '<button type="button" data-account-signout>',
        '<span>⇥</span>',
        '<div><strong>Sair da conta</strong><small>Voltar para a tela de entrada</small></div>',
        '<b>›</b>',
        '</button>',
        '</nav>',
        '<div class="aurora-build-info" data-aurora-build-info>',
        '<span>Versão da Aurora</span>',
        `<strong>${escapeHTML(config.app.build_id || "")}</strong>`,
        '</div>',
        '</section>',
        '<div class="aurora-company-modal" data-company-modal hidden>',
        '<button type="button" class="aurora-company-modal__backdrop" data-company-close aria-label="Fechar Minha empresa"></button>',
        '<section class="aurora-company-sheet" role="dialog" aria-modal="true" aria-label="Minha empresa">',
        '<header>',
        '<div><button type="button" class="aurora-company-back" data-company-back>← Anterior</button><h2>Minha empresa</h2><p>Dados profissionais, contato e identidade visual.</p></div>',
        '<button type="button" data-company-close aria-label="Fechar">×</button>',
        '</header>',
        '<form data-identity-form hidden novalidate>',
        '<div class="aurora-settings-form__grid">',
        '<label><span>Empresa ou profissional</span>',
        `<input name="company" value="${escapeHTML(identity.company)}"></label>`,
        '<label class="is-wide"><span>Subtítulo / slogan</span>',
        `<input name="tagline" value="${escapeHTML(identity.tagline || "")}" placeholder="Ex.: Seu ponto de partida"></label>`,
        '<label><span>Responsável técnico</span>',
        `<input name="professional" value="${escapeHTML(identity.professional)}"></label>`,
        '<label><span>CNPJ ou CPF</span>',
        `<input name="document" value="${escapeHTML(identity.document || "")}" placeholder="Somente se desejar informar"></label>`,
        '<label><span>Registro profissional</span>',
        `<input name="registration" value="${escapeHTML(identity.registration || "")}" placeholder="CREA, CRT, CRQ..."></label>`,
        '<label><span>Telefone</span>',
        `<input name="phone" value="${escapeHTML(identity.phone || "")}"></label>`,
        '<label><span>WhatsApp</span>',
        `<input name="whatsapp" value="${escapeHTML(identity.whatsapp || "")}"></label>`,
        '<label><span>E-mail comercial</span>',
        `<input name="email" type="email" value="${escapeHTML(identity.email || "")}"></label>`,
        '<label class="is-wide"><span>E-mail usado no cadastro inicial</span>',
        '<input type="email" data-account-email readonly value="" placeholder="Carregando conta..."></label>',
        '<label><span>Site</span>',
        `<input name="website" value="${escapeHTML(identity.website || "")}"></label>`,
        '<label class="is-wide"><span>Endereço</span>',
        `<input name="address" value="${escapeHTML(identity.address || "")}"></label>`,
        '<label><span>Cidade</span>',
        `<input name="city" value="${escapeHTML(identity.city || "")}"></label>`,
        '<label><span>Estado</span>',
        `<input name="state" value="${escapeHTML(identity.state || "")}"></label>`,
        '<label><span>CEP</span>',
        `<input name="zip_code" value="${escapeHTML(identity.zip_code || "")}"></label>`,
        '<label class="is-wide"><span>Descrição da empresa</span>',
        `<textarea name="description">${escapeHTML(identity.description || "")}</textarea></label>`,
        '<label class="is-wide"><span>Especialidades</span>',
        `<textarea name="specialties" placeholder="Ex.: Painéis elétricos, termografia e motores.">${escapeHTML(identity.specialties || "")}</textarea></label>`,
        '<label class="is-wide"><span>Logo da empresa</span>',
        (isCompanyOperationalUser()
            ? '<small>A logo da empresa é definida pelo administrador e compartilhada automaticamente com a equipe.</small>'
            : '<input type="file" accept="image/*" data-company-logo><small>PNG ou JPG. A logo aparece como marca d\'água na tela inicial.</small>'),
        '<img data-company-logo-preview alt="Prévia da logo" hidden>',
        '</label>',
        (isCompanyOperationalUser()
            ? ''
            : '<label class="is-wide aurora-logo-transparency"><span>Transparência da logo na tela inicial</span><div class="aurora-logo-transparency__control"><input type="range" min="0" max="90" step="1" value="' + Math.max(0, Math.min(90, Number(identity.logo_transparency ?? 70))) + '" data-company-logo-transparency aria-label="Transparência da logo"><output data-company-logo-transparency-value>' + Math.max(0, Math.min(90, Number(identity.logo_transparency ?? 70))) + '%</output></div><small>Deslize para deixar a marca mais forte ou mais discreta.</small></label>'),
        (isCompanyOperationalUser()
            ? ''
            : '<label class="is-wide aurora-logo-transparency"><span>Tamanho da logo na capa dos relatórios</span><div class="aurora-logo-transparency__control"><input type="range" min="200" max="300" step="5" value="' + Math.max(200, Math.min(300, Number(identity.logo_report_scale ?? 200))) + '" data-company-logo-report-scale aria-label="Tamanho da logo nos relatórios"><output data-company-logo-report-scale-value>' + Math.max(200, Math.min(300, Number(identity.logo_report_scale ?? 200))) + '%</output></div><small>Ajuste entre 200% e 300% para todos os relatórios. O padrão inicial é 200%.</small></label>'),
        (isCompanyOperationalUser()
            ? ''
            : '<label class="is-wide aurora-logo-transparency"><span>Tamanho da foto de capa dos relatórios</span><div class="aurora-logo-transparency__control"><input type="range" min="150" max="250" step="5" value="' + Math.max(150, Math.min(250, Number(identity.cover_photo_report_scale ?? 150))) + '" data-company-cover-photo-report-scale aria-label="Tamanho da foto de capa nos relatórios"><output data-company-cover-photo-report-scale-value>' + Math.max(150, Math.min(250, Number(identity.cover_photo_report_scale ?? 150))) + '%</output></div><small>Ajuste entre 150% e 250%. O padrão inicial é 150% e o cabeçalho permanece protegido.</small></label>'),
        '</div>',
        '<div class="aurora-company-save-bar"><button type="submit">Salvar alterações</button></div>',
        '</form>',
        '</section>',
        '</div>'
    ].join("");

    /* USUÁRIO OPERACIONAL DE EMPRESA — todas as shapes:
       estes três recursos pertencem à administração da conta e não aparecem ao USER.
       O ADMIN mantém Minha empresa, Minha Equipe e os recursos administrativos aplicáveis. */
    function reconcileSettingsTeamVisibility() {
        const canManage = Boolean(
            global.AuroraCompanyAccess &&
            typeof global.AuroraCompanyAccess.canManageUsers === "function" &&
            global.AuroraCompanyAccess.canManageUsers()
        );

        /* V98 — se uma hidratação intermediária removeu o botão antes do claim
           COMPANY_ADMIN definitivo, recria pelo componente oficial Minha Equipe. */
        let teamButton = settings.querySelector("[data-settings-team]");
        if (canManage && !teamButton &&
            global.AuroraCompanyTeam &&
            typeof global.AuroraCompanyTeam.ensureNavButton === "function") {
            global.AuroraCompanyTeam.ensureNavButton();
            teamButton = settings.querySelector("[data-settings-team]");
        }
        if (!teamButton) return;

        teamButton.hidden = !canManage;
        teamButton.style.display = canManage ? "" : "none";
        teamButton.setAttribute("aria-hidden", canManage ? "false" : "true");
        if (canManage) teamButton.removeAttribute("hidden");
    }

    /* V96 — Minha Equipe depende do PAPEL, nunca da shape.
       O acesso corporativo pode terminar de hidratar depois do primeiro render.
       Reconciliar quando o claim ficar pronto evita esconder o card do ADMIN
       sem jamais expô-lo ao COMPANY_USER. */
    reconcileSettingsTeamVisibility();
    global.addEventListener("aurora:company-access-ready", reconcileSettingsTeamVisibility);

    if (isCompanyOperationalUser()) {
        [
            "[data-settings-identity]",
            "[data-settings-team]",
            /* V51: Trocar segmento permanece visível para todo COMPANY_USER.
               O switcher já filtra exclusivamente os ambientes concedidos pelo ADMIN. */
            "[data-edit-segment-services]",
            "[data-demo-info]"
        ].forEach(function (selector) {
            var node = settings.querySelector(selector);
            if (node && node.parentNode) node.parentNode.removeChild(node);
        });
    }

    /* V124 — o editor existente pertence aos segmentos com mais de um serviço configurável.
       Atividades Rotineiras Tupy permanece ambiente privado independente. */
    const activeLicenseForSettings = String(identity.active_license_module_code || identity.profile || "").trim();
    const editSegmentServicesButton = settings.querySelector("[data-edit-segment-services]");
    /* R42 — manter paridade online/offline do editor da Home Elétrica. */
    const hasExplicitOperationalServices = homeServicesAuthority.chosenAuthority === "explicit_operational_services";
    if (editSegmentServicesButton && (hasExplicitOperationalServices || activeLicenseForSettings === "vehicle_inspection" || servicesForProfile(identity.profile).length <= 1)) {
        editSegmentServicesButton.remove();
    }

    /* R11.17 — Minha empresa no COMPANY_USER é uma ficha corporativa herdada.
       Somente o nome profissional/responsável técnico pertence ao usuário. */
    if (isCompanyOperationalUser()) {
        var userCompanyForm = settings.querySelector("[data-identity-form]");
        if (userCompanyForm) {
            userCompanyForm.querySelectorAll("input[name], textarea[name]").forEach(function (control) {
                if (String(control.name || "") !== "professional") {
                    control.readOnly = true;
                    control.setAttribute("aria-readonly", "true");
                    control.classList.add("is-company-readonly");
                }
            });
            var userLogoInput = userCompanyForm.querySelector("[data-company-logo]");
            if (userLogoInput) userLogoInput.disabled = true;
            var saveButton = userCompanyForm.querySelector('button[type="submit"]');
            if (saveButton) saveButton.textContent = "Salvar responsável técnico";
        }
    }

    document.body.appendChild(
        settings
    );

    const companyModal =
        settings.querySelector(
            "[data-company-modal]"
        );

    if (companyModal) {
        document.body.appendChild(
            companyModal
        );
    }

    const queryCompany = (selector) =>
        companyModal
            ? companyModal.querySelector(selector)
            : null;

    let currentFilter =
        "all";

    let reportSelectionMode =
        false;

    const selectedReports =
        new Set();

    function findReportById(id) {
        return getReports().find(
            (report) => String(report.id) === String(id)
        ) || null;
    }

    async function openReportPreview(id, options = {}) {
        const feature = global.AuroraReportFeature;
        if (!(feature && feature.preview && typeof feature.preview.open === "function")) {
            showStatus("Prévia do relatório indisponível.", 2400);
            return;
        }

        /* V47 R14 — a fachada oficial pode receber um projeto cloud.
         * Ela restaura/materializa primeiro e só então entrega ao mesmo
         * AuroraReportFeature.preview.open() já existente. */
        const requestedProjectId = String(options && options.projectId || "").trim();
        if (requestedProjectId) {
            const cloud = global.AuroraCloudSync;
            if (!(cloud && typeof cloud.restoreCompanyProjectForAdmin === "function")) {
                throw new Error("Restauração empresarial indisponível.");
            }
            const restored = await cloud.restoreCompanyProjectForAdmin(requestedProjectId, {
                suppressNavigation: true,
                openIntent: "report_preview"
            });
            const restoredCaseId = String(restored && restored.caseData && restored.caseData.id || "");
            const materialized = getReports().find((item) =>
                String((item.snapshot && item.snapshot.id) || item.case_id || item.id || "") === restoredCaseId
            );
            if (!materialized) {
                throw new Error("Relatório restaurado, mas a prévia local não foi encontrada.");
            }
            id = String(materialized.id || "");
        }
        /* V32 — toda abertura de relatório local que possui vínculo cloud tenta
           reidratar as fotos com a sessão empresarial autenticada antes da prévia.
           Falha de rede/permissão não apaga nem altera o relatório textual. */
        try {
            const reports = getReports();
            const index = reports.findIndex((item) => String(item && item.id || "") === String(id));
            const report = index >= 0 ? reports[index] : null;
            const snapshot = report && report.snapshot;
            const cloud = global.AuroraCloudSync;
            const status = snapshot && cloud && typeof cloud.getSyncStatus === "function" ? cloud.getSyncStatus(snapshot) : null;
            const projectId = status && status.link && status.link.project_id;
            if (snapshot && projectId && cloud && typeof cloud.hydrateAuthorizedProjectEvidence === "function") {
                const hydrated = await cloud.hydrateAuthorizedProjectEvidence(snapshot, projectId);
                reports[index] = { ...report, snapshot: hydrated };
                saveReports(reports);
            }
        } catch (error) {
            console.warn("[V32] Fotos autenticadas não puderam ser reidratadas antes da prévia.", error);
        }
        try {
            const reports = getReports();
            const index = reports.findIndex((item) => String(item && item.id || "") === String(id));
            const report = index >= 0 ? reports[index] : null;
            const sid = String(report && ((report.snapshot && report.snapshot.service && report.snapshot.service.id) || report.service_id || (report.service && report.service.id)) || "").toLowerCase();
            if (report && sid === "grounding_equipotentialization" && global.AuroraGroundingShape && typeof global.AuroraGroundingShape.hydrateReportEvidence === "function") {
                const hydrated = await global.AuroraGroundingShape.hydrateReportEvidence(report);
                if (hydrated && feature.engine && typeof feature.engine.save === "function") feature.engine.save(hydrated);
            }
        } catch (error) { console.warn("[GROUNDING] Fotos locais não puderam ser reidratadas antes da prévia.", error); }
        feature.preview.open(String(id));
    }

    function editReportDirect(id) {
        const report = findReportById(id);
        const reportService = report && (
            (report.snapshot && report.snapshot.service && report.snapshot.service.id) ||
            (report.service && report.service.id) ||
            report.service_id || ""
        );
        if (String(reportService).toLowerCase() === "eletrica_tupy" &&
            !canEnterEletricaTupyOperationalFlow() &&
            !canExplicitlyOpenEletricaTupyOffline()) {
            denyEletricaTupyOperationalAccess();
            return;
        }
        if (!report) {
            showStatus("Atendimento não encontrado.", 2200);
            return;
        }
        window.dispatchEvent(
            new CustomEvent("aurora:edit-report", { detail: { report } })
        );
    }

    async function removeReportEvidence(report) {
        if (!global.EvidenceStore || !report) return;
        const evidenceStore = new global.EvidenceStore();
        const snapshot = report.snapshot || {};
        const groups = Array.isArray(snapshot.evidence_groups)
            ? snapshot.evidence_groups
            : [];

        if (groups.length) {
            for (const group of groups) {
                if (group && group.id) {
                    await evidenceStore.remove(String(group.id));
                }
            }
            return;
        }

        const caseId = snapshot.id || report.case_id;
        if (caseId && typeof evidenceStore.clearCase === "function") {
            await evidenceStore.clearCase(String(caseId));
        }
    }

    async function deleteReportDirect(id) {
        const report = findReportById(id);
        if (!report) return;
        if (!await global.AuroraDialog.confirm("O atendimento e suas fotos serão excluídos definitivamente.", { title: "Excluir atendimento?", confirmLabel: "Excluir", tone: "danger" })) return;

        var passwordOk = true;
        if (
            global.AuroraEletricaTupy &&
            typeof global.AuroraEletricaTupy.confirmAccountPassword === "function"
        ) {
            passwordOk = await global.AuroraEletricaTupy.confirmAccountPassword({
                title: "Excluir atendimento?",
                message: "Esta exclusão é permanente. Confirme com a senha da sua conta."
            });
        }
        if (!passwordOk) return;

        try {
            await removeReportEvidence(report);
        } catch (error) {
            console.warn("Não foi possível limpar todas as evidências do atendimento.", error);
        }

        saveReports(getReports().filter((item) => String(item.id) !== String(id)));
        if (global.AuroraReportFeature && global.AuroraReportFeature.engine) {
            global.AuroraReportFeature.engine.runtimeReports.delete(String(id));
        }

        const savedEnvelope = repository.load();
        const savedCaseId = savedEnvelope && savedEnvelope.case
            ? String(savedEnvelope.case.id || "")
            : "";
        const reportCaseId = String((report.snapshot && report.snapshot.id) || report.case_id || "");
        if (savedCaseId && (savedCaseId === reportCaseId || savedCaseId === String(id))) {
            repository.clear();
        }

        renderReports();
        syncHomeReports();
        showStatus("Atendimento excluído.");
    }

    function bindRecentActions() {
        homeLayer.querySelectorAll("[data-recent-open]").forEach((button) => {
            button.onclick = () => {
                const report = findReportById(button.dataset.recentOpen);
                if (report && report.status !== "Concluído") {
                    editReportDirect(button.dataset.recentOpen);
                    return;
                }
                openReportPreview(button.dataset.recentOpen);
            };
        });
        homeLayer.querySelectorAll("[data-recent-edit]").forEach((button) => {
            button.onclick = () => editReportDirect(button.dataset.recentEdit);
        });
        homeLayer.querySelectorAll("[data-recent-delete]").forEach((button) => {
            button.onclick = () => deleteReportDirect(button.dataset.recentDelete);
        });
        homeLayer.querySelectorAll("[data-recent-cloud]").forEach((button) => {
            button.onclick = async () => {
                const id = button.dataset.recentCloud;
                const report = findReportById(id);
                const api = global.AuroraCloudSync;
                if (!report || !report.snapshot || !api || typeof api.syncReport !== "function") {
                    showStatus("A sincronização ainda não está disponível.", 2600);
                    return;
                }
                const currentState = button.dataset.cloudState;
                const action = currentState === "update" ? "Atualizar" : "Salvar";
                if (!await global.AuroraDialog.confirm(`Os dados deste atendimento serão ${action === "Atualizar" ? "atualizados" : "salvos"} na nuvem. Fotos e PDFs permanecem neste aparelho.`, { title: `${action} na nuvem?`, confirmLabel: action })) return;
                recentCloudTransient.set(String(id), "syncing");
                syncHomeReports();
                try {
                    const cloudData = Object.assign({}, report.snapshot, {
                        status: report.status || report.snapshot.status
                    });
                    await api.syncReport(cloudData);
                    recentCloudTransient.delete(String(id));
                    syncHomeReports();
                    showStatus(currentState === "update" ? "Atendimento atualizado na nuvem." : "Atendimento salvo na nuvem.", 2800);
                } catch (error) {
                    console.error(error);
                    recentCloudTransient.set(String(id), "error");
                    syncHomeReports();
                    showStatus("Não foi possível sincronizar. Toque novamente para tentar.", 3400);
                }
            };
        });
    }

    function updateReportSelectionUI() {
        const selectButton =
            reportsLayer.querySelector(
                "[data-report-select-mode]"
            );

        const deleteButton =
            reportsLayer.querySelector(
                "[data-report-delete-selected]"
            );

        const summary =
            reportsLayer.querySelector(
                "[data-report-selection-summary]"
            );

        selectButton.textContent =
            reportSelectionMode
                ? "Cancelar seleção"
                : "Selecionar";

        deleteButton.hidden =
            !reportSelectionMode ||
            selectedReports.size === 0;

        deleteButton.textContent =
            `Excluir (${selectedReports.size})`;

        summary.hidden =
            !reportSelectionMode;

        summary.textContent =
            `${selectedReports.size} relatório${selectedReports.size === 1 ? "" : "s"} selecionado${selectedReports.size === 1 ? "" : "s"}`;
    }

    function renderReports() {
        const reports =
            reportsForProfile(
                getReports(),
                identity.profile
            );

        const query =
            String(
                reportsLayer
                    .querySelector(
                        "[data-report-search]"
                    )
                    .value ||
                ""
            )
                .trim()
                .toLowerCase();

        const filtered =
            reports.filter(
                (report) => {
                    const matchesFilter =
                        currentFilter === "all" ||
                        report.status === currentFilter ||
                        (currentFilter === "Em andamento" && report.status === "Rascunho");

                    const tupy = reportTupyState(report);
                    const haystack =
                        [
                            reportCustomerName(report),
                            reportServiceTitle(report),
                            report.public_id,
                            report.id,
                            tupy && tupy.servico && tupy.servico.titulo,
                            tupy && tupy.servico && tupy.servico.solicitante,
                            tupy && tupy.servico && tupy.servico.budget_number,
                            tupy && tupy.servico && tupy.servico.setor
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();

                    return (
                        matchesFilter &&
                        haystack.includes(
                            query
                        )
                    );
                }
            );

        const list =
            reportsLayer.querySelector(
                "[data-report-list]"
            );

        if (!filtered.length) {
            list.innerHTML = [
                '<section class="aurora-report-empty">',
                '<span>▤</span>',
                '<h3>Nenhum relatório encontrado</h3>',
                '<p>Altere a pesquisa ou finalize uma inspeção.</p>',
                '</section>'
            ].join("");

            updateReportSelectionUI();
            return;
        }

        list.innerHTML =
            filtered.map(
                (report) => [
                    '<article class="aurora-report-card',
                    selectedReports.has(String(report.id)) ? ' is-selected' : '',
                    '">',
                    reportSelectionMode
                        ? `<label class="aurora-report-card__check"><input type="checkbox" data-report-select="${escapeHTML(report.id)}" ${selectedReports.has(String(report.id)) ? "checked" : ""}><span></span></label>`
                        : '<div class="aurora-report-card__icon">▤</div>',
                    '<div class="aurora-report-card__content">',
                    `<span>${escapeHTML(reportDisplayId(report))}</span>`,
                    `<h3>${escapeHTML(reportCustomerName(report))}</h3>`,
                    `<p>${escapeHTML(reportServiceTitle(report))} · ${formatDate(report.updated_at || report.created_at)}</p>`,
                    '</div>',
                    `<b class="${report.status === "Concluído" ? "is-done" : "is-open"}">${escapeHTML(report.status)}</b>`,
                    reportSelectionMode
                        ? ''
                        : `<button type="button" data-report-preview="${escapeHTML(report.id)}">Abrir</button>`,
                    '</article>'
                ].join("")
            ).join("");

        list
            .querySelectorAll(
                "[data-report-select]"
            )
            .forEach(
                (checkbox) => {
                    checkbox.addEventListener(
                        "change",
                        () => {
                            const id =
                                String(
                                    checkbox.dataset.reportSelect
                                );

                            if (checkbox.checked) {
                                selectedReports.add(id);
                            } else {
                                selectedReports.delete(id);
                            }

                            renderReports();
                        }
                    );
                }
            );

        list
            .querySelectorAll(
                "[data-report-preview]"
            )
            .forEach(
                (button) => {
                    button.addEventListener(
                        "click",
                        () => {
                            const feature =
                                global.AuroraReportFeature;

                            if (
                                feature &&
                                feature.preview &&
                                typeof feature.preview.open ===
                                    "function"
                            ) {
                                feature.preview.open(
                                    button.dataset.reportPreview
                                );
                                return;
                            }

                            showStatus(
                                "Prévia do relatório indisponível.",
                                2400
                            );
                        }
                    );
                }
            );

        updateReportSelectionUI();
    }

    function setLayerVisibility(
        layer,
        visible
    ) {
        layer.hidden =
            !visible;

        layer.style.display =
            visible
                ? ""
                : "none";
    }

    function syncHomeReports() {
        const moduleReports = reportsForProfile(
            getReports(),
            identity.profile
        );

        const openCount = moduleReports.filter(
            (item) => item.status !== "Concluído"
        ).length;

        const completedCount = moduleReports.filter(
            (item) => item.status === "Concluído"
        ).length;

        const metrics = homeLayer.querySelectorAll(
            ".aurora-dashboard-metrics article strong"
        );

        if (metrics[0]) metrics[0].textContent = String(openCount);
        if (metrics[1]) metrics[1].textContent = String(completedCount);

        const recentList = homeLayer.querySelector(
            ".aurora-recent-list"
        );

        if (!recentList) return;

        /* HOME ADMIN usa a lista corporativa já filtrada pelo módulo atual.
         * Nunca sobrescrever essa visão com reports locais/restaurados, pois
         * isso mistura shapes diferentes em Atendimentos recentes. */
        if (isGenericCompanyAdminHome ||
            recentList.hasAttribute("data-aet-home-recent-admin") ||
            recentList.classList.contains("aet-home-recent-admin")) {
            return;
        }

        const isGroundingRecent = String(identity.profile || "").toLowerCase() === "grounding_equipotentialization";
        const shouldPreferCanonicalGrounding = isGroundingRecent &&
            typeof navigator !== "undefined" && navigator.onLine !== false;

        /* V47 — online, Grounding possui uma única autoridade visual para Recentes:
         * a lista canônica empresarial. Não renderizamos LOCAL antes do CLOUD,
         * evitando LOCAL→CLOUD→LOCAL e o piscar/reordenar observado no celular.
         * Offline continua usando a lista local já disponível. */
        if (!shouldPreferCanonicalGrounding) recentList.innerHTML = moduleReports
            .slice(0, 3)
            .map((report) => [
                '<article class="aurora-recent-card" data-report-id="',
                escapeHTML(report.id),
                '">',
                `<button type="button" class="aurora-recent-card__main" data-recent-open="${escapeHTML(report.id)}" aria-label="Abrir relatório">`,
                '<span class="aurora-recent-card__icon">▤</span>',
                '<span>',
                `<strong>${escapeHTML(reportCustomerName(report))}</strong>`,
                `<small>${escapeHTML(reportServiceTitle(report))} · ${formatDate(report.updated_at || report.created_at)}</small>`,
                '</span>',
                `<b class="${report.status === "Concluído" ? "is-done" : "is-open"}">${escapeHTML(report.status)}</b>`,
                '</button>',
                recentActionsMarkup(report),
                '</article>'
            ].join(""))
            .join("");

        if (!shouldPreferCanonicalGrounding) bindRecentActions();

        /* V37 — Grounding passa a reutilizar a MESMA fonte canônica empresarial
         * já usada por Atividades Rotineiras: aurora_projects via
         * AuroraCompanyAccess. O relatório local GND-RECOVER continua existindo
         * apenas como recuperação histórica; ele não é mais a autoridade para
         * Atendimentos recentes, updated_at ou reabertura/edição. */
        if (isGroundingRecent) {
            requestGroundingRecentCanonical(recentList);
        }
    }

    global.addEventListener("aurora:draft-updated", () => {
        try { syncHomeReports(); } catch (_) {}
    });

    let groundingRecentRequest = null;
    let groundingRecentRequestHost = null;
    function requestGroundingRecentCanonical(host) {
        if (!host || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
        if (groundingRecentRequest && groundingRecentRequestHost === host) return;
        groundingRecentRequestHost = host;
        groundingRecentRequest = refreshGroundingRecentFromCanonicalCloud(host)
            .catch((error) => console.warn("[GROUNDING V47 canonical recent]", error))
            .finally(() => {
                groundingRecentRequest = null;
                groundingRecentRequestHost = null;
            });
    }

    async function refreshGroundingRecentFromCanonicalCloud(host) {
        if (!host) return;
        const access = global.AuroraCompanyAccess;
        const cloud = global.AuroraCloudSync;
        const client = cloud && cloud.client ? cloud.client : global.AURORA_SUPABASE_CLIENT;
        if (!access || typeof access.listMyCompanyProjectSummaries !== "function" || !client) return;

        const all = await access.listMyCompanyProjectSummaries(client);
        const rows = (Array.isArray(all) ? all : []).filter((row) => {
            const profile = String(row && row.service_profile || "").toLowerCase();
            const type = String(row && row.service_type || "").toLowerCase();
            return profile === "grounding_equipotentialization" || type === "grounding_equipotentialization";
        }).sort((a,b) => Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0));

        if (!rows.length) return;
        const recent = rows.slice(0,3);
        /* R03 — o canônico usa o MESMO card Aurora aprovado. Não existe mais
         * um segundo markup simplificado que substitui o card após o refresh. */
        host.innerHTML = recent.map((row) => [
            `<article class="aurora-recent-card" data-grounding-cloud-project="${escapeHTML(row.id)}">`,
            `<button type="button" class="aurora-recent-card__main" data-grounding-cloud-open="${escapeHTML(row.id)}" aria-label="Abrir relatório">`,
            '<span class="aurora-recent-card__icon">▤</span><span>',
            `<strong>${escapeHTML(row.title || "Atendimento")}</strong>`,
            `<small>${escapeHTML(auroraServiceLabel(row.service_type, "Aterramento e Equipotencialização"))} · ${formatDate(row.updated_at || row.created_at)}</small>`,
            '</span>',
            `<b class="${String(row.status || "") === "completed" ? "is-done" : "is-open"}">${String(row.status || "") === "completed" ? "Concluído" : "Em andamento"}</b>`,
            '</button><div class="aurora-recent-card__actions">',
            `<button type="button" class="aurora-recent-action" data-grounding-cloud-edit="${escapeHTML(row.id)}" aria-label="Editar atendimento" title="Editar atendimento">${auroraIcons.edit}</button>`,
            `<button type="button" class="aurora-recent-cloud is-synced" disabled aria-label="Atendimento sincronizado" title="Atendimento sincronizado">${auroraIcons.cloudCheck}<span>Na nuvem</span></button>`,
            `<button type="button" class="aurora-recent-action is-danger" data-grounding-cloud-delete="${escapeHTML(row.id)}" aria-label="Excluir atendimento" title="Excluir atendimento">${auroraIcons.trash}</button>`,
            '</div></article>'
        ].join('')).join('');

        async function restore(projectId, edit) {
            if (!cloud || typeof cloud.restoreCompanyProjectForAdmin !== "function") {
                showStatus("Abertura empresarial indisponível.", 2600); return;
            }
            try {
                const result = await cloud.restoreCompanyProjectForAdmin(projectId);
                const caseId = result && result.caseData && result.caseData.id;
                const reportEngine = global.AuroraReportFeature && global.AuroraReportFeature.engine;
                const local = getReports().find((item) => String((item.snapshot && item.snapshot.id) || item.case_id || item.id || "") === String(caseId || ""))
                    || (reportEngine && typeof reportEngine.get === "function" ? reportEngine.get(caseId) : null);
                if (!local) { showStatus("Relatório restaurado, mas a prévia local não foi encontrada.", 3000); return; }
                if (edit) window.dispatchEvent(new CustomEvent("aurora:edit-report", { detail: { report: local } }));
                else openReportPreview(local.id);
            } catch (error) {
                console.error("[GROUNDING V37 restore canonical]", error);
                showStatus(String(error && error.message || "Não foi possível abrir o atendimento."), 3600);
            }
        }
        host.querySelectorAll('[data-grounding-cloud-open]').forEach((b) => b.onclick = () => restore(b.dataset.groundingCloudOpen, false));
        host.querySelectorAll('[data-grounding-cloud-edit]').forEach((b) => b.onclick = () => restore(b.dataset.groundingCloudEdit, true));
        host.querySelectorAll('[data-grounding-cloud-delete]').forEach((b) => b.onclick = async () => {
            const projectId=b.dataset.groundingCloudDelete;
            if(!projectId||!cloud||typeof cloud.deleteCloudProject!=="function"){showStatus("Exclusão na nuvem indisponível.",2600);return;}
            if(!await global.AuroraDialog.confirm("O atendimento e suas fotos serão excluídos definitivamente.",{title:"Excluir atendimento?",confirmLabel:"Excluir",tone:"danger"}))return;
            let passwordOk=true;
            if(global.AuroraEletricaTupy&&typeof global.AuroraEletricaTupy.confirmAccountPassword==="function")passwordOk=await global.AuroraEletricaTupy.confirmAccountPassword({title:"Excluir atendimento?",message:"Esta exclusão é permanente. Confirme com a senha da sua conta."});
            if(!passwordOk)return;
            try{await cloud.deleteCloudProject(projectId);showStatus("Atendimento excluído.",2400);await refreshGroundingRecentFromCanonicalCloud(host);}
            catch(error){console.error("[GROUNDING R03 DELETE]",error);showStatus(String(error&&error.message||"Não foi possível excluir o atendimento."),3400);}
        });
    }

    let activeAuroraView = "home";

    function isAdminReviewCase(caseData) {
        return !!(caseData && caseData.admin_review === true);
    }

    function persistRuntimeCaseIfAllowed(caseData) {
        const data =
            caseData ||
            (typeof runtime.getCase === "function"
                ? runtime.getCase()
                : null);
        if (isAdminReviewCase(data)) {
            return false;
        }
        repository.save(data);
        return true;
    }

    async function showHome() {
        const hr = global.AuroraHomeReturnTrace;
        const homeMeta = hr
            ? hr.consumeNextHomeOrigin()
            : { origin: "UNKNOWN", reason: "" };

        if (hr) {
            hr.setActiveAuroraView("home");
        }

        if (hr) {
            const runtimeCase = hr.runtimeCaseSnapshot();
            const repoCase = hr.repositoryCaseSnapshot();

            hr.logHR6({
                origin: homeMeta.origin,
                reason: homeMeta.reason || undefined,
                activeAuroraView: activeAuroraView,
                currentIndex: runtimeCase.index,
                caseId: runtimeCase.id,
                runtimeCase: runtimeCase.exists ? "SIM" : "NAO",
                repositoryCase: repoCase.exists ? "SIM" : "NAO",
                historyState: hr.summarizeHistoryState(history.state),
                stack: hr.shortStack(2)
            });
        }

        activeAuroraView = "home";
        /*
         * CLOUD_RESTORE: resetCase já gravou o atendimento restaurado e o módulo
         * customer ainda pode estar montado com valores do case anterior (stale).
         * saveCurrent() faria merge desse formulário sobre o case recém-restaurado.
         */
        const skipStaleModuleSave =
            homeMeta.origin === "CLOUD_RESTORE";

        if (!isAdminReviewCase(runtime.getCase())) {
            if (!skipStaleModuleSave) {
                try { await runtime.saveCurrent({ validate:false }); }
                catch (error) {
                    if (String(identity.profile||"").toLowerCase() !== "grounding_equipotentialization") throw error;
                    console.warn("[GROUNDING R03 HOME SAVE]", error);
                }
            }
            persistRuntimeCaseIfAllowed();
        }

        syncHomeReports();

        setLayerVisibility(
            homeLayer,
            true
        );
        setLayerVisibility(
            reportsLayer,
            false
        );
        setLayerVisibility(
            gestaoLayer,
            false
        );
        setLayerVisibility(
            workflowLayer,
            false
        );

        dock.hidden = true;
        dock.classList.remove(
            "is-visible"
        );

        shell.setFooterActive(
            "home"
        );

        if (hr) {
            const runtimeCase = hr.runtimeCaseSnapshot();
            const repoCase = hr.repositoryCaseSnapshot();

            hr.logHR8({
                origin: homeMeta.origin,
                reason: homeMeta.reason || undefined,
                currentIndex: runtimeCase.index,
                runtimeCaseId: runtimeCase.id,
                repositoryCaseId: repoCase.id,
                runtimeCase: runtimeCase.exists ? "SIM" : "NAO",
                repositoryCase: repoCase.exists ? "SIM" : "NAO",
                homeOpenCount: hr.getHomeOpenCount(),
                homeOpenCountNote: "aurora_reports"
            });
        }

    }

    async function showReports() {
        activeAuroraView = "reports";
        if (global.AuroraHomeReturnTrace) {
            global.AuroraHomeReturnTrace.setActiveAuroraView("reports");
        }
        if (!isAdminReviewCase(runtime.getCase())) {
            try { await runtime.saveCurrent({ validate:false }); }
            catch (error) {
                if (String(identity.profile||"").toLowerCase() !== "grounding_equipotentialization") throw error;
                console.warn("[GROUNDING R03 REPORTS SAVE]", error);
            }
            persistRuntimeCaseIfAllowed();
        }

        setLayerVisibility(
            homeLayer,
            false
        );
        setLayerVisibility(
            reportsLayer,
            true
        );
        setLayerVisibility(
            gestaoLayer,
            false
        );
        setLayerVisibility(
            workflowLayer,
            false
        );

        dock.hidden = true;
        dock.classList.remove(
            "is-visible"
        );

        shell.setFooterActive(
            "reports"
        );

        renderReports();

    }

    async function showGestaoEletricaTupy() {
        if (!canManageEletricaTupyUi()) {
            if (typeof showStatus === "function") {
                showStatus("Gestão Elétrica Tupy não disponível para esta conta.");
            }
            await showHome();
            return;
        }

        activeAuroraView = "aet_gestao";
        if (global.AuroraHomeReturnTrace) {
            global.AuroraHomeReturnTrace.setActiveAuroraView("aet_gestao");
        }
        if (!isAdminReviewCase(runtime.getCase())) {
            await runtime.saveCurrent({
                validate: false
            });
            persistRuntimeCaseIfAllowed();
        }

        const body = gestaoLayer.querySelector("[data-aet-gestao-body]");
        if (body) {
            const api = global.AuroraEletricaTupy;
            body.innerHTML = (api && typeof api.renderGestaoStub === "function")
                ? api.renderGestaoStub()
                : '<section class="aet-card"><p class="aet-hint">Gestão indisponível.</p></section>';
            const activitiesHost = body.querySelector("[data-aet-company-activities]");
            if (activitiesHost && api && typeof api.loadCompanyActivitiesInto === "function") {
                api.loadCompanyActivitiesInto(activitiesHost).catch((error) => {
                    console.error("[Gestão Elétrica Tupy]", error);
                    activitiesHost.innerHTML =
                        '<p class="aet-hint aet-hint--error">Não foi possível carregar os atendimentos da equipe.</p>';
                });
            }
        }

        setLayerVisibility(homeLayer, false);
        setLayerVisibility(reportsLayer, false);
        setLayerVisibility(gestaoLayer, true);
        setLayerVisibility(workflowLayer, false);

        dock.hidden = true;
        dock.classList.remove("is-visible");
        shell.setFooterActive("home");
    }

    function showWorkflow() {
        activeAuroraView = "workflow";
        if (global.AuroraHomeReturnTrace) {
            global.AuroraHomeReturnTrace.setActiveAuroraView("workflow");
        }
        setLayerVisibility(
            homeLayer,
            false
        );
        setLayerVisibility(
            reportsLayer,
            false
        );
        setLayerVisibility(
            gestaoLayer,
            false
        );
        setLayerVisibility(
            workflowLayer,
            true
        );

        dock.hidden = false;
        dock.classList.add(
            "is-visible"
        );

    }

    let nativeBackBusy = false;

    function syncProfileModalLock() {
        const companyOpen =
            companyModal &&
            !companyModal.hidden;
        const settingsOpen =
            settings.classList.contains(
                "is-open"
            );
        const lock =
            settingsOpen ||
            companyOpen;

        document.body.classList.toggle(
            "aurora-modal-scroll-lock",
            lock
        );
        document.body.classList.toggle(
            "aurora-profile-layer-open",
            lock
        );
        document.body.classList.toggle(
            "aurora-company-layer-open",
            companyOpen
        );

        if (companyModal) {
            companyModal.classList.toggle(
                "is-open",
                companyOpen
            );
        }

        const shellRoot =
            document.querySelector(
                ".aurora-shell"
            );

        if (shellRoot) {
            shellRoot.classList.toggle(
                "aurora-shell--modal-blocked",
                lock
            );
        }
    }
    const identityForm =
        queryCompany(
            "[data-identity-form]"
        );
    const companyCorporateFields = [
        "company", "tagline", "document", "registration", "phone", "whatsapp",
        "email", "website", "address", "city", "state", "zip_code",
        "description", "specialties", "logo_report_scale", "cover_photo_report_scale"
    ];

    function applyCorporateIdentity(companyIdentity) {
        if (!companyIdentity) return;
        companyCorporateFields.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(companyIdentity, field)) {
                identity[field] = String(companyIdentity[field] || "");
            }
        });
        if (companyIdentity.name) identity.company = String(companyIdentity.name);
        if (Object.prototype.hasOwnProperty.call(companyIdentity, "logo")) identity.logo = String(companyIdentity.logo || "");
        if (Object.prototype.hasOwnProperty.call(companyIdentity, "logo_transparency")) {
            const raw = Number(companyIdentity.logo_transparency ?? 0.70);
            identity.logo_transparency = raw <= 1 ? raw * 100 : raw;
        }
        if (Object.prototype.hasOwnProperty.call(companyIdentity, "logo_report_scale")) {
            identity.logo_report_scale = Math.max(200, Math.min(300, Number(companyIdentity.logo_report_scale) || 200));
        }
        if (Object.prototype.hasOwnProperty.call(companyIdentity, "cover_photo_report_scale")) {
            identity.cover_photo_report_scale = Math.max(150, Math.min(250, Number(companyIdentity.cover_photo_report_scale) || 150));
        }
        saveIdentity(identity);
        if (identityForm) {
            companyCorporateFields.forEach((field) => {
                const control = identityForm.querySelector(`[name="${field}"]`);
                if (control) control.value = String(identity[field] || "");
            });
            const professional = identityForm.querySelector('[name="professional"]');
            if (professional) professional.value = String(identity.professional || "");
            const preview = identityForm.querySelector('[data-company-logo-preview]');
            if (preview) {
                if (identity.logo) { preview.src = identity.logo; preview.hidden = false; }
                else { preview.removeAttribute("src"); preview.hidden = true; }
            }
        }
    }

    async function hydrateCorporateIdentityForSettings() {
        if (!global.AuroraCloudSync || typeof global.AuroraCloudSync.getCompanyIdentity !== "function") return;
        let companyIdentity = await global.AuroraCloudSync.getCompanyIdentity();
        if (!companyIdentity || !companyIdentity.company_id) return;
        const canManage = global.AuroraCompanyAccess &&
            typeof global.AuroraCompanyAccess.canManageUsers === "function" &&
            global.AuroraCompanyAccess.canManageUsers();
        if (canManage && companyIdentity.has_corporate_identity !== true &&
            typeof global.AuroraCloudSync.updateCompanyCorporateIdentity === "function") {
            await global.AuroraCloudSync.updateCompanyCorporateIdentity(identity);
            companyIdentity = await global.AuroraCloudSync.getCompanyIdentity();
        }
        applyCorporateIdentity(companyIdentity);
    }

    let identityFormBaseline = "";
    let identityFormDirty = false;
    let pendingCompanyLogo = Promise.resolve();
    let companyLogoPickerGuard = false;
    let companyLogoPickerGuardTimer = 0;

    function armCompanyLogoPickerGuard() {
        companyLogoPickerGuard = true;
        global.clearTimeout(companyLogoPickerGuardTimer);
    }

    function releaseCompanyLogoPickerGuard() {
        global.clearTimeout(companyLogoPickerGuardTimer);
        companyLogoPickerGuardTimer = global.setTimeout(() => {
            companyLogoPickerGuard = false;
        }, 700);
    }

    function isFinalReportShareActive() {
        const preview = global.auroraReportPreview;
        return Boolean(
            preview &&
            (preview._htmlShareClickGuard || preview._pdfShareClickGuard)
        );
    }

    if (!global.__auroraAutoSyncHomeRefreshBound) {
        global.__auroraAutoSyncHomeRefreshBound = true;
        global.addEventListener("aurora:auto-sync-complete", (event) => {
            /* FIX5 — o upload já foi confirmado pelo cloud_sync. Marcar o relatório
             * correspondente como sincronizado antes de reconstruir a Home evita
             * manter visualmente "Atualizar" após um auto-sync bem-sucedido. */
            const caseId = event && event.detail && event.detail.case_id
                ? String(event.detail.case_id)
                : "";
            if (caseId) {
                const syncedReport = getReports().find((report) =>
                    String(report && report.id || "") === caseId ||
                    String(report && report.snapshot && report.snapshot.id || "") === caseId
                );
                if (syncedReport && syncedReport.id) {
                    recentCloudTransient.set(String(syncedReport.id), "synced");
                }
            }
            const runtime = global.auroraRuntime;
            const currentShell = runtime && runtime.shell;
            if (currentShell && typeof currentShell.showHome === "function") {
                currentShell.showHome();
            }
        });
    }

    function closeFinalReportAndReturnHome() {
        const preview = global.auroraReportPreview;

        if (isFinalReportShareActive()) {
            return true;
        }

        if (
            preview &&
            typeof preview.closeAndReturnHome === "function"
        ) {
            preview.closeAndReturnHome();
            return true;
        }

        const openPreview = document.querySelector(
            ".aurora-report-preview.is-open"
        );

        if (!openPreview) {
            return false;
        }

        const closeButton = openPreview.querySelector("[data-report-close]");

        if (closeButton) {
            closeButton.click();
        }

        return true;
    }

    function serializeIdentityForm(form) {
        const data = {};

        if (!form) {
            return data;
        }

        for (const [key, value] of new FormData(form).entries()) {
            if (value instanceof File) {
                continue;
            }

            const next = String(value);

            if (Object.prototype.hasOwnProperty.call(data, key)) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(next);
            } else {
                data[key] = next;
            }
        }

        return data;
    }

    function captureIdentitySnapshot() {
        return JSON.stringify({
            form: serializeIdentityForm(identityForm),
            logo: identity.logo || "",
            logo_transparency: Number(
                identity.logo_transparency ?? 70
            ),
            logo_report_scale: Number(identity.logo_report_scale ?? 200),
            cover_photo_report_scale: Number(identity.cover_photo_report_scale ?? 150)
        });
    }

    function captureIdentityBaseline() {
        if (!identityForm) {
            identityFormBaseline = "";
            identityFormDirty = false;
            return;
        }

        identityFormBaseline =
            captureIdentitySnapshot();
        identityFormDirty = false;
        identityForm.classList.remove(
            "is-dirty"
        );
    }

    function markIdentityDirty() {
        if (!identityForm) {
            return;
        }

        identityFormDirty =
            captureIdentitySnapshot() !==
            identityFormBaseline;
        identityForm.classList.toggle(
            "is-dirty",
            identityFormDirty
        );
    }

    async function persistIdentityForm(options = {}) {
        if (!identityForm) {
            return {
                ok: true,
                local: true,
                cloud: true,
                message: ""
            };
        }

        await pendingCompanyLogo;

        if (
            !identityFormDirty &&
            !options.force
        ) {
            return {
                ok: true,
                local: true,
                cloud: true,
                message: ""
            };
        }

        const formData = new FormData(
            identityForm
        );

        const reportLogoScaleControl = identityForm.querySelector("[data-company-logo-report-scale]");
        if (reportLogoScaleControl) identity.logo_report_scale = Math.max(200, Math.min(300, Number(reportLogoScaleControl.value) || 200));
        const reportCoverPhotoScaleControl = identityForm.querySelector("[data-company-cover-photo-report-scale]");
        if (reportCoverPhotoScaleControl) identity.cover_photo_report_scale = Math.max(150, Math.min(250, Number(reportCoverPhotoScaleControl.value) || 150));

        /* R11.17 — COMPANY_USER não altera identidade corporativa.
           Persiste apenas seu nome profissional/responsável técnico. */
        if (isCompanyOperationalUser()) {
            const professional = String(formData.get("professional") || "").trim();
            if (professional) identity.professional = professional;
            const localSaved = saveIdentity(identity);
            if (!localSaved) {
                const message = "Não foi possível salvar o responsável técnico neste aparelho.";
                if (!options.silent) showStatus(message, 3200);
                return { ok: false, local: false, cloud: false, message };
            }
            let cloudSynced = true;
            let cloudMessage = "";
            try {
                if (global.AuroraCloudSync && typeof global.AuroraCloudSync.updateProfessionalName === "function") {
                    await global.AuroraCloudSync.updateProfessionalName(identity.professional);
                }
            } catch (error) {
                cloudSynced = false;
                cloudMessage = error && error.message ? error.message : String(error || "");
            }
            shell.updateUser(identity.professional || resolveLoggedInUserFullName() || "Usuário");
            captureIdentityBaseline();
            if (!options.silent) {
                showStatus(cloudSynced ? "Responsável técnico salvo." : `${cloudMessage} O nome ficou salvo neste aparelho.`, cloudSynced ? 2200 : 3200);
            }
            return { ok: true, local: true, cloud: cloudSynced, message: cloudMessage };
        }

        const fields = [
            "company",
            "professional",
            "document",
            "registration",
            "phone",
            "whatsapp",
            "email",
            "website",
            "address",
            "city",
            "state",
            "zip_code",
            "description",
            "specialties",
            "tagline"
        ];

        fields.forEach((field) => {
            const value = String(
                formData.get(field) || ""
            ).trim();

            if (
                field === "company" ||
                field === "professional"
            ) {
                if (value) {
                    identity[field] = value;
                }
                return;
            }

            identity[field] = value;
        });

        let localSaved = saveIdentity(identity);

        if (!localSaved && identity.logo) {
            const reducedLogo = await shrinkCompanyLogoDataURL(
                identity.logo,
                120000
            );

            if (reducedLogo && reducedLogo !== identity.logo) {
                identity.logo = reducedLogo;
                const previewEl = queryCompany("[data-company-logo-preview]");

                if (previewEl) {
                    previewEl.src = identity.logo;
                    previewEl.hidden = false;
                }

                localSaved = saveIdentity(identity);
            }
        }

        if (!localSaved) {
            const localMessage =
                "Não foi possível salvar os dados da empresa neste aparelho. A logo pode estar grande demais.";

            if (!options.silent) {
                showStatus(localMessage, 3200);
            }

            return {
                ok: false,
                local: false,
                cloud: false,
                message: localMessage
            };
        }

        let cloudSynced = true;
        let cloudMessage = "";

        /* R11.9 — três persistências independentes. Uma falha não pode impedir
           nome profissional nem logo empresarial de chegarem à nuvem. */
        const cloudErrors = [];
        if (global.AuroraCloudSync) {
            try {
                if (typeof global.AuroraCloudSync.updateProfessionalName === "function" && identity.professional) {
                    await global.AuroraCloudSync.updateProfessionalName(identity.professional);
                }
            } catch (error) { cloudErrors.push(error); }

            try {
                if (typeof global.AuroraCloudSync.syncMyProfile === "function") {
                    await global.AuroraCloudSync.syncMyProfile(identity);
                }
            } catch (error) { cloudErrors.push(error); }

            try {
                if (
                    typeof global.AuroraCloudSync.updateCompanyIdentity === "function" &&
                    global.AuroraCompanyAccess &&
                    typeof global.AuroraCompanyAccess.canManageUsers === "function" &&
                    global.AuroraCompanyAccess.canManageUsers()
                ) {
                    await global.AuroraCloudSync.updateCompanyIdentity(identity);
                }
            } catch (error) { cloudErrors.push(error); }

            try {
                if (
                    typeof global.AuroraCloudSync.updateCompanyCorporateIdentity === "function" &&
                    global.AuroraCompanyAccess &&
                    typeof global.AuroraCompanyAccess.canManageUsers === "function" &&
                    global.AuroraCompanyAccess.canManageUsers()
                ) {
                    await global.AuroraCloudSync.updateCompanyCorporateIdentity(identity);
                }
            } catch (error) { cloudErrors.push(error); }
        }
        if (cloudErrors.length) {
            cloudSynced = false;
            cloudMessage = cloudErrors.map((error) => error && error.message ? error.message : String(error || "")).join(" ");
            if (!options.silent) {
                showStatus(`${cloudMessage} Os dados ficaram salvos neste aparelho.`, 3200);
            }
        }

        /* R11.6: a interface operacional mostra o nome profissional, enquanto
         * a conta autenticada/full_name permanece separada para auditoria. */
        shell.updateUser(
            String(identity.professional || "").trim() ||
            resolveLoggedInUserFullName() ||
            "Usuário"
        );

        const heroCompany =
            homeLayer.querySelector(
                ".aurora-home-hero strong"
            );

        if (heroCompany) {
            heroCompany.textContent =
                identity.company;
        }

        captureIdentityBaseline();

        if (!options.silent && cloudSynced) {
            showStatus(
                "Dados da empresa salvos.",
                2200
            );
        }

        return {
            ok: true,
            local: true,
            cloud: cloudSynced,
            message: cloudMessage
        };
    }

    async function openCompanyModal() {
        if (!companyModal) {
            return;
        }

        companyModal.hidden = false;
        if (identityForm) {
            identityForm.hidden = false;
        }
        syncProfileModalLock();
        try {
            await hydrateCorporateIdentityForSettings();
        } catch (error) {
            console.warn("Aurora: dados corporativos ficaram pendentes de hidratação.", error);
        }
        captureIdentityBaseline();
    }

    async function closeCompanyModal(options = {}) {
        if (!companyModal) {
            return true;
        }
        if (options.save !== false && identityFormDirty) {
            const result =
                await persistIdentityForm({
                    silent: false
                });

            if (
                !result ||
                result.local === false
            ) {
                return false;
            }

            if (
                result.cloud === false &&
                result.message
            ) {
                showStatus(
                    `${result.message} Minha empresa será fechada com os dados locais.`,
                    2800
                );
            }
        }

        companyModal.hidden = true;
        settings.classList.add(
            "is-open"
        );
        syncProfileModalLock();
        return true;
    }

    function openSettingsModal() {
        settings.classList.add(
            "is-open"
        );
        syncProfileModalLock();
    }

    async function closeSettingsModal(options = {}) {
        if (
            companyModal &&
            !companyModal.hidden
        ) {
            const closed =
                await closeCompanyModal(
                    options
                );

            if (!closed) {
                return false;
            }
        }

        settings.classList.remove(
            "is-open"
        );
        syncProfileModalLock();
        return true;
    }

    async function closeTopAuroraLayer() {
        if (
            global.AuroraDialog &&
            typeof global.AuroraDialog.consumeBackPress === "function" &&
            global.AuroraDialog.consumeBackPress()
        ) {
            return true;
        }
        if (isFinalReportShareActive()) {
            return true;
        }
        /* V47 R14 — "Todos os trabalhos" é um painel interno da Home.
         * O botão visual já usava closeCompanyTeamPanel(); o Back nativo
         * passa a consumir exatamente a mesma saída, sem rota paralela. */
        if (typeof closeCompanyTeamPanel === "function" && closeCompanyTeamPanel()) {
            return true;
        }
        const openPreview = document.querySelector(".aurora-report-preview.is-open");
        if (openPreview) {
            return closeFinalReportAndReturnHome();
        }
        const supportOverlay = document.querySelector("[data-native-support-overlay]:not([hidden])");
        if (supportOverlay) {
            supportOverlay.hidden = true;
            document.body.classList.remove("aurora-support-open");
            return true;
        }
        if (
            companyModal &&
            !companyModal.hidden
        ) {
            if (companyLogoPickerGuard) {
                return true;
            }
            return closeCompanyModal({
                save: true
            });
        }
        if (
            global.AuroraAssetsPilot &&
            typeof global.AuroraAssetsPilot.closeIfOpen === "function" &&
            global.AuroraAssetsPilot.closeIfOpen()
        ) {
            return true;
        }
        if (
            global.AuroraCompanyTeam &&
            typeof global.AuroraCompanyTeam.closeIfOpen === "function" &&
            global.AuroraCompanyTeam.closeIfOpen()
        ) {
            return true;
        }
        /* V149 — backstack Tupy: catálogo -> Configurações Tupy -> Perfil -> Home. */
        const tupyCatalog = document.querySelector("[data-aet-settings-catalog-layer] [data-aet-catalog-overlay]:not([hidden])");
        if (tupyCatalog) {
            const closeCatalog = tupyCatalog.querySelector("[data-aet-catalog-close], .aet-catalog-close");
            if (closeCatalog && typeof closeCatalog.click === "function") closeCatalog.click();
            else tupyCatalog.hidden = true;
            return true;
        }
        const tupySettings = document.querySelector("[data-aet-settings-catalog-layer]");
        if (tupySettings) {
            const closeTupy = tupySettings.querySelector("[data-aet-settings-tupy-close]");
            if (closeTupy && typeof closeTupy.click === "function") closeTupy.click();
            else tupySettings.remove();
            return true;
        }
        const openSettings = document.querySelector(".aurora-settings-modal.is-open");
        if (openSettings) {
            return closeSettingsModal({
                save: true
            });
        }
        const openPicker = document.querySelector(".aurora-suggestion-panel:not([hidden])");
        if (openPicker) {
            openPicker.hidden = true;
            document.body.classList.remove("aurora-picker-open");
            return true;
        }
        const cloudOverlay = document.querySelector(".aurora-cloud-overlay:not([hidden])");
        if (cloudOverlay) {
            cloudOverlay.hidden = true;
            return true;
        }
        const openSheet = document.querySelector(".aurora-custom-service-modal.is-open,.aurora-module-access-overlay:not([hidden]),.aurora-demo-overlay:not([hidden])");
        if (openSheet) {
            openSheet.classList.remove("is-open");
            openSheet.hidden = true;
            return true;
        }
        return false;
    }

    async function followAuroraBackFlow() {
        if (nativeBackBusy) return true;
        nativeBackBusy = true;
        try {
            if (await closeTopAuroraLayer()) return true;
            if (activeAuroraView === "workflow") {
                if (runtime.currentIndex > 0) await runtime.previous();
                else {
                    if (global.AuroraHomeReturnTrace) {
                        const hr = global.AuroraHomeReturnTrace;
                        const origin =
                            hr.peekNextHomeOrigin() === "POPSTATE"
                                ? "POPSTATE"
                                : "FOLLOW_BACK_FLOW";

                        hr.setNextHomeOrigin(
                            origin,
                            "WORKFLOW_INDEX_0"
                        );
                    }
                    await showHome();
                }
                return true;
            }
            if (activeAuroraView === "aet_gestao") {
                if (global.AuroraHomeReturnTrace) {
                    global.AuroraHomeReturnTrace.setNextHomeOrigin("POPSTATE", "GESTAO_NATIVE_BACK");
                }
                await showHome();
                return true;
            }
            if (activeAuroraView === "reports") {
                if (global.AuroraHomeReturnTrace) {
                    const hr = global.AuroraHomeReturnTrace;
                    const origin =
                        hr.peekNextHomeOrigin() === "POPSTATE"
                            ? "POPSTATE"
                            : "FOLLOW_BACK_FLOW";

                    hr.setNextHomeOrigin(
                        origin,
                        "REPORTS_VIEW"
                    );
                }
                await showHome();
                return true;
            }
            return false;
        } finally {
            nativeBackBusy = false;
        }
    }

    global.AuroraProfileNavigation = {
        closeTopLayer: closeTopAuroraLayer,
        followBackFlow: followAuroraBackFlow,
        closeFinalReportAndReturnHome: closeFinalReportAndReturnHome,
        goHome: showHome,
        isCompanyLogoPickerActive: () => companyLogoPickerGuard
    };

    history.replaceState({ auroraRoot: true }, "");
    history.pushState({ auroraGuard: true }, "");
    global.addEventListener("popstate", async () => {
        if (global.AuroraHomeReturnTrace) {
            const hr = global.AuroraHomeReturnTrace;
            const runtimeCase = hr.runtimeCaseSnapshot();

            hr.logPopstate({
                historyState: hr.summarizeHistoryState(history.state),
                activeAuroraView: activeAuroraView,
                currentIndex: runtimeCase.index,
                caseId: runtimeCase.id
            });

            if (hr.peekNextHomeOrigin() === "UNKNOWN") {
                hr.setNextHomeOrigin("POPSTATE", "");
            }
        }

        const handled = await followAuroraBackFlow();
        if (handled) history.pushState({ auroraGuard: true }, "");
        else history.back();
    });

    const createCustomServiceButton = homeLayer.querySelector("[data-create-custom-service]");
    if (createCustomServiceButton) {
        createCustomServiceButton.addEventListener("click", () => {
            customServiceModal.classList.add("is-open");
        });
    }

    customServiceModal
        .querySelectorAll(
            "[data-custom-service-close]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    () => {
                        customServiceModal.classList.remove(
                            "is-open"
                        );
                    }
                );
            }
        );

    customServiceModal
        .querySelector(
            "[data-custom-service-form]"
        )
        .addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();

                const data =
                    new FormData(
                        event.currentTarget
                    );

                const title =
                    String(
                        data.get("title") || ""
                    ).trim();

                const description =
                    String(
                        data.get("description") || ""
                    ).trim();

                if (!title || !description) {
                    return;
                }

                saveCustomService(
                    identity.profile,
                    {
                        id:
                            createServiceId(title),
                        title,
                        description,
                        icon:
                            String(
                                data.get("icon") || "⚙️"
                            ),
                        color:
                            String(
                                data.get("color") || "#64f0e5"
                            ),
                        flow_template:
                            String(data.get("flow_template") || "quick"),
                        operation_type:
                            String(data.get("operation_type") || "inspection"),
                        record_section_title:
                            String(data.get("record_section_title") || "Registros técnicos"),
                        custom_fields:
                            String(data.get("custom_fields") || "")
                                .split(/\r?\n/)
                                .map((item) => item.trim())
                                .filter(Boolean),
                        custom:
                            true,
                        created_at:
                            new Date().toISOString()
                    }
                );

                showStatus(
                    `${title} foi adicionado aos seus serviços.`
                );

                window.setTimeout(
                    () => {
                        window.location.reload();
                    },
                    650
                );
            }
        );

    /* Aurora AI Home — inicia exatamente o mesmo fluxo do card operacional. */
    global.AuroraAiHome = {
        getContext: () => ({
            profile: String(identity.profile || "").toLowerCase(),
            services: Array.from(homeLayer.querySelectorAll("[data-operational-service-grid] [data-service-id]:not([hidden])")).map((card) => ({
                id: String(card.dataset.serviceId || ""),
                title: String(card.dataset.serviceTitle || "")
            })).filter((item) => item.id && item.id !== "eletrica_tupy"),
            active: activeAuroraView === "home" && !homeLayer.hidden && homeLayer.isConnected
        }),
        start: async (serviceId, customerData) => {
            if (activeAuroraView !== "home" || homeLayer.hidden) return false;
            const card = Array.from(homeLayer.querySelectorAll("[data-operational-service-grid] [data-service-id]:not([hidden])")).find((item) => String(item.dataset.serviceId || "") === String(serviceId || ""));
            if (!card || String(card.dataset.serviceId || "") === "eletrica_tupy") return false;
            /* O nome fica pendente até o MESMO handler do card criar o novo caso.
             * Assim a IA não depende de corrida entre card.click(), gate comercial e montagem do controller. */
            global.__AURORA_AI_HOME_PENDING_CUSTOMER = (customerData && typeof customerData === "object") ? customerData : { name: String(customerData || "").trim() };
            card.click();
            const deadline = Date.now() + 8000;
            while (Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                const currentCase = runtime.getCase ? runtime.getCase() : runtime.caseData;
                const currentService = currentCase && currentCase.service ? String(currentCase.service.id || "") : "";
                if (activeAuroraView === "workflow" && currentService === String(serviceId || "")) return true;
            }
            global.__AURORA_AI_HOME_PENDING_CUSTOMER = null;
            return false;
        }
    };

    homeLayer
        .querySelectorAll(
            "[data-service-id]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        const hr = global.AuroraHomeReturnTrace;
                        const beforeCase = hr
                            ? hr.runtimeCaseSnapshot()
                            : null;

                        if (hr) {
                            hr.logHR0({
                                serviceId: button.dataset.serviceId || "",
                                activeAuroraView: activeAuroraView,
                                currentIndex:
                                    beforeCase && beforeCase.index != null
                                        ? beforeCase.index
                                        : "",
                                caseIdBefore:
                                    beforeCase && beforeCase.id
                                        ? beforeCase.id
                                        : "",
                                currentCase:
                                    beforeCase && beforeCase.exists
                                        ? "SIM"
                                        : "NAO"
                            });
                        }

                        if (
                            String(button.dataset.serviceId || "").toLowerCase() === "eletrica_tupy" &&
                            !canEnterEletricaTupyOperationalFlow() &&
                            !canExplicitlyOpenEletricaTupyOffline()
                        ) {
                            denyEletricaTupyOperationalAccess();
                            return;
                        }

                        if (
                            global.AuroraModuleCommercial &&
                            typeof global.AuroraModuleCommercial.gateNewWork === "function"
                        ) {
                            const allowed = await global.AuroraModuleCommercial.gateNewWork(
                                identity.profile
                            );

                            if (!allowed) {
                                return;
                            }
                        }

                        const blankCase =
                            createBlankCaseForService(
                                button.dataset.serviceId,
                                button.dataset.serviceTitle,
                                String(button.dataset.serviceId || "") === "grounding_equipotentialization" ? "grounding_equipotentialization" : identity.profile,
                                identity.professional,
                                {
                                    operationType: button.dataset.operationType || "inspection",
                                    flowTemplate: button.dataset.flowTemplate || "technical",
                                    recordSectionTitle: button.dataset.recordSectionTitle || "Registros técnicos",
                                    customFields: (() => {
                                        try { return JSON.parse(button.dataset.customFields || "[]"); }
                                        catch (error) { return []; }
                                    })(),
                                    description: button.dataset.serviceDescription || "",
                                    custom: button.dataset.serviceCustom === "true"
                                }
                            );

                        /* Aurora AI Home: aplica Cliente antes de persistir/renderizar o novo atendimento. */
                        const aiHomeCustomer = global.__AURORA_AI_HOME_PENDING_CUSTOMER;
                        global.__AURORA_AI_HOME_PENDING_CUSTOMER = null;
                        if (aiHomeCustomer && blankCase.customer) {
                            const allowedCustomerFields = ["name", "phone", "email", "person_type", "address"];
                            allowedCustomerFields.forEach((field) => {
                                const value = String(aiHomeCustomer[field] || "").trim();
                                if (!value) return;
                                if (field === "address" && String(button.dataset.serviceId || "") !== "sofa_cleaning") return;
                                if (field === "person_type" && !["Pessoa Física", "Empresa", "Condomínio"].includes(value)) return;
                                blankCase.customer[field] = value;
                            });
                        }

                        /* ATIVO V16 — uma nova vistoria iniciada pela ficha do equipamento
                         * reaproveita somente dados cadastrais/identificação. Ocorrências, diagnóstico,
                         * orçamento e evidências continuam pertencendo ao novo atendimento. */
                        let assetWorkflowOrigin = null;
                        try {
                            const rawSelected = sessionStorage.getItem("aurora_asset_registry_selected_v1");
                            const selectedAsset = rawSelected ? JSON.parse(rawSelected) : null;
                            const selectedServiceId = String(button.dataset.serviceId || "").toLowerCase();
                            const selectedProfile = String(identity.profile || "").toLowerCase();
                            const isAssetEnabledService = selectedProfile !== "vehicle_inspection" && selectedServiceId !== "vehicle_inspection" && selectedServiceId !== "eletrica_tupy";
                            if (isAssetEnabledService && selectedAsset && selectedAsset.origin === "asset_detail") {
                                assetWorkflowOrigin = selectedAsset;
                                const oldAsset = selectedAsset.previous_asset && typeof selectedAsset.previous_asset === "object"
                                    ? selectedAsset.previous_asset : {};
                                blankCase.asset = {
                                    ...(blankCase.asset || {}),
                                    ...oldAsset,
                                    tag: selectedAsset.code || oldAsset.tag || "",
                                    code: selectedAsset.code || oldAsset.code || "",
                                    identification: selectedAsset.name || oldAsset.identification || "",
                                    name: selectedAsset.name || oldAsset.name || "",
                                    type: selectedAsset.type || oldAsset.type || "",
                                    location: selectedAsset.location || oldAsset.location || "",
                                    sector: selectedAsset.sector || oldAsset.sector || "",
                                    notes: selectedAsset.notes || oldAsset.notes || "",
                                    asset_registry_id: selectedAsset.asset_registry_id || "",
                                    qr_token: selectedAsset.qr_token || ""
                                };
                                /* V38 — aliases visíveis da shape recebem a identificação permanente
                                 * sem substituir o ID compartilhado usado para vínculo e histórico. */
                                if (["workshop", "car_wash"].includes(selectedProfile)) {
                                    blankCase.asset.plate = selectedAsset.code || oldAsset.plate || blankCase.asset.plate || "";
                                }
                                /* V34 — o cadastro permanente do ativo acompanha qualquer nova
                                 * vistoria escolhida a partir da ficha do equipamento. O cliente/unidade
                                 * também é reaproveitado quando já conhecido. Dados do atendimento
                                 * anterior (ocorrências, diagnóstico, fotos, conclusão etc.) NÃO são copiados. */
                                const oldCustomer = selectedAsset.previous_customer && typeof selectedAsset.previous_customer === "object"
                                    ? selectedAsset.previous_customer : {};
                                if (blankCase.customer && Object.keys(oldCustomer).length) {
                                    blankCase.customer = {
                                        ...blankCase.customer,
                                        ...oldCustomer
                                    };
                                } else if (blankCase.customer && selectedAsset.unit) {
                                    blankCase.customer.name = selectedAsset.unit;
                                }
                                blankCase.workflow_state = {
                                    ...(blankCase.workflow_state || {}),
                                    asset_origin: "asset_detail",
                                    asset_registry_id: selectedAsset.asset_registry_id || "",
                                    asset_public_token: selectedAsset.qr_token || ""
                                };
                            }
                            sessionStorage.removeItem("aurora_asset_registry_selected_v1");
                        } catch (assetPrefillError) {
                            console.warn("Aurora Ativos: não foi possível aplicar o pré-preenchimento.", assetPrefillError);
                        }

                        if (
                            typeof runtime.resetCase ===
                                "function"
                        ) {
                            runtime.resetCase(
                                blankCase,
                                {
                                    reason:
                                        "new_service"
                                }
                            );
                        } else {
                            /* Compatibilidade defensiva com runtimes antigos. */
                            runtime.caseData =
                                clone(blankCase);

                            runtime.currentIndex = 0;

                            runtime.emit(
                                "case_changed",
                                runtime.getCase()
                            );
                        }

                        applyServiceFlowTemplate(
                            runtime,
                            blankCase.service
                        );

                        if (
                            typeof runtime._applyServiceWorkflowSteps ===
                            "function"
                        ) {
                            runtime._applyServiceWorkflowSteps(
                                runtime.getCase()
                            );
                        }

                        repository.save(
                            runtime.getCase()
                        );

                        showWorkflow();

                        const firstStep =
                            button.dataset.serviceCustom === "true"
                                ? (runtime.steps || []).find((step) => step.id === "customer")
                                : (runtime.steps && runtime.steps.length ? runtime.steps[0] : null);

                        if (
                            firstStep &&
                            typeof runtime.openStep === "function"
                        ) {
                            await runtime.openStep(
                                firstStep.id,
                                {
                                    validateCurrent: false,
                                    /*
                                     * O atendimento acabou de ser substituido por um caso vazio.
                                     * A tela ainda montada pertence ao atendimento anterior e nao
                                     * pode ser salva dentro do novo caso antes da primeira etapa abrir.
                                     */
                                    saveCurrent: false
                                }
                            ).catch(
                                console.error
                            );
                        }

                        /* Latência percebida: sinal explícito após a primeira tela estar montada e os dados AI aplicados.
                         * O cronômetro escuta este evento; não depende de polling/estado intermediário da Home. */
                        document.dispatchEvent(new CustomEvent("aurora:ai:fields-applied", {
                            detail: { serviceId: String(button.dataset.serviceId || ""), stage: "customer" }
                        }));
                        if (global.AuroraAiFloating && typeof global.AuroraAiFloating.completeProcessingTimer === "function") {
                            global.AuroraAiFloating.completeProcessingTimer();
                        }

                        showStatus(
                            `${button.dataset.serviceTitle} selecionado.`
                        );
                    }
                );
            }
        );

    homeLayer
        .querySelectorAll(
            "[data-open-reports]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                showReports
            );
        });

    let companyTeamVisibility = null;
    homeLayer.querySelectorAll("[data-open-company-team]").forEach((button) => {
        button.addEventListener("click", () => {
            const panel = homeLayer.querySelector("[data-company-team-panel]");
            if (!panel) return;
            const sections = [...homeLayer.querySelectorAll(":scope > section:not([data-company-team-panel])")];
            companyTeamVisibility = new Map(sections.map((section) => [section, section.hidden]));
            sections.forEach((section) => section.hidden = true);
            panel.hidden = false;
            homeLayer.scrollTop = 0;
        });
    });

    homeLayer.querySelectorAll("[data-aurora-refresh]").forEach((button) => {
        button.addEventListener("click", async () => {
            if (!global.AuroraUi || typeof global.AuroraUi.refreshData !== "function") return;
            button.disabled = true;
            button.setAttribute("aria-busy", "true");
            try {
                if (global.AuroraSupport && typeof global.AuroraSupport.ensureNativePermission === "function") {
                    await global.AuroraSupport.ensureNativePermission();
                }
                await global.AuroraUi.refreshData();
            }
            catch (error) {
                console.error("[AURORA] Falha ao atualizar dados", error);
                showStatus("Não foi possível atualizar agora.", 3200);
            }
            finally { button.disabled = false; button.setAttribute("aria-busy", "false"); }
        });
    });
    function closeCompanyTeamPanel() {
        const panel = homeLayer.querySelector("[data-company-team-panel]");
        if (!panel || panel.hidden) return false;
        panel.hidden = true;
        const sections = [...homeLayer.querySelectorAll(":scope > section:not([data-company-team-panel])")];
        sections.forEach((section) => {
            if (companyTeamVisibility instanceof Map && companyTeamVisibility.has(section)) {
                section.hidden = companyTeamVisibility.get(section) === true;
                return;
            }
            section.hidden = section.matches("[data-assets-panel],[data-assets-detail],[data-assets-editor],[data-assets-help-modal],[data-asset-qr-modal]");
        });
        companyTeamVisibility = null;
        homeLayer.scrollTop = 0;
        return true;
    }
    homeLayer.querySelectorAll("[data-close-company-team]").forEach((button) => {
        button.addEventListener("click", closeCompanyTeamPanel);
    });
    /* FIX6 — dentro de Todos os trabalhos, o Início inferior usa exatamente a
       mesma saída do botão superior, sem depender de um listener antigo de render. */
    homeLayer.querySelectorAll("[data-footer-home]").forEach((button) => {
        button.addEventListener("click", (event) => {
            const panel = homeLayer.querySelector("[data-company-team-panel]");
            if (!panel || panel.hidden) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            closeCompanyTeamPanel();
        }, true);
    });

    homeLayer.querySelectorAll("[data-open-aet-gestao]").forEach((button) => {
        button.addEventListener("click", () => {
            showGestaoEletricaTupy().catch(console.error);
        });
    });

    if (canManageEletricaTupyUi()) {
        const recentHost = homeLayer.querySelector("[data-aet-home-recent-admin]");
        const api = global.AuroraEletricaTupy;
        if (recentHost && api && typeof api.loadHomeRecentActivitiesInto === "function") {
            api.loadHomeRecentActivitiesInto(recentHost).then(() => {
                const rows = Array.isArray(api._gestaoCompanyRows) ? api._gestaoCompanyRows : [];
                const progress = rows.filter((row) => {
                    const s = String(row && row.status || "").toLowerCase().trim();
                    return s === "in_progress" || s === "em andamento" || s === "awaiting_review" ||
                        s === "aguardando revisão" || s === "aguardando revisao";
                }).length;
                const completed = rows.filter((row) => {
                    const s = String(row && row.status || "").toLowerCase().trim();
                    return s === "completed" || s === "concluído" || s === "concluido";
                }).length;
                const metrics = homeLayer.querySelectorAll(".aurora-dashboard-metrics article");
                if (metrics[0]) {
                    const value = metrics[0].querySelector("strong");
                    if (value) value.textContent = String(progress);
                }
                if (metrics[1]) {
                    const value = metrics[1].querySelector("strong");
                    if (value) value.textContent = String(completed);
                }
            }).catch((error) => {
                console.error("[HOME ADMIN recent]", error);
                recentHost.innerHTML =
                    '<p class="aet-hint aet-hint--error">Não foi possível carregar as últimas atividades.</p>';
            });
        }
    }

    gestaoLayer.querySelectorAll("[data-aet-gestao-back]").forEach((button) => {
        button.addEventListener("click", () => {
            if (
                global.AuroraHomeReturnTrace &&
                typeof global.AuroraHomeReturnTrace.setNextHomeOrigin === "function"
            ) {
                global.AuroraHomeReturnTrace.setNextHomeOrigin(
                    "HOME_BUTTON",
                    "GESTAO_BACK"
                );
            }
            showHome().catch(console.error);
        });
    });

    bindRecentActions();

    reportsLayer
        .querySelector(
            "[data-report-select-mode]"
        )
        .addEventListener(
            "click",
            () => {
                reportSelectionMode =
                    !reportSelectionMode;

                selectedReports.clear();
                renderReports();
            }
        );

    reportsLayer
        .querySelector(
            "[data-report-delete-selected]"
        )
        .addEventListener(
            "click",
            async () => {
                if (!selectedReports.size) {
                    return;
                }

                const confirmed =
                    await global.AuroraDialog.confirm(
                        `${selectedReports.size} relatório${selectedReports.size === 1 ? " será excluído" : "s serão excluídos"} definitivamente.`, { title: "Excluir relatórios?", confirmLabel: "Excluir", tone: "danger" }
                    );

                if (!confirmed) {
                    return;
                }

                var passwordOk = true;
                if (
                    global.AuroraEletricaTupy &&
                    typeof global.AuroraEletricaTupy.confirmAccountPassword === "function"
                ) {
                    passwordOk = await global.AuroraEletricaTupy.confirmAccountPassword({
                        title: "Excluir relatórios?",
                        message: "Esta exclusão é permanente. Confirme com a senha da sua conta."
                    });
                }
                if (!passwordOk) {
                    return;
                }

                const reportsToDelete = getReports().filter(
                    (report) => selectedReports.has(String(report.id))
                );

                for (const report of reportsToDelete) {
                    try {
                        await removeReportEvidence(report);
                    } catch (error) {
                        console.warn("Não foi possível limpar todas as evidências do atendimento.", error);
                    }
                }

                const remaining =
                    getReports().filter(
                        (report) =>
                            !selectedReports.has(
                                String(report.id)
                            )
                    );

                saveReports(
                    remaining
                );

                if (
                    global.AuroraReportFeature &&
                    global.AuroraReportFeature.engine
                ) {
                    selectedReports.forEach(
                        (id) => {
                            global.AuroraReportFeature.engine.runtimeReports.delete(
                                String(id)
                            );
                        }
                    );
                }

                const savedEnvelope = repository.load();
                const savedCaseId = savedEnvelope && savedEnvelope.case
                    ? String(savedEnvelope.case.id || "")
                    : "";

                const deletedCaseIds = new Set(
                    reportsToDelete.map((report) => String(
                        (report.snapshot && report.snapshot.id) || report.case_id || report.id || ""
                    ))
                );

                if (savedCaseId && deletedCaseIds.has(savedCaseId)) {
                    repository.clear();
                }

                selectedReports.clear();
                reportSelectionMode =
                    false;

                renderReports();
                syncHomeReports();
                showStatus(
                    "Relatórios e atendimentos recentes excluídos."
                );
            }
        );

    reportsLayer
        .querySelector(
            "[data-report-search]"
        )
        .addEventListener(
            "input",
            renderReports
        );

    reportsLayer
        .querySelectorAll(
            "[data-report-filter]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    () => {
                        currentFilter =
                            button.dataset.reportFilter;

                        reportsLayer
                            .querySelectorAll(
                                "[data-report-filter]"
                            )
                            .forEach(
                                (item) => {
                                    item.classList.toggle(
                                        "is-active",
                                        item === button
                                    );
                                }
                            );

                        renderReports();
                    }
                );
            }
        );

    dock
        .querySelector(
            "[data-workflow-previous]"
        )
        .addEventListener(
            "click",
            async () => {
                try {
                    if (runtime.currentIndex === 0) {
                        let assetOrigin = null;
                        try {
                            const rawOrigin = sessionStorage.getItem("aurora_asset_workflow_origin_v1");
                            assetOrigin = rawOrigin ? JSON.parse(rawOrigin) : null;
                        } catch (_) {}
                        if (assetOrigin && assetOrigin.asset_id) {
                            await showHome();
                            sessionStorage.removeItem("aurora_asset_workflow_origin_v1");
                            setTimeout(() => {
                                try {
                                    if (global.AuroraAssetsPilot && typeof global.AuroraAssetsPilot.openAsset === "function") {
                                        global.AuroraAssetsPilot.openAsset(assetOrigin.asset_id);
                                    } else if (global.AuroraAssetsPilot && typeof global.AuroraAssetsPilot.open === "function") {
                                        global.AuroraAssetsPilot.open();
                                    }
                                } catch (e) { console.warn(e); }
                            }, 0);
                            return;
                        }
                    }
                    try {
                        await runtime.previous();
                    } catch (error) {
                        if (String(identity.profile||"").toLowerCase() !== "grounding_equipotentialization") throw error;
                        console.warn("[GROUNDING R03 PREVIOUS SAVE]", error);
                        const previousStep=runtime.steps&&runtime.steps[runtime.currentIndex-1];
                        if(!previousStep)throw error;
                        await runtime.openStep(previousStep.id,{saveCurrent:false});
                    }
                } catch (error) {
                    console.error(error);
                    showStatus("Não foi possível voltar. Os dados permanecem salvos.",2600);
                }
            }
        );

    dock
        .querySelector(
            "[data-workflow-next]"
        )
        .addEventListener(
            "click",
            async () => {
                const isLastStep =
                    runtime.currentIndex ===
                    runtime.steps.length - 1;

                const button =
                    dock.querySelector(
                        "[data-workflow-next]"
                    );

                if (
                    button.dataset.pending ===
                        "true"
                ) {
                    return;
                }

                button.dataset.pending =
                    "true";
                button.disabled =
                    true;

                try {
                    if (isLastStep) {
                        if (isAdminReviewCase(runtime.getCase())) {
                            const aet = global.AuroraEletricaTupy;
                            if (!aet || typeof aet.finalizeAdminInspection !== "function") {
                                throw new Error("Finalização ADMIN indisponível.");
                            }
                            const host = document.querySelector("[data-module=\"aet_admin_codes\"]") ||
                                document.querySelector("[data-shell-content]") ||
                                null;
                            await aet.finalizeAdminInspection(host);
                            showStatus("Inspeção administrativa finalizada.", 2600);
                            return;
                        }

                        if (
                            global.AuroraEletricaTupy &&
                            typeof global.AuroraEletricaTupy.isUserBoltVistoriaFlow === "function" &&
                            global.AuroraEletricaTupy.isUserBoltVistoriaFlow(runtime.getCase()) &&
                            typeof global.AuroraEletricaTupy.finalizeUserVistoria === "function"
                        ) {
                            const userResult = await global.AuroraEletricaTupy.finalizeUserVistoria(runtime);
                            if (!userResult || userResult.ok !== true) {
                                const userReason =
                                    userResult && userResult.reason
                                        ? userResult.reason
                                        : "unknown";
                                showStatus(
                                    userReason === "validation_failed"
                                        ? "Não foi possível finalizar. Revise os campos obrigatórios da vistoria."
                                        : userReason === "budget_number_required"
                                        ? "Informe o número do orçamento para concluir este atendimento."
                                        : userReason === "preview_failed"
                                        ? "Vistoria registrada. Abra a prévia em Atendimentos recentes."
                                        : userReason === "engine_create_failed"
                                        ? "Falha ao montar o relatório da vistoria. Os dados foram preservados."
                                        : userReason === "report_reload_failed"
                                        ? "Relatório gerado, mas não confirmado no armazenamento."
                                        : userReason === "report_feature_missing"
                                        ? "O gerador de relatório não foi carregado."
                                        : "Não foi possível finalizar a vistoria.",
                                    3600
                                );
                                return;
                            }
                            if (userResult.preview_ok === false) {
                                showStatus(
                                    "Vistoria enviada para revisão administrativa. Toque no atendimento recente para abrir a prévia.",
                                    3600
                                );
                                return;
                            }
                            showStatus("Vistoria enviada para revisão administrativa.", 3200);
                            return;
                        }

                        const reportFeature =
                            global.AuroraReportFeature;

                        if (
                            global.AuroraEletricaTupy &&
                            typeof global.AuroraEletricaTupy.validateBudgetNumber === "function"
                        ) {
                            const budgetCheck =
                                global.AuroraEletricaTupy.validateBudgetNumber(
                                    runtime.getCase()
                                );
                            if (budgetCheck && budgetCheck.ok === false) {
                                showStatus(
                                    budgetCheck.message ||
                                        "Informe o número do orçamento para concluir este atendimento.",
                                    3600
                                );
                                return;
                            }
                        }

                        if (
                            !reportFeature ||
                            typeof reportFeature.finalize !==
                                "function"
                        ) {
                            throw new Error(
                                "O gerador de relatório não foi carregado."
                            );
                        }

                        const result =
                            await reportFeature.finalize(
                                runtime
                            );

                        if (
                            !result ||
                            result.ok !==
                                true
                        ) {
                            const reason =
                                result &&
                                result.reason
                                    ? result.reason
                                    : "unknown";
                            showStatus(
                                reason ===
                                    "validation_failed"
                                    ? "Revise os campos obrigatórios da conclusão antes de finalizar."
                                    : reason ===
                                        "budget_number_required"
                                        ? "Informe o número do orçamento para concluir este atendimento."
                                    : reason ===
                                        "preview_failed"
                                        ? "Relatório atualizado. Abra a prévia em Atendimentos recentes."
                                        : reason ===
                                            "engine_create_failed"
                                            ? "Falha ao montar o relatório. A inspeção continua salva."
                                            : reason ===
                                                "report_reload_failed"
                                                ? "Relatório gerado, mas não confirmado no armazenamento."
                                                : `O relatório não foi gerado (${reason}). A inspeção continua salva.`,
                                3600
                            );

                            return;
                        }

                        if (
                            result.preview_ok ===
                                false
                        ) {
                            showStatus(
                                `Relatório ${reportDisplayId(result.report)} atualizado. Toque em Visualizar para abrir a prévia.`,
                                3600
                            );
                            return;
                        }

                        showStatus(
                            `Relatório ${reportDisplayId(result.report)} gerado com sucesso.`,
                            3200
                        );
                    } else {
                        const navigationResult=await runtime.next();
                        if(navigationResult&&navigationResult.valid===false){ return; }
                    }
                } catch (error) {
                    console.error(error);
                    showStatus(
                        isLastStep
                            ? "Falha ao gerar o relatório. Os dados não foram apagados."
                            : "Não foi possível abrir a próxima etapa. Os dados permanecem salvos.",
                        3600
                    );
                } finally {
                    button.dataset.pending =
                        "false";
                    button.disabled =
                        false;
                }
            }
        );

    shell.on(
        "workflow_navigation_changed",
        (state = {}) => {
            const previous =
                dock.querySelector(
                    "[data-workflow-previous]"
                );

            const next =
                dock.querySelector(
                    "[data-workflow-next]"
                );

            const progress =
                dock.querySelector(
                    "[data-workflow-progress]"
                );

            let hasAssetWorkflowOrigin = false;
            if (runtime.currentIndex === 0) {
                try {
                    const rawAssetOrigin = sessionStorage.getItem("aurora_asset_workflow_origin_v1");
                    const assetOrigin = rawAssetOrigin ? JSON.parse(rawAssetOrigin) : null;
                    hasAssetWorkflowOrigin = Boolean(assetOrigin && assetOrigin.asset_id);
                } catch (_) {}
            }
            /* V33 — na primeira etapa de uma vistoria iniciada pelo equipamento,
             * Anterior continua habilitado para retornar à ficha do ativo. */
            previous.disabled =
                state.can_go_previous === false && !hasAssetWorkflowOrigin;

            next.disabled =
                state.can_go_next ===
                false;

            next.textContent =
                state.next_label ||
                (
                    state.is_last_step
                        ? "Finalizar inspeção ✓"
                        : "Próximo →"
                );

            if (
                state.progress &&
                progress
            ) {
                progress.textContent =
                    `Etapa ${state.progress.current_number || 1} de ${state.progress.total || 1}`;
            }
        }
    );

    runtime.on(
        "step_changed",
        () => {
            showWorkflow();
            /* R26 — checkpoint de nuvem por etapa. O salvamento local continua
             * sendo a primeira garantia; falha/rede ausente não bloqueia o fluxo. */
            try {
                const draftCase = runtime.getCase && runtime.getCase();
                if (draftCase && !isCompletedCase(draftCase) && hasMeaningfulDraftData(draftCase) &&
                    global.AuroraCloudSync && typeof global.AuroraCloudSync.syncSelectedCase === "function" &&
                    !(typeof navigator !== "undefined" && navigator.onLine === false)) {
                    Promise.resolve(global.AuroraCloudSync.syncSelectedCase(draftCase)).catch((error) => {
                        try { global.AuroraCloudSync.queueCaseForSync && global.AuroraCloudSync.queueCaseForSync(draftCase); } catch (_) {}
                        console.warn("Aurora R26: checkpoint de rascunho aguardando sincronização.", error);
                    });
                }
            } catch (error) {
                console.warn("Aurora R26: checkpoint de rascunho não bloqueou a navegação.", error);
            }
        }
    );

    shell.on(
        "workflow_requested",
        showWorkflow
    );

    window.addEventListener("aurora:edit-report", async (event) => {
        const report = event.detail && event.detail.report;
        if (!report || !report.snapshot) {
            showStatus("Este atendimento não possui dados editáveis.");
            return;
        }

        /*
         * FINISH CURRENT, READ OLD, BLOCK NEW:
         * editar relatório reabre o MESMO case (mesmo snapshot.id), não cria novo atendimento.
         */
        try {
            const editableSnapshot = clone(report.snapshot);
            console.log(
                "AURORA_EDIT_FINALIZE",
                "EDIT_OPEN",
                {
                    caseId:
                        editableSnapshot.id,
                    publicId:
                        report.public_id ||
                        editableSnapshot.public_id
                }
            );
            [
                "customer",
                "asset",
                "intake",
                "occurrence",
                "diagnostic",
                "approval",
                "service"
            ].forEach((section) => {
                const persisted = report[section];
                if (!persisted || typeof persisted !== "object" || Array.isArray(persisted)) return;
                editableSnapshot[section] = {
                    ...clone(editableSnapshot[section] || {}),
                    ...clone(persisted)
                };
            });
            if (Array.isArray(report.occurrences) && report.occurrences.length) {
                editableSnapshot.occurrences = clone(report.occurrences);
            }
            if (Array.isArray(report.snapshot.evidence_groups) && report.snapshot.evidence_groups.length) {
                editableSnapshot.evidence_groups = clone(report.snapshot.evidence_groups);
            } else if (Array.isArray(report.evidence_groups) && report.evidence_groups.length) {
                editableSnapshot.evidence_groups = clone(report.evidence_groups);
            }
            if (report.coverPhoto && typeof report.coverPhoto === "object") {
                editableSnapshot.coverPhoto = clone(report.coverPhoto);
            }

            if (report.report_title) {
                editableSnapshot.approval = {
                    ...clone(editableSnapshot.approval || {}),
                    report_title:
                        (editableSnapshot.approval && editableSnapshot.approval.report_title) ||
                        report.report_title
                };
            }

            if (typeof runtime.resetCase === "function") {
                await runtime.resetCase(editableSnapshot, { reason: "report_edit" });
            } else if (runtime.caseBinder && typeof runtime.caseBinder.replace === "function") {
                runtime.caseBinder.replace(editableSnapshot, { source: "report_edit" });
            }

            applyServiceFlowTemplate(
                runtime,
                editableSnapshot.service
            );

            if (
                typeof runtime._applyServiceWorkflowSteps ===
                "function"
            ) {
                runtime._applyServiceWorkflowSteps(
                    editableSnapshot
                );
            }

            if (
                global.AuroraEvidenceFeature &&
                typeof global.AuroraEvidenceFeature.reload ===
                    "function"
            ) {
                await global.AuroraEvidenceFeature.reload();
            }

            const hydratedCase = runtime.getCase();
            console.log(
                "AURORA_EDIT_FINALIZE",
                "EDIT_CASE_HYDRATED",
                {
                    caseId: hydratedCase.id,
                    publicId:
                        hydratedCase.public_id ||
                        report.public_id,
                    evidenceGroups:
                        Array.isArray(
                            hydratedCase.evidence_groups
                        )
                            ? hydratedCase.evidence_groups.length
                            : 0
                }
            );

            repository.save(hydratedCase);
            showWorkflow();
            const first = runtime.steps && runtime.steps[0];
            const resumeStepId = report.status !== "Concluído"
                ? String(hydratedCase.current_step || "").trim()
                : "";
            const resumeStep = resumeStepId && Array.isArray(runtime.steps)
                ? runtime.steps.find((step) => String(step && step.id || "") === resumeStepId)
                : null;
            const targetStep = resumeStep || first;
            if (targetStep && typeof runtime.openStep === "function") {
                /*
                 * O formulário que estava montado antes do reset pertence ao
                 * atendimento anterior (ou ao formulário vazio criado depois
                 * da restauração). openStep salva a tela atual por padrão.
                 * Ao reabrir um backup, isso sobrescrevia imediatamente
                 * customer e outras seções restauradas com campos vazios.
                 * Primeiro monte o atendimento recuperado sem salvar a tela
                 * antiga; as próximas navegações voltam ao fluxo normal.
                 */
                await runtime.openStep(targetStep.id, { saveCurrent: false });
            }
            showStatus(`Atendimento ${reportDisplayId(report)} aberto para edição.`);
        } catch (error) {
            console.error(
                "AURORA_EDIT_FINALIZE",
                "EDIT_REPORT_ERROR",
                {
                    message:
                        error.message,
                    stack:
                        error.stack &&
                        String(error.stack).slice(
                            0,
                            400
                        )
                }
            );
            showStatus("Não foi possível abrir o atendimento para edição.");
        }
    });

    const receiveCloudProject = async (event) => {
        const detail = event.detail || {};
        const caseData = detail.caseData;
        const project = detail.project || {};
        const automaticHydration = detail.automaticHydration === true;
        const suppressNavigation = detail.suppressNavigation === true;
        if (!caseData || !caseData.id) return;

        const reports = getReports();
        const restoredReport = {
            id: caseData.id,
            public_id: caseData.public_id || "",
            status: caseData.status === "Concluído" ? "Concluído" : "Em andamento",
            created_at: caseData.created_at || project.created_at || new Date().toISOString(),
            updated_at: project.updated_at || new Date().toISOString(),
            profile_id: caseData.profile_id || "",
            module_id: caseData.module_id || caseData.profile_id || "",
            service_id: caseData.service && caseData.service.id ? String(caseData.service.id) : "",
            service: clone(caseData.service || {}),
            customer: clone(caseData.customer || {}),
            asset: clone(caseData.asset || {}),
            intake: clone(caseData.intake || {}),
            occurrences: clone(caseData.occurrences || []),
            diagnostic: clone(caseData.diagnostic || {}),
            approval: clone(caseData.approval || {}),
            coverPhoto: clone(caseData.coverPhoto || null),
            snapshot: clone(caseData),
            restored_from_cloud: true,
            cloud_version: Number(project.row_version || 1)
        };
        const existingIndex = reports.findIndex((item) =>
            String((item.snapshot && item.snapshot.id) || item.case_id || item.id || "") === String(caseData.id)
        );
        if (existingIndex >= 0) reports[existingIndex] = { ...reports[existingIndex], ...restoredReport };
        else reports.unshift(restoredReport);

        /* V47 R02 — ReportEngine mantém um cache em memória (runtimeReports).
         * A hidratação canônica anterior atualizava somente aurora_reports no
         * localStorage. Assim, a Home já possuía o case canônico novo, porém
         * ReportPreview podia reabrir a cópia antiga que permanecia no cache
         * do engine (ex.: telefone/e-mail removidos voltavam a aparecer).
         * Salvar pelo engine oficial atualiza atomicamente cache + persistência.
         * O fallback preserva o comportamento anterior caso o engine ainda
         * não esteja disponível durante o bootstrap. */
        const canonicalReport = existingIndex >= 0 ? reports[existingIndex] : restoredReport;
        const reportEngine = global.AuroraReportFeature && global.AuroraReportFeature.engine;
        if (reportEngine && typeof reportEngine.save === "function") {
            reportEngine.save(canonicalReport);
        } else {
            saveReports(reports);
        }
        if (!automaticHydration) repository.save(caseData);
        syncHomeReports();
        if (automaticHydration || suppressNavigation) return;
        if (
            global.AuroraHomeReturnTrace &&
            typeof global.AuroraHomeReturnTrace.setNextHomeOrigin === "function"
        ) {
            global.AuroraHomeReturnTrace.setNextHomeOrigin(
                "CLOUD_RESTORE",
                "PROJECT_RESTORED"
            );
        }
        await showHome();
        showStatus(`Atendimento ${caseData.id} recuperado da nuvem.`, 3000);
    };
    window.addEventListener("aurora:cloud-project-restored", receiveCloudProject);
    window.addEventListener("aurora:cloud-project-hydrated", receiveCloudProject);

    /* V23 — MULTIDISPOSITIVO CANÔNICO.
     * Reutiliza o pull já existente da Aurora. A diferença é apenas o momento:
     * executa DEPOIS que os listeners que materializam projetos cloud em
     * Atendimentos recentes já estão registrados. No cold start anterior,
     * cloud_sync podia hidratar antes deste listener existir; os projetos eram
     * encontrados na nuvem, mas o segundo dispositivo não os gravava na lista local.
     * Não cria armazenamento, RPC ou fluxo paralelo. */
    try {
        const cloud = global.AuroraCloudSync;
        if (cloud && typeof cloud.hydrateOwnProjectsMissingLocally === "function" &&
            !(typeof navigator !== "undefined" && navigator.onLine === false)) {
            cloud.hydrateOwnProjectsMissingLocally().then((multiDevice) => {
                console.info("[V23 MULTIDEVICE] canonical hydration after listeners", multiDevice);
                syncHomeReports();
            }).catch((error) => {
                console.warn("[V23 MULTIDEVICE] canonical hydration unavailable; local data preserved", error);
            });
        }
    } catch (error) {
        console.warn("[V23 MULTIDEVICE] canonical hydration unavailable; local data preserved", error);
    }

    shell.on(
        "home_requested",
        () => {
            if (
                global.AuroraHomeReturnTrace &&
                typeof global.AuroraHomeReturnTrace.setNextHomeOrigin === "function" &&
                global.AuroraHomeReturnTrace.peekNextHomeOrigin() === "UNKNOWN"
            ) {
                global.AuroraHomeReturnTrace.setNextHomeOrigin(
                    "HOME_BUTTON",
                    "SHELL_HOME_REQUESTED"
                );
            }
            showHome();
        }
    );

    shell.on(
        "reports_requested",
        showReports
    );

    shell.on(
        "user_menu_requested",
        () => {
            openSettingsModal();
        }
    );

    /*
     * Navegação global RC1.4.
     *
     * Um único listener em captura atende marca, Início e Relatórios.
     * Ele não depende do módulo atual e não é recriado a cada etapa.
     */
    function handleGlobalNavigation(event) {
        const target =
            event.target instanceof Element
                ? event.target
                : null;

        if (!target) {
            return;
        }

        const home =
            target.closest(
                "[data-footer-home],[data-topbar-home]"
            );

        if (home) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (closeCompanyTeamPanel()) return;
            if (
                global.AuroraHomeReturnTrace &&
                typeof global.AuroraHomeReturnTrace.setNextHomeOrigin === "function"
            ) {
                global.AuroraHomeReturnTrace.setNextHomeOrigin(
                    "HOME_BUTTON",
                    "GLOBAL_NAV"
                );
            }
            showHome();
            return;
        }

        const reports =
            target.closest(
                "[data-footer-reports]"
            );

        if (reports) {
            event.preventDefault();
            event.stopImmediatePropagation();
            showReports();
        }
    }

    document.addEventListener(
        "click",
        handleGlobalNavigation,
        true
    );


    settings
        .querySelectorAll(
            "[data-settings-close]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    () => {
                        closeSettingsModal({
                            save: true
                        }).catch(console.error);
                    }
                );
            }
        );

    settings
        .querySelector(
            "[data-settings-identity]"
        )
        ?.addEventListener(
            "click",
            () => {
                openCompanyModal();
            }
        );

    if (companyModal) {
        companyModal
            .querySelectorAll(
                "[data-company-close]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        closeCompanyModal({
                            save: true
                        }).catch(console.error);
                    }
                );
            });
    }

    const companyBackButton =
        queryCompany(
            "[data-company-back]"
        );

    if (companyBackButton) {
        companyBackButton.addEventListener(
            "click",
            () => {
                closeCompanyModal({
                    save: true
                }).catch(console.error);
            }
        );
    }

    if (identityForm) {
        identityForm.addEventListener(
            "input",
            markIdentityDirty
        );
        identityForm.addEventListener(
            "change",
            markIdentityDirty
        );
    }

    const accountEmailInput = queryCompany("[data-account-email]");
    function updateAccountEmail(email) {
        if (accountEmailInput) {
            accountEmailInput.value = String(email || "");
            accountEmailInput.placeholder = email ? "" : "Nenhuma conta conectada";
        }
    }
    updateAccountEmail(global.AURORA_ACCOUNT_EMAIL || "");
    global.addEventListener("aurora:account-session", (event) => {
        updateAccountEmail(event.detail && event.detail.email);
    });
    settings.querySelector("[data-account-signout]").addEventListener("click", async () => {
        settings.classList.remove("is-open");
        syncProfileModalLock();
        if (typeof global.AuroraAccountSignOut === "function") {
            await global.AuroraAccountSignOut();
            return;
        }
        global.dispatchEvent(new CustomEvent("aurora:account-signout-request"));
    });

    async function openNativeSupport() {
        if (!document.getElementById("aurora-native-support-layout")) {
            const supportLayout = document.createElement("style");
            supportLayout.id = "aurora-native-support-layout";
            supportLayout.textContent = `
                body.aurora-support-open{overflow:hidden!important}
                [data-native-support-overlay]{position:fixed!important;inset:0!important;z-index:2147483000!important;display:grid!important;place-items:center!important;padding:18px!important;background:rgba(2,8,17,.78)!important;backdrop-filter:blur(8px)!important;box-sizing:border-box!important;touch-action:none!important}
                [data-native-support-overlay][hidden]{display:none!important}
                [data-native-support-overlay] .aurora-support-panel{position:relative!important;inset:auto!important;width:min(100%,520px)!important;height:auto!important;max-height:min(760px,calc(100dvh - 36px))!important;margin:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;border:1px solid var(--aurora-border,rgba(127,226,255,.22))!important;border-radius:24px!important;color:var(--aurora-text,#edfaff)!important;background:var(--aurora-surface,#0a1728)!important;box-shadow:0 24px 70px rgba(0,0,0,.55)!important;font-family:system-ui,sans-serif!important;touch-action:auto!important}
                [data-native-support-overlay] .aurora-support-panel>header{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:14px!important;padding:20px!important;border-bottom:1px solid var(--aurora-border,rgba(127,226,255,.18))!important}
                [data-native-support-overlay] .aurora-support-panel>header span{color:var(--aurora-primary,#64f0e5)!important;font-size:10px!important;font-weight:900!important;letter-spacing:.14em!important;text-transform:uppercase!important}
                [data-native-support-overlay] .aurora-support-panel h2{margin:4px 0 5px!important;font-size:23px!important}
                [data-native-support-overlay] .aurora-support-panel>header p{margin:0!important;color:var(--aurora-muted,#a9bdca)!important;font-size:13px!important;line-height:1.4!important}
                [data-native-support-overlay] [data-native-support-close]{width:42px!important;height:42px!important;flex:none!important;border:1px solid var(--aurora-border,rgba(127,226,255,.18))!important;border-radius:12px!important;color:var(--aurora-text,#edfaff)!important;background:var(--aurora-surface-2,#172b3e)!important;font-size:21px!important}
                [data-native-support-overlay] .aurora-support-history{min-height:220px!important;overflow:auto!important;display:flex!important;flex:1 1 auto!important;flex-direction:column!important;gap:10px!important;padding:16px!important;background:var(--aurora-surface,#0a1728)!important}
                [data-native-support-overlay] .aurora-support-message{max-width:84%!important;padding:11px 13px!important;border:1px solid var(--aurora-border,rgba(127,226,255,.16))!important;border-radius:16px 16px 16px 5px!important;background:var(--aurora-surface-2,#14283a)!important}
                [data-native-support-overlay] .aurora-support-message.client{align-self:flex-end!important;border-color:var(--aurora-primary,#64f0e5)!important;border-radius:16px 16px 5px 16px!important}
                [data-native-support-overlay] .aurora-support-message strong,[data-native-support-overlay] .aurora-support-message small{display:block!important}
                [data-native-support-overlay] .aurora-support-message strong{color:var(--aurora-primary,#64f0e5)!important;font-size:11px!important}
                [data-native-support-overlay] .aurora-support-message small{color:var(--aurora-muted,#9db3c1)!important;font-size:10px!important}
                [data-native-support-overlay] .aurora-support-message p{margin:5px 0!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;line-height:1.42!important}
                [data-native-support-overlay] .aurora-support-empty{display:flex!important;min-height:150px!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding:18px!important;color:var(--aurora-muted,#a9bdca)!important;text-align:center!important}
                [data-native-support-overlay] .aurora-support-empty strong,[data-native-support-overlay] .aurora-support-empty span{display:block!important}
                [data-native-support-overlay] .aurora-support-form{padding:14px 16px calc(14px + env(safe-area-inset-bottom))!important;border-top:1px solid var(--aurora-border,rgba(127,226,255,.18))!important;background:var(--aurora-surface,#0a1728)!important}
                [data-native-support-overlay] .aurora-support-form label{display:block!important;margin-bottom:6px!important;font-size:12px!important;font-weight:800!important}
                [data-native-support-overlay] .aurora-support-form textarea{width:100%!important;min-height:78px!important;box-sizing:border-box!important;resize:none!important;padding:11px 12px!important;border:1px solid var(--aurora-border,#29435a)!important;border-radius:13px!important;color:var(--aurora-text,#fff)!important;background:var(--aurora-surface-2,#07111f)!important;font:inherit!important}
                [data-native-support-overlay] .aurora-support-form>div{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin-top:9px!important}
                [data-native-support-overlay] .aurora-support-form button{min-width:110px!important;min-height:43px!important;border:0!important;border-radius:12px!important;color:#062421!important;background:var(--aurora-primary,#64f0e5)!important;font-weight:900!important}
                @media(max-width:560px){[data-native-support-overlay]{place-items:end center!important;padding:0!important}[data-native-support-overlay] .aurora-support-panel{width:100%!important;max-height:calc(100dvh - env(safe-area-inset-top))!important;border-radius:22px 22px 0 0!important}[data-native-support-overlay] .aurora-support-panel>header{padding:17px 15px!important}[data-native-support-overlay] .aurora-support-history{min-height:180px!important}[data-native-support-overlay] .aurora-support-message{max-width:90%!important}}
            `;
            document.head.append(supportLayout);
        }
        let supportOverlay = document.querySelector("[data-native-support-overlay]");
        if (!supportOverlay) {
            supportOverlay = document.createElement("div");
            supportOverlay.className = "aurora-support-overlay";
            supportOverlay.dataset.nativeSupportOverlay = "";
            supportOverlay.hidden = true;
            supportOverlay.innerHTML = '<section class="aurora-support-panel" role="dialog" aria-modal="true" aria-label="Mensagens e suporte"><header><div><span>Suporte Aurora</span><h2>Mensagens</h2><p>Envie dúvidas, sugestões ou observações para o administrador.</p></div><button type="button" data-native-support-close aria-label="Fechar">×</button></header><div class="aurora-support-history" data-native-support-history></div><form class="aurora-support-form" data-native-support-form><label for="aurora-native-support-text">Nova mensagem</label><textarea id="aurora-native-support-text" maxlength="2000" rows="3" placeholder="Escreva sua mensagem…" required></textarea><div><small data-native-support-result aria-live="polite"></small><button type="submit">Enviar</button></div></form></section>';
            document.body.append(supportOverlay);
            const closeSupport = () => {
                supportOverlay.hidden = true;
                document.body.classList.remove("aurora-support-open");
            };
            supportOverlay.querySelector("[data-native-support-close]").addEventListener("click", closeSupport);
            supportOverlay.addEventListener("click", (event) => {
                if (event.target === supportOverlay) closeSupport();
            });
        }

        const historyHost = supportOverlay.querySelector("[data-native-support-history]");
        const form = supportOverlay.querySelector("[data-native-support-form]");
        const result = supportOverlay.querySelector("[data-native-support-result]");
        const supportClient = global.AuroraCloudSync && global.AuroraCloudSync.client;
        supportOverlay.hidden = false;
        document.body.classList.add("aurora-support-open");
        settings.classList.remove("is-open");
        syncProfileModalLock();

        if (!supportClient) {
            historyHost.innerHTML = '<div class="aurora-support-empty is-error">A conta da Aurora ainda não está disponível. Atualize a página e tente novamente.</div>';
            return;
        }

        const renderMessages = (items) => {
            historyHost.innerHTML = items.length ? items.map((item) => {
                const sender = item.sender_role === "client" ? "Você" : (item.is_automatic ? "Aurora · resposta automática" : "Aurora");
                const date = new Date(item.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
                const read = item.sender_role === "client" && item.read_at ? " · Lida" : "";
                return `<article class="aurora-support-message ${escapeHTML(item.sender_role)} ${item.is_automatic ? "automatic" : ""}"><strong>${sender}</strong><p>${escapeHTML(item.body)}</p><small>${date}${read}</small></article>`;
            }).join("") : '<div class="aurora-support-empty"><strong>Nenhuma mensagem ainda</strong><span>Quando precisar, escreva para a Aurora por aqui.</span></div>';
            historyHost.scrollTop = historyHost.scrollHeight;
        };

        const loadMessages = async () => {
            historyHost.innerHTML = '<div class="aurora-support-empty">Carregando conversa…</div>';
            const response = await supportClient.rpc("aurora_support_my_messages");
            if (response.error) throw response.error;
            const items = response.data || [];
            if (items.some((item) => item.sender_role === "admin" && !item.read_at)) {
                await supportClient.rpc("aurora_support_mark_client_read");
            }
            renderMessages(items);
        };

        form.onsubmit = async (event) => {
            event.preventDefault();
            const text = form.querySelector("textarea");
            const submit = form.querySelector("button[type='submit']");
            const body = text.value.trim();
            if (!body) return;
            submit.disabled = true;
            result.textContent = "Enviando…";
            try {
                const response = await supportClient.rpc("aurora_support_send", { p_body: body });
                if (response.error) throw response.error;
                text.value = "";
                result.textContent = "Mensagem enviada.";
                await loadMessages();
            } catch (error) {
                result.textContent = error.message || String(error);
            } finally {
                submit.disabled = false;
            }
        };

        try {
            await loadMessages();
        } catch (error) {
            historyHost.innerHTML = `<div class="aurora-support-empty is-error">${escapeHTML(error.message || String(error))}</div>`;
        }
    }

    global.AuroraOpenSupport = openNativeSupport;

    settings.querySelector("[data-support-messages]").addEventListener("click", () => {
        openNativeSupport();
    });

    settings
        .querySelector(
            "[data-onboarding-reset]"
        )
        ?.addEventListener(
            "click",
            async () => {
                settings.classList.remove(
                    "is-open"
                );
                syncProfileModalLock();
                if (!global.AuroraModuleAccess || typeof global.AuroraModuleAccess.openSwitcher !== "function") {
                    showStatus("Não foi possível carregar seus segmentos.", 2600);
                    return;
                }
                const selectionsByModule = identity.selected_services_by_module || {};
                const configuredModuleCodes = Object.keys(selectionsByModule).filter(
                    (moduleCode) => selectedServicesForModule(identity, moduleCode).length > 0
                );
                try {
                    const selected = await global.AuroraModuleAccess.openSwitcher(
                        identity.profile,
                        configuredModuleCodes
                    );
                    const currentLicense = String(identity.active_license_module_code || identity.profile || "").trim();
                    try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("MODULE_CLICK", { source: "openSwitcher", module_before: currentLicense, requested: selected && selected.module_code, selected }); } catch (_) {}
                    if (!selected || String(selected.module_code || "").trim() === currentLicense) return;
                    const confirmed = await global.AuroraDialog.confirm(
                        `O segmento ${selected.title} será aberto. O atendimento atual será encerrado, mas os relatórios serão preservados.`, { title: "Trocar segmento?", confirmLabel: "Trocar" }
                    );
                    if (!confirmed) return;
                    const operationalProfile = String(selected.operational_profile || selected.module_code || "").trim();
                    const selectedModuleCode = String(selected.module_code || "").trim();
                    let serviceIds = Array.isArray(selected.operational_services) && selected.operational_services.length
                        ? selected.operational_services.slice()
                        : [];

                    /* V138 — no modo empresarial, a configuração de serviços pertence à
                     * empresa e deve ser carregada no momento da troca de módulo. O usuário
                     * convidado não pode depender do selected_services_by_module local/legado.
                     * A mesma regra funciona para qualquer módulo futuro contratado. */
                    const selectedUsesCompanyServices = Boolean(
                        String(selected.source || "").trim() === "company" ||
                        String(selected.access_source || "").trim() === "company" ||
                        String(selected.access_status || "").trim() === "company_authorized"
                    );
                    if (!serviceIds.length && selectedUsesCompanyServices && global.AuroraCloudSync && typeof global.AuroraCloudSync.getCompanyServices === "function") {
                        try {
                            const companyServicesByModule = await global.AuroraCloudSync.getCompanyServices();
                            const configured = Array.isArray(companyServicesByModule && companyServicesByModule[selectedModuleCode])
                                ? companyServicesByModule[selectedModuleCode]
                                : (Array.isArray(companyServicesByModule && companyServicesByModule[operationalProfile])
                                    ? companyServicesByModule[operationalProfile]
                                    : []);
                            const validServiceIds = new Set(servicesForProfile(operationalProfile).map((service) => String(service && service.id || "")));
                            serviceIds = configured.map((item) => String(item || "").trim()).filter((item) => validServiceIds.has(item));
                            try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("10 SWITCH COMPANY SERVICES", { module: selectedModuleCode, profile: operationalProfile, configured: configured, accepted: serviceIds }); } catch (_) {}
                        } catch (companyServicesError) {
                            console.warn("Aurora: não foi possível hidratar os serviços empresariais durante a troca de segmento.", companyServicesError);
                        }
                    }
                    if (!serviceIds.length) {
                        serviceIds = selectedServicesForModule(identity, selectedModuleCode);
                    }
                    if (!serviceIds.length) {
                        showStatus("Este segmento ainda não possui serviços configurados.", 2800);
                        return;
                    }
                    const selectedLicenseCode = String(selected.license_module_code || selected.module_code || "").trim();
                    try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("BEFORE_PERSIST", { source: "openSwitcher", module_before: currentLicense, requested_module: selectedLicenseCode, profile_before: identity.profile, profile_next: operationalProfile, preferred_service_next: serviceIds[0] || "", selected_services_next: serviceIds }); } catch (_) {}
                    repository.clear();
                    saveIdentity({
                        ...identity,
                        profile: operationalProfile,
                        active_license_module_code: String(selected.license_module_code || selected.module_code || "").trim(),
                        preferred_service: serviceIds[0] || "",
                        active_module_title: selected.title,
                        active_module_access_status: selected.access_status,
                        active_module_ends_at: selected.ends_at || "",
                        selected_services: serviceIds,
                        selected_services_by_module: {
                            ...(identity.selected_services_by_module || {}),
                            [String(selected.module_code || "").trim()]: serviceIds,
                            [operationalProfile]: serviceIds
                        }
                    });
                    if (typeof global.AuroraModuleAccess.activateForUser === "function") {
                        global.AuroraModuleAccess.activateForUser(selectedLicenseCode, resolveLoggedInUserId());
                    } else {
                        global.AuroraModuleAccess.activate(selectedLicenseCode);
                    }
                    if (typeof global.AuroraModuleAccess.markExplicitSessionModuleForUser === "function") {
                        global.AuroraModuleAccess.markExplicitSessionModuleForUser(selectedLicenseCode, resolveLoggedInUserId());
                    }
                    try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("BEFORE_RELOAD", { source: "openSwitcher", requested_module: selectedLicenseCode, authenticated_uid: resolveLoggedInUserId() }); } catch (_) {}
                    window.location.reload();
                } catch (error) {
                    showStatus(error.message || "Não foi possível trocar o segmento.", 3200);
                }
            }
        );

    settings
        .querySelector("[data-edit-segment-services]")
        ?.addEventListener("click", async () => {
            settings.classList.remove("is-open");
            syncProfileModalLock();
            const currentServices = selectedServicesForModule(identity, identity.profile);
            try {
                const selection = normalizeServiceSelectionResult(await chooseServicesForModule(identity.profile, {
                    editing: true,
                    selectedServices: currentServices
                }));
                const serviceIds = selection.services;
                if (!serviceIds) return;
                const selectionsByModule = {
                    ...(identity.selected_services_by_module || {}),
                    [identity.profile]: serviceIds
                };
                saveIdentity({
                    ...identity,
                    selected_services: serviceIds,
                    selected_services_by_module: selectionsByModule
                });
                showStatus(
                    selection.pending
                        ? "Alterações salvas neste dispositivo. Serão sincronizadas quando houver conexão."
                        : "Serviços do segmento atualizados.",
                    selection.pending ? 3200 : 1600
                );
                setTimeout(() => global.location.reload(), 450);
            } catch (error) {
                showStatus(error.message || "Não foi possível atualizar os serviços.", 3200);
            }
        });

    settings
        .querySelector("[data-demo-info]")
        ?.addEventListener("click", async () => {
            settings.classList.remove("is-open");
            syncProfileModalLock();
            if (!global.AuroraModuleAccess) {
                showStatus("Os Módulos Aurora não puderam ser carregados.", 2600);
                return;
            }
            try {
                const selected = await global.AuroraModuleAccess.openManager(identity.profile);
                if (!selected) return;
                try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("MODULE_CLICK", { source: "openManager", module_before: identity.active_license_module_code || identity.profile, requested: selected.module_code, selected }); } catch (_) {}
                const moduleCode = selected.module_code;
                const activation = await global.AuroraModuleAccess.resolveOperationalActivation(selected);
                const profileCode = String(activation.profile || moduleCode);
                let serviceIds = Array.isArray(activation.serviceIds) && activation.serviceIds.length
                    ? activation.serviceIds.slice()
                    : selectedServicesForModule(identity, profileCode);
                if (!serviceIds.length) {
                    const selection = normalizeServiceSelectionResult(await chooseServicesForModule(profileCode));
                    serviceIds = selection.services;
                    if (!serviceIds) return;
                }
                const selectionsByModule = {
                    ...(identity.selected_services_by_module || {}),
                    [moduleCode]: serviceIds,
                    [profileCode]: serviceIds
                };
                const preferredMeta = servicesForProfile(profileCode).find(
                    (service) => String(service && service.id || "") === String(serviceIds[0] || "")
                ) || {};
                try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("BEFORE_PERSIST", { source: "openManager", module_before: identity.active_license_module_code || identity.profile, requested_module: moduleCode, profile_before: identity.profile, profile_next: profileCode, preferred_service_next: serviceIds[0] || "", selected_services_next: serviceIds }); } catch (_) {}
                /* R38 — Módulos Aurora precisa persistir a LICENÇA selecionada, não
                 * apenas o profile operacional. Isso é indispensável para módulos
                 * distintos que reutilizam o mesmo profile (electrical x eletrica_tupy),
                 * sobretudo no reload offline, quando não existe cloud para reconciliar. */
                saveIdentity({
                    ...identity,
                    profile: profileCode,
                    active_license_module_code: moduleCode,
                    preferred_service: serviceIds[0] || "",
                    preferred_service_title: preferredMeta.title || "",
                    active_module_title: selected.title || identity.active_module_title || "",
                    active_module_access_status: selected.access_status || identity.active_module_access_status || "",
                    active_module_ends_at: selected.ends_at || "",
                    selected_services: serviceIds,
                    selected_services_by_module: selectionsByModule
                });
                /* R40 — Módulos Aurora usa a mesma autoridade canônica de Trocar segmento.
                 * A seleção precisa sobreviver ao reload offline pela chave da UID autenticada
                 * e pelo marcador explícito da mesma UID; activate() isolado podia gravar em
                 * outra autoridade durante a transição e o bootstrap restaurava Elétrica. */
                if (typeof global.AuroraModuleAccess.activateForUser === "function") {
                    global.AuroraModuleAccess.activateForUser(moduleCode, resolveLoggedInUserId());
                } else {
                    global.AuroraModuleAccess.activate(moduleCode);
                }
                if (typeof global.AuroraModuleAccess.markExplicitSessionModuleForUser === "function") {
                    global.AuroraModuleAccess.markExplicitSessionModuleForUser(moduleCode, resolveLoggedInUserId());
                }
                try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("BEFORE_RELOAD", { source: "openManager", requested_module: moduleCode, authenticated_uid: resolveLoggedInUserId() }); } catch (_) {}
                global.location.reload();
            } catch (error) {
                showStatus(error.message || String(error), 3200);
            }
        });

    settings
        .querySelector(
            "[data-theme-settings]"
        )
        .addEventListener(
            "click",
            () => {
                shell.themeManager.toggle();
            }
        );

    const companyLogoInput =
        queryCompany(
            "[data-company-logo]"
        );

    const companyLogoPreview =
        queryCompany(
            "[data-company-logo-preview]"
        );

    const companyLogoTransparency =
        queryCompany(
            "[data-company-logo-transparency]"
        );

    const companyLogoTransparencyValue =
        queryCompany(
            "[data-company-logo-transparency-value]"
        );

    const companyLogoReportScale = queryCompany("[data-company-logo-report-scale]");
    const companyLogoReportScaleValue = queryCompany("[data-company-logo-report-scale-value]");

    const applyReportLogoScale = (value) => {
        const scale = Math.max(200, Math.min(300, Number(value) || 200));
        identity.logo_report_scale = scale;
        if (companyLogoReportScaleValue) companyLogoReportScaleValue.textContent = `${scale}%`;
        markIdentityFormDirty();
    };

    if (companyLogoReportScale) {
        companyLogoReportScale.addEventListener("input", () => applyReportLogoScale(companyLogoReportScale.value));
        companyLogoReportScale.addEventListener("change", () => applyReportLogoScale(companyLogoReportScale.value));
    }

    const companyCoverPhotoReportScale = queryCompany("[data-company-cover-photo-report-scale]");
    const companyCoverPhotoReportScaleValue = queryCompany("[data-company-cover-photo-report-scale-value]");
    const applyReportCoverPhotoScale = (value) => {
        const scale = Math.max(150, Math.min(250, Number(value) || 150));
        identity.cover_photo_report_scale = scale;
        if (companyCoverPhotoReportScaleValue) companyCoverPhotoReportScaleValue.textContent = `${scale}%`;
        markIdentityFormDirty();
    };
    if (companyCoverPhotoReportScale) {
        companyCoverPhotoReportScale.addEventListener("input", () => applyReportCoverPhotoScale(companyCoverPhotoReportScale.value));
        companyCoverPhotoReportScale.addEventListener("change", () => applyReportCoverPhotoScale(companyCoverPhotoReportScale.value));
    }

    const applyHomeLogoTransparency = (value) => {
        const transparency = Math.max(0, Math.min(90, Number(value) || 0));
        const opacity = Math.max(0.1, 1 - transparency / 100);
        identity.logo_transparency = transparency;
        if (companyLogoTransparencyValue) {
            companyLogoTransparencyValue.textContent = `${transparency}%`;
        }
        if (companyLogoPreview) {
            companyLogoPreview.style.opacity = String(opacity);
        }
        const hero = homeLayer.querySelector(".aurora-home-hero");
        if (hero) {
            hero.style.setProperty(
                "--aurora-user-logo-opacity",
                String(opacity)
            );
        }
    };

    if (identity.logo && companyLogoPreview) {
        companyLogoPreview.src =
            identity.logo;
        companyLogoPreview.hidden =
            false;
    }

    if (companyLogoTransparency) {
        applyHomeLogoTransparency(companyLogoTransparency.value);
        companyLogoTransparency.addEventListener("input", (event) => {
            applyHomeLogoTransparency(event.target.value);
        });
        companyLogoTransparency.addEventListener("change", (event) => {
            applyHomeLogoTransparency(event.target.value);
            markIdentityDirty();
        });
    }

    if (companyLogoInput) {
        companyLogoInput.addEventListener(
            "click",
            armCompanyLogoPickerGuard
        );
        global.addEventListener("visibilitychange", () => {
            if (
                companyLogoPickerGuard &&
                document.visibilityState === "visible"
            ) {
                releaseCompanyLogoPickerGuard();
            }
        });
        companyLogoInput.addEventListener(
            "change",
            (event) => {
                const file =
                    event.target.files &&
                    event.target.files[0];

                if (!file) {
                    releaseCompanyLogoPickerGuard();
                    return;
                }

                pendingCompanyLogo = (async () => {
                    try {
                        identity.logo =
                            await compressCompanyLogoFile(
                                file
                            );

                        if (companyLogoPreview) {
                            companyLogoPreview.src =
                                identity.logo;
                            companyLogoPreview.hidden =
                                false;
                        }

                        markIdentityDirty();
                        const hero = homeLayer.querySelector(".aurora-home-hero");
                        let heroLogo = hero && hero.querySelector(".aurora-home-hero__company-logo");

                        if (hero && !heroLogo) {
                            heroLogo = document.createElement("img");
                            heroLogo.className = "aurora-home-hero__company-logo";
                            heroLogo.alt = "Logo da empresa";
                            hero.insertBefore(heroLogo, hero.firstChild);
                        }

                        if (heroLogo) {
                            heroLogo.src = identity.logo;
                        }
                    } catch (error) {
                        showStatus(
                            (error && error.message) ||
                            "Não foi possível usar esta imagem como logo.",
                            3200
                        );
                    } finally {
                        event.target.value = "";
                        releaseCompanyLogoPickerGuard();
                    }
                })();
            }
        );
    }

    if (identityForm) {
        identityForm.addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();

                const result = await persistIdentityForm({
                    force: true
                });
                if (result && result.local !== false) {
                    await closeCompanyModal({ save: false });
                }
            }
        );
    }

    captureIdentityBaseline();

    /* API usada pelo modo ADMIN REVIEW (flow.js) — mesmas funções locais de renderHome. */
    async function refreshData() {
        const cloud = global.AuroraCloudSync;
        if (!cloud || typeof cloud.refreshApplicationData !== "function") {
            showStatus("Atualização indisponível.", 2400);
            return { ok: false, reason: "refresh_unavailable" };
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            showStatus("Você está offline. Os dados locais foram preservados.", 2800);
            return { ok: false, offline: true };
        }
        showStatus("Atualizando dados da Aurora…", 1800);
        const refreshed = await cloud.refreshApplicationData();
        const byModule = refreshed.company_services || {};
        const profileCode = String(identity.profile || "").trim();
        const licenseCode = String(identity.active_license_module_code || profileCode).trim();
        const activeModule = (Array.isArray(refreshed.modules) ? refreshed.modules : []).find((item) =>
            String(item.module_code || "") === licenseCode || String(item.module_code || "") === profileCode
        );
        const activeModuleUsesCompanyServices = Boolean(
            activeModule &&
            (
                String(activeModule.source || "").trim() === "company" ||
                String(activeModule.access_source || "").trim() === "company" ||
                String(activeModule.access_status || "").trim() === "company_authorized"
            )
        );
        const inherited = activeModuleUsesCompanyServices
            ? (Array.isArray(byModule[profileCode])
                ? byModule[profileCode]
                : (Array.isArray(byModule[licenseCode]) ? byModule[licenseCode] : null))
            : null;
        if (inherited) {
            const valid = selectedServicesForModule({ selected_services_by_module: { [profileCode]: inherited } }, profileCode);
            identity.selected_services = valid;
            identity.selected_services_by_module = { ...(identity.selected_services_by_module || {}), ...byModule, [profileCode]: valid };
            if (!valid.includes(String(identity.preferred_service || ""))) identity.preferred_service = String(valid[0] || "");
            const allowed = new Set(valid.map((item) => String(item)));
            homeLayer.querySelectorAll("[data-operational-service-grid] [data-service-id]").forEach((card) => {
                card.hidden = !allowed.has(String(card.dataset.serviceId || ""));
            });
            const serviceCount = homeLayer.querySelector("[data-home-service-count]");
            if (serviceCount) serviceCount.textContent = `${valid.length} serviços disponíveis`;
        }
        if (activeModule) {
            identity.active_module_access_status = activeModule.access_status || activeModule.availability || identity.active_module_access_status;
            identity.active_module_ends_at = activeModule.ends_at || identity.active_module_ends_at || "";
        }
        const companyIdentity = refreshed.company_identity;
        if (companyIdentity && companyIdentity.company_id) {
            identity.logo = String(companyIdentity.logo || "");
            const transparency = Number(companyIdentity.logo_transparency ?? 70);
            identity.logo_transparency = transparency <= 1 ? transparency * 100 : transparency;
        }
        saveIdentity(identity);
        syncUserProfileFromIdentity(identity);

        /* V89 — atualização limpa.
           refreshApplicationData() já hidrata/persiste o estado necessário.
           Não chamar renderHome() novamente dentro da instância já montada:
           isso cria uma segunda árvore de Home/controllers e deixa navegação,
           ativos e footer apontando para instâncias diferentes.
           Após concluir a hidratação, um reload único reaplica o bootstrap
           normal sobre o estado recém-atualizado. */
        showStatus(refreshed.warnings && refreshed.warnings.length ? "Dados atualizados com pendências de rede." : "Aurora atualizada.", 900);
        global.setTimeout(() => global.location.reload(), 120);
        return { ok: true, data: refreshed, reload: true };
    }

    global.AuroraUi = Object.assign(global.AuroraUi || {}, {
        showWorkflow: showWorkflow,
        showGestaoEletricaTupy: showGestaoEletricaTupy,
        showHome: showHome,
        isAdminReviewCase: isAdminReviewCase,
        persistRuntimeCaseIfAllowed: persistRuntimeCaseIfAllowed,
        refreshData: refreshData
    });

    /* R25 — refresh pós-relatório estritamente cirúrgico.
     * A R24 chamava renderHome() outra vez e criava uma segunda árvore visual
     * sobre a Home existente. Isso deixava Perfil/Config temporariamente ligado
     * a um estado incompleto até o próximo fechamento do modal.
     *
     * O fechamento de relatório só precisa atualizar métricas/Atendimentos
     * recentes. Reutilizamos syncHomeReports(), que já foi criado para esse
     * objetivo e mantém AppShell, Perfil, permissões e cards intactos. */
    global.addEventListener("aurora:completed-report-refresh", () => {
        try {
            syncHomeReports();
        } catch (error) {
            console.warn("Aurora: atualização silenciosa dos atendimentos recentes ficou pendente.", error);
        }
    });

    if (
        global.AuroraHomeReturnTrace &&
        typeof global.AuroraHomeReturnTrace.setNextHomeOrigin === "function"
    ) {
        global.AuroraHomeReturnTrace.setNextHomeOrigin(
            "BOOT",
            "INITIAL_HOME"
        );
    }

    showHome();
}

try {
    auroraBootMark("BOOT_STORAGE_START");
    auroraBootMark("BOOT_STORAGE_OK");

    auroraBootMark("BOOT_AUTH_START");
    let authenticatedSession = null;
    r46mark("AUTH_BEFORE_AWAIT", {
        aurora_auth_ready_exists: Boolean(global.AuroraAuthReady),
        aurora_auth_ready_type: typeof global.AuroraAuthReady,
        aurora_auth_ready_thenable: Boolean(global.AuroraAuthReady && typeof global.AuroraAuthReady.then === "function"),
        account_uid_before: String(global.AURORA_ACCOUNT_USER_ID || ""),
        resolve_logged_in_user_id_present: typeof resolveLoggedInUserId === "function"
    }, "auth-local");
    if (global.AuroraAuthReady) {
        v78mark("AUTH_WAIT", "aguardando AuroraAuthReady");
            try {
                Promise.resolve(global.AuroraAuthReady).then(
                    (session) => r46mark("AUTH_PROMISE_RESOLVED", {
                        session_present: Boolean(session),
                        session_user_present: Boolean(session && session.user),
                        session_user_id_present: Boolean(session && session.user && session.user.id),
                        session_user_id: session && session.user && session.user.id || "",
                        account_uid_at_resolution: String(global.AURORA_ACCOUNT_USER_ID || ""),
                        offline_license_state: String(global.AURORA_OFFLINE_LICENSE_STATE || ""),
                        offline_startup_context_present: Boolean(global.AURORA_OFFLINE_STARTUP_CTX)
                    }, "auth-local"),
                    (authError) => r46mark("AUTH_PROMISE_REJECTED", {
                        error_name: authError && authError.name || "",
                        error_message: authError && authError.message || String(authError || ""),
                        stack: authError && authError.stack || "",
                        account_uid_at_rejection: String(global.AURORA_ACCOUNT_USER_ID || "")
                    }, "auth-local")
                );
            } catch (_) {}
            authenticatedSession = await global.AuroraAuthReady;
            v78mark("AUTH_OK", authenticatedSession && authenticatedSession.user ? authenticatedSession.user.id : "sem user");
    }
    r46mark("AUTH_AFTER_AWAIT", {
        session_present: Boolean(authenticatedSession),
        session_user_present: Boolean(authenticatedSession && authenticatedSession.user),
        session_user_id_present: Boolean(authenticatedSession && authenticatedSession.user && authenticatedSession.user.id),
        session_user_id: authenticatedSession && authenticatedSession.user && authenticatedSession.user.id || "",
        account_uid_after: String(global.AURORA_ACCOUNT_USER_ID || ""),
        resolved_logged_in_uid: typeof resolveLoggedInUserId === "function" ? String(resolveLoggedInUserId() || "") : ""
    }, "auth-local");

    const authenticatedUserIdFromSession = String(
        authenticatedSession && authenticatedSession.user
            ? authenticatedSession.user.id || ""
            : ""
    ).trim();
    const authenticatedUserIdFromGlobal = String(global.AURORA_ACCOUNT_USER_ID || "").trim();
    const authenticatedUserIdFromResolver = String(
        typeof resolveLoggedInUserId === "function" ? resolveLoggedInUserId() || "" : ""
    ).trim();
    const authenticatedUserId =
        authenticatedUserIdFromSession ||
        authenticatedUserIdFromGlobal ||
        authenticatedUserIdFromResolver;
    r46mark("AUTH_UID_AUTHORITY_R46", {
        session_uid_present: Boolean(authenticatedUserIdFromSession),
        global_uid_present: Boolean(authenticatedUserIdFromGlobal),
        resolver_uid_present: Boolean(authenticatedUserIdFromResolver),
        chosen_authority: authenticatedUserIdFromSession
            ? "authenticated_session"
            : authenticatedUserIdFromGlobal
                ? "account_global"
                : authenticatedUserIdFromResolver
                    ? "official_local_user_resolver"
                    : "none",
        chosen_uid: authenticatedUserId
    }, "auth-local");
    try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("AUTH_LOCAL_RESOLVED", { uid_global: global.AURORA_ACCOUNT_USER_ID || "", uid_authenticated: authenticatedUserId, session_user: authenticatedSession && authenticatedSession.user && authenticatedSession.user.id }); } catch (_) {}
    if (!authenticatedUserId) {
        throw new Error("A conta autenticada não foi identificada.");
    }
    auroraBootMark("BOOT_AUTH_OK", {
        userId: authenticatedUserId
    });

    /* V144 — LEI DE BLOQUEIO EMPRESARIAL.
     * Esta checagem acontece ANTES de módulos, identidade local, onboarding ou trial.
     * Membership bloqueada nunca pode cair em Individual/Empresarial nem iniciar demonstração. */
    let membershipPreflightV144 = null;
    if (global.AuroraModulesApi && typeof global.AuroraModulesApi.getMyCompanyMembershipState === "function") {
        try { membershipPreflightV144 = await global.AuroraModulesApi.getMyCompanyMembershipState(); } catch (_) {}
    }
    const preflightStatusV144 = String(membershipPreflightV144 && membershipPreflightV144.status || "").trim().toLowerCase();
    const preflightRoleV144 = String(membershipPreflightV144 && membershipPreflightV144.role || "").trim().toUpperCase();
    const preflightBlockedV144 = Boolean(
        membershipPreflightV144 && membershipPreflightV144.company_id &&
        ["COMPANY_USER", "USER_BOLT"].includes(preflightRoleV144) &&
        ["blocked", "bloqueado", "disabled", "suspended", "inactive"].includes(preflightStatusV144)
    );
    if (preflightBlockedV144) {
        const appHost = document.getElementById("app");
        if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.clear === "function") global.AuroraCompanyAccess.clear();
        global.AURORA_MEMBER_BLOCKED = true;
        const safeCompanyName = String(membershipPreflightV144.company_name || "sua empresa")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
        if (appHost) {
            appHost.innerHTML = `
                <div data-aurora-membership-blocked style="position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:#07111f;font-family:inherit;box-sizing:border-box;">
                    <section style="width:min(680px,100%);margin:0 0 max(18px,env(safe-area-inset-bottom));padding:28px;border:1px solid rgba(103,217,255,.28);border-radius:28px;background:#111d30;color:#f4f8ff;box-shadow:0 24px 80px rgba(0,0,0,.45);box-sizing:border-box;">
                        <div style="font-size:13px;font-weight:800;letter-spacing:.16em;color:#65e4df;margin-bottom:10px;">AURORA</div>
                        <h1 style="font-size:30px;line-height:1.08;margin:0 0 14px;font-weight:800;">Acesso temporariamente bloqueado</h1>
                        <p style="font-size:18px;line-height:1.55;margin:0 0 22px;color:#b7c3d7;">Seu acesso à <strong style="color:#f4f8ff;">${safeCompanyName}</strong> foi temporariamente desativado pelo administrador. Esta conta não pode iniciar outro ambiente ou demonstração enquanto estiver bloqueada.</p>
                        <button type="button" data-refresh-blocked-membership style="width:100%;min-height:58px;border:0;border-radius:18px;background:#63e2dd;color:#07131e;font:inherit;font-size:18px;font-weight:800;cursor:pointer;">Atualizar Aurora</button>
                        <button type="button" data-signout-blocked-membership style="width:100%;min-height:52px;margin-top:10px;border:1px solid #30445f;border-radius:18px;background:transparent;color:#e8f1ff;font:inherit;font-size:16px;font-weight:750;cursor:pointer;">Sair / usar outro e-mail</button>
                        <div style="margin-top:16px;text-align:center;font-size:11px;color:#718097;">AURORA_V144_GATE_BLOQUEIO_EMPRESARIAL_17-09-2026</div>
                    </section>
                </div>`;
            appHost.querySelector("[data-refresh-blocked-membership]")?.addEventListener("click", () => location.reload());
            appHost.querySelector("[data-signout-blocked-membership]")?.addEventListener("click", async (event) => {
                const button = event.currentTarget; button.disabled = true; button.textContent = "Saindo…";
                if (global.AuroraCloudSync && typeof global.AuroraCloudSync.signOutForMembershipGate === "function") await global.AuroraCloudSync.signOutForMembershipGate();
                else location.reload();
            });
        }
        auroraBootMark("BOOT_MEMBER_BLOCKED_V144_PRE_ONBOARDING");
        return;
    }

    auroraBootMark("BOOT_MODULES_START");

    r46mark("ONBOARDING_ENGINE_SCRIPT_EXPECTED", {
        asset: "./core/onboarding/onboarding_engine.js?v=AURORA_V47_RC1_R59_CANONICAL_REPORT_COMPACTION",
        expected_build: "AURORA V47 RC1 R59 CANONICAL REPORT COMPACTION"
    }, "modules");
    r46mark("ONBOARDING_ENGINE_BEFORE_BOOT", {
        engine_present: Object.prototype.hasOwnProperty.call(global, "OnboardingEngine"),
        controller_present: Object.prototype.hasOwnProperty.call(global, "OnboardingController")
    }, "modules");
    r46mark("ONBOARDING_ENGINE_TYPE", {
        engine_type: typeof global.OnboardingEngine,
        controller_type: typeof global.OnboardingController
    }, "modules");
    if (typeof global.OnboardingEngine !== "function") {
        r46mark("ASSET_VERSION_MISMATCH", {
            asset: "core/onboarding/onboarding_engine.js",
            expected_build: "AURORA V47 RC1 R59 CANONICAL REPORT COMPACTION",
            loaded_build: String(global.__AURORA_BOOTSTRAP_BUILD__ || "[AUSENTE]"),
            source_cache: "service-worker-or-network",
            provider_type: typeof global.OnboardingEngine
        }, "modules");
    }

    const onboardingEngine =
        new global.OnboardingEngine({
            storageKey:
                COMPANY_STORAGE_KEY,
            configUrl:
                "./config/onboarding.json",
            ownerUserId:
                authenticatedUserId
        });

    if (
        global.AuroraModuleAccess &&
        typeof global.AuroraModuleAccess.registerOnboardingSegments === "function"
    ) {
        const onboardingConfig = await onboardingEngine.loadConfig();
        global.AuroraModuleAccess.registerOnboardingSegments(onboardingConfig.segments);
    }

    /* Contas existentes em um domínio novo ainda não possuem identidade local. */
    let identity = onboardingEngine.getProfile();
    let selectedModule = null;
    let accountModules = [];

    if (global.AuroraModulesApi) {
        if (
            global.AuroraOfflineLicense &&
            typeof global.AuroraOfflineLicense.loadStartupModulesWithOfflineFallback === "function"
        ) {
            accountModules = await global.AuroraOfflineLicense.loadStartupModulesWithOfflineFallback(
                authenticatedUserId,
                () => global.AuroraModulesApi.listMyModules()
            );
        } else {
            accountModules = await global.AuroraModulesApi.listMyModules();
        }
    }

    if (
        global.AuroraModuleAccess &&
        typeof global.AuroraModuleAccess.mergeCompanyEntitlementAccess === "function"
    ) {
        accountModules = await global.AuroraModuleAccess.mergeCompanyEntitlementAccess(accountModules);
    }

    let existingAccess = pickPreferredAccessibleModule(accountModules);
    try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("01 LIST_MY_MODULES", (accountModules || []).map((x) => ({ module_code: x && x.module_code, can_access: x && x.can_access }))); } catch (_) {}

    /* V123 — entrada Bolt baseada na licença real, antes do perfil cloud legado.
     * O diagnóstico V122 provou que o navegador/perfil chega como electrical+panel
     * antes da hidratação empresarial, embora listMyModules já devolva eletrica_tupy
     * can_access=true. Em uma sessão sem troca explícita feita pelo usuário, a licença
     * privada eletrica_tupy é a autoridade de entrada. Uma troca manual em Módulos
     * grava apenas um marcador de sessão e continua prevalecendo até logout. */
    const explicitSessionModule = global.AuroraModuleAccess &&
        typeof global.AuroraModuleAccess.readExplicitSessionModule === "function"
        ? String(global.AuroraModuleAccess.readExplicitSessionModule(authenticatedUserId) || "").trim()
        : "";
    const tupyLicensedAccess = accountModules.find((item) =>
        String(item && item.module_code || "").trim() === "eletrica_tupy" &&
        item && item.can_access === true
    ) || null;
    if (tupyLicensedAccess && !explicitSessionModule) {
        try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("02 DECISAO INICIAL TUPY", { explicitSessionModule, chosen: "eletrica_tupy" }); } catch (_) {}
        existingAccess = tupyLicensedAccess;
        if (global.AuroraModuleAccess) {
            /* V127 — neste ponto AURORA_ACCOUNT_USER_ID ainda pode não estar publicado.
             * activate() usa esse global e, quando vazio, grava :anonymous.
             * Grave a licença privada diretamente na chave canônica do usuário autenticado. */
            if (typeof global.AuroraModuleAccess.activateForUser === "function") {
                global.AuroraModuleAccess.activateForUser("eletrica_tupy", authenticatedUserId);
            } else if (typeof global.AuroraModuleAccess.activate === "function") {
                global.AuroraModuleAccess.activate("eletrica_tupy");
            }
        }
    } else if (explicitSessionModule) {
        const explicitAccess = accountModules.find((item) =>
            String(item && item.module_code || "").trim() === explicitSessionModule &&
            item && item.can_access === true
        );
        if (explicitAccess) existingAccess = explicitAccess;
    }
    const activeCompanyMembership = hasActiveCompanyMembership();
    let companyEntitlementAccess = null;
    if (
        activeCompanyMembership &&
        global.AuroraModuleAccess &&
        typeof global.AuroraModuleAccess.resolveCompanyEntitlementAccess === "function"
    ) {
        companyEntitlementAccess = await global.AuroraModuleAccess.resolveCompanyEntitlementAccess(
            global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
                ? global.AuroraCompanyAccess.get()
                : global.AURORA_COMPANY_ACCESS
        );
    }
    if (companyEntitlementAccess) {
        /* V25/V45 — membership empresarial + autorização do membro são a autoridade.
         * V123: se a licença privada Tupy já foi confirmada por listMyModules e não
         * houve troca explícita nesta sessão, não rebaixar a entrada para electrical. */
        existingAccess = (tupyLicensedAccess && !explicitSessionModule)
            ? tupyLicensedAccess
            : companyEntitlementAccess;
    } else if (activeCompanyMembership && isCompanyOperationalUser()) {
        /* V45 — convidado ativo sem ambiente concedido: Home empresarial restrita.
         * Perfil/licença pessoal anterior jamais concede ambiente implicitamente. */
        existingAccess = null;
        global.AURORA_MEMBER_AWAITING_ENVIRONMENT = true;
    } else if (activeCompanyMembership) {
        throw companyModuleUnavailableError();
    }
    try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("COMPANY_RULE_EVALUATED", { active_company_membership: activeCompanyMembership, company_entitlement_access: companyEntitlementAccess, explicit_session_module: explicitSessionModule, tupy_licensed_access: tupyLicensedAccess, existing_access: existingAccess, awaiting_environment: global.AURORA_MEMBER_AWAITING_ENVIRONMENT === true }); } catch (_) {}
    const skipCloudProfileBootstrap = typeof navigator !== "undefined" &&
        navigator.onLine === false &&
        global.AURORA_LICENSE_CONFIG &&
        global.AURORA_LICENSE_CONFIG.offline_license_v1 !== false;

    let cloudProfile = null;
    if (
        !skipCloudProfileBootstrap &&
        global.AuroraModulesApi &&
        typeof global.AuroraModulesApi.getMyProfile === "function"
    ) {
        try {
            cloudProfile = await global.AuroraModulesApi.getMyProfile();
            console.info("[MULTIDEVICE] identity cloud loaded");
            if (
                global.AuroraUserProfile &&
                typeof global.AuroraUserProfile.syncFromCloudProfile === "function"
            ) {
                global.AuroraUserProfile.syncFromCloudProfile(cloudProfile);
            }
        } catch (error) {
            console.warn("[MULTIDEVICE] identity cloud unavailable", {
                message: String(error && error.message || error || "error")
            });
        }
    }

    /* V143 — membership empresarial bloqueada é um estado de acesso, não onboarding.
     * Nunca oferecer Individual/Empresarial enquanto a conta ainda pertence à empresa. */
    const membershipClaimV143 = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
        ? global.AuroraCompanyAccess.get()
        : (global.AURORA_COMPANY_ACCESS || {});
    const membershipStatusV143 = String(membershipClaimV143 && membershipClaimV143.status || "").trim().toLowerCase();
    const membershipRoleV143 = String(membershipClaimV143 && membershipClaimV143.role || "").trim().toUpperCase();
    const blockedCompanyUserV143 = Boolean(
        membershipClaimV143 && membershipClaimV143.company_id &&
        (membershipRoleV143 === "COMPANY_USER" || membershipRoleV143 === "USER_BOLT") &&
        ["blocked", "bloqueado", "disabled", "suspended", "inactive"].includes(membershipStatusV143)
    );
    if (blockedCompanyUserV143) {
        const appHost = document.getElementById("app");
        const safeCompanyName = String(membershipClaimV143.company_name || "sua empresa")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
        if (appHost) {
            appHost.innerHTML = `
                <div data-aurora-membership-blocked style="position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:#07111f;font-family:inherit;box-sizing:border-box;">
                    <section style="width:min(680px,100%);margin:0 0 max(18px,env(safe-area-inset-bottom));padding:28px;border:1px solid rgba(103,217,255,.28);border-radius:28px;background:#111d30;color:#f4f8ff;box-shadow:0 24px 80px rgba(0,0,0,.45);box-sizing:border-box;">
                        <div style="font-size:13px;font-weight:800;letter-spacing:.16em;color:#65e4df;margin-bottom:10px;">AURORA</div>
                        <h1 style="font-size:30px;line-height:1.08;margin:0 0 14px;font-weight:800;">Acesso temporariamente bloqueado</h1>
                        <p style="font-size:18px;line-height:1.55;margin:0 0 22px;color:#b7c3d7;">Seu acesso à <strong style="color:#f4f8ff;">${safeCompanyName}</strong> foi temporariamente desativado pelo administrador. Quando seu acesso for reativado, toque em <strong style="color:#f4f8ff;">Atualizar Aurora</strong>.</p>
                        <button type="button" data-refresh-blocked-membership style="width:100%;min-height:58px;border:0;border-radius:18px;background:#63e2dd;color:#07131e;font:inherit;font-size:18px;font-weight:800;cursor:pointer;">Atualizar Aurora</button>
                        <button type="button" data-signout-blocked-membership style="width:100%;min-height:52px;margin-top:10px;border:1px solid #30445f;border-radius:18px;background:transparent;color:#e8f1ff;font:inherit;font-size:16px;font-weight:750;cursor:pointer;">Sair / usar outro e-mail</button>
                        <div style="margin-top:16px;text-align:center;font-size:11px;color:#718097;">AURORA_V144_GATE_BLOQUEIO_EMPRESARIAL_17-09-2026</div>
                    </section>
                </div>`;
            const refreshBlocked = appHost.querySelector("[data-refresh-blocked-membership]");
            if (refreshBlocked) refreshBlocked.addEventListener("click", () => location.reload());
            const signoutBlocked = appHost.querySelector("[data-signout-blocked-membership]");
            if (signoutBlocked) signoutBlocked.addEventListener("click", async () => {
                signoutBlocked.disabled = true;
                signoutBlocked.textContent = "Saindo…";
                if (global.AuroraCloudSync && typeof global.AuroraCloudSync.signOutForMembershipGate === "function") {
                    await global.AuroraCloudSync.signOutForMembershipGate();
                } else { location.reload(); }
            });
        }
        auroraBootMark("BOOT_MEMBER_BLOCKED_V143");
        return;
    }

    if (!onboardingEngine.isComplete(identity)) {
        if (
            !existingAccess &&
            activeCompanyMembership &&
            global.AuroraModuleAccess &&
            typeof global.AuroraModuleAccess.resolveCompanyEntitlementAccess === "function"
        ) {
            existingAccess = await global.AuroraModuleAccess.resolveCompanyEntitlementAccess(
                global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
                    ? global.AuroraCompanyAccess.get()
                    : global.AURORA_COMPANY_ACCESS
            );
        }

        /* V24 — membership empresarial é autoridade. Um convidado já aceito não
         * pode cair novamente no onboarding Individual/Empresarial. */
        if ((!existingAccess || !global.AuroraModulesApi || !global.AuroraModulesApi.getMyProfile) && !activeCompanyMembership) {
            const onboarding = new global.OnboardingController({ engine: onboardingEngine });
            identity = await onboarding.run();
            syncUserProfileFromIdentity(identity);
            if (global.AuroraCloudSync && typeof global.AuroraCloudSync.syncMyProfile === "function") {
                await global.AuroraCloudSync.syncMyProfile(identity);
            }
        } else if (skipCloudProfileBootstrap) {
            if (
                !identity ||
                (
                    !resolveLoggedInUserFullName() &&
                    !String(identity.professional || "").trim()
                )
            ) {
                const onboarding = new global.OnboardingController({ engine: onboardingEngine });
                identity = await onboarding.run();
                syncUserProfileFromIdentity(identity);
            }
        } else {
            cloudProfile = cloudProfile || {};
            const existingIdentity = onboardingEngine.getProfile() || {};
            const companyAccessClaim = global.AuroraCompanyAccess &&
                typeof global.AuroraCompanyAccess.get === "function"
                ? global.AuroraCompanyAccess.get()
                : (global.AURORA_COMPANY_ACCESS || {});
            const company = String(
                cloudProfile.company_name ||
                cloudProfile.company ||
                cloudProfile.business_name ||
                cloudProfile.organization_name ||
                companyAccessClaim.company_name ||
                existingIdentity.company ||
                ""
            ).trim();
            const cloudSelectedServices = Array.isArray(cloudProfile.selected_services)
                ? cloudProfile.selected_services.map((item) => String(item))
                : [];
            const cloudSelectionsByModule = cloudProfile.selected_services_by_module &&
                typeof cloudProfile.selected_services_by_module === "object" &&
                !Array.isArray(cloudProfile.selected_services_by_module)
                ? cloudProfile.selected_services_by_module
                : {};
            let activation = {
                profile: existingAccess.module_code,
                serviceIds: []
            };
            if (
                global.AuroraModuleAccess &&
                typeof global.AuroraModuleAccess.resolveOperationalActivation === "function"
            ) {
                activation = await global.AuroraModuleAccess.resolveOperationalActivation(existingAccess);
            }
            const profileCode = String(activation.profile || existingAccess.module_code || "").trim();
            const operationalServices = Array.isArray(activation.serviceIds)
                ? activation.serviceIds.map((item) => String(item))
                : [];
            const selectedForExistingModule = operationalServices.length
                ? operationalServices
                : (Array.isArray(cloudSelectionsByModule[profileCode])
                    ? cloudSelectionsByModule[profileCode].map((item) => String(item))
                    : cloudSelectedServices);
            const profileServices = servicesForProfile(profileCode);
            const initialService = profileServices.find((service) =>
                selectedForExistingModule.includes(String(service.id))
            ) || profileServices[0] || {};

            identity = onboardingEngine.save({
                company: company || "",
                professional: String(
                    cloudProfile.professional_name || existingIdentity.professional ||
                    cloudProfile.full_name || cloudProfile.name || ""
                ).trim() || "Usuário",
                phone: String(cloudProfile.phone || existingIdentity.phone || "").trim() || "Não informado",
                profile: profileCode,
                preferred_service: operationalServices[0] || initialService.id || "",
                preferred_service_title: initialService.title || "",
                selected_services: selectedForExistingModule.length
                    ? selectedForExistingModule
                    : (initialService.id ? [initialService.id] : []),
                selected_services_by_module: {
                    ...cloudSelectionsByModule,
                    ...(selectedForExistingModule.length ? { [profileCode]: selectedForExistingModule } : {})
                },
                active_license_module_code: existingAccess.module_code
            });
            if (global.AuroraModuleAccess) {
                /* V127 — persistir a LICENÇA na chave do UID autenticado.
                 * O bootstrap ainda pode estar antes da publicação de AURORA_ACCOUNT_USER_ID;
                 * activate() sozinho gravaria :anonymous e resolve() leria o electrical antigo
                 * da chave real do Gabriel. */
                if (typeof global.AuroraModuleAccess.activateForUser === "function") {
                    global.AuroraModuleAccess.activateForUser(existingAccess.module_code, authenticatedUserId);
                } else if (typeof global.AuroraModuleAccess.activate === "function") {
                    global.AuroraModuleAccess.activate(existingAccess.module_code);
                }
            }
        }
    } else if (cloudProfile && existingAccess) {
        const companyAccessClaim = global.AuroraCompanyAccess &&
            typeof global.AuroraCompanyAccess.get === "function"
            ? global.AuroraCompanyAccess.get()
            : (global.AURORA_COMPANY_ACCESS || {});
        const activation = global.AuroraModuleAccess &&
            typeof global.AuroraModuleAccess.resolveOperationalActivation === "function"
            ? await global.AuroraModuleAccess.resolveOperationalActivation(existingAccess)
            : { profile: existingAccess.module_code, serviceIds: [] };
        const profileCode = String(activation.profile || existingAccess.module_code || identity.profile || "").trim();
        const licenseCode = String(existingAccess.license_module_code || existingAccess.module_code || profileCode).trim();
        const operationalServices = Array.isArray(activation.serviceIds)
            ? activation.serviceIds.map((item) => String(item))
            : [];
        const cloudServices = Array.isArray(cloudProfile.selected_services)
            ? cloudProfile.selected_services.map((item) => String(item))
            : [];
        const preservePendingServices = hasPendingModuleServiceSelection(authenticatedUserId, licenseCode);
        const reconciledServices = operationalServices.length
            ? operationalServices
            : (preservePendingServices
                ? (Array.isArray(identity.selected_services) ? identity.selected_services : [])
                : (cloudServices.length ? cloudServices : (identity.selected_services || [])));
        const profileServices = servicesForProfile(profileCode);
        const preferredService = reconciledServices.includes(String(identity.preferred_service || ""))
            ? String(identity.preferred_service)
            : String(reconciledServices[0] || "");
        const preferredMeta = profileServices.find((service) => String(service.id) === preferredService) || {};

        identity = onboardingEngine.save({
            ...identity,
            company: String(
                cloudProfile.company_name || cloudProfile.company || cloudProfile.business_name ||
                cloudProfile.organization_name || companyAccessClaim.company_name || identity.company || ""
            ).trim(),
            /* Responsável técnico pertence à identidade profissional da empresa.
             * Nome da conta autenticada é mantido separadamente em AuroraUserProfile. */
            professional: String(
                cloudProfile.professional_name || identity.professional || ""
            ).trim(),
            phone: String(cloudProfile.phone || identity.phone || "").trim(),
            profile: profileCode,
            preferred_service: preferredService,
            preferred_service_title: preferredMeta.title || identity.preferred_service_title || "",
            selected_services: reconciledServices,
            selected_services_by_module: {
                ...(identity.selected_services_by_module || {}),
                [profileCode]: reconciledServices
            },
            active_license_module_code: licenseCode
        });
        console.info("[MULTIDEVICE] identity reconciled");
    }

    if (global.AuroraModuleAccess) {
        /* V127 — a licença privada já foi resolvida acima por listMyModules.
         * Não submeter novamente essa decisão ao resolvedor genérico, porque ele
         * também consulta estado local/profile operacional e pode transformar
         * electrical (profile interno) em escolha de licença. A troca manual continua
         * usando o marcador explícito de sessão e, nesse caso, passa pelo resolve normal. */
        if (tupyLicensedAccess && !explicitSessionModule && existingAccess &&
            String(existingAccess.module_code || "").trim() === "eletrica_tupy") {
            const activation = typeof global.AuroraModuleAccess.resolveOperationalActivation === "function"
                ? await global.AuroraModuleAccess.resolveOperationalActivation(existingAccess)
                : { profile: "electrical", serviceIds: ["eletrica_tupy"] };
            try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("03 MAPA OPERACIONAL TUPY", activation); } catch (_) {}
            selectedModule = {
                ...existingAccess,
                license_module_code: "eletrica_tupy",
                operational_profile: String(activation.profile || "electrical"),
                operational_services: Array.isArray(activation.serviceIds) && activation.serviceIds.length
                    ? activation.serviceIds.map((item) => String(item))
                    : ["eletrica_tupy"]
            };
        } else {
            selectedModule = await global.AuroraModuleAccess.resolve(identity);
        }
    }
    try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("MODULE_RESOLUTION", { bootstrap_decision: "selectedModule", explicit_session_module: explicitSessionModule, existing_access: existingAccess, selected_module: selectedModule, identity_before_apply: { profile: identity.profile, active_license_module_code: identity.active_license_module_code, preferred_service: identity.preferred_service, selected_services: identity.selected_services } }); } catch (_) {}

    /* V44 — convite aceito sem ambiente ainda concedido.
     * Mantém a conta dentro da Home da empresa e remove serviços herdados do perfil
     * antigo/pessoal para que o usuário não receba acesso implícito. */
    if (!selectedModule && isCompanyOperationalUser() && global.AURORA_MEMBER_AWAITING_ENVIRONMENT === true) {
        /* V45 — estado neutro real. Remove também profile/licença ativa e a seleção
         * persistida do dispositivo, impedindo electrical/panel legado de vencer
         * a autorização definida em Minha Equipe. */
        if (global.AuroraModuleAccess && typeof global.AuroraModuleAccess.clearActiveForCurrentUser === "function") {
            global.AuroraModuleAccess.clearActiveForCurrentUser();
        }
        identity = onboardingEngine.save({
            ...identity,
            profile: "",
            active_license_module_code: "",
            active_module_title: "",
            active_module_access_status: "",
            active_module_ends_at: "",
            preferred_service: "",
            preferred_service_title: "",
            selected_services: []
        });
        saveIdentity(identity);
    }

    if (selectedModule) {
        const r44IdentityBeforeApply = { profile: identity.profile, active_license_module_code: identity.active_license_module_code, preferred_service: identity.preferred_service, selected_services: identity.selected_services };
        try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("04 ANTES APPLY SELECTED", { selectedModule: { module_code: selectedModule.module_code, license_module_code: selectedModule.license_module_code, operational_profile: selectedModule.operational_profile, operational_services: selectedModule.operational_services }, identity: { profile: identity.profile, active_license_module_code: identity.active_license_module_code, selected_services: identity.selected_services } }); } catch (_) {}
        if (global.AuroraTrialCounter) {
            global.AuroraTrialCounter.setActiveModuleAccess(selectedModule);
        }
        identity = await applySelectedModuleToIdentity(identity, selectedModule);
        saveIdentity(identity);
        try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark((r44IdentityBeforeApply.active_license_module_code && r44IdentityBeforeApply.active_license_module_code !== identity.active_license_module_code) ? "MODULE_OVERRIDE" : "PROFILE_RESOLUTION", { authority: "applySelectedModuleToIdentity", previous: r44IdentityBeforeApply, next: { profile: identity.profile, active_license_module_code: identity.active_license_module_code, preferred_service: identity.preferred_service, selected_services: identity.selected_services }, selected_module: selectedModule }); } catch (_) {}
        try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("05 DEPOIS APPLY SELECTED", { profile: identity.profile, active_license_module_code: identity.active_license_module_code, preferred_service: identity.preferred_service, selected_services: identity.selected_services, selected_services_by_module: identity.selected_services_by_module }); } catch (_) {}
    }

    /* V72 — cold-start com License Ticket válido já possui autorização e módulos
     * assinados. Não bloquear a montagem da Home aguardando RPCs de hidratação cloud
     * quando a própria camada Offline License confirmou o cold-start offline. */
    const validOfflineStartup = Boolean(
        global.AURORA_OFFLINE_STARTUP_CTX &&
        global.AURORA_OFFLINE_STARTUP_CTX.ok === true &&
        global.AURORA_OFFLINE_STARTUP_CTX.mode === "cold_start_offline_ticket_valid"
    );

    /* R11.10 — barreira empresarial antes de liberar a Home.
     * V72: hidratação exclusivamente cloud fica para a próxima abertura online. */
    if (global.AuroraCloudSync && !validOfflineStartup) {
        try {
            if (identity.professional && typeof global.AuroraCloudSync.updateProfessionalName === "function") {
                await global.AuroraCloudSync.updateProfessionalName(identity.professional);
            }
        } catch (professionalSyncError) {
            console.warn("Aurora: nome profissional ficou pendente de sincronização.", professionalSyncError);
        }
        try {
            if (typeof global.AuroraCloudSync.getCompanyIdentity === "function") {
                let companyIdentity = await global.AuroraCloudSync.getCompanyIdentity();
                if (companyIdentity && companyIdentity.company_id) {
                    const canManageCompany = global.AuroraCompanyAccess &&
                        typeof global.AuroraCompanyAccess.canManageUsers === "function" &&
                        global.AuroraCompanyAccess.canManageUsers();
                    if (canManageCompany && !String(companyIdentity.logo || "") && String(identity.logo || "") &&
                        typeof global.AuroraCloudSync.updateCompanyIdentity === "function") {
                        await global.AuroraCloudSync.updateCompanyIdentity(identity);
                        companyIdentity = await global.AuroraCloudSync.getCompanyIdentity();
                    }
                    identity.logo = String(companyIdentity.logo || "");
                    const cloudTransparency = Number(companyIdentity.logo_transparency ?? 0.70);
                    identity.logo_transparency = cloudTransparency <= 1 ? cloudTransparency * 100 : cloudTransparency;
                    saveIdentity(identity);
                }
            }
        } catch (companyIdentityError) {
            console.warn("Aurora: identidade empresarial ficou pendente de hidratação.", companyIdentityError);
        }
    }

    /* R11.19 — serviços empresariais pertencem à empresa, não ao perfil do funcionário.
     * COMPANY_USER e COMPANY_ADMIN consomem a mesma seleção corporativa. */
    try {
        const selectedModuleUsesCompanyServices = Boolean(
            selectedModule &&
            (
                String(selectedModule.source || "").trim() === "company" ||
                String(selectedModule.access_source || "").trim() === "company" ||
                String(selectedModule.access_status || "").trim() === "company_authorized"
            )
        );
        if (!validOfflineStartup && selectedModuleUsesCompanyServices && global.AuroraCloudSync && typeof global.AuroraCloudSync.getCompanyServices === "function") {
            try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("06 ANTES COMPANY SERVICES", { companyAccess: global.AuroraCompanyAccess && global.AuroraCompanyAccess.get ? global.AuroraCompanyAccess.get() : global.AURORA_COMPANY_ACCESS, identity: { profile: identity.profile, active_license_module_code: identity.active_license_module_code, selected_services: identity.selected_services } }); } catch (_) {}
            const companyServicesByModule = await global.AuroraCloudSync.getCompanyServices();
            try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("07 COMPANY SERVICES RETORNO", companyServicesByModule); } catch (_) {}
            if (companyServicesByModule && typeof companyServicesByModule === "object" && !Array.isArray(companyServicesByModule)) {
                const activeModuleCode = String(identity.profile || identity.active_license_module_code || "").trim();
                const licenseModuleCode = String(identity.active_license_module_code || activeModuleCode).trim();
                const companySelection = Array.isArray(companyServicesByModule[activeModuleCode])
                    ? companyServicesByModule[activeModuleCode]
                    : (Array.isArray(companyServicesByModule[licenseModuleCode]) ? companyServicesByModule[licenseModuleCode] : []);
                const inheritedServices = companySelection.map((item) => String(item));
                if (inheritedServices.length) {
                    const serviceCatalog = servicesForProfile(activeModuleCode);
                    const preferredService = inheritedServices.includes(String(identity.preferred_service || ""))
                        ? String(identity.preferred_service)
                        : String(inheritedServices[0] || "");
                    const preferredMeta = serviceCatalog.find((service) => String(service.id) === preferredService) || {};
                    identity = onboardingEngine.save({
                        ...identity,
                        selected_services: inheritedServices,
                        selected_services_by_module: {
                            ...(identity.selected_services_by_module || {}),
                            ...companyServicesByModule,
                            [activeModuleCode]: inheritedServices
                        },
                        preferred_service: preferredService,
                        preferred_service_title: preferredMeta.title || identity.preferred_service_title || ""
                    });
                    saveIdentity(identity);
                }
            }
        }
    } catch (companyServicesError) {
        console.warn("Aurora: serviços empresariais ficaram pendentes de hidratação.", companyServicesError);
    }

    syncUserProfileFromIdentity(identity);

    if (
        global.AuroraModulesApi &&
        global.AuroraUserProfile &&
        typeof global.AuroraUserProfile.syncFromCloudProfile === "function" &&
        !skipCloudProfileBootstrap
    ) {
        try {
            const cloudUserProfile = await global.AuroraModulesApi.getMyProfile();
            global.AuroraUserProfile.syncFromCloudProfile(cloudUserProfile);
        } catch (profileSyncError) {
            console.warn(
                "Aurora: perfil do usuário não sincronizado da nuvem.",
                profileSyncError
            );
        }
    }

    auroraBootMark("BOOT_MODULES_OK", {
        profile: identity.profile || ""
    });

    /* V49 — gate anterior à montagem da Home para COMPANY_USER sem ambiente.
     * A autorização já estava bloqueando os módulos, mas a Home elétrica ainda
     * era construída antes dessa decisão. Neste estado não criamos AuroraRuntime
     * nem renderHome: exibimos apenas a espera neutra da empresa. */
    if (isCompanyOperationalUser() && global.AURORA_MEMBER_AWAITING_ENVIRONMENT === true) {
        const appHost = document.getElementById("app");
        const safeCompanyName = String(identity.company || "empresa")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        if (appHost) {
            appHost.innerHTML = `
                <div data-aurora-awaiting-environment style="position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(3,10,20,.82);font-family:inherit;box-sizing:border-box;">
                    <section style="width:min(680px,100%);margin:0 0 max(18px,env(safe-area-inset-bottom));padding:28px;border:1px solid rgba(103,217,255,.28);border-radius:28px;background:#111d30;color:#f4f8ff;box-shadow:0 24px 80px rgba(0,0,0,.45);box-sizing:border-box;">
                        <div style="font-size:13px;font-weight:800;letter-spacing:.16em;color:#65e4df;margin-bottom:10px;">AURORA</div>
                        <h1 style="font-size:30px;line-height:1.08;margin:0 0 14px;font-weight:800;">Aguardando autorização</h1>
                        <p style="font-size:18px;line-height:1.55;margin:0 0 22px;color:#b7c3d7;">Seu acesso à <strong style="color:#f4f8ff;">${safeCompanyName}</strong> foi confirmado. O administrador ainda não liberou nenhum ambiente para sua conta. Solicite ao administrador a autorização para os módulos em que você irá trabalhar.</p>
                        <button type="button" data-refresh-member-access style="width:100%;min-height:58px;border:0;border-radius:18px;background:#63e2dd;color:#07131e;font:inherit;font-size:18px;font-weight:800;cursor:pointer;">Atualizar acesso</button>
                        <div style="margin-top:16px;text-align:center;font-size:11px;color:#718097;">AURORA_V144_GATE_BLOQUEIO_EMPRESARIAL_17-09-2026</div>
                    </section>
                </div>`;
            const refresh = appHost.querySelector("[data-refresh-member-access]");
            if (refresh) refresh.addEventListener("click", async () => {
                refresh.disabled = true;
                refresh.textContent = "Verificando acesso…";
                try {
                    if (global.AuroraModuleAccess && typeof global.AuroraModuleAccess.clearActiveForCurrentUser === "function") {
                        global.AuroraModuleAccess.clearActiveForCurrentUser();
                    }
                    const uid = String(global.AURORA_ACCOUNT_USER_ID || "").trim();
                    if (uid) localStorage.removeItem("aurora_member_allowed_modules_v2:" + uid);
                } catch (_) {}
                location.reload();
            });
        }
        auroraBootMark("BOOT_MEMBER_AWAITING_ENVIRONMENT");
        return;
    }

    /* R52 — observação somente diagnóstica. Não cria fallback, mock ou
     * substituição: o constructor oficial continua sendo a autoridade. */
    try {
        const requiredRuntimeGlobals = [
            "ThemeManager",
            "SidebarComponent",
            "TopBarComponent",
            "FooterNavigation",
            "AppShell",
            "MobileShellAdapter",
            "ModuleController",
            "ViewManager",
            "UISchemaEngine",
            "LibraryEngine",
            "FieldEngine",
            "FormRenderer",
            "BaseFormModule",
            "CaseBinder",
            "CustomerModuleController",
            "AssetModuleController",
            "IntakeModuleController",
            "OccurrenceModuleController",
            "EvidenceModuleController",
            "DiagnosticModuleController",
            "BudgetModuleController",
            "ApprovalModuleController",
            "AuroraRuntime"
        ];
        const dependencies = requiredRuntimeGlobals.map((name) => {
            const value = global[name];
            let constructible = false;
            if (typeof value === "function") {
                try {
                    Reflect.construct(Object, [], value);
                    constructible = true;
                } catch (_) {}
            }
            return {
                name,
                present: typeof value !== "undefined" && value !== null,
                type: typeof value,
                constructible
            };
        });
        const firstMissing = dependencies.find(
            (entry) => !entry.present || entry.type !== "function" || !entry.constructible
        ) || null;
        r46mark("R52_RUNTIME_DEPENDENCY_CHAIN", {
            dependencies,
            first_missing: firstMissing && firstMissing.name || ""
        }, "runtime_dependencies");
        if (firstMissing) {
            r46mark("R52_RUNTIME_DEPENDENCY_FIRST_MISSING", firstMissing, "runtime_dependencies");
        }
    } catch (_) {}

    const runtime =
        new global.AuroraRuntime({
            container:
                document.getElementById(
                    "app"
                ),
            title:
                config.app.title,
            subtitle:
                profilePresentation(
                    identity.profile
                ).subtitle,
            userName:
                String(identity.professional || "").trim() ||
                resolveLoggedInUserFullName() ||
                "Usuário",
            profile:
                identity.profile,
            caseData:
                {
                    ...getInitialCase(),
                    profile_id:
                        identity.profile
                }
        });

    runtime.on(
        "case_changed",
        (caseData) => {
            /* Revisão ADMIN: working_case só em memória — não gravar IndexedDB/local.
             * Checagem inline: isAdminReviewCase vive dentro de renderHome(). */
            if (caseData && caseData.admin_review === true) {
                return;
            }
            repository.save(
                caseData
            );
            /* R26 — o Case já salvo pelo Runtime também ganha uma representação
             * compacta em Atendimentos recentes. O mesmo id será substituído
             * pelo relatório Concluído ao final, sem duplicação. */
            try {
                const draft = persistUniversalDraft(caseData);
                const reportEngine = global.AuroraReportFeature && global.AuroraReportFeature.engine;
                const durableDraft = draft && reportEngine && typeof reportEngine.getPersistent === "function"
                    ? reportEngine.getPersistent(draft.id)
                    : draft;
                if (draft && durableDraft) {
                    try { global.dispatchEvent(new CustomEvent("aurora:draft-updated", { detail: { case_id: caseData.id } })); } catch (_) {}
                } else if (draft) {
                    console.warn("Aurora R27: rascunho atualizado apenas na sessão; persistência local durável indisponível.");
                }
            } catch (error) {
                console.warn("Aurora R26: rascunho local não pôde ser atualizado.", error);
            }

        }
    );

    runtime.on(
        "validation_failed",
        (event) => {
            const specificMessage = String(global.__AURORA_VALIDATION_MESSAGE__ || "").trim();
            global.__AURORA_VALIDATION_MESSAGE__ = "";
            const controllerId = String(event && event.controller_id || "");
            const fallbackMessage = controllerId === "customer"
                ? "Preencha o campo obrigatório: Nome ou razão social."
                : "Preencha os campos obrigatórios desta etapa.";
            showStatus(
                specificMessage || fallbackMessage,
                3200
            );
        }
    );


    global.auroraRuntime =
        runtime;

    global.auroraRepository =
        repository;

    v78mark("RUNTIME_START");
        auroraBootMark("BOOT_RUNTIME_START");
        await runtime.start();
        v78mark("RUNTIME_OK");

    const mobile =
        new global.MobileShellAdapter({
            shell:
                runtime.shell
        });

    mobile.mount();

    auroraBootMark("BOOT_SHELL_READY");

    try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("08 ANTES HIDRATACAO BOLT", { profile: identity.profile, active_license_module_code: identity.active_license_module_code, preferred_service: identity.preferred_service, selected_services: identity.selected_services, companyAccess: global.AuroraCompanyAccess && global.AuroraCompanyAccess.get ? global.AuroraCompanyAccess.get() : global.AURORA_COMPANY_ACCESS, canEnterTupy: canEnterEletricaTupyOperationalFlow(), canManageTupy: canManageEletricaTupyUi() }); } catch (_) {}

    /* V131 — a licença eletrica_tupy já foi confirmada por listMyModules.
     * Antes de montar a Home, aguardar a claim empresarial necessária para
     * canEnter/canManage Tupy. Isso elimina a corrida comprovada na V130:
     * renderHome() recebia profile=electrical enquanto companyAccess.loaded=false
     * e montava os seis serviços da Elétrica por cima de Atividades Rotineiras. */
    if (String(identity.active_license_module_code || "").trim() === "eletrica_tupy") {
        const accessBeforeBoltHome = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
            ? global.AuroraCompanyAccess.get()
            : (global.AURORA_COMPANY_ACCESS || null);
        if (!accessBeforeBoltHome || accessBeforeBoltHome.loaded !== true) {
            try {
                if (global.AuroraCloudSync && typeof global.AuroraCloudSync.refreshCompanyAccessClaim === "function") {
                    await global.AuroraCloudSync.refreshCompanyAccessClaim();
                }
            } catch (boltCompanyHydrationError) {
                console.warn("Aurora: hidratação empresarial Bolt pendente antes da Home.", boltCompanyHydrationError);
            }
        }
    }

    try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("08B DEPOIS HIDRATACAO BOLT", { profile: identity.profile, active_license_module_code: identity.active_license_module_code, preferred_service: identity.preferred_service, selected_services: identity.selected_services, companyAccess: global.AuroraCompanyAccess && global.AuroraCompanyAccess.get ? global.AuroraCompanyAccess.get() : global.AURORA_COMPANY_ACCESS, canEnterTupy: canEnterEletricaTupyOperationalFlow(), canManageTupy: canManageEletricaTupyUi() }); } catch (_) {}
    try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("BEFORE_HOME_RENDER", { module_final: identity.active_license_module_code, profile_final: identity.profile, preferred_service: identity.preferred_service, selected_services: identity.selected_services, edit_services_rule: { company_member: hasActiveCompanyMembership(), can_manage_company: global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.canManageUsers === "function" ? global.AuroraCompanyAccess.canManageUsers() : null } }); } catch (_) {}
    renderHome(
        identity,
        runtime,
        selectedModule
    );
    try { if (global.AuroraR44ModuleTrace) global.AuroraR44ModuleTrace.mark("HOME_RENDERED", { module_final: identity.active_license_module_code, profile_final: identity.profile, home_services: Array.from(document.querySelectorAll("[data-service-id]")).map((el) => el.getAttribute("data-service-id")), edit_services_visible: Boolean(document.querySelector("[data-edit-segment-services]")) }); } catch (_) {}

    /* V136 — USER_BOLT autorizado deve entrar na HOME do ambiente Atividades
     * Rotineiras, e não iniciar automaticamente uma nova vistoria. O card privado
     * eletrica_tupy já foi materializado pelo renderHome(); o usuário decide quando
     * abrir uma nova atividade. */
    try { if (global.AuroraBoltTraceV132) global.AuroraBoltTraceV132.mark("09 DEPOIS RENDER HOME", { serviceCards: Array.from(document.querySelectorAll('[data-service-id]')).map(function(el){ return el.getAttribute('data-service-id'); }), aetAdminHome: !!document.querySelector('[data-aet-gestao-home]') }); } catch (_) {}

    if (
        !validOfflineStartup &&
        global.AuroraCloudSync &&
        typeof global.AuroraCloudSync.hydrateOwnProjectsMissingLocally === "function"
    ) {
        await global.AuroraCloudSync.hydrateOwnProjectsMissingLocally();
    }

    global.auroraMobile =
        mobile;

    /* V61 — o QR só recebe autorização para navegar quando o bootstrap REAL
     * terminou: runtime, shell, Home e hidratação cloud já concluídos.
     * Este evento é exclusivo da rota QR e não altera login/onboarding. */
    global.__AURORA_OPERATIONAL_READY__ = { profile: String(identity && identity.profile || "") };
    try { global.dispatchEvent(new CustomEvent("AuroraOperationalReady", { detail: global.__AURORA_OPERATIONAL_READY__ })); } catch (_) {}

    auroraBootMark("BOOT_SUCCESS");

    console.log(
        "AURORA RC2.2.5 FINALIZAÇÃO DIRETA"
    );

} catch (error) {
    auroraBootError(auroraBootStage, error);

    /* V142 — convite empresarial aceito + nenhum ambiente liberado NÃO é erro de boot.
     * Revalida a membership/autorizações no próprio catch porque, no primeiro acesso,
     * o claim empresarial pode terminar de hidratar depois da decisão inicial do bootstrap. */
    let isMemberAwaitingAuthorization = false;
    let awaitingCompanyName = "sua empresa";
    try {
        if (global.AuroraCloudSync && typeof global.AuroraCloudSync.refreshCompanyAccessClaim === "function") {
            await global.AuroraCloudSync.refreshCompanyAccessClaim();
        }
        const claim = global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.get === "function"
            ? global.AuroraCompanyAccess.get()
            : (global.AURORA_COMPANY_ACCESS || {});
        const role = String(claim && claim.role || "").trim().toUpperCase();
        const status = String(claim && claim.status || "").trim().toLowerCase();
        const isCompanyUser = role === "COMPANY_USER" || role === "USER_BOLT";
        awaitingCompanyName = String(claim && claim.company_name || "sua empresa").trim() || "sua empresa";
        if (isCompanyUser && status === "active" && global.AuroraModulesApi && typeof global.AuroraModulesApi.listMyModules === "function") {
            const freshModules = await global.AuroraModulesApi.listMyModules();
            isMemberAwaitingAuthorization = !Array.isArray(freshModules) || !freshModules.some((item) => item && item.can_access === true);
        }
    } catch (awaitingCheckError) {
        console.warn("Aurora V142: não foi possível confirmar estado de espera empresarial.", awaitingCheckError);
    }

    if (isMemberAwaitingAuthorization) {
        const safeCompanyName = escapeHTML(awaitingCompanyName);
        document.body.innerHTML = [
            '<main class="aurora-module-gate">',
            '<div class="aurora-module-gate__veil"></div>',
            '<article class="aurora-module-gate__panel aurora-module-gate__panel--empty">',
            '<div class="aurora-module-empty__brand"><span>A</span><strong>Aurora</strong></div>',
            '<div class="aurora-module-empty__icon">!</div>',
            '<p class="aurora-module-empty__eyebrow">CONVITE ACEITO</p>',
            '<h1>Aguardando liberação do administrador</h1>',
            `<p>Seu convite foi aceito e sua conta já está vinculada à <strong>${safeCompanyName}</strong>. O administrador ainda precisa liberar os ambientes em que você poderá trabalhar.</p>`,
            '<p>Depois que a liberação for realizada, toque em <strong>Atualizar Aurora</strong>.</p>',
            '<div class="aurora-module-empty__actions">',
            '<button type="button" class="aurora-module-empty__primary" data-awaiting-refresh>Atualizar Aurora</button>',
            '<button type="button" data-awaiting-signout style="width:100%;min-height:52px;margin-top:12px;border:1px solid rgba(148,163,184,.35);border-radius:16px;background:transparent;color:#dbe7f7;font:inherit;font-weight:700;cursor:pointer;">Sair / usar outro e-mail</button>',
            '</div>',
            '</article>',
            '</main>'
        ].join("");
        const refreshButton = document.querySelector("[data-awaiting-refresh]");
        if (refreshButton) refreshButton.addEventListener("click", () => location.reload());
        const signoutButton = document.querySelector("[data-awaiting-signout]");
        if (signoutButton) signoutButton.addEventListener("click", async () => {
            if (typeof global.AuroraAccountSignOut === "function") {
                await global.AuroraAccountSignOut();
                return;
            }
            global.dispatchEvent(new CustomEvent("aurora:account-signout-request"));
        });
        auroraBootMark("BOOT_MEMBER_AWAITING_ADMIN_AUTHORIZATION_V142");
        return;
    }

    const isCompanyModuleInactive = error && error.code === "AURORA_COMPANY_MODULE_INACTIVE";
    const userMessage =
        auroraBootFailureMessage(
            auroraBootStage,
            error
        );

    document.body.innerHTML = [
        '<main class="aurora-module-gate">',
        '<div class="aurora-module-gate__veil"></div>',
        '<article class="aurora-module-gate__panel aurora-module-gate__panel--empty">',
        '<div class="aurora-module-empty__brand"><span>A</span><strong>Aurora</strong></div>',
        '<div class="aurora-module-empty__icon">!</div>',
        isCompanyModuleInactive
            ? '<p class="aurora-module-empty__eyebrow">Acesso empresarial</p>'
            : '<p class="aurora-module-empty__eyebrow">Não foi possível iniciar</p>',
        isCompanyModuleInactive
            ? '<h1>Módulo da empresa indisponível</h1>'
            : '<h1>Vamos tentar novamente</h1>',
        `<p>${escapeHTML(userMessage)}</p>`,
        '<div class="aurora-module-empty__actions"><button type="button" class="aurora-module-empty__primary" onclick="location.reload()">Atualizar Aurora</button></div>',
        '</article>',
        '</main>'
    ].join("");

    try {
        if (global.AuroraR47ColdStartTrace && typeof global.AuroraR47ColdStartTrace.mountFallbackButton === "function") {
            global.AuroraR47ColdStartTrace.mountFallbackButton();
        }
    } catch (_) {}

    console.error(error);
}

})(window);

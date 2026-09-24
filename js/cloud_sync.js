try{window.AuroraBootDiagV78&&window.AuroraBootDiagV78.mark("ENTER_CLOUD_SYNC","js/cloud_sync.js iniciou")}catch(_){}
(function (global) {
"use strict";

/* V170 — diagnostico permanente da barreira auth offline; sem alterar decisoes. */
try { global.AuroraBootDiagV78 && global.AuroraBootDiagV78.mark("CLOUD_SYNC_V170_INSTRUMENTED", "loaded"); } catch (_) {}
    const v78mark = (stage, detail) => {
        try {
            if (global.AuroraBootDiagV78 && typeof global.AuroraBootDiagV78.mark === "function") {
                global.AuroraBootDiagV78.mark(stage, detail || "");
            }
        } catch (_) {}
    };

const config = global.AURORA_CLOUD_CONFIG || {};
if (!config.enabled || !global.supabase) return;

const STATE_KEY = "aurora_cloud_sync_state_v1";
const REPORTS_KEY = "aurora_reports";
const SYNC_TIMEOUT_MS = 15000;
let activeRestore = null;
let activeSync = null;
let activeDelete = null;
let volatileSyncState = {};
const client = global.supabase.createClient(config.url, config.anon_key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});


function cloudServiceLabel(serviceType, serviceProfile) {
    const i18n = global.AuroraI18n;
    if (i18n && typeof i18n.serviceLabel === "function") return i18n.serviceLabel(serviceType, i18n.profileLabel(serviceProfile, "Atendimento"));
    return String(serviceType || serviceProfile || "Atendimento");
}

function clockDiag(event, details, userId) {
    if (!global.AuroraClockDiagnostic) {
        return;
    }

    if (userId !== undefined) {
        global.AuroraClockDiagnostic.logWithContext(event, userId, details || {});
        return;
    }

    global.AuroraClockDiagnostic.log(
        event,
        Object.assign({}, global.AuroraClockDiagnostic.context(), details || {})
    );
}

function syncDiag(event, details) {
    const runtime = global.auroraRuntime || global.AuroraRuntime || null;
    const controller = runtime && runtime.viewManager && typeof runtime.viewManager.getCurrentController === "function"
        ? runtime.viewManager.getCurrentController()
        : null;
    const entry = {
        at: new Date().toISOString(),
        build: "V44",
        event: String(event || "unknown"),
        currentIndex: runtime && Number.isFinite(runtime.currentIndex) ? runtime.currentIndex : null,
        controller: controller && controller.id ? controller.id : null,
        ...(details || {})
    };
    const api = global.AuroraGroundingV44Diag = global.AuroraGroundingV44Diag || { events: [] };
    api.events.push(entry);
    if (api.events.length > 250) api.events.splice(0, api.events.length - 250);
    api.last = entry;
    try { console.info("[AURORA V44 DIAG]", entry); } catch (_) {}
    return entry;
}

const COMPANY_PROFILE_KEY = "aurora_company_identity_rc1_5";
const PENDING_CASE_SYNC_KEY = "aurora_pending_case_sync_ids_v1";

function pendingCaseIds() {
    try { const value = JSON.parse(localStorage.getItem(PENDING_CASE_SYNC_KEY) || "[]"); return Array.isArray(value) ? value.map(String) : []; }
    catch (_) { return []; }
}

function queueCaseForSync(caseData) {
    const id = String(caseData && caseData.id || "").trim();
    if (!id) return false;
    localStorage.setItem(PENDING_CASE_SYNC_KEY, JSON.stringify(Array.from(new Set(pendingCaseIds().concat(id)))));
    return true;
}

function clearPendingCaseSync(caseId) {
    const id = String(caseId || "");
    localStorage.setItem(PENDING_CASE_SYNC_KEY, JSON.stringify(pendingCaseIds().filter((item) => item !== id)));
}

function discoverTupyPendingCaseIds(reports) {
    const discovered = [];
    (Array.isArray(reports) ? reports : []).forEach((report) => {
        const snapshot = report && report.snapshot;
        const id = String(snapshot && snapshot.id || report && report.case_id || "").trim();
        if (!id || !snapshot) return;
        const tupy = snapshot.eletrica_tupy && typeof snapshot.eletrica_tupy === "object" ? snapshot.eletrica_tupy : null;
        if (tupy && tupy.cloud_sync_pending === true) discovered.push(id);
    });
    return discovered;
}

function clearTupyPendingFlag(caseId) {
    const id = String(caseId || "").trim();
    if (!id) return;
    try {
        const reports = localReports();
        let changed = false;
        reports.forEach((report) => {
            const snapshot = report && report.snapshot;
            const reportId = String(snapshot && snapshot.id || report && report.case_id || "").trim();
            if (reportId !== id || !snapshot || !snapshot.eletrica_tupy || snapshot.eletrica_tupy.cloud_sync_pending !== true) return;
            snapshot.eletrica_tupy.cloud_sync_pending = false;
            changed = true;
        });
        if (changed) localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    } catch (error) {
        console.warn("Aurora: não foi possível limpar a pendência Tupy local.", error);
    }
}

async function syncPendingCases() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { synced: 0, pending: pendingCaseIds().length };
    const reports = typeof global.AuroraVisibleCloudSyncReports === "function" ? global.AuroraVisibleCloudSyncReports() : localReports();
    discoverTupyPendingCaseIds(reports).forEach((id) => {
        if (!pendingCaseIds().includes(id)) localStorage.setItem(PENDING_CASE_SYNC_KEY, JSON.stringify(Array.from(new Set(pendingCaseIds().concat(id)))));
    });
    const ids = pendingCaseIds();
    let synced = 0;
    for (const id of ids) {
        const report = (Array.isArray(reports) ? reports : []).find((item) => String(item && item.snapshot && item.snapshot.id || item && item.case_id || "") === id);
        if (!report || !report.snapshot) continue;
        try {
            await syncSelectedCase(Object.assign({}, report.snapshot, { status: report.status || report.snapshot.status }));
            clearPendingCaseSync(id);
            clearTupyPendingFlag(id);
            synced += 1;
        } catch (error) {
            if (!isRetryableNetworkError(error)) console.warn("Aurora: ressincronização pendente rejeitada.", error);
        }
    }
    return { synced, pending: pendingCaseIds().length };
}

async function updateProfessionalName(value) {
    const professional = String(value || "").trim();
    if (!professional) return false;
    const result = await client.rpc("aurora_update_my_professional_name", {
        p_professional_name: professional
    });
    if (result.error) {
        throw new Error(`Não foi possível sincronizar o responsável técnico: ${result.error.message}`);
    }
    const payload = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!payload || payload.ok !== true || String(payload.professional_name || "").trim() !== professional) {
        throw new Error("A nuvem não confirmou o responsável técnico informado.");
    }
    return true;
}

async function syncMyProfile(identity) {
    const profile = identity || {};
    const company = String(profile.company || "").trim();
    const professional = String(profile.professional || profile.professional_name || "").trim();
    const phone = String(profile.phone || "").trim();
    const userFullName =
        global.AuroraUserProfile &&
        typeof global.AuroraUserProfile.getUserFullName === "function"
            ? String(global.AuroraUserProfile.getUserFullName() || "").trim()
            : "";
    const fullName = userFullName || professional;

    /* R11.6.1: o nome profissional precisa sincronizar de forma independente
     * dos campos obrigatórios do onboarding. Antes, a validação de empresa/nome/
     * telefone podia encerrar a função antes de gravar professional_name. */
    if (professional) {
        await updateProfessionalName(professional);
    }

    if (!company || !fullName || !phone) return false;

    /* V58 — perfil operacional de COMPANY_USER pertence à empresa/ADMIN.
     * No startup, o snapshot local pode estar em outro segmento (ex.: workshop)
     * e jamais pode sobrescrever selected_services do módulo ativo na nuvem.
     * Para membro convidado, o bootstrap hidrata módulo/serviços pelas RPCs
     * empresariais; aqui sincronizamos somente o nome profissional acima. */
    try {
        const accessResult = await client.rpc("aurora_my_company_access");
        if (accessResult && accessResult.error) throw accessResult.error;
        const accessPayload = Array.isArray(accessResult && accessResult.data)
            ? accessResult.data[0]
            : (accessResult && accessResult.data);
        const memberRole = String(accessPayload && accessPayload.role || "").trim().toUpperCase();
        if (["COMPANY_USER", "USER_BOLT"].includes(memberRole)) {
            return true;
        }
    } catch (accessError) {
        console.warn("Aurora: vínculo empresarial não confirmado; cadastro local não será enviado por segurança.", accessError);
        return false;
    }

    const { error } = await client.rpc("aurora_update_my_onboarding", {
        p_company: company,
        p_full_name: fullName,
        p_phone: phone,
        p_module_code: String(profile.profile || "").trim(),
        p_selected_services: Array.isArray(profile.selected_services) ? profile.selected_services : []
    });
    if (error) throw new Error(`Não foi possível sincronizar os dados da empresa: ${error.message}`);

    return true;
}

async function syncStoredProfile() {
    try {
        const raw = localStorage.getItem(COMPANY_PROFILE_KEY);
        if (!raw) return false;
        return await syncMyProfile(JSON.parse(raw));
    } catch (error) {
        console.error("Aurora: falha ao sincronizar o cadastro da empresa.", error);
        return false;
    }
}

const COMPANY_SERVICES_CACHE_KEY = "aurora_company_services_cache_v1";

function companyServicesCacheKey() {
    const uid = String(global.AURORA_ACCOUNT_USER_ID || "").trim();
    return `${COMPANY_SERVICES_CACHE_KEY}:${uid || "current"}`;
}

function getCompanyServicesCached() {
    try {
        const raw = localStorage.getItem(companyServicesCacheKey()) || localStorage.getItem(COMPANY_SERVICES_CACHE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        const data = parsed && parsed.services_by_module && typeof parsed.services_by_module === "object"
            ? parsed.services_by_module
            : parsed;
        if (!data || typeof data !== "object" || Array.isArray(data)) return {};
        return Object.keys(data).reduce((out, moduleCode) => {
            if (Array.isArray(data[moduleCode])) {
                out[String(moduleCode)] = Array.from(new Set(data[moduleCode].map((item) => String(item || "").trim()).filter(Boolean)));
            }
            return out;
        }, {});
    } catch (_) { return {}; }
}

function saveCompanyServicesCache(services) {
    try {
        const payload = JSON.stringify(services || {});
        localStorage.setItem(companyServicesCacheKey(), payload);
        /* chave sem UID preserva o último snapshot válido durante o bootstrap,
         * antes de AURORA_ACCOUNT_USER_ID ser republicado no cold start. */
        localStorage.setItem(COMPANY_SERVICES_CACHE_KEY, payload);
    } catch (_) {}
}

async function getCompanyServices() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return getCompanyServicesCached();
    }
    const result = await client.rpc("aurora_get_my_company_services");
    if (result.error) throw new Error(result.error.message || "Não foi possível carregar os serviços da empresa.");
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row || typeof row !== "object" || Array.isArray(row)) return getCompanyServicesCached();
    const data = row.services_by_module && typeof row.services_by_module === "object" && !Array.isArray(row.services_by_module)
        ? row.services_by_module
        : row;
    const normalized = Object.keys(data).reduce((out, moduleCode) => {
        if (Array.isArray(data[moduleCode])) {
            out[String(moduleCode)] = Array.from(new Set(data[moduleCode].map((item) => String(item || "").trim()).filter(Boolean)));
        }
        return out;
    }, {});
    if (Object.keys(normalized).length) saveCompanyServicesCache(normalized);
    return normalized;
}

async function refreshApplicationData() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return { offline: true, company_services: {}, company_identity: null, modules: [] };
    }
    await refreshSessionOnline();
    await refreshCompanyAccessClaim();
    await syncPendingModuleServices();
    await syncPendingCases();
    const results = await Promise.allSettled([
        getCompanyServices(),
        getCompanyIdentity(),
        listMyModules(),
        hydrateOwnProjectsMissingLocally()
    ]);
    return {
        offline: false,
        company_services: results[0].status === "fulfilled" ? results[0].value : {},
        company_identity: results[1].status === "fulfilled" ? results[1].value : null,
        modules: results[2].status === "fulfilled" ? results[2].value : [],
        projects: results[3].status === "fulfilled" ? results[3].value : null,
        warnings: results.filter((item) => item.status === "rejected").map((item) => String(item.reason && item.reason.message || item.reason || "refresh_failed"))
    };
}

async function getCompanyIdentity() {
    const result = await client.rpc("aurora_get_my_company_identity");
    if (result.error) throw new Error(result.error.message || "Não foi possível carregar a identidade da empresa.");
    return result.data || null;
}

async function updateCompanyIdentity(identity) {
    const profile = identity || {};
    const result = await client.rpc("aurora_update_my_company_identity", {
        p_logo: String(profile.logo || ""),
        p_logo_transparency: Math.max(0, Math.min(90, Number(profile.logo_transparency ?? 70)))
    });
    if (result.error) throw new Error(result.error.message || "Não foi possível salvar a identidade visual da empresa.");
    const payload = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!payload || payload.ok !== true || String(payload.logo || "") !== String(profile.logo || "")) {
        throw new Error("A nuvem não confirmou a identidade visual da empresa.");
    }
    return payload;
}

async function updateCompanyCorporateIdentity(identity) {
    const profile = identity || {};
    const corporateFields = [
        "company", "tagline", "document", "registration", "phone", "whatsapp",
        "email", "website", "address", "city", "state", "zip_code",
        "description", "specialties", "logo_report_scale", "cover_photo_report_scale"
    ];
    const payload = {};
    corporateFields.forEach((field) => { payload[field] = String(profile[field] || "").trim(); });
    const result = await client.rpc("aurora_update_my_company_corporate_identity", { p_identity: payload });
    if (result.error) throw new Error(result.error.message || "Não foi possível salvar os dados corporativos da empresa.");
    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!data || data.ok !== true) throw new Error("A nuvem não confirmou os dados corporativos da empresa.");
    return data;
}

async function listMyModules() {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 350));
        const { data, error } = await client.rpc("aurora_my_modules");
        if (!error) return Array.isArray(data) ? data : [];
        lastError = error;
    }
    throw new Error(`Não foi possível carregar os Módulos Aurora: ${lastError ? lastError.message : "falha de conexão"}`);
}

async function saveModuleServices(moduleCode, selectedServices) {
    const code = String(moduleCode || "").trim();
    const services = Array.isArray(selectedServices)
        ? Array.from(new Set(selectedServices.map((item) => String(item || "").trim()).filter(Boolean)))
        : [];
    if (!code || !services.length) throw new Error("Selecione ao menos um serviço oferecido.");
    const { data, error } = await client.rpc("aurora_update_my_module_services", {
        p_module_code: code,
        p_selected_services: services
    });
    if (error) throw new Error(`Não foi possível salvar os serviços do módulo: ${error.message}`);
    return data;
}

const MODULE_SERVICES_PENDING_PREFIX = "aurora_module_service_selection_pending_v1:";

function moduleServicesPendingKey(userId, moduleCode) {
    return `${MODULE_SERVICES_PENDING_PREFIX}${String(userId || "").trim()}:${String(moduleCode || "").trim()}`;
}

function saveModuleServicesPending(userId, moduleCode, selectedServices) {
    const id = String(userId || "").trim();
    const code = String(moduleCode || "").trim();

    if (!id || !code) {
        return false;
    }

    localStorage.setItem(moduleServicesPendingKey(id, code), JSON.stringify({
        module_code: code,
        selected_services: selectedServices,
        saved_at: new Date().toISOString()
    }));

    return true;
}

function clearModuleServicesPending(userId, moduleCode) {
    localStorage.removeItem(moduleServicesPendingKey(userId, moduleCode));
}

function listModuleServicesPendingEntries(userId) {
    const prefix = `${MODULE_SERVICES_PENDING_PREFIX}${String(userId || "").trim()}:`;
    const entries = [];

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);

        if (!key || !key.startsWith(prefix)) {
            continue;
        }

        try {
            const parsed = JSON.parse(localStorage.getItem(key));

            if (parsed && parsed.module_code && Array.isArray(parsed.selected_services)) {
                entries.push(parsed);
            }
        } catch (error) {
            continue;
        }
    }

    return entries;
}

async function assertModuleServicesAllowedOffline(moduleCode) {
    const userId = String(global.AURORA_ACCOUNT_USER_ID || "").trim();
    const code = String(moduleCode || "").trim();
    const offlineLicense = global.AuroraOfflineLicense;

    if (!userId || !code || !offlineLicense || typeof offlineLicense.resolveColdStartTicketContext !== "function") {
        throw new Error("Este módulo não está autorizado para edição offline.");
    }

    const context = global.AURORA_OFFLINE_STARTUP_CTX ||
        await offlineLicense.resolveColdStartTicketContext(userId);
    const authorized = Boolean(
        context &&
        context.ok &&
        (context.modules || []).some((item) =>
            String(item.module_code || "") === code &&
            item.can_access === true
        )
    );

    if (!authorized) {
        throw new Error("Este módulo não está autorizado offline.");
    }

    return true;
}

async function saveModuleServicesResilient(moduleCode, selectedServices) {
    const code = String(moduleCode || "").trim();
    const services = Array.isArray(selectedServices)
        ? Array.from(new Set(selectedServices.map((item) => String(item || "").trim()).filter(Boolean)))
        : [];
    const userId = String(global.AURORA_ACCOUNT_USER_ID || "").trim();

    if (!code || !services.length) {
        throw new Error("Selecione ao menos um serviço oferecido.");
    }

    if (isBrowserOffline()) {
        await assertModuleServicesAllowedOffline(code);

        if (userId) {
            saveModuleServicesPending(userId, code, services);
        }

        return {
            synced: false,
            pending: true,
            selected_services: services
        };
    }

    try {
        const data = await saveModuleServices(code, services);

        if (userId) {
            clearModuleServicesPending(userId, code);
        }

        return {
            synced: true,
            pending: false,
            data,
            selected_services: services
        };
    } catch (error) {
        if (!isRetryableNetworkError(error)) {
            throw error;
        }

        await assertModuleServicesAllowedOffline(code);

        if (userId) {
            saveModuleServicesPending(userId, code, services);
        }

        return {
            synced: false,
            pending: true,
            selected_services: services
        };
    }
}

async function syncPendingModuleServices() {
    const userId = String(global.AURORA_ACCOUNT_USER_ID || "").trim();

    if (!userId || isBrowserOffline()) {
        return { synced: 0, failed: 0, pending: listModuleServicesPendingEntries(userId).length };
    }

    const entries = listModuleServicesPendingEntries(userId);
    let synced = 0;
    let failed = 0;

    for (const entry of entries) {
        try {
            await saveModuleServices(entry.module_code, entry.selected_services);
            clearModuleServicesPending(userId, entry.module_code);
            synced += 1;
        } catch (error) {
            if (isRetryableNetworkError(error)) {
                failed += 1;
                continue;
            }

            console.error("AURORA OFFLINE LICENSE module_services_sync_rejected", {
                module_code: entry.module_code,
                error: error && error.message ? String(error.message) : "rejected"
            });
            failed += 1;
        }
    }

    if (synced > 0) {
        console.info("AURORA OFFLINE LICENSE", {
            mode: "module_services_pending_synced",
            synced,
            failed
        });
    }

    return {
        synced,
        failed,
        pending: listModuleServicesPendingEntries(userId).length
    };
}

async function claimInitialModule(moduleCode) {
    const code = String(moduleCode || "").trim();
    if (!code) throw new Error("O módulo inicial não foi identificado.");
    const { data, error } = await client.rpc("aurora_claim_initial_module", {
        p_module_code: code
    });
    if (error) throw new Error(`Não foi possível preparar o módulo inicial: ${error.message}`);
    return Array.isArray(data) ? data : [];
}

async function startModuleTrial(moduleCode) {
    const code = String(moduleCode || "").trim();
    if (!code) throw new Error("O módulo da demonstração não foi identificado.");
    const { data, error } = await client.rpc("aurora_start_module_trial", {
        p_module_code: code
    });
    if (error) throw new Error(`Não foi possível iniciar a demonstração: ${error.message}`);
    return Array.isArray(data) ? data[0] : data;
}

async function getMyCompanyMembershipState() {
    const { data, error } = await client.rpc("aurora_my_company_membership_state");
    if (error) throw new Error(`Não foi possível confirmar o vínculo empresarial: ${error.message}`);
    const payload = Array.isArray(data) ? data[0] : data;
    return payload && typeof payload === "object" ? payload : { loaded: true };
}

async function getMyProfile() {
    const userResult = await client.auth.getUser();
    const user = userResult && userResult.data ? userResult.data.user : null;
    if (!user || !user.id) throw new Error("A conta autenticada não foi identificada.");

    const { data, error } = await client
        .from("aurora_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
    if (error) throw new Error(`Não foi possível carregar o perfil Aurora: ${error.message}`);

    return {
        ...(data || {}),
        email: (data && data.email) || user.email || "",
        full_name:
            (data && (data.full_name || data.name)) ||
            (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
            ""
    };
}


async function provisionMyCompany(companyName, moduleCode) {
    const name = String(companyName || "").trim();
    if (!name) throw new Error("Informe o nome da empresa.");
    const code = String(moduleCode || "").trim();
    if (!code) throw new Error("O módulo empresarial não foi identificado.");
    const { data, error } = await client.rpc("aurora_self_provision_company_v2", { p_name: name, p_module_code: code });
    if (error) {
        const message = String(error.message || "");
        if (message.includes("AURORA_ALREADY_COMPANY_MEMBER")) {
            throw new Error("Esta conta já pertence a uma empresa Aurora e não pode criar outra empresa.");
        }
        if (message.includes("AURORA_AUTH_REQUIRED")) {
            throw new Error("Sua sessão expirou. Entre novamente para criar a empresa.");
        }
        throw new Error(message || "Não foi possível criar a empresa Aurora.");
    }
    if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.refresh === "function") {
        await global.AuroraCompanyAccess.refresh(client);
    }
    return data || null;
}
global.AuroraModulesApi = {
    listMyModules,
    provisionMyCompany,
    claimInitialModule,
    startModuleTrial,
    getMyProfile,
    getMyCompanyMembershipState,
    saveModuleServices,
    saveModuleServicesResilient
};

const TRIAL_DAYS = 5;
let resolveAuthReady;
global.AuroraAuthReady = new Promise((resolve) => { resolveAuthReady = resolve; });
let authReadyResolved = false;
let deferredAuthReadySession = null;
let inFlightRefreshPromise = null;
let lastAuthenticatedSession = null;
let authSessionRevoked = false;
let lastAccessCheck = null;
let activeModuleAccess = null;
let lastCounterUser = null;

function shouldDeferAuthReadyForPendingInvite() {
    return Boolean(
        global.AuroraCompanyInviteAccept &&
        typeof global.AuroraCompanyInviteAccept.shouldDeferBootForPendingInvite === "function" &&
        global.AuroraCompanyInviteAccept.shouldDeferBootForPendingInvite()
    );
}

function shouldForceInviteAuthGate() {
    return Boolean(
        global.AuroraCompanyInviteAccept &&
        typeof global.AuroraCompanyInviteAccept.shouldRequireExplicitAuthForPendingInvite === "function" &&
        global.AuroraCompanyInviteAccept.shouldRequireExplicitAuthForPendingInvite()
    );
}

function finalizeDeferredAuthReady() {
    try { global.AuroraBootDiagV78 && global.AuroraBootDiagV78.mark("FINALIZE_DEFERRED_ENTER", "resolved="+Boolean(authReadyResolved)+" session="+Boolean(lastAuthenticatedSession && lastAuthenticatedSession.user)); } catch (_) {}
    if (authReadyResolved) return;
    const session = deferredAuthReadySession || lastAuthenticatedSession;
    if (!session) return;
    authReadyResolved = true;
    deferredAuthReadySession = null;
    resolveAuthReady(session);
}

function releaseAuthenticatedApp(session) {
    v78mark("AUTH_RELEASE");
    if (!session || authReadyResolved) return;
    global.AURORA_ACCOUNT_USER_ID = session.user && session.user.id ? session.user.id : "";
    lastAuthenticatedSession = session;
    authSessionRevoked = false;
    if (shouldDeferAuthReadyForPendingInvite()) {
        deferredAuthReadySession = session;
        return;
    }
    authReadyResolved = true;
    resolveAuthReady(session);
}

function normalizedAccountStatus(user) {
    const metadata = Object.assign({}, user && user.user_metadata, user && user.app_metadata);
    return String(metadata.access_status || metadata.account_status || metadata.status || "active").trim().toLowerCase();
}

function isBlockedUser(user) {
    return ["blocked", "bloqueado", "disabled", "suspended", "inactive", "expired", "excluido", "excluído"]
        .includes(normalizedAccountStatus(user));
}

function accessDeniedMessage(access) {
    const status = String(access && access.access_status || "").trim().toLowerCase();
    if (["blocked", "bloqueado", "disabled", "suspended", "inactive"].includes(status)) {
        return "Esta conta foi bloqueada no Aurora Admin e não pode acessar a Aurora.";
    }
    if (status === "expired" || (access && access.allowed === false)) {
        return "O período de acesso desta conta terminou. Entre em contato com o administrador.";
    }
    return "Esta conta não está autorizada a acessar a Aurora.";
}

async function refreshCompanyAccessClaim() {
    if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.refresh === "function") {
        try {
            await global.AuroraCompanyAccess.refresh(client);
        } catch (error) {
            console.warn("Aurora: claim de empresa indisponível.", error);
        }
        if (global.AuroraCompanyTeam && typeof global.AuroraCompanyTeam.syncNavVisibility === "function") {
            global.AuroraCompanyTeam.syncNavVisibility();
        }
        if (global.AuroraAssetsPilot && typeof global.AuroraAssetsPilot.sync === "function") {
            global.AuroraAssetsPilot.sync();
        }
        try { global.dispatchEvent(new CustomEvent("aurora:company-access-ready")); } catch (_) {}
        return;
    }
    global.AURORA_COMPANY_ACCESS = { loaded: false, source: "helper_absent" };
    global.AURORA_ACCOUNT_ENTITLEMENTS = null;
}

async function verifyAccountAccess(session) {
    if (!session || !session.user || !session.user.id) {
        return { allowed: false, message: "Sessão inválida. Entre novamente." };
    }
    const { data, error } = await client.rpc("aurora_my_access");
    if (error) throw new Error(`Não foi possível confirmar a autorização da conta: ${error.message}`);
    const access = Array.isArray(data) ? data[0] : data;
    if (!access || String(access.user_id || "") !== String(session.user.id)) {
        return { allowed: false, message: "Esta conta não possui um perfil de acesso válido." };
    }
    const allowed = access.allowed === true || String(access.allowed).toLowerCase() === "true";
    if (allowed) {
        await refreshCompanyAccessClaim();
    } else if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.clear === "function") {
        global.AuroraCompanyAccess.clear();
    }
    return { allowed, access, message: allowed ? "" : accessDeniedMessage(access) };
}

async function denyCurrentSession(message) {
    authSessionRevoked = true;
    lastAuthenticatedSession = null;
    try {
        const { data } = await client.auth.getSession();
        const userId = data && data.session && data.session.user ? data.session.user.id : "";

        if (
            userId &&
            global.AuroraOfflineLicense &&
            typeof global.AuroraOfflineLicense.clearLicenseTicket === "function"
        ) {
            global.AuroraOfflineLicense.clearLicenseTicket(userId);
        }
    } catch (error) {
        console.error(error);
    }

    await client.auth.signOut({ scope: "local" });
    if (global.AuroraAccountStorage) global.AuroraAccountStorage.suspend();
    if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.clear === "function") {
        global.AuroraCompanyAccess.clear();
    }
    global.AURORA_ACCOUNT_EMAIL = "";
    global.AURORA_ACCOUNT_USER_ID = "";
    global.AURORA_OFFLINE_LICENSE_STATE = "blocked";
    lastAccessCheck = { allowed: false, message: message || "Acesso não autorizado." };
    return null;
}

function getCommercialNowMs(userId) {
    const id = String(userId || global.AURORA_ACCOUNT_USER_ID || "").trim();
    const offlineLicense = global.AuroraOfflineLicense;

    if (
        id &&
        offlineLicense &&
        typeof offlineLicense.getEstimatedTrustedNowMs === "function"
    ) {
        const trustedNow = Number(offlineLicense.getEstimatedTrustedNowMs(id));

        if (Number.isFinite(trustedNow)) {
            return trustedNow;
        }
    }

    return Date.now();
}

function trialInfo(user, access) {
    const userId = String(user && user.id || global.AURORA_ACCOUNT_USER_ID || "").trim();
    const serverDays = Number(access && access.days_remaining);
    const serverEnd = access && access.trial_ends_at ? new Date(access.trial_ends_at) : null;

    if (Number.isFinite(serverDays) && serverEnd && !Number.isNaN(serverEnd.getTime())) {
        return {
            endsAt: serverEnd,
            days: Math.max(0, Math.ceil(serverDays)),
            expired: serverDays <= 0,
            source: "server"
        };
    }

    const metadata = Object.assign({}, user && user.user_metadata, user && user.app_metadata);
    const commercialNow = getCommercialNowMs(userId);
    const startedAt = new Date(metadata.trial_started_at || metadata.test_started_at || (user && user.created_at) || commercialNow);
    const explicitEnd = metadata.trial_ends_at || metadata.trial_end || metadata.test_ends_at || metadata.expires_at;
    const endsAt = explicitEnd ? new Date(explicitEnd) : new Date(startedAt.getTime() + TRIAL_DAYS * 86400000);
    const remainingMs = endsAt.getTime() - commercialNow;

    return {
        endsAt,
        days: Math.max(0, Math.ceil(remainingMs / 86400000)),
        expired: remainingMs <= 0,
        source: "local"
    };
}

function moduleTrialInfo(module) {
    const endsAt = module && module.ends_at ? new Date(module.ends_at) : null;

    if (!endsAt || Number.isNaN(endsAt.getTime())) {
        return null;
    }

    const commercialNow = getCommercialNowMs();
    const remainingMs = endsAt.getTime() - commercialNow;

    return {
        endsAt,
        days: Math.max(0, Math.ceil(remainingMs / 86400000)),
        expired: remainingMs <= 0
    };
}

function renderTrialCounter(user, access) {
    let counter = document.querySelector("[data-aurora-trial-counter]");
    const moduleStatus = String(activeModuleAccess && activeModuleAccess.access_status || "").trim().toLowerCase();
    if (moduleStatus === "trial") {
        const info = moduleTrialInfo(activeModuleAccess);
        if (!info) {
            if (counter) counter.remove();
            return;
        }
        if (!counter) {
            counter = document.createElement("div");
            counter.className = "aurora-trial-counter";
            counter.dataset.auroraTrialCounter = "";
            counter.setAttribute("role", "status");
            document.body.appendChild(counter);
        }
        counter.classList.toggle("is-expired", info.expired);
        counter.textContent = info.expired
            ? "Demonstração do módulo encerrada"
            : info.days === 0
                ? "Demonstração do módulo · vence hoje"
                : `Demonstração do módulo · ${info.days} ${info.days === 1 ? "dia restante" : "dias restantes"}`;
        counter.title = `Demonstração de ${activeModuleAccess.title || "módulo"} até ${info.endsAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`;
        return;
    }
    const status = String(access && access.access_status || "").trim().toLowerCase();
    if (status !== "trial") {
        if (counter) counter.remove();
        return;
    }
    if (!counter) {
        counter = document.createElement("div");
        counter.className = "aurora-trial-counter";
        counter.dataset.auroraTrialCounter = "";
        counter.setAttribute("role", "status");
        document.body.appendChild(counter);
    }
    const info = trialInfo(user, access);
    counter.classList.toggle("is-expired", info.expired);
    counter.textContent = info.expired
        ? "Avaliação da conta encerrada"
        : `Conta em avaliação · ${info.days} ${info.days === 1 ? "dia restante" : "dias restantes"}`;
    counter.title = `Avaliação geral da conta até ${info.endsAt.toLocaleDateString("pt-BR")}`;
}

function setActiveModuleAccess(module) {
    activeModuleAccess = module || null;
    if (lastCounterUser) renderTrialCounter(lastCounterUser, lastAccessCheck && lastAccessCheck.access);
}

async function refreshActiveModuleAccess() {
    if (!activeModuleAccess || !activeModuleAccess.module_code) return;
    const modules = await listMyModules();
    const current = modules.find((item) => item.module_code === activeModuleAccess.module_code);
    if (current) setActiveModuleAccess(current);
}

global.AuroraTrialCounter = { setActiveModuleAccess, refreshActiveModuleAccess };

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function assertOwnedRows(rows, userId, context) {
    const expectedOwner = String(userId || "").trim();
    if (!expectedOwner) throw new Error("Sessão inválida. Entre novamente.");
    const list = Array.isArray(rows) ? rows : (rows ? [rows] : []);
    const foreign = list.find((item) => !item || String(item.created_by || "") !== expectedOwner);
    if (foreign) {
        throw new Error(`Acesso bloqueado por segurança: a resposta de ${context || "nuvem"} contém dados de outra conta.`);
    }
    return rows;
}
function readState() {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(STATE_KEY) || "{}") || {}; }
    catch (_) { stored = {}; }
    return Object.assign({}, stored, volatileSyncState);
}
function writeState(value) {
    volatileSyncState = clone(value || {});
    const serialized = JSON.stringify(value || {});
    try {
        localStorage.setItem(STATE_KEY, serialized);
        syncDiag("writeState_success", { bytes_utf16: serialized.length * 2, entries: Object.keys(value || {}).length });
        return { ok: true, quota_exceeded: false };
    } catch (error) {
        const quotaExceeded = Boolean(error && (
            error.name === "QuotaExceededError" ||
            error.code === 22 || error.code === 1014 ||
            /quota/i.test(String(error.message || error))
        ));
        syncDiag("writeState_failure", {
            bytes_utf16: serialized.length * 2,
            entries: Object.keys(value || {}).length,
            quota_exceeded: quotaExceeded,
            error_name: String(error && error.name || "Error"),
            error_message: String(error && error.message || error)
        });
        console.warn("[AURORA CLOUD SYNC STATE] Cache local não persistido; estado volátil preservado.", error);
        return { ok: false, quota_exceeded: quotaExceeded, error };
    }
}
function withTimeout(promiseFactory, milliseconds, timeoutMessage) {
    let timeoutId;
    const controller = new AbortController();
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            controller.abort();
            reject(new Error(timeoutMessage));
        }, milliseconds);
    });
    return Promise.race([promiseFactory(controller.signal), timeout]).finally(() => clearTimeout(timeoutId));
}
function currentCase() {
    if (global.auroraRuntime && typeof global.auroraRuntime.getCase === "function") {
        return clone(global.auroraRuntime.getCase());
    }
    if (global.auroraRepository) {
        const saved = global.auroraRepository.load();
        return saved && saved.case ? clone(saved.case) : null;
    }
    return null;
}
function hasMeaningfulCaseData(data) {
    if (!data || typeof data !== "object") return false;
    const customer = normalizeObject(data.customer);
    return Boolean(
        String(customer.name || customer.company_name || customer.company || "").trim() ||
        String(data.report_title || data.title || "").trim() ||
        (Array.isArray(data.evidence_groups) && data.evidence_groups.length) ||
        (Array.isArray(data.occurrences) && data.occurrences.length) ||
        Object.keys(normalizeObject(data.intake)).some((key) => String(data.intake[key] ?? "").trim()) ||
        Object.keys(normalizeObject(data.asset)).some((key) => String(data.asset[key] ?? "").trim()) ||
        Object.keys(normalizeObject(data.custom_values)).some((key) => String(data.custom_values[key] ?? "").trim()) ||
        Object.keys(normalizeObject(data.diagnostic)).some((key) => String(data.diagnostic[key] ?? "").trim()) ||
        Object.keys(normalizeObject(data.approval)).some((key) => String(data.approval[key] ?? "").trim())
    );
}
function localReports() {
    try {
        const reports = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
        return Array.isArray(reports) ? reports : [];
    } catch (_) {
        return [];
    }
}
function latestCompletedCase() {
    const candidates = localReports()
        .filter((report) => report && report.snapshot && hasMeaningfulCaseData(report.snapshot))
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    if (!candidates.length) return null;
    const selected = clone(candidates[0].snapshot);
    selected.status = candidates[0].status || selected.status || "Concluído";
    return selected;
}
function localCasesForSync() {
    const candidates = [];
    /*
     * A seleção de envio precisa espelhar exatamente os atendimentos que o
     * usuário consegue ver no módulo atual. O runtime/repositório pode manter
     * um formulário de trabalho mesmo depois de o respectivo card ter sido
     * excluído. Usá-lo aqui fazia "Projeto AURORA" e outros snapshots
     * invisíveis reaparecerem como candidatos à sincronização.
     */
    const visibleReports = typeof global.AuroraVisibleCloudSyncReports === "function"
        ? global.AuroraVisibleCloudSyncReports()
        : localReports();
    (Array.isArray(visibleReports) ? visibleReports : []).forEach((report) => {
        if (!report || !report.snapshot || !report.snapshot.id || !hasMeaningfulCaseData(report.snapshot)) return;
        const data = clone(report.snapshot);
        data.status = report.status || data.status || "Concluído";
        candidates.push({ data, source: "saved", saved_at: report.updated_at || report.created_at || data.updated_at || data.created_at || null });
    });
    const byId = new Map();
    candidates.forEach((candidate) => {
        const id = String(candidate.data.id);
        const previous = byId.get(id);
        const candidateTime = new Date(candidate.saved_at || 0).getTime() || 0;
        const previousTime = previous ? (new Date(previous.saved_at || 0).getTime() || 0) : -1;
        if (!previous || candidateTime >= previousTime) byId.set(id, candidate);
    });
    return Array.from(byId.values()).sort((a, b) =>
        (new Date(b.saved_at || 0).getTime() || 0) - (new Date(a.saved_at || 0).getTime() || 0)
    );
}
function stripBinary(value) {
    if (Array.isArray(value)) return value.map(stripBinary);
    if (!value || typeof value !== "object") return value;
    const result = {};
    Object.keys(value).forEach((key) => {
        if (/^(photos?|images?|evidences?|evidence_groups|pdf|files?|blob|data_url|thumbnail|original)$/i.test(key)) return;
        const item = value[key];
        if (typeof item === "string" && /^data:(image|application\/pdf)/i.test(item)) return;
        result[key] = stripBinary(item);
    });
    return result;
}

function canonicalEvidenceGroupsForWorkflow(data) {
    const groups = data && Array.isArray(data.evidence_groups)
        ? data.evidence_groups
        : [];

    return groups.map((group) => ({
        ...stripBinary(group || {}),
        photos: (Array.isArray(group && group.photos) ? group.photos : []).map((photo) => ({
            id: photo && photo.id ? String(photo.id) : "",
            title: photo && photo.title ? String(photo.title) : "",
            description: photo && photo.description ? String(photo.description) : "",
            category: photo && photo.category ? String(photo.category) : "",
            created_at: photo && photo.created_at ? photo.created_at : null,
            saved_at: photo && photo.saved_at ? photo.saved_at : null,
            has_photo: Boolean(photo && (
                photo.has_photo || photo.id || photo.src || photo.edited_src ||
                photo.data_url || photo.url || photo.object_url || photo.blob
            ))
        })).filter((photo) => photo.id || photo.has_photo)
    }));
}

function canonicalCoverPhotoForWorkflow(data) {
    const cover = data && data.coverPhoto && typeof data.coverPhoto === "object"
        ? data.coverPhoto
        : null;
    if (!cover) return null;
    return {
        id: cover.id ? String(cover.id) : "",
        alt: cover.alt ? String(cover.alt) : "",
        has_photo: Boolean(cover.has_photo || cover.source_photo_id || cover.src),
        created_at: cover.created_at || null,
        source_photo_id: cover.source_photo_id ? String(cover.source_photo_id) : null
    };
}
function projectPatch(data) {
    const service = data.service || {};
    const completed = ["concluído", "concluido", "completed"].includes(String(data.status || "").trim().toLowerCase());
    /* A mesma situação funcional não pode gerar assinaturas diferentes apenas
       porque o runtime usa "completed" e o relatório usa "Concluído". */
    const canonicalCase = { ...data, status: completed ? "completed" : "in_progress" };
    return {
        legacy_case_id: String(data.id || "").trim(),
        title: (data.customer && (data.customer.name || data.customer.company_name || data.customer.company)) || data.project_name || data.report_title || service.title || "Projeto AURORA",
        status: completed ? "completed" : "in_progress",
        service_profile: data.profile_id || data.module_id || service.profile || null,
        service_type: service.id || service.title || null,
        customer: stripBinary(data.customer || {}),
        asset: stripBinary(data.asset || {}),
        intake: stripBinary(data.intake || {}),
        custom_fields: stripBinary({ values: data.custom_values || {}, definitions: data.custom_fields || [] }),
        diagnostic: stripBinary(data.diagnostic || {}),
        approval: stripBinary(data.approval || {}),
        workflow_state: stripBinary({
            full_case: canonicalCase,
            operation_type: data.operation_type,
            operation_type_label: data.operation_type_label,
            flow_template: data.flow_template,
            record_section_title: data.record_section_title,
            service: data.service || null,
            occurrence: data.occurrence || {},
            dynamic_fields: data.dynamic_fields || {},
            shape_metadata: data.shape_metadata || {},
            created_at: data.created_at || null,
            completed_at: data.completed_at || null
        }),
        source_schema_version: 1
    };
}

function syncSignature(data) {
    const text = JSON.stringify({ project: projectPatch(data), records: recordsFromCase(data) });
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `v1-${(hash >>> 0).toString(16)}`;
}

function canonicalJson(value) {
    if (Array.isArray(value)) return value.map(canonicalJson);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
        result[key] = canonicalJson(value[key]);
        return result;
    }, {});
}

function canonicalEqual(left, right) {
    return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function canonicalRecord(record) {
    return {
        local_record_id: String(record && record.local_record_id || ""),
        position: Number(record && record.position || 0),
        record_type: String(record && record.record_type || "occurrence"),
        title: String(record && record.title || "Registro"),
        payload: normalizeObject(record && record.payload)
    };
}

async function validateCanonicalAdminSave(projectId, submittedPatch, submittedRecords) {
    const projectResult = await client.from("aurora_projects")
        .select("id,legacy_case_id,title,status,service_profile,service_type,customer,asset,intake,custom_fields,diagnostic,approval,workflow_state,row_version,created_by,company_id,updated_at")
        .eq("id", projectId).is("deleted_at", null).single();
    if (projectResult.error) throw projectResult.error;
    const recordsResult = await client.from("aurora_project_records")
        .select("local_record_id,position,record_type,title,payload")
        .eq("project_id", projectId).is("deleted_at", null).order("position", { ascending: true });
    if (recordsResult.error) throw recordsResult.error;
    const project = projectResult.data || {};
    const checks = {
        legacy_case_id: String(project.legacy_case_id || "") === String(submittedPatch.legacy_case_id || ""),
        title: String(project.title || "") === String(submittedPatch.title || ""),
        status: String(project.status || "") === String(submittedPatch.status || ""),
        service_profile: String(project.service_profile || "") === String(submittedPatch.service_profile || ""),
        service_type: String(project.service_type || "") === String(submittedPatch.service_type || ""),
        customer: canonicalEqual(normalizeObject(project.customer), normalizeObject(submittedPatch.customer)),
        asset: canonicalEqual(normalizeObject(project.asset), normalizeObject(submittedPatch.asset)),
        intake: canonicalEqual(normalizeObject(project.intake), normalizeObject(submittedPatch.intake)),
        custom_fields: canonicalEqual(normalizeObject(project.custom_fields), normalizeObject(submittedPatch.custom_fields)),
        diagnostic: canonicalEqual(normalizeObject(project.diagnostic), normalizeObject(submittedPatch.diagnostic)),
        approval: canonicalEqual(normalizeObject(project.approval), normalizeObject(submittedPatch.approval)),
        workflow_state: canonicalEqual(normalizeObject(project.workflow_state), normalizeObject(submittedPatch.workflow_state)),
        records: canonicalEqual(
            (recordsResult.data || []).map(canonicalRecord),
            (submittedRecords || []).map(canonicalRecord)
        )
    };
    return {
        ok: Object.values(checks).every(Boolean),
        checks,
        project,
        records: recordsResult.data || []
    };
}

function localSyncStatus(data) {
    if (!data || !data.id) return { synchronized: false, link: null };
    const link = readState()[data.id] || null;
    return {
        synchronized: Boolean(link && link.project_id && link.sync_signature === syncSignature(data)),
        link
    };
}

function publicSyncStatus(data) {
    const status = localSyncStatus(data);
    if (status.synchronized) return { state: "synced", synchronized: true, link: status.link };
    if (status.link && status.link.project_id) return { state: "update", synchronized: false, link: status.link };
    return { state: "pending", synchronized: false, link: null };
}

function cloudDownloadStatus(project) {
    if (!project || !project.id || !project.legacy_case_id) return { downloaded: false, localCase: null, link: null };
    const localCaseId = String(project.legacy_case_id);
    /*
     * "Já baixado" precisa refletir os atendimentos que o usuário realmente
     * consegue abrir pela tela inicial. O repositório também pode guardar um
     * snapshot residual do último editor aberto; esse snapshot não é um
     * atendimento local quando ele já foi removido de Atendimentos recentes.
     */
    const visibleReports = typeof global.AuroraVisibleCloudSyncReports === "function"
        ? global.AuroraVisibleCloudSyncReports()
        : localReports();
    const localReport = (Array.isArray(visibleReports) ? visibleReports : []).find((report) => {
        if (!report || !report.snapshot) return false;
        const reportCaseId = String(report.snapshot.id || report.case_id || report.id || "");
        return reportCaseId === localCaseId && hasMeaningfulCaseData(report.snapshot);
    }) || null;
    const localCandidate = localReport
        ? {
            data: clone(localReport.snapshot),
            source: "saved",
            saved_at: localReport.updated_at || localReport.created_at || null
        }
        : null;
    const link = readState()[localCaseId] || null;
    const localVersion = Number(link && link.row_version || 0);
    const cloudVersion = Number(project.row_version || 1);
    return {
        downloaded: Boolean(
            localCandidate &&
            link &&
            String(link.project_id || "") === String(project.id) &&
            localVersion >= cloudVersion
        ),
        localCase: localCandidate,
        link
    };
}

function normalizeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {};
}

function normalizeSearchable(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

/*
 * Assinatura usada pelo fluxo guiado atual (saveGuidedSlotPhoto):
 * item vazio + severity "Sem gravidade — não exibir no relatório".
 * Títulos espelham PHOTO_META / legacyGuideTitles de vehicle_inspection_flow.js.
 */
const GUIDED_PHOTO_SEVERITY =
    "Sem gravidade — não exibir no relatório";

const LEGACY_GUIDED_TITLES = new Set([
    "frente do veiculo",
    "traseira do veiculo",
    "lateral esquerda do veiculo",
    "lateral direita do veiculo",
    "painel / km (odometro)",
    "foto frente",
    "foto traseira",
    "foto lateral esquerda",
    "foto lateral direita",
    "foto painel / km"
]);

function resolvePayloadRecordKind(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const kind = record.record_kind;

    if (kind != null && String(kind).trim() !== "") {
        return String(kind).trim();
    }

    return null;
}

function isLegacyGuidedPhotoRecord(record) {
    if (!record || typeof record !== "object") {
        return false;
    }

    if (String(record.item || "").trim()) {
        return false;
    }

    const title = normalizeSearchable(
        String(record.title || "").trim()
    );

    if (!LEGACY_GUIDED_TITLES.has(title)) {
        return false;
    }

    const severity = String(record.severity || "").trim();

    return (
        !severity ||
        severity === GUIDED_PHOTO_SEVERITY
    );
}

function isGuidedPhotoRecord(record) {
    if (!record || typeof record !== "object") {
        return false;
    }

    if (resolvePayloadRecordKind(record) === "vehicle_guided_photo") {
        return true;
    }

    if (resolvePayloadRecordKind(record)) {
        return false;
    }

    return isLegacyGuidedPhotoRecord(record);
}

function inferVehiclePhotoSlot(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    if (record.vehicle_photo_slot) {
        return String(record.vehicle_photo_slot);
    }

    /*
     * Ocorrências técnicas (record_kind neutro + item preenchido) nunca
     * devem ganhar slot guiado só porque o texto contém Frente/Painel/KM.
     */
    if (!isGuidedPhotoRecord(record)) {
        return null;
    }

    const searchable = normalizeSearchable([
        record.title,
        record.item,
        record.description
    ].filter(Boolean).join(" "));

    if (/(^|\s)frente(\s|$)/.test(searchable)) {
        return "front";
    }

    if (/(^|\s)traseira?(\s|$)|(^|\s)traseiro(\s|$)/.test(searchable)) {
        return "rear";
    }

    if (/lateral esquerda|lado esquerdo/.test(searchable)) {
        return "left";
    }

    if (/lateral direita|lado direito/.test(searchable)) {
        return "right";
    }

    if (/painel|quilometr|odometr|hodometr|\bkm\b/.test(searchable)) {
        return "dashboard";
    }

    return null;
}

function lightEvidenceRef(record, caseId, index) {
    const payload =
        record &&
        record.payload &&
        typeof record.payload === "object"
            ? normalizeObject(record.payload)
            : normalizeObject(record);
    const explicitKind = resolvePayloadRecordKind(payload);
    const guided = isGuidedPhotoRecord(payload);
    const slot = guided
        ? inferVehiclePhotoSlot(payload)
        : (payload.vehicle_photo_slot
            ? String(payload.vehicle_photo_slot)
            : null);
    const id = String(
        payload.id ||
        (record && record.local_record_id) ||
        (record && record.id) ||
        `record-${index + 1}`
    );

    return {
        id,
        case_id: caseId,
        title: payload.title || (record && record.title) || "",
        item: payload.item || "",
        severity: payload.severity || "",
        description: payload.description || "",
        recommendation: payload.recommendation || "",
        record_kind:
            explicitKind ||
            (guided && slot ? "vehicle_guided_photo" : null),
        vehicle_photo_slot: slot,
        created_at: payload.created_at || null,
        saved_at: payload.saved_at || null,
        photos: (Array.isArray(payload.photos) ? payload.photos : []).map((photo) => ({
            id: photo && photo.id ? String(photo.id) : "",
            title: photo && photo.title ? String(photo.title) : "",
            description: photo && photo.description ? String(photo.description) : "",
            category: photo && photo.category ? String(photo.category) : "",
            created_at: photo && photo.created_at ? photo.created_at : null,
            saved_at: photo && photo.saved_at ? photo.saved_at : null,
            has_photo: Boolean(photo && (photo.has_photo || photo.id))
        })).filter((photo) => photo.id || photo.has_photo)
    };
}

function dedupeEvidenceGroupRefs(refs, caseId) {
    const output = [];
    const slotSeen = new Set();
    const idSeen = new Set();

    (refs || []).forEach((reference, index) => {
        const ref = lightEvidenceRef(reference, caseId, index);

        if (!ref.id || idSeen.has(ref.id)) {
            return;
        }

        if (
            ref.record_kind === "vehicle_guided_photo" &&
            ref.vehicle_photo_slot
        ) {
            if (slotSeen.has(ref.vehicle_photo_slot)) {
                return;
            }

            slotSeen.add(ref.vehicle_photo_slot);
        }

        idSeen.add(ref.id);
        output.push(ref);
    });

    return output;
}

function evidenceRefsFromCloudCase(fullCase, records, caseId) {
    const fromGroups = Array.isArray(fullCase.evidence_groups)
        ? fullCase.evidence_groups
        : [];

    if (Array.isArray(fullCase.evidence_groups)) {
        return dedupeEvidenceGroupRefs(
            fromGroups.map((group) => ({ payload: group })),
            caseId
        );
    }

    const sortedRecords = (records || []).slice().sort(
        (a, b) => Number(a.position || 0) - Number(b.position || 0)
    );

    if (sortedRecords.length) {
        return dedupeEvidenceGroupRefs(sortedRecords, caseId);
    }

    const fromOccurrences = Array.isArray(fullCase.occurrences)
        ? fullCase.occurrences
        : [];

    return dedupeEvidenceGroupRefs(fromOccurrences, caseId);
}

function legacyOccurrencesFromEvidenceGroups(groups) {
    return (Array.isArray(groups) ? groups : []).map((group, index) => ({
        id: group.id,
        title: group.title || "",
        item: group.item || "",
        severity: group.severity || "",
        description: group.description || "",
        recommendation: group.recommendation || "",
        record_kind: group.record_kind || null,
        vehicle_photo_slot: group.vehicle_photo_slot || null,
        type:
            group.record_kind === "vehicle_guided_photo"
                ? "vehicle_guided_photo"
                : "occurrence",
        position: index
    }));
}

function caseFromCloud(project, records) {
    const workflow = normalizeObject(project.workflow_state);
    const custom = normalizeObject(project.custom_fields);
    const service = normalizeObject(workflow.service);
    if (!service.id && project.service_type) service.id = project.service_type;
    if (!service.title && project.service_type) service.title = project.service_type;
    if (!service.profile && project.service_profile) service.profile = project.service_profile;
    const fullCase = normalizeObject(workflow.full_case);
    const caseId = String(project.legacy_case_id || fullCase.id || "").trim();
    const evidence_groups = evidenceRefsFromCloudCase(
        fullCase,
        records || [],
        caseId
    );
    const projectCustomer = normalizeObject(project.customer);

    const restored = {
        ...fullCase,
        id: caseId,
        profile_id: project.service_profile || service.profile || "workshop",
        module_id: project.service_profile || service.profile || "workshop",
        status: project.status === "completed" ? "Concluído" : "Em andamento",
        service,
        customer: projectCustomer,
        asset: normalizeObject(project.asset),
        intake: normalizeObject(project.intake),
        custom_values: normalizeObject(custom.values),
        custom_fields: Array.isArray(custom.definitions) ? clone(custom.definitions) : [],
        occurrence: normalizeObject(workflow.occurrence),
        /*
         * Metadados fotográficos vivem em evidence_groups (refs leves, sem blobs).
         * occurrences legado fica espelhado somente para compatibilidade de sync.
         */
        evidence_groups,
        occurrences: legacyOccurrencesFromEvidenceGroups(evidence_groups),
        evidences: [],
        diagnostic: normalizeObject(project.diagnostic),
        approval: normalizeObject(project.approval),
        operation_type: workflow.operation_type || "inspection",
        operation_type_label: workflow.operation_type_label || "Operação técnica",
        flow_template: workflow.flow_template || "technical",
        record_section_title: workflow.record_section_title || "Registros técnicos",
        dynamic_fields: normalizeObject(workflow.dynamic_fields),
        shape_metadata: normalizeObject(workflow.shape_metadata),
        reports: [],
        created_at: workflow.created_at || project.created_at,
        updated_at: project.updated_at,
        completed_at: workflow.completed_at || (project.status === "completed" ? project.updated_at : null),
        restored_from_cloud: true
    };
    if (!hasMeaningfulCaseData(restored)) {
        throw new Error("O backup selecionado não contém dados de um atendimento. Sincronize novamente o trabalho preenchido antes de baixá-lo.");
    }
    return restored;
}
async function listCloudProjects(abortSignal) {
    const session = await requireSession();
    const userId = session.user.id;
    /*
     * Home / nuvem: lista OWNER-ONLY (created_by).
     * Lista empresarial Phase B fica EXCLUSIVA da Gestão via
     * AuroraCompanyAccess.listMyCompanyProjects → aurora_list_my_company_projects.
     * Não misturar arrays nem chamar RPC ADMIN na Home.
     */
    let request = client.from("aurora_projects")
        .select("id,legacy_case_id,title,status,service_profile,service_type,row_version,created_at,updated_at,created_by,company_id")
        .eq("created_by", userId)
        .is("deleted_at", null).order("updated_at", { ascending: false });
    if (abortSignal && typeof request.abortSignal === "function") request = request.abortSignal(abortSignal);
    const { data, error } = await request;
    if (error) {
        /* company_id pode não existir ainda no banco — retry sem a coluna. */
        if (/company_id/i.test(String(error.message || ""))) {
            let legacy = client.from("aurora_projects")
                .select("id,legacy_case_id,title,status,service_profile,service_type,row_version,created_at,updated_at,created_by")
                .eq("created_by", userId)
                .is("deleted_at", null).order("updated_at", { ascending: false });
            if (abortSignal && typeof legacy.abortSignal === "function") legacy = legacy.abortSignal(abortSignal);
            const retry = await legacy;
            if (retry.error) throw retry.error;
            assertOwnedRows(retry.data || [], userId, "projetos");
            return retry.data || [];
        }
        throw error;
    }
    assertOwnedRows(data || [], userId, "projetos");
    return data || [];
}
function assertActiveRestore(operation) {
    if (!operation || operation.cancelled || activeRestore !== operation) {
        throw new Error("Download cancelado com segurança.");
    }
}
async function downloadCloudProject(projectId, abortSignal, operation) {
    const session = await requireSession();
    const userId = session.user.id;
    const canViewCompany = global.AuroraCompanyAccess
        && typeof global.AuroraCompanyAccess.canViewCompanyCases === "function"
        && global.AuroraCompanyAccess.canViewCompanyCases();
    const canManageGestao = global.AuroraCompanyAccess
        && typeof global.AuroraCompanyAccess.canManageEletricaTupy === "function"
        && global.AuroraCompanyAccess.canManageEletricaTupy();
    const claimCompanyId = global.AuroraCompanyAccess
        && typeof global.AuroraCompanyAccess.resolvedCompanyId === "function"
        ? global.AuroraCompanyAccess.resolvedCompanyId()
        : null;
    assertActiveRestore(operation);

    let projectRequest = client.from("aurora_projects")
        .select("id,legacy_case_id,title,status,service_profile,service_type,customer,asset,intake,custom_fields,diagnostic,approval,workflow_state,row_version,created_at,updated_at,created_by,company_id,updated_by")
        .eq("id", projectId).is("deleted_at", null);
    if (!canViewCompany && !canManageGestao) {
        projectRequest = projectRequest.eq("created_by", userId);
    }
    projectRequest = projectRequest.single();
    if (abortSignal && typeof projectRequest.abortSignal === "function") projectRequest = projectRequest.abortSignal(abortSignal);
    let project;
    let projectError;
    ({ data: project, error: projectError } = await projectRequest);
    if (projectError && /company_id/i.test(String(projectError.message || ""))) {
        let legacyRequest = client.from("aurora_projects")
            .select("id,legacy_case_id,title,status,service_profile,service_type,customer,asset,intake,custom_fields,diagnostic,approval,workflow_state,row_version,created_at,updated_at,created_by")
            .eq("id", projectId).eq("created_by", userId).is("deleted_at", null).single();
        if (abortSignal && typeof legacyRequest.abortSignal === "function") legacyRequest = legacyRequest.abortSignal(abortSignal);
        ({ data: project, error: projectError } = await legacyRequest);
    }
    if (projectError) throw projectError;

    const isOwner = String(project.created_by || "") === String(userId);
    const sameCompany = Boolean(
        claimCompanyId
        && project.company_id
        && String(project.company_id) === String(claimCompanyId)
    );
    if (!isOwner && !sameCompany) {
        throw new Error("Este atendimento não pertence à sua conta nem à sua empresa.");
    }
    if (!isOwner && (sameCompany || canManageGestao)) {
        const denied = new Error(
            "Atendimentos da equipe devem ser visualizados pela Gestão (somente leitura)."
        );
        denied.code = "AURORA_PEER_DOWNLOAD_BLOCKED";
        throw denied;
    }
    if (isOwner) {
        assertOwnedRows(project, userId, "projeto selecionado");
    }
    assertActiveRestore(operation);

    let recordsRequest = client.from("aurora_project_records")
        .select("local_record_id,position,record_type,title,payload,row_version,created_by")
        .eq("project_id", projectId).is("deleted_at", null).order("position", { ascending: true });
    if (!sameCompany) {
        recordsRequest = recordsRequest.eq("created_by", userId);
    }
    if (abortSignal && typeof recordsRequest.abortSignal === "function") recordsRequest = recordsRequest.abortSignal(abortSignal);
    const { data: records, error: recordsError } = await recordsRequest;
    if (recordsError) throw recordsError;
    if (!sameCompany) {
        assertOwnedRows(records || [], userId, "registros do projeto");
    }
    assertActiveRestore(operation);
    const restoredCase = caseFromCloud(project, records || []);
    if (project.company_id && !restoredCase.company_id) {
        restoredCase.company_id = project.company_id;
    }
    if (global.auroraRuntime && typeof global.auroraRuntime.resetCase === "function") {
        await global.auroraRuntime.resetCase(restoredCase, { reason: "cloud_restore" });
    }
    if (global.auroraRepository && typeof global.auroraRepository.save === "function") {
        global.auroraRepository.save(restoredCase);
    }
    const allState = readState();
    allState[restoredCase.id] = {
        project_id: project.id,
        row_version: Number(project.row_version),
        synced_at: new Date().toISOString(),
        sync_signature: syncSignature(restoredCase)
    };
    writeState(allState);
    global.dispatchEvent(new CustomEvent("aurora:cloud-project-restored", {
        detail: { caseData: clone(restoredCase), project: clone(project) }
    }));

    /*
     * Não grave um status falso de download. O evento acima precisa ter
     * transformado o backup em um atendimento realmente visível antes de a
     * operação ser anunciada como concluída.
     */
    const persistedStatus = cloudDownloadStatus(project);
    if (!persistedStatus.downloaded) {
        const rollbackState = readState();
        delete rollbackState[restoredCase.id];
        writeState(rollbackState);
        throw new Error("O projeto foi recebido, mas não pôde ser incluído em Atendimentos recentes. Tente baixar novamente.");
    }
    return { caseData: restoredCase, project };
}

async function hydrateAuthorizedProjectEvidence(caseData, projectId) {
    const data = clone(caseData || {});
    const pid = String(projectId || "").trim();
    if (!pid) return data;
    const reader = global.AuroraEvidenceCloudReader;
    if (!reader || typeof reader.loadAssetHistoryEvidence !== "function") return data;
    const evidenceSession = await reader.loadAssetHistoryEvidence(client, pid);
    const groups = Array.isArray(data.evidence_groups) ? data.evidence_groups : [];
    const byGroup = new Map(groups.filter(Boolean).map((group) => [String(group.id || ""), group]));
    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
        if (!blob || typeof FileReader === "undefined") return resolve("");
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ""));
        fr.onerror = () => reject(fr.error || new Error("AURORA_EVIDENCE_READ_FAILED"));
        fr.readAsDataURL(blob);
    });
    for (const item of (Array.isArray(evidenceSession && evidenceSession.items) ? evidenceSession.items : [])) {
        const evidenceId = String(item && item.evidence_id || "");
        const groupId = String(item && item.group_id || "");
        let source = "";
        try { source = await blobToDataUrl(item && item.blob); } catch (_) { source = ""; }
        if (!source) source = String(item && (item.object_url || item.url) || "");
        const cover = data.coverPhoto || data.cover_photo || null;
        const coverId = String(cover && cover.id || "");
        const isCover = Boolean(source && ((coverId && coverId === evidenceId) || /^cover-photo-/i.test(evidenceId) || /^cover-photo-/i.test(groupId)));
        const group = byGroup.get(groupId);
        if (!group && isCover) {
            data.coverPhoto = { ...(cover || {}), id: coverId || evidenceId || groupId, src: source, has_photo: true };
            data.cover_photo = null;
            continue;
        }
        if (!group) continue;
        if (!Array.isArray(group.photos)) group.photos = [];
        let photo = group.photos.find((candidate) => candidate && String(candidate.id || "") === evidenceId);
        if (!photo) { photo = { id: evidenceId, title: "", description: "", category: "general", has_photo: true }; group.photos.push(photo); }
        if (source) { photo.src = source; photo.url = source; photo.has_photo = true; }
    }
    data.evidence_groups = groups;
    data.occurrences = legacyOccurrencesFromEvidenceGroups(groups);
    const cover = data.coverPhoto || data.cover_photo || null;
    if (cover && cover.source_photo_id && !cover.src) {
        for (const group of groups) {
            const photo = (Array.isArray(group.photos) ? group.photos : []).find((p) => String(p && p.id || "") === String(cover.source_photo_id));
            if (!photo) continue;
            const source = String(photo.edited_src || photo.src || photo.url || "");
            if (source) data.coverPhoto = { ...cover, src: source, has_photo: true };
            break;
        }
    }
    return data;
}

async function restoreCompanyProjectForAdmin(projectId, options = {}) {
    const session = await requireSession();
    const userId = session.user.id;
    const pid = String(projectId || "").trim();
    if (!pid) throw new Error("Atendimento inválido.");
    const access = global.AuroraCompanyAccess;
    if (!access || typeof access.canManageUsers !== "function" || !access.canManageUsers()) {
        throw new Error("Você não tem permissão para administrar este atendimento.");
    }
    const claimCompanyId = typeof access.resolvedCompanyId === "function" ? access.resolvedCompanyId() : null;
    const projectResult = await client.from("aurora_projects")
        .select("id,legacy_case_id,title,status,service_profile,service_type,customer,asset,intake,custom_fields,diagnostic,approval,workflow_state,row_version,created_at,updated_at,created_by,company_id,updated_by")
        .eq("id", pid).is("deleted_at", null).single();
    if (projectResult.error) throw projectResult.error;
    const project = projectResult.data;
    if (!project || !claimCompanyId || String(project.company_id || "") !== String(claimCompanyId)) {
        throw new Error("Este atendimento não pertence à sua empresa.");
    }
    const recordsResult = await client.from("aurora_project_records")
        .select("local_record_id,position,record_type,title,payload,row_version,created_by")
        .eq("project_id", pid).is("deleted_at", null).order("position", { ascending: true });
    if (recordsResult.error) throw recordsResult.error;
    const caseData = caseFromCloud(project, recordsResult.data || []);

    /* R11.4 — ADMIN empresarial genérico: reidrata as fotos autenticadas da
       nuvem antes de publicar o atendimento local. Não altera autoria nem
       EvidenceStore global; apenas completa as refs já presentes no case. */
    try {
        const reader = global.AuroraEvidenceCloudReader;
        if (reader && typeof reader.loadProjectEvidence === "function") {
            const evidenceSession = await reader.loadProjectEvidence(client, pid);
            const groups = Array.isArray(caseData.evidence_groups) ? caseData.evidence_groups : [];
            const byGroup = new Map(groups.filter(Boolean).map((group) => [String(group.id || ""), group]));
            const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
                if (!blob || typeof FileReader === "undefined") return resolve("");
                const fr = new FileReader();
                fr.onload = () => resolve(String(fr.result || ""));
                fr.onerror = () => reject(fr.error || new Error("AURORA_EVIDENCE_READ_FAILED"));
                fr.readAsDataURL(blob);
            });
            for (const item of (Array.isArray(evidenceSession && evidenceSession.items) ? evidenceSession.items : [])) {
                const group = byGroup.get(String(item && item.group_id || ""));
                const evidenceId = String(item && item.evidence_id || "");
                let source = "";
                try { source = await blobToDataUrl(item && item.blob); } catch (_) { source = ""; }
                if (!source) source = String(item && (item.object_url || item.url) || "");
                const cover = caseData.coverPhoto || caseData.cover_photo || null;
                const coverEvidenceId = String((cover && cover.id) || "");
                const isDirectCoverEvidence = Boolean(
                    source && (
                        (coverEvidenceId && coverEvidenceId === evidenceId) ||
                        /^cover-photo-/i.test(evidenceId) ||
                        /^cover-photo-/i.test(String(item && item.group_id || ""))
                    )
                );
                if (!group && isDirectCoverEvidence) {
                    caseData.coverPhoto = {
                        ...(cover || {}),
                        id: coverEvidenceId || evidenceId || String(item && item.group_id || ""),
                        src: source,
                        has_photo: true
                    };
                    caseData.cover_photo = null;
                    continue;
                }
                if (!group) continue;
                if (!Array.isArray(group.photos)) group.photos = [];
                let photo = group.photos.find((candidate) => candidate && String(candidate.id || "") === evidenceId);
                if (!photo) {
                    photo = { id: evidenceId, title: "", description: "", category: "general", has_photo: true };
                    group.photos.push(photo);
                }
                if (source) {
                    photo.src = source;
                    photo.url = source;
                    photo.object_url = source.indexOf("blob:") === 0 ? source : "";
                    photo.has_photo = true;
                }
            }
            caseData.evidence_groups = groups;
            caseData.occurrences = legacyOccurrencesFromEvidenceGroups(groups);
            const cover = caseData.coverPhoto || caseData.cover_photo || null;
            if (cover && cover.source_photo_id && !cover.src) {
                const sourceId = String(cover.source_photo_id);
                let sourcePhoto = null;
                for (const group of groups) {
                    sourcePhoto = (Array.isArray(group.photos) ? group.photos : []).find((photo) => String(photo && photo.id || "") === sourceId) || null;
                    if (sourcePhoto) break;
                }
                const source = sourcePhoto ? String(sourcePhoto.edited_src || sourcePhoto.src || sourcePhoto.url || "") : "";
                if (source) caseData.coverPhoto = { ...cover, src: source, has_photo: true };
            }
        }
    } catch (evidenceError) {
        console.warn("[EMPRESA] Fotos cloud indisponíveis; atendimento textual preservado.", evidenceError);
    }

    const state = readState();
    /* Restauração/hidratação não prova que o estado local foi gravado na nuvem.
     * Preserve vínculo e versão, mas nunca fabrique uma assinatura de sucesso. */
    state[caseData.id] = { project_id: project.id, row_version: Number(project.row_version), restored_at: new Date().toISOString(), company_admin_peer: true, canonical_verified: false, original_created_by: project.created_by, company_id: project.company_id };
    const restoreWrite = writeState(state);
    syncDiag("admin_restore_hydrated", {
        case_id: caseData.id,
        project_id: project.id,
        row_version: Number(project.row_version),
        customer_phone: String((caseData.customer && caseData.customer.phone) ?? ""),
        customer_email: String((caseData.customer && caseData.customer.email) ?? ""),
        sync_signature: null,
        company_admin_peer: true,
        write_state_ok: restoreWrite.ok
    });
    global.dispatchEvent(new CustomEvent("aurora:cloud-project-restored", {
        detail: {
            caseData: clone(caseData),
            project: clone(project),
            companyAdminPeer: true,
            suppressNavigation: options && options.suppressNavigation === true,
            openIntent: String(options && options.openIntent || "")
        }
    }));
    return { caseData, project };
}

async function hydrateOwnProjectsMissingLocally() {
    const stats = { found: 0, hydrated: 0, skipped_existing: 0, skipped_local_pending: 0, failed: 0 };

    try {
        const session = await requireSession();
        const userId = String(session.user.id);
        const projects = await listCloudProjects();
        stats.found = projects.length;
        console.info("[MULTIDEVICE] cloud projects found", { count: stats.found });

        const localById = new Map();
        localReports().forEach((report) => {
            const snapshot = report && report.snapshot;
            const caseId = String(snapshot && snapshot.id || report && (report.case_id || report.id) || "").trim();
            if (caseId) localById.set(caseId, snapshot || report);
        });
        const workingCase = currentCase();
        if (workingCase && workingCase.id && hasMeaningfulCaseData(workingCase)) {
            localById.set(String(workingCase.id), workingCase);
        }

        for (const summary of projects) {
            const caseId = String(summary.legacy_case_id || "").trim();
            if (!caseId) {
                stats.failed += 1;
                continue;
            }

            const localCase = localById.get(caseId);
            let forceCanonicalHydration = false;
            if (localCase) {
                /* V156 — lei offline-first: um atendimento explicitamente pendente
                   nunca pode ser substituído pelo pull da nuvem. O refresh envia
                   pendências antes de hidratar; se ainda restou pendente, preserva local. */
                if (pendingCaseIds().includes(caseId)) {
                    /* V47 — pending não é autoridade de frescor por si só.
                       Se a nuvem avançou depois do snapshot local, o marcador pendente
                       é tratado como residual e não pode bloquear a hidratação para sempre.
                       Uma edição offline legítima continua protegida quando o local é
                       posterior/igual ao cloud; nesse caso não há overwrite silencioso. */
                    const localStatusForPending = localSyncStatus(localCase);
                    const localUpdatedAt = Date.parse(String(localCase.updated_at || localCase.completed_at || "")) || 0;
                    const cloudUpdatedAt = Date.parse(String(summary.updated_at || summary.created_at || "")) || 0;
                    const linkVersion = Number(localStatusForPending.link && localStatusForPending.link.row_version || 0);
                    const cloudVersionForPending = Number(summary.row_version || 0);
                    const cloudIsNewer = cloudVersionForPending > linkVersion ||
                        (cloudVersionForPending >= linkVersion && cloudUpdatedAt > localUpdatedAt);
                    if (!cloudIsNewer) {
                        stats.skipped_local_pending += 1;
                        continue;
                    }
                    forceCanonicalHydration = true;
                }
                const localStatus = localSyncStatus(localCase);
                /* R11.14 — ADMIN -> USER: row_version da nuvem é a autoridade para
                   uma moderação já persistida. O relatório recém-gerado pode mudar a
                   assinatura local depois do sync e não pode, por isso, bloquear o pull.
                   Só hidrata quando a nuvem realmente avançou. */
                const localVersion = Number(localStatus.link && localStatus.link.row_version || 0);
                const cloudVersion = Number(summary.row_version || 0);
                if (!forceCanonicalHydration && !(cloudVersion > localVersion)) {
                    if (!localStatus.synchronized) stats.skipped_local_pending += 1;
                    else stats.skipped_existing += 1;
                    continue;
                }
            }

            try {
                const projectResult = await client.from("aurora_projects")
                    .select("id,legacy_case_id,title,status,service_profile,service_type,customer,asset,intake,custom_fields,diagnostic,approval,workflow_state,row_version,created_at,updated_at,created_by,company_id,updated_by")
                    .eq("id", summary.id)
                    .eq("created_by", userId)
                    .is("deleted_at", null)
                    .single();
                if (projectResult.error) throw projectResult.error;
                assertOwnedRows(projectResult.data, userId, "hidratação de projeto");

                const recordsResult = await client.from("aurora_project_records")
                    .select("local_record_id,position,record_type,title,payload,row_version,created_by")
                    .eq("project_id", summary.id)
                    .eq("created_by", userId)
                    .is("deleted_at", null)
                    .order("position", { ascending: true });
                if (recordsResult.error) throw recordsResult.error;
                assertOwnedRows(recordsResult.data || [], userId, "hidratação de registros");

                const caseData = caseFromCloud(projectResult.data, recordsResult.data || []);

                /* R11.13 — autoria preservada + moderação administrativa visível ao proprietário.
                   updated_by já é gravado pela RPC administrativa. Só marca moderação quando
                   quem salvou é diferente do criador original do atendimento. */
                if (projectResult.data.updated_by &&
                    String(projectResult.data.updated_by) !== String(projectResult.data.created_by || "")) {
                    let moderatorName = "Administrador";
                    try {
                        const moderatorResult = await client.from("aurora_profiles")
                            .select("professional_name,full_name,email")
                            .eq("user_id", projectResult.data.updated_by)
                            .maybeSingle();
                        if (!moderatorResult.error && moderatorResult.data) {
                            moderatorName = String(
                                moderatorResult.data.professional_name ||
                                moderatorResult.data.full_name ||
                                moderatorResult.data.email ||
                                moderatorName
                            ).trim() || moderatorName;
                        }
                    } catch (_) { /* identificação visual não bloqueia hidratação */ }
                    caseData.aurora_moderation = {
                        altered_by: String(projectResult.data.updated_by),
                        altered_by_name: moderatorName,
                        altered_at: projectResult.data.updated_at || new Date().toISOString(),
                        row_version: Number(projectResult.data.row_version || 1)
                    };
                } else if (caseData.aurora_moderation) {
                    delete caseData.aurora_moderation;
                }

                const state = readState();
                state[caseData.id] = {
                    project_id: projectResult.data.id,
                    row_version: Number(projectResult.data.row_version),
                    synced_at: new Date().toISOString(),
                    sync_signature: syncSignature(caseData)
                };
                writeState(state);
                localById.set(caseData.id, caseData);
                global.dispatchEvent(new CustomEvent("aurora:cloud-project-hydrated", {
                    detail: {
                        caseData: clone(caseData),
                        project: clone(projectResult.data),
                        automaticHydration: true
                    }
                }));
                if (forceCanonicalHydration) {
                    clearPendingCaseSync(caseId);
                    clearTupyPendingFlag(caseId);
                }
                stats.hydrated += 1;
                console.info("[MULTIDEVICE] project hydrated", { case_id: caseData.id });
            } catch (error) {
                stats.failed += 1;
                console.warn("[MULTIDEVICE] project hydration failed", {
                    project_id: String(summary.id || ""),
                    message: String(error && error.message || error || "error")
                });
            }
        }
    } catch (error) {
        stats.failed += 1;
        console.warn("[MULTIDEVICE] hydration unavailable", {
            message: String(error && error.message || error || "error")
        });
    }

    console.info("[MULTIDEVICE] hydration complete", stats);
    return stats;
}

async function loadCompanyProjectForAdmin(projectId) {
    const session = await requireSession();
    const userId = session.user.id;
    const pid = String(projectId || "").trim();
    if (!pid) throw new Error("AURORA_ADMIN_PROJECT_ID_MISSING");

    const access = global.AuroraCompanyAccess;
    const canManage = access && typeof access.canManageEletricaTupy === "function"
        ? access.canManageEletricaTupy()
        : false;
    if (!canManage) throw new Error("AURORA_ADMIN_REVIEW_FORBIDDEN");

    let projectRequest = client.from("aurora_projects")
        .select("id,legacy_case_id,title,status,service_profile,service_type,customer,asset,intake,custom_fields,diagnostic,approval,workflow_state,row_version,created_at,updated_at,created_by,company_id,updated_by")
        .eq("id", pid).is("deleted_at", null).single();
    let projectResult = await projectRequest;
    if (projectResult.error && /company_id/i.test(String(projectResult.error.message || ""))) {
        projectResult = await client.from("aurora_projects")
            .select("id,legacy_case_id,title,status,service_profile,service_type,customer,asset,intake,custom_fields,diagnostic,approval,workflow_state,row_version,created_at,updated_at,created_by")
            .eq("id", pid).is("deleted_at", null).single();
    }
    if (projectResult.error) throw projectResult.error;
    const project = projectResult.data;
    if (!project) throw new Error("AURORA_ADMIN_PROJECT_NOT_FOUND");

    let recordsResult = await client.from("aurora_project_records")
        .select("id,local_record_id,position,record_type,title,payload,row_version,created_by")
        .eq("project_id", pid).is("deleted_at", null)
        .order("position", { ascending: true });
    if (recordsResult.error) throw recordsResult.error;

    return { project, records: Array.isArray(recordsResult.data) ? recordsResult.data : [], user_id: userId };
}

async function saveAdminProjectRecords(projectId, caseData) {
    await requireSession();
    const pid = String(projectId || "").trim();
    if (!pid) throw new Error("AURORA_ADMIN_PROJECT_ID_MISSING");
    if (!caseData || !caseData.id) throw new Error("AURORA_ADMIN_CASE_MISSING");

    const access = global.AuroraCompanyAccess;
    const canManage = access && typeof access.canManageEletricaTupy === "function"
        ? access.canManageEletricaTupy()
        : false;
    if (!canManage) throw new Error("AURORA_ADMIN_REVIEW_FORBIDDEN");

    const projectResult = await client.from("aurora_projects")
        .select("id,created_by,company_id,row_version")
        .eq("id", pid).is("deleted_at", null).single();
    if (projectResult.error) throw projectResult.error;
    const project = projectResult.data;
    if (!project) throw new Error("AURORA_ADMIN_PROJECT_NOT_FOUND");

    const canonicalGroups = canonicalEvidenceGroupsForWorkflow(caseData);
    const runtimeCase = global.auroraRuntime && typeof global.auroraRuntime.getCase === "function"
        ? global.auroraRuntime.getCase()
        : null;
    const coverSource = runtimeCase && String(runtimeCase.id || "") === String(caseData.id || "")
        ? runtimeCase
        : caseData;
    const reviewSave = await client.rpc("aurora_save_tupy_admin_review", {
        p_project_id: pid,
        p_expected_version: project.row_version,
        p_evidence_groups: canonicalGroups,
        p_cover_photo: canonicalCoverPhotoForWorkflow(coverSource)
    });
    if (reviewSave.error) {
        const code = String(reviewSave.error.code || "");
        const message = String(reviewSave.error.message || "");
        if (code === "40001" || /AURORA_ADMIN_REVIEW_VERSION_CONFLICT/.test(message)) {
            throw new Error("Este atendimento foi atualizado por outra pessoa. Reabra-o antes de salvar.");
        }
        if (code === "42501" || /AURORA_ADMIN_REVIEW_(FORBIDDEN|ENTITLEMENT_REQUIRED|COMPANY_REQUIRED|TUPY_ONLY)/.test(message)) {
            throw new Error("Você não tem permissão para revisar este atendimento.");
        }
        if (code === "P0002" || /AURORA_ADMIN_REVIEW_PROJECT_NOT_FOUND/.test(message)) {
            throw new Error("Este atendimento não foi encontrado. Volte ao início e abra-o novamente.");
        }
        throw reviewSave.error;
    }

    const saved = Array.isArray(reviewSave.data) ? reviewSave.data[0] : reviewSave.data;
    return {
        project_id: pid,
        records_saved: Number(saved && saved.records_saved || canonicalGroups.length),
        row_version: saved && saved.row_version != null
            ? Number(saved.row_version)
            : Number(project.row_version || 0) + 1
    };
}

function canonicalAdminCaseStateForWorkflow(data) {
    const clean = stripBinary(data || {});
    if (!clean || typeof clean !== "object") return {};
    delete clean.admin_review;
    delete clean.admin_review_source;
    delete clean.restored_from_cloud;
    delete clean.cloud_created_by;
    return clean;
}

async function saveAdminProjectState(projectId, caseData) {
    await requireSession();
    const pid = String(projectId || "").trim();
    if (!pid) throw new Error("AURORA_ADMIN_PROJECT_ID_MISSING");
    if (!caseData || !caseData.id) throw new Error("AURORA_ADMIN_CASE_MISSING");

    const access = global.AuroraCompanyAccess;
    const canManage = access && typeof access.canManageEletricaTupy === "function"
        ? access.canManageEletricaTupy()
        : false;
    if (!canManage) throw new Error("AURORA_ADMIN_REVIEW_FORBIDDEN");

    const projectResult = await client.from("aurora_projects")
        .select("id,row_version")
        .eq("id", pid).is("deleted_at", null).single();
    if (projectResult.error) throw projectResult.error;
    const project = projectResult.data;
    if (!project) throw new Error("AURORA_ADMIN_PROJECT_NOT_FOUND");

    const savedState = await client.rpc("aurora_save_tupy_admin_case_state", {
        p_project_id: pid,
        p_expected_version: project.row_version,
        p_case_state: canonicalAdminCaseStateForWorkflow(caseData)
    });
    if (savedState.error) {
        const code = String(savedState.error.code || "");
        const message = String(savedState.error.message || "");
        if (code === "40001" || /AURORA_ADMIN_STATE_VERSION_CONFLICT/.test(message)) {
            throw new Error("Este atendimento foi atualizado por outra pessoa. Reabra-o antes de salvar.");
        }
        if (code === "42501" || /AURORA_ADMIN_STATE_(FORBIDDEN|ENTITLEMENT_REQUIRED|COMPANY_REQUIRED|TUPY_ONLY)/.test(message)) {
            throw new Error("Você não tem permissão para salvar esta revisão.");
        }
        if (code === "P0002" || /AURORA_ADMIN_STATE_PROJECT_NOT_FOUND/.test(message)) {
            throw new Error("Este atendimento não foi encontrado. Volte ao início e abra-o novamente.");
        }
        throw savedState.error;
    }
    const saved = Array.isArray(savedState.data) ? savedState.data[0] : savedState.data;
    return {
        project_id: pid,
        row_version: saved && saved.row_version != null
            ? Number(saved.row_version)
            : Number(project.row_version || 0) + 1
    };
}

function recordsFromCase(data) {
    const groups = Array.isArray(data.evidence_groups)
        ? data.evidence_groups
        : [];
    const source = groups.length
        ? groups
        : (Array.isArray(data.occurrences) ? data.occurrences : []);
    return source.map((record, index) => ({
        local_record_id: String(record.id || record.local_id || `record-${index + 1}`),
        position: index,
        record_type: record.type || record.kind || "occurrence",
        title: record.title || record.item || `Registro ${index + 1}`,
        payload: stripBinary(record)
    }));
}
async function requireSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Faça login antes de sincronizar.");
    const authorization = await verifyAccountAccess(data.session);
    if (!authorization.allowed) {
        await denyCurrentSession(authorization.message);
        throw new Error(authorization.message);
    }
    return data.session;
}
async function saveRecords(projectId, records, userId) {
    const { data: existing, error } = await client.from("aurora_project_records")
        .select("id,local_record_id,row_version,created_by").eq("project_id", projectId).eq("created_by", userId).is("deleted_at", null);
    if (error) throw error;
    assertOwnedRows(existing || [], userId, "registros existentes");
    const byLocal = new Map((existing || []).map((item) => [item.local_record_id, item]));
    for (const record of records) {
        const found = byLocal.get(record.local_record_id);
        if (found) {
            const { error: updateError } = await client.from("aurora_project_records")
                .update({ ...record, row_version: Number(found.row_version) + 1, updated_by: userId, updated_at: new Date().toISOString() })
                .eq("id", found.id).eq("created_by", userId).eq("row_version", found.row_version);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await client.from("aurora_project_records").insert(recordWithProject(record, projectId, userId));
            if (insertError) throw insertError;
        }
    }
}
function recordWithProject(record, projectId, userId) {
    return { ...record, project_id: projectId, created_by: userId, updated_by: userId };
}
async function syncSelectedCase(data, abortSignal) {
    const session = await requireSession();
    const userId = session.user.id;
    if (!data || !data.id || !hasMeaningfulCaseData(data)) throw new Error("O atendimento escolhido está vazio e não pode ser sincronizado.");
    const allState = readState();
    let link = allState[data.id] || null;
    const signature = syncSignature(data);
    syncDiag("syncSelectedCase_start", {
        case_id: data.id,
        customer_phone: String((data.customer && data.customer.phone) ?? ""),
        customer_email: String((data.customer && data.customer.email) ?? ""),
        project_id: link && link.project_id || null,
        row_version: link && Number(link.row_version),
        sync_signature: link && link.sync_signature || null,
        candidate_signature: signature,
        company_admin_peer: Boolean(link && link.company_admin_peer)
    });

    async function attachEvidenceSync(projectId, companyId, baseResult) {
        const evidenceApi = global.AuroraEvidenceCloudSync;
        if (!evidenceApi || typeof evidenceApi.syncCaseEvidence !== "function") {
            return Object.assign({}, baseResult, {
                evidence: { skipped: true, reason: "module_missing" }
            });
        }
        try {
            const evidence = await evidenceApi.syncCaseEvidence({
                client,
                caseData: data,
                projectId,
                companyId: companyId || null
            });
            return Object.assign({}, baseResult, { evidence });
        } catch (error) {
            console.warn("[STORAGE-B] evidence sync failed safely:", error);
            return Object.assign({}, baseResult, {
                evidence: {
                    skipped: false,
                    failed: 1,
                    warnings: ["evidence_sync_exception"],
                    failures: [{ message: String(error && error.message || error) }]
                }
            });
        }
    }

    if (link && link.sync_signature === signature && (!link.company_admin_peer || link.canonical_verified === true)) {
        syncDiag("syncSelectedCase_skipped", {
            case_id: data.id,
            project_id: link.project_id,
            row_version: Number(link.row_version),
            sync_signature: signature,
            reason: "canonical_signature_match"
        });
        const unchanged = {
            ...link,
            unchanged: true,
            case_id: data.id,
            case_title: projectPatch(data).title
        };
        /*
         * Fotos não entram no syncSignature (stripBinary).
         * Com flag ON, ainda tenta evidências; com flag OFF, módulo retorna skip imediato.
         */
        return attachEvidenceSync(link.project_id, null, unchanged);
    }
    let saved;
    if (link && link.company_admin_peer) {
        const records = recordsFromCase(data);
        const patch = projectPatch(data);
        syncDiag("admin_rpc_call", {
            case_id: data.id,
            project_id: link.project_id,
            expected_row_version: Number(link.row_version),
            customer_phone: String((patch.customer && patch.customer.phone) ?? ""),
            customer_email: String((patch.customer && patch.customer.email) ?? "")
        });
        const adminSave = await client.rpc("aurora_company_admin_save_project_bundle", {
            p_project_id: link.project_id,
            p_expected_version: Number(link.row_version),
            p_patch: patch,
            p_records: records
        });
        if (adminSave.error) throw adminSave.error;
        const payload = Array.isArray(adminSave.data) ? adminSave.data[0] : adminSave.data;
        link.row_version = Number(payload && payload.row_version || Number(link.row_version) + 1);
        delete link.sync_signature;
        delete link.synced_at;
        syncDiag("admin_rpc_response", {
            case_id: data.id,
            project_id: link.project_id,
            row_version: link.row_version,
            ok: Boolean(payload && payload.ok !== false)
        });
        let canonicalValidation;
        try {
            canonicalValidation = await validateCanonicalAdminSave(link.project_id, patch, records);
        } catch (validationError) {
            canonicalValidation = { ok: false, checks: {}, error: validationError };
        }
        if (canonicalValidation.ok) {
            link.row_version = Number(canonicalValidation.project.row_version || link.row_version);
            link.synced_at = new Date().toISOString();
            link.sync_signature = signature;
            link.canonical_verified = true;
        } else {
            link.canonical_verified = false;
        }
        syncDiag("admin_canonical_validation", {
            case_id: data.id,
            project_id: link.project_id,
            row_version: link.row_version,
            canonical_match: Boolean(canonicalValidation.ok),
            checks: canonicalValidation.checks || {},
            error: canonicalValidation.error ? String(canonicalValidation.error.message || canonicalValidation.error) : null,
            sync_signature: link.sync_signature || null
        });
        allState[data.id] = link;
        const cacheWrite = writeState(allState);
        syncDiag("syncSelectedCase_end", {
            case_id: data.id,
            project_id: link.project_id,
            row_version: link.row_version,
            canonical_match: Boolean(canonicalValidation.ok),
            write_state_ok: cacheWrite.ok,
            quota_exceeded: cacheWrite.quota_exceeded,
            sync_signature: link.sync_signature || null
        });
        return { ...link, case_id: data.id, case_title: patch.title, company_admin_peer: true, canonical_validated: Boolean(canonicalValidation.ok), state_cache_persisted: cacheWrite.ok };
    }
    if (!link) {
        const { data: existing, error: lookupError } = await client.from("aurora_projects")
            .select("id,row_version,updated_at,created_by,company_id").eq("legacy_case_id", data.id).eq("created_by", userId).is("deleted_at", null).maybeSingle();
        if (lookupError) throw lookupError;
        if (existing) assertOwnedRows(existing, userId, "projeto existente");
        if (existing) throw new Error("Este atendimento já existe na nuvem. A abertura segura será implementada na próxima etapa; nada foi sobrescrito.");
        const { data: createdResult, error } = await client.rpc("aurora_create_project", {
            p_project: projectPatch(data)
        });
        if (error) throw error;
        saved = Array.isArray(createdResult) ? createdResult[0] : createdResult;
        if (!saved || !saved.id) throw new Error("O banco não devolveu o projeto criado.");
    } else {
        async function saveWithExpectedVersion(expectedVersion) {
            let updateRequest = client.rpc("aurora_owner_save_project", {
                p_project_id: link.project_id,
                p_expected_version: expectedVersion,
                p_patch: projectPatch(data)
            });
            if (abortSignal && typeof updateRequest.abortSignal === "function") {
                updateRequest.abortSignal(abortSignal);
            }
            let result = await updateRequest;
            const detail = String(result && result.error && (result.error.message || result.error) || "");
            if (result && result.error && /aurora_owner_save_project|function .* does not exist|PGRST202/i.test(detail)) {
                updateRequest = client.rpc("aurora_save_project", {
                    p_project_id: link.project_id,
                    p_expected_version: expectedVersion,
                    p_patch: projectPatch(data)
                });
                if (abortSignal && typeof updateRequest.abortSignal === "function") updateRequest.abortSignal(abortSignal);
                result = await updateRequest;
            }
            return result;
        }

        let updateResult = await saveWithExpectedVersion(link.row_version);
        if (updateResult.error) {
            const detail = String((updateResult.error && updateResult.error.message) || updateResult.error || "");
            const isVersionConflict = /AURORA_VERSION_CONFLICT|version[_ ]conflict|conflito/i.test(detail);
            if (!isVersionConflict) throw updateResult.error;

            /* USER AUTO-SYNC — recuperação canônica de row_version obsoleto.
             * A finalização automática não pode depender do botão Sincronizar.
             * Em conflito, releia a versão atual, confirme ownership e tente UMA vez. */
            const { data: currentProject, error: currentError } = await client.from("aurora_projects")
                .select("id,row_version,created_by,company_id")
                .eq("id", link.project_id)
                .is("deleted_at", null)
                .maybeSingle();
            if (currentError) throw currentError;
            if (!currentProject || !currentProject.id) throw updateResult.error;
            assertOwnedRows(currentProject, userId, "projeto em conflito");

            link.row_version = Number(currentProject.row_version || 1);
            allState[data.id] = Object.assign({}, link);
            writeState(allState);

            updateResult = await saveWithExpectedVersion(link.row_version);
            if (updateResult.error) throw updateResult.error;
        }
        saved = updateResult.data;
    }
    await saveRecords(saved.id, recordsFromCase(data), userId);
    allState[data.id] = {
        project_id: saved.id,
        row_version: Number(saved.row_version),
        synced_at: new Date().toISOString(),
        sync_signature: signature
    };
    writeState(allState);
    const base = {
        ...allState[data.id],
        case_id: data.id,
        case_title: projectPatch(data).title
    };
    return attachEvidenceSync(saved.id, saved.company_id || null, base);
}

const button = document.createElement("button");
button.type = "button";
button.className = "aurora-cloud-button";
button.innerHTML = '<span aria-hidden="true">☁</span><span class="aurora-cloud-button__label">Sincronizar</span>';
button.title = "Sincronizar atendimentos na nuvem";
button.setAttribute("aria-label", "Sincronizar atendimentos na nuvem");
button.setAttribute("aria-label", "Abrir conta e sincronização da nuvem");
button.dataset.state = "pending";
function mountCloudButton() {
    const topbarActions = document.querySelector(".aurora-topbar__actions");
    if (!topbarActions) return false;
    const userChip = topbarActions.querySelector(".aurora-user-chip");
    topbarActions.insertBefore(button, userChip || null);
    return true;
}
if (!mountCloudButton()) {
    const topbarObserver = new MutationObserver(() => {
        if (mountCloudButton()) topbarObserver.disconnect();
    });
    topbarObserver.observe(document.documentElement, { childList: true, subtree: true });
}

const overlay = document.createElement("div");
overlay.className = "aurora-cloud-overlay";
overlay.hidden = true;
overlay.innerHTML = `<section class="aurora-cloud-panel aurora-cloud-panel--library" role="dialog" aria-modal="true" aria-label="Atendimentos salvos na nuvem">
  <header class="aurora-cloud-library-header"><div><span>Nuvem Aurora</span><h2>Atendimentos salvos</h2><p>Baixe um atendimento para continuar neste dispositivo.</p></div><button type="button" data-cloud-close aria-label="Fechar" title="Fechar">×</button></header>
  <form data-cloud-login hidden>
    <label for="aurora-cloud-email">E-mail</label><input id="aurora-cloud-email" type="email" autocomplete="username" required>
    <label for="aurora-cloud-password">Senha</label><input id="aurora-cloud-password" type="password" autocomplete="current-password" required>
    <div class="aurora-cloud-actions"><button type="submit">Entrar</button></div>
  </form>
  <div class="aurora-cloud-actions" data-cloud-connected hidden style="display:none">
    <button type="button" data-cloud-sync>Selecionar projeto para sincronizar</button>
    <button type="button" class="is-secondary" data-cloud-list>Ver projetos salvos na nuvem</button>
    <button type="button" class="is-danger" data-cloud-signout>Desconectar conta da nuvem</button>
  </div>
  <section class="aurora-cloud-local-projects" data-cloud-local-projects hidden style="display:none">
    <div class="aurora-cloud-projects__header">
      <div><strong>Qual projeto você quer sincronizar?</strong><small>Escolha um atendimento salvo neste dispositivo</small></div>
      <button type="button" data-cloud-local-close aria-label="Fechar seleção" title="Fechar seleção">×</button>
    </div>
    <div class="aurora-cloud-projects__list" data-cloud-local-project-list></div>
  </section>
  <section class="aurora-cloud-projects" data-cloud-projects hidden>
    <div class="aurora-cloud-projects__header">
      <div><strong>Disponíveis para baixar</strong><small>Atendimentos armazenados na sua conta</small></div>
      <button type="button" data-cloud-refresh aria-label="Atualizar lista" title="Atualizar lista">↻</button>
    </div>
    <div class="aurora-cloud-projects__list" data-cloud-project-list></div>
  </section>
  <div class="aurora-cloud-result" data-cloud-result aria-live="polite"></div>
</section>`;
document.body.appendChild(overlay);

const authGate = document.createElement("div");
authGate.className = "aurora-auth-gate";
authGate.hidden = true;
authGate.innerHTML = `<section class="aurora-auth-card" role="dialog" aria-modal="true" aria-label="Acesso à AURORA">
  <div class="aurora-auth-brand"><div class="aurora-auth-brand__mark" aria-label="Logo Aurora"><svg viewBox="0 0 180 160" aria-hidden="true"><defs><linearGradient id="auroraAuthLeft" x1="0" x2="1"><stop offset="0" stop-color="#bd36ff"/><stop offset="1" stop-color="#4263ff"/></linearGradient><linearGradient id="auroraAuthRight" x1="0" x2="1"><stop offset="0" stop-color="#20f0ff"/><stop offset="1" stop-color="#3c7dff"/></linearGradient><linearGradient id="auroraAuthCore" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#dcfbff"/><stop offset="1" stop-color="#547cff"/></linearGradient></defs><rect x="39" y="15" width="54" height="94" rx="27" fill="url(#auroraAuthLeft)" transform="rotate(-40 66 62)"/><rect x="87" y="15" width="54" height="94" rx="27" fill="url(#auroraAuthRight)" transform="rotate(40 114 62)"/><rect x="63" y="62" width="54" height="78" rx="25" fill="url(#auroraAuthCore)"/></svg></div><div><strong>AURORA</strong><small>Organize. Inspecione. Evolua.</small></div></div>
  <p class="aurora-auth-eyebrow">Bem-vindo</p>
  <h1 data-auth-title>Entre na sua conta</h1>
  <p data-auth-description>Já possui cadastro? Informe seu e-mail e sua senha para continuar.</p>
  <form data-auth-form>
    <div data-auth-signup-fields hidden>
      <label for="aurora-auth-name">Nome completo</label>
      <input id="aurora-auth-name" type="text" autocomplete="name" minlength="2">
    </div>
    <label for="aurora-auth-email">E-mail</label>
    <input id="aurora-auth-email" type="email" autocomplete="username" required>
    <label for="aurora-auth-password">Senha</label>
    <input id="aurora-auth-password" type="password" autocomplete="current-password" minlength="6" required>
    <div data-auth-confirm-field hidden>
      <label for="aurora-auth-password-confirm">Confirmar senha</label>
      <input id="aurora-auth-password-confirm" type="password" autocomplete="new-password" minlength="6">
    </div>
    <button type="submit" data-auth-submit>Entrar</button>
  </form>
  <button type="button" class="aurora-auth-switch" data-auth-switch>Criar um novo cadastro com e-mail</button>
  <div class="aurora-auth-result" data-auth-result aria-live="polite"></div>
</section>`;
document.body.appendChild(authGate);

const authForm = authGate.querySelector("[data-auth-form]");
const authTitle = authGate.querySelector("[data-auth-title]");
const authDescription = authGate.querySelector("[data-auth-description]");
const authSubmit = authGate.querySelector("[data-auth-submit]");
const authSwitch = authGate.querySelector("[data-auth-switch]");
const authResult = authGate.querySelector("[data-auth-result]");
let authMode = "login";
let entryOpeningActive = false;

async function enterAuroraAfterAuthentication(user, freshAccount) {
    entryOpeningActive = true;
    if (
        global.AuroraCompanyInviteAccept &&
        typeof global.AuroraCompanyInviteAccept.markInviteAuthCompleted === "function"
    ) {
        global.AuroraCompanyInviteAccept.markInviteAuthCompleted();
    }
    if (global.AuroraAccountStorage) {
        if (freshAccount) global.AuroraAccountStorage.initializeFresh(user.id);
        else global.AuroraAccountStorage.activate(user.id);
    }
    authGate.hidden = true;
    document.documentElement.classList.remove("aurora-auth-required");
    if (typeof global.AuroraOpening === "function") await global.AuroraOpening();
    clockDiag("before_location_reload", {
        session_user_present: Boolean(user && user.id)
    }, user && user.id ? user.id : undefined);
    global.location.reload();
}

function setAuthMode(mode) {
    authMode = mode === "signup" ? "signup" : "login";
    const creating = authMode === "signup";
    authTitle.textContent = creating ? "Crie seu cadastro" : "Entre na sua conta";
    authDescription.textContent = creating
        ? "Informe seu nome, e-mail e confirme a senha. O cadastro será enviado ao Aurora Admin."
        : "Já possui cadastro? Informe seu e-mail e sua senha para continuar.";
    authSubmit.textContent = creating ? "Criar cadastro" : "Entrar";
    authSwitch.textContent = creating ? "Já tenho cadastro — entrar" : "Criar um novo cadastro com e-mail";
    authGate.querySelector("#aurora-auth-password").autocomplete = creating ? "new-password" : "current-password";
    const signupFields = authGate.querySelector("[data-auth-signup-fields]");
    const confirmField = authGate.querySelector("[data-auth-confirm-field]");
    const nameInput = authGate.querySelector("#aurora-auth-name");
    const confirmInput = authGate.querySelector("#aurora-auth-password-confirm");
    signupFields.hidden = !creating;
    confirmField.hidden = !creating;
    nameInput.required = creating;
    confirmInput.required = creating;
    if (!creating) {
        nameInput.value = "";
        confirmInput.value = "";
    }
    authResult.textContent = "";
    if (global.AuroraCompanyInviteAccept && typeof global.AuroraCompanyInviteAccept.applyUnauthenticatedInviteHint === "function") {
        global.AuroraCompanyInviteAccept.applyUnauthenticatedInviteHint({
            titleEl: authTitle,
            descriptionEl: authDescription
        });
    }
}
function setAuthGate(session) {
    const forceInviteAuth = shouldForceInviteAuthGate();
    authGate.hidden = forceInviteAuth ? false : Boolean(session);
    document.documentElement.classList.toggle("aurora-auth-required", forceInviteAuth || !session);
    if ((!session || forceInviteAuth) && global.AuroraCompanyInviteAccept && typeof global.AuroraCompanyInviteAccept.applyUnauthenticatedInviteHint === "function") {
        global.AuroraCompanyInviteAccept.applyUnauthenticatedInviteHint({
            titleEl: authTitle,
            descriptionEl: authDescription
        });
    }
}

const loginForm = overlay.querySelector("[data-cloud-login]");
const connected = overlay.querySelector("[data-cloud-connected]");
const result = overlay.querySelector("[data-cloud-result]");
const syncButton = overlay.querySelector("[data-cloud-sync]");
const listButton = overlay.querySelector("[data-cloud-list]");
const projectsSection = overlay.querySelector("[data-cloud-projects]");
const projectsList = overlay.querySelector("[data-cloud-project-list]");
const localProjectsSection = overlay.querySelector("[data-cloud-local-projects]");
const localProjectsList = overlay.querySelector("[data-cloud-local-project-list]");
function resetSyncButton() {
    syncButton.disabled = false;
    syncButton.removeAttribute("aria-busy");
}
async function openCloudPanel() {
    resetSyncButton();
    overlay.hidden = false;
    message("");
    const session = await refreshSession();
    if (session) {
        localProjectsSection.hidden = true;
        await refreshCloudProjects();
    }
    return session;
}
function message(text, state) { result.textContent = text; if (state) button.dataset.state = state; }

function isOfflineLicenseV1Enabled() {
    return Boolean(
        global.AuroraOfflineLicense &&
        global.AURORA_LICENSE_CONFIG &&
        global.AURORA_LICENSE_CONFIG.offline_license_v1 !== false
    );
}

function isBrowserOffline() {
    return typeof navigator !== "undefined" && navigator.onLine === false;
}

function isRetryableNetworkError(error) {
    if (!error) {
        return false;
    }

    const message = String(error.message || error || "").toLowerCase();
    const name = String(error.name || "").toLowerCase();
    const status = Number(error.status || error.statusCode || 0);

    if (status === 0) {
        return true;
    }

    if (name === "typeerror" && /failed to fetch|network|load failed|fetch/i.test(message)) {
        return true;
    }

    if (/networkerror|failed to fetch|fetch failed|timeout|timed out|dns|econnrefused|enetunreach|aborted|authretryablefetcherror|network request failed|temporarily unavailable|supabase indispon/i.test(message)) {
        return true;
    }

    if (error.__isAuthError && /retryable|fetch|network|timeout/i.test(message)) {
        return true;
    }

    return false;
}

function isAuthSessionMissingError(error) {
    if (!error) {
        return false;
    }

    const name = String(error.name || "").toLowerCase();
    const message = String(error.message || error || "").toLowerCase();
    return name.includes("authsessionmissing") || message.includes("auth session missing");
}

function hasElevatedClockSkew() {
    const ctx = global.AuroraClockDiagnostic ? global.AuroraClockDiagnostic.context() : null;
    const skew = ctx && ctx.clock_skew_ms != null ? Number(ctx.clock_skew_ms) : 0;
    const tolerance = global.AURORA_LICENSE_CONFIG && global.AURORA_LICENSE_CONFIG.clock_skew_tolerance_ms != null
        ? Number(global.AURORA_LICENSE_CONFIG.clock_skew_tolerance_ms)
        : 300000;
    return Number.isFinite(skew) && skew > tolerance;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldPreserveAuthGate(session, mode) {
    if (session) {
        return false;
    }

    if (authSessionRevoked) {
        return false;
    }

    if (!authReadyResolved || !lastAuthenticatedSession) {
        return false;
    }

    return mode === "online_no_session";
}

async function getUserWithTransientRetry(userId) {
    const maxAttempts = 2;
    let lastResult = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const verified = await client.auth.getUser();
            if (!verified.error) {
                return verified;
            }

            if (attempt < maxAttempts && isAuthSessionMissingError(verified.error) && hasElevatedClockSkew()) {
                clockDiag("auth_session_missing_retry", { attempt, phase: "get_user_error" }, userId);
                await delay(250);
                lastResult = verified;
                continue;
            }

            return verified;
        } catch (error) {
            if (attempt < maxAttempts && isAuthSessionMissingError(error) && hasElevatedClockSkew()) {
                clockDiag("auth_session_missing_retry", { attempt, phase: "get_user_throw" }, userId);
                await delay(250);
                lastResult = { data: { user: null }, error };
                continue;
            }

            throw error;
        }
    }

    return lastResult || { data: { user: null }, error: new Error("Auth session missing") };
}

function applySessionUi(session) {
    const hr = global.AuroraHomeReturnTrace;
    const runtimeCase = hr ? hr.runtimeCaseSnapshot() : null;
    const currentId =
        global.AuroraAccountStorage &&
        typeof global.AuroraAccountStorage.activeUserId === "function"
            ? global.AuroraAccountStorage.activeUserId()
            : "";
    const nextId = session && session.user ? String(session.user.id || "") : "";
    let activateResult = "NAO";
    let reloadRequested = "NAO";
    const forceInviteAuth = shouldForceInviteAuthGate();

    if (
        !entryOpeningActive &&
        session &&
        !forceInviteAuth &&
        global.AuroraAccountStorage &&
        global.AuroraAccountStorage.activate(session.user.id)
    ) {
        activateResult = "SIM";
        reloadRequested = "SIM";
        if (hr) {
            hr.logHR5({
                evento: "applySessionUi.activate",
                currentId: currentId,
                nextId: nextId,
                activateResult: activateResult,
                reloadRequested: reloadRequested,
                caseId: runtimeCase.id
            });
        }
        global.location.reload();
        return true;
    }

    loginForm.hidden = Boolean(session);
    connected.hidden = !session;
    button.dataset.account = session ? "connected" : "disconnected";
    global.AURORA_ACCOUNT_EMAIL = session && session.user ? (session.user.email || "") : "";
    global.AURORA_ACCOUNT_USER_ID = session && session.user ? (session.user.id || "") : "";
    global.dispatchEvent(new CustomEvent("aurora:account-session", {
        detail: { email: global.AURORA_ACCOUNT_EMAIL, signedIn: Boolean(session) }
    }));
    setAuthGate(session);

    if (session && !forceInviteAuth) {
        lastCounterUser = session.user;
        renderTrialCounter(session.user, lastAccessCheck && lastAccessCheck.access);
        releaseAuthenticatedApp(session);
    } else {
        const counter = document.querySelector("[data-aurora-trial-counter]");
        if (counter) counter.remove();
    }

    if (!session) {
        projectsSection.hidden = true;
        projectsList.innerHTML = "";
    }

    return false;
}

function finalizeSessionState(session, mode) {
    v78mark("SESSION_FINALIZE");
    if (mode) {
        global.AURORA_OFFLINE_LICENSE_STATE = mode;
    }

    if (session && session.user) {
        lastAuthenticatedSession = session;
    }

    if (shouldPreserveAuthGate(session, mode)) {
        clockDiag("transient_no_session_ignored", { refresh_mode: mode });
        clockDiag("auth_gate_preserved", { refresh_mode: mode });
        return lastAuthenticatedSession;
    }

    clockDiag("auth_gate_decision", {
        auth_gate_decision: session ? "hide_gate" : "show_gate",
        session_present: Boolean(session),
        refresh_mode: mode || null
    }, session && session.user ? session.user.id : undefined);

    clockDiag("final_startup_decision", {
        final_startup_decision: mode || (session ? "session_ready" : "no_session"),
        session_present: Boolean(session)
    }, session && session.user ? session.user.id : undefined);

    if (applySessionUi(session)) {
        return session;
    }

    return session;
}

async function refreshSessionLegacy() {
    const { data } = await client.auth.getSession();
    let session = data.session;
    if (session) {
        const verified = await client.auth.getUser();
        const sameUser = !verified.error && verified.data.user && verified.data.user.id === session.user.id;
        if (!sameUser) {
            await client.auth.signOut({ scope: "local" });
            if (global.AuroraAccountStorage) global.AuroraAccountStorage.suspend();
            session = null;
        } else {
            session.user = verified.data.user;
            if (isBlockedUser(session.user)) {
                await denyCurrentSession("Esta conta está bloqueada no Aurora Admin e não pode acessar a Aurora.");
                session = null;
                authResult.textContent = "Esta conta está bloqueada no Aurora Admin e não pode acessar a Aurora.";
            } else {
                const authorization = await verifyAccountAccess(session);
                lastAccessCheck = authorization;
                if (!authorization.allowed) {
                    await denyCurrentSession(authorization.message);
                    session = null;
                    authResult.textContent = authorization.message;
                }
            }
        }
    }
    return finalizeSessionState(session, session ? "legacy_online" : "legacy_signed_out");
}

async function refreshSessionOfflineSafe(presetSession) {
    try { global.AuroraBootDiagV78 && global.AuroraBootDiagV78.mark("OFFSAFE_ENTER", "preset="+Boolean(presetSession)+" online="+navigator.onLine); } catch (_) {}
    const { data } = await client.auth.getSession();
    let session = presetSession || (data && data.session ? data.session : null);
    try { global.AuroraBootDiagV78 && global.AuroraBootDiagV78.mark("OFFSAFE_GETSESSION", "session="+Boolean(session && session.user && session.user.id)); } catch (_) {}

    /* V74 — cold-start físico Android: se o Supabase não devolver a sessão
     * persistida a tempo, só recupera a identidade pelo perfil Aurora já ativo
     * quando o License Ticket desse MESMO usuário continua assinado e válido. */
    if (!session || !session.user || !session.user.id) {
        const activeUserId =
            global.AuroraAccountStorage &&
            typeof global.AuroraAccountStorage.activeUserId === "function"
                ? String(global.AuroraAccountStorage.activeUserId() || "").trim()
                : "";

        if (
            activeUserId &&
            global.AuroraOfflineLicense &&
            typeof global.AuroraOfflineLicense.evaluateStoredLicenseTicket === "function"
        ) {
            const offlineIdentity = await global.AuroraOfflineLicense.evaluateStoredLicenseTicket(activeUserId);
            if (
                offlineIdentity &&
                offlineIdentity.valid === true &&
                offlineIdentity.verification &&
                offlineIdentity.verification.claims &&
                String(offlineIdentity.verification.claims.sub || "") === activeUserId
            ) {
                session = {
                    user: { id: activeUserId, email: String(global.AURORA_ACCOUNT_EMAIL || "") },
                    __aurora_offline_ticket_identity: true
                };
                clockDiag("offline_identity_recovered_from_signed_ticket", {
                    user_id: activeUserId,
                    ticket_valid: true
                }, activeUserId);
            }
        }
    }

    if (!session || !session.user || !session.user.id) {
        return finalizeSessionState(null, "offline_no_session");
    }

    if (!global.AuroraOfflineLicense || typeof global.AuroraOfflineLicense.evaluateStoredLicenseTicket !== "function") {
        return finalizeSessionState(session, "offline_ticket_missing");
    }

    const evaluation = await global.AuroraOfflineLicense.evaluateStoredLicenseTicket(session.user.id);

    if (evaluation.valid) {
        return finalizeSessionState(session, "offline_ticket_valid");
    }

    global.AURORA_OFFLINE_LICENSE_STATE = "revalidation_required";
    return finalizeSessionState(session, evaluation.mode || "offline_ticket_expired");
}

async function refreshSessionOnline() {
    clockDiag("get_session_started");
    const { data, error: sessionError } = await client.auth.getSession();
    let session = data && data.session ? data.session : null;

    clockDiag("get_session_finished", {
        session_present: Boolean(session),
        get_session_error: sessionError
            ? String(sessionError.name || sessionError.message || "error")
            : null,
        session_expires_at: session && session.expires_at != null
            ? Number(session.expires_at)
            : null
    }, session && session.user ? session.user.id : undefined);

    if (!session) {
        return finalizeSessionState(null, "online_no_session");
    }

    let verified;

    try {
        clockDiag("get_user_started", null, session.user.id);
        verified = await getUserWithTransientRetry(session.user.id);
    } catch (error) {
        clockDiag("get_user_finished", {
            get_user_success: false,
            get_user_error: error && error.message ? String(error.message) : "error"
        }, session.user.id);

        if (isRetryableNetworkError(error)) {
            return refreshSessionOfflineSafe(session);
        }

        throw error;
    }

    clockDiag("get_user_finished", {
        get_user_success: !verified.error && Boolean(verified.data && verified.data.user),
        get_user_error: verified.error
            ? String(verified.error.name || verified.error.message || "error")
            : null
    }, session.user.id);

    if (verified.error) {
        if (isRetryableNetworkError(verified.error)) {
            return refreshSessionOfflineSafe(session);
        }

        if (isAuthSessionMissingError(verified.error) && hasElevatedClockSkew()) {
            return refreshSessionOfflineSafe(session);
        }

        await client.auth.signOut({ scope: "local" });
        if (global.AuroraAccountStorage) global.AuroraAccountStorage.suspend();
        return finalizeSessionState(null, "online_auth_invalid");
    }

    const sameUser = verified.data.user && verified.data.user.id === session.user.id;

    if (!sameUser) {
        await client.auth.signOut({ scope: "local" });
        if (global.AuroraAccountStorage) global.AuroraAccountStorage.suspend();
        return finalizeSessionState(null, "online_user_mismatch");
    }

    session.user = verified.data.user;

    if (isBlockedUser(session.user)) {
        await denyCurrentSession("Esta conta está bloqueada no Aurora Admin e não pode acessar a Aurora.");
        authResult.textContent = "Esta conta está bloqueada no Aurora Admin e não pode acessar a Aurora.";
        return finalizeSessionState(null, "blocked");
    }

    let authorization;

    try {
        clockDiag("account_access_started", null, session.user.id);
        authorization = await verifyAccountAccess(session);
        clockDiag("account_access_finished", {
            account_access_success: Boolean(authorization && authorization.allowed)
        }, session.user.id);
    } catch (error) {
        clockDiag("account_access_finished", {
            account_access_success: false,
            account_access_error: error && error.message ? String(error.message) : "error"
        }, session.user.id);

        if (isRetryableNetworkError(error)) {
            return refreshSessionOfflineSafe(session);
        }

        throw error;
    }

    lastAccessCheck = authorization;

    if (!authorization.allowed) {
        await denyCurrentSession(authorization.message);
        authResult.textContent = authorization.message;
        return finalizeSessionState(null, "blocked");
    }

    if (
        global.AuroraOfflineLicense &&
        typeof global.AuroraOfflineLicense.issueAndStoreLicenseTicket === "function"
    ) {
        try {
            clockDiag("license_ticket_issue_started", null, session.user.id);
            const issued = await global.AuroraOfflineLicense.issueAndStoreLicenseTicket(session.access_token);
            const verification = issued && issued.verification ? issued.verification : null;
            const claims = verification && verification.claims ? verification.claims : null;

            clockDiag("license_ticket_received", {
                license_ticket_received: Boolean(issued && issued.ticket),
                license_ticket_signature_valid: Boolean(verification && verification.valid)
            }, session.user.id);

            clockDiag("license_iat", {
                license_iat: verification && verification.meta && verification.meta.iat != null
                    ? Number(verification.meta.iat)
                    : (claims && claims.iat != null ? Number(claims.iat) : null)
            }, session.user.id);

            clockDiag("license_exp", {
                license_exp: verification && verification.meta && verification.meta.exp != null
                    ? Number(verification.meta.exp)
                    : (claims && claims.exp != null ? Number(claims.exp) : null)
            }, session.user.id);

            if (
                claims &&
                global.AuroraOfflineLicense &&
                typeof global.AuroraOfflineLicense.evaluateTemporalAccess === "function"
            ) {
                const temporal = global.AuroraOfflineLicense.evaluateTemporalAccess(session.user.id, claims);

                clockDiag("temporal_result", {
                    temporal_result: temporal && temporal.mode ? String(temporal.mode) : null,
                    temporal_ok: Boolean(temporal && temporal.ok),
                    clock_skew_ms: temporal && temporal.clock_skew_ms != null
                        ? Number(temporal.clock_skew_ms)
                        : null
                }, session.user.id);
            }
        } catch (error) {
            clockDiag("license_ticket_received", {
                license_ticket_received: false,
                license_ticket_error: error && error.message ? String(error.message) : "error"
            }, session.user.id);

            if (isRetryableNetworkError(error)) {
                return refreshSessionOfflineSafe(session);
            }

            const evaluation = await global.AuroraOfflineLicense.evaluateStoredLicenseTicket(session.user.id);

            if (evaluation.valid) {
                if (
                    global.AuroraOfflineLicense &&
                    evaluation.verification &&
                    evaluation.verification.claims &&
                    typeof global.AuroraOfflineLicense.refreshMonotonicAnchorFromVerifiedClaims === "function"
                ) {
                    global.AuroraOfflineLicense.refreshMonotonicAnchorFromVerifiedClaims(
                        evaluation.verification.claims
                    );
                } else if (
                    global.AuroraOfflineLicense &&
                    typeof global.AuroraOfflineLicense.refreshMonotonicAnchorFromOnlineValidation === "function" &&
                    evaluation.verification &&
                    evaluation.verification.claims
                ) {
                    global.AuroraOfflineLicense.refreshMonotonicAnchorFromOnlineValidation(
                        session.user.id,
                        evaluation.verification.claims
                    );
                }

                return finalizeSessionState(session, "online_validated_cached_ticket");
            }

            if (
                authorization &&
                authorization.allowed === true &&
                String(error && error.message ? error.message : "") ===
                    "Nenhum módulo autorizado disponível para emissão do License Ticket."
            ) {
                clockDiag("license_ticket_pending_modules", {
                    license_ticket_received: false,
                    refresh_mode: "online_validated_pending_modules"
                }, session.user.id);
                return finalizeSessionState(session, "online_validated_pending_modules");
            }

            throw error;
        }
    }

    return finalizeSessionState(session, "online_validated");
}

async function refreshSession() {
    v78mark("SESSION_START");
    if (inFlightRefreshPromise) {
        clockDiag("refresh_singleflight_join");
        return inFlightRefreshPromise;
    }

    clockDiag("refresh_singleflight_start");

    inFlightRefreshPromise = (async () => {
        try {
            if (!isOfflineLicenseV1Enabled()) {
                return await refreshSessionLegacy();
            }

            /* V76 — cold-start local-first.
             * navigator.onLine não é uma fonte confiável durante a inicialização de
             * uma PWA Android. Antes de decidir chamar a nuvem, tentamos a sessão
             * persistida + License Ticket assinado. Se o ticket local é válido,
             * ele já é autorização suficiente para o modo offline e não há motivo
             * para bloquear a Home aguardando uma requisição Supabase.
             *
             * A validação online continua ocorrendo nas retomadas/sincronizações
             * quando houver conectividade; aqui removemos apenas a rede do caminho
             * crítico do cold-start já licenciado. */
            const localData = await client.auth.getSession();
            const localSession =
                localData && localData.data && localData.data.session
                    ? localData.data.session
                    : null;

            let localUserId =
                localSession && localSession.user
                    ? String(localSession.user.id || "").trim()
                    : "";

            if (
                !localUserId &&
                global.AuroraAccountStorage &&
                typeof global.AuroraAccountStorage.activeUserId === "function"
            ) {
                localUserId = String(global.AuroraAccountStorage.activeUserId() || "").trim();
            }

            if (
                localUserId &&
                global.AuroraOfflineLicense &&
                typeof global.AuroraOfflineLicense.resolveColdStartTicketContext === "function"
            ) {
                /* V77 — usar a MESMA resolução canônica usada pelo bootstrap.
                 * evaluateStoredLicenseTicket() apenas dizia "válido"; ele NÃO
                 * publicava AURORA_OFFLINE_STARTUP_CTX com módulos/access.
                 * Assim AuthReady era liberado, mas o bootstrap podia voltar a
                 * consultar a nuvem para descobrir módulos antes de renderHome().
                 *
                 * resolveColdStartTicketContext() valida o mesmo JWT e, quando
                 * válido, publica AURORA_OFFLINE_STARTUP_CTX. Desse ponto em
                 * diante Home e Aurora AI pertencem ao mesmo cold-start local. */
                const localContext =
                    await global.AuroraOfflineLicense.resolveColdStartTicketContext(localUserId);

                if (
                    localContext &&
                    localContext.ok === true &&
                    localContext.mode === "cold_start_offline_ticket_valid" &&
                    localContext.verification &&
                    localContext.verification.valid === true &&
                    localContext.verification.claims &&
                    String(localContext.verification.claims.sub || "") === localUserId
                ) {
                    const startupSession =
                        localSession && localSession.user
                            ? localSession
                            : {
                                user: {
                                    id: localUserId,
                                    email: String(global.AURORA_ACCOUNT_EMAIL || "")
                                },
                                __aurora_offline_ticket_identity: true
                            };

                    clockDiag("cold_start_local_context_ready", {
                        user_id: localUserId,
                        modules_count: Array.isArray(localContext.modules)
                            ? localContext.modules.length
                            : 0,
                        navigator_online:
                            typeof navigator !== "undefined"
                                ? navigator.onLine
                                : null
                    }, localUserId);

                    return finalizeSessionState(startupSession, "offline_ticket_valid");
                }
            }

            if (isBrowserOffline()) {
                return await refreshSessionOfflineSafe(localSession);
            }

            try {
                return await refreshSessionOnline();
            } catch (error) {
                if (isRetryableNetworkError(error)) {
                    return await refreshSessionOfflineSafe(localSession);
                }

                if (isAuthSessionMissingError(error) && hasElevatedClockSkew()) {
                    return await refreshSessionOfflineSafe(localSession);
                }

                throw error;
            }
        } finally {
            clockDiag("refresh_singleflight_end");
            inFlightRefreshPromise = null;
        }
    })();

    return inFlightRefreshPromise;
}
function formatCloudDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function escapeCloud(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}
function localProjectTitle(data) {
    return projectPatch(data).title;
}
function localProjectSubtitle(data) {
    const service = normalizeObject(data.service);
    const customer = normalizeObject(data.customer);
    return service.title || service.id || customer.company_name || customer.company || data.profile_id || "Atendimento";
}
function renderLocalProjects() {
    const candidates = localCasesForSync();
    localProjectsSection.hidden = false;
    if (!candidates.length) {
        localProjectsList.innerHTML = '<div class="aurora-cloud-empty"><strong>Nenhum projeto disponível</strong><span>Crie e salve um atendimento antes de sincronizar.</span></div>';
        return;
    }
    localProjectsList.innerHTML = candidates.map((candidate, index) => {
        const data = candidate.data;
        const status = data.status || "Em andamento";
        const syncStatus = localSyncStatus(data);
        const syncLabel = syncStatus.synchronized ? "Já sincronizado" : "Sincronizar este projeto";
        const syncAttributes = syncStatus.synchronized
            ? 'disabled aria-disabled="true" data-cloud-sync-status="synced"'
            : `data-cloud-local-select="${index}" data-cloud-sync-status="pending"`;
        return `<article class="aurora-cloud-project-card aurora-cloud-local-card">
          <div class="aurora-cloud-project-card__title"><strong>${escapeCloud(localProjectTitle(data))}</strong><span>${escapeCloud(status)}</span></div>
          <small>${escapeCloud(localProjectSubtitle(data))} · ${formatCloudDate(candidate.saved_at)}</small>
          <code>${escapeCloud(data.id)}</code>
          <button type="button" ${syncAttributes}>${syncLabel}</button>
        </article>`;
    }).join("");
    localProjectsList.querySelectorAll("[data-cloud-local-select]").forEach((selectButton) => {
        selectButton.addEventListener("click", () => syncChosenLocalProject(candidates[Number(selectButton.dataset.cloudLocalSelect)], selectButton));
    });
}
function renderCloudProjects(projects) {
    if (!projects.length) {
        projectsList.innerHTML = '<div class="aurora-cloud-empty"><strong>Nenhum projeto salvo</strong><span>Sincronize um atendimento para ele aparecer aqui.</span></div>';
        return;
    }
    projectsList.innerHTML = projects.map((project) => {
        const downloadStatus = cloudDownloadStatus(project);
        const buttonAttributes = downloadStatus.downloaded
            ? 'disabled aria-disabled="true" data-cloud-download-status="downloaded"'
            : `data-cloud-download="${escapeCloud(project.id)}" data-cloud-download-status="pending"`;
        const buttonLabel = downloadStatus.downloaded ? "Nos atendimentos recentes" : "Baixar atendimento";
        return `<article class="aurora-cloud-project-card">
          <div class="aurora-cloud-project-card__title"><strong>${escapeCloud(project.title || "Projeto AURORA")}</strong><span>Versão ${Number(project.row_version || 1)}</span></div>
          <small>${escapeCloud(cloudServiceLabel(project.service_type, project.service_profile))} · ${formatCloudDate(project.updated_at)}</small>
          <button type="button" ${buttonAttributes}>${buttonLabel}</button>
        </article>`;
    }).join("");
    projectsList.querySelectorAll("[data-cloud-download]").forEach((downloadButton) => {
        downloadButton.addEventListener("click", () => restoreSelectedProject(downloadButton));
    });
}
function setDownloadButtonsBusy(isBusy, activeButton) {
    projectsList.querySelectorAll("[data-cloud-download]").forEach((button) => {
        if (!button.dataset.cloudOriginalLabel) button.dataset.cloudOriginalLabel = button.textContent;
        button.disabled = isBusy;
        button.textContent = isBusy && button === activeButton
            ? "Baixando…"
            : button.dataset.cloudOriginalLabel;
    });
}
async function refreshCloudProjects() {
    projectsSection.hidden = false;
    projectsList.innerHTML = '<div class="aurora-cloud-loading" aria-busy="true"><span></span><strong>Buscando projetos…</strong></div>';
    try {
        const projects = await withTimeout(
            (abortSignal) => listCloudProjects(abortSignal), SYNC_TIMEOUT_MS,
            "A consulta demorou além do limite. Verifique sua conexão e tente novamente."
        );
        renderCloudProjects(projects);
    } catch (error) {
        projectsList.innerHTML = `<div class="aurora-cloud-empty is-error"><strong>Não foi possível carregar</strong><span>${escapeCloud(error.message || error)}</span></div>`;
    }
}
async function restoreSelectedProject(downloadButton) {
    if (activeRestore) {
        message("Já existe um download em andamento. Aguarde a conclusão ou o limite de 15 segundos.", "pending");
        return;
    }
    if (!await global.AuroraDialog.confirm("Este atendimento será adicionado aos Atendimentos recentes. A cópia salva na nuvem será mantida.", { title: "Baixar atendimento?", confirmLabel: "Baixar" })) return;
    const operation = { id: Date.now(), cancelled: false };
    activeRestore = operation;
    setDownloadButtonsBusy(true, downloadButton);
    try {
        const restored = await withTimeout(
            (abortSignal) => downloadCloudProject(downloadButton.dataset.cloudDownload, abortSignal, operation), SYNC_TIMEOUT_MS,
            "O download demorou além do limite. Nada foi substituído."
        );
        assertActiveRestore(operation);
        message(`Atendimento ${restored.caseData.id} baixado com sucesso. Versão ${restored.project.row_version}. Fotos e PDFs continuam somente no aparelho original.`, "synced");
        overlay.hidden = true;
    } catch (error) {
        operation.cancelled = true;
        message(`Não foi possível baixar: ${error.message || error}`, "error");
    } finally {
        if (activeRestore === operation) activeRestore = null;
        setDownloadButtonsBusy(false);
    }
}
async function deleteCloudProject(projectId) {
    const session = await requireSession();
    const userId = session.user.id;
    const { data, error } = await client.rpc("aurora_owner_soft_delete_projects", { p_project_ids: [projectId] });
    if (error) throw error;
    if (!data || data.ok !== true || Number(data.deleted || 0) < 1) {
        throw new Error("O projeto não foi encontrado ou não pertence a esta conta.");
    }
}
async function deleteCloudCaseByLegacyId(caseId) {
    const cid = String(caseId || "").trim();
    if (!cid) return false;
    const session = await requireSession();
    const userId = session.user.id;
    const state = readState();
    const linked = state[cid] && state[cid].project_id ? String(state[cid].project_id) : "";
    let projectId = linked;
    if (!projectId) {
        const { data: row, error: lookupError } = await client.from("aurora_projects")
            .select("id,created_by")
            .eq("legacy_case_id", cid)
            .eq("created_by", userId)
            .is("deleted_at", null)
            .maybeSingle();
        if (lookupError) throw lookupError;
        projectId = row && row.id ? String(row.id) : "";
    }
    if (!projectId) return false;
    await deleteCloudProject(projectId);
    if (state[cid]) { delete state[cid]; writeState(state); }
    return true;
}
function removeLocalCaseByProjectId(projectId) {
    const pid = String(projectId || "").trim();
    if (!pid) return false;
    const state = readState();
    let removed = false;
    Object.keys(state).forEach((caseId) => {
        const entry = state[caseId];
        if (entry && String(entry.project_id || "") === pid) {
            delete state[caseId];
            removed = true;
        }
    });
    if (removed) writeState(state);
    return removed;
}
async function confirmDeleteWithPassword(options) {
    const aet = global.AuroraEletricaTupy;
    if (aet && typeof aet.confirmAccountPassword === "function") {
        return aet.confirmAccountPassword(options || {});
    }
    throw new Error("Confirmação por senha indisponível.");
}
async function deleteSelectedCloudProject(deleteButton) {
    if (activeDelete || activeRestore || activeSync) {
        message("Existe outra operação em andamento. Aguarde a conclusão.", "pending");
        return;
    }
    const projectTitle = deleteButton.dataset.cloudTitle || "Projeto AURORA";
    const projectId = String(deleteButton.dataset.cloudDelete || "").trim();
    if (!projectId) return;
    const passwordOk = await confirmDeleteWithPassword({
        title: "Excluir da nuvem?",
        message: `O atendimento “${projectTitle}” será removido permanentemente da nuvem e deste dispositivo.`
    });
    if (!passwordOk) return;
    activeDelete = { id: Date.now() };
    projectsList.querySelectorAll("button").forEach((item) => { item.disabled = true; });
    deleteButton.textContent = "Excluindo…";
    message(`Excluindo ${projectTitle} da nuvem…`, "pending");
    try {
        await withTimeout(
            () => deleteCloudProject(projectId), SYNC_TIMEOUT_MS,
            "A exclusão demorou além do limite. Atualize a lista para conferir o resultado."
        );
        const caseId = String(deleteButton.dataset.cloudCaseId || "");
        if (caseId) {
            const state = readState();
            if (state[caseId] && String(state[caseId].project_id || "") === projectId) {
                delete state[caseId];
                writeState(state);
            }
        } else {
            removeLocalCaseByProjectId(projectId);
        }
        message(`${projectTitle} foi excluído da nuvem e deste dispositivo.`, "synced");
        await refreshCloudProjects();
    } catch (error) {
        message(`Não foi possível excluir: ${error.message || error}`, "error");
        await refreshCloudProjects();
    } finally {
        activeDelete = null;
    }
}
button.addEventListener("click", openCloudPanel);
overlay.querySelector("[data-cloud-close]").addEventListener("click", () => { overlay.hidden = true; });
listButton.addEventListener("click", refreshCloudProjects);
overlay.querySelector("[data-cloud-refresh]").addEventListener("click", refreshCloudProjects);
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault(); message("Entrando…");
    const email = overlay.querySelector("#aurora-cloud-email").value.trim();
    const passwordInput = overlay.querySelector("#aurora-cloud-password");
    const password = passwordInput.value;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) { message(`Não foi possível entrar: ${error.message}`, "error"); return; }
    passwordInput.value = "";
    const authorization = await verifyAccountAccess(data.session);
    if (!authorization.allowed) {
        await denyCurrentSession(authorization.message);
        message(authorization.message, "error");
        return;
    }
    if (data.session && global.AuroraAccountStorage) global.AuroraAccountStorage.activate(data.session.user.id);
    global.location.reload();
});
authSwitch.addEventListener("click", () => setAuthMode(authMode === "login" ? "signup" : "login"));
authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (authSubmit.disabled) return;
    const email = authGate.querySelector("#aurora-auth-email").value.trim();
    const passwordInput = authGate.querySelector("#aurora-auth-password");
    const password = passwordInput.value;
    authSubmit.disabled = true;
    entryOpeningActive = true;
    authResult.textContent = authMode === "signup" ? "Criando cadastro…" : "Entrando…";
    try {
        if (authMode === "signup") {
            const fullName = authGate.querySelector("#aurora-auth-name").value.trim();
            const passwordConfirm = authGate.querySelector("#aurora-auth-password-confirm").value;
            if (fullName.length < 2) throw new Error("Informe seu nome completo.");
            if (password !== passwordConfirm) throw new Error("As senhas não são iguais.");
            await client.auth.signOut({ scope: "local" });
            if (global.AuroraAccountStorage) global.AuroraAccountStorage.suspend();
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName, name: fullName } }
            });
            if (error) throw error;
            passwordInput.value = "";
            authGate.querySelector("#aurora-auth-password-confirm").value = "";
            if (data.session) {
                if (!data.session.user || String(data.session.user.email || "").toLowerCase() !== email.toLowerCase()) {
                    await client.auth.signOut({ scope: "local" });
                    throw new Error("A sessão recebida não pertence ao novo cadastro.");
                }
                const verified = await client.auth.getUser();
                const verifiedUser = verified && verified.data && verified.data.user;
                if (verified.error || !verifiedUser ||
                    verifiedUser.id !== data.session.user.id ||
                    String(verifiedUser.email || "").toLowerCase() !== email.toLowerCase()) {
                    await client.auth.signOut({ scope: "local" });
                    throw new Error("Não foi possível confirmar a identidade do novo cadastro.");
                }
                await enterAuroraAfterAuthentication(data.session.user, true);
            } else {
                entryOpeningActive = false;
                setAuthMode("login");
                authGate.querySelector("#aurora-auth-email").value = email;
                authResult.textContent = "Cadastro criado. Confirme o e-mail recebido e depois entre na Aurora.";
            }
        } else {
            clockDiag("sign_in_started", { auth_mode: "login" });
            const { data, error } = await client.auth.signInWithPassword({ email, password });

            if (error) {
                clockDiag("sign_in_failed", {
                    sign_in_success: false,
                    sign_in_error: String(error.message || error.name || "error")
                });
                throw error;
            }

            clockDiag("sign_in_success", {
                sign_in_success: true,
                session_present: Boolean(data && data.session)
            }, data && data.session && data.session.user ? data.session.user.id : undefined);

            passwordInput.value = "";
            const authorization = await verifyAccountAccess(data.session);
            if (!authorization.allowed) {
                await denyCurrentSession(authorization.message);
                throw new Error(authorization.message);
            }
            await enterAuroraAfterAuthentication(data.session.user, false);
        }
    } catch (error) {
        entryOpeningActive = false;
        if (authMode === "login") {
            clockDiag("sign_in_failed", {
                sign_in_success: false,
                sign_in_error: String(error && error.message ? error.message : error)
            });
        }
        authResult.textContent = `Não foi possível continuar: ${error.message || error}`;
    } finally {
        authSubmit.disabled = false;
    }
});
syncButton.addEventListener("click", async () => {
    projectsSection.hidden = true;
    syncButton.disabled = true;
    syncButton.setAttribute("aria-busy", "true");
    try {
        /* R11.13 — o botão Nuvem é bidirecional para o proprietário:
           primeiro recebe uma versão mais nova moderada pelo ADMIN; só depois
           oferece envios locais. USER -> ADMIN permanece no fluxo canônico. */
        await hydrateOwnProjectsMissingLocally();
        renderLocalProjects();
        message("Nuvem atualizada. Escolha abaixo um projeto somente se houver algo local para enviar.", "synced");
    } catch (error) {
        console.warn("[R11.13] pull-before-sync unavailable", error);
        renderLocalProjects();
        message("Não foi possível verificar atualizações agora. Seus dados locais foram preservados.", "pending");
    } finally {
        syncButton.disabled = false;
        syncButton.removeAttribute("aria-busy");
    }
});
overlay.querySelector("[data-cloud-local-close]").addEventListener("click", () => { localProjectsSection.hidden = true; });
async function syncChosenLocalProject(candidate, selectedButton) {
    if (activeSync) return;
    if (!candidate || !candidate.data) return;
    const chosenTitle = localProjectTitle(candidate.data);
    if (!await global.AuroraDialog.confirm(`O atendimento “${chosenTitle}” será salvo na nuvem.`, { title: "Sincronizar atendimento?", confirmLabel: "Sincronizar" })) return;
    const operation = { id: Date.now() };
    activeSync = operation;
    syncButton.disabled = true;
    syncButton.setAttribute("aria-busy", "true");
    localProjectsList.querySelectorAll("[data-cloud-local-select]").forEach((item) => { item.disabled = true; });
    if (selectedButton) selectedButton.textContent = "Sincronizando…";
    message(`Sincronizando ${chosenTitle}…`, "pending");
    try {
        const info = await withTimeout(
            (abortSignal) => syncSelectedCase(clone(candidate.data), abortSignal),
            SYNC_TIMEOUT_MS,
            "A resposta demorou além do limite. A sincronização foi interrompida e o botão foi liberado; nenhuma nova tentativa foi iniciada."
        );
        if (info.unchanged) {
            message(`${info.case_title || info.case_id} já está sincronizado. Versão ${info.row_version}. Nenhuma nova revisão foi criada.`, "synced");
        } else {
            message(`${info.case_title || info.case_id} sincronizado com sucesso. Versão ${info.row_version}.`, "synced");
        }
        const evidenceHint = global.AuroraEvidenceCloudSync
            && typeof global.AuroraEvidenceCloudSync.summarizeForUi === "function"
            ? global.AuroraEvidenceCloudSync.summarizeForUi(info.evidence)
            : null;
        if (evidenceHint) {
            message(evidenceHint, "pending");
        }
        localProjectsSection.hidden = true;
        await refreshCloudProjects();
    } catch (error) {
        console.error(error);
        const detail = String((error && error.message) || error || "Erro desconhecido");
        if (/demorou além do limite|interrompida e o botão foi liberado/i.test(detail)) {
            try {
                const timeoutCaseId = candidate && candidate.data ? candidate.data.id : null;
                let timeoutProjectId = null;
                try {
                    const st = readState();
                    if (timeoutCaseId && st && st[timeoutCaseId]) {
                        timeoutProjectId = st[timeoutCaseId].project_id || null;
                    }
                } catch (_) { /* ignore */ }
                console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                    event: "timeout",
                    elapsed_ms: SYNC_TIMEOUT_MS,
                    stage: "syncSelectedCase_withTimeout",
                    case_id: timeoutCaseId,
                    project_id: timeoutProjectId,
                    message: detail
                });
            } catch (_) { /* ignore */ }
        }
        if (/AURORA_VERSION_CONFLICT|version[_ ]conflict|conflito/i.test(detail)) {
            message("Conflito de versão: existe uma versão mais recente na nuvem. Nada foi sobrescrito.", "error");
        } else {
            message(`Sincronização interrompida: ${detail}`, "error");
        }
    } finally {
        if (activeSync === operation) activeSync = null;
        resetSyncButton();
        localProjectsList.querySelectorAll("[data-cloud-local-select]").forEach((item) => { item.disabled = false; item.textContent = "Sincronizar este projeto"; });
    }
}
async function performAccountSignOut() {
    if (!await global.AuroraDialog.confirm("Os atendimentos locais serão preservados neste dispositivo.", { title: "Sair da conta?", confirmLabel: "Sair", tone: "danger" })) return;
    authSessionRevoked = true;
    lastAuthenticatedSession = null;
    try {
        if (global.AuroraModuleAccess) global.AuroraModuleAccess.clearActive();
        const { data } = await client.auth.getSession();
        const userId = data && data.session && data.session.user ? data.session.user.id : "";
        if (
            userId &&
            global.AuroraOfflineLicense &&
            typeof global.AuroraOfflineLicense.clearLicenseTicket === "function"
        ) {
            global.AuroraOfflineLicense.clearLicenseTicket(userId);
        }
        const result = await client.auth.signOut({ scope: "local" });
        if (result && result.error) throw result.error;
        if (global.AuroraAccountStorage) global.AuroraAccountStorage.suspend();
        if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.clear === "function") {
            global.AuroraCompanyAccess.clear();
        }
        global.AURORA_ACCOUNT_EMAIL = "";
        global.AURORA_ACCOUNT_USER_ID = "";
        activeModuleAccess = null;
        lastCounterUser = null;
        lastAccessCheck = null;
        overlay.hidden = true;
        projectsSection.hidden = true;
        projectsList.innerHTML = "";
        const counter = document.querySelector("[data-aurora-trial-counter]");
        if (counter) counter.remove();
        setAuthMode("login");
        authForm.reset();
        authResult.textContent = "Sessão encerrada. Entre com outra conta ou crie um novo cadastro.";
        setAuthGate(null);
        authGate.scrollTop = 0;
        global.dispatchEvent(new CustomEvent("aurora:account-session", {
            detail: { email: "", signedIn: false }
        }));
        window.setTimeout(() => authGate.querySelector("#aurora-auth-email").focus(), 60);
    } catch (error) {
        console.error(error);
        await global.AuroraDialog.alert("Não foi possível encerrar a sessão. Verifique sua conexão e tente novamente.", { title: "Falha ao sair", tone: "danger" });
    }
}
overlay.querySelector("[data-cloud-signout]").addEventListener("click", performAccountSignOut);
global.AuroraAccountSignOut = performAccountSignOut;
global.addEventListener("aurora:account-signout-request", performAccountSignOut);
client.auth.onAuthStateChange((event) => {
    clockDiag("auth_state_event", {
        auth_state_event: String(event || "unknown")
    });
    if (global.AuroraHomeReturnTrace) {
        const hr = global.AuroraHomeReturnTrace;
        const runtimeCase = hr.runtimeCaseSnapshot();
        hr.logHR5({
            evento: `onAuthStateChange:${String(event || "unknown")}`,
            currentId:
                global.AuroraAccountStorage &&
                typeof global.AuroraAccountStorage.activeUserId === "function"
                    ? global.AuroraAccountStorage.activeUserId()
                    : "",
            activateResult: "NAO",
            reloadRequested: "NAO",
            caseId: runtimeCase.id
        });
    }
    // A biblioteca de autenticação ainda pode estar mantendo seu bloqueio interno
    // durante este callback. Atualizar no próximo ciclo evita uma espera circular.
    setTimeout(() => {
        if (event === "TOKEN_REFRESHED") {
            clockDiag("token_refreshed_ignored", {
                auth_state_event: String(event || "unknown")
            });
            return;
        }

        if (event === "INITIAL_SESSION") {
            return;
        }

        if (event === "SIGNED_OUT") {
            authSessionRevoked = true;
            lastAuthenticatedSession = null;
            refreshSession().catch(console.error);
            return;
        }

        if (event === "SIGNED_IN") {
            if (isOfflineLicenseV1Enabled() && isBrowserOffline()) {
                refreshSessionOfflineSafe().catch(console.error);
                return;
            }

            refreshSession().catch((error) => {
                if (isOfflineLicenseV1Enabled() && isRetryableNetworkError(error)) {
                    refreshSessionOfflineSafe().catch(console.error);
                    return;
                }

                console.error(error);
            });
            return;
        }
    }, 0);
});

global.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
        return;
    }

    if (global.AuroraHomeReturnTrace) {
        const hr = global.AuroraHomeReturnTrace;
        const runtimeCase = hr.runtimeCaseSnapshot();
        hr.logHR5({
            evento: "visibilitychange.refresh",
            currentId:
                global.AuroraAccountStorage &&
                typeof global.AuroraAccountStorage.activeUserId === "function"
                    ? global.AuroraAccountStorage.activeUserId()
                    : "",
            activateResult: "NAO",
            reloadRequested: "NAO",
            caseId: runtimeCase.id
        });
    }

    const resume = () => {
        if (!isOfflineLicenseV1Enabled()) {
            return refreshSession()
                .then(() => refreshActiveModuleAccess())
                .then(() => syncPendingModuleServices());
        }

        if (isBrowserOffline()) {
            return refreshSessionOfflineSafe();
        }

        return refreshSession()
            .then(() => refreshActiveModuleAccess())
            .then(() => syncPendingModuleServices())
            .catch((error) => {
                if (isRetryableNetworkError(error)) {
                    return refreshSessionOfflineSafe();
                }

                console.error(error);
            });
    };

    resume().catch(console.error);
});

// Mantém o horário de atividade confiável para o indicador do Aurora Admin.
// A chamada também revalida bloqueios enquanto o aplicativo está em uso.
global.setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    try {
        const { data } = await client.auth.getSession();
        if (data && data.session) await verifyAccountAccess(data.session);
    } catch (error) {
        console.error("Não foi possível atualizar a atividade da conta.", error);
    }
}, 120000);

const settingsNav = document.querySelector(".aurora-settings-nav");
if (settingsNav) {
    const accountButton = document.createElement("button");
    accountButton.type = "button";
    accountButton.dataset.cloudAccountSettings = "";
    accountButton.innerHTML = '<span>☁</span><div><strong>Conta da nuvem</strong><small>Entrar, trocar ou desconectar</small></div><b>›</b>';
    accountButton.addEventListener("click", openCloudPanel);
    settingsNav.appendChild(accountButton);
}

clockDiag("startup_begin", global.AuroraClockDiagnostic
    ? global.AuroraClockDiagnostic.context()
    : {});

setAuthMode("login");
setAuthGate(null);
let startupInviteCycleDone = false;

refreshSession().then(async () => {
    /* V75 — a Home não pode ficar atrás de sincronizações cloud.
     * app_refresh.js e Aurora AI aparecem porque são shell estático carregado antes
     * do bootstrap. AuroraAuthReady, porém, só era liberado depois de
     * syncPendingModuleServices + syncStoredProfile + convite.
     *
     * Quando refreshSessionOfflineSafe já validou o License Ticket, liberamos
     * AuroraAuthReady imediatamente. O bootstrap então monta a Home com os dados
     * locais/ticket; sincronizações ficam para uma abertura online. */
    const offlineLicenseState = String(global.AURORA_OFFLINE_LICENSE_STATE || "");
    const authenticatedOffline = Boolean(
        lastAuthenticatedSession &&
        lastAuthenticatedSession.user &&
        lastAuthenticatedSession.user.id &&
        (
            offlineLicenseState === "offline_ticket_valid" ||
            offlineLicenseState === "online_validated_cached_ticket"
        )
    );

    try { global.AuroraBootDiagV78 && global.AuroraBootDiagV78.mark("STARTUP_OFFLINE_DECISION", "licenseState="+offlineLicenseState+" lastSession="+Boolean(lastAuthenticatedSession && lastAuthenticatedSession.user)+" authenticatedOffline="+authenticatedOffline); } catch (_) {}

    if (authenticatedOffline) {
        try { global.AuroraBootDiagV78 && global.AuroraBootDiagV78.mark("STARTUP_OFFLINE_RELEASE", "calling finalizeDeferredAuthReady"); } catch (_) {}
        finalizeDeferredAuthReady();
        return { aurora_offline_boot_released: true };
    }

    await syncPendingModuleServices();
    await syncStoredProfile();

    if (startupInviteCycleDone || shouldForceInviteAuthGate()) {
        return null;
    }
    const session = lastAuthenticatedSession;
    if (!session || !session.user || !session.user.id) {
        return null;
    }
    startupInviteCycleDone = true;
    if (global.AuroraCompanyInviteAccept && typeof global.AuroraCompanyInviteAccept.afterAuthenticatedSessionReady === "function") {
        return global.AuroraCompanyInviteAccept.afterAuthenticatedSessionReady(client);
    }
    return null;
}).then(() => {
    finalizeDeferredAuthReady();
    return null;
}).catch((error) => {
    clockDiag("final_startup_decision", {
        final_startup_decision: "startup_refresh_error",
        startup_error: error && error.message ? String(error.message) : "error"
    });
    if (isOfflineLicenseV1Enabled() && isRetryableNetworkError(error)) {
        refreshSessionOfflineSafe().catch(console.error);
        finalizeDeferredAuthReady();
        return;
    }

    console.error(error);
    authResult.textContent = "Não foi possível verificar a sessão. Confira sua conexão e tente novamente.";
    finalizeDeferredAuthReady();
});
/* R11.7 — LEI AURORA: ao fechar um relatório concluído, tentar sincronizar
 * automaticamente o atendimento do próprio usuário. O botão manual permanece. */
global.addEventListener("aurora:completed-report-closed", async () => {
    let shouldRefreshApp = true;
    try {
        const runtime = global.auroraRuntime;
        const current = runtime && typeof runtime.getCase === "function" ? runtime.getCase() : null;
        if (current && current.admin_review === true) {
            shouldRefreshApp = false;
            return;
        }

        /* R11.9/V34: se ainda houver case concluído pendente, sincroniza antes do
         * refresh. Algumas shapes (como Grounding) já sincronizam antes de abrir
         * a prévia e limpam este marcador; nesse caso o refresh continua sendo
         * necessário para reconstruir Atendimentos recentes sem F5 manual. */
        let candidate = global.__auroraCompletedCaseForAutoSync
            ? clone(global.__auroraCompletedCaseForAutoSync)
            : null;
        if (candidate && candidate.id) {
            candidate.status = "completed";
            await syncSelectedCase(candidate);
            global.__auroraCompletedCaseForAutoSync = null;
            global.dispatchEvent(new CustomEvent("aurora:auto-sync-complete", { detail: { case_id: candidate.id } }));
        }
    } catch (error) {
        console.warn("Aurora: sincronização automática após fechar relatório ficou pendente.", error);
        global.dispatchEvent(new CustomEvent("aurora:auto-sync-pending", { detail: { message: error && error.message ? error.message : String(error || "") } }));
    } finally {
        /* R24 — REFRESH SILENCIOSO PÓS-RELATÓRIO.
         * Preserva a lei de auto-sync criada na R11.7/V34, mas não reinicializa
         * toda a PWA. O reload era a origem do flash azul percebido ao fechar o
         * viewer. Após a tentativa de sync, avisa a camada de Home para recompor
         * somente os dados visíveis dentro da instância já montada. */
        if (shouldRefreshApp) {
            try {
                global.dispatchEvent(new CustomEvent("aurora:completed-report-refresh", {
                    detail: { source: "report_close_auto_sync" }
                }));
            } catch (_) {}
        }
    }
});


async function signOutForMembershipGate() {
    try { await client.auth.signOut({ scope: "local" }); } catch (_) {}
    try { if (global.AuroraAccountStorage) global.AuroraAccountStorage.suspend(); } catch (_) {}
    try { if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.clear === "function") global.AuroraCompanyAccess.clear(); } catch (_) {}
    global.AURORA_ACCOUNT_EMAIL = "";
    global.AURORA_ACCOUNT_USER_ID = "";
    try { location.reload(); } catch (_) {}
}

global.AuroraCloudSync = {
    client,
    syncMyProfile,
    updateProfessionalName,
    getCompanyIdentity,
    getCompanyServices,
    getCompanyServicesCached,
    refreshApplicationData,
    updateCompanyIdentity,
    updateCompanyCorporateIdentity,
    syncSelectedCase,
    queueCaseForSync,
    syncPendingCases,
    syncReport: syncSelectedCase,
    getSyncStatus: publicSyncStatus,
    listCloudProjects,
    downloadCloudProject,
    restoreCompanyProjectForAdmin,
    hydrateAuthorizedProjectEvidence,
    hydrateOwnProjectsMissingLocally,
    openCloudPanel,
    refreshSession,
    refreshSessionOnline,
    refreshSessionOfflineSafe,
    syncPendingModuleServices,
    isRetryableNetworkError,
    getCommercialNowMs,
    caseFromCloud,
    recordsFromCase,
    loadCompanyProjectForAdmin,
    saveAdminProjectRecords,
    saveAdminProjectState,
    dedupeEvidenceGroupRefs,
    evidenceRefsFromCloudCase,
    legacyOccurrencesFromEvidenceGroups,
    inferVehiclePhotoSlot,
    refreshCompanyAccessClaim,
    signOutForMembershipGate
    ,
    deleteCloudProject,
    deleteCloudCaseByLegacyId,
    removeLocalCaseByProjectId,
    confirmDeleteWithPassword
};

global.addEventListener("online", () => { syncPendingCases().catch((error) => console.warn("Aurora: tentativa automática pendente.", error)); });

})(window);

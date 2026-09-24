/**
 * Company / tenant access claims (Elétrica Tupy / Bolt).
 * Fonte de verdade = RPC aurora_my_company_access.
 * Default = negado até claim autenticada válida.
 */
(function (global) {
"use strict";

var EMPTY = Object.freeze({
    loaded: false,
    company_id: null,
    company_slug: null,
    company_name: null,
    role: null,
    status: null,
    entitlements: null,
    permissions: null,
    source: "absent"
});


var COMPANY_ACCESS_CACHE_PREFIX = "aurora_company_access_claim_v1:";
var COMPANY_PROJECTS_CACHE_PREFIX = "aurora_company_projects_cache_v1:";

function companyProjectsCacheKey(userId) {
    var uid = String(userId || "").trim();
    return uid ? COMPANY_PROJECTS_CACHE_PREFIX + uid : "";
}

function readCachedCompanyProjects(userId) {
    var key = companyProjectsCacheKey(userId);
    if (!key) return null;
    try {
        var raw = localStorage.getItem(key);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && Array.isArray(parsed.rows) ? parsed.rows : null;
    } catch (_) { return null; }
}

function writeCachedCompanyProjects(userId, rows) {
    var key = companyProjectsCacheKey(userId);
    if (!key || !Array.isArray(rows)) return;
    try {
        localStorage.setItem(key, JSON.stringify({ saved_at: new Date().toISOString(), rows: rows }));
    } catch (_) { /* cache auxiliar; nunca bloqueia o app */ }
}

function companyAccessCacheKey(userId) {
    var uid = String(userId || "").trim();
    return uid ? COMPANY_ACCESS_CACHE_PREFIX + uid : "";
}

function readCachedCompanyAccess(userId) {
    var key = companyAccessCacheKey(userId);
    if (!key) return null;
    try {
        var raw = localStorage.getItem(key);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.claim || typeof parsed.claim !== "object") return null;
        return parsed.claim;
    } catch (_) { return null; }
}

function writeCachedCompanyAccess(userId, claim) {
    var key = companyAccessCacheKey(userId);
    if (!key || !claim || claim.loaded !== true || !claim.company_id) return;
    try {
        localStorage.setItem(key, JSON.stringify({ saved_at: new Date().toISOString(), claim: claim }));
    } catch (_) { /* cache auxiliar; nunca bloqueia o app */ }
}

function restoreCachedCompanyAccess(userId) {
    var cached = readCachedCompanyAccess(userId);
    if (!cached) return null;
    var restored = applyClaim(cached);
    restored.source = "offline_cache";
    global.AURORA_COMPANY_ACCESS = restored;
    return restored;
}

function clearCompanyAccess() {
    global.AURORA_COMPANY_ACCESS = Object.assign({}, EMPTY);
    global.AURORA_ACCOUNT_ENTITLEMENTS = null;
    return global.AURORA_COMPANY_ACCESS;
}

function applyClaim(raw) {
    var data = raw && typeof raw === "object" ? raw : {};
    var claim = {
        loaded: data.loaded === true || data.loaded === "true" || Boolean(data.company_id) || data.role != null,
        company_id: data.company_id || null,
        company_slug: data.company_slug || null,
        company_name: data.company_name || null,
        role: data.role || null,
        status: data.status || null,
        entitlements: data.entitlements && typeof data.entitlements === "object" ? data.entitlements : {},
        permissions: data.permissions && typeof data.permissions === "object" ? data.permissions : {},
        source: "rpc"
    };
    if (data.loaded === true && !data.company_id && !data.role) {
        claim.loaded = true;
        claim.source = "rpc_empty";
    }
    global.AURORA_COMPANY_ACCESS = claim;
    if (claim.loaded) {
        global.AURORA_ACCOUNT_ENTITLEMENTS = Object.assign({}, claim.entitlements, {
            company_id: claim.company_id,
            company_role: claim.role,
            company_slug: claim.company_slug,
            company_status: claim.status,
            permissions: claim.permissions
        });
    }
    return claim;
}

/**
 * company_id efetivo: só do claim autenticado. Nunca de input do usuário.
 */
function resolvedCompanyId() {
    var access = global.AURORA_COMPANY_ACCESS;
    if (!access || !access.loaded || !access.company_id) return null;
    if (String(access.status || "").toLowerCase() !== "active") return null;
    return String(access.company_id);
}

function canViewCompanyCases() {
    var access = global.AURORA_COMPANY_ACCESS;
    if (!access || !access.loaded) return false;
    if (String(access.status || "").toLowerCase() !== "active") return false;
    return Boolean(access.permissions && access.permissions.view_company_cases);
}

function normalizeRole(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function hasEletricaTupyEntitlement(access) {
    var ent = (access && access.entitlements) || {};
    if (ent.eletrica_tupy === true) return true;
    if (ent.modules && Array.isArray(ent.modules) && ent.modules.indexOf("eletrica_tupy") !== -1) {
        return true;
    }
    return false;
}

/**
 * Gate UX de Gestão Elétrica Tupy (ADMIN_BOLT).
 * Default negado. Sem e-mail hardcoded. Sem liberar se claim falhar.
 *
 * Exige claim RPC:
 * - loaded
 * - company_id
 * - company_slug = bolt
 * - status = active (membership ativa)
 * - role = ADMIN_BOLT
 * - entitlements.eletrica_tupy = true
 */
/**
 * Projeto de outro membro da mesma empresa (created_by !== auth.uid()).
 * Fase 1: somente leitura para ADMIN_BOLT — não tratar como owner local.
 */
function isCompanyPeerProject(row, userId) {
    if (!row || !userId) return false;
    var createdBy = row.created_by != null ? String(row.created_by) : "";
    if (!createdBy) return false;
    return createdBy !== String(userId);
}

async function getAuthUserId(client) {
    if (!client || !client.auth || typeof client.auth.getSession !== "function") {
        return null;
    }
    try {
        var result = await client.auth.getSession();
        var session = result && result.data ? result.data.session : null;
        return session && session.user && session.user.id
            ? String(session.user.id)
            : null;
    } catch (error) {
        return null;
    }
}

function canManageEletricaTupy() {
    var access = global.AURORA_COMPANY_ACCESS;
    if (!access || access.loaded !== true) return false;
    if (!access.company_id) return false;
    if (String(access.company_slug || "").toLowerCase() !== "bolt") return false;
    if (String(access.status || "").toLowerCase() !== "active") return false;
    var role = normalizeRole(access.role);
    if (role !== "ADMIN_BOLT" && role !== "COMPANY_ADMIN") return false;
    if (!hasEletricaTupyEntitlement(access)) return false;
    return true;
}

/**
 * Gate Minha Equipe / convites (Fase 2D).
 * Exige membership active + permissions.manage_users do claim RPC.
 */
function canManageUsers() {
    var access = global.AURORA_COMPANY_ACCESS;
    if (!access || access.loaded !== true) return false;
    if (!access.company_id) return false;
    if (String(access.status || "").toLowerCase() !== "active") return false;

    /* R10.2 — Minha Equipe é recurso da empresa, não da shape.
       COMPANY_ADMIN pode gerenciar a própria equipe em Oficina e demais shapes.
       ADMIN_BOLT preserva exatamente o gate histórico por manage_users. */
    var role = normalizeRole(access.role);
    if (role === "COMPANY_ADMIN") return true;
    if (role === "ADMIN_BOLT") {
        return Boolean(access.permissions && access.permissions.manage_users === true);
    }
    return Boolean(access.permissions && access.permissions.manage_users === true);
}

var DEFAULT_INVITE_APP_BASE =
    "https://aurora-bolt-tupy.maiconcosta-bolt.workers.dev/app.html";

/**
 * Monta URL de convite (?invite=RAW_TOKEN). Centralizado — não espalhar concatenação.
 */
function buildCompanyInviteUrl(rawToken) {
    if (rawToken == null || rawToken === "") return "";
    var configured = global.AURORA_INVITE_APP_BASE;
    var base = configured
        ? String(configured).replace(/\?.*$/, "").replace(/\/+$/, "")
        : DEFAULT_INVITE_APP_BASE;
    if (!configured && global.location && global.location.origin) {
        base = String(global.location.origin).replace(/\/+$/, "") + "/app.html";
    }
    return base + "?invite=" + encodeURIComponent(String(rawToken));
}

function assertManageUsersGate() {
    if (!canManageUsers()) {
        var denied = new Error("AURORA_TEAM_FORBIDDEN");
        denied.code = "AURORA_TEAM_FORBIDDEN";
        throw denied;
    }
}

function normalizeRpcRows(data) {
    if (Array.isArray(data)) return data;
    if (data == null) return [];
    return [data];
}

function normalizeRpcObject(data) {
    if (data == null) return null;
    if (Array.isArray(data)) return data[0] || null;
    if (typeof data === "string") {
        try { return JSON.parse(data); } catch (e) { return null; }
    }
    return typeof data === "object" ? data : null;
}

async function listCompanyMembers(client) {
    assertManageUsersGate();
    if (!client || typeof client.rpc !== "function") {
        var cfg = new Error("AURORA_BACKEND_UNAVAILABLE");
        cfg.code = "AURORA_BACKEND_UNAVAILABLE";
        throw cfg;
    }
    var result = await client.rpc("aurora_company_list_members");
    if (result.error) {
        var rpcErr = new Error(result.error.message || "AURORA_TEAM_LIST_MEMBERS_FAILED");
        rpcErr.code = result.error.code || "AURORA_TEAM_LIST_MEMBERS_FAILED";
        rpcErr.details = result.error;
        throw rpcErr;
    }
    return normalizeRpcRows(result.data);
}

async function listCompanyInvites(client) {
    assertManageUsersGate();
    if (!client || typeof client.rpc !== "function") {
        var cfg = new Error("AURORA_BACKEND_UNAVAILABLE");
        cfg.code = "AURORA_BACKEND_UNAVAILABLE";
        throw cfg;
    }
    var result = await client.rpc("aurora_company_list_invites");
    if (result.error) {
        var rpcErr = new Error(result.error.message || "AURORA_TEAM_LIST_INVITES_FAILED");
        rpcErr.code = result.error.code || "AURORA_TEAM_LIST_INVITES_FAILED";
        rpcErr.details = result.error;
        throw rpcErr;
    }
    return normalizeRpcRows(result.data);
}

/**
 * Cria convite USER_BOLT (role fixa server-side). Retorno inclui raw_token somente aqui.
 * expiresHours omitido → default LIVE 48h.
 */
async function createCompanyInvite(client, expiresHours) {
    assertManageUsersGate();
    if (!client || typeof client.rpc !== "function") {
        var cfg = new Error("AURORA_BACKEND_UNAVAILABLE");
        cfg.code = "AURORA_BACKEND_UNAVAILABLE";
        throw cfg;
    }
    var rpcArgs = expiresHours == null ? undefined : { p_expires_hours: expiresHours };
    var result = rpcArgs == null
        ? await client.rpc("aurora_company_create_invite")
        : await client.rpc("aurora_company_create_invite", rpcArgs);
    if (result.error) {
        var rpcErr = new Error(result.error.message || "AURORA_TEAM_CREATE_INVITE_FAILED");
        rpcErr.code = result.error.code || "AURORA_TEAM_CREATE_INVITE_FAILED";
        rpcErr.details = result.error;
        throw rpcErr;
    }
    var payload = normalizeRpcObject(result.data);
    if (!payload || !payload.raw_token) {
        var invalid = new Error("AURORA_TEAM_CREATE_INVITE_INVALID_RESPONSE");
        invalid.code = "AURORA_TEAM_CREATE_INVITE_INVALID_RESPONSE";
        throw invalid;
    }
    return payload;
}

function extractInviteRpcErrorCode(errorPayload, fallbackMessage) {
    var message = String(fallbackMessage || "");
    if (errorPayload && errorPayload.code && /^[A-Z0-9_]+$/.test(String(errorPayload.code))) {
        return String(errorPayload.code);
    }
    var known = [
        "AUTH_REQUIRED",
        "INVITE_NOT_FOUND",
        "INVITE_REVOKED",
        "INVITE_ALREADY_USED",
        "INVITE_NOT_PENDING",
        "INVITE_EXPIRED",
        "INVITE_TOKEN_INVALID",
        "ACTIVE_COMPANY_CONFLICT",
        "COMPANY_INACTIVE",
        "AURORA_ADMIN_ACCOUNT_FORBIDDEN",
        "CLIENT_PROFILE_REQUIRED"
    ];
    for (var i = 0; i < known.length; i += 1) {
        if (message.indexOf(known[i]) !== -1) {
            return known[i];
        }
    }
    return "AURORA_ACCEPT_INVITE_FAILED";
}

/**
 * Aceita convite por token raw. Somente p_token — sem company_id/role/user_id.
 */
async function acceptCompanyInvite(client, rawToken) {
    if (!isValidInviteTokenClient(rawToken)) {
        var invalid = new Error("INVITE_TOKEN_INVALID");
        invalid.code = "INVITE_TOKEN_INVALID";
        throw invalid;
    }
    if (!client || typeof client.rpc !== "function") {
        var cfg = new Error("AURORA_BACKEND_UNAVAILABLE");
        cfg.code = "AURORA_BACKEND_UNAVAILABLE";
        throw cfg;
    }
    var result = await client.rpc("aurora_company_accept_invite", {
        p_token: String(rawToken).trim()
    });
    if (result.error) {
        var rpcErr = new Error(result.error.message || "AURORA_ACCEPT_INVITE_FAILED");
        rpcErr.code = extractInviteRpcErrorCode(result.error, result.error.message);
        rpcErr.details = result.error;
        throw rpcErr;
    }
    return normalizeRpcObject(result.data);
}

function isValidInviteTokenClient(rawToken) {
    if (rawToken == null) return false;
    var value = String(rawToken).trim();
    if (value.length < 16 || value.length > 128) return false;
    return /^[A-Za-z0-9_-]+$/.test(value);
}

async function revokeCompanyInvite(client, inviteId) {
    assertManageUsersGate();
    if (!inviteId) {
        var missing = new Error("AURORA_TEAM_REVOKE_INVITE_ID_REQUIRED");
        missing.code = "AURORA_TEAM_REVOKE_INVITE_ID_REQUIRED";
        throw missing;
    }
    if (!client || typeof client.rpc !== "function") {
        var cfg = new Error("AURORA_BACKEND_UNAVAILABLE");
        cfg.code = "AURORA_BACKEND_UNAVAILABLE";
        throw cfg;
    }
    var result = await client.rpc("aurora_company_revoke_invite", {
        p_invite_id: inviteId
    });
    if (result.error) {
        var rpcErr = new Error(result.error.message || "AURORA_TEAM_REVOKE_INVITE_FAILED");
        rpcErr.code = result.error.code || "AURORA_TEAM_REVOKE_INVITE_FAILED";
        rpcErr.details = result.error;
        throw rpcErr;
    }
    return normalizeRpcObject(result.data);
}

function claimSummarySafe() {
    var access = global.AURORA_COMPANY_ACCESS || EMPTY;
    return {
        company_slug: access.company_slug || null,
        company_role: access.role || null,
        company_status: access.status || null,
        membership_status: access.status || null,
        eletrica_tupy: hasEletricaTupyEntitlement(access),
        canManageEletricaTupy: canManageEletricaTupy(),
        loaded: access.loaded === true,
        source: access.source || null
    };
}

async function refreshCompanyAccess(client) {
    var authUserId = await getAuthUserId(client);
    if (!client || typeof client.rpc !== "function") {
        return restoreCachedCompanyAccess(authUserId) || clearCompanyAccess();
    }
    try {
        var result = await client.rpc("aurora_my_company_access");
        if (result.error) {
            var cachedOnRpcFailure = restoreCachedCompanyAccess(authUserId);
            if (cachedOnRpcFailure) return cachedOnRpcFailure;
            clearCompanyAccess();
            global.AURORA_COMPANY_ACCESS.source = "rpc_missing";
            return global.AURORA_COMPANY_ACCESS;
        }
        var payload = result.data;
        if (Array.isArray(payload)) payload = payload[0];
        if (typeof payload === "string") {
            try { payload = JSON.parse(payload); } catch (e) { payload = null; }
        }

        /* V143 — aurora_my_company_access considera somente membership ativa.
         * Quando o ADMIN bloqueia um convidado, precisamos preservar a identidade
         * empresarial e o status blocked para não confundir a conta com primeiro acesso. */
        if (!payload || !payload.company_id) {
            var stateResult = await client.rpc("aurora_my_company_membership_state");
            if (!stateResult.error) {
                var statePayload = stateResult.data;
                if (Array.isArray(statePayload)) statePayload = statePayload[0];
                if (typeof statePayload === "string") {
                    try { statePayload = JSON.parse(statePayload); } catch (e2) { statePayload = null; }
                }
                if (statePayload && statePayload.company_id) payload = statePayload;
            }
        }
        var applied = applyClaim(payload || { loaded: true });
        writeCachedCompanyAccess(authUserId, applied);
        return applied;
    } catch (error) {
        var cachedOnError = restoreCachedCompanyAccess(authUserId);
        if (cachedOnError) return cachedOnError;
        clearCompanyAccess();
        global.AURORA_COMPANY_ACCESS.source = "rpc_error";
        return global.AURORA_COMPANY_ACCESS;
    }
}

/**
 * Lista empresarial Phase B — ADMIN_BOLT only (RPC).
 * Sem company_id / user_id / e-mail / service_role.
 * Fail closed se gate false ou RPC falhar (não mascara erro como []).
 */
async function listMyCompanyProjects(client) {
    if (!canManageEletricaTupy()) {
        var denied = new Error("AURORA_GESTAO_FORBIDDEN");
        denied.code = "AURORA_GESTAO_FORBIDDEN";
        throw denied;
    }
    var authUserId = await getAuthUserId(client);
    if (!client || typeof client.rpc !== "function" || (typeof navigator !== "undefined" && navigator.onLine === false)) {
        var cachedOffline = readCachedCompanyProjects(authUserId || global.AURORA_ACCOUNT_USER_ID);
        if (cachedOffline) return cachedOffline;
        var cfg = new Error("AURORA_BACKEND_UNAVAILABLE");
        cfg.code = "AURORA_BACKEND_UNAVAILABLE";
        throw cfg;
    }
    var result = await client.rpc("aurora_list_my_company_projects");
    if (result.error) {
        var cachedOnError = readCachedCompanyProjects(authUserId || global.AURORA_ACCOUNT_USER_ID);
        if (cachedOnError) return cachedOnError;
        var rpcErr = new Error(result.error.message || "AURORA_COMPANY_LIST_FAILED");
        rpcErr.code = result.error.code || "AURORA_COMPANY_LIST_FAILED";
        rpcErr.details = result.error;
        throw rpcErr;
    }
    if (!Array.isArray(result.data)) {
        return [];
    }
    writeCachedCompanyProjects(authUserId || global.AURORA_ACCOUNT_USER_ID, result.data);
    return result.data;
}

async function listMyCompanyProjectSummaries(client) {
    if (!canManageUsers()) {
        var denied = new Error("AURORA_GESTAO_FORBIDDEN");
        denied.code = "AURORA_GESTAO_FORBIDDEN";
        throw denied;
    }
    if (!client || typeof client.rpc !== "function") {
        var cfg = new Error("AURORA_BACKEND_UNAVAILABLE");
        cfg.code = "AURORA_BACKEND_UNAVAILABLE";
        throw cfg;
    }
    var result = await client.rpc("aurora_list_my_company_project_summaries");
    if (result.error) {
        var rpcErr = new Error(result.error.message || "AURORA_COMPANY_LIST_FAILED");
        rpcErr.code = result.error.code || "AURORA_COMPANY_LIST_FAILED";
        rpcErr.details = result.error;
        throw rpcErr;
    }
    var rows = Array.isArray(result.data) ? result.data : [];
    var hiddenResult = await client.rpc("aurora_company_list_hidden_projects");
    if (hiddenResult.error) {
        var detail = String(hiddenResult.error.message || hiddenResult.error || "");
        if (/aurora_company_list_hidden_projects|function .* does not exist|PGRST202/i.test(detail)) return rows;
        throw hiddenResult.error;
    }
    var hidden = new Set((Array.isArray(hiddenResult.data) ? hiddenResult.data : []).map(function (item) {
        return String(item.project_id || "");
    }));
    return rows.filter(function (row) { return !hidden.has(String(row.id || "")); });
}

async function removeCompanyMembers(client, userIds) {
    if (!canManageUsers()) {
        var denied = new Error("AURORA_TEAM_FORBIDDEN");
        denied.code = "AURORA_TEAM_FORBIDDEN";
        throw denied;
    }
    var ids = Array.isArray(userIds) ? userIds.map(String).filter(Boolean) : [];
    if (!ids.length) {
        var empty = new Error("AURORA_TEAM_MEMBER_ID_REQUIRED");
        empty.code = "AURORA_TEAM_MEMBER_ID_REQUIRED";
        throw empty;
    }
    if (!client || typeof client.rpc !== "function") {
        var cfg = new Error("AURORA_BACKEND_UNAVAILABLE");
        cfg.code = "AURORA_BACKEND_UNAVAILABLE";
        throw cfg;
    }
    var result = await client.rpc("aurora_company_remove_members", { p_user_ids: ids });
    if (result.error) {
        var rpcErr = new Error(result.error.message || "AURORA_TEAM_REMOVE_FAILED");
        rpcErr.code = result.error.code || "AURORA_TEAM_REMOVE_FAILED";
        throw rpcErr;
    }
    return result.data || { ok: true, removed: ids.length };
}

clearCompanyAccess();

global.AuroraCompanyAccess = {
    refresh: refreshCompanyAccess,
    clear: clearCompanyAccess,
    resolvedCompanyId: resolvedCompanyId,
    canViewCompanyCases: canViewCompanyCases,
    canManageEletricaTupy: canManageEletricaTupy,
    canManageUsers: canManageUsers,
    buildCompanyInviteUrl: buildCompanyInviteUrl,
    claimSummarySafe: claimSummarySafe,
    listMyCompanyProjects: listMyCompanyProjects,
    listMyCompanyProjectSummaries: listMyCompanyProjectSummaries,
    listCompanyMembers: listCompanyMembers,
    listCompanyInvites: listCompanyInvites,
    createCompanyInvite: createCompanyInvite,
    acceptCompanyInvite: acceptCompanyInvite,
    revokeCompanyInvite: revokeCompanyInvite,
    removeCompanyMembers: removeCompanyMembers,
    isCompanyPeerProject: isCompanyPeerProject,
    getAuthUserId: getAuthUserId,
    get: function () { return global.AURORA_COMPANY_ACCESS || EMPTY; }
};

})(window);

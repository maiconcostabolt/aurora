/**
 * Fase 2E — aceite de convite por link (?invite=RAW_TOKEN).
 * Token raw: somente sessionStorage até sucesso ou erro terminal.
 * Autoridade de membership/role/módulo = RPC aurora_company_accept_invite.
 */
(function (global) {
"use strict";

var PENDING_KEY = "aurora_pending_company_invite_v1";
var TERMINAL_KEY = "aurora_pending_company_invite_terminal_v1";
var INVITE_AUTH_COMPLETED_KEY = "aurora_invite_auth_completed_v1";

var INVITE_AUTH_TITLE = "Convite para equipe Aurora";
var INVITE_AUTH_DESCRIPTION =
    "Você recebeu um convite para entrar em uma equipe da Aurora. " +
    "Entre na sua conta ou crie uma conta para continuar.";

var SUCCESS_MESSAGE =
    "Convite aceito.\nVocê agora faz parte da equipe.";

var ERROR_MESSAGES = Object.freeze({
    INVITE_NOT_FOUND: "Este convite não foi encontrado ou não é válido.",
    INVITE_REVOKED: "Este convite foi revogado e não pode mais ser usado.",
    INVITE_ALREADY_USED: "Este convite já foi utilizado.",
    INVITE_NOT_PENDING: "Este convite não está mais disponível.",
    INVITE_EXPIRED: "Este convite expirou.",
    INVITE_TOKEN_INVALID: "O link do convite não é válido.",
    ACTIVE_COMPANY_CONFLICT:
        "Sua conta já pertence a outra equipe ativa. " +
        "Para aceitar este convite, saia da equipe atual ou use outra conta.",
    COMPANY_INACTIVE: "A empresa deste convite não está ativa no momento.",
    AURORA_ADMIN_ACCOUNT_FORBIDDEN:
        "Contas administrativas da Aurora não podem aceitar convites de equipe.",
    CLIENT_PROFILE_REQUIRED:
        "Este convite exige um perfil de cliente. Entre com a conta correta.",
    AUTH_REQUIRED: "Entre na sua conta para aceitar o convite.",
    AURORA_BACKEND_UNAVAILABLE:
        "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."
});

var TERMINAL_CODES = Object.freeze([
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
]);

var inFlight = false;
var inFlightToken = "";
var completedTokens = Object.create(null);

function sessionStore() {
    try {
        return global.sessionStorage;
    } catch (error) {
        return null;
    }
}

function isValidTokenFormat(token) {
    if (token == null) return false;
    var value = String(token).trim();
    if (value.length < 16 || value.length > 128) return false;
    return /^[A-Za-z0-9_-]+$/.test(value);
}

function captureInviteFromUrl() {
    var store = sessionStore();
    if (!store) return false;

    try {
        var params = new URLSearchParams(global.location.search);
        var token = params.get("invite");
        if (!token) return false;
        token = String(token).trim();
        if (!isValidTokenFormat(token)) return false;

        store.setItem(PENDING_KEY, token);
        store.removeItem(TERMINAL_KEY);
        store.removeItem(INVITE_AUTH_COMPLETED_KEY);

        params.delete("invite");
        var qs = params.toString();
        var nextUrl =
            global.location.pathname +
            (qs ? "?" + qs : "") +
            (global.location.hash || "");
        global.history.replaceState(null, "", nextUrl);
        return true;
    } catch (error) {
        return false;
    }
}

function readPendingToken() {
    var store = sessionStore();
    if (!store) return "";
    try {
        var token = store.getItem(PENDING_KEY) || "";
        return isValidTokenFormat(token) ? String(token).trim() : "";
    } catch (error) {
        return "";
    }
}

function clearPendingToken() {
    var store = sessionStore();
    if (!store) return;
    try {
        store.removeItem(PENDING_KEY);
    } catch (error) {
        /* ignore */
    }
}

function hasPendingInvite() {
    return Boolean(readPendingToken());
}

function isInviteAuthCompleted() {
    var store = sessionStore();
    if (!store) {
        return false;
    }
    try {
        return store.getItem(INVITE_AUTH_COMPLETED_KEY) === "1";
    } catch (error) {
        return false;
    }
}

function markInviteAuthCompleted() {
    if (!hasPendingInvite()) {
        return false;
    }
    var store = sessionStore();
    if (!store) {
        return false;
    }
    try {
        store.setItem(INVITE_AUTH_COMPLETED_KEY, "1");
        return true;
    } catch (error) {
        return false;
    }
}

function clearInviteAuthCompleted() {
    var store = sessionStore();
    if (!store) {
        return;
    }
    try {
        store.removeItem(INVITE_AUTH_COMPLETED_KEY);
    } catch (error) {
        /* ignore */
    }
}

/**
 * Convite pendente exige login/cadastro explícito nesta visita — sessão restaurada sozinha não basta.
 */
function shouldRequireExplicitAuthForPendingInvite() {
    return hasPendingInvite() && !hasTerminalBlock() && !isInviteAuthCompleted();
}

function getTerminalBlockCode() {
    var store = sessionStore();
    if (!store) return "";
    try {
        return String(store.getItem(TERMINAL_KEY) || "").trim();
    } catch (error) {
        return "";
    }
}

function setTerminalBlock(code) {
    var store = sessionStore();
    if (!store) return;
    try {
        store.setItem(TERMINAL_KEY, String(code || "UNKNOWN"));
        clearPendingToken();
    } catch (error) {
        clearPendingToken();
    }
}

function hasTerminalBlock() {
    return Boolean(getTerminalBlockCode());
}

function extractAcceptErrorCode(error) {
    if (!error) return "UNKNOWN";
    if (error.code && TERMINAL_CODES.indexOf(String(error.code)) !== -1) {
        return String(error.code);
    }
    if (error.code === "AUTH_REQUIRED") return "AUTH_REQUIRED";
    var message = String(error.message || error || "");
    for (var i = 0; i < TERMINAL_CODES.length; i += 1) {
        if (message.indexOf(TERMINAL_CODES[i]) !== -1) {
            return TERMINAL_CODES[i];
        }
    }
    if (/auth session missing|not authenticated|jwt/i.test(message)) {
        return "AUTH_REQUIRED";
    }
    if (/failed to fetch|network|timeout|fetch failed|temporarily unavailable/i.test(message)) {
        return "NETWORK";
    }
    return "UNKNOWN";
}

function isRetryableNetworkError(error) {
    return extractAcceptErrorCode(error) === "NETWORK";
}

function userMessageForCode(code) {
    return ERROR_MESSAGES[code] || ERROR_MESSAGES.INVITE_NOT_FOUND;
}

function isTerminalErrorCode(code) {
    return TERMINAL_CODES.indexOf(String(code || "")) !== -1;
}

async function hasAuthenticatedSession(client) {
    if (!client || !client.auth) {
        return false;
    }
    if (typeof client.auth.getUser !== "function" || typeof client.auth.getSession !== "function") {
        return false;
    }
    try {
        var verified = await client.auth.getUser();
        var user = verified && verified.data ? verified.data.user : null;
        if (verified && verified.error) {
            return false;
        }
        if (!user || !user.id) {
            return false;
        }
        var result = await client.auth.getSession();
        var session = result && result.data ? result.data.session : null;
        if (result && result.error) {
            return false;
        }
        return Boolean(
            session &&
            session.user &&
            session.user.id &&
            String(session.user.id) === String(user.id)
        );
    } catch (error) {
        return false;
    }
}

async function refreshAfterAccept(client) {
    if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.refresh === "function") {
        await global.AuroraCompanyAccess.refresh(client);
    }
    if (global.AuroraCompanyTeam && typeof global.AuroraCompanyTeam.syncNavVisibility === "function") {
        global.AuroraCompanyTeam.syncNavVisibility();
    }
    if (global.AuroraCloudSync && typeof global.AuroraCloudSync.refreshCompanyAccessClaim === "function") {
        await global.AuroraCloudSync.refreshCompanyAccessClaim();
    }
    global.dispatchEvent(new CustomEvent("aurora:company-invite-accepted"));
}

async function showSuccessDialog() {
    if (global.AuroraDialog && typeof global.AuroraDialog.alert === "function") {
        await global.AuroraDialog.alert(SUCCESS_MESSAGE, { title: "Convite aceito" });
        return;
    }
    global.alert(SUCCESS_MESSAGE);
}

async function showErrorDialog(code) {
    var message = userMessageForCode(code);
    if (global.AuroraDialog && typeof global.AuroraDialog.alert === "function") {
        await global.AuroraDialog.alert(message, { title: "Convite indisponível", tone: "danger" });
        return;
    }
    global.alert(message);
}

async function handleAcceptSuccess(client, token, payload) {
    completedTokens[token] = true;
    clearPendingToken();
    clearInviteAuthCompleted();
    try {
        sessionStore() && sessionStore().removeItem(TERMINAL_KEY);
    } catch (error) {
        /* ignore */
    }
    await refreshAfterAccept(client);
    /*
     * Não bloquear finalizeDeferredAuthReady / bootstrap no diálogo de sucesso.
     * O grant e o claim já foram aplicados em refreshAfterAccept.
     */
    setTimeout(function () {
        showSuccessDialog().catch(function (dialogError) {
            console.warn("Aurora: diálogo pós-convite indisponível.", dialogError);
        });
    }, 0);
    return {
        ok: true,
        status: payload && payload.status ? payload.status : "accepted",
        payload: payload || null
    };
}

async function processPendingInvite(client) {
    if (inFlight) {
        return { ok: false, skipped: true, reason: "in_flight" };
    }
    if (hasTerminalBlock()) {
        return { ok: false, skipped: true, reason: "terminal_block", code: getTerminalBlockCode() };
    }

    var token = readPendingToken();
    if (!token) {
        return { ok: false, skipped: true, reason: "no_pending_token" };
    }
    if (completedTokens[token]) {
        return { ok: false, skipped: true, reason: "already_completed" };
    }

    if (shouldRequireExplicitAuthForPendingInvite()) {
        return { ok: false, skipped: true, reason: "invite_explicit_auth_required" };
    }

    var authenticated = await hasAuthenticatedSession(client);
    if (!authenticated) {
        return { ok: false, skipped: true, reason: "auth_required" };
    }

    if (!global.AuroraCompanyAccess || typeof global.AuroraCompanyAccess.acceptCompanyInvite !== "function") {
        return { ok: false, skipped: true, reason: "accept_wrapper_missing" };
    }

    inFlight = true;
    inFlightToken = token;
    try {
        var payload = await global.AuroraCompanyAccess.acceptCompanyInvite(client, token);
        var status = payload && payload.status ? String(payload.status) : "accepted";
        if (status === "accepted" || status === "already_member") {
            return await handleAcceptSuccess(client, token, payload);
        }
        setTerminalBlock("INVITE_NOT_PENDING");
        await showErrorDialog("INVITE_NOT_PENDING");
        return { ok: false, terminal: true, code: "INVITE_NOT_PENDING" };
    } catch (error) {
        var code = extractAcceptErrorCode(error);
        if (isRetryableNetworkError(error)) {
            return { ok: false, retryable: true, code: "NETWORK" };
        }
        if (code === "AUTH_REQUIRED") {
            return { ok: false, skipped: true, reason: "auth_required" };
        }
        if (isTerminalErrorCode(code)) {
            setTerminalBlock(code);
            completedTokens[token] = true;
            await showErrorDialog(code);
            return { ok: false, terminal: true, code: code };
        }
        setTerminalBlock("INVITE_NOT_FOUND");
        completedTokens[token] = true;
        await showErrorDialog("INVITE_NOT_FOUND");
        return { ok: false, terminal: true, code: "INVITE_NOT_FOUND" };
    } finally {
        inFlight = false;
        inFlightToken = "";
    }
}

async function afterAuthenticatedSessionReady(client) {
    if (shouldRequireExplicitAuthForPendingInvite()) {
        return { ok: false, skipped: true, reason: "invite_explicit_auth_required" };
    }
    if (!(await hasAuthenticatedSession(client))) {
        return { ok: false, skipped: true, reason: "auth_required" };
    }
    return processPendingInvite(client);
}

function applyUnauthenticatedInviteHint(targets) {
    if (!targets) return;
    if (!hasPendingInvite() || hasTerminalBlock()) return;
    if (targets.titleEl) {
        targets.titleEl.textContent = INVITE_AUTH_TITLE;
    }
    if (targets.descriptionEl) {
        targets.descriptionEl.textContent = INVITE_AUTH_DESCRIPTION;
    }
}

/**
 * Boot barrier (Fase 2E.4): adiar AuroraAuthReady enquanto houver convite pendente válido.
 * Condição: sessionStorage pending token — sem hardcode de empresa/role/módulo.
 */
function shouldDeferBootForPendingInvite() {
    return hasPendingInvite() && !hasTerminalBlock();
}

captureInviteFromUrl();

global.AuroraCompanyInviteAccept = {
    PENDING_KEY: PENDING_KEY,
    TERMINAL_KEY: TERMINAL_KEY,
    INVITE_AUTH_COMPLETED_KEY: INVITE_AUTH_COMPLETED_KEY,
    captureInviteFromUrl: captureInviteFromUrl,
    readPendingToken: readPendingToken,
    clearPendingToken: clearPendingToken,
    hasPendingInvite: hasPendingInvite,
    hasTerminalBlock: hasTerminalBlock,
    getTerminalBlockCode: getTerminalBlockCode,
    isValidTokenFormat: isValidTokenFormat,
    isInviteAuthCompleted: isInviteAuthCompleted,
    markInviteAuthCompleted: markInviteAuthCompleted,
    clearInviteAuthCompleted: clearInviteAuthCompleted,
    shouldRequireExplicitAuthForPendingInvite: shouldRequireExplicitAuthForPendingInvite,
    extractAcceptErrorCode: extractAcceptErrorCode,
    userMessageForCode: userMessageForCode,
    applyUnauthenticatedInviteHint: applyUnauthenticatedInviteHint,
    shouldDeferBootForPendingInvite: shouldDeferBootForPendingInvite,
    processPendingInvite: processPendingInvite,
    afterAuthenticatedSessionReady: afterAuthenticatedSessionReady,
    isInFlight: function () { return inFlight; },
    getInFlightToken: function () { return inFlightToken; }
};

})(window);

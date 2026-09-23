(function (global) {
"use strict";

const LICENSE_CONFIG = global.AURORA_LICENSE_CONFIG || {};
const CLOUD_CONFIG = global.AURORA_CLOUD_CONFIG || {};
const LICENSE_CACHE_PREFIX = "aurora_offline_license_v1:";

function licenseCacheKey(userId) {
    return `${LICENSE_CACHE_PREFIX}${String(userId || "").trim()}`;
}

function pickClaimSnapshot(claims) {
    const source = claims && typeof claims === "object" ? claims : {};

    return {
        sub: source.sub != null ? String(source.sub) : "",
        iat: source.iat != null ? Number(source.iat) : null,
        exp: source.exp != null ? Number(source.exp) : null,
        grace_hours: source.grace_hours != null ? Number(source.grace_hours) : null
    };
}

function getTicketRemainingMinutes(claims, userId) {
    const exp = claims && claims.exp != null ? Number(claims.exp) : NaN;

    if (!Number.isFinite(exp)) {
        return null;
    }

    const nowMs = getEstimatedTrustedNowMs(userId);

    return Math.max(0, Math.floor((exp * 1000 - nowMs) / 60000));
}

function saveLicenseTicket(userId, ticket, claims) {
    const id = String(userId || "").trim();
    const jwt = String(ticket || "").trim();

    if (!id || !jwt) {
        return false;
    }

    const snapshot = pickClaimSnapshot(claims);
    const payload = {
        ticket: jwt,
        claims: snapshot,
        saved_at: new Date().toISOString()
    };

    localStorage.setItem(licenseCacheKey(id), JSON.stringify(payload));
    return true;
}

function loadLicenseTicket(userId) {
    const id = String(userId || "").trim();

    if (!id) {
        return null;
    }

    try {
        const raw = localStorage.getItem(licenseCacheKey(id));

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== "object" || !parsed.ticket) {
            return null;
        }

        return parsed;
    } catch (error) {
        return null;
    }
}

function clearLicenseTicket(userId) {
    const id = String(userId || "").trim();

    if (!id) {
        return;
    }

    localStorage.removeItem(licenseCacheKey(id));
}

function logOfflineLicenseMode(mode, details) {
    const payload = Object.assign(
        {
            mode: String(mode || "unknown")
        },
        details && typeof details === "object" ? details : {}
    );

    console.info("AURORA OFFLINE LICENSE", payload);
}

async function issueAndStoreLicenseTicket(accessToken) {
    const token = await resolveDevAccessToken(accessToken);
    const url = buildEdgeFunctionUrl();
    const anonKey = String(CLOUD_CONFIG.anon_key || "").trim();

    if (!anonKey) {
        throw new Error("anon_key ausente em AURORA_CLOUD_CONFIG.");
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({})
    });

    const raw = await response.text();
    let body = null;

    try {
        body = raw ? JSON.parse(raw) : null;
    } catch (error) {
        throw new Error(`Resposta inválida da Edge Function (${response.status}).`);
    }

    if (!response.ok) {
        const message = body && body.error
            ? String(body.error)
            : `Falha ao emitir License Ticket (${response.status}).`;
        const issueError = new Error(message);
        issueError.status = response.status;
        throw issueError;
    }

    const ticket = body && body.ticket ? String(body.ticket) : "";

    if (!ticket) {
        throw new Error("Edge Function não retornou ticket.");
    }

    const verification = await verifyLicenseJwt(ticket);

    if (!verification.valid || !verification.claims || !verification.claims.sub) {
        throw new Error(verification.error || "License Ticket inválido.");
    }

    saveLicenseTicket(verification.claims.sub, ticket, verification.claims);
    refreshMonotonicAnchorFromVerifiedClaims(verification.claims);

    logOfflineLicenseMode("online_validated", {
        network_error: false,
        ticket_exp: verification.meta && verification.meta.exp,
        ticket_remaining_minutes: getTicketRemainingMinutes(verification.claims, verification.claims.sub),
        grace_hours: verification.meta && verification.meta.grace_hours,
        modules_count: verification.meta && verification.meta.modules_count
    });

    return {
        ticket,
        issued: body.issued || null,
        verification
    };
}

function isOfflineLicenseV1Enabled() {
    return Boolean(
        LICENSE_CONFIG &&
        LICENSE_CONFIG.offline_license_v1 !== false
    );
}

function isAndroidMonotonicBridgeAvailable() {
    return global.__AURORA_ANDROID__ === true &&
        global.AuroraAndroid &&
        typeof global.AuroraAndroid.getElapsedRealtime === "function" &&
        typeof global.AuroraAndroid.getBootCount === "function" &&
        typeof global.AuroraAndroid.readMonotonicAnchor === "function" &&
        typeof global.AuroraAndroid.writeMonotonicAnchor === "function";
}

function isMonotonicProtectionEnabled() {
    return isOfflineLicenseV1Enabled() &&
        isAndroidMonotonicBridgeAvailable() &&
        LICENSE_CONFIG.offline_monotonic_v1 !== false;
}

function getClockSkewToleranceMs() {
    const configured = Number(LICENSE_CONFIG.clock_skew_tolerance_ms);

    if (Number.isFinite(configured) && configured > 0) {
        return configured;
    }

    return 5 * 60 * 1000;
}

function readMonotonicAnchor(userId) {
    if (!isAndroidMonotonicBridgeAvailable()) {
        return null;
    }

    try {
        const raw = String(global.AuroraAndroid.readMonotonicAnchor(String(userId || "").trim()) || "").trim();

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        return {
            user_id: parsed.user_id != null ? String(parsed.user_id) : "",
            trusted_wall_time_ms: Number(parsed.trusted_wall_time_ms),
            monotonic_anchor_ms: Number(parsed.monotonic_anchor_ms),
            boot_count: parsed.boot_count != null ? Number(parsed.boot_count) : NaN,
            version: parsed.version != null ? Number(parsed.version) : 1
        };
    } catch (error) {
        return null;
    }
}

function getEstimatedTrustedNowMs(userId) {
    if (!isMonotonicProtectionEnabled()) {
        return Date.now();
    }

    const anchor = readMonotonicAnchor(userId);

    if (
        !anchor ||
        !Number.isFinite(anchor.trusted_wall_time_ms) ||
        !Number.isFinite(anchor.monotonic_anchor_ms)
    ) {
        return Date.now();
    }

    const currentElapsed = Number(global.AuroraAndroid.getElapsedRealtime());

    if (!Number.isFinite(currentElapsed) || currentElapsed < anchor.monotonic_anchor_ms) {
        return Date.now();
    }

    return anchor.trusted_wall_time_ms + (currentElapsed - anchor.monotonic_anchor_ms);
}

function getMonotonicAnchorAgeMinutes(userId) {
    const anchor = readMonotonicAnchor(userId);

    if (
        !anchor ||
        !Number.isFinite(anchor.trusted_wall_time_ms) ||
        !Number.isFinite(anchor.monotonic_anchor_ms)
    ) {
        return null;
    }

    const currentElapsed = Number(global.AuroraAndroid.getElapsedRealtime());

    if (!Number.isFinite(currentElapsed) || currentElapsed < anchor.monotonic_anchor_ms) {
        return null;
    }

    return Math.max(0, Math.floor((currentElapsed - anchor.monotonic_anchor_ms) / 60000));
}

function readCurrentBootCount() {
    if (!isAndroidMonotonicBridgeAvailable()) {
        return null;
    }

    const value = Number(global.AuroraAndroid.getBootCount());

    if (!Number.isFinite(value) || value < 0) {
        return null;
    }

    return Math.floor(value);
}

function resolveTrustedWallTimeMsFromClaims(claims) {
    const iat = claims && claims.iat != null ? Number(claims.iat) : NaN;

    if (!Number.isFinite(iat) || iat <= 0) {
        return null;
    }

    return Math.floor(iat * 1000);
}

function detectMonotonicReboot(anchor) {
    const currentBootCount = readCurrentBootCount();

    if (currentBootCount === null) {
        return {
            reboot: true,
            mode: "device_reboot_detected",
            reason: "boot_count_unavailable"
        };
    }

    if (!anchor || !Number.isFinite(anchor.boot_count)) {
        return {
            reboot: true,
            mode: "monotonic_anchor_invalid",
            reason: "boot_count_missing"
        };
    }

    if (currentBootCount !== anchor.boot_count) {
        return {
            reboot: true,
            mode: "device_reboot_detected",
            reason: "boot_count_mismatch"
        };
    }

    const currentElapsed = Number(global.AuroraAndroid.getElapsedRealtime());

    if (!Number.isFinite(currentElapsed) || currentElapsed < anchor.monotonic_anchor_ms) {
        return {
            reboot: true,
            mode: "device_reboot_detected",
            reason: "elapsed_regressed"
        };
    }

    return {
        reboot: false,
        mode: null,
        reason: null
    };
}

function refreshMonotonicAnchorFromVerifiedClaims(claims) {
    if (!isMonotonicProtectionEnabled()) {
        return {
            ok: false,
            mode: "monotonic_not_required",
            bridge_android: isAndroidMonotonicBridgeAvailable()
        };
    }

    const id = claims && claims.sub != null ? String(claims.sub).trim() : "";
    const trustedWallTimeMs = resolveTrustedWallTimeMsFromClaims(claims);
    const monotonicAnchorMs = Number(global.AuroraAndroid.getElapsedRealtime());
    const bootCount = readCurrentBootCount();

    if (
        !id ||
        trustedWallTimeMs == null ||
        !Number.isFinite(monotonicAnchorMs) ||
        bootCount === null
    ) {
        logOfflineLicenseMode("monotonic_anchor_invalid", {
            bridge_android: true,
            clock_skew_ms: null,
            anchor_age_minutes: null,
            verify_error: bootCount === null ? "boot_count_unavailable" : "invalid_ticket_iat"
        });

        return {
            ok: false,
            mode: "monotonic_anchor_invalid",
            bridge_android: true
        };
    }

    const written = global.AuroraAndroid.writeMonotonicAnchor(
        id,
        trustedWallTimeMs,
        Math.floor(monotonicAnchorMs),
        bootCount
    ) === true;

    logOfflineLicenseMode(written ? "monotonic_anchor_created" : "monotonic_anchor_invalid", {
        bridge_android: true,
        clock_skew_ms: 0,
        anchor_age_minutes: 0,
        remaining_minutes: null,
        boot_count: bootCount
    });

    return {
        ok: written,
        mode: written ? "monotonic_anchor_created" : "monotonic_anchor_invalid",
        bridge_android: true
    };
}

function refreshMonotonicAnchorFromOnlineValidation(userId, claimsOrTrustedMs) {
    if (claimsOrTrustedMs && typeof claimsOrTrustedMs === "object") {
        return refreshMonotonicAnchorFromVerifiedClaims(claimsOrTrustedMs);
    }

    return {
        ok: false,
        mode: "monotonic_anchor_invalid",
        bridge_android: isAndroidMonotonicBridgeAvailable()
    };
}

function evaluateMonotonicTemporal(userId, claims) {
    if (!isMonotonicProtectionEnabled()) {
        return {
            ok: true,
            mode: "monotonic_not_required",
            bridge_android: false,
            revalidation_required: false,
            estimated_trusted_now_ms: Date.now(),
            clock_skew_ms: 0,
            clock_tamper_detected: false
        };
    }

    const id = String(userId || "").trim();
    const anchor = readMonotonicAnchor(id);
    const bridgeAndroid = true;

    if (
        !anchor ||
        !Number.isFinite(anchor.trusted_wall_time_ms) ||
        !Number.isFinite(anchor.monotonic_anchor_ms)
    ) {
        global.AURORA_OFFLINE_LICENSE_STATE = "revalidation_required";

        logOfflineLicenseMode("monotonic_anchor_missing", {
            bridge_android: bridgeAndroid,
            clock_skew_ms: null,
            anchor_age_minutes: null,
            remaining_minutes: getTicketRemainingMinutes(claims, id)
        });

        return {
            ok: false,
            mode: "monotonic_anchor_missing",
            bridge_android: bridgeAndroid,
            revalidation_required: true,
            estimated_trusted_now_ms: null,
            clock_skew_ms: null,
            clock_tamper_detected: false
        };
    }

    if (anchor.user_id && anchor.user_id !== id) {
        global.AURORA_OFFLINE_LICENSE_STATE = "revalidation_required";

        logOfflineLicenseMode("monotonic_anchor_invalid", {
            bridge_android: bridgeAndroid,
            clock_skew_ms: null,
            anchor_age_minutes: getMonotonicAnchorAgeMinutes(id),
            remaining_minutes: getTicketRemainingMinutes(claims, id)
        });

        return {
            ok: false,
            mode: "monotonic_anchor_invalid",
            bridge_android: bridgeAndroid,
            revalidation_required: true,
            estimated_trusted_now_ms: null,
            clock_skew_ms: null,
            clock_tamper_detected: false
        };
    }

    const currentElapsed = Number(global.AuroraAndroid.getElapsedRealtime());

    const rebootCheck = detectMonotonicReboot(anchor);

    if (rebootCheck.reboot) {
        global.AURORA_OFFLINE_LICENSE_STATE = "revalidation_required";

        logOfflineLicenseMode(rebootCheck.mode, {
            bridge_android: bridgeAndroid,
            clock_skew_ms: null,
            anchor_age_minutes: null,
            remaining_minutes: getTicketRemainingMinutes(claims, id),
            verify_error: rebootCheck.reason
        });

        return {
            ok: false,
            mode: rebootCheck.mode,
            bridge_android: bridgeAndroid,
            revalidation_required: true,
            estimated_trusted_now_ms: null,
            clock_skew_ms: null,
            clock_tamper_detected: false
        };
    }

    const elapsed = currentElapsed - anchor.monotonic_anchor_ms;
    const estimatedTrustedNowMs = anchor.trusted_wall_time_ms + elapsed;
    const clockSkewMs = Math.abs(Date.now() - estimatedTrustedNowMs);
    const clockTamperDetected = clockSkewMs > getClockSkewToleranceMs();
    const exp = claims && claims.exp != null ? Number(claims.exp) : NaN;
    const estimatedTrustedNowSec = Math.floor(estimatedTrustedNowMs / 1000);
    const remainingMinutes = Number.isFinite(exp)
        ? Math.max(0, Math.floor((exp * 1000 - estimatedTrustedNowMs) / 60000))
        : null;
    const anchorAgeMinutes = Math.max(0, Math.floor(elapsed / 60000));
    const logDetails = {
        bridge_android: bridgeAndroid,
        clock_skew_ms: clockSkewMs,
        anchor_age_minutes: anchorAgeMinutes,
        remaining_minutes: remainingMinutes
    };

    if (Number.isFinite(exp) && estimatedTrustedNowSec >= exp) {
        global.AURORA_OFFLINE_LICENSE_STATE = "revalidation_required";

        logOfflineLicenseMode("revalidation_required", Object.assign({}, logDetails, {
            verify_error: "ticket_expired_monotonic"
        }));

        return {
            ok: false,
            mode: "revalidation_required",
            bridge_android: bridgeAndroid,
            revalidation_required: true,
            estimated_trusted_now_ms: estimatedTrustedNowMs,
            clock_skew_ms: clockSkewMs,
            clock_tamper_detected: clockTamperDetected
        };
    }

    logOfflineLicenseMode(
        clockTamperDetected ? "clock_tamper_detected" : "monotonic_anchor_valid",
        logDetails
    );

    return {
        ok: true,
        mode: clockTamperDetected ? "clock_tamper_detected" : "monotonic_anchor_valid",
        bridge_android: bridgeAndroid,
        revalidation_required: false,
        estimated_trusted_now_ms: estimatedTrustedNowMs,
        clock_skew_ms: clockSkewMs,
        clock_tamper_detected: clockTamperDetected
    };
}

function evaluateTemporalAccess(userId, claims) {
    if (isMonotonicProtectionEnabled()) {
        return evaluateMonotonicTemporal(userId, claims);
    }

    const exp = claims && claims.exp != null ? Number(claims.exp) : NaN;
    const nowSec = Math.floor(Date.now() / 1000);

    if (Number.isFinite(exp) && exp <= nowSec) {
        global.AURORA_OFFLINE_LICENSE_STATE = "revalidation_required";

        return {
            ok: false,
            mode: "offline_ticket_expired",
            bridge_android: false,
            revalidation_required: true,
            estimated_trusted_now_ms: Date.now(),
            clock_skew_ms: 0,
            clock_tamper_detected: false
        };
    }

    return {
        ok: true,
        mode: "web_temporal_valid",
        bridge_android: false,
        revalidation_required: false,
        estimated_trusted_now_ms: Date.now(),
        clock_skew_ms: 0,
        clock_tamper_detected: false
    };
}

function normalizeSignedModules(modules) {
    if (!Array.isArray(modules)) {
        return [];
    }

    return modules.map((item) => ({
        module_code: item && item.module_code != null ? String(item.module_code) : "",
        title: item && item.title != null ? String(item.title) : "",
        icon: item && item.icon != null ? String(item.icon) : "✦",
        can_access: Boolean(item && item.can_access === true),
        access_status: item && item.access_status != null ? String(item.access_status) : "",
        ends_at: item && item.ends_at != null ? String(item.ends_at) : ""
    })).filter((item) => item.module_code);
}

function classifyColdStartTicketFailure(verification, userId) {
    const normalizedUserId = String(userId || "").trim();
    const claimSub = verification.claims && verification.claims.sub
        ? String(verification.claims.sub).trim()
        : "";

    if (claimSub && normalizedUserId && claimSub !== normalizedUserId) {
        return "cold_start_offline_ticket_invalid";
    }

    if (!isMonotonicProtectionEnabled()) {
        const exp = verification.claims && verification.claims.exp != null
            ? Number(verification.claims.exp)
            : NaN;
        const now = Math.floor(Date.now() / 1000);

        if (Number.isFinite(exp) && exp <= now) {
            return "cold_start_offline_ticket_expired";
        }
    }

    if (!verification.valid) {
        return "cold_start_offline_ticket_invalid";
    }

    return null;
}

function getColdStartErrorMessage(mode) {
    switch (mode) {
        case "cold_start_offline_ticket_missing":
            return "License Ticket offline ausente. Conecte-se à internet para validar sua licença.";
        case "cold_start_offline_ticket_expired":
            return "License Ticket offline expirado. Conecte-se à internet para revalidar.";
        case "cold_start_offline_ticket_invalid":
            return "License Ticket offline inválido.";
        default:
            return "Não foi possível validar o License Ticket offline.";
    }
}

async function resolveColdStartTicketContext(userId) {
    const empty = {
        ok: false,
        mode: "cold_start_offline_ticket_missing",
        modules: [],
        access: null,
        active_module: null,
        verification: null,
        revalidation_required: false
    };

    if (!isOfflineLicenseV1Enabled()) {
        return Object.assign({}, empty, { mode: "offline_license_disabled" });
    }

    const cached = loadLicenseTicket(userId);

    if (!cached || !cached.ticket) {
        logOfflineLicenseMode("cold_start_offline_ticket_missing", {
            network_error: typeof navigator !== "undefined" ? navigator.onLine === false : true,
            ticket_exp: null,
            ticket_remaining_minutes: 0
        });

        return Object.assign({}, empty, { mode: "cold_start_offline_ticket_missing" });
    }

    const verification = await verifyLicenseJwt(cached.ticket);
    const failureMode = classifyColdStartTicketFailure(verification, userId);

    if (failureMode === "cold_start_offline_ticket_expired") {
        global.AURORA_OFFLINE_LICENSE_STATE = "revalidation_required";

        logOfflineLicenseMode("cold_start_offline_ticket_expired", {
            network_error: typeof navigator !== "undefined" ? navigator.onLine === false : true,
            ticket_exp: verification.meta && verification.meta.exp,
            ticket_remaining_minutes: getTicketRemainingMinutes(verification.claims, userId),
            grace_hours: verification.meta && verification.meta.grace_hours,
            verify_error: verification.error || "expired"
        });

        return {
            ok: false,
            mode: failureMode,
            modules: [],
            access: null,
            active_module: null,
            verification,
            revalidation_required: true
        };
    }

    if (failureMode === "cold_start_offline_ticket_invalid") {
        logOfflineLicenseMode("cold_start_offline_ticket_invalid", {
            network_error: typeof navigator !== "undefined" ? navigator.onLine === false : true,
            ticket_exp: verification.meta && verification.meta.exp,
            ticket_remaining_minutes: getTicketRemainingMinutes(verification.claims, userId),
            grace_hours: verification.meta && verification.meta.grace_hours,
            verify_error: verification.error || "invalid"
        });

        return {
            ok: false,
            mode: failureMode,
            modules: [],
            access: null,
            active_module: null,
            verification,
            revalidation_required: false
        };
    }

    const claims = verification.claims || {};
    const access = claims.access && typeof claims.access === "object" ? claims.access : null;

    if (access && access.blocked === true) {
        logOfflineLicenseMode("cold_start_offline_ticket_invalid", {
            network_error: typeof navigator !== "undefined" ? navigator.onLine === false : true,
            ticket_exp: verification.meta && verification.meta.exp,
            ticket_remaining_minutes: getTicketRemainingMinutes(verification.claims, userId),
            grace_hours: verification.meta && verification.meta.grace_hours,
            verify_error: "access_blocked"
        });

        return {
            ok: false,
            mode: "cold_start_offline_ticket_invalid",
            modules: [],
            access,
            active_module: null,
            verification,
            revalidation_required: false
        };
    }

    const temporal = evaluateTemporalAccess(userId, verification.claims || {});

    if (!temporal.ok) {
        logOfflineLicenseMode(temporal.mode, {
            network_error: typeof navigator !== "undefined" ? navigator.onLine === false : true,
            ticket_exp: verification.meta && verification.meta.exp,
            ticket_remaining_minutes: getTicketRemainingMinutes(verification.claims, userId),
            grace_hours: verification.meta && verification.meta.grace_hours,
            bridge_android: temporal.bridge_android,
            clock_skew_ms: temporal.clock_skew_ms,
            anchor_age_minutes: getMonotonicAnchorAgeMinutes(userId),
            verify_error: temporal.mode
        });

        return {
            ok: false,
            mode: temporal.mode,
            modules: [],
            access: null,
            active_module: null,
            verification,
            revalidation_required: Boolean(temporal.revalidation_required)
        };
    }

    const modules = normalizeSignedModules(claims.modules);
    const activeModule = claims.active_module != null
        ? String(claims.active_module).trim()
        : "";

    logOfflineLicenseMode("cold_start_offline_ticket_valid", {
        network_error: typeof navigator !== "undefined" ? navigator.onLine === false : true,
        ticket_exp: verification.meta && verification.meta.exp,
        ticket_remaining_minutes: getTicketRemainingMinutes(verification.claims, userId),
        grace_hours: verification.meta && verification.meta.grace_hours,
        modules_count: modules.length,
        bridge_android: temporal.bridge_android,
        clock_skew_ms: temporal.clock_skew_ms,
        anchor_age_minutes: getMonotonicAnchorAgeMinutes(userId),
        verify_error: temporal.clock_tamper_detected ? "clock_tamper_detected" : null
    });

    const context = {
        ok: true,
        mode: "cold_start_offline_ticket_valid",
        modules,
        access,
        active_module: activeModule || null,
        verification,
        revalidation_required: false
    };

    global.AURORA_OFFLINE_STARTUP_CTX = context;
    return context;
}

async function loadModulesForOfflineStartup(userId) {
    const context = await resolveColdStartTicketContext(userId);

    if (!context.ok) {
        const error = new Error(getColdStartErrorMessage(context.mode));
        error.offlineLicenseMode = context.mode;
        error.revalidation_required = Boolean(context.revalidation_required);
        throw error;
    }

    const modules = Array.isArray(context.modules) ? context.modules : [];

    if (!modules.length) {
        const error = new Error("Nenhum módulo encontrado no License Ticket offline.");
        error.offlineLicenseMode = "cold_start_offline_ticket_invalid";
        throw error;
    }

    if (
        global.AuroraModuleCommercial &&
        typeof global.AuroraModuleCommercial.enrichModules === "function"
    ) {
        return global.AuroraModuleCommercial.enrichModules(modules, {
            offlineSnapshot: true,
            userId
        });
    }

    return modules;
}

async function loadStartupModulesWithOfflineFallback(userId, onlineLoader) {
    if (!isOfflineLicenseV1Enabled()) {
        return onlineLoader();
    }

    const preferOnline = typeof navigator === "undefined" || navigator.onLine !== false;

    if (preferOnline) {
        try {
            return await onlineLoader();
        } catch (error) {
            const retryable = global.AuroraCloudSync &&
                typeof global.AuroraCloudSync.isRetryableNetworkError === "function" &&
                global.AuroraCloudSync.isRetryableNetworkError(error);

            if (!retryable) {
                throw error;
            }
        }
    }

    return loadModulesForOfflineStartup(userId);
}

async function evaluateStoredLicenseTicket(userId) {
    const cached = loadLicenseTicket(userId);

    if (!cached || !cached.ticket) {
        logOfflineLicenseMode("offline_ticket_missing", {
            network_error: true,
            ticket_exp: null,
            ticket_remaining_minutes: 0
        });

        return {
            valid: false,
            mode: "offline_ticket_missing",
            cached: null,
            verification: null
        };
    }

    const verification = await verifyLicenseJwt(cached.ticket);
    const claimSub = verification.claims && verification.claims.sub
        ? String(verification.claims.sub)
        : "";

    if (
        verification.valid &&
        claimSub &&
        claimSub === String(userId || "").trim()
    ) {
        const temporal = evaluateTemporalAccess(userId, verification.claims || {});

        if (!temporal.ok) {
            logOfflineLicenseMode(temporal.mode, {
                network_error: true,
                ticket_exp: verification.meta && verification.meta.exp,
                ticket_remaining_minutes: getTicketRemainingMinutes(verification.claims, userId),
                grace_hours: verification.meta && verification.meta.grace_hours,
                modules_count: verification.meta && verification.meta.modules_count,
                bridge_android: temporal.bridge_android,
                clock_skew_ms: temporal.clock_skew_ms,
                anchor_age_minutes: getMonotonicAnchorAgeMinutes(userId),
                verify_error: temporal.mode
            });

            return {
                valid: false,
                mode: temporal.mode,
                cached,
                verification,
                revalidation_required: Boolean(temporal.revalidation_required)
            };
        }

        logOfflineLicenseMode(temporal.clock_tamper_detected ? "clock_tamper_detected" : "offline_ticket_valid", {
            network_error: true,
            ticket_exp: verification.meta && verification.meta.exp,
            ticket_remaining_minutes: getTicketRemainingMinutes(verification.claims, userId),
            grace_hours: verification.meta && verification.meta.grace_hours,
            modules_count: verification.meta && verification.meta.modules_count,
            bridge_android: temporal.bridge_android,
            clock_skew_ms: temporal.clock_skew_ms,
            anchor_age_minutes: getMonotonicAnchorAgeMinutes(userId)
        });

        return {
            valid: true,
            mode: temporal.clock_tamper_detected ? "clock_tamper_detected" : "offline_ticket_valid",
            cached,
            verification
        };
    }

    logOfflineLicenseMode("offline_ticket_expired", {
        network_error: true,
        ticket_exp: verification.meta && verification.meta.exp,
        ticket_remaining_minutes: getTicketRemainingMinutes(verification.claims, userId),
        grace_hours: verification.meta && verification.meta.grace_hours,
        verify_error: verification.error || "expired"
    });

    return {
        valid: false,
        mode: "offline_ticket_expired",
        cached,
        verification
    };
}

function base64UrlToBytes(value) {
    const normalized = String(value || "")
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const padding = normalized.length % 4 === 0
        ? ""
        : "=".repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + padding);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function decodeBase64UrlJson(value) {
    const bytes = base64UrlToBytes(value);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
}

function normalizePublicJwk(config) {
    const source = config && config.public_jwk ? config.public_jwk : null;

    if (!source || typeof source !== "object") {
        return null;
    }

    const x = String(source.x || "").trim();
    const kid = String(source.kid || config.kid || "aurora-license-v1").trim();
    const crv = String(source.crv || "Ed25519").trim();
    const kty = String(source.kty || "OKP").trim();

    if (!x) {
        return null;
    }

    return {
        kty,
        crv,
        x,
        kid,
        ext: true,
        key_ops: ["verify"]
    };
}

function decodeLicenseClaims(token) {
    const parts = String(token || "").split(".");

    if (parts.length !== 3) {
        throw new Error("License Ticket malformado.");
    }

    const header = decodeBase64UrlJson(parts[0]);
    const claims = decodeBase64UrlJson(parts[1]);

    return {
        header,
        claims,
        verified: false
    };
}

async function importVerifyPublicKey(publicJwk) {
    if (!global.crypto || !global.crypto.subtle) {
        throw new Error("Web Crypto indisponível para verificar License Ticket.");
    }

    return global.crypto.subtle.importKey(
        "jwk",
        publicJwk,
        { name: "Ed25519" },
        false,
        ["verify"]
    );
}

async function verifyLicenseJwt(token, options) {
    const opts = options && typeof options === "object" ? options : {};
    const publicJwk = normalizePublicJwk(opts.config || LICENSE_CONFIG);

    if (!publicJwk) {
        return {
            valid: false,
            header: null,
            claims: null,
            error: "public_key_not_configured",
            meta: null
        };
    }

    const parts = String(token || "").split(".");

    if (parts.length !== 3) {
        return {
            valid: false,
            header: null,
            claims: null,
            error: "malformed_token",
            meta: null
        };
    }

    let header;
    let claims;

    try {
        header = decodeBase64UrlJson(parts[0]);
        claims = decodeBase64UrlJson(parts[1]);
    } catch (error) {
        return {
            valid: false,
            header: null,
            claims: null,
            error: "invalid_json",
            meta: null
        };
    }

    const meta = {
        alg: header && header.alg ? String(header.alg) : "",
        kid: header && header.kid ? String(header.kid) : "",
        iat: claims && claims.iat != null ? Number(claims.iat) : null,
        exp: claims && claims.exp != null ? Number(claims.exp) : null,
        grace_hours: claims && claims.grace_hours != null ? Number(claims.grace_hours) : null,
        modules_count: Array.isArray(claims && claims.modules) ? claims.modules.length : 0,
        sub: claims && claims.sub ? String(claims.sub) : ""
    };

    if (meta.alg !== "EdDSA") {
        return {
            valid: false,
            header,
            claims,
            error: "unsupported_algorithm",
            meta
        };
    }

    if (meta.kid && publicJwk.kid && meta.kid !== publicJwk.kid) {
        return {
            valid: false,
            header,
            claims,
            error: "kid_mismatch",
            meta
        };
    }

    try {
        const key = await importVerifyPublicKey(publicJwk);
        const signedBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
        const signature = base64UrlToBytes(parts[2]);
        const valid = await global.crypto.subtle.verify(
            "Ed25519",
            key,
            signature,
            signedBytes
        );

        return {
            valid: Boolean(valid),
            header,
            claims,
            error: valid ? null : "invalid_signature",
            meta
        };
    } catch (error) {
        return {
            valid: false,
            header,
            claims,
            error: error && error.message ? String(error.message) : "verify_failed",
            meta
        };
    }
}

function buildEdgeFunctionUrl() {
    const baseUrl = String(CLOUD_CONFIG.url || "").replace(/\/+$/, "");
    const functionName = String(
        LICENSE_CONFIG.edge_function || "aurora_issue_license_ticket_pwa_test"
    ).trim();

    if (!baseUrl || !functionName) {
        throw new Error("Configuração Supabase incompleta para License Ticket.");
    }

    return `${baseUrl}/functions/v1/${functionName}`;
}

function resolveDevAccessToken(explicitToken) {
    const token = String(explicitToken || "").trim();

    if (token) {
        return token;
    }

    const client = global.AuroraCloudSync && global.AuroraCloudSync.client
        ? global.AuroraCloudSync.client
        : null;

    if (!client || typeof client.auth.getSession !== "function") {
        throw new Error("Sessão indisponível. Faça login antes de emitir o License Ticket.");
    }

    return client.auth.getSession().then(({ data, error }) => {
        if (error) {
            throw error;
        }

        if (!data || !data.session || !data.session.access_token) {
            throw new Error("Sessão indisponível. Faça login antes de emitir o License Ticket.");
        }

        return data.session.access_token;
    });
}

function logDevLicenseSummary(label, payload) {
    if (!payload) {
        return;
    }

    console.info(`AURORA LICENSE DEV ${label}`, payload);
}

async function fetchLicenseTicketDev(options) {
    const opts = options && typeof options === "object" ? options : {};
    const accessToken = await resolveDevAccessToken(opts.accessToken);
    const url = buildEdgeFunctionUrl();
    const anonKey = String(CLOUD_CONFIG.anon_key || "").trim();

    if (!anonKey) {
        throw new Error("anon_key ausente em AURORA_CLOUD_CONFIG.");
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({})
    });

    const raw = await response.text();
    let body = null;

    try {
        body = raw ? JSON.parse(raw) : null;
    } catch (error) {
        throw new Error(`Resposta inválida da Edge Function (${response.status}).`);
    }

    if (!response.ok) {
        const message = body && body.error
            ? String(body.error)
            : `Falha ao emitir License Ticket (${response.status}).`;
        throw new Error(message);
    }

    const ticket = body && body.ticket ? String(body.ticket) : "";

    if (!ticket) {
        throw new Error("Edge Function não retornou ticket.");
    }

    const verification = await verifyLicenseJwt(ticket);

    logDevLicenseSummary("ticket recebido", {
        algorithm: verification.meta && verification.meta.alg,
        kid: verification.meta && verification.meta.kid,
        iat: verification.meta && verification.meta.iat,
        exp: verification.meta && verification.meta.exp,
        grace_hours: verification.meta && verification.meta.grace_hours,
        modules_count: verification.meta && verification.meta.modules_count,
        verification_ok: verification.valid
    });

    if (verification.valid && verification.claims && verification.claims.sub) {
        saveLicenseTicket(verification.claims.sub, ticket, verification.claims);
    }

    return {
        ticket,
        issued: body.issued || null,
        verification
    };
}

global.AuroraOfflineLicense = {
    decodeLicenseClaims,
    verifyLicenseJwt,
    saveLicenseTicket,
    loadLicenseTicket,
    clearLicenseTicket,
    issueAndStoreLicenseTicket,
    evaluateStoredLicenseTicket,
    getTicketRemainingMinutes,
    logOfflineLicenseMode,
    fetchLicenseTicketDev,
    isOfflineLicenseV1Enabled,
    isMonotonicProtectionEnabled,
    isAndroidMonotonicBridgeAvailable,
    refreshMonotonicAnchorFromVerifiedClaims,
    refreshMonotonicAnchorFromOnlineValidation,
    evaluateMonotonicTemporal,
    evaluateTemporalAccess,
    getEstimatedTrustedNowMs,
    normalizeSignedModules,
    resolveColdStartTicketContext,
    loadModulesForOfflineStartup,
    loadStartupModulesWithOfflineFallback
};

global.auroraDevLicenseTicket = fetchLicenseTicketDev;

})(window);

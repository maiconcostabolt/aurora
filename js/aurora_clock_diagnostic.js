(function (global) {
"use strict";

const PREFIX = "AURORA CLOCK DIAGNOSTIC";
let sequence = 0;

function sanitizeUserId(userId) {
    const id = String(userId || "").trim();

    if (!id) {
        return "";
    }

    return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}

function bridgeAvailable() {
    return global.__AURORA_ANDROID__ === true &&
        global.AuroraAndroid &&
        typeof global.AuroraAndroid.getElapsedRealtime === "function" &&
        typeof global.AuroraAndroid.readMonotonicAnchor === "function";
}

function readEstimatedTrustedNowMs(userId) {
    const id = String(userId || global.AURORA_ACCOUNT_USER_ID || "").trim();
    const offlineLicense = global.AuroraOfflineLicense;

    if (
        !id ||
        !offlineLicense ||
        typeof offlineLicense.getEstimatedTrustedNowMs !== "function"
    ) {
        return null;
    }

    const value = Number(offlineLicense.getEstimatedTrustedNowMs(id));

    return Number.isFinite(value) ? Math.floor(value) : null;
}

function context(userId) {
    const wallClockMs = Date.now();
    const estimatedTrustedNowMs = readEstimatedTrustedNowMs(userId);
    const clockSkewMs = estimatedTrustedNowMs == null
        ? null
        : Math.abs(wallClockMs - estimatedTrustedNowMs);

    let anchorPresent = false;

    if (
        bridgeAvailable() &&
        typeof global.AuroraAndroid.readMonotonicAnchor === "function"
    ) {
        try {
            const raw = String(
                global.AuroraAndroid.readMonotonicAnchor(
                    String(userId || global.AURORA_ACCOUNT_USER_ID || "").trim()
                ) || ""
            ).trim();
            anchorPresent = raw.length > 0;
        } catch (error) {
            anchorPresent = false;
        }
    }

    return {
        wall_clock_ms: wallClockMs,
        android_bridge_available: bridgeAvailable(),
        anchor_present: anchorPresent,
        estimated_trusted_now_ms: estimatedTrustedNowMs,
        clock_skew_ms: clockSkewMs,
        user_id_prefix: sanitizeUserId(userId || global.AURORA_ACCOUNT_USER_ID || "")
    };
}

function emit(event, details) {
    sequence += 1;

    const payload = Object.assign(
        {
            step: sequence,
            event: String(event || "unknown")
        },
        details && typeof details === "object" ? details : {}
    );

    const line = `${PREFIX} ${JSON.stringify(payload)}`;

    console.info(line);

    if (
        global.AuroraAndroid &&
        typeof global.AuroraAndroid.logClockDiagnostic === "function"
    ) {
        try {
            global.AuroraAndroid.logClockDiagnostic(line);
        } catch (error) {
            console.warn("AURORA CLOCK DIAGNOSTIC bridge_failed", {
                message: error && error.message ? String(error.message) : "bridge_error"
            });
        }
    }
}

function log(event, details) {
    emit(event, details);
}

function logWithContext(event, userId, details) {
    emit(event, Object.assign({}, context(userId), details && typeof details === "object" ? details : {}));
}

global.AuroraClockDiagnostic = {
    log,
    logWithContext,
    context
};

})(window);

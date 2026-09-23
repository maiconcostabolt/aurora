(function (global) {
    "use strict";

    if (global.__AURORA_UI_SUPPORT_DIAG__) {
        return;
    }
    global.__AURORA_UI_SUPPORT_DIAG__ = true;

    let seq = 0;
    let hooksInstalled = false;
    let supportRefreshActive = false;
    let profileOpenWatch = 0;

    let caseChangedLastSecond = 0;
    let mutationCallbacksLastSecond = 0;
    let mutationRecordsLastSecond = 0;
    let mutationCallbacksBucket = 0;
    let mutationRecordsBucket = 0;

    function log(event, details) {
        seq += 1;
        const payload = Object.assign({ seq: seq, event: event, ts: Date.now() }, details || {});
        try {
            console.info("AURORA_UI_DIAG " + JSON.stringify(payload));
        } catch (_error) {
            console.info('AURORA_UI_DIAG {"seq":' + seq + ',"event":"log_failed","name":"' + String(event) + '"}');
        }
    }

    function overlaySnapshot() {
        const native = document.querySelector("[data-native-support-overlay]");
        const pwa = document.querySelector(".aurora-support-overlay:not([data-native-support-overlay])");
        const settings = document.querySelector(".aurora-settings-modal");
        return {
            native_support_present: Boolean(native),
            native_support_visible: Boolean(native && !native.hidden),
            pwa_support_present: Boolean(pwa),
            pwa_support_visible: Boolean(pwa && !pwa.hidden),
            settings_open: Boolean(settings && settings.classList.contains("is-open"))
        };
    }

    function logOverlayState() {
        log("overlay_state", overlaySnapshot());
    }

    function watchProfileOpenEnd(startTs) {
        const watchId = ++profileOpenWatch;
        let attempts = 0;
        (function poll() {
            if (watchId !== profileOpenWatch) {
                return;
            }
            if (document.querySelector(".aurora-settings-modal.is-open")) {
                log("profile_open_end", { ms: Date.now() - startTs });
                logOverlayState();
                return;
            }
            attempts += 1;
            if (attempts < 120) {
                global.setTimeout(poll, 50);
            }
        })();
    }

    new MutationObserver(function auroraDiagMutationAggregate(records) {
        mutationCallbacksBucket += 1;
        mutationRecordsBucket += records.length;
    }).observe(document.documentElement, { childList: true, subtree: true });

    global.setInterval(function auroraDiagMutationWindow() {
        mutationCallbacksLastSecond = mutationCallbacksBucket;
        mutationRecordsLastSecond = mutationRecordsBucket;
        mutationCallbacksBucket = 0;
        mutationRecordsBucket = 0;
    }, 1000);

    global.setInterval(function auroraDiagHeartbeat() {
        const supportDiag = global.__auroraSupportDiag || {};
        log("heartbeat", {
            case_changed_last_second: caseChangedLastSecond,
            mutations_last_second: mutationCallbacksLastSecond,
            mutation_records_last_second: mutationRecordsLastSecond,
            support_refresh_active: supportRefreshActive,
            hooks_installed: hooksInstalled,
            support_mount_count: supportDiag.mountLastSec || 0,
            support_badge_update_count: supportDiag.badgeLastSec || 0
        });
        if (supportDiag) {
            supportDiag.mountLastSec = 0;
            supportDiag.badgeLastSec = 0;
        }
        caseChangedLastSecond = 0;
    }, 1000);

    global.addEventListener(
        "error",
        function auroraDiagError(event) {
            log("js_error", {
                message: String(event.message || "error"),
                source: String(event.filename || "").split("/").pop(),
                line: event.lineno || 0,
                col: event.colno || 0
            });
        },
        true
    );

    global.addEventListener("unhandledrejection", function auroraDiagRejection(event) {
        log("unhandled_rejection", {
            message: String(event.reason && event.reason.message ? event.reason.message : event.reason)
        });
    });

    document.addEventListener(
        "click",
        function auroraDiagClick(event) {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) {
                return;
            }
            if (target.closest("[data-user-menu]")) {
                const startTs = Date.now();
                log("profile_click");
                log("profile_open_start");
                logOverlayState();
                watchProfileOpenEnd(startTs);
                return;
            }
            if (target.closest("[data-support-messages]")) {
                log("support_button_click");
                logOverlayState();
            }
        },
        true
    );

    function wrapAsync(name, fn) {
        if (typeof fn !== "function" || fn.__auroraDiagWrapped) {
            return fn;
        }
        const wrapped = function auroraDiagWrapped() {
            if (name === "open_native_support") {
                log("open_native_support_start");
                logOverlayState();
            }
            if (name === "support_rpc") {
                supportRefreshActive = true;
                log("support_rpc_start", { markRead: Boolean(arguments[0]) });
            }
            try {
                const result = fn.apply(this, arguments);
                if (result && typeof result.then === "function") {
                    return result.then(
                        function auroraDiagOk(value) {
                            finish(name, null);
                            return value;
                        },
                        function auroraDiagFail(reason) {
                            finish(name, reason);
                            throw reason;
                        }
                    );
                }
                finish(name, null);
                return result;
            } catch (error) {
                finish(name, error);
                throw error;
            }
        };
        wrapped.__auroraDiagWrapped = true;
        return wrapped;

        function finish(kind, error) {
            if (kind === "open_native_support") {
                log("open_native_support_end", {
                    ok: !error,
                    message: error ? String(error.message || error) : undefined
                });
                logOverlayState();
            }
            if (kind === "support_rpc") {
                supportRefreshActive = false;
                log("support_rpc_end", {
                    ok: !error,
                    message: error ? String(error.message || error) : undefined
                });
            }
        }
    }

    function installHooks() {
        if (global.AuroraOpenSupport && !global.AuroraOpenSupport.__auroraDiagWrapped) {
            global.AuroraOpenSupport = wrapAsync("open_native_support", global.AuroraOpenSupport);
        }
        if (global.AuroraSupport && global.AuroraSupport.refresh && !global.AuroraSupport.refresh.__auroraDiagWrapped) {
            global.AuroraSupport.refresh = wrapAsync("support_rpc", global.AuroraSupport.refresh);
        }
        if (global.auroraRuntime && global.auroraRuntime.emit && !global.auroraRuntime.emit.__auroraDiagWrapped) {
            const runtime = global.auroraRuntime;
            const originalEmit = runtime.emit.bind(runtime);
            runtime.emit = function auroraDiagEmit(name) {
                if (name === "case_changed") {
                    caseChangedLastSecond += 1;
                }
                return originalEmit.apply(runtime, arguments);
            };
            runtime.emit.__auroraDiagWrapped = true;
        }
        hooksInstalled = Boolean(
            global.AuroraOpenSupport && global.AuroraOpenSupport.__auroraDiagWrapped
        );
        return hooksInstalled;
    }

    let hookAttempts = 0;
    const hookTimer = global.setInterval(function auroraDiagInstallHooks() {
        hookAttempts += 1;
        if (installHooks() || hookAttempts > 120) {
            global.clearInterval(hookTimer);
        }
    }, 250);

    global.addEventListener("load", function auroraDiagLoad() {
        installHooks();
        log("app_ready", { phase: "window_load" });
    });

    global.__auroraUiDiagLog = function auroraUiDiagLog(event, details) {
        log(event, details || {});
    };

    log("app_ready", { phase: "boot" });
})(window);

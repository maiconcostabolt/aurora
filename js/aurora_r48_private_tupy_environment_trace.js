(function (global) {
"use strict";

const BUILD = "AURORA V47 RC1 R60 COMMERCIAL DIAG UI REMOVAL";
const KEY = "aurora_diag_r47_offline_auth_boot_core_cache_trace_v1";
const MAX_EVENTS = 72;
const MAX_BYTES = 48 * 1024;
let events = [];

function clean(value, depth) {
    if (depth > 3) return "[LIMITE]";
    if (value == null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") {
        if (/^data:|base64,/i.test(value) || value.length > 1600) return `[CONTEUDO_OMITIDO:${value.length}]`;
        return value.slice(0, 1600);
    }
    if (Array.isArray(value)) return value.slice(0, 30).map((item) => clean(item, depth + 1));
    if (typeof value === "object") {
        const result = {};
        Object.keys(value).slice(0, 40).forEach((key) => {
            if (/token|password|secret|photo|image|blob|base64|report|case|evidence/i.test(key)) {
                result[key] = "[CONTEUDO_OMITIDO]";
            } else {
                result[key] = clean(value[key], depth + 1);
            }
        });
        return result;
    }
    return String(value).slice(0, 300);
}

function load() {
    try {
        const parsed = JSON.parse(global.localStorage.getItem(KEY) || "[]");
        events = Array.isArray(parsed) ? parsed.slice(-MAX_EVENTS) : [];
    } catch (_) {
        events = [];
    }
}

function save() {
    try {
        let serialized = JSON.stringify(events.slice(-MAX_EVENTS));
        while (serialized.length > MAX_BYTES && events.length > 8) {
            events.shift();
            serialized = JSON.stringify(events);
        }
        global.localStorage.setItem(KEY, serialized);
    } catch (_) {
        events = events.slice(-12);
        try { global.sessionStorage.setItem(KEY, JSON.stringify(events)); } catch (__) {}
    }
}

function authSnapshot() {
    let resolvedUserId = "";
    try {
        resolvedUserId = typeof global.resolveLoggedInUserId === "function"
            ? String(global.resolveLoggedInUserId() || "")
            : "";
    } catch (_) {
        resolvedUserId = "[ERRO_AO_LER]";
    }
    return {
        aurora_auth_ready_exists: Boolean(global.AuroraAuthReady),
        aurora_auth_ready_type: typeof global.AuroraAuthReady,
        aurora_auth_ready_thenable: Boolean(global.AuroraAuthReady && typeof global.AuroraAuthReady.then === "function"),
        account_uid_present: Boolean(String(global.AURORA_ACCOUNT_USER_ID || "").trim()),
        account_uid: String(global.AURORA_ACCOUNT_USER_ID || "").trim(),
        resolve_logged_in_user_id_present: typeof global.resolveLoggedInUserId === "function",
        resolved_logged_in_uid: resolvedUserId
    };
}

function mark(event, data, phase) {
    try {
        const previous = events.length ? events[events.length - 1] : null;
        const entry = {
            number: previous ? Number(previous.number || 0) + 1 : 1,
            timestamp: new Date().toISOString(),
            online: navigator.onLine,
            event: String(event || "").slice(0, 100),
            phase: String(phase || "runtime").slice(0, 100),
            auth: authSnapshot(),
            data: clean(data || {}, 0)
        };
        events.push(entry);
        if (events.length > MAX_EVENTS) events.shift();
        save();
        render();
        return entry;
    } catch (_) {
        return null;
    }
}

function dump() {
    return [
        "R52 OFFLINE ATOMIC RUNTIME DEPENDENCY CHAIN TRACE",
        `TRACE_BUILD: ${BUILD}`,
        `RUNTIME_BUILD: ${String(global.AURORA_RUNTIME_CONFIG && global.AURORA_RUNTIME_CONFIG.app && global.AURORA_RUNTIME_CONFIG.app.build_id || "[AUSENTE]")}`,
        `BOOTSTRAP_BUILD: ${String(global.__AURORA_BOOTSTRAP_BUILD__ || "[AUSENTE]")}`,
        `URL: ${location.href}`,
        `REDE: ${navigator.onLine ? "ONLINE" : "OFFLINE"}`,
        `TIMESTAMP: ${new Date().toISOString()}`,
        `EVENTOS: ${events.length}/${MAX_EVENTS}`,
        "",
        JSON.stringify(events, null, 2)
    ].join("\n");
}

async function copyAll() {
    const value = dump();
    try {
        await navigator.clipboard.writeText(value);
    } catch (_) {
        const area = document.createElement("textarea");
        area.value = value;
        area.style.cssText = "position:fixed;inset:12px;z-index:2147483647";
        document.body.appendChild(area);
        area.select();
        try { document.execCommand("copy"); } catch (__) {}
        area.remove();
    }
    try { global.alert("Diagnóstico R52 copiado. Envie o texto completo para análise."); } catch (_) {}
}

function render() {
    try {
        const output = document.getElementById("aurora-r46-diag-output");
        if (output) output.textContent = dump();
    } catch (_) {}
}

function ensureStyle() {
    if (!document.head || document.getElementById("aurora-r46-diag-style")) return;
    const style = document.createElement("style");
    style.id = "aurora-r46-diag-style";
    style.textContent = "#aurora-r46-diag-button{position:fixed;right:8px;bottom:76px;z-index:2147483000;padding:6px 9px;border:1px solid #61d9ff;border-radius:12px;background:#081424;color:#fff;font:700 11px system-ui}#aurora-r46-diag-panel{position:fixed;inset:auto 8px 112px auto;z-index:2147483001;width:min(92vw,560px);max-height:68vh;display:none;flex-direction:column;padding:10px;border:1px solid #61d9ff;border-radius:14px;background:#07111f;color:#f4f8ff;box-shadow:0 12px 40px #0009;font:12px system-ui}#aurora-r46-diag-panel.is-open{display:flex}#aurora-r46-diag-panel header{display:flex;gap:7px;align-items:center;flex-wrap:wrap}#aurora-r46-diag-panel button{padding:7px 9px;border:0;border-radius:9px;font-weight:700}#aurora-r46-diag-output{overflow:auto;white-space:pre-wrap;word-break:break-word;margin:8px 0 0;font:10px ui-monospace,monospace}";
    document.head.appendChild(style);
}

function mountButton(options) {
    try {
        if (!document.body) return;
        ensureStyle();
        document.getElementById("aurora-r46-diag-button")?.remove();
        document.getElementById("aurora-r46-diag-panel")?.remove();
        const button = document.createElement("button");
        const panel = document.createElement("section");
        button.id = "aurora-r46-diag-button";
        button.type = "button";
        button.textContent = options && options.fallback ? "DIAGNÓSTICO" : "DIAG R52";
        panel.id = "aurora-r46-diag-panel";
        panel.innerHTML = '<header><strong>R52 — cadeia atômica do runtime</strong><button type="button" data-copy>COPIAR TUDO</button><button type="button" data-close>FECHAR</button></header><pre id="aurora-r46-diag-output"></pre>';
        document.body.append(button, panel);
        button.addEventListener("click", () => { panel.classList.add("is-open"); render(); });
        panel.querySelector("[data-copy]").addEventListener("click", copyAll);
        panel.querySelector("[data-close]").addEventListener("click", () => panel.classList.remove("is-open"));
    } catch (_) {}
}

async function observeServiceWorker() {
    try {
        if (!("serviceWorker" in navigator)) {
            mark("SERVICE_WORKER_STATE", { supported: false }, "service-worker");
            return;
        }
        const registration = await navigator.serviceWorker.getRegistration();
        const worker = (item) => item ? { scriptURL: item.scriptURL || "", state: item.state || "" } : null;
        let cacheNames = [];
        try {
            cacheNames = (await caches.keys()).filter((name) => /aurora|vistoria/i.test(name));
        } catch (_) {}
        mark("SERVICE_WORKER_STATE", {
            supported: true,
            controller: worker(navigator.serviceWorker.controller),
            registration_present: Boolean(registration),
            scope: registration && registration.scope || "",
            installing: worker(registration && registration.installing),
            waiting: worker(registration && registration.waiting),
            active: worker(registration && registration.active),
            aurora_cache_names: cacheNames,
            installer_error: String(global.__AURORA_SW_TRACE_ERROR || "")
        }, "service-worker");
        ["installing", "waiting", "active"].forEach((slot) => {
            const current = registration && registration[slot];
            if (!current) return;
            try {
                current.addEventListener("statechange", () => mark("SERVICE_WORKER_STATE_CHANGE", {
                    slot,
                    scriptURL: current.scriptURL || "",
                    state: current.state || ""
                }, "service-worker"));
                current.addEventListener("error", (event) => mark("SERVICE_WORKER_WORKER_ERROR", {
                    slot,
                    scriptURL: current.scriptURL || "",
                    state: current.state || "",
                    message: event && event.message || ""
                }, "service-worker"));
            } catch (_) {}
        });
        if (navigator.serviceWorker.controller) {
            try { navigator.serviceWorker.controller.postMessage({ type: "AURORA_TRACE_SW_IDENTITY" }); } catch (_) {}
        }
        Promise.resolve(navigator.serviceWorker.ready).then(
            (readyRegistration) => mark("SERVICE_WORKER_READY", {
                scope: readyRegistration && readyRegistration.scope || "",
                active: worker(readyRegistration && readyRegistration.active)
            }, "service-worker"),
            (error) => mark("SERVICE_WORKER_READY_ERROR", { name: error && error.name, message: error && error.message }, "service-worker")
        );
    } catch (error) {
        mark("SERVICE_WORKER_ERROR", { name: error && error.name, message: error && error.message }, "service-worker");
    }
}

load();
mark("TRACE_R45_LOADED", { trace_build: BUILD }, "pre-bootstrap");
global.addEventListener("error", (event) => mark("WINDOW_ERROR", { name: event.error && event.error.name, message: event.message, stack: event.error && event.error.stack }, "window"));
global.addEventListener("unhandledrejection", (event) => mark("UNHANDLED_REJECTION", { name: event.reason && event.reason.name, message: event.reason && event.reason.message || event.reason, stack: event.reason && event.reason.stack }, "promise"));
global.addEventListener("aurora:sw-trace", (event) => mark("SERVICE_WORKER_INSTALLER", event && event.detail || {}, "service-worker"));
navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data && event.data.type === "AURORA_TRACE_SW_IDENTITY_REPLY") mark("SERVICE_WORKER_IDENTITY", event.data, "service-worker");
});
// R60 commercial cleanup: keep the R52 runtime/service-worker trace available internally,
// but do not mount its temporary diagnostic button/panel in the product UI.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { observeServiceWorker(); }, { once: true });
else { observeServiceWorker(); }

const api = { BUILD, mark, dump, copyAll, authSnapshot, observeServiceWorker, mountFallbackButton: () => null };
global.AuroraR47ColdStartTrace = api;
global.AuroraR44ModuleTrace = api;
})(typeof window !== "undefined" ? window : globalThis);

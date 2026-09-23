(function (global) {
"use strict";

const HOME_RETURN_TRACE_BUILD = "HOME_RETURN_TRACE_2";
const MAX_EVENTS = 20;
const REPORTS_KEY = "aurora_reports";
const CURRENT_CASE_KEY = "aurora_v2_current_case";

const events = [];
let nextHomeOrigin = "UNKNOWN";
let nextHomeReason = "";
let lastHomeOrigin = "UNKNOWN";
let lastHomeReason = "";
let activeAuroraViewRef = "home";

function setActiveAuroraView(view) {
    activeAuroraViewRef = String(view || "home");
}

function getActiveAuroraView() {
    return activeAuroraViewRef;
}

function nowIso() {
    return new Date().toISOString();
}

function shortTime(iso) {
    const value = String(iso || "");
    const match = value.match(/T(\d{2}:\d{2}:\d{2})/);
    return match ? match[1] : value.slice(11, 19) || value;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function shortStack(depth) {
    try {
        const stack = new Error().stack || "";
        return stack
            .split(/\r?\n/)
            .slice(2, 2 + (depth || 3))
            .map((line) => line.trim())
            .join(" | ");
    } catch (error) {
        return "";
    }
}

function caseIdFrom(data) {
    return data && data.id != null ? String(data.id) : "";
}

function runtimeCaseSnapshot() {
    const runtime = global.auroraRuntime;
    if (!runtime || typeof runtime.getCase !== "function") {
        return { exists: false, id: "", index: null };
    }

    const caseData = runtime.getCase();
    return {
        exists: Boolean(caseData && caseData.id),
        id: caseIdFrom(caseData),
        index: Number.isFinite(runtime.currentIndex) ? runtime.currentIndex : null,
        status: caseData && caseData.status != null ? String(caseData.status) : "",
        service:
            caseData &&
            caseData.service &&
            caseData.service.id != null
                ? String(caseData.service.id)
                : ""
    };
}

function repositoryCaseSnapshot() {
    const repo = global.auroraRepository;
    if (!repo || typeof repo.load !== "function") {
        return { exists: false, id: "" };
    }

    const envelope = repo.load();
    const caseData = envelope && envelope.case ? envelope.case : null;
    return {
        exists: Boolean(caseData && caseData.id),
        id: caseIdFrom(caseData)
    };
}

function getHomeOpenCount() {
    try {
        const raw = localStorage.getItem(REPORTS_KEY);
        const reports = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(reports)) {
            return 0;
        }
        return reports.filter((item) => item && item.status !== "Concluído").length;
    } catch (error) {
        return 0;
    }
}

function summarizeHistoryState(state) {
    if (!state || typeof state !== "object") {
        return "(empty)";
    }

    return Object.keys(state)
        .map((key) => `${key}=${String(state[key])}`)
        .join(",") || "(object)";
}

function pushEvent(label, lines) {
    events.push({
        label: String(label || "EVENT"),
        at: nowIso(),
        lines: Array.isArray(lines) ? lines.slice() : [String(lines || "")]
    });

    while (events.length > MAX_EVENTS) {
        events.shift();
    }

    scheduleRender();
}

function logGeneric(label, details) {
    const lines = [];

    Object.keys(details || {}).forEach((key) => {
        const value = details[key];
        if (value == null || value === "") {
            return;
        }
        lines.push(`${key}=${String(value)}`);
    });

    pushEvent(label, lines);
}

function setNextHomeOrigin(origin, reason) {
    nextHomeOrigin = String(origin || "UNKNOWN");
    nextHomeReason = reason != null ? String(reason) : "";
}

function peekNextHomeOrigin() {
    return nextHomeOrigin || "UNKNOWN";
}

function consumeNextHomeOrigin() {
    const origin = nextHomeOrigin || "UNKNOWN";
    const reason = nextHomeReason || "";
    nextHomeOrigin = "UNKNOWN";
    nextHomeReason = "";
    lastHomeOrigin = origin;
    lastHomeReason = reason;
    return { origin, reason };
}

function getLastHomeOrigin() {
    return {
        origin: lastHomeOrigin || "UNKNOWN",
        reason: lastHomeReason || ""
    };
}

function logHR0(details) {
    logGeneric("HR0 NEW INSPECTION", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function logHR1(details) {
    logGeneric("HR1 CASE CREATED", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function logHR2(details) {
    logGeneric("HR2 STEP OPENED", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function logHR3(details) {
    logGeneric("HR3 CASE PERSISTED", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function logHR4(details) {
    logGeneric("HR4 CASE_CHANGED", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function logHR5(details) {
    logGeneric("HR5 AUTH/ACCOUNT", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function logHR6(details) {
    const payload = Object.assign({ ts: shortTime(nowIso()) }, details);
    if (payload.reason) {
        lastHomeReason = String(payload.reason);
    }
    if (payload.origin) {
        lastHomeOrigin = String(payload.origin);
    }
    logGeneric("HR6 HOME REQUEST", payload);
}

function logHR7(details) {
    logGeneric("HR7 CASE MUTATION", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function logHR8(details) {
    logGeneric("HR8 HOME RENDERED", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function logPopstate(details) {
    logGeneric("POPSTATE EVENT", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function logSwControllerChange(details) {
    logGeneric("SW CONTROLLERCHANGE", Object.assign({ ts: shortTime(nowIso()) }, details));
}

function renderSectionHtml() {
    const rows = events.length
        ? events
              .map((entry) => {
                  const body = entry.lines
                      .map((line) => escapeHTML(line))
                      .join("<br>");
                  return [
                      '<div class="aurora-home-return-trace__row">',
                      `<strong>${escapeHTML(entry.label)}</strong>`,
                      `<div class="aurora-home-return-trace__meta">${escapeHTML(shortTime(entry.at))}</div>`,
                      `<div class="aurora-home-return-trace__body">${body}</div>`,
                      "</div>"
                  ].join("");
              })
              .join("")
        : '<div class="aurora-home-return-trace__row">Nenhum evento capturado.</div>';

    return [
        '<section class="aurora-bug-a-runtime-trace__section aurora-home-return-trace" data-trace-section="HOME_RETURN">',
        "<h3>HOME RETURN TRACE</h3>",
        `<div class="aurora-home-return-trace__header">HOME_RETURN_TRACE: ${HOME_RETURN_TRACE_BUILD}</div>`,
        `<div class="aurora-home-return-trace__hint">homeOpenCount=aurora_reports (nao prova current case)</div>`,
        rows,
        "</section>"
    ].join("");
}

function ensureStyles() {
    if (document.getElementById("aurora-home-return-trace-style")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "aurora-home-return-trace-style";
    style.textContent = [
        ".aurora-home-return-trace__header{color:#fbbf24;font-size:10px;margin:0 0 4px;}",
        ".aurora-home-return-trace__hint{color:#9ca3af;font-size:10px;margin:0 0 6px;}",
        ".aurora-home-return-trace__row{margin:0 0 6px;padding:6px;background:#111827;",
        "border-left:3px solid #38bdf8;white-space:normal;word-break:break-word;}",
        ".aurora-home-return-trace__meta{color:#9ca3af;font-size:10px;margin:2px 0;}",
        ".aurora-home-return-trace__body{font-size:10px;line-height:1.35;}"
    ].join("");
    document.head.appendChild(style);
}

let renderScheduled = false;

function scheduleRender() {
    if (renderScheduled) {
        return;
    }

    renderScheduled = true;

    const run = () => {
        renderScheduled = false;
        ensureStyles();

        if (
            global.AuroraBugARuntimeTrace &&
            typeof global.AuroraBugARuntimeTrace.renderPanel === "function"
        ) {
            global.AuroraBugARuntimeTrace.renderPanel();
            return;
        }

        const host = document.querySelector("[data-home-return-trace-host]");
        if (host) {
            host.innerHTML = renderSectionHtml();
        }
    };

    if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(run);
    } else {
        setTimeout(run, 0);
    }
}

global.AuroraHomeReturnTrace = {
    BUILD: HOME_RETURN_TRACE_BUILD,
    setNextHomeOrigin,
    peekNextHomeOrigin,
    setActiveAuroraView,
    getActiveAuroraView,
    consumeNextHomeOrigin,
    getLastHomeOrigin,
    runtimeCaseSnapshot,
    repositoryCaseSnapshot,
    getHomeOpenCount,
    summarizeHistoryState,
    shortStack,
    logHR0,
    logHR1,
    logHR2,
    logHR3,
    logHR4,
    logHR5,
    logHR6,
    logHR7,
    logHR8,
    logPopstate,
    logSwControllerChange,
    renderSectionHtml,
    getEvents() {
        return JSON.parse(JSON.stringify(events));
    }
};

})(window);

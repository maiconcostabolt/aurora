(function (global) {
"use strict";

const DEBUG_BUILD = "BUG_A_RUNTIME_TRACE_1";
const EVIDENCE_FIX = "LIVE_DEDUPE_BY_ID";
const FINALIZE_TRACE_BUILD = "BUG_A_FINALIZE_TRACE_2";
const DEBUG_PANEL_BUILD = "BUG_A_DEBUG_PANEL_TOP_1";
const DEBUG_PANEL_VISIBLE = false;

const LABELS = {
    A: "[A] HUB",
    B: "[B] BUILD PATCH",
    C: "[C] CASE AFTER PERSIST",
    D: "[D] CASE AFTER SAVE",
    E: "[E] DIAGNOSTIC CONTEXT"
};

const FINALIZE_LABELS = {
    F0: "F0 CLICK",
    F1: "F1 GROUP",
    F2: "F2 SAVED_AT",
    F3: "F3 SAVE SUCCESS",
    FERR: "FERR ERROR",
    FEND: "FEND CLOSED",
    EARLY_RETURN: "EARLY RETURN"
};

const FINALIZE_ORDER = [
    "F0",
    "F1",
    "F2",
    "F3",
    "FERR",
    "FEND",
    "EARLY_RETURN"
];

const snapshots = {};
const finalizeTrace = {};

function isGuided(group) {
    return Boolean(
        group &&
            group.record_kind === "vehicle_guided_photo"
    );
}

function summarizeGroups(groups) {
    const list = Array.isArray(groups) ? groups : [];

    return {
        total: list.length,
        technical: list.filter((group) => group && !isGuided(group)).length,
        guided: list.filter((group) => isGuided(group)).length,
        groups: list.map((group) => ({
            id: group && group.id != null ? String(group.id) : "",
            title: group && group.title != null ? String(group.title) : "",
            item: group && group.item != null ? String(group.item) : "",
            record_kind:
                group && group.record_kind != null
                    ? String(group.record_kind)
                    : "null",
            vehicle_photo_slot:
                group && group.vehicle_photo_slot != null
                    ? String(group.vehicle_photo_slot)
                    : "null",
            saved_at:
                group && group.saved_at != null
                    ? String(group.saved_at)
                    : "null"
        }))
    };
}

function ensureFinalizeTraceEntry(key) {
    if (!finalizeTrace[key]) {
        finalizeTrace[key] = {
            status: "WAIT",
            captured_at: "",
            details: ""
        };
    }
}

function initFinalizeTrace() {
    FINALIZE_ORDER.forEach((key) => {
        ensureFinalizeTraceEntry(key);
    });
}

function formatFinalizeDetails(details) {
    if (details == null) {
        return "";
    }

    if (typeof details === "string") {
        return details;
    }

    return Object.entries(details)
        .map(([key, value]) => {
            const rendered =
                value == null
                    ? "null"
                    : String(value);

            return `${key}=${rendered}`;
        })
        .join("\n");
}

function resetFinalizeTraceAfter(step) {
    initFinalizeTrace();

    const index = FINALIZE_ORDER.indexOf(step);

    FINALIZE_ORDER.forEach((key, keyIndex) => {
        if (keyIndex > index) {
            finalizeTrace[key] = {
                status: "WAIT",
                captured_at: "",
                details: ""
            };
        }
    });
}

function ensurePanel() {
    if (!DEBUG_PANEL_VISIBLE) {
        return null;
    }

    let panel = document.getElementById("aurora-bug-a-runtime-trace");

    if (panel) {
        return panel;
    }

    panel = document.createElement("aside");
    panel.id = "aurora-bug-a-runtime-trace";
    panel.setAttribute("aria-label", "Aurora debug evidence pipeline");
    panel.innerHTML = [
        '<header class="aurora-bug-a-runtime-trace__header">',
        "<strong>AURORA DEBUG — EVIDENCE PIPELINE</strong>",
        `<small>DEBUG_BUILD: ${DEBUG_BUILD}</small>`,
        `<small>EVIDENCE_FIX: ${EVIDENCE_FIX}</small>`,
        `<small>FINALIZE_TRACE: ${FINALIZE_TRACE_BUILD}</small>`,
        `<small>DEBUG_PANEL: ${DEBUG_PANEL_BUILD}</small>`,
        "</header>",
        '<div class="aurora-bug-a-runtime-trace__body" data-trace-body></div>'
    ].join("");

    if (!document.getElementById("aurora-bug-a-runtime-trace-style")) {
        const style = document.createElement("style");
        style.id = "aurora-bug-a-runtime-trace-style";
        style.textContent = [
            "#aurora-bug-a-runtime-trace{",
            "position:fixed;top:8px;right:8px;bottom:auto;z-index:99999;",
            "width:min(320px,calc(100vw - 16px));max-height:min(45vh,480px);",
            "overflow:auto;background:#111827;color:#f9fafb;",
            "border:2px solid #f59e0b;border-radius:10px;",
            "font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;",
            "box-shadow:0 8px 24px rgba(0,0,0,.35);",
            "}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__header{",
            "position:sticky;top:0;background:#1f2937;padding:8px 10px;",
            "border-bottom:1px solid #374151;display:grid;gap:2px;",
            "}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__body{padding:8px 10px;}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__section{",
            "margin:0 0 10px;padding:8px;background:#0f172a;border:1px solid #334155;border-radius:6px;",
            "}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__section h3{",
            "margin:0 0 6px;font-size:11px;color:#fbbf24;",
            "}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__counts{margin:0 0 6px;}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__group{",
            "margin:0 0 6px;padding:6px;background:#111827;border-left:3px solid #64748b;",
            "white-space:pre-wrap;word-break:break-word;",
            "}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__meta{",
            "color:#9ca3af;font-size:10px;margin-top:2px;",
            "}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__finalize-row{",
            "margin:0 0 8px;padding:6px;background:#111827;border-left:3px solid #64748b;",
            "}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__finalize-row.is-pass{border-left-color:#22c55e;}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__finalize-row.is-wait{border-left-color:#64748b;}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__finalize-row.is-error{border-left-color:#ef4444;}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__status{",
            "display:inline-block;margin-right:6px;padding:1px 6px;border-radius:999px;",
            "font-size:10px;font-weight:700;letter-spacing:.04em;",
            "}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__status.is-pass{background:#14532d;color:#bbf7d0;}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__status.is-wait{background:#1f2937;color:#cbd5e1;}",
            "#aurora-bug-a-runtime-trace .aurora-bug-a-runtime-trace__status.is-error{background:#7f1d1d;color:#fecaca;}"
        ].join("");
        document.head.appendChild(style);
    }

    document.body.appendChild(panel);
    return panel;
}

function renderSection(key, snapshot) {
    const title = LABELS[key] || key;
    const groupsHtml = snapshot.groups.length
        ? snapshot.groups
              .map(
                  (group) =>
                      [
                          '<div class="aurora-bug-a-runtime-trace__group">',
                          `id=${group.id}`,
                          `\ntitle=${group.title}`,
                          `\nitem=${group.item}`,
                          `\nrecord_kind=${group.record_kind}`,
                          `\nvehicle_photo_slot=${group.vehicle_photo_slot}`,
                          `\nsaved_at=${group.saved_at}`,
                          "</div>"
                      ].join("")
              )
              .join("")
        : '<div class="aurora-bug-a-runtime-trace__group">(nenhum grupo)</div>';

    return [
        `<section class="aurora-bug-a-runtime-trace__section" data-trace-section="${key}">`,
        `<h3>${title}</h3>`,
        `<div class="aurora-bug-a-runtime-trace__counts">TOTAL = ${snapshot.total}<br>TECHNICAL = ${snapshot.technical}<br>GUIDED = ${snapshot.guided}</div>`,
        `<div class="aurora-bug-a-runtime-trace__meta">${snapshot.captured_at || ""}${snapshot.note ? `<br>${snapshot.note}` : ""}</div>`,
        groupsHtml,
        "</section>"
    ].join("");
}

function renderFinalizeSection() {
    initFinalizeTrace();

    const rows = FINALIZE_ORDER.map((key) => {
        const entry = finalizeTrace[key] || {
            status: "WAIT",
            captured_at: "",
            details: ""
        };
        const status = entry.status || "WAIT";
        const statusClass =
            status === "PASS"
                ? "is-pass"
                : status === "ERROR"
                  ? "is-error"
                  : "is-wait";

        return [
            `<div class="aurora-bug-a-runtime-trace__finalize-row ${statusClass}" data-finalize-step="${key}">`,
            `<strong>${FINALIZE_LABELS[key] || key}</strong> `,
            `<span class="aurora-bug-a-runtime-trace__status ${statusClass}">${status}</span>`,
            entry.captured_at
                ? `<div class="aurora-bug-a-runtime-trace__meta">${entry.captured_at}</div>`
                : "",
            entry.details
                ? `<div class="aurora-bug-a-runtime-trace__group">${escapeHTML(entry.details)}</div>`
                : "",
            "</div>"
        ].join("");
    }).join("");

    return [
        '<section class="aurora-bug-a-runtime-trace__section" data-trace-section="FINALIZE">',
        "<h3>FINALIZE TRACE</h3>",
        rows,
        "</section>"
    ].join("");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderPanel() {
    if (!DEBUG_PANEL_VISIBLE) {
        return;
    }

    const panel = ensurePanel();
    if (!panel) {
        return;
    }

    const body = panel.querySelector("[data-trace-body]");

    if (!body) {
        return;
    }

    const homeReturnSection =
        global.AuroraHomeReturnTrace &&
        typeof global.AuroraHomeReturnTrace.renderSectionHtml === "function"
            ? global.AuroraHomeReturnTrace.renderSectionHtml()
            : "";

    body.innerHTML = [homeReturnSection]
        .concat(
            ["A", "B", "C", "D", "E"].map((key) =>
                snapshots[key]
                    ? renderSection(key, snapshots[key])
                    : [
                          `<section class="aurora-bug-a-runtime-trace__section" data-trace-section="${key}">`,
                          `<h3>${LABELS[key]}</h3>`,
                          '<div class="aurora-bug-a-runtime-trace__counts">TOTAL = —<br>TECHNICAL = —<br>GUIDED = —</div>',
                          '<div class="aurora-bug-a-runtime-trace__group">(aguardando captura)</div>',
                          "</section>"
                      ].join("")
            )
        )
        .concat(renderFinalizeSection())
        .join("");
}

let initialHomeReturnPanelDone = false;

function ensureInitialHomeReturnPanel() {
    if (!DEBUG_PANEL_VISIBLE) {
        return;
    }

    if (initialHomeReturnPanelDone) {
        return;
    }

    if (
        !global.AuroraHomeReturnTrace ||
        typeof global.AuroraHomeReturnTrace.renderSectionHtml !== "function"
    ) {
        return;
    }

    if (!document.body) {
        if (typeof document.addEventListener === "function") {
            document.addEventListener(
                "DOMContentLoaded",
                ensureInitialHomeReturnPanel,
                { once: true }
            );
        }

        return;
    }

    initialHomeReturnPanelDone = true;
    renderPanel();
}

function capture(key, groups, options = {}) {
    if (!key) {
        return null;
    }

    snapshots[String(key).toUpperCase()] = Object.assign(
        summarizeGroups(groups),
        {
            captured_at: new Date().toISOString(),
            note: options.note || ""
        }
    );

    if (document.body) {
        renderPanel();
    } else if (typeof document.addEventListener === "function") {
        document.addEventListener(
            "DOMContentLoaded",
            renderPanel,
            { once: true }
        );
    }

    return snapshots[String(key).toUpperCase()];
}

function captureFinalize(step, options = {}) {
    const key = String(step || "").toUpperCase();

    if (!key || !FINALIZE_LABELS[key]) {
        return null;
    }

    initFinalizeTrace();

    if (key === "F0") {
        resetFinalizeTraceAfter("F0");
    }

    finalizeTrace[key] = {
        status:
            options.status === "ERROR" ||
            options.status === "PASS" ||
            options.status === "WAIT"
                ? options.status
                : "PASS",
        captured_at: new Date().toISOString(),
        details: formatFinalizeDetails(
            options.details != null
                ? options.details
                : options
        )
    };

    if (document.body) {
        renderPanel();
    } else if (typeof document.addEventListener === "function") {
        document.addEventListener(
            "DOMContentLoaded",
            renderPanel,
            { once: true }
        );
    }

    return finalizeTrace[key];
}

function captureCase(key, runtime, options = {}) {
    const caseData =
        runtime &&
        typeof runtime.getCase === "function"
            ? runtime.getCase()
            : null;

    return capture(
        key,
        caseData && Array.isArray(caseData.evidence_groups)
            ? caseData.evidence_groups
            : [],
        options
    );
}

initFinalizeTrace();

global.AuroraBugARuntimeTrace = {
    DEBUG_BUILD,
    EVIDENCE_FIX,
    FINALIZE_TRACE_BUILD,
    DEBUG_PANEL_BUILD,
    capture,
    captureCase,
    captureFinalize,
    renderPanel,
    ensureInitialHomeReturnPanel,
    getSnapshots() {
        return JSON.parse(JSON.stringify(snapshots));
    },
    getFinalizeTrace() {
        return JSON.parse(JSON.stringify(finalizeTrace));
    }
};

ensureInitialHomeReturnPanel();

})(window);

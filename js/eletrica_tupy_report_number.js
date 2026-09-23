/**
 * DEMO / INTERIM — Número do relatório (ADMIN) por projeto.
 * Mesmo nível de persistência dos pedidos: localStorage neste aparelho.
 * NÃO é fonte de verdade na nuvem.
 *
 * localStorage key: aurora_aet_admin_report_number_v1
 * shape: { [projectId]: "RT-2026-015" }
 */
(function (global) {
"use strict";

var STORAGE_KEY = "aurora_aet_admin_report_number_v1";

function esc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function readMap() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        var parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
        return {};
    }
}

function writeMap(map) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
    } catch (error) { /* ignore quota */ }
}

function get(projectId) {
    var pid = String(projectId || "").trim();
    if (!pid) return "";
    var map = readMap();
    var value = map[pid];
    return value == null ? "" : String(value).trim();
}

function set(projectId, value) {
    var pid = String(projectId || "").trim();
    if (!pid) return "";
    var map = readMap();
    var clean = String(value == null ? "" : value).trim();
    if (clean) map[pid] = clean;
    else delete map[pid];
    writeMap(map);
    return clean;
}

function renderHtml(projectId, value) {
    value = value != null ? String(value) : get(projectId);
    return '<article class="aet-card aet-report-number aet-admin-meta-card" data-aet-report-number data-project-id="' +
        esc(projectId || "") + '">' +
        "<h2>Número do relatório</h2>" +
        '<input type="text" class="aet-report-number__input" data-aet-report-number-input ' +
        'value="' + esc(value) + '" placeholder="Ex.: RT-2026-015" autocomplete="off" maxlength="80">' +
        "</article>";
}

function bind(container, opts) {
    opts = opts || {};
    if (!container) return;
    var root = container.matches && container.matches("[data-aet-report-number]")
        ? container
        : container.querySelector("[data-aet-report-number]");
    if (!root) return;

    var projectId = String(opts.projectId || root.getAttribute("data-project-id") || "").trim();
    var input = root.querySelector("[data-aet-report-number-input]");
    if (!input) return;

    function persist() {
        var v = set(projectId, input.value);
        if (typeof opts.onChange === "function") opts.onChange(v);
    }

    input.addEventListener("change", persist);
    input.addEventListener("blur", persist);
}

global.AuroraEletricaTupyReportNumber = {
    STORAGE_KEY: STORAGE_KEY,
    get: get,
    set: set,
    renderHtml: renderHtml,
    bind: bind
};
})(window);

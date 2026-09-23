(function (global) {
"use strict";

const C = global.AuroraPremiumComponents || {};
const esc = C.esc || ((value) => String(value == null ? "" : value));

function renderChecklistSection(data) {
    const checklist = data.checklist || [];
    const half = Math.ceil(checklist.length / 2);
    const columnA = checklist.slice(0, half);
    const columnB = checklist.slice(half);

    return [
        '<div class="prm-checklist-section">',
        '<div class="prm-checklist-section__head">',
        C.sectionHeader(
            "04",
            "CHECKLIST DE INSPEÇÃO",
            "Verificação técnica dos principais sistemas do veículo"
        ),
        `<span class="prm-checklist-section__count">${checklist.length} itens</span>`,
        "</div>",
        '<div class="prm-checklist-grid">',
        `<div>${columnA.map((item) => C.checklistItem(item.label, item.status)).join("")}</div>`,
        `<div>${columnB.map((item) => C.checklistItem(item.label, item.status)).join("")}</div>`,
        "</div>",
        "</div>"
    ].join("");
}

function renderOccurrencesPage(data, options) {
    const pageNumber = options.pageNumber;
    const totalPages = options.totalPages;
    const chunk = options.chunk || [];
    const showChecklist = Boolean(options.showChecklist);
    const startIndex = Number(options.startIndex || 0);
    const totalOccurrences = (data.occurrences || []).length;
    const pendingRepairs = (data.occurrences || []).filter(
        (item) => item.severity === "reparo"
    ).length;

    const cards = chunk
        .map((occurrence, index) =>
            C.occurrenceCard(
                String(startIndex + index + 1).padStart(2, "0"),
                occurrence
            )
        )
        .join("");

    const emptyState = !chunk.length && showChecklist
        ? '<p class="prm-empty-occurrences">Nenhuma ocorrência registrada nesta vistoria.</p>'
        : "";

    return [
        `<section class="a4-page prm-page prm-page--occurrences" data-premium-page="${pageNumber}">`,
        C.reportHeader(data.company.name, data.meta.reportNumber),
        '<div class="prm-page-body">',
        '<div class="prm-occurrences-head">',
        C.sectionHeader(
            "03",
            "AVARIAS E OCORRÊNCIAS",
            "Registro técnico das ocorrências identificadas durante a inspeção"
        ),
        '<div class="prm-occurrences-head__badges">',
        `<span class="prm-badge prm-badge--neutral">${totalOccurrences} ocorrências</span>`,
        pendingRepairs > 0
            ? `<span class="prm-badge prm-badge--danger">${pendingRepairs} reparo</span>`
            : "",
        "</div>",
        "</div>",
        `<div class="prm-occurrences-list">${emptyState}${cards}</div>`,
        showChecklist ? renderChecklistSection(data) : "",
        "</div>",
        C.reportFooter(pageNumber, totalPages),
        "</section>"
    ].join("");
}

global.AuroraPremiumOccurrencesPage = {
    renderOccurrencesPage,
    renderChecklistSection
};
})(typeof window !== "undefined" ? window : globalThis);

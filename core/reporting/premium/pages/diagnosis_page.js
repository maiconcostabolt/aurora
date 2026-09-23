(function (global) {
"use strict";

const C = global.AuroraPremiumComponents || {};

function renderDiagnosisPage(data, pageNumber, totalPages) {
    const occurrences = data.occurrences || [];
    const checklist = data.checklist || [];
    const occCount = occurrences.length;
    const pendingRepairs = occurrences.filter(
        (item) => item.severity === "reparo"
    ).length;
    const checklistOk = checklist.filter(
        (item) => item.status === "ok"
    ).length;
    const signatureData =
        data.finalization &&
        data.finalization.collectSignature
            ? data.finalization.signatureData
            : "";

    return [
        `<section class="a4-page prm-page prm-page--diagnosis" data-premium-page="${pageNumber}">`,
        C.reportHeader(data.company.name, data.meta.reportNumber),
        '<div class="prm-page-body">',
        C.sectionHeader(
            "05",
            "DIAGNÓSTICO E RECOMENDAÇÃO",
            "Síntese técnica da vistoria e diretrizes de intervenção"
        ),
        '<div class="prm-diagnostic-stats">',
        C.diagnosticStat("Ocorrências registradas", String(occCount)),
        C.diagnosticStat("Reparos necessários", String(pendingRepairs), "warning"),
        C.diagnosticStat(
            "Itens em conformidade",
            `${checklistOk}/${checklist.length || 0}`,
            "success"
        ),
        "</div>",
        '<div class="prm-diagnostic-panels">',
        '<div class="prm-diagnostic-panel prm-diagnostic-panel--summary">',
        "<span>Diagnóstico técnico</span>",
        `<p>${C.esc(data.diagnosis.summary)}</p>`,
        "</div>",
        '<div class="prm-diagnostic-panel prm-diagnostic-panel--recommendation">',
        "<span>Recomendação</span>",
        `<p>${C.esc(data.diagnosis.recommendation)}</p>`,
        "</div>",
        "</div>",
        C.sectionHeader(
            "06",
            "FINALIZAÇÃO",
            "Encerramento da vistoria e registro de assinaturas"
        ),
        '<div class="prm-finalization-status">',
        `<span class="prm-finalization-status__badge">${C.esc(data.finalization.status)}</span>`,
        `<span class="prm-finalization-status__date">${C.esc(data.finalization.signedAt.date)} — ${C.esc(data.finalization.signedAt.time)}</span>`,
        "</div>",
        '<div class="prm-finalization-note">',
        "<span>Observação final</span>",
        `<p>${C.esc(data.finalization.note)}</p>`,
        "</div>",
        '<div class="prm-signatures">',
        C.signatureBlock(
            "Responsável pela vistoria",
            data.inspector.name,
            "Vistoria técnica",
            ""
        ),
        '<div class="prm-signatures__brand">',
        '<span class="prm-signatures__mark"></span>',
        "<strong>AURORA</strong>",
        `<small>${C.esc(data.meta.reportNumber)}</small>`,
        "</div>",
        C.signatureBlock(
            "Cliente",
            data.customer.name,
            "Concordância com o laudo",
            signatureData
        ),
        "</div>",
        "</div>",
        C.reportFooter(pageNumber, totalPages),
        "</section>"
    ].join("");
}

global.AuroraPremiumDiagnosisPage = {
    renderDiagnosisPage
};
})(typeof window !== "undefined" ? window : globalThis);

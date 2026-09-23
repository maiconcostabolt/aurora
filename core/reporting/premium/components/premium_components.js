(function (global) {
"use strict";

const esc = (value) =>
    (global.AuroraPremiumUtils &&
        global.AuroraPremiumUtils.escapeHtml(value)) ||
    String(value == null ? "" : value);

function reportHeader(companyName, reportNumber) {
    return [
        '<header class="prm-header">',
        '<div class="prm-header__brand">',
        '<span class="prm-header__mark" aria-hidden="true"></span>',
        `<strong>${esc(companyName)}</strong>`,
        "</div>",
        `<span class="prm-header__id">${esc(reportNumber)}</span>`,
        "</header>"
    ].join("");
}

function reportFooter(pageNumber, totalPages) {
    return [
        '<footer class="prm-footer">',
        '<div class="prm-footer__brand">',
        '<span class="prm-footer__mark" aria-hidden="true"></span>',
        "<span>AURORA</span>",
        "<small>· Soluções Inteligentes</small>",
        "</div>",
        `<span class="prm-footer__page">Página ${pageNumber} de ${totalPages}</span>`,
        "</footer>"
    ].join("");
}

function sectionHeader(index, title, subtitle) {
    return [
        '<div class="prm-section-header">',
        `<span class="prm-section-header__index">${esc(index)}</span>`,
        "<div>",
        `<h2>${esc(title)}</h2>`,
        subtitle
            ? `<p>${esc(subtitle)}</p>`
            : "",
        "</div>",
        "</div>"
    ].join("");
}

function metadataItem(label, value) {
    return [
        '<div class="prm-metadata-item">',
        `<span class="prm-metadata-item__label">${esc(label)}</span>`,
        `<strong>${esc(value)}</strong>`,
        "</div>"
    ].join("");
}

function photoCard(index, label, src, alt, areaClass) {
    const area = areaClass ? ` prm-photo-card--${areaClass}` : "";

    return [
        `<figure class="prm-photo-card${area}">`,
        src
            ? `<img src="${esc(src)}" alt="${esc(alt)}" class="prm-photo-card__img">`
            : '<div class="prm-photo-card__empty">Sem foto</div>',
        '<div class="prm-photo-card__overlay"></div>',
        '<span class="prm-photo-card__corner prm-photo-card__corner--tl"></span>',
        '<span class="prm-photo-card__corner prm-photo-card__corner--tr"></span>',
        '<span class="prm-photo-card__corner prm-photo-card__corner--br"></span>',
        '<span class="prm-photo-card__corner prm-photo-card__corner--bl"></span>',
        '<figcaption class="prm-photo-card__caption">',
        `<span class="prm-photo-card__index">${esc(index)}</span>`,
        `<span class="prm-photo-card__label">${esc(label)}</span>`,
        `<span class="prm-photo-card__frame">Frame ${esc(index)}</span>`,
        "</figcaption>",
        "</figure>"
    ].join("");
}

const SEVERITY = {
    atencao: {
        label: "ATENÇÃO",
        badge: "prm-severity--atencao",
        bar: "prm-severity-bar--atencao",
        dot: "prm-severity-dot--atencao"
    },
    reparo: {
        label: "REPARO NECESSÁRIO",
        badge: "prm-severity--reparo",
        bar: "prm-severity-bar--reparo",
        dot: "prm-severity-dot--reparo"
    }
};

function occurrenceCard(index, occurrence) {
    const style = SEVERITY[occurrence.severity] || SEVERITY.atencao;

    return [
        `<article class="prm-occurrence-card">`,
        `<span class="prm-occurrence-card__bar ${style.bar}"></span>`,
        '<div class="prm-occurrence-card__photo">',
        occurrence.photo && occurrence.photo.url
            ? `<img src="${esc(occurrence.photo.url)}" alt="${esc(occurrence.photo.alt)}" class="prm-occurrence-card__img">`
            : '<div class="prm-photo-card__empty">Sem foto</div>',
        '<div class="prm-occurrence-card__photo-overlay"></div>',
        `<span class="prm-occurrence-card__evidence">Evidência ${esc(index)}</span>`,
        "</div>",
        '<div class="prm-occurrence-card__body">',
        '<div class="prm-occurrence-card__head">',
        `<span class="prm-occurrence-card__index">${esc(index)}</span>`,
        `<span class="prm-occurrence-card__dot ${style.dot}"></span>`,
        '<span class="prm-occurrence-card__kind">Ocorrência</span>',
        `<h3>${esc(occurrence.title)}</h3>`,
        `<span class="prm-occurrence-card__badge ${style.badge}">${esc(style.label)}</span>`,
        `<span class="prm-occurrence-card__location">${esc(occurrence.location)}</span>`,
        "</div>",
        '<div class="prm-occurrence-card__details">',
        `<p><strong>Constatação:</strong> ${esc(occurrence.finding)}</p>`,
        `<p><strong>Recomendação:</strong> ${esc(occurrence.recommendation)}</p>`,
        "</div>",
        "</div>",
        "</article>"
    ].join("");
}

const CHECKLIST = {
    ok: { label: "OK", className: "prm-checklist-item--ok" },
    atencao: { label: "ATENÇÃO", className: "prm-checklist-item--atencao" },
    reparo: { label: "REPARO", className: "prm-checklist-item--reparo" }
};

function checklistItem(label, status) {
    const style = CHECKLIST[status] || CHECKLIST.ok;

    return [
        `<div class="prm-checklist-item ${style.className}">`,
        `<span>${esc(label)}</span>`,
        `<strong>${esc(style.label)}</strong>`,
        "</div>"
    ].join("");
}

function signatureBlock(label, name, role, signatureData) {
    const signatureMarkup = signatureData
        ? `<img src="${esc(signatureData)}" alt="${esc(label)}" class="prm-signature-block__img">`
        : '<span class="prm-signature-block__line"></span>';

    return [
        '<div class="prm-signature-block">',
        `<span class="prm-signature-block__label">${esc(label)}</span>`,
        `<div class="prm-signature-block__pad">${signatureMarkup}</div>`,
        `<strong>${esc(name)}</strong>`,
        `<small>${esc(role)}</small>`,
        "</div>"
    ].join("");
}

function diagnosticStat(label, value, tone) {
    const toneClass = tone ? ` prm-diagnostic-stat--${tone}` : "";

    return [
        `<div class="prm-diagnostic-stat${toneClass}">`,
        `<strong>${esc(value)}</strong>`,
        `<span>${esc(label)}</span>`,
        "</div>"
    ].join("");
}

global.AuroraPremiumComponents = {
    reportHeader,
    reportFooter,
    sectionHeader,
    metadataItem,
    photoCard,
    occurrenceCard,
    checklistItem,
    signatureBlock,
    diagnosticStat,
    esc
};
})(typeof window !== "undefined" ? window : globalThis);

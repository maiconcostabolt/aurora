(function (global) {
"use strict";

const C = global.AuroraPremiumComponents || {};
const esc = C.esc || ((value) => String(value == null ? "" : value));

const NAV_STEPS = [
    "Identificação",
    "Registro fotográfico",
    "Avarias",
    "Checklist",
    "Diagnóstico",
    "Finalização"
];

function coverMeta(label, value) {
    return [
        '<div class="prm-cover-meta">',
        `<span>${esc(label)}</span>`,
        `<strong>${esc(value)}</strong>`,
        "</div>"
    ].join("");
}

function vehicleSpec(label, value) {
    return [
        '<div class="prm-cover-spec">',
        `<span>${esc(label)}</span>`,
        `<strong>${esc(value)}</strong>`,
        "</div>"
    ].join("");
}

function renderCoverPage(data, pageNumber, totalPages) {
    const vehicle = data.vehicle;
    const mileage = Number(vehicle.mileageKm || 0);
    const mileageLabel = mileage
        ? mileage.toLocaleString("pt-BR")
        : "—";

    const nav = NAV_STEPS.map((step, index) => [
        '<div class="prm-cover-nav__item">',
        `<span class="prm-cover-nav__dot${index === 0 ? " is-active" : ""}">${index + 1}</span>`,
        `<span class="prm-cover-nav__label${index === 0 ? " is-active" : ""}">${esc(step)}</span>`,
        index < NAV_STEPS.length - 1
            ? '<span class="prm-cover-nav__line"></span>'
            : "",
        "</div>"
    ].join("")).join("");

    return [
        `<section class="a4-page prm-page prm-page--cover" data-premium-page="${pageNumber}">`,
        '<div class="prm-cover">',
        '<div class="prm-cover__backdrop"></div>',
        '<div class="prm-cover__top">',
        '<div class="prm-cover__brand">',
        '<span class="prm-cover__mark"></span>',
        "<div>",
        `<strong>${esc(data.company.name)}</strong>`,
        `<small>${esc(data.company.slogan)}</small>`,
        "</div>",
        "</div>",
        `<span class="prm-cover__badge">${esc(data.meta.documentLabel)}</span>`,
        "</div>",
        '<div class="prm-cover__hero">',
        `<p class="prm-cover__kicker">Relatório técnico · Nº ${esc(data.meta.reportNumber)}</p>`,
        '<h1 class="prm-cover__pretitle">Relatório de</h1>',
        '<h1 class="prm-cover__title">VISTORIA<br><span>VEICULAR</span></h1>',
        '<div class="prm-cover__meta-row">',
        coverMeta("Relatório", data.meta.reportNumber),
        coverMeta("Data", `${data.meta.date} — ${data.meta.time}`),
        coverMeta("Responsável", data.inspector.name),
        "</div>",
        "</div>",
        '<div class="prm-cover__photo-shell">',
        '<div class="prm-cover__photo-main">',
        data.coverPhoto.url
            ? `<img src="${esc(data.coverPhoto.url)}" alt="${esc(data.coverPhoto.alt)}" class="prm-cover__photo-img">`
            : '<div class="prm-photo-card__empty">Sem foto de capa</div>',
        '<span class="prm-cover__photo-badge">Frame 01 · Registro</span>',
        "</div>",
        '<aside class="prm-cover__photo-sidebar">',
        "<p>Resumo</p>",
        `<strong>${esc(vehicle.make)} ${esc(vehicle.model)}</strong>`,
        `<span>${esc(vehicle.plate)}</span>`,
        `<span>${esc(vehicle.yearModel)}</span>`,
        `<span>${esc(vehicle.color)}</span>`,
        `<span>${esc(mileageLabel)} km</span>`,
        "</aside>",
        "</div>",
        '<div class="prm-cover__vehicle-row">',
        `<div class="prm-cover__vehicle-title"><span>Veículo vistoriado</span><strong>${esc(vehicle.make)} ${esc(vehicle.model)}</strong></div>`,
        `<div class="prm-cover__plate"><strong>${esc(vehicle.plate)}</strong><span>Placa</span></div>`,
        vehicleSpec("Ano/Modelo", vehicle.yearModel),
        vehicleSpec("Cor", vehicle.color),
        vehicleSpec("KM", mileageLabel),
        "</div>",
        `<div class="prm-cover__nav">${nav}</div>`,
        C.reportFooter(pageNumber, totalPages),
        "</div>",
        "</section>"
    ].join("");
}

global.AuroraPremiumCoverPage = {
    renderCoverPage
};
})(typeof window !== "undefined" ? window : globalThis);

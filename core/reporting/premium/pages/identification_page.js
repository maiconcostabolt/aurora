(function (global) {
"use strict";

const C = global.AuroraPremiumComponents || {};

function renderIdentificationPage(data, pageNumber, totalPages) {
    const vehicle = data.vehicle;
    const mileage = Number(vehicle.mileageKm || 0);
    const fields = [
        ["Cliente", data.customer.name],
        ["Veículo", `${vehicle.make} ${vehicle.model}`.trim()],
        ["Placa", vehicle.plate],
        ["Ano / Modelo", vehicle.yearModel],
        ["Cor", vehicle.color],
        [
            "Quilometragem",
            mileage ? `${mileage.toLocaleString("pt-BR")} km` : "—"
        ],
        ["Combustível", vehicle.fuel],
        ["Responsável pela vistoria", data.inspector.name],
        ["Entrada", `${data.entry.date} — ${data.entry.time}`]
    ];

    const metadataGrid = fields
        .map(([label, value]) => C.metadataItem(label, value))
        .join("");

    const photos = data.photos || [];
    const photoGrid = [
        C.photoCard("01", photos[0] && photos[0].label, photos[0] && photos[0].url, photos[0] && photos[0].alt, "frente"),
        C.photoCard("02", photos[1] && photos[1].label, photos[1] && photos[1].url, photos[1] && photos[1].alt, "lateral-direita"),
        C.photoCard("03", photos[2] && photos[2].label, photos[2] && photos[2].url, photos[2] && photos[2].alt, "traseira"),
        C.photoCard("04", photos[3] && photos[3].label, photos[3] && photos[3].url, photos[3] && photos[3].alt, "lateral-esquerda"),
        C.photoCard("05", photos[4] && photos[4].label, photos[4] && photos[4].url, photos[4] && photos[4].alt, "painel")
    ].join("");

    return [
        `<section class="a4-page prm-page prm-page--identification" data-premium-page="${pageNumber}">`,
        C.reportHeader(data.company.name, data.meta.reportNumber),
        '<div class="prm-page-body">',
        C.sectionHeader(
            "01",
            "IDENTIFICAÇÃO",
            "Dados do cliente e do veículo vistoriado"
        ),
        `<div class="prm-metadata-grid">${metadataGrid}</div>`,
        '<div class="prm-photo-section">',
        '<div class="prm-photo-section__head">',
        C.sectionHeader(
            "02",
            "REGISTRO FOTOGRÁFICO",
            "Sequência de identificação visual do veículo no momento da entrada"
        ),
        `<span class="prm-photo-section__count">05 frames · ${C.esc(data.meta.reportNumber)}</span>`,
        "</div>",
        `<div class="prm-photo-grid">${photoGrid}</div>`,
        "</div>",
        "</div>",
        C.reportFooter(pageNumber, totalPages),
        "</section>"
    ].join("");
}

global.AuroraPremiumIdentificationPage = {
    renderIdentificationPage
};
})(typeof window !== "undefined" ? window : globalThis);

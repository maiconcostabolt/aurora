(function (global) {
"use strict";

/*
 * LOTE 3 — Mapa de Identificação + Detalhes técnicos por serviceId/profileId.
 * Um renderer compartilhado em report_preview.js consome esta configuração.
 */

const REPORT_IDENTIFICATION_FIELDS = [
    {
        label: "Cliente",
        paths: ["customer.name", "customer.company_name"],
        alwaysShow: true
    },
    {
        label: "Telefone",
        paths: ["customer.phone"]
    },
    {
        label: "E-mail",
        paths: ["customer.email"]
    },
    {
        label: "Endereço",
        paths: ["customer.address", "asset.address"]
    },
    {
        label: "Responsável técnico",
        paths: ["company.professional"],
        alwaysShow: true
    }
];

const PROFILE_SECTION_TITLES = {
    workshop: "Detalhes técnicos",
    electrical: "Detalhes técnicos",
    industrial: "Detalhes técnicos",
    drone: "Detalhes técnicos",
    car_wash: "Detalhes técnicos",
    upholstery_cleaning: "Detalhes técnicos",
    curtains_blinds: "Detalhes técnicos",
    repairs_maintenance: "Detalhes técnicos"
};

function F(label, path, format) {
    const field = { label, path };
    if (format) field.format = format;
    return field;
}

function C(label, computed, format) {
    const field = { label, computed };
    if (format) field.format = format;
    return field;
}

const REPORT_TECHNICAL_PROFILE_FALLBACK = {
    workshop: {
        sectionTitle: PROFILE_SECTION_TITLES.workshop,
        hideEmpty: true,
        fields: [
            F("Veículo", "asset.identification"),
            F("Placa", "asset.plate"),
            F("Ano / modelo", "asset.year_model"),
            F("Cor", "asset.color", "vehicle_color"),
            F("Quilometragem", "asset.mileage", "mileage"),
            F("Observações", "asset.notes")
        ]
    },
    electrical: {
        sectionTitle: PROFILE_SECTION_TITLES.electrical,
        hideEmpty: true,
        fields: [
            F("Equipamento", "asset.identification"),
            F("Categoria", "asset.asset_type"),
            F("TAG / identificação técnica", "asset.tag"),
            F("Localização", "asset.location"),
            F("Tensão nominal", "asset.voltage"),
            F("Fabricante", "asset.manufacturer"),
            F("Modelo", "asset.model"),
            F("Observações técnicas", "asset.notes")
        ]
    },
    industrial: {
        sectionTitle: PROFILE_SECTION_TITLES.industrial,
        hideEmpty: true,
        fields: [
            F("Equipamento", "asset.identification"),
            F("Categoria", "asset.asset_type"),
            F("TAG", "asset.tag"),
            F("Setor / área", "asset.sector"),
            F("Fabricante", "asset.manufacturer"),
            F("Modelo", "asset.model"),
            F("Condição operacional", "asset.operating_status"),
            F("Observações técnicas", "asset.notes")
        ]
    },
    drone: {
        sectionTitle: PROFILE_SECTION_TITLES.drone,
        hideEmpty: true,
        fields: [
            F("Local ou estrutura", "asset.identification"),
            F("Tipo de levantamento", "asset.inspection_type"),
            F("Endereço / localização", "asset.address"),
            F("Área aproximada", "asset.area"),
            F("Condições de acesso e voo", "asset.access_conditions"),
            F("Observações", "asset.notes")
        ]
    },
    car_wash: {
        sectionTitle: PROFILE_SECTION_TITLES.car_wash,
        hideEmpty: true,
        fields: [
            F("Veículo", "asset.identification"),
            F("Placa", "asset.plate"),
            F("Ano / modelo", "asset.year_model"),
            F("Cor", "asset.color", "vehicle_color"),
            F("Quilometragem", "asset.mileage", "mileage"),
            F("Itens / observações", "asset.notes")
        ]
    },
    upholstery_cleaning: {
        sectionTitle: PROFILE_SECTION_TITLES.upholstery_cleaning,
        hideEmpty: true,
        fields: [
            F("Item atendido", "asset.identification"),
            F("Categoria", "asset.asset_type"),
            F("Material / tecido", "asset.material"),
            F("Cor", "asset.color"),
            F("Quantidade", "asset.quantity"),
            F("Ambiente", "asset.location")
        ]
    },
    curtains_blinds: {
        sectionTitle: PROFILE_SECTION_TITLES.curtains_blinds,
        hideEmpty: true,
        fields: [
            F("Produto / ambiente", "asset.identification"),
            F("Categoria", "asset.asset_type"),
            F("Largura", "asset.width"),
            F("Altura", "asset.height"),
            F("Quantidade", "asset.quantity"),
            F("Cor / acabamento", "asset.color"),
            F("Observações", "asset.notes")
        ]
    },
    repairs_maintenance: {
        sectionTitle: PROFILE_SECTION_TITLES.repairs_maintenance,
        hideEmpty: true,
        fields: [
            F("Local do serviço", "asset.identification"),
            F("Tipo de imóvel", "asset.property_type"),
            F("Ambiente", "asset.environment"),
            F("Endereço", "asset.address"),
            F("Acesso / cuidados", "asset.access_conditions"),
            F("Observações", "asset.notes")
        ]
    }
};

const REPORT_TECHNICAL_BY_SERVICE = {
    sofa_cleaning: {
        profileId: "upholstery_cleaning",
        sectionTitle: "Detalhes técnicos",
        hideEmpty: true,
        implementation: "exclusive",
        fields: [
            F("Ambiente", "asset.location"),
            F("Tipo do sofá", "asset.sofa_type"),
            F("Lugares", "asset.seats"),
            F("Tecido / revestimento", "asset.material"),
            F("Cor", "asset.color"),
            F("Condição do mecanismo", "asset.mechanism_condition"),
            F("Almofadas soltas", "asset.loose_cushions"),
            F("Principal ocorrência percebida", "asset.stain_profile"),
            F("Odor", "asset.odor_level"),
            C("Serviço contratado", "contracted_services"),
            F("Detalhes específicos", "asset.notes"),
            C("Data do atendimento", "entry_date", "date")
        ]
    },
    mattress_cleaning: {
        profileId: "upholstery_cleaning",
        sectionTitle: "Detalhes técnicos",
        hideEmpty: true,
        implementation: "exclusive",
        fields: [
            F("Identificação", "asset.identification"),
            F("Tamanho", "asset.mattress_size"),
            F("Construção", "asset.mattress_type"),
            F("Faces higienizadas", "asset.faces"),
            F("Tecido / revestimento", "asset.material"),
            F("Principal ocorrência percebida", "asset.stain_profile"),
            F("Odor", "asset.odor_level"),
            F("Quantidade", "asset.quantity"),
            F("Ambiente", "asset.location"),
            F("Detalhes específicos", "asset.notes"),
            C("Serviço contratado", "contracted_services"),
            C("Data do atendimento", "entry_date", "date")
        ]
    },
    armchair_cleaning: {
        profileId: "upholstery_cleaning",
        sectionTitle: "Detalhes técnicos",
        hideEmpty: true,
        implementation: "exclusive",
        fields: [
            F("Identificação", "asset.identification"),
            F("Tipo de poltrona", "asset.armchair_type"),
            F("Tecido / revestimento", "asset.material"),
            F("Cor", "asset.color"),
            F("Condição do mecanismo", "asset.mechanism_condition"),
            F("Quantidade", "asset.quantity"),
            F("Ambiente", "asset.location"),
            F("Detalhes específicos", "asset.notes"),
            C("Serviço contratado", "contracted_services"),
            C("Data do atendimento", "entry_date", "date")
        ]
    },
    chair_cleaning: {
        profileId: "upholstery_cleaning",
        sectionTitle: "Detalhes técnicos",
        hideEmpty: true,
        implementation: "exclusive",
        fields: [
            F("Identificação / conjunto", "asset.identification"),
            F("Tipo de cadeira", "asset.chair_type"),
            F("Quantidade", "asset.quantity"),
            F("Áreas estofadas", "asset.upholstered_parts"),
            F("Tecido / revestimento", "asset.material"),
            F("Estrutura", "asset.structure"),
            F("Ambiente", "asset.location"),
            F("Detalhes do lote", "asset.notes"),
            C("Serviço contratado", "contracted_services"),
            C("Data do atendimento", "entry_date", "date")
        ]
    },
    auto_upholstery: {
        profileId: "upholstery_cleaning",
        sectionTitle: "Detalhes técnicos",
        hideEmpty: true,
        implementation: "exclusive",
        fields: [
            F("Veículo", "asset.identification"),
            F("Placa", "asset.plate"),
            F("Ano / modelo", "asset.year_model"),
            F("Escopo principal", "asset.interior_scope"),
            F("Revestimento dos bancos", "asset.seat_material"),
            F("Quantidade de assentos", "asset.seat_count"),
            F("Teto incluído", "asset.headliner_included"),
            F("Itens / detalhes do interior", "asset.notes"),
            C("Serviço contratado", "contracted_services"),
            C("Data do atendimento", "entry_date", "date")
        ]
    },
    carpet_cleaning: {
        profileId: "upholstery_cleaning",
        sectionTitle: "Detalhes técnicos",
        hideEmpty: true,
        implementation: "exclusive",
        fields: [
            F("Identificação / ambiente", "asset.identification"),
            F("Tipo", "asset.carpet_type"),
            F("Dimensões", "asset.dimensions"),
            F("Área aproximada (m²)", "asset.area_m2"),
            F("Material / fibra", "asset.material"),
            F("Franjas", "asset.fringe"),
            F("Quantidade", "asset.quantity"),
            F("Ambiente", "asset.location"),
            F("Detalhes específicos", "asset.notes"),
            C("Serviço contratado", "contracted_services"),
            C("Data do atendimento", "entry_date", "date")
        ]
    }
};

const SERVICE_PROFILE_INDEX = {
    vehicle_inspection: "workshop",
    suspension: "workshop",
    engine: "workshop",
    brakes: "workshop",
    steering: "workshop",
    vehicle_electrical: "workshop",
    air_conditioning: "workshop",
    panel: "electrical",
    thermography: "electrical",
    installation: "electrical",
    electric_motor: "electrical",
    grounding: "electrical",
    lighting: "electrical",
    eletrica_tupy: "electrical",
    machine: "industrial",
    pipeline: "industrial",
    structure: "industrial",
    tank: "industrial",
    roof: "drone",
    facade: "drone",
    tower: "drone",
    solar: "drone",
    basic_wash: "car_wash",
    complete_wash: "car_wash",
    technical_wash: "car_wash",
    interior_detailing: "car_wash",
    polishing: "car_wash",
    paint_protection: "car_wash",
    sofa_cleaning: "upholstery_cleaning",
    mattress_cleaning: "upholstery_cleaning",
    armchair_cleaning: "upholstery_cleaning",
    chair_cleaning: "upholstery_cleaning",
    auto_upholstery: "upholstery_cleaning",
    carpet_cleaning: "upholstery_cleaning",
    curtain_installation: "curtains_blinds",
    blind_installation: "curtains_blinds",
    curtain_maintenance: "curtains_blinds",
    blind_maintenance: "curtains_blinds",
    motorized_system: "curtains_blinds",
    track_and_rod: "curtains_blinds",
    small_repairs: "repairs_maintenance",
    masonry: "repairs_maintenance",
    painting: "repairs_maintenance",
    flooring: "repairs_maintenance",
    minor_renovation: "repairs_maintenance",
    general_maintenance: "repairs_maintenance"
};

function resolveProfileId(profileId, serviceId) {
    const profile = String(profileId || "").toLowerCase();
    const service = String(serviceId || "").toLowerCase();
    if (service && SERVICE_PROFILE_INDEX[service]) {
        return SERVICE_PROFILE_INDEX[service];
    }
    return profile || "workshop";
}

function resolveTechnicalDetailsConfig(profileId, serviceId) {
    const service = String(serviceId || "").toLowerCase();
    const profile = resolveProfileId(profileId, serviceId);

    if (service === "vehicle_inspection") {
        return {
            renderer: "vehicle_inspection",
            profileId: profile,
            serviceId: service,
            implementation: "frozen"
        };
    }

    if (REPORT_TECHNICAL_BY_SERVICE[service]) {
        return {
            ...REPORT_TECHNICAL_BY_SERVICE[service],
            profileId: REPORT_TECHNICAL_BY_SERVICE[service].profileId || profile,
            serviceId: service,
            implementation: REPORT_TECHNICAL_BY_SERVICE[service].implementation || "exclusive"
        };
    }

    const fallback = REPORT_TECHNICAL_PROFILE_FALLBACK[profile] ||
        REPORT_TECHNICAL_PROFILE_FALLBACK.workshop;

    return {
        ...fallback,
        profileId: profile,
        serviceId: service,
        implementation: "profile_fallback"
    };
}

function listServiceMatrix() {
    return Object.keys(SERVICE_PROFILE_INDEX).sort().map((serviceId) => {
        const config = resolveTechnicalDetailsConfig("", serviceId);
        return {
            profileId: config.profileId,
            serviceId,
            sectionTitle: config.sectionTitle,
            implementation: config.implementation,
            fields: (config.fields || []).map((field) => ({
                label: field.label,
                path: field.path || null,
                computed: field.computed || null,
                format: field.format || null
            }))
        };
    });
}

global.AURORA_REPORT_TECHNICAL_DETAILS = {
    REPORT_IDENTIFICATION_FIELDS,
    REPORT_TECHNICAL_BY_SERVICE,
    REPORT_TECHNICAL_PROFILE_FALLBACK,
    SERVICE_PROFILE_INDEX,
    PROFILE_SECTION_TITLES,
    resolveProfileId,
    resolveTechnicalDetailsConfig,
    listServiceMatrix
};

})(window);

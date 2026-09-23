(function (global) {
"use strict";

/*
 * LOTE 1 — Títulos sugeridos por serviceId (P1 transversal).
 * Campo livre permanece; sugestões via rc6_patch (category report_title).
 */
const REPORT_TITLE_BY_SERVICE = {
    vehicle_inspection: [
        "Vistoria de recebimento do veículo",
        "Relatório de entrada do veículo",
        "Checklist de recebimento veicular",
        "Registro de condições na entrada"
    ],
    suspension: [
        "Inspeção do sistema de suspensão",
        "Diagnóstico do sistema de suspensão",
        "Manutenção do sistema de suspensão",
        "Revisão de amortecedores e buchas"
    ],
    engine: [
        "Diagnóstico do motor",
        "Inspeção do sistema motor",
        "Revisão preventiva do motor",
        "Análise de desempenho do motor"
    ],
    brakes: [
        "Inspeção do sistema de freios",
        "Diagnóstico do sistema de freios",
        "Manutenção do sistema de freios",
        "Revisão de pastilhas e discos"
    ],
    steering: [
        "Inspeção do sistema de direção",
        "Diagnóstico do sistema de direção",
        "Manutenção do sistema de direção",
        "Revisão de terminais e caixa de direção"
    ],
    vehicle_electrical: [
        "Diagnóstico elétrico automotivo",
        "Inspeção do sistema elétrico do veículo",
        "Revisão de bateria e alternador",
        "Análise de falha elétrica veicular"
    ],
    air_conditioning: [
        "Diagnóstico do ar-condicionado",
        "Manutenção do sistema de climatização",
        "Inspeção do ar-condicionado automotivo",
        "Revisão do sistema de refrigeração"
    ],
    panel: [
        "Inspeção de painel elétrico",
        "Manutenção de painel elétrico",
        "Diagnóstico elétrico de painel",
        "Relatório técnico de painel elétrico"
    ],
    thermography: [
        "Inspeção termográfica elétrica",
        "Levantamento termográfico de painel",
        "Relatório de termografia elétrica",
        "Mapeamento de pontos quentes"
    ],
    installation: [
        "Instalação elétrica residencial",
        "Manutenção de instalação elétrica",
        "Diagnóstico de circuito elétrico",
        "Adequação de instalação elétrica"
    ],
    electric_motor: [
        "Inspeção de motor elétrico",
        "Diagnóstico de motor elétrico",
        "Manutenção preventiva de motor elétrico",
        "Análise de vibração e aquecimento"
    ],
    grounding: [
        "Inspeção de aterramento",
        "Medição de sistema de aterramento",
        "Manutenção de aterramento elétrico",
        "Relatório técnico de aterramento"
    ],
    lighting: [
        "Inspeção de iluminação elétrica",
        "Manutenção de sistema de iluminação",
        "Diagnóstico de iluminação",
        "Adequação de iluminação de emergência"
    ],
    eletrica_tupy: [
        "Relatório de serviço Elétrica Tupy",
        "Instalação elétrica Tupy",
        "Serviço de iluminação Tupy",
        "Instalação de ventiladores Tupy"
    ],
    machine: [
        "Inspeção industrial de máquina",
        "Diagnóstico de equipamento industrial",
        "Manutenção preventiva de máquina",
        "Relatório técnico de máquina"
    ],
    pipeline: [
        "Inspeção de tubulação industrial",
        "Diagnóstico de linha de processo",
        "Levantamento de corrosão em tubulação",
        "Relatório técnico de tubulação"
    ],
    structure: [
        "Inspeção estrutural industrial",
        "Levantamento de integridade estrutural",
        "Diagnóstico de estrutura metálica",
        "Relatório técnico de estrutura"
    ],
    tank: [
        "Inspeção externa de tanque",
        "Diagnóstico de tanque industrial",
        "Levantamento de corrosão em tanque",
        "Relatório técnico de tanque"
    ],
    roof: [
        "Inspeção aérea de telhado",
        "Levantamento de cobertura por drone",
        "Relatório de inspeção de telhado",
        "Mapeamento de anomalias na cobertura"
    ],
    facade: [
        "Inspeção aérea de fachada",
        "Levantamento de fachada por drone",
        "Relatório de inspeção de fachada",
        "Mapeamento de trincas e revestimentos"
    ],
    tower: [
        "Inspeção aérea de torre",
        "Levantamento estrutural por drone",
        "Relatório de inspeção de torre",
        "Mapeamento de corrosão e fixações"
    ],
    solar: [
        "Inspeção aérea de usina solar",
        "Levantamento fotovoltaico por drone",
        "Relatório de inspeção de placas solares",
        "Mapeamento de anomalias em usina solar"
    ],
    basic_wash: [
        "Lavação externa do veículo",
        "Lavação simples automotiva",
        "Serviço de lavagem externa",
        "Lavação e acabamento externo"
    ],
    complete_wash: [
        "Lavação completa do veículo",
        "Lavação interna e externa",
        "Higienização completa automotiva",
        "Serviço completo de lavação"
    ],
    technical_wash: [
        "Lavação técnica do veículo",
        "Descontaminação da pintura",
        "Limpeza técnica automotiva",
        "Lavação detalhada segura"
    ],
    interior_detailing: [
        "Higienização interna do veículo",
        "Detalhamento interno automotivo",
        "Limpeza profunda do interior",
        "Higienização de bancos e carpetes"
    ],
    polishing: [
        "Polimento automotivo",
        "Correção de brilho da pintura",
        "Polimento técnico da pintura",
        "Serviço de polimento veicular"
    ],
    paint_protection: [
        "Proteção da pintura automotiva",
        "Aplicação de selante na pintura",
        "Vitrificação e proteção automotiva",
        "Serviço de proteção da pintura"
    ],
    sofa_cleaning: [
        "Higienização de sofá",
        "Limpeza e higienização de estofado",
        "Higienização completa do sofá",
        "Remoção de manchas em sofá",
        "Tratamento de manchas e odores"
    ],
    mattress_cleaning: [
        "Higienização de colchão",
        "Limpeza profunda de colchão",
        "Tratamento de manchas em colchão",
        "Higienização e sanitização de colchão"
    ],
    armchair_cleaning: [
        "Higienização de poltrona",
        "Limpeza técnica de poltrona",
        "Tratamento de manchas em poltrona",
        "Higienização completa de poltrona"
    ],
    chair_cleaning: [
        "Higienização de cadeiras",
        "Limpeza de assentos estofados",
        "Higienização de lote de cadeiras",
        "Tratamento de manchas em cadeiras"
    ],
    auto_upholstery: [
        "Higienização de bancos automotivos",
        "Limpeza interna de estofados",
        "Higienização do interior do veículo",
        "Tratamento de manchas em bancos"
    ],
    carpet_cleaning: [
        "Higienização de tapete",
        "Limpeza de carpete",
        "Tratamento de manchas em tapete",
        "Higienização de área carpetada"
    ],
    curtain_installation: [
        "Instalação de cortina",
        "Instalação e nivelamento de cortina",
        "Serviço de instalação de cortinas",
        "Montagem de cortina"
    ],
    blind_installation: [
        "Instalação de persiana",
        "Instalação e regulagem de persiana",
        "Serviço de instalação de persianas",
        "Montagem de persiana"
    ],
    curtain_maintenance: [
        "Manutenção de cortina",
        "Regulagem e manutenção de cortina",
        "Serviço de manutenção de cortinas",
        "Correção de trilho de cortina"
    ],
    blind_maintenance: [
        "Manutenção de persiana",
        "Regulagem e manutenção de persiana",
        "Serviço de manutenção de persianas",
        "Correção de acionamento de persiana"
    ],
    motorized_system: [
        "Instalação de sistema motorizado",
        "Manutenção de motor de cortina ou persiana",
        "Regulagem de automação de cortinas",
        "Serviço de sistema motorizado"
    ],
    track_and_rod: [
        "Instalação de trilho e varão",
        "Substituição de trilho ou varão",
        "Reforço e nivelamento de trilho",
        "Serviço de trilho e varão"
    ],
    small_repairs: [
        "Pequenos reparos no imóvel",
        "Serviço de reparo pontual",
        "Manutenção corretiva leve",
        "Correção e acabamento localizado"
    ],
    masonry: [
        "Serviço de alvenaria",
        "Reparo de alvenaria e reboco",
        "Correção de trincas e vãos",
        "Manutenção de alvenaria"
    ],
    painting: [
        "Serviço de pintura",
        "Recuperação e pintura de superfície",
        "Pintura interna ou externa",
        "Manutenção de acabamento pintado"
    ],
    flooring: [
        "Serviço de piso e revestimento",
        "Assentamento de piso",
        "Reparo de revestimento",
        "Manutenção de piso"
    ],
    minor_renovation: [
        "Pequena reforma de ambiente",
        "Serviço de reforma localizada",
        "Reforma parcial do imóvel",
        "Execução de pequena reforma"
    ],
    general_maintenance: [
        "Manutenção geral do imóvel",
        "Serviço de manutenção residencial",
        "Manutenção corretiva geral",
        "Atendimento de manutenção sob demanda"
    ]
};

const PROFILE_REPORT_TITLE_FALLBACK = {
    workshop: [
        "Relatório técnico automotivo",
        "Diagnóstico e serviço veicular",
        "Atendimento técnico registrado"
    ],
    electrical: [
        "Relatório técnico elétrico",
        "Inspeção elétrica registrada",
        "Atendimento elétrico documentado"
    ],
    industrial: [
        "Relatório técnico industrial",
        "Inspeção industrial registrada",
        "Atendimento industrial documentado"
    ],
    drone: [
        "Relatório de inspeção aérea",
        "Levantamento por drone",
        "Inspeção aérea documentada"
    ],
    car_wash: [
        "Relatório de lavação automotiva",
        "Serviço de estética automotiva",
        "Atendimento de lavação registrado"
    ],
    upholstery_cleaning: [
        "Relatório de higienização de estofados",
        "Serviço de limpeza de estofados",
        "Atendimento de estofados registrado"
    ],
    curtains_blinds: [
        "Relatório de cortinas e persianas",
        "Serviço de instalação ou manutenção",
        "Atendimento registrado"
    ],
    repairs_maintenance: [
        "Relatório de reparos e manutenção",
        "Serviço de manutenção registrado",
        "Atendimento de reparo documentado"
    ]
};

const GLOBAL_REPORT_TITLE_FALLBACK = [
    "Relatório técnico",
    "Atendimento registrado",
    "Documento técnico do serviço"
];

function unique(items) {
    return Array.from(new Set(
        (Array.isArray(items) ? items : [])
            .map((value) => String(value || "").trim())
            .filter(Boolean)
    ));
}

function resolveReportTitleSuggestions(profileId, serviceId) {
    const profile = String(profileId || "").toLowerCase();
    const service = String(serviceId || "").toLowerCase();

    if (service && REPORT_TITLE_BY_SERVICE[service]) {
        return unique(REPORT_TITLE_BY_SERVICE[service]);
    }

    if (profile && PROFILE_REPORT_TITLE_FALLBACK[profile]) {
        return unique(PROFILE_REPORT_TITLE_FALLBACK[profile]);
    }

    return unique(GLOBAL_REPORT_TITLE_FALLBACK);
}

global.AURORA_REPORT_TITLE_SUGGESTIONS = {
    REPORT_TITLE_BY_SERVICE,
    PROFILE_REPORT_TITLE_FALLBACK,
    GLOBAL_REPORT_TITLE_FALLBACK,
    resolveReportTitleSuggestions
};

})(window);

/**
 * Domínio Elétrica Tupy — constantes, papéis Bolt e catálogos.
 *
 * CATÁLOGO A = materiais (Plan1 / catalog_data.js) → AURORA_ELETRICA_TUPY_DATA
 * CATÁLOGO B = serviços contratuais (planilha PROVISÓRIA) → AURORA_ELETRICA_TUPY_SERVICES
 *
 * Papéis (sem segundo login):
 *   ADMIN_MASTER_AURORA  → account_role=admin (plataforma)
 *   ADMIN_BOLT           → member role na empresa Bolt + módulo eletrica_tupy
 *   USER_BOLT            → member role operacional Bolt
 *
 * Autorização definitiva = Supabase (membership + RLS). Flags locais só UX.
 */
(function (global) {
"use strict";

var DAY_TYPES = [
    { id: "weekday", label: "Dia de semana", storage: "weekday" },
    { id: "saturday", label: "Sábado", storage: "saturday" },
    { id: "sunday", label: "Domingo", storage: "sunday" }
];

var SECTOR_PRESETS = ["FU-A", "FU-B", "FU-C", "USINAGEM", "BLOCOS"];

var ACTIVITY_DESCRIPTIONS = {
    iluminacao: [
        { id: "LIGHT_INST_001", text: "Instalação de luminárias industriais" },
        { id: "LIGHT_INST_002", text: "Substituição de luminárias" },
        { id: "LIGHT_INST_003", text: "Instalação de iluminação em nova área" },
        { id: "LIGHT_INST_004", text: "Adequação de circuito de iluminação" },
        { id: "LIGHT_INST_005", text: "Instalação de infraestrutura para iluminação" },
        { id: "LIGHT_INST_006", text: "Relocação de pontos de iluminação" },
        { id: "LIGHT_INST_007", text: "Instalação de comandos de iluminação" },
        { id: "LIGHT_INST_008", text: "Manutenção de iluminação existente" }
    ],
    ventiladores: [
        { id: "VENT_INST_001", text: "Instalação de ventilador industrial" },
        { id: "VENT_INST_002", text: "Substituição de ventilador" },
        { id: "VENT_INST_003", text: "Relocação de ventilador" },
        { id: "VENT_INST_004", text: "Instalação de infraestrutura para ventilador" },
        { id: "VENT_INST_005", text: "Instalação de alimentação elétrica" },
        { id: "VENT_INST_006", text: "Instalação de acionamento de ventilador" },
        { id: "VENT_INST_007", text: "Adequação de circuito existente" },
        { id: "VENT_INST_008", text: "Manutenção elétrica de ventilador" }
    ],
    escritorio: [
        { id: "OFF_INST_001", text: "Instalação de novo ponto elétrico" },
        { id: "OFF_INST_002", text: "Instalação de tomadas" },
        { id: "OFF_INST_003", text: "Relocação de tomadas" },
        { id: "OFF_INST_004", text: "Instalação de ponto para estação de trabalho" },
        { id: "OFF_INST_005", text: "Adequação elétrica de escritório" },
        { id: "OFF_INST_006", text: "Instalação de infraestrutura elétrica" },
        { id: "OFF_INST_007", text: "Alimentação de equipamentos" },
        { id: "OFF_INST_008", text: "Relocação de pontos elétricos" }
    ]
};

var CONCLUSION_DESCRIPTIONS = {
    iluminacao: [
        "Serviço executado conforme previsto",
        "Luminárias instaladas",
        "Luminárias substituídas",
        "Circuito de iluminação adequado",
        "Infraestrutura elétrica concluída",
        "Pontos de iluminação relocados",
        "Sistema testado e liberado"
    ],
    ventiladores: [
        "Serviço executado conforme previsto",
        "Ventilador instalado e fixado",
        "Ventilador substituído",
        "Alimentação elétrica concluída",
        "Acionamento instalado e testado",
        "Infraestrutura elétrica concluída",
        "Equipamento testado em funcionamento"
    ],
    escritorio: [
        "Serviço executado conforme previsto",
        "Pontos elétricos instalados",
        "Tomadas instaladas",
        "Tomadas relocadas",
        "Infraestrutura elétrica concluída",
        "Alimentação dos equipamentos concluída",
        "Pontos testados e liberados"
    ]
};

var PENDING_SUGGESTIONS = [
    "Sem pendências",
    "Aguardando liberação da área",
    "Aguardando material",
    "Aguardando equipamento",
    "Pendente alimentação elétrica",
    "Pendente teste funcional",
    "Necessária adequação adicional"
];

var WORKFLOW_STATES = {
    IN_PROGRESS: "IN_PROGRESS",
    AWAITING_REVIEW: "AWAITING_REVIEW",
    FINALIZED: "FINALIZED"
};

var ROLES = {
    ADMIN_MASTER_AURORA: "ADMIN_MASTER_AURORA",
    ADMIN_BOLT: "ADMIN_BOLT",
    USER_BOLT: "USER_BOLT"
};

/**
 * Stub legado — preferir AURORA_ELETRICA_TUPY_SERVICES (31 itens provisórios).
 * Mantido vazio de SAP inventado.
 */
var EXECUTION_CATALOG = [];

var GESTAO_SECTIONS = [
    {
        id: "recent_activities",
        title: "Atividades recentes",
        hint: ""
    },
    {
        id: "service_codes",
        title: "Catálogo de serviços",
        hint: "17 famílias de códigos (Dias úteis / Sábado / Domingo). Edição cloud preparada — sem SQL LIVE nesta rodada."
    }
];

var AUDIT_FIELDS = [
    "created_by", "created_at",
    "updated_by", "updated_at",
    "reviewed_by", "reviewed_at",
    "finalized_by", "finalized_at"
];

function readAccountFlag() {
    try {
        var api = global.AuroraAccountStorage;
        if (!api || typeof api.getActiveAccount !== "function") return null;
        return api.getActiveAccount() || null;
    } catch (error) {
        return null;
    }
}

function readEntitlements() {
    try {
        if (global.AURORA_ACCOUNT_ENTITLEMENTS && typeof global.AURORA_ACCOUNT_ENTITLEMENTS === "object") {
            return global.AURORA_ACCOUNT_ENTITLEMENTS;
        }
        var account = readAccountFlag();
        if (account && account.entitlements && typeof account.entitlements === "object") {
            return account.entitlements;
        }
    } catch (error) { /* ignore */ }
    return null;
}

function normalizeRole(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
}

/**
 * Papel ADMIN_BOLT na claim RPC — nunca por e-mail / localStorage.
 * Sem claim carregada → false (default negado).
 */
function isAdminBolt() {
    var access = global.AURORA_COMPANY_ACCESS;
    if (!access || access.loaded !== true) return false;
    return normalizeRole(access.role) === "ADMIN_BOLT";
}

function isUserBolt() {
    var access = global.AURORA_COMPANY_ACCESS;
    if (!access || access.loaded !== true) return false;
    var loadedRole = normalizeRole(access.role);
    return loadedRole === "USER_BOLT" || loadedRole === "ADMIN_BOLT";
}

function isTupyAdmin() {
    return canManageEletricaTupy();
}

/**
 * Gate central de Gestão Elétrica Tupy.
 * Preferir AuroraCompanyAccess.canManageEletricaTupy (claim real).
 */
function canManageEletricaTupy() {
    if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.canManageEletricaTupy === "function") {
        return global.AuroraCompanyAccess.canManageEletricaTupy() === true;
    }
    return false;
}

function canManageOfficialSapCatalog() {
    return canManageEletricaTupy();
}

function canOpenTupyAdminGestao() {
    return canManageEletricaTupy();
}

/**
 * Visibilidade do módulo Elétrica Tupy.
 * Com claim de empresa carregado (RPC): exige entitlement eletrica_tupy.
 * Sem claim (migration ainda não aplicada): fallback TESTS — não esconde.
 */
function canAccessEletricaTupyModule() {
    var access = global.AURORA_COMPANY_ACCESS;
    if (access && access.loaded === true) {
        var entClaim = access.entitlements || {};
        if (entClaim.eletrica_tupy === true) return true;
        if (entClaim.modules && Array.isArray(entClaim.modules) && entClaim.modules.indexOf("eletrica_tupy") !== -1) {
            return true;
        }
        return false;
    }
    var ent = readEntitlements();
    if (!ent) return true;
    if (ent.modules && Array.isArray(ent.modules)) {
        return ent.modules.indexOf("eletrica_tupy") !== -1 || ent.modules.indexOf("electrical") !== -1;
    }
    if (ent.eletrica_tupy === true || ent.module_eletrica_tupy === true) return true;
    if (ent.eletrica_tupy === false || ent.module_eletrica_tupy === false) return false;
    return true;
}

/**
 * Matriz UX (não é segurança). Segurança = RLS/RPC.
 */
function effectivePermissions() {
    var access = global.AURORA_COMPANY_ACCESS;
    if (access && access.loaded && access.permissions && typeof access.permissions === "object") {
        return Object.assign({}, access.permissions);
    }
    if (isAdminBolt()) {
        return {
            create_case: true,
            view_company_cases: true,
            edit_own_case: true,
            edit_company_case: true,
            administer_case: true,
            assign_service_codes: true,
            manage_users: false
        };
    }
    if (isUserBolt()) {
        return {
            create_case: true,
            view_company_cases: true,
            edit_own_case: true,
            edit_company_case: false,
            administer_case: false,
            assign_service_codes: false,
            manage_users: false
        };
    }
    return {
        create_case: false,
        view_company_cases: false,
        edit_own_case: false,
        edit_company_case: false,
        administer_case: false,
        assign_service_codes: false,
        manage_users: false
    };
}

function canEditAdminFields() {
    if (!canManageEletricaTupy()) return false;
    var perms = effectivePermissions();
    return perms.administer_case === true || perms.assign_service_codes === true;
}

function servicesCatalog() {
    return global.AURORA_ELETRICA_TUPY_SERVICES || { items: [], status_validacao: "ausente" };
}

function listContractServices() {
    var pack = servicesCatalog();
    return Array.isArray(pack.items) ? pack.items.slice() : [];
}

function resolveApplicableServiceCode(serviceRow, dayType) {
    if (!serviceRow || typeof serviceRow !== "object") return null;
    var day = String(dayType || "").toLowerCase();
    if (day === "weekday" || day === "semana") return serviceRow.codigo_dia_semana || null;
    if (day === "saturday" || day === "sabado" || day === "sábado") return serviceRow.codigo_sabado || null;
    if (day === "sunday" || day === "domingo") return serviceRow.codigo_domingo || null;
    return null;
}

function belowMinimumQuantity(serviceRow, quantity) {
    if (!serviceRow || serviceRow.quantidade_minima == null) return false;
    var q = Number(quantity);
    var min = Number(serviceRow.quantidade_minima);
    if (!isFinite(q) || !isFinite(min)) return false;
    return q < min;
}

global.AuroraEletricaTupyDomain = {
    CLIENT_NAME: "Tupy S.A.",
    EXECUTOR_NAME: "Bolt Soluções Elétricas",
    COMPANY_SLUG_TARGET: "bolt",
    MODULE_ID: "eletrica_tupy",
    ADMIN_ROLE: ROLES.ADMIN_BOLT,
    ROLES: ROLES,
    DAY_TYPES: DAY_TYPES,
    SECTOR_PRESETS: SECTOR_PRESETS,
    ACTIVITY_DESCRIPTIONS: ACTIVITY_DESCRIPTIONS,
    CONCLUSION_DESCRIPTIONS: CONCLUSION_DESCRIPTIONS,
    PENDING_SUGGESTIONS: PENDING_SUGGESTIONS,
    WORKFLOW_STATES: WORKFLOW_STATES,
    EXECUTION_CATALOG: EXECUTION_CATALOG,
    GESTAO_SECTIONS: GESTAO_SECTIONS,
    AUDIT_FIELDS: AUDIT_FIELDS,
    MATERIALS_CATALOG_SOURCE: "Lista de materiais - ATV.xlsx / catalog_data.js",
    SERVICES_CATALOG_SOURCE: "Catalogo_Servicos_Atividades_Rotineiras_Tupy_PROVISORIO.xlsx / services_catalog_data.js",
    SERVICES_CATALOG_STATUS: "provisorio",
    REPORT_FOOTER_BRAND: "Atividades Rotineiras Tupy",
    REPORT_FOOTER_BYLINE: "by Aurora",
    isAdminBolt: isAdminBolt,
    isUserBolt: isUserBolt,
    isTupyAdmin: isTupyAdmin,
    canManageEletricaTupy: canManageEletricaTupy,
    canManageOfficialSapCatalog: canManageOfficialSapCatalog,
    canOpenTupyAdminGestao: canOpenTupyAdminGestao,
    canAccessEletricaTupyModule: canAccessEletricaTupyModule,
    effectivePermissions: effectivePermissions,
    canEditAdminFields: canEditAdminFields,
    listContractServices: listContractServices,
    resolveApplicableServiceCode: resolveApplicableServiceCode,
    belowMinimumQuantity: belowMinimumQuantity,
    budgetNumberAuthority: "supabase_transaction_future",
    noteBudget:
        "budget_number é campo local preparado; autoridade definitiva futura = Supabase/transação central (evitar duplicidade multi-dispositivo).",
    noteAuthArchitecture:
        "ADMIN MASTER AURORA (account_role=admin) autoriza ADMIN_BOLT/USER_BOLT via Admin panel + membership. Sem segundo login. Sem senha compartilhada. RLS obrigatória antes de compartilhar atendimentos."
};

})(window);

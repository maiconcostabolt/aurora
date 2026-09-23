/**
 * AURORA — Persistência cloud do tratamento administrativo (códigos de serviço)
 * Arquivo: js/admin_service_codes_cloud.js
 *
 * RPCs (migration 17):
 *   aurora_list_project_admin_service_codes(p_project_id)
 *   aurora_replace_project_admin_service_codes(p_project_id, p_items)
 *
 * Não altera workflow_state / registro de campo.
 * Não usa service_role.
 */
(function (global) {
"use strict";

function requireClient(client) {
    if (!client || typeof client.rpc !== "function") {
        var err = new Error("AURORA_BACKEND_UNAVAILABLE");
        err.code = "AURORA_BACKEND_UNAVAILABLE";
        throw err;
    }
}

function assertAdminGate() {
    var access = global.AuroraCompanyAccess;
    if (!access || typeof access.canManageEletricaTupy !== "function" || !access.canManageEletricaTupy()) {
        var denied = new Error("AURORA_ADMIN_CODES_FORBIDDEN");
        denied.code = "AURORA_ADMIN_CODES_FORBIDDEN";
        throw denied;
    }
}

function normalizeProjectId(projectId) {
    var id = String(projectId || "").trim();
    if (!id) {
        var bad = new Error("AURORA_ADMIN_CODES_PROJECT_REQUIRED");
        bad.code = "AURORA_ADMIN_CODES_PROJECT_REQUIRED";
        throw bad;
    }
    return id;
}

function rowToAssoc(row) {
    if (!row) return null;
    return {
        activity_id: String(row.activity_id || ""),
        service_item: row.service_item != null ? row.service_item : null,
        service_description: String(row.service_description || ""),
        service_unit: String(row.unit || ""),
        day_type: String(row.day_type || ""),
        day_label: String(row.day_label || ""),
        service_code: String(row.service_code || ""),
        quantity: row.quantity != null ? row.quantity : null,
        id: row.id || null
    };
}

async function listProjectAdminServiceCodes(client, projectId) {
    assertAdminGate();
    requireClient(client);
    var pid = normalizeProjectId(projectId);
    var result = await client.rpc("aurora_list_project_admin_service_codes", {
        p_project_id: pid
    });
    if (result.error) throw result.error;
    var rows = Array.isArray(result.data) ? result.data : [];
    return rows.map(rowToAssoc).filter(Boolean);
}

function associationsToPayload(associations) {
    var list = Array.isArray(associations) ? associations : [];
    return list.map(function (assoc) {
        return {
            activity_id: assoc.activity_id,
            service_item: assoc.service_item != null ? assoc.service_item : null,
            service_description: assoc.service_description || "",
            service_code: assoc.service_code,
            day_type: assoc.day_type,
            day_label: assoc.day_label || "",
            quantity: assoc.quantity,
            unit: assoc.service_unit || assoc.unit || ""
        };
    });
}

/**
 * Substitui o conjunto ativo do projeto (idempotente no servidor).
 * Remoções locais = ausentes do payload → soft-delete no banco.
 */
async function replaceProjectAdminServiceCodes(client, projectId, associations) {
    assertAdminGate();
    requireClient(client);
    var pid = normalizeProjectId(projectId);
    var result = await client.rpc("aurora_replace_project_admin_service_codes", {
        p_project_id: pid,
        p_items: associationsToPayload(associations)
    });
    if (result.error) throw result.error;
    return result.data || {};
}

global.AuroraAdminServiceCodesCloud = {
    listProjectAdminServiceCodes: listProjectAdminServiceCodes,
    replaceProjectAdminServiceCodes: replaceProjectAdminServiceCodes
};

})(window);

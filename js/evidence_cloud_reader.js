/**
 * AURORA — STORAGE-C — Leitura READ-ONLY de evidências cloud (ADMIN_BOLT)
 * Arquivo: js/evidence_cloud_reader.js
 *
 * Feature flag DEFAULT false — zero SELECT / download / Blob URL até habilitação consciente.
 * Não importa projeto. Não grava IndexedDB / EvidenceStore / localStorage.
 * Não chama downloadCloudProject. Não usa signed URL / getPublicUrl / service_role.
 * Não integra Relatórios / V33 nesta fase.
 */
(function (global) {
"use strict";

var EXPECTED_BUCKET = "aurora-project-evidence";
var FLAG_NAME = "AURORA_EVIDENCE_CLOUD_ADMIN_READ_ENABLED";
var TABLE = "aurora_project_evidence";

/** DEFAULT true — pacote de TESTE humano FLAG ON controlado (STORAGE-C). */
if (typeof global[FLAG_NAME] === "undefined") {
    global[FLAG_NAME] = true;
}

/** Sessões ativas com object URLs (cleanup obrigatório). */
var activeSessions = [];

function isEnabled() {
    if (global[FLAG_NAME] === true) return true;
    var cfg = global.AURORA_CLOUD_CONFIG;
    if (cfg && cfg.evidence_cloud_admin_read === true) return true;
    return false;
}

function emptyLoad(extra) {
    return Object.assign({
        skipped: false,
        reason: null,
        project_id: null,
        total: 0,
        loaded: 0,
        failed: 0,
        items: [],
        failures: [],
        object_urls: []
    }, extra || {});
}

function assertAdminGate(mode) {
    /* Histórico de ativo: a RPC já validou empresa + can_view_history e as
       consultas abaixo continuam limitadas pelas RLS da tabela e do Storage. */
    if (mode === "asset_history_member") return;
    var access = global.AuroraCompanyAccess;
    var genericAdmin = Boolean(access && typeof access.canManageUsers === "function" && access.canManageUsers());
    var tupyAdmin = Boolean(access && typeof access.canManageEletricaTupy === "function" && access.canManageEletricaTupy());
    if (!genericAdmin && !tupyAdmin) {
        var denied = new Error("AURORA_EVIDENCE_ADMIN_READ_FORBIDDEN");
        denied.code = "AURORA_EVIDENCE_ADMIN_READ_FORBIDDEN";
        throw denied;
    }
}

function requireClient(client) {
    if (!client || typeof client.from !== "function") {
        var err = new Error("AURORA_BACKEND_UNAVAILABLE");
        err.code = "AURORA_BACKEND_UNAVAILABLE";
        throw err;
    }
    if (!client.storage || typeof client.storage.from !== "function") {
        var stor = new Error("AURORA_STORAGE_UNAVAILABLE");
        stor.code = "AURORA_STORAGE_UNAVAILABLE";
        throw stor;
    }
}

function normalizeProjectId(projectId) {
    var id = String(projectId || "").trim();
    if (!id || id.indexOf("/") !== -1 || id.indexOf("\\") !== -1) {
        var bad = new Error("AURORA_EVIDENCE_PROJECT_ID_INVALID");
        bad.code = "AURORA_EVIDENCE_PROJECT_ID_INVALID";
        throw bad;
    }
    return id;
}

function validateEvidenceRow(row) {
    if (!row || typeof row !== "object") {
        return { ok: false, reason: "row_missing" };
    }
    var bucket = String(row.storage_bucket || "").trim();
    var path = String(row.storage_path || "").trim();
    if (bucket !== EXPECTED_BUCKET) {
        return { ok: false, reason: "unexpected_bucket", bucket: bucket };
    }
    if (!path || path.indexOf("..") !== -1) {
        return { ok: false, reason: "invalid_storage_path" };
    }
    if (String(row.sync_status || "") !== "uploaded") {
        return { ok: false, reason: "not_uploaded" };
    }
    if (row.deleted_at != null && String(row.deleted_at).trim() !== "") {
        return { ok: false, reason: "soft_deleted" };
    }
    return { ok: true };
}

/**
 * Lista metadata autorizada por RLS (sem RPC nova).
 * Fail closed se flag OFF ou gate ADMIN false.
 */
async function listProjectEvidence(client, projectId, authorizationMode) {
    if (!isEnabled()) {
        return { skipped: true, reason: "flag_off", rows: [] };
    }
    assertAdminGate(authorizationMode);
    requireClient(client);
    var pid = normalizeProjectId(projectId);

    var result = await client
        .from(TABLE)
        .select(
            "id,project_id,company_id,group_id,evidence_id,storage_bucket,storage_path," +
            "mime_type,content_hash,sync_status,deleted_at,byte_size,width,height,created_at"
        )
        .eq("project_id", pid)
        .is("deleted_at", null)
        .eq("sync_status", "uploaded")
        .order("created_at", { ascending: true });

    if (result.error) {
        var err = new Error(result.error.message || "AURORA_EVIDENCE_LIST_FAILED");
        err.code = result.error.code || "AURORA_EVIDENCE_LIST_FAILED";
        err.details = result.error;
        throw err;
    }

    var rows = Array.isArray(result.data) ? result.data : [];
    return { skipped: false, reason: null, rows: rows, project_id: pid };
}

/**
 * Download autenticado do bucket privado.
 * Preferência: storage.from(bucket).download(path) → Blob.
 */
async function downloadEvidence(client, evidenceRow, authorizationMode) {
    if (!isEnabled()) {
        return { skipped: true, reason: "flag_off", blob: null };
    }
    assertAdminGate(authorizationMode);
    requireClient(client);

    var check = validateEvidenceRow(evidenceRow);
    if (!check.ok) {
        var invalid = new Error("AURORA_EVIDENCE_ROW_INVALID:" + check.reason);
        invalid.code = "AURORA_EVIDENCE_ROW_INVALID";
        invalid.details = check;
        throw invalid;
    }

    var bucket = String(evidenceRow.storage_bucket).trim();
    var path = String(evidenceRow.storage_path).trim();
    var dl = await client.storage.from(bucket).download(path);
    if (dl.error) {
        var fail = new Error(dl.error.message || "AURORA_EVIDENCE_DOWNLOAD_FAILED");
        fail.code = "AURORA_EVIDENCE_DOWNLOAD_FAILED";
        fail.details = dl.error;
        throw fail;
    }
    if (!dl.data || typeof Blob === "undefined" || !(dl.data instanceof Blob)) {
        var typeErr = new Error("AURORA_EVIDENCE_BLOB_EXPECTED");
        typeErr.code = "AURORA_EVIDENCE_BLOB_EXPECTED";
        throw typeErr;
    }
    return { skipped: false, blob: dl.data, mime: dl.data.type || evidenceRow.mime_type || null };
}

function trackSession(session) {
    activeSessions.push(session);
    return session;
}

function releaseSession(session) {
    if (!session || typeof session !== "object") return;
    var urls = Array.isArray(session.object_urls) ? session.object_urls : [];
    for (var i = 0; i < urls.length; i += 1) {
        try {
            if (urls[i] && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
                URL.revokeObjectURL(urls[i]);
            }
        } catch (e) { /* ignore */ }
    }
    session.object_urls = [];
    if (Array.isArray(session.items)) {
        for (var j = 0; j < session.items.length; j += 1) {
            var item = session.items[j];
            if (item) {
                item.url = null;
                item.blob = null;
            }
        }
    }
    var idx = activeSessions.indexOf(session);
    if (idx !== -1) activeSessions.splice(idx, 1);
}

function releaseAll() {
    var copy = activeSessions.slice();
    for (var i = 0; i < copy.length; i += 1) {
        releaseSession(copy[i]);
    }
    activeSessions.length = 0;
}

function ensureTypedBlob(blob, mimeHint) {
    if (!blob || typeof Blob === "undefined" || !(blob instanceof Blob)) {
        return blob;
    }
    var hint = String(mimeHint || "").trim().toLowerCase();
    if (hint === "image/jpg") hint = "image/jpeg";
    var current = String(blob.type || "").trim().toLowerCase();
    if (current === "image/jpg") current = "image/jpeg";
    var needsWrap = !current || current === "application/octet-stream";
    var target = needsWrap ? (hint || "image/jpeg") : current;
    if (!needsWrap && (!hint || current === hint)) {
        return blob;
    }
    if (needsWrap || (hint && hint.indexOf("image/") === 0 && current.indexOf("image/") !== 0)) {
        return new Blob([blob], { type: target });
    }
    return blob;
}

/**
 * Lista + download + createObjectURL em memoria (efemero).
 * company_id NAO e parametro de autoridade — vem so da metadata/RLS.
 */
async function loadProjectEvidence(client, projectId, authorizationMode) {
    if (!isEnabled()) {
        return emptyLoad({ skipped: true, reason: "flag_off", project_id: projectId || null });
    }
    assertAdminGate(authorizationMode);
    requireClient(client);
    var pid = normalizeProjectId(projectId);

    var listed = await listProjectEvidence(client, pid, authorizationMode);
    if (listed.skipped) {
        return emptyLoad({ skipped: true, reason: listed.reason, project_id: pid });
    }

    var session = emptyLoad({ project_id: pid, total: listed.rows.length });
    trackSession(session);

    for (var i = 0; i < listed.rows.length; i += 1) {
        var row = listed.rows[i];
        var check = validateEvidenceRow(row);
        if (!check.ok) {
            session.failed += 1;
            session.failures.push({
                evidence_id: row && row.evidence_id || null,
                reason: check.reason
            });
            continue;
        }
        try {
            var downloaded = await downloadEvidence(client, row, authorizationMode);
            var rawBlob = downloaded.blob;
            var blob = ensureTypedBlob(rawBlob, row.mime_type || downloaded.mime);
            var objectUrl = null;
            if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
                objectUrl = URL.createObjectURL(blob);
                session.object_urls.push(objectUrl);
            }
            session.items.push({
                evidence_id: row.evidence_id,
                metadata_id: row.id,
                group_id: row.group_id || null,
                mime_type: row.mime_type || null,
                blob_type: blob && blob.type ? String(blob.type) : "",
                blob_size: blob && typeof blob.size === "number" ? blob.size : null,
                storage_path: row.storage_path,
                content_hash: row.content_hash || null,
                blob: blob,
                url: objectUrl,
                object_url: objectUrl
            });
            session.loaded += 1;
        } catch (error) {
            session.failed += 1;
            session.failures.push({
                evidence_id: row && row.evidence_id || null,
                reason: error && error.code ? error.code : "download_failed",
                message: error && error.message ? String(error.message) : null
            });
        }
    }

    return session;
}

global.AuroraEvidenceCloudReader = {
    FLAG_NAME: FLAG_NAME,
    EXPECTED_BUCKET: EXPECTED_BUCKET,
    isEnabled: isEnabled,
    listProjectEvidence: listProjectEvidence,
    downloadEvidence: downloadEvidence,
    loadProjectEvidence: loadProjectEvidence,
    loadAssetHistoryEvidence: function (client, projectId) {
        return loadProjectEvidence(client, projectId, "asset_history_member");
    },
    release: releaseSession,
    releaseAll: releaseAll
};

})(window);

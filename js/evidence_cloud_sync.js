/**
 * AURORA — STORAGE-B — Upload de evidências (USER / owner-editor)
 * Arquivo: js/evidence_cloud_sync.js
 *
 * Feature flag DEFAULT false — zero upload até habilitação consciente.
 * Não altera EvidenceStore. Não altera stripBinary / JSON do projeto.
 * Não implementa leitura ADMIN / signed URL / V33.
 */
(function (global) {
"use strict";

var BUCKET = "aurora-project-evidence";
var FLAG_NAME = "AURORA_EVIDENCE_CLOUD_UPLOAD_ENABLED";

/** DEFAULT true — pacote de TESTE humano FLAG ON controlado (STORAGE-B). */
if (typeof global[FLAG_NAME] === "undefined") {
    global[FLAG_NAME] = true;
}

function isUploadEnabled() {
    if (global[FLAG_NAME] === true) return true;
    var cfg = global.AURORA_CLOUD_CONFIG;
    if (cfg && cfg.evidence_cloud_upload === true) return true;
    return false;
}

function emptySummary(extra) {
    return Object.assign({
        skipped: false,
        reason: null,
        total: 0,
        uploaded: 0,
        already_synced: 0,
        updated: 0,
        deleted: 0,
        failed: 0,
        warnings: [],
        failures: []
    }, extra || {});
}

function isEletricaTupyCase(caseData) {
    if (!caseData || typeof caseData !== "object") return false;
    var service = caseData.service || {};
    var sid = String(service.id || service.title || caseData.service_type || "").toLowerCase();
    if (sid === "eletrica_tupy") return true;
    if (caseData.eletrica_tupy && typeof caseData.eletrica_tupy === "object") return true;
    return false;
}

function extForMime(mime) {
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return null;
}

function buildCanonicalPath(companyId, projectId, evidenceId, mime) {
    var ext = extForMime(mime);
    if (!ext) return null;
    return String(companyId) + "/" + String(projectId) + "/" + String(evidenceId) + "/v1." + ext;
}

function parseDataUrl(dataUrl) {
    var text = String(dataUrl || "");
    var match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(text);
    if (!match) return null;
    var mime = match[1].toLowerCase();
    if (mime === "image/jpg") mime = "image/jpeg";
    try {
        var b64 = match[2].replace(/\s/g, "");
        var binary = atob(b64);
        var len = binary.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
        return {
            mime: mime,
            bytes: bytes,
            blob: new Blob([bytes], { type: mime })
        };
    } catch (error) {
        return null;
    }
}

function bytesToHex(buffer) {
    var view = new Uint8Array(buffer);
    var out = "";
    for (var i = 0; i < view.length; i += 1) {
        out += view[i].toString(16).padStart(2, "0");
    }
    return out;
}

async function sha256Hex(blob) {
    if (!global.crypto || !global.crypto.subtle || typeof global.crypto.subtle.digest !== "function") {
        throw new Error("AURORA_EVIDENCE_HASH_UNAVAILABLE");
    }
    var buffer = await blob.arrayBuffer();
    var digest = await global.crypto.subtle.digest("SHA-256", buffer);
    return bytesToHex(digest);
}

function photoPayloadSource(photo) {
    if (!photo || typeof photo !== "object") return "";
    return String(photo.edited_src || photo.src || "").trim();
}

/** Kind efetivo usado por photoPayloadSource — só diagnóstico. */
function photoPayloadSourceKind(photo) {
    if (!photo || typeof photo !== "object") return "src";
    var edited = photo.edited_src != null ? String(photo.edited_src).trim() : "";
    if (edited) return "edited_src";
    return "src";
}

function safeSourcePrefix(source) {
    var text = String(source || "");
    var match = /^data:image\/[a-z0-9.+-]+;base64,/i.exec(text);
    if (match) return match[0] + "…";
    return text.slice(0, 40);
}

function uniqueCount(values) {
    var map = {};
    var n = 0;
    for (var i = 0; i < values.length; i += 1) {
        var key = String(values[i]);
        if (!Object.prototype.hasOwnProperty.call(map, key)) {
            map[key] = true;
            n += 1;
        }
    }
    return n;
}

function evidenceIdValid(id) {
    var text = String(id || "").trim();
    if (!text) return false;
    if (text.indexOf("/") !== -1 || text.indexOf("\\") !== -1) return false;
    return true;
}

async function listLocalPhotos(caseId) {
    var store = global.auroraEvidenceStore;
    if (!store || typeof store.listByCase !== "function") {
        return { ok: false, ambiguous: true, photos: [], reason: "AURORA_EVIDENCE_STORE_UNAVAILABLE" };
    }
    var groups = await store.listByCase(String(caseId));
    var photos = [];
    (Array.isArray(groups) ? groups : []).forEach(function (group) {
        if (!group || !evidenceIdValid(group.id)) return;
        /* Foto de capa direta já vive no mesmo EvidenceStore. Incluí-la como
           evidência canônica evita um segundo storage/pipeline. */
        if (group.record_kind === "report_cover_photo" && photoPayloadSource(group)) {
            photos.push({
                group_id: String(group.id),
                evidence_id: String(group.id),
                photo_index: 0,
                source_kind: photoPayloadSourceKind(group),
                width: group.width != null ? Number(group.width) : null,
                height: group.height != null ? Number(group.height) : null,
                source: photoPayloadSource(group)
            });
            return;
        }
        var list = Array.isArray(group.photos) ? group.photos : [];
        list.forEach(function (photo, photoIndex) {
            photos.push({
                group_id: String(group.id),
                evidence_id: photo && photo.id != null ? String(photo.id) : "",
                photo_index: photoIndex,
                source_kind: photoPayloadSourceKind(photo),
                width: photo && photo.width != null ? Number(photo.width) : null,
                height: photo && photo.height != null ? Number(photo.height) : null,
                source: photoPayloadSource(photo)
            });
        });
    });
    return { ok: true, ambiguous: false, photos: photos, groupCount: (groups || []).length };
}

async function fetchProjectRow(client, projectId) {
    var result = await client
        .from("aurora_projects")
        .select("id,company_id,service_type,deleted_at")
        .eq("id", projectId)
        .is("deleted_at", null)
        .maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
}

async function fetchRemoteEvidence(client, projectId) {
    var result = await client
        .from("aurora_project_evidence")
        .select("id,project_id,group_id,evidence_id,storage_bucket,storage_path,mime_type,content_hash,sync_status,deleted_at,byte_size,width,height")
        .eq("project_id", projectId)
        .is("deleted_at", null);
    if (result.error) throw result.error;
    return Array.isArray(result.data) ? result.data : [];
}

async function upsertMetadata(client, row) {
    var existing = await client
        .from("aurora_project_evidence")
        .select("id,storage_path,sync_status,deleted_at")
        .eq("project_id", row.project_id)
        .eq("evidence_id", row.evidence_id)
        .maybeSingle();
    if (existing.error) throw existing.error;

    var payload = {
        project_id: row.project_id,
        group_id: row.group_id,
        evidence_id: row.evidence_id,
        storage_bucket: BUCKET,
        storage_path: row.storage_path,
        mime_type: row.mime_type,
        file_name: row.file_name,
        byte_size: row.byte_size,
        width: row.width,
        height: row.height,
        content_hash: row.content_hash,
        sync_status: "uploaded",
        deleted_at: null
    };

    if (existing.data && existing.data.id) {
        var upd = await client
            .from("aurora_project_evidence")
            .update(payload)
            .eq("id", existing.data.id);
        if (upd.error) throw upd.error;
        return { mode: "update", previous_path: existing.data.storage_path || null };
    }

    var ins = await client.from("aurora_project_evidence").insert(payload);
    if (ins.error) throw ins.error;
    return { mode: "insert", previous_path: null };
}

/**
 * Soft-delete metadata via RPC LIVE (SECURITY DEFINER).
 * p_metadata_id = UUID da linha aurora_project_evidence (NÃO evidence_id).
 * Não usa UPDATE+.select() — evita 42501 SELECT deleted_at IS NULL × RETURNING.
 */
async function softDeleteMetadata(client, metadataId) {
    var diag = {
        metadata_id: metadataId,
        method: "rpc:aurora_soft_delete_project_evidence",
        success: false,
        error_code: null,
        error_message: null,
        row_count: 0,
        returned_id: null,
        returned_sync_status: null,
        returned_deleted_at: null,
        returned_evidence_id: null,
        proof: null
    };

    if (!metadataId) {
        diag.error_message = "AURORA_EVIDENCE_METADATA_ID_REQUIRED";
        diag.proof = "rpc_missing_metadata_id";
        var missingErr = new Error(diag.error_message);
        missingErr.code = "22023";
        missingErr.__softDeleteDiag = diag;
        throw missingErr;
    }

    var rpc = await client.rpc("aurora_soft_delete_project_evidence", {
        p_metadata_id: metadataId
    });

    if (rpc.error) {
        diag.error_code = rpc.error.code || null;
        diag.error_message = rpc.error.message || String(rpc.error);
        diag.proof = "rpc_error";
        var err = rpc.error;
        err.__softDeleteDiag = diag;
        throw err;
    }

    var rows = Array.isArray(rpc.data) ? rpc.data : (rpc.data ? [rpc.data] : []);
    var row = rows[0] || null;
    diag.row_count = rows.length;
    if (row) {
        diag.returned_id = row.id || null;
        diag.returned_sync_status = row.sync_status || null;
        diag.returned_deleted_at = row.deleted_at || null;
        diag.returned_evidence_id = row.evidence_id || null;
    }

    if (
        !row ||
        String(row.sync_status || "") !== "deleted" ||
        row.deleted_at == null ||
        row.deleted_at === ""
    ) {
        diag.error_message = "AURORA_EVIDENCE_SOFT_DELETE_RPC_NO_PROOF";
        diag.proof = "rpc_no_proof";
        var proofErr = new Error(diag.error_message);
        proofErr.code = "P0002";
        proofErr.__softDeleteDiag = diag;
        throw proofErr;
    }

    diag.success = true;
    diag.proof = "rpc_ok";
    return diag;
}

async function uploadBlob(client, path, blob, mime) {
    var result = await client.storage.from(BUCKET).upload(path, blob, {
        upsert: true,
        contentType: mime,
        cacheControl: "3600"
    });
    if (result.error) throw result.error;
    return true;
}

async function removeObjectSafe(client, path) {
    try {
        var result = await client.storage.from(BUCKET).remove([path]);
        if (result.error) {
            return { ok: false, error_code: result.error.code || null, error_message: result.error.message || String(result.error) };
        }
        return { ok: true, error_code: null, error_message: null };
    } catch (error) {
        return {
            ok: false,
            error_code: error && error.code ? error.code : null,
            error_message: error && error.message ? String(error.message) : String(error)
        };
    }
}

/**
 * Sync evidências do case local → Storage + aurora_project_evidence.
 * @param {object} options
 * @param {object} options.client - supabase client autenticado
 * @param {object} options.caseData - case local
 * @param {string} options.projectId - UUID cloud
 * @param {string} [options.companyId] - UUID company do projeto cloud (se já conhecido)
 */
async function syncCaseEvidence(options) {
    options = options || {};
    var summary = emptySummary();

    if (!isUploadEnabled()) {
        return emptySummary({ skipped: true, reason: "flag_off" });
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return emptySummary({ skipped: true, reason: "offline" });
    }

    var client = options.client;
    var caseData = options.caseData;
    var projectId = options.projectId;

    if (!client || typeof client.from !== "function" || typeof client.storage === "undefined") {
        return emptySummary({ skipped: true, reason: "AURORA_BACKEND_UNAVAILABLE" });
    }
    if (!caseData || !caseData.id) {
        return emptySummary({ skipped: true, reason: "AURORA_CASE_MISSING" });
    }
    if (!projectId) {
        return emptySummary({ skipped: true, reason: "AURORA_PROJECT_ID_MISSING" });
    }
    var project = null;
    try {
        project = await fetchProjectRow(client, projectId);
    } catch (error) {
        summary.failed += 1;
        summary.failures.push({ stage: "project_fetch", message: String(error && error.message || error) });
        return summary;
    }

    if (!project) {
        summary.failed += 1;
        summary.failures.push({ stage: "project_fetch", message: "AURORA_PROJECT_NOT_FOUND" });
        return summary;
    }

    var companyId = project.company_id || options.companyId || null;
    if (!companyId) {
        summary.failed += 1;
        summary.failures.push({
            stage: "company",
            message: "AURORA_EVIDENCE_COMPANY_REQUIRED"
        });
        summary.warnings.push("Projeto sem company_id — fotos locais preservadas; upload adiado.");
        return summary;
    }

    var local = await listLocalPhotos(String(caseData.id));
    if (!local.ok) {
        summary.warnings.push(local.reason || "evidence_store_unavailable");
        return summary;
    }

    var remote = [];
    try {
        remote = await fetchRemoteEvidence(client, projectId);
    } catch (error) {
        summary.failed += 1;
        summary.failures.push({ stage: "metadata_list", message: String(error && error.message || error) });
        return summary;
    }

    var remoteByEvidence = {};
    remote.forEach(function (row) {
        if (row && row.evidence_id) remoteByEvidence[String(row.evidence_id)] = row;
    });

    var localIds = {};
    summary.total = local.photos.length;
    /** TEMPORÁRIO — STORAGE-B DIAG (somente console; não altera sync). */
    var diagRows = [];

    for (var i = 0; i < local.photos.length; i += 1) {
        var item = local.photos[i];
        try {
            if (!evidenceIdValid(item.evidence_id)) {
                summary.failed += 1;
                summary.failures.push({
                    evidence_id: item.evidence_id || null,
                    message: "AURORA_EVIDENCE_ID_MISSING"
                });
                continue;
            }
            localIds[item.evidence_id] = true;

            if (!item.source) {
                summary.failed += 1;
                summary.failures.push({
                    evidence_id: item.evidence_id,
                    message: "AURORA_EVIDENCE_SOURCE_EMPTY"
                });
                continue;
            }

            var parsed = parseDataUrl(item.source);
            if (!parsed) {
                summary.failed += 1;
                summary.failures.push({
                    evidence_id: item.evidence_id,
                    message: "AURORA_EVIDENCE_MIME_OR_DATAURL_INVALID"
                });
                continue;
            }

            var hash = await sha256Hex(parsed.blob);
            var path = buildCanonicalPath(companyId, projectId, item.evidence_id, parsed.mime);
            if (!path) {
                summary.failed += 1;
                summary.failures.push({
                    evidence_id: item.evidence_id,
                    message: "AURORA_EVIDENCE_PATH_INVALID"
                });
                continue;
            }

            /* DIAG: Blob já preparado — antes de skip/upload. Sem dataURL/bytes. */
            var diagEntry = {
                group_id: item.group_id,
                photo_id: item.evidence_id,
                photo_index: item.photo_index,
                source_kind: item.source_kind || "src",
                source_prefix: safeSourcePrefix(item.source),
                source_length: String(item.source || "").length,
                photo_width: item.width,
                photo_height: item.height,
                blob_type: parsed.blob.type || parsed.mime || "",
                blob_size: parsed.blob.size,
                blob_sha256: hash,
                storage_path: path
            };
            diagRows.push(diagEntry);
            try {
                console.log("[STORAGE-B DIAG]", diagEntry);
            } catch (diagLogError) { /* ignore */ }

            var existing = remoteByEvidence[item.evidence_id];
            if (
                existing &&
                existing.sync_status === "uploaded" &&
                String(existing.content_hash || "") === hash &&
                String(existing.storage_path || "") === path
            ) {
                summary.already_synced += 1;
                continue;
            }

            await uploadBlob(client, path, parsed.blob, parsed.mime);

            var metaResult;
            try {
                metaResult = await upsertMetadata(client, {
                    project_id: projectId,
                    group_id: item.group_id,
                    evidence_id: item.evidence_id,
                    storage_path: path,
                    mime_type: parsed.mime,
                    file_name: "v1." + extForMime(parsed.mime),
                    byte_size: parsed.blob.size,
                    width: Number.isFinite(item.width) ? item.width : null,
                    height: Number.isFinite(item.height) ? item.height : null,
                    content_hash: hash
                });
            } catch (metaError) {
                summary.failed += 1;
                summary.failures.push({
                    evidence_id: item.evidence_id,
                    message: "AURORA_EVIDENCE_METADATA_AFTER_UPLOAD: " + String(metaError && metaError.message || metaError)
                });
                summary.warnings.push("Upload OK mas metadata falhou para " + item.evidence_id + " — reparável na próxima sync.");
                continue;
            }

            if (
                metaResult.previous_path &&
                metaResult.previous_path !== path
            ) {
                var removed = await removeObjectSafe(client, metaResult.previous_path);
                if (!(removed && removed.ok)) {
                    summary.warnings.push("orphan_candidate:" + metaResult.previous_path);
                }
            }

            if (existing) summary.updated += 1;
            else summary.uploaded += 1;
        } catch (error) {
            summary.failed += 1;
            summary.failures.push({
                evidence_id: item && item.evidence_id || null,
                message: String(error && error.message || error)
            });
        }
    }

    try {
        if (diagRows.length) {
            console.table(diagRows.map(function (row) {
                return {
                    photo_index: row.photo_index,
                    photo_id: row.photo_id,
                    source_kind: row.source_kind,
                    source_length: row.source_length,
                    width: row.photo_width,
                    height: row.photo_height,
                    blob_size: row.blob_size,
                    blob_sha256: row.blob_sha256,
                    storage_path: row.storage_path
                };
            }));
        }
        console.log("[STORAGE-B DIAG SUMMARY]", {
            photos_total: diagRows.length,
            unique_photo_ids: uniqueCount(diagRows.map(function (r) { return r.photo_id; })),
            unique_sources_length: uniqueCount(diagRows.map(function (r) { return r.source_length; })),
            unique_blob_hashes: uniqueCount(diagRows.map(function (r) { return r.blob_sha256; })),
            unique_paths: uniqueCount(diagRows.map(function (r) { return r.storage_path; }))
        });
    } catch (diagSummaryError) { /* ignore */ }

    /*
     * Soft-delete conservador: só se inventário local for confiável.
     * Se store vazio mas case ainda referencia fotos → ambíguo → não delete.
     */
    var caseRefs = Array.isArray(caseData.evidence_groups) ? caseData.evidence_groups : [];
    var refsClaimPhotos = caseRefs.some(function (g) {
        return g && Array.isArray(g.photos) && g.photos.some(function (p) {
            return p && (p.id || p.has_photo);
        });
    });
    var inventoryTrusted = !(local.groupCount === 0 && refsClaimPhotos);

    /* TEMPORÁRIO — STORAGE-B SOFT-DELETE DIAG */
    var softDiag = {
        project_id: projectId,
        case_id: String(caseData.id),
        inventoryTrusted: inventoryTrusted,
        local_photo_count: Object.keys(localIds).length,
        remote_photo_count: remote.length,
        local_evidence_ids: Object.keys(localIds),
        should_delete_count: 0,
        soft_delete_calls: 0,
        soft_delete_row_success: 0,
        soft_delete_zero_rows: 0,
        soft_delete_errors: 0,
        storage_remove_calls: 0,
        storage_remove_success: 0,
        storage_remove_errors: 0,
        warnings_count: 0
    };
    try {
        console.log("[STORAGE-B SOFT-DELETE DIAG]", {
            event: "reconcile_start",
            case_id: softDiag.case_id,
            project_id: softDiag.project_id,
            inventoryTrusted: softDiag.inventoryTrusted,
            local_photo_count: softDiag.local_photo_count,
            remote_photo_count: softDiag.remote_photo_count,
            local_evidence_ids: softDiag.local_evidence_ids.slice()
        });
    } catch (e0) { /* ignore */ }

    if (inventoryTrusted) {
        for (var r = 0; r < remote.length; r += 1) {
            var remoteRow = remote[r];
            if (!remoteRow || !remoteRow.evidence_id) continue;
            var evidenceId = String(remoteRow.evidence_id);
            var localPresent = Boolean(localIds[evidenceId]);
            var shouldDelete = inventoryTrusted && !localPresent;

            try {
                console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                    event: "remote_row",
                    metadata_id: remoteRow.id || null,
                    evidence_id: evidenceId,
                    group_id: remoteRow.group_id || null,
                    sync_status: remoteRow.sync_status || null,
                    deleted_at: remoteRow.deleted_at || null,
                    storage_path: remoteRow.storage_path || null,
                    local_present: localPresent,
                    should_delete: shouldDelete
                });
            } catch (e1) { /* ignore */ }

            if (localPresent) continue;
            softDiag.should_delete_count += 1;

            try {
                try {
                    console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                        event: "soft_delete_rpc_call",
                        project_id: projectId,
                        metadata_id: remoteRow.id || null,
                        evidence_id: evidenceId,
                        storage_path: remoteRow.storage_path || null
                    });
                } catch (e2) { /* ignore */ }

                softDiag.soft_delete_calls += 1;
                /* remoteRow.id = UUID metadata; NÃO evidence_id */
                var deleteDiag = await softDeleteMetadata(client, remoteRow.id);

                try {
                    console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                        event: "soft_delete_rpc_result",
                        success: true,
                        metadata_id: remoteRow.id || null,
                        evidence_id: evidenceId,
                        error_code: null,
                        error_message: null,
                        row_count: deleteDiag && deleteDiag.row_count,
                        returned_id: deleteDiag && deleteDiag.returned_id || null,
                        returned_sync_status: deleteDiag && deleteDiag.returned_sync_status || null,
                        returned_deleted_at: deleteDiag && deleteDiag.returned_deleted_at || null,
                        proof: deleteDiag && deleteDiag.proof || null
                    });
                } catch (e3) { /* ignore */ }

                if (deleteDiag && deleteDiag.success) softDiag.soft_delete_row_success += 1;
                else softDiag.soft_delete_zero_rows += 1;

                /* Somente após RPC OK: remover objeto Storage. */
                if (remoteRow.storage_path) {
                    try {
                        console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                            event: "storage_remove_call",
                            evidence_id: evidenceId,
                            storage_path: remoteRow.storage_path
                        });
                    } catch (e4) { /* ignore */ }

                    softDiag.storage_remove_calls += 1;
                    var removeResult = await removeObjectSafe(client, remoteRow.storage_path);
                    var removeOk = removeResult && removeResult.ok === true;
                    try {
                        console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                            event: "storage_remove_result",
                            evidence_id: evidenceId,
                            success: removeOk,
                            error_code: removeResult && removeResult.error_code || null,
                            error_message: removeResult && removeResult.error_message || null
                        });
                    } catch (e5) { /* ignore */ }

                    if (removeOk) softDiag.storage_remove_success += 1;
                    else {
                        softDiag.storage_remove_errors += 1;
                        softDiag.warnings_count += 1;
                        summary.warnings.push("orphan_candidate:" + remoteRow.storage_path);
                        try {
                            console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                                event: "warning",
                                warning_type: "orphan_candidate",
                                evidence_id: evidenceId,
                                message: "storage_remove_failed:" + remoteRow.storage_path
                            });
                        } catch (e6) { /* ignore */ }
                    }
                }
                summary.deleted += 1;
            } catch (delError) {
                /* RPC falhou: NÃO remover Storage; metadata permanece ativa. */
                softDiag.soft_delete_errors += 1;
                softDiag.warnings_count += 2;
                var delDiag = delError && delError.__softDeleteDiag ? delError.__softDeleteDiag : null;
                try {
                    console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                        event: "soft_delete_rpc_result",
                        success: false,
                        metadata_id: remoteRow.id || null,
                        evidence_id: evidenceId,
                        error_code: delDiag && delDiag.error_code || delError && delError.code || null,
                        error_message: delDiag && delDiag.error_message || (delError && delError.message ? String(delError.message) : String(delError)),
                        row_count: delDiag && delDiag.row_count,
                        returned_id: delDiag && delDiag.returned_id || null,
                        returned_sync_status: delDiag && delDiag.returned_sync_status || null,
                        returned_deleted_at: delDiag && delDiag.returned_deleted_at || null,
                        proof: delDiag && delDiag.proof || "rpc_error"
                    });
                    console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                        event: "warning",
                        warning_type: "soft_delete_failed",
                        evidence_id: evidenceId,
                        message: delError && delError.message ? String(delError.message) : String(delError)
                    });
                } catch (e7) { /* ignore */ }
                summary.warnings.push("soft_delete_failed:" + remoteRow.evidence_id);
                summary.warnings.push("orphan_candidate:" + (remoteRow.storage_path || remoteRow.evidence_id));
            }
        }
    } else {
        softDiag.warnings_count += 1;
        summary.warnings.push("orphan_candidate:ambiguous_local_inventory");
        try {
            console.log("[STORAGE-B SOFT-DELETE DIAG]", {
                event: "warning",
                warning_type: "ambiguous_local_inventory",
                evidence_id: null,
                message: "inventoryTrusted=false"
            });
        } catch (e8) { /* ignore */ }
    }

    try {
        console.log("[STORAGE-B SOFT-DELETE DIAG SUMMARY]", softDiag);
    } catch (e9) { /* ignore */ }

    return summary;
}

function summarizeForUi(summary) {
    if (!summary || summary.skipped) return null;
    if (summary.failed > 0) {
        return "Projeto sincronizado; algumas fotos não foram enviadas.";
    }
    if (summary.uploaded > 0 || summary.updated > 0 || summary.deleted > 0) {
        return null;
    }
    return null;
}

global.AuroraEvidenceCloudSync = {
    FLAG_NAME: FLAG_NAME,
    isEnabled: isUploadEnabled,
    syncCaseEvidence: syncCaseEvidence,
    summarizeForUi: summarizeForUi,
    /* test helpers (flag OFF must never call storage) */
    _internals: {
        isEletricaTupyCase: isEletricaTupyCase,
        parseDataUrl: parseDataUrl,
        buildCanonicalPath: buildCanonicalPath,
        extForMime: extForMime
    }
};

})(window);

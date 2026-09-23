(function (global) {
"use strict";

class LocalCaseRepository {
    constructor(options = {}) {
        this.storageKey =
            options.storageKey ||
            "aurora_v2_current_case";

        this.memoryFallback = null;
    }

    save(caseData) {
        const hr = global.AuroraHomeReturnTrace;
        const beforeRepo = hr ? hr.repositoryCaseSnapshot() : null;
        const runtimeCase = hr ? hr.runtimeCaseSnapshot() : null;
        let persistResult = "OK";
        let envelope = null;

        const copy =
            this._compactForStorage(caseData);

        envelope = {
            version: 1,
            saved_at:
                new Date().toISOString(),
            case:
                copy
        };

        try {
            localStorage.setItem(
                this.storageKey,
                JSON.stringify(envelope)
            );
        } catch (error) {
            this.memoryFallback =
                this._clone(envelope);
            persistResult = `FALLBACK:${String(error && error.name ? error.name : "error")}`;
        }

        if (hr) {
            const afterRepo = hr.repositoryCaseSnapshot();
            hr.logHR3({
                caseId:
                    (caseData && caseData.id != null
                        ? String(caseData.id)
                        : afterRepo.id) || runtimeCase.id,
                persist: persistResult,
                origin: hr.shortStack(2),
                currentIndex: runtimeCase.index,
                repositoryCaseBefore: beforeRepo && beforeRepo.exists ? "SIM" : "NAO",
                repositoryCaseAfter: afterRepo && afterRepo.exists ? "SIM" : "NAO"
            });
        }

        return this._clone(envelope);
    }

    load() {
        let envelope = null;

        try {
            const raw =
                localStorage.getItem(
                    this.storageKey
                );

            envelope =
                raw
                    ? JSON.parse(raw)
                    : null;
        } catch (error) {
            envelope =
                this.memoryFallback;
        }

        if (
            !envelope ||
            typeof envelope !== "object" ||
            !envelope.case
        ) {
            return null;
        }

        return this._clone(envelope);
    }

    hasSavedCase() {
        return Boolean(
            this.load()
        );
    }

    clear() {
        const hr = global.AuroraHomeReturnTrace;
        const beforeRepo = hr ? hr.repositoryCaseSnapshot() : null;
        const runtimeCase = hr ? hr.runtimeCaseSnapshot() : null;

        try {
            localStorage.removeItem(
                this.storageKey
            );
        } catch (error) {
            // Ignore unavailable storage.
        }

        this.memoryFallback = null;

        if (hr) {
            hr.logHR7({
                operation: "CLEAR_CASE",
                caseIdBefore: beforeRepo && beforeRepo.id ? beforeRepo.id : runtimeCase.id,
                caseIdAfter: "",
                origin: hr.shortStack(2),
                currentIndex: runtimeCase.index
            });
        }
    }

    exportJSON() {
        const envelope =
            this.load();

        return envelope
            ? JSON.stringify(
                envelope,
                null,
                2
            )
            : null;
    }

    _clone(value) {
        if (value === undefined) {
            return undefined;
        }

        return JSON.parse(
            JSON.stringify(value)
        );
    }

    _compactForStorage(caseData) {
        const source = caseData || {};
        const copy = { ...source };

        /*
         * As fotos completas são persistidas pelo EvidenceStore (IndexedDB).
         * O localStorage guarda apenas referências leves. Isso evita que o
         * WebView serialize várias cópias Base64 e seja reiniciado por falta
         * de memória ao concluir as últimas fotos da vistoria.
         */
        if (Array.isArray(source.evidence_groups)) {
            copy.evidence_groups = source.evidence_groups.map((group) => ({
                ...group,
                photos: Array.isArray(group && group.photos)
                    ? group.photos.map((photo) => ({
                        id: photo.id || null,
                        title: photo.title || "",
                        description: photo.description || "",
                        category: photo.category || "general",
                        created_at: photo.created_at || null,
                        has_photo: Boolean(photo.src || photo.edited_src)
                    }))
                    : []
            }));
        }

        if (Array.isArray(source.evidences)) {
            copy.evidences = source.evidences.map((photo) => ({
                ...photo,
                src: null,
                original_src: null,
                edited_src: null
            }));
        }

        if (source.coverPhoto && typeof source.coverPhoto === "object") {
            copy.coverPhoto = {
                id: source.coverPhoto.id || null,
                alt: source.coverPhoto.alt || "",
                has_photo: Boolean(
                    source.coverPhoto.src ||
                    source.coverPhoto.edited_src ||
                    source.coverPhoto.has_photo
                ),
                created_at: source.coverPhoto.created_at || null,
                source_photo_id: source.coverPhoto.source_photo_id || null
            };
        } else {
            delete copy.coverPhoto;
            delete copy.cover_photo;
        }

        return this._clone(copy);
    }
}

global.LocalCaseRepository =
    LocalCaseRepository;

})(window);

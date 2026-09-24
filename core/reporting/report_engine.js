(function (global) {
"use strict";

class ReportEngine {
    constructor(options = {}) {
        this.storageKey =
            options.storageKey ||
            "aurora_reports";

        this.companyProvider =
            typeof options.companyProvider === "function"
                ? options.companyProvider
                : () => ({
                    company: "Aurora Inspector",
                    professional: "Usuário"
                });

        /*
         * Relatórios completos, incluindo imagens base64, permanecem
         * apenas na memória da sessão. O localStorage recebe uma versão
         * compacta para não ultrapassar a cota do navegador.
         */
        this.runtimeReports =
            new Map();

        /* R27 — estado da última tentativa de persistência. Não substitui o
         * storage; apenas torna observável se save() ficou somente em sessão. */
        this.lastSavePersistence = null;
    }

    list() {
        try {
            const raw =
                localStorage.getItem(
                    this.storageKey
                );

            const reports =
                raw
                    ? JSON.parse(raw)
                    : [];

            return Array.isArray(reports)
                ? reports
                : [];
        } catch (error) {
            return [];
        }
    }

    getPersistent(reportId) {
        const key = String(reportId);
        return (
            this.list().find(
                (report) => String(report.id) === key
            ) || null
        );
    }

    get(reportId) {
        const key =
            String(reportId);

        if (
            this.runtimeReports.has(
                key
            )
        ) {
            return this._clone(
                this.runtimeReports.get(
                    key
                )
            );
        }

        return (
            this.list().find(
                (report) =>
                    String(report.id) ===
                    key
            ) ||
            null
        );
    }

    createFromCase(
        caseData,
        options = {}
    ) {
        if (
            !caseData ||
            typeof caseData !== "object"
        ) {
            throw new Error(
                "ReportEngine requires valid case data."
            );
        }

        const identity =
            this.companyProvider() || {};

        const companyFromIdentity =
            global.AuroraReportCompanyIdentity &&
            typeof global.AuroraReportCompanyIdentity.buildCompanyFromIdentity ===
                "function"
                ? global.AuroraReportCompanyIdentity.buildCompanyFromIdentity(
                    identity
                )
                : {
                    name:
                        String(identity.company || "").trim() ||
                        "AURORA",
                    professional:
                        String(identity.professional || "").trim() ||
                        "Usuário",
                    phone: identity.phone || "",
                    whatsapp: identity.whatsapp || "",
                    email: identity.email || "",
                    city: identity.city || "",
                    state: identity.state || "",
                    address: identity.address || "",
                    zip_code: identity.zip_code || "",
                    document: identity.document || "",
                    registration: identity.registration || "",
                    website: identity.website || "",
                    description: identity.description || "",
                    specialties: identity.specialties || "",
                    logo: identity.logo || ""
                };

        const occurrences =
            this._normalizeOccurrences(
                caseData
            );

        const evidences =
            occurrences.flatMap(
                (occurrence) =>
                    occurrence.photos
            );

        const createdAt =
            options.createdAt ||
            new Date().toISOString();

        const updatedAt =
            options.updatedAt ||
            new Date().toISOString();

        /*
         * AURORA V33 — LEI GLOBAL DE ÚLTIMA ALTERAÇÃO
         *
         * O timestamp exibido em Atendimentos recentes representa a última
         * geração/alteração efetiva do atendimento, nunca a data original da
         * vistoria. O mesmo instante precisa existir no caso, no snapshot e no
         * relatório para que localStorage, nuvem e telas corporativas não
         * disputem fontes de tempo diferentes.
         *
         * createFromCase é o ponto canônico compartilhado por todos os
         * serviços que emitem relatório. Atualizamos o próprio caseData antes
         * de criar o snapshot; assim, qualquer sincronização executada logo
         * após a geração recebe exatamente o mesmo updated_at.
         */
        caseData.updated_at = updatedAt;
        try { const api = global.AuroraTraceV35 || global.AuroraBoltTraceV140; api && api.mark && api.mark("V35 REPORT_CREATE_INPUT", { id: caseData.id, updated_at: updatedAt, customer: caseData.customer || {} }); } catch (_) {}
        if (String(options.status || "Concluído") === "Concluído") {
            caseData.completed_at = updatedAt;
        }

        const report = {
            version:
                Number(
                    options.version ||
                    1
                ),
            id:
                options.id ||
                caseData.id ||
                `ATD-${Date.now()}`,
            public_id:
                options.publicId ||
                this._nextPublicId(
                    createdAt
                ),
            status:
                options.status ||
                "Concluído",
            created_at:
                createdAt,
            updated_at:
                updatedAt,
            profile_id:
                caseData.profile_id ||
                caseData.module_id ||
                (caseData.service && (caseData.service.profile || caseData.service.profile_id)) ||
                "",
            module_id:
                caseData.module_id ||
                caseData.profile_id ||
                (caseData.service && (caseData.service.profile || caseData.service.profile_id)) ||
                "",
            service_id:
                caseData.service && caseData.service.id
                    ? String(caseData.service.id)
                    : "",
            company: companyFromIdentity,
            operation_type: caseData.operation_type || (caseData.service && caseData.service.operation_type) || "inspection",
            flow_template: caseData.flow_template || (caseData.service && caseData.service.flow_template) || "technical",
            operation_type_label: caseData.operation_type_label || "Operação técnica",
            record_section_title: caseData.record_section_title || (caseData.service && caseData.service.record_section_title) || "Registros técnicos",
            report_title:
                String(
                    (caseData.approval && caseData.approval.report_title) ||
                    ""
                ).trim(),
            template: "legacy",
            show_severity:
                !caseData.approval || caseData.approval.show_severity !== "Não",
            show_record_labels:
                !caseData.approval || caseData.approval.show_record_labels !== "Não",
            custom_values: this._clone(caseData.custom_values || {}),
            service:
                this._clone(
                    caseData.service || {
                        id: "inspection",
                        title: "Inspeção",
                        profile:
                            caseData.profile_id ||
                            "workshop"
                    }
                ),
            customer:
                this._clone(
                    caseData.customer || {}
                ),
            asset:
                this._clone(
                    caseData.asset || {}
                ),
            intake:
                this._clone(
                    caseData.intake || {}
                ),
            occurrence:
                this._clone(
                    caseData.occurrence || {}
                ),
            occurrences,
            diagnostic:
                this._clone(
                    caseData.diagnostic || {}
                ),
            approval:
                this._clone(
                    caseData.approval || {}
                ),
            budget:
                this._clone(
                    caseData.budget || {}
                ),
            coverPhoto:
                this._normalizeCoverPhoto(
                    caseData.coverPhoto ||
                    caseData.cover_photo ||
                    options.coverPhoto
                ),
            performed_by_user_id:
                caseData.performed_by_user_id ||
                null,
            performed_by_name:
                String(caseData.performed_by_name || "").trim(),
            user_id:
                caseData.user_id ||
                null,
            company_id:
                caseData.company_id ||
                null,
            evidences,
            snapshot:
                this._clone(
                    caseData
                )
        };

        this.save(report);
        try { const api = global.AuroraTraceV35 || global.AuroraBoltTraceV140; api && api.mark && api.mark("V35 REPORT_SAVED", { id: report.id, report_updated_at: report.updated_at, snapshot_updated_at: report.snapshot && report.snapshot.updated_at, report_customer: report.customer || {}, snapshot_customer: report.snapshot && report.snapshot.customer || {} }); } catch (_) {}

        return this._clone(report);
    }

    _nextPublicId(createdAt) {
        const date =
            new Date(createdAt);

        const year =
            Number.isNaN(date.getTime())
                ? new Date().getFullYear()
                : date.getFullYear();

        const prefix =
            `AUR-${year}-`;

        const reports =
            this.list();

        const numbers =
            reports
                .map((report) =>
                    String(
                        report.public_id ||
                        ""
                    )
                )
                .filter((value) =>
                    value.startsWith(prefix)
                )
                .map((value) =>
                    Number(
                        value.slice(
                            prefix.length
                        )
                    )
                )
                .filter(Number.isFinite);

        const reportsThisYear =
            reports.filter(
                (report) => {
                    const reportDate =
                        new Date(
                            report.created_at
                        );

                    return (
                        !Number.isNaN(
                            reportDate.getTime()
                        ) &&
                        reportDate.getFullYear() ===
                            year
                    );
                }
            ).length;

        const sequence =
            Math.max(
                reportsThisYear,
                numbers.length
                    ? Math.max(...numbers)
                    : 0
            ) + 1;

        return `${prefix}${String(sequence).padStart(4, "0")}`;
    }

    save(report) {
        if (
            !report ||
            !report.id
        ) {
            throw new Error(
                "Report must have an id."
            );
        }

        const key =
            String(
                report.id
            );

        /*
         * Guarda a versão completa para a prévia atual.
         */
        this.runtimeReports.set(
            key,
            this._clone(report)
        );

        /*
         * Persiste apenas a versão compacta. Fotos completas continuam
         * no EvidenceStore/IndexedDB e não ocupam o localStorage.
         */
        const compactReport =
            this._compactReport(
                report
            );

        /* R59 — a autoridade persistente inteira é normalizada pelo mesmo
         * compactador canônico antes de substituir/inserir a revisão atual.
         * Versões antigas podiam permanecer com snapshots legados pesados
         * (inclusive assinaturas duplicadas), consumindo a cota e impedindo
         * que a revisão nova substituísse a anterior. Não apagamos relatórios
         * nem criamos storage paralelo: apenas recompactamos a coleção oficial. */
        const reports =
            this.list().map(
                (item) => this._compactReport(item)
            );

        const index =
            reports.findIndex(
                (item) =>
                    String(item.id) ===
                    key
            );

        if (index >= 0) {
            reports[index] =
                compactReport;
        } else {
            reports.unshift(
                compactReport
            );
        }

        let persistent = false;
        let persistenceError = null;

        try {
            localStorage.setItem(
                this.storageKey,
                JSON.stringify(reports)
            );
            persistent = true;
        } catch (error) {
            persistenceError = error;
            /*
             * Segunda tentativa removendo snapshots antigos, que podem
             * ter sido criados por versões anteriores com imagens.
             */
            try {
                const extraCompact =
                    reports.map(
                        (item) => this._compactReport(item)
                    );

                localStorage.setItem(
                    this.storageKey,
                    JSON.stringify(
                        extraCompact
                    )
                );
                persistent = true;
                persistenceError = null;
            } catch (secondError) {
                persistenceError = secondError;
                console.warn(
                    "Aurora ReportEngine: persistência compacta falhou; relatório mantido apenas na sessão.",
                    secondError &&
                    secondError.name,
                    secondError &&
                    secondError.message
                );
            }
        }

        this.lastSavePersistence = {
            report_id: key,
            persistent,
            error_name: persistenceError && persistenceError.name ? String(persistenceError.name) : null,
            error_message: persistenceError && persistenceError.message ? String(persistenceError.message) : null
        };

        return this._clone(report);
    }

    remove(reportId) {
        this.runtimeReports.delete(
            String(reportId)
        );

        const reports =
            this.list().filter(
                (report) =>
                    String(report.id) !==
                    String(reportId)
            );

        localStorage.setItem(
            this.storageKey,
            JSON.stringify(reports)
        );

        return reports.length;
    }

    _normalizeOccurrences(caseData) {
        const groups =
            Array.isArray(
                caseData.evidence_groups
            )
                ? caseData.evidence_groups
                : [];

        if (groups.length) {
            return groups.map(
                (group, groupIndex) => ({
                    id:
                        group.id ||
                        `occurrence-${groupIndex + 1}`,
                    title:
                        group.title ||
                        `Ocorrência ${groupIndex + 1}`,
                    item:
                        group.item ||
                        group.component ||
                        "",
                    severity:
                        group.severity ||
                        "Não informada",
                    description:
                        group.description ||
                        "",
                    recommendation:
                        group.recommendation ||
                        "",
                    record_kind:
                        group.record_kind ||
                        null,
                    vehicle_photo_slot:
                        group.vehicle_photo_slot ||
                        null,
                    created_at:
                        group.created_at ||
                        null,
                    saved_at:
                        group.saved_at ||
                        null,
                    photos:
                        this._normalizePhotos(
                            group.photos,
                            group,
                            groupIndex
                        )
                })
            );
        }

        const legacyOccurrence =
            caseData.occurrence &&
            typeof caseData.occurrence ===
                "object"
                ? caseData.occurrence
                : {};

        const legacyPhotos =
            this._normalizeEvidences(
                caseData.evidences
            );

        if (
            Object.keys(
                legacyOccurrence
            ).length ||
            legacyPhotos.length
        ) {
            return [
                {
                    id:
                        legacyOccurrence.id ||
                        "occurrence-1",
                    title:
                        legacyOccurrence.title ||
                        legacyOccurrence.item ||
                        "Ocorrência 1",
                    item:
                        legacyOccurrence.item ||
                        legacyOccurrence.component ||
                        "",
                    severity:
                        legacyOccurrence.severity ||
                        legacyOccurrence.risk ||
                        "Não informada",
                    description:
                        legacyOccurrence.description ||
                        legacyOccurrence.condition ||
                        "",
                    recommendation:
                        legacyOccurrence.recommendation ||
                        "",
                    photos:
                        legacyPhotos
                }
            ];
        }

        return [];
    }

    _normalizePhotos(
        photos,
        group,
        groupIndex
    ) {
        if (!Array.isArray(photos)) {
            return [];
        }

        return photos
            .map(
                (photo, photoIndex) => {
                    if (
                        typeof photo ===
                        "string"
                    ) {
                        return {
                            id:
                                `photo-${groupIndex + 1}-${photoIndex + 1}`,
                            title:
                                `${group.title || `Ocorrência ${groupIndex + 1}`} — Foto ${photoIndex + 1}`,
                            description:
                                group.description ||
                                "",
                            category:
                                "general",
                            occurrence_id:
                                group.id ||
                                null,
                            src:
                                photo
                        };
                    }

                    if (
                        !photo ||
                        typeof photo !==
                            "object"
                    ) {
                        return null;
                    }

                    return {
                        id:
                            photo.id ||
                            `photo-${groupIndex + 1}-${photoIndex + 1}`,
                        title:
                            photo.title ||
                            photo.name ||
                            photo.filename ||
                            `Foto ${photoIndex + 1}`,
                        description:
                            photo.description ||
                            "",
                        category:
                            photo.category ||
                            "general",
                        occurrence_id:
                            group.id ||
                            null,
                        occurrence_title:
                            group.title ||
                            "",
                        created_at:
                            photo.created_at ||
                            null,
                        /*
                         * A imagem editada sempre tem prioridade.
                         */
                        src:
                            photo.edited_src ||
                            photo.editedSrc ||
                            photo.edited ||
                            photo.data_url ||
                            photo.dataUrl ||
                            photo.src ||
                            photo.url ||
                            photo.preview ||
                            null,
                        width:
                            Number(photo.width) > 0
                                ? Number(photo.width)
                                : undefined,
                        height:
                            Number(photo.height) > 0
                                ? Number(photo.height)
                                : undefined
                    };
                }
            )
            .filter(
                (photo) =>
                    photo &&
                    this._isUsableImageSource(
                        photo.src
                    ) &&
                    !this._isInternalReportAsset(
                        photo.src,
                        photo,
                        group
                    )
            );
    }

    _isInternalReportAsset(
        src,
        photo,
        group
    ) {
        if (
            photo &&
            typeof photo === "object"
        ) {
            if (
                photo.is_guide === true ||
                photo.isGuide === true ||
                photo.internal_asset === true ||
                photo.report_excluded === true ||
                photo.category === "guide" ||
                photo.category === "orientation" ||
                photo.category === "ui_asset"
            ) {
                return true;
            }
        }

        const source =
            String(src || "")
                .trim()
                .toLowerCase();

        if (!source) {
            return true;
        }

        if (
            /orientacoes[_-]?avarias/i.test(
                source
            )
        ) {
            return true;
        }

        const isGuidedGroup =
            group &&
            group.record_kind ===
                "vehicle_guided_photo";

        if (isGuidedGroup) {
            return false;
        }

        if (
            /\/guided-photos\/[^/?#]*_ui\.(?:png|jpe?g|webp|svg)/i.test(
                source
            )
        ) {
            return true;
        }

        if (
            /\/guided-photos\/orientacoes/i.test(
                source
            )
        ) {
            return true;
        }

        return false;
    }

    _normalizeEvidences(value) {
        if (!Array.isArray(value)) {
            return [];
        }

        return value
            .map(
                (item, index) => {
                    if (
                        typeof item ===
                        "string"
                    ) {
                        return {
                            id:
                                `evidence-${index + 1}`,
                            title:
                                `Evidência ${index + 1}`,
                            src:
                                item
                        };
                    }

                    if (
                        item &&
                        typeof item ===
                            "object"
                    ) {
                        return {
                            id:
                                item.id ||
                                `evidence-${index + 1}`,
                            title:
                                item.title ||
                                item.name ||
                                item.filename ||
                                `Evidência ${index + 1}`,
                            description:
                                item.description ||
                                "",
                            category:
                                item.category ||
                                "general",
                            occurrence_id:
                                item.occurrence_id ||
                                null,
                            occurrence_title:
                                item.occurrence_title ||
                                "",
                            src:
                                item.edited_src ||
                                item.editedSrc ||
                                item.edited ||
                                item.src ||
                                item.data_url ||
                                item.dataUrl ||
                                item.url ||
                                item.preview ||
                                null
                        };
                    }

                    return null;
                }
            )
            .filter(
                (item) =>
                    item &&
                    this._isUsableImageSource(
                        item.src
                    ) &&
                    !this._isInternalReportAsset(
                        item.src,
                        item
                    )
            );
    }


    _isUsableImageSource(value) {
        if (
            typeof value !==
            "string"
        ) {
            return false;
        }

        const source =
            value.trim();

        if (!source) {
            return false;
        }

        /*
         * Fontes aceitas pela Aurora:
         *
         * - imagens base64;
         * - URLs blob do navegador;
         * - URLs HTTP/HTTPS;
         * - caminhos relativos e absolutos locais.
         *
         * Apenas nomes soltos de arquivos antigos são ignorados.
         */
        return (
            source.startsWith(
                "data:image/"
            ) ||
            source.startsWith(
                "blob:"
            ) ||
            source.startsWith(
                "http://"
            ) ||
            source.startsWith(
                "https://"
            ) ||
            source.startsWith(
                "./"
            ) ||
            source.startsWith(
                "../"
            ) ||
            source.startsWith(
                "/"
            )
        );
    }

    _compactReport(report) {
        const compact =
            this._clone(
                report
            );

        compact.evidences =
            [];

        /* Grounding: fotos pertencem ao EvidenceStore/Storage, nunca ao localStorage. */
        if (compact.grounding && Array.isArray(compact.grounding.points)) {
            compact.grounding.points = compact.grounding.points.map((point) => ({ ...point, photos: [] }));
        }
        if (compact.coverPhoto && compact.coverPhoto.src) compact.coverPhoto = { ...compact.coverPhoto, src: null };
        if (compact.cover_photo && compact.cover_photo.src) compact.cover_photo = { ...compact.cover_photo, src: null };

        compact.occurrences =
            Array.isArray(
                compact.occurrences
            )
                ? compact.occurrences.map(
                    (occurrence) => ({
                        ...occurrence,
                        photos:
                            Array.isArray(
                                occurrence.photos
                            )
                                ? occurrence.photos.map(
                                    (photo) => ({
                                        id:
                                            photo.id ||
                                            null,
                                        title:
                                            photo.title ||
                                            "",
                                        description:
                                            photo.description ||
                                            "",
                                        category:
                                            photo.category ||
                                            "general",
                                        occurrence_id:
                                            photo.occurrence_id ||
                                            occurrence.id ||
                                            null,
                                        created_at:
                                            photo.created_at ||
                                            null,
                                        src:
                                            null,
                                        edited_src:
                                            null
                                    })
                                )
                                : []
                    })
                )
                : [];

        compact.snapshot =
            this._compactCase(
                compact.snapshot ||
                {}
            );

        /* R55 — assinatura confirmada já possui autoridade persistente em
         * report.approval.signature_data. Não duplicar o mesmo PNG/base64
         * dentro de snapshot.approval: durante a finalização offline as duas
         * cópias coexistiam com aurora_v2_current_case e podiam fazer a nova
         * revisão ultrapassar a cota, deixando no storage a revisão anterior.
         * O relatório mantém a assinatura no campo canônico de approval. */
        if (compact.snapshot && compact.snapshot.approval) {
            compact.snapshot.approval = {
                ...compact.snapshot.approval,
                signature_data: ""
            };
        }

        /* R56 — a assinatura desta tela pertence ao módulo Budget e sua
         * autoridade persistente é report.budget.signature_data. A R55
         * compactava approval, mas não budget; por isso a mesma imagem PNG
         * continuava duplicada em report.budget e snapshot.budget. */
        if (compact.snapshot && compact.snapshot.budget) {
            compact.snapshot.budget = {
                ...compact.snapshot.budget,
                signature_data: ""
            };
        }

        return compact;
    }

    _compactCase(caseData) {
        const compact =
            this._clone(
                caseData ||
                {}
            );

        compact.evidences =
            [];

        if (
            Array.isArray(
                compact.evidence_groups
            )
        ) {
            compact.evidence_groups =
                compact.evidence_groups.map(
                    (group) => ({
                        ...group,
                        photos:
                            Array.isArray(
                                group.photos
                            )
                                ? group.photos.map(
                                    (photo) => ({
                                        id:
                                            photo.id ||
                                            null,
                                        title:
                                            photo.title ||
                                            "",
                                        description:
                                            photo.description ||
                                            "",
                                        category:
                                            photo.category ||
                                            "general",
                                        created_at:
                                            photo.created_at ||
                                            null
                                    })
                                )
                                : []
                    })
                );
        }

        return compact;
    }

    _normalizeCoverPhoto(raw) {
        if (!raw || typeof raw !== "object") {
            return null;
        }

        const src = String(
            raw.src ||
            raw.url ||
            raw.href ||
            ""
        ).trim();

        if (!src) {
            return null;
        }

        const normalized = {
            src,
            alt: String(raw.alt || raw.description || "").trim()
        };

        if (Number(raw.width) > 0) {
            normalized.width = Number(raw.width);
        }

        if (Number(raw.height) > 0) {
            normalized.height = Number(raw.height);
        }

        return normalized;
    }

    _clone(value) {
        if (value === undefined) {
            return undefined;
        }

        return JSON.parse(
            JSON.stringify(value)
        );
    }
}

global.ReportEngine =
    ReportEngine;

})(window);

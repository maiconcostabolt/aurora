(function (global) {
"use strict";

const STORAGE_KEY =
    "aurora_company_identity_rc1_5";

function getIdentity() {
    try {
        const raw =
            localStorage.getItem(
                STORAGE_KEY
            );

        return raw
            ? JSON.parse(raw)
            : {};
    } catch (error) {
        return {};
    }
}

function notify(message) {
    const status =
        document.getElementById(
            "app-status"
        );

    if (!status) {
        console.log(message);
        return;
    }

    status.textContent =
        message;
    status.classList.add(
        "is-visible"
    );

    clearTimeout(
        notify.timer
    );

    notify.timer =
        setTimeout(
            () => {
                status.classList.remove(
                    "is-visible"
                );
            },
            2400
        );
}

const engine =
    new global.ReportEngine({
        storageKey:
            "aurora_reports",
        companyProvider:
            getIdentity
    });

const preview =
    new global.ReportPreview({
        engine,
        onNotify:
            notify
    });

if (global.AuroraPdfExperimental && typeof global.AuroraPdfExperimental.registerConsoleHelper === "function") {
    global.AuroraPdfExperimental.registerConsoleHelper(preview);
}

if (global.AuroraPdfLocalTest && typeof global.AuroraPdfLocalTest.registerConsoleHelper === "function") {
    global.AuroraPdfLocalTest.registerConsoleHelper(preview);
}

function runtime() {
    return global.auroraRuntime ||
        null;
}

function installFinalizeButton() {
    /*
     * RC1.4: a finalização pertence ao botão oficial do workflow.
     * Mantemos a função vazia para compatibilidade com os listeners
     * antigos e evitamos um segundo botão dentro do formulário.
     */
}

document.addEventListener(
    "click",
    (event) => {
        const button =
            event.target.closest(
                "[data-report-preview]"
            );

        if (!button) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        preview.open(
            button.dataset.reportPreview
        );
    },
    true
);

function clone(value) {
    return JSON.parse(
        JSON.stringify(value)
    );
}

async function hydrateCoverPhoto(caseData) {
    if (
        global.AuroraCoverPhotoFeature &&
        typeof global.AuroraCoverPhotoFeature.hydrateCoverPhoto ===
            "function"
    ) {
        return global.AuroraCoverPhotoFeature.hydrateCoverPhoto(
            caseData
        );
    }

    return clone(caseData);
}

async function hydrateEvidenceGroups(
    caseData
) {
    const hydrated =
        clone(
            caseData
        );

    const references =
        Array.isArray(
            hydrated.evidence_groups
        )
            ? hydrated.evidence_groups
            : [];

    if (!references.length) {
        return hydrated;
    }

    const store =
        global.auroraEvidenceStore;

    if (
        !store ||
        typeof store.get !==
            "function"
    ) {
        return hydrated;
    }

    const groups =
        [];

    for (
        const reference of
        references
    ) {
        if (
            !reference ||
            !reference.id
        ) {
            continue;
        }

        let stored =
            null;

        try {
            stored =
                await store.get(
                    reference.id
                );
        } catch (error) {
            console.warn(
                "Aurora Report: não foi possível carregar as fotos da ocorrência.",
                reference.id,
                error
            );
        }

        /*
         * O IndexedDB guarda a ocorrência completa, incluindo src e
         * edited_src. O localStorage guarda apenas o estado leve.
         * Mesclamos os dois, dando prioridade às fotos do IndexedDB.
         */
        const group =
            stored
                ? {
                    ...reference,
                    ...stored,
                    photos:
                        Array.isArray(
                            stored.photos
                        )
                            ? stored.photos
                            : (
                                Array.isArray(
                                    reference.photos
                                )
                                    ? reference.photos
                                    : []
                            )
                }
                : reference;

        if (
            group.case_id &&
            hydrated.id &&
            String(
                group.case_id
            ) !==
            String(
                hydrated.id
            )
        ) {
            continue;
        }

        groups.push(
            group
        );
    }

    hydrated.evidence_groups =
        groups;

    hydrated.evidences =
        groups.flatMap(
            (group) =>
                (
                    Array.isArray(
                        group.photos
                    )
                        ? group.photos
                        : []
                ).map(
                    (photo, index) => ({
                        id:
                            photo.id,
                        title:
                            photo.title ||
                            `${group.title || "Ocorrência"} — Foto ${index + 1}`,
                        description:
                            photo.description ||
                            group.description ||
                            "",
                        category:
                            photo.category ||
                            "general",
                        occurrence_id:
                            group.id,
                        occurrence_title:
                            group.title ||
                            "",
                        occurrence_item:
                            group.item ||
                            "",
                        occurrence_severity:
                            group.severity ||
                            "",
                        occurrence_recommendation:
                            group.recommendation ||
                            "",
                        created_at:
                            photo.created_at ||
                            null,
                        edited_src:
                            photo.edited_src ||
                            null,
                        src:
                            photo.edited_src ||
                            photo.src ||
                            null
                    })
                )
        );

    return hydrated;
}

function createNextCaseId() {
    const now =
        new Date();

    const date =
        [
            now.getFullYear(),
            String(
                now.getMonth() + 1
            ).padStart(2, "0"),
            String(
                now.getDate()
            ).padStart(2, "0")
        ].join("");

    const time =
        [
            String(
                now.getHours()
            ).padStart(2, "0"),
            String(
                now.getMinutes()
            ).padStart(2, "0"),
            String(
                now.getSeconds()
            ).padStart(2, "0")
        ].join("");

    const suffix =
        Math.random()
            .toString(36)
            .slice(2, 6)
            .toUpperCase();

    return [
        "ATD",
        date,
        time,
        suffix
    ].join("-");
}

function uniqueReportId(
    requestedId,
    engine
) {
    const base =
        requestedId ||
        `ATD-${Date.now()}`;

    if (
        !engine ||
        typeof engine.get !== "function" ||
        !engine.get(base)
    ) {
        return base;
    }

    return [
        base,
        Date.now().toString(36)
            .toUpperCase()
    ].join("-");
}

function findExistingReportForCase(
    caseData,
    engine
) {
    if (
        !caseData ||
        !engine ||
        typeof engine.list !== "function"
    ) {
        return null;
    }

    const caseId = String(
        caseData.id || ""
    ).trim();

    if (!caseId) {
        return null;
    }

    if (
        typeof engine.get === "function"
    ) {
        const direct =
            engine.get(caseId);

        if (direct) {
            return direct;
        }
    }

    const reports =
        engine.list();

    return (
        reports.find(
            (report) =>
                String(
                    report.id || ""
                ) === caseId ||
                String(
                    report.snapshot &&
                    report.snapshot.id ||
                    ""
                ) === caseId ||
                String(
                    report.case_id ||
                    ""
                ) === caseId
        ) || null
    );
}

function logEditFinalize(
    eventName,
    payload
) {
    if (payload !== undefined) {
        console.log(
            "AURORA_EDIT_FINALIZE",
            eventName,
            payload
        );
        return;
    }

    console.log(
        "AURORA_EDIT_FINALIZE",
        eventName
    );
}

function normalizeYesNo(
    value,
    fallback = "Sim"
) {
    if (
        global.AuroraDiagnosticConclusion &&
        typeof global.AuroraDiagnosticConclusion.normalizeYesNo ===
            "function"
    ) {
        return global.AuroraDiagnosticConclusion.normalizeYesNo(
            value,
            fallback
        );
    }

    if (value === true || value === "true") {
        return "Sim";
    }

    if (value === false || value === "false") {
        return "Não";
    }

    if (value === "Sim" || value === "Não") {
        return value;
    }

    return fallback;
}

function normalizeConclusionStatus(
    value,
    fallback = "Concluído"
) {
    if (
        global.AuroraDiagnosticConclusion &&
        typeof global.AuroraDiagnosticConclusion.normalizeConclusionStatus ===
            "function"
    ) {
        return global.AuroraDiagnosticConclusion.normalizeConclusionStatus(
            value,
            fallback
        );
    }

    const raw = String(value || "").trim();
    const allowed = ["Concluído", "Em execução", "Revisão", "Rascunho"];

    if (allowed.includes(raw)) {
        return raw;
    }

    const lower = raw.toLocaleLowerCase("pt-BR");
    if (lower === "em revisão") return "Revisão";
    if (lower === "em execução" || lower === "em execucao" || lower === "executando") return "Em execução";

    return allowed.includes(fallback)
        ? fallback
        : "Concluído";
}

function isSelectValueAllowed(field, value) {
    if (!field || field.tagName !== "SELECT") {
        return Boolean(String(value || "").trim());
    }

    const normalized = String(value || "").trim();

    return Array.from(field.options || []).some((option) => {
        return (
            !option.disabled &&
            String(option.value || "").trim() ===
                normalized
        );
    });
}

function flushActiveFormField() {
    const active =
        document.activeElement;

    if (
        !active ||
        !(
            active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT"
        )
    ) {
        return;
    }

    active.dispatchEvent(
        new Event(
            "change",
            { bubbles: true }
        )
    );

    if (typeof active.blur === "function") {
        active.blur();
    }
}

function buildFinalizeDiagnosticSnapshot(
    caseData,
    existingReport
) {
    const snapshot = {
        caseId: caseData && caseData.id,
        publicId:
            caseData && caseData.public_id,
        reportId:
            existingReport &&
            existingReport.id,
        existingReportId:
            existingReport &&
            existingReport.id,
        serviceId:
            caseData &&
            caseData.service &&
            caseData.service.id,
        profileId:
            caseData &&
            (caseData.profile_id ||
                caseData.module_id),
        workflowId:
            caseData &&
            caseData.service &&
            caseData.service.flow_template,
        status:
            caseData && caseData.status,
        reportTitle:
            (caseData &&
                caseData.approval &&
                caseData.approval.report_title) ||
            (existingReport &&
                existingReport.approval &&
                existingReport.approval.report_title) ||
            (existingReport &&
                existingReport.report_title) ||
            "",
        customerExists:
            Boolean(
                caseData &&
                caseData.customer &&
                Object.keys(
                    caseData.customer
                ).length
            ),
        intakeExists:
            Boolean(
                caseData &&
                caseData.intake &&
                Object.keys(
                    caseData.intake
                ).length
            ),
        diagnosticExists:
            Boolean(
                caseData &&
                caseData.diagnostic &&
                Object.keys(
                    caseData.diagnostic
                ).length
            ),
        conclusionExists:
            Boolean(
                caseData &&
                caseData.approval &&
                Object.keys(
                    caseData.approval
                ).length
            ),
        evidenceGroupCount:
            Array.isArray(
                caseData &&
                caseData.evidence_groups
            )
                ? caseData.evidence_groups.length
                : 0,
        coverPhotoExists:
            Boolean(
                caseData &&
                caseData.coverPhoto
            ),
        companyExists:
            Boolean(
                existingReport &&
                existingReport.company
            ),
        reportExists:
            Boolean(existingReport),
        diagnosticSummary:
            String(
                (caseData &&
                    caseData.diagnostic &&
                    caseData.diagnostic.summary) ||
                ""
            ).slice(0, 80),
        approvalStatus:
            (caseData &&
                caseData.approval &&
                caseData.approval.status) ||
            "",
        showSeverity:
            caseData &&
            caseData.approval &&
            caseData.approval.show_severity,
        showRecordLabels:
            caseData &&
            caseData.approval &&
            caseData.approval.show_record_labels
    };

    return snapshot;
}

function syncConclusionFieldsFromExistingReport(
    caseData,
    existingReport
) {
    if (
        !caseData ||
        !existingReport
    ) {
        return caseData;
    }

    const next = clone(caseData);
    next.approval = clone(
        next.approval || {}
    );
    next.diagnostic = clone(
        next.diagnostic || {}
    );

    const srcApproval =
        existingReport.approval ||
        {};
    const srcDiagnostic =
        existingReport.diagnostic ||
        {};
    const reportTitle = String(
        next.approval.report_title ||
        srcApproval.report_title ||
        existingReport.report_title ||
        ""
    ).trim();

    if (reportTitle) {
        next.approval.report_title =
            reportTitle;
    }

    const reportTitleSize = String(
        next.approval.report_title_size ||
        srcApproval.report_title_size ||
        ""
    ).trim();

    if (reportTitleSize) {
        next.approval.report_title_size =
            global.AuroraDiagnosticConclusion &&
            typeof global.AuroraDiagnosticConclusion.normalizeReportTitleSize ===
                "function"
                ? global.AuroraDiagnosticConclusion.normalizeReportTitleSize(
                    reportTitleSize,
                    "Normal"
                )
                : reportTitleSize;
    } else if (
        !String(
            next.approval.report_title_size || ""
        ).trim()
    ) {
        next.approval.report_title_size = "Normal";
    }

    if (
        !String(
            next.diagnostic.summary || ""
        ).trim()
    ) {
        next.diagnostic.summary =
            String(
                srcDiagnostic.summary ||
                srcDiagnostic.recommendation ||
                srcApproval.notes ||
                (reportTitle
                    ? `Resumo: ${reportTitle}`
                    : "Vistoria concluída conforme registros.")
            ).trim();
    }

    if (
        !String(
            next.approval.status || ""
        ).trim()
    ) {
        next.approval.status =
            srcApproval.status ||
            "Concluído";
    }

    next.approval.status =
        normalizeConclusionStatus(
            next.approval.status,
            normalizeConclusionStatus(
                srcApproval.status,
                "Concluído"
            )
        );

    /* V92 — coerência entre checklist e status documental.
       Se houver ao menos um trabalho textual pendente, o relatório não pode
       declarar "Concluído". Vistoria Veicular e Elétrica Tupy/Atividades
       Rotineiras ficam explicitamente fora desta regra. */
    {
        const profile = String(
            next.profile_id || next.module_id || next.service_profile ||
            (next.service && next.service.profile) || ""
        ).toLowerCase();
        const service = String(
            (next.service && next.service.id) || next.service_type || ""
        ).toLowerCase();
        const excluded =
            profile === "vehicle_inspection" ||
            service === "vehicle_inspection" ||
            service === "eletrica_tupy";
        const items =
            (next.diagnostic && Array.isArray(next.diagnostic.work_items))
                ? next.diagnostic.work_items
                : [];
        const hasPending = !excluded && items.some((item) =>
            item && String(item.text || "").trim() && !item.done
        );
        if (hasPending) next.approval.status = "Em execução";
    }

    next.approval.show_severity =
        normalizeYesNo(
            next.approval.show_severity ??
                srcApproval.show_severity,
            "Sim"
        );
    next.approval.show_record_labels =
        normalizeYesNo(
            next.approval.show_record_labels ??
                srcApproval.show_record_labels,
            "Sim"
        );

    if (
        !String(
            next.approval.notes || ""
        ).trim() &&
        srcApproval.notes
    ) {
        next.approval.notes =
            srcApproval.notes;
    }

    return next;
}

function hydrateConclusionFormBeforeFinalize(
    currentRuntime,
    existingReport
) {
    const viewManager =
        currentRuntime &&
        currentRuntime.viewManager;

    const controller =
        viewManager &&
        typeof viewManager.getCurrentController ===
            "function"
            ? viewManager.getCurrentController()
            : null;

    if (
        !controller ||
        controller.id !== "diagnostic" ||
        !controller.form
    ) {
        return false;
    }

    const caseData =
        currentRuntime.getCase();
    const merged =
        syncConclusionFieldsFromExistingReport(
            caseData,
            existingReport
        );
    const values =
        global.AuroraDiagnosticConclusion &&
        typeof global.AuroraDiagnosticConclusion.buildConclusionInitialValues ===
            "function"
            ? global.AuroraDiagnosticConclusion.buildConclusionInitialValues(
                merged
            )
            : {
                summary:
                    merged.diagnostic &&
                    merged.diagnostic.summary,
                recommendation:
                    merged.diagnostic &&
                    merged.diagnostic.recommendation,
                report_title:
                    merged.approval &&
                    merged.approval.report_title,
                report_title_size:
                    merged.approval &&
                    merged.approval.report_title_size,
                show_severity:
                    merged.approval &&
                    merged.approval.show_severity,
                show_record_labels:
                    merged.approval &&
                    merged.approval.show_record_labels,
                status:
                    merged.approval &&
                    merged.approval.status,
                notes:
                    merged.approval &&
                    merged.approval.notes
            };

    const setFieldIfEmpty = (
        name,
        value
    ) => {
        if (
            value === undefined ||
            value === null ||
            !String(value).trim()
        ) {
            return;
        }

        const field =
            controller.form.querySelector(
                `[name="${name}"]`
            );

        if (!field) {
            return;
        }

        const current = String(
            field.value || ""
        ).trim();
        const normalized = String(value).trim();
        const currentAllowed =
            isSelectValueAllowed(
                field,
                current
            );

        if (currentAllowed) {
            return;
        }

        if (
            field.tagName === "SELECT" &&
            !isSelectValueAllowed(
                field,
                normalized
            )
        ) {
            return;
        }

        field.value = normalized;
    };

    setFieldIfEmpty(
        "summary",
        values.summary
    );
    setFieldIfEmpty(
        "recommendation",
        values.recommendation
    );
    setFieldIfEmpty(
        "report_title",
        values.report_title
    );
    setFieldIfEmpty(
        "show_severity",
        values.show_severity
    );
    setFieldIfEmpty(
        "show_record_labels",
        values.show_record_labels
    );
    setFieldIfEmpty(
        "status",
        values.status
    );
    setFieldIfEmpty(
        "notes",
        values.notes
    );

    return true;
}

function logGenerationFailure(
    error,
    source,
    extra
) {
    const payload = {
        source,
        name:
            error &&
            error.name,
        message:
            error &&
            error.message
                ? error.message
                : String(error),
        stack:
            error &&
            error.stack &&
            String(error.stack).slice(
                0,
                400
            ),
        ...(extra || {})
    };

    console.error(
        "AURORA_EDIT_FINALIZE GENERATION_FAILED_SOURCE",
        payload
    );

    logEditFinalize(
        "GENERATION_FAILED_SOURCE",
        payload
    );
}

function attachFailureReason(
    error,
    reason
) {
    const next =
        error instanceof Error
            ? error
            : new Error(
                String(error)
            );

    next.failureReason =
        reason;

    return next;
}

function ensureSerializableCase(
    caseData
) {
    try {
        JSON.stringify(
            caseData
        );
        return caseData;
    } catch (error) {
        logEditFinalize(
            "GENERATION_CASE_SERIALIZE_ERROR",
            {
                name:
                    error.name,
                message:
                    error.message
            }
        );

        const safe =
            clone(caseData);

        if (
            Array.isArray(
                safe.evidence_groups
            )
        ) {
            safe.evidence_groups =
                safe.evidence_groups.map(
                    (group) => ({
                        ...group,
                        photos:
                            Array.isArray(
                                group.photos
                            )
                                ? group.photos.map(
                                    (photo) => ({
                                        id:
                                            photo.id,
                                        title:
                                            photo.title ||
                                            "",
                                        description:
                                            photo.description ||
                                            "",
                                        category:
                                            photo.category ||
                                            "general",
                                        src:
                                            typeof photo.src ===
                                            "string"
                                                ? photo.src
                                                : null,
                                        edited_src:
                                            typeof photo.edited_src ===
                                            "string"
                                                ? photo.edited_src
                                                : null,
                                        created_at:
                                            photo.created_at ||
                                            null
                                    })
                                )
                                : []
                    })
                );
        }

        if (
            safe.coverPhoto &&
            typeof safe.coverPhoto ===
                "object"
        ) {
            safe.coverPhoto =
                {
                    src:
                        typeof safe.coverPhoto.src ===
                        "string"
                            ? safe.coverPhoto.src
                            : "",
                    alt:
                        String(
                            safe.coverPhoto.alt ||
                            ""
                        ),
                    width:
                        safe.coverPhoto.width,
                    height:
                        safe.coverPhoto.height,
                    source_photo_id:
                        safe.coverPhoto.source_photo_id ||
                        null
                };
        }

        JSON.stringify(safe);
        return safe;
    }
}

function isUserVistoriaReportCase(caseData) {
    try {
        var tupy = caseData && caseData.eletrica_tupy;
        return !!(tupy && tupy.vistoria_sent_for_review === true);
    } catch (error) {
        return false;
    }
}

function buildReportEngineOptions(
    caseData,
    existingReport,
    reportId
) {
    return {
        id:
            reportId,
        publicId:
            existingReport &&
            existingReport.public_id
                ? existingReport.public_id
                : caseData.public_id ||
                  undefined,
        status:
            isUserVistoriaReportCase(caseData)
                ? "Em andamento"
                : "Concluído",
        createdAt:
            existingReport &&
            existingReport.created_at
                ? existingReport.created_at
                : new Date()
                    .toISOString(),
        updatedAt:
            new Date()
                .toISOString()
    };
}

function buildGenerationFailureResult(
    reason,
    error,
    source
) {
    logGenerationFailure(
        error ||
            new Error(reason),
        source,
        { reason }
    );

    notify(
        reason ===
            "preview_failed"
            ? "Relatório atualizado, mas a prévia não abriu automaticamente."
            : "O relatório não foi gerado. Os dados da inspeção foram preservados."
    );

    logEditFinalize(
        "FINALIZE_RETURN",
        {
            ok: false,
            reason,
            source
        }
    );

    return {
        ok:
            false,
        reason,
        failure_source:
            source,
        error
    };
}

function mergeExistingReportIntoCase(
    currentRuntime,
    existingReport
) {
    if (
        !currentRuntime ||
        !existingReport ||
        typeof currentRuntime.getCase !==
            "function" ||
        !currentRuntime.caseBinder ||
        typeof currentRuntime.caseBinder.merge !==
            "function"
    ) {
        return;
    }

    const merged =
        syncConclusionFieldsFromExistingReport(
            currentRuntime.getCase(),
            existingReport
        );

    currentRuntime.caseBinder.merge(
        {
            diagnostic:
                merged.diagnostic,
            approval:
                merged.approval
        },
        {
            source:
                "edit_finalize_resync",
            controller_id:
                "diagnostic"
        }
    );
}

function createBlankCase(
    completedCase
) {
    return {
        id:
            createNextCaseId(),

        status:
            "Em andamento",

        profile_id:
            completedCase.profile_id ||
            (
                completedCase.service &&
                completedCase.service.profile
            ) ||
            "workshop",

        /*
         * O próximo atendimento deve começar pela seleção do serviço.
         */
        service:
            {},

        customer:
            {},

        asset:
            {},

        intake:
            {},

        occurrence:
            {},

        evidence_groups:
            [],

        evidences:
            [],

        diagnostic:
            {},

        approval:
            {}
    };
}

async function finalizeInspection(
    currentRuntime
) {
    if (
        !currentRuntime ||
        currentRuntime.__reportFinalizationPending
    ) {
        return {
            ok:
                false,
            reason:
                "pending_or_missing_runtime"
        };
    }

    currentRuntime.__reportFinalizationPending =
        true;

    try {
        const initialCase =
            currentRuntime.getCase &&
            currentRuntime.getCase();

        if (
            global.AuroraEletricaTupy &&
            typeof global.AuroraEletricaTupy.validateBudgetNumber === "function"
        ) {
            const budgetCheck =
                global.AuroraEletricaTupy.validateBudgetNumber(
                    initialCase
                );
            if (
                budgetCheck &&
                budgetCheck.ok === false
            ) {
                notify(
                    budgetCheck.message ||
                        "Informe o número do orçamento para concluir este atendimento."
                );
                return {
                    ok: false,
                    reason: "budget_number_required"
                };
            }
        }

        const existingReportEarly =
            findExistingReportForCase(
                initialCase,
                engine
            );

        logEditFinalize(
            "EDIT_FINALIZE_CLICK",
            buildFinalizeDiagnosticSnapshot(
                initialCase,
                existingReportEarly
            )
        );

        if (existingReportEarly) {
            logEditFinalize(
                "EDIT_EXISTING_REPORT_FOUND",
                {
                    reportId:
                        existingReportEarly.id,
                    publicId:
                        existingReportEarly.public_id
                }
            );
            mergeExistingReportIntoCase(
                currentRuntime,
                existingReportEarly
            );
        } else {
            logEditFinalize(
                "EDIT_EXISTING_REPORT_NOT_FOUND",
                {
                    caseId:
                        initialCase &&
                        initialCase.id
                }
            );
        }

        notify(
            "Salvando inspeção e preparando relatório..."
        );

        flushActiveFormField();
        hydrateConclusionFormBeforeFinalize(
            currentRuntime,
            existingReportEarly
        );

        logEditFinalize(
            "EDIT_SAVE_START",
            {
                controller:
                    currentRuntime.viewManager &&
                    currentRuntime.viewManager.getCurrentController &&
                    currentRuntime.viewManager.getCurrentController() &&
                    currentRuntime.viewManager.getCurrentController().id
            }
        );

        const saveResult =
            await currentRuntime.saveCurrent({
                validate:
                    true
            });

        if (
            !saveResult ||
            saveResult.valid ===
                false
        ) {
            let invalidFields =
                [];

            const failedController =
                currentRuntime.viewManager &&
                typeof currentRuntime.viewManager.getCurrentController ===
                    "function"
                    ? currentRuntime.viewManager.getCurrentController()
                    : null;

            if (
                failedController &&
                failedController.form &&
                currentRuntime.formRenderer &&
                typeof currentRuntime.formRenderer.validate ===
                    "function"
            ) {
                invalidFields =
                    currentRuntime.formRenderer.validate(
                        failedController.form
                    ).invalid_fields || [];
            }

            logEditFinalize(
                "EDIT_SAVE_ERROR",
                {
                    stage:
                        "validation_failed",
                    controller:
                        saveResult &&
                        saveResult.controller_id,
                    invalidFields
                }
            );

            notify(
                "Revise os campos obrigatórios da conclusão antes de finalizar."
            );

            logEditFinalize(
                "EDIT_FINAL_RESULT",
                {
                    ok: false,
                    reason:
                        "validation_failed",
                    invalidFields
                }
            );

            return {
                ok:
                    false,
                reason:
                    "validation_failed",
                result:
                    saveResult,
                invalid_fields:
                    invalidFields
            };
        }

        logEditFinalize(
            "EDIT_SAVE_OK",
            {
                controller:
                    saveResult.controller_id,
                saved:
                    saveResult.saved
            }
        );

        logEditFinalize(
            "EDIT_CASE_AFTER_SAVE",
            buildFinalizeDiagnosticSnapshot(
                currentRuntime.getCase(),
                existingReportEarly
            )
        );

        /*
         * Garante que qualquer ocorrência ainda focada seja persistida.
         */
        if (
            global.AuroraEvidenceFeature &&
            typeof global.AuroraEvidenceFeature.flush ===
                "function"
        ) {
            await global.AuroraEvidenceFeature.flush();
        }

        if (
            global.AuroraEvidenceFeature &&
            typeof global.AuroraEvidenceFeature.reload ===
                "function"
        ) {
            await global.AuroraEvidenceFeature.reload();
        }

        const completedCase =
            currentRuntime.getCase();

        logEditFinalize(
            "GENERATION_START",
            {
                caseId:
                    completedCase.id,
                publicId:
                    completedCase.public_id
            }
        );

        const caseData =
            ensureSerializableCase(
                await hydrateEvidenceGroups(
                    await hydrateCoverPhoto(
                        completedCase
                    )
                )
            );

        logEditFinalize(
            "GENERATION_CASE_SNAPSHOT",
            buildFinalizeDiagnosticSnapshot(
                caseData,
                existingReportEarly
            )
        );

        logEditFinalize(
            "EXISTING_REPORT_LOOKUP_START",
            {
                caseId:
                    caseData.id
            }
        );

        const existingReport =
            findExistingReportForCase(
                caseData,
                engine
            );

        logEditFinalize(
            "EXISTING_REPORT_LOOKUP_RESULT",
            existingReport
                ? {
                    found: true,
                    reportId:
                        existingReport.id,
                    publicId:
                        existingReport.public_id,
                    caseId:
                        existingReport.case_id ||
                        (
                            existingReport.snapshot &&
                            existingReport.snapshot.id
                        )
                }
                : {
                    found: false,
                    caseId:
                        caseData.id
                }
        );

        const reportId =
            existingReport &&
            existingReport.id
                ? String(
                    existingReport.id
                )
                : uniqueReportId(
                    caseData.id,
                    engine
                );

        const engineOptions =
            buildReportEngineOptions(
                caseData,
                existingReport,
                reportId
            );

        logEditFinalize(
            "REPORT_IDS_RESOLVED",
            {
                caseId:
                    caseData.id,
                reportId,
                publicId:
                    engineOptions.publicId,
                createdAt:
                    engineOptions.createdAt,
                mode:
                    existingReport
                        ? "update"
                        : "create"
            }
        );

        logEditFinalize(
            "REPORT_ENGINE_CREATE_START",
            {
                caseId:
                    caseData.id,
                serviceId:
                    caseData.service &&
                    caseData.service.id,
                profileId:
                    caseData.profile_id,
                reportTitle:
                    caseData.approval &&
                    caseData.approval.report_title,
                reportId:
                    engineOptions.id,
                publicId:
                    engineOptions.publicId,
                createdAt:
                    engineOptions.createdAt
            }
        );

        let generatedReport;

        try {
            logEditFinalize(
                "REPORT_SAVE_START",
                {
                    reportId
                }
            );

            generatedReport =
                engine.createFromCase(
                    caseData,
                    engineOptions
                );

            logEditFinalize(
                "REPORT_ENGINE_CREATE_OK",
                {
                    reportId:
                        generatedReport.id,
                    publicId:
                        generatedReport.public_id,
                    caseId:
                        generatedReport.snapshot &&
                        generatedReport.snapshot.id
                }
            );

            logEditFinalize(
                "REPORT_SAVE_OK",
                {
                    reportId:
                        generatedReport.id
                }
            );
        } catch (engineError) {
            logEditFinalize(
                "REPORT_ENGINE_CREATE_THROW",
                {
                    reportId,
                    name:
                        engineError &&
                        engineError.name,
                    message:
                        engineError &&
                        engineError.message,
                    stack:
                        engineError &&
                        engineError.stack &&
                        String(
                            engineError.stack
                        ).slice(
                            0,
                            400
                        )
                }
            );

            return buildGenerationFailureResult(
                "engine_create_failed",
                engineError,
                "createFromCase"
            );
        }

        logEditFinalize(
            "REPORT_RELOAD_AFTER_SAVE",
            {
                reportId:
                    generatedReport.id
            }
        );

        const persistedReport =
            engine.get(
                generatedReport.id
            );

        logEditFinalize(
            "REPORT_RELOAD_RESULT",
            persistedReport
                ? {
                    found: true,
                    reportId:
                        persistedReport.id,
                    publicId:
                        persistedReport.public_id
                }
                : {
                    found: false,
                    reportId:
                        generatedReport.id
                }
        );

        if (!persistedReport) {
            return buildGenerationFailureResult(
                "report_reload_failed",
                new Error(
                    "O relatório não foi confirmado no armazenamento."
                ),
                "engine.get"
            );
        }

        /* R11.10 — lei Aurora para shapes genéricas: usa o mesmo motor canônico
         * do botão manual e AGUARDA a tentativa de sync antes de abrir o relatório.
         * Tupy mantém seu fluxo próprio, já validado, que sincroniza antes daqui. */
        const autoSyncProfile = String(
            caseData.profile_id || (caseData.service && caseData.service.profile) || ""
        ).trim();
        const isTupyAutoSyncFlow = autoSyncProfile === "eletrica_tupy";
        const isAdminReviewAutoSync = caseData.admin_review === true || caseData.__aet_admin_review_report === true;
        if (!isTupyAutoSyncFlow && !isAdminReviewAutoSync && global.AuroraCloudSync &&
            typeof global.AuroraCloudSync.syncSelectedCase === "function") {
            const syncCase = clone(generatedReport.snapshot || caseData);
            syncCase.status = "completed";
            syncCase.updated_at = generatedReport.updated_at || new Date().toISOString();
            syncCase.completed_at = syncCase.completed_at || syncCase.updated_at;
            if (generatedReport.coverPhoto) syncCase.coverPhoto = clone(generatedReport.coverPhoto);
            try {
                await global.AuroraCloudSync.syncSelectedCase(syncCase);
                global.__auroraCompletedCaseForAutoSync = null;
                global.dispatchEvent(new CustomEvent("aurora:auto-sync-complete", { detail: { case_id: syncCase.id } }));
            } catch (autoSyncError) {
                if (global.AuroraCloudSync && typeof global.AuroraCloudSync.queueCaseForSync === "function") {
                    global.AuroraCloudSync.queueCaseForSync(syncCase);
                }
                console.warn("Aurora: sincronização automática ficou pendente; o botão manual permanece disponível.", autoSyncError);
                global.dispatchEvent(new CustomEvent("aurora:auto-sync-pending", { detail: { message: autoSyncError && autoSyncError.message ? autoSyncError.message : String(autoSyncError || "") } }));
            }
        }

        notify(
            `Relatório ${generatedReport.public_id || generatedReport.id} gerado com sucesso.`
        );

        currentRuntime.shell.emit(
            "reports_requested",
            {
                report_id:
                    generatedReport.id,
                refresh:
                    true
            }
        );

        /* R11.9 — preservar o atendimento concluído para o auto-sync do Fechar.
         * O runtime será resetado para blankCase depois da geração. */
        global.__auroraCompletedCaseForAutoSync = clone(completedCase);

        let previewOpened = false;
        let previewFailure = null;

        logEditFinalize(
            "PREVIEW_OPEN_START",
            {
                reportId:
                    persistedReport.id
            }
        );

        try {
            previewOpened =
                preview.open(
                    generatedReport.id
                ) === true;
        } catch (previewError) {
            previewFailure =
                previewError;

            logEditFinalize(
                "PREVIEW_OPEN_THROW",
                {
                    reportId:
                        generatedReport.id,
                    name:
                        previewError &&
                        previewError.name,
                    message:
                        previewError &&
                        previewError.message,
                    stack:
                        previewError &&
                        previewError.stack &&
                        String(
                            previewError.stack
                        ).slice(
                            0,
                            400
                        )
                }
            );
        }

        if (
            !previewOpened &&
            !previewFailure
        ) {
            previewFailure =
                new Error(
                    "A prévia do relatório não pôde ser aberta."
                );

            logEditFinalize(
                "PREVIEW_OPEN_THROW",
                {
                    reportId:
                        generatedReport.id,
                    name:
                        previewFailure.name,
                    message:
                        previewFailure.message
                }
            );
        }

        if (previewOpened) {
            logEditFinalize(
                "PREVIEW_OPEN_OK",
                {
                    reportId:
                        generatedReport.id
                }
            );
        }

        /*
         * Somente depois da confirmação de geração criamos o atendimento
         * vazio. Caso qualquer etapa anterior falhe, nada é apagado.
         * Com módulo comercialmente vencido, não criar blank case utilizável.
         */
        const profileId =
            completedCase.profile_id ||
            (completedCase.service && completedCase.service.profile) ||
            "";

        if (
            global.AuroraModuleCommercial &&
            typeof global.AuroraModuleCommercial.gateNewWork === "function"
        ) {
            const allowed = await global.AuroraModuleCommercial.gateNewWork(
                profileId,
                { silent: true }
            );

            if (!allowed) {
                logEditFinalize(
                    "FINALIZE_RETURN",
                    {
                        ok: true,
                        skipped_blank_case: true,
                        previewOk: previewOpened
                    }
                );

                return {
                    ok: true,
                    report: generatedReport,
                    nextCase: null,
                    skipped_blank_case: true,
                    preview_ok: previewOpened
                };
            }
        }

        const blankCase =
            createBlankCase(
                completedCase
            );

        if (
            typeof currentRuntime.resetCase ===
                "function"
        ) {
            await currentRuntime.resetCase(
                blankCase,
                {
                    reason:
                        "report_generated"
                }
            );
        } else if (
            currentRuntime.caseBinder &&
            typeof currentRuntime.caseBinder.merge ===
                "function"
        ) {
            /*
             * Fallback para runtimes antigos: substituição explícita de
             * todos os módulos, sem depender de caseData isolado.
             */
            currentRuntime.caseData =
                clone(
                    blankCase
                );

            currentRuntime.currentIndex =
                0;

            currentRuntime.emit(
                "case_changed",
                currentRuntime.getCase()
            );
        }

        if (
            global.auroraRepository &&
            typeof global.auroraRepository.save ===
                "function"
        ) {
            global.auroraRepository.save(
                blankCase
            );
        }

        const finalResult = {
            ok:
                true,
            report:
                generatedReport,
            nextCase:
                blankCase,
            preview_ok:
                previewOpened,
            preview_error:
                previewFailure,
            reason:
                previewOpened
                    ? undefined
                    : "preview_failed",
            mode:
                existingReport
                    ? "update"
                    : "create"
        };

        logEditFinalize(
            "FINALIZE_RETURN",
            {
                ok:
                    finalResult.ok,
                reportId:
                    generatedReport.id,
                publicId:
                    generatedReport.public_id,
                previewOk:
                    finalResult.preview_ok,
                reason:
                    finalResult.reason,
                mode:
                    finalResult.mode
            }
        );

        return finalResult;
    } catch (error) {
        const failureReason =
            error &&
            error.failureReason
                ? error.failureReason
                : "generation_failed";

        return buildGenerationFailureResult(
            failureReason,
            error,
            failureReason
        );
    } finally {
        currentRuntime.__reportFinalizationPending =
            false;
    }
}

function connectRuntime() {
    const currentRuntime =
        runtime();

    if (!currentRuntime) {
        return false;
    }

    /*
     * A geração não depende mais do evento workflow_completed.
     * O botão oficial chama finalizeInspection() diretamente.
     */
    currentRuntime.__reportFeatureConnected =
        true;

    currentRuntime.on(
        "step_changed",
        installFinalizeButton
    );

    installFinalizeButton();

    return true;
}

global.AuroraReportFeature = {
    finalize:
        finalizeInspection,

    hydrateEvidenceGroups,

    hydrateCoverPhoto,

    engine,

    preview,

    __testHooks: {
        buildFinalizeDiagnosticSnapshot,
        syncConclusionFieldsFromExistingReport,
        findExistingReportForCase,
        normalizeYesNo,
        uniqueReportId,
        mergeExistingReportIntoCase,
        buildReportEngineOptions,
        isUserVistoriaReportCase
    }
};

const observer =
    new MutationObserver(
        installFinalizeButton
    );

observer.observe(
    document.documentElement,
    {
        childList: true,
        subtree: true
    }
);

let attempts = 0;
const timer =
    setInterval(
        () => {
            attempts += 1;

            if (
                connectRuntime() ||
                attempts > 180
            ) {
                clearInterval(timer);
            }
        },
        100
    );

global.auroraReportEngine =
    engine;
global.auroraReportPreview =
    preview;

console.log(
    "AURORA REPORT FEATURE RC3 ANDROID CARREGADA",
    {
        engine: Boolean(global.ReportEngine),
        preview: Boolean(global.ReportPreview),
        api: Boolean(global.AuroraReportFeature)
    }
);

})(window);

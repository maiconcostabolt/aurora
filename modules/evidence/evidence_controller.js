(function (global) {
"use strict";

/*
 * EvidenceModuleController — RC2
 *
 * This controller no longer creates legacy "evidence" rows.
 * It provides only the screen host. The complete occurrence,
 * multiple-photo and photo-editor flow is owned by
 * js/evidence_feature.js.
 */
class EvidenceModuleController extends global.ModuleController {
    constructor() {
        super({
            id: "evidence"
        });

        this.context = {};
        this.container = null;
    }

    async onLoad(context = {}) {
        this.context =
            context &&
            typeof context === "object"
                ? context
                : {};
    }

    async render() {
        return [
            '<section',
            ' class="aurora-module aurora-evidence-module"',
            ' data-module="evidence">',
            '<div data-evidence-feature-host></div>',
            '</section>'
        ].join("");
    }

    async bindEvents(container) {
        this.container =
            container;

        document.dispatchEvent(
            new CustomEvent(
                "aurora:evidence-host-ready",
                {
                    detail: {
                        container
                    }
                }
            )
        );
    }

    async onValidate() {
        if (
            global.AuroraEvidenceFeature &&
            typeof global.AuroraEvidenceFeature.flush ===
                "function"
        ) {
            await global.AuroraEvidenceFeature.flush();
        }

        const runtime =
            global.auroraRuntime;

        const caseData =
            runtime &&
            typeof runtime.getCase ===
                "function"
                ? runtime.getCase()
                : this.context;

        const groups =
            caseData &&
            Array.isArray(
                caseData.evidence_groups
            )
                ? caseData.evidence_groups
                : [];

        /*
         * Evidências fotográficas são opcionais.
         *
         * O fluxo só é bloqueado quando existe uma ocorrência que o
         * usuário abriu e ainda não finalizou. Uma ocorrência finalizada
         * pode ter zero ou várias fotos.
         */
        /* Fotos guiadas do veículo são registros fotográficos opcionais e
         * não representam uma ocorrência técnica aberta. Na revisão ADMIN
         * elas podem ser reidratadas sem saved_at local; isso não deve
         * bloquear o avanço. */
        const isGuidedVehiclePhoto = (group) => Boolean(
            group && (
                String(group.record_kind || "") === "vehicle_guided_photo" ||
                String(group.vehicle_photo_slot || group.slot || "").trim()
            )
        );

        const unfinished = groups.find((group) =>
            group && !group.saved_at && !isGuidedVehiclePhoto(group)
        );

        if (unfinished) {
            const label = String(
                unfinished.title || unfinished.item || unfinished.description || "ocorrência aberta"
            ).trim();
            const message = label && label !== "ocorrência aberta"
                ? `Finalize ou exclua a ocorrência aberta: ${label}.`
                : "Finalize ou exclua a ocorrência aberta antes de avançar.";

            /* O runtime emite validation_failed depois do onValidate.
             * Preserve o motivo específico para o bootstrap não substituí-lo
             * pela mensagem genérica do controller. */
            global.__AURORA_VALIDATION_MESSAGE__ = message;

            const status = document.getElementById("app-status");
            if (status) {
                status.textContent = message;
                status.classList.add("is-visible");
            }

            return false;
        }

        return true;
    }

    async onSave() {
        if (
            global.AuroraEvidenceFeature &&
            typeof global.AuroraEvidenceFeature.flush ===
                "function"
        ) {
            await global.AuroraEvidenceFeature.flush();
        }

        const runtime =
            global.auroraRuntime;

        const caseData =
            runtime &&
            typeof runtime.getCase ===
                "function"
                ? runtime.getCase()
                : this.context;

        return {
            evidence_groups:
                Array.isArray(
                    caseData &&
                    caseData.evidence_groups
                )
                    ? JSON.parse(
                        JSON.stringify(
                            caseData.evidence_groups
                        )
                    )
                    : [],
            evidences:
                Array.isArray(
                    caseData &&
                    caseData.evidences
                )
                    ? JSON.parse(
                        JSON.stringify(
                            caseData.evidences
                        )
                    )
                    : []
        };
    }

    async onUnmount() {
        if (
            global.AuroraEvidenceFeature &&
            typeof global.AuroraEvidenceFeature.flush ===
                "function"
        ) {
            await global.AuroraEvidenceFeature.flush();
        }

        this.container =
            null;
    }
}

global.EvidenceModuleController =
    EvidenceModuleController;

})(window);

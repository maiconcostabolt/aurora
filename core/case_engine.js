/**
 * AURORA CORE — CASE ENGINE
 * O Case é a unidade central de trabalho da Aurora.
 */
(function (global) {
    "use strict";

    const CASE_STATUS = Object.freeze({
        DRAFT: "draft",
        IN_PROGRESS: "in_progress",
        AWAITING_APPROVAL: "awaiting_approval",
        APPROVED: "approved",
        PARTIALLY_APPROVED: "partially_approved",
        REJECTED: "rejected",
        IN_EXECUTION: "in_execution",
        COMPLETED: "completed",
        ARCHIVED: "archived",
        CANCELLED: "cancelled"
    });

    class CaseEngine {
        constructor(options = {}) {
            this.idPrefix = options.idPrefix || "CASE";
            this.currentCase = null;
        }

        create(input = {}) {
            if (!input.profile_id) {
                throw new Error("O Case precisa possuir um profile_id.");
            }

            const now = new Date().toISOString();

            this.currentCase = {
                id: input.id || this._generateId(),
                company_id: input.company_id || null,
                user_id: input.user_id || null,
                profile_id: input.profile_id,
                workflow_id: input.workflow_id || null,
                area: input.area || input.profile_id,
                mode: input.mode || "inspection_only",
                status: CASE_STATUS.DRAFT,
                current_step: input.current_step || null,
                customer: input.customer || null,
                asset: input.asset || null,
                intake: input.intake || {},
                occurrences: [],
                evidences: [],
                diagnostic: {},
                approval: {},
                executor: {},
                execution: {},
                reports: [],
                dynamic_fields: {},
                shape_metadata: {},
                created_at: now,
                updated_at: now,
                completed_at: null,
                archived_at: null,
                history: [{
                    type: "case_created",
                    status: CASE_STATUS.DRAFT,
                    step: input.current_step || null,
                    timestamp: now,
                    user_id: input.user_id || null,
                    note: "Case criado."
                }]
            };

            return this.getCurrent();
        }

        open(caseData) {
            if (!caseData || !caseData.id || !caseData.profile_id) {
                throw new Error("Case inválido.");
            }

            this.currentCase = this._clone(caseData);
            this.currentCase.history = Array.isArray(this.currentCase.history)
                ? this.currentCase.history
                : [];

            return this.getCurrent();
        }

        getCurrent() {
            return this.currentCase ? this._clone(this.currentCase) : null;
        }

        hasCurrent() {
            return Boolean(this.currentCase);
        }

        update(patch = {}, options = {}) {
            this._requireCurrent();

            ["id", "created_at", "history"].forEach((key) => {
                delete patch[key];
            });

            Object.assign(this.currentCase, this._clone(patch));
            this.currentCase.updated_at = new Date().toISOString();

            this._history(
                options.type || "case_updated",
                options.note || "Dados do Case atualizados.",
                options.user_id || null
            );

            return this.getCurrent();
        }

        setCurrentStep(stepId, options = {}) {
            this._requireCurrent();

            if (!stepId || typeof stepId !== "string") {
                throw new Error("Etapa inválida.");
            }

            this.currentCase.current_step = stepId.trim();
            this.currentCase.updated_at = new Date().toISOString();

            this._history(
                "workflow_step_changed",
                options.note || `Etapa alterada para '${stepId.trim()}'.`,
                options.user_id || null
            );

            return this.getCurrent();
        }

        setStatus(status, options = {}) {
            this._requireCurrent();

            if (!Object.values(CASE_STATUS).includes(status)) {
                throw new Error(`Status inválido: '${status}'.`);
            }

            const previous = this.currentCase.status;
            this.currentCase.status = status;
            this.currentCase.updated_at = new Date().toISOString();

            if (status === CASE_STATUS.COMPLETED) {
                this.currentCase.completed_at =
                    this.currentCase.completed_at || this.currentCase.updated_at;
            }

            if (status === CASE_STATUS.ARCHIVED) {
                this.currentCase.archived_at = this.currentCase.updated_at;
            }

            this._history(
                "status_changed",
                options.note || `Status alterado de '${previous}' para '${status}'.`,
                options.user_id || null
            );

            return this.getCurrent();
        }

        addOccurrence(occurrence) {
            this._requireCurrent();

            if (!occurrence || typeof occurrence !== "object") {
                throw new Error("Ocorrência inválida.");
            }

            const item = {
                ...this._clone(occurrence),
                id: occurrence.id || `OCC-${Date.now()}`
            };

            this.currentCase.occurrences.push(item);
            this.currentCase.updated_at = new Date().toISOString();
            this._history("occurrence_added", `Ocorrência '${item.id}' adicionada.`);

            return this._clone(item);
        }

        addReport(report) {
            this._requireCurrent();

            if (!report || typeof report !== "object") {
                throw new Error("Relatório inválido.");
            }

            const item = {
                ...this._clone(report),
                id: report.id || `REPORT-${Date.now()}`,
                created_at: report.created_at || new Date().toISOString()
            };

            this.currentCase.reports.push(item);
            this.currentCase.updated_at = new Date().toISOString();
            this._history("report_added", `Relatório '${item.id}' adicionado.`);

            return this._clone(item);
        }

        close() {
            this.currentCase = null;
        }

        getStatuses() {
            return { ...CASE_STATUS };
        }

        _history(type, note, userId = null) {
            this.currentCase.history.push({
                type,
                status: this.currentCase.status,
                step: this.currentCase.current_step,
                timestamp: new Date().toISOString(),
                user_id: userId,
                note
            });
        }

        _requireCurrent() {
            if (!this.currentCase) {
                throw new Error("Nenhum Case está aberto.");
            }
        }

        _generateId() {
            const now = new Date();
            return `${this.idPrefix}-${now.getFullYear()}-${now.getTime().toString().slice(-8)}`;
        }

        _clone(value) {
            return JSON.parse(JSON.stringify(value));
        }
    }

    global.CASE_STATUS = CASE_STATUS;
    global.CaseEngine = CaseEngine;
})(window);

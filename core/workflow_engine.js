/**
 * ==========================================================
 * AURORA CORE
 * Workflow Engine
 * ==========================================================
 *
 * Interpreta workflows carregados pelo WorkflowLoader.
 *
 * Não conhece HTML.
 * Não abre telas.
 * Não salva dados.
 *
 * Responsabilidades:
 * - carregar e validar o contrato do workflow;
 * - ordenar etapas;
 * - interpretar visible_when;
 * - controlar a etapa atual;
 * - navegar para frente e para trás;
 * - localizar etapas por id;
 * - expor somente as etapas visíveis no contexto atual.
 * ==========================================================
 */

(function (global) {
    "use strict";

    class WorkflowEngine {
        constructor(options = {}) {
            this.workflow = null;
            this.context = {};
            this.stepsOrdered = [];
            this.stepsById = new Map();
            this.currentStepId = null;
            this.onStepChange =
                typeof options.onStepChange === "function"
                    ? options.onStepChange
                    : null;
        }

        load(workflow, context = {}) {
            this._validateWorkflow(workflow);

            this.workflow = this._clone(workflow);
            this.context = this._clone(context || {});

            this.stepsOrdered = [...this.workflow.steps]
                .sort((a, b) => {
                    const orderA = Number.isFinite(a.order)
                        ? a.order
                        : Number.MAX_SAFE_INTEGER;

                    const orderB = Number.isFinite(b.order)
                        ? b.order
                        : Number.MAX_SAFE_INTEGER;

                    return orderA - orderB;
                });

            this.stepsById.clear();

            this.stepsOrdered.forEach((step) => {
                if (this.stepsById.has(step.id)) {
                    throw new Error(
                        `Etapa duplicada no workflow: '${step.id}'.`
                    );
                }

                this.stepsById.set(
                    step.id,
                    this._clone(step)
                );
            });

            const initialStep =
                this.getStep(this.workflow.start) ||
                this.getVisibleSteps()[0] ||
                null;

            if (!initialStep) {
                throw new Error(
                    "O workflow não possui uma etapa inicial visível."
                );
            }

            this.currentStepId = initialStep.id;
            this._emitStepChange("load");

            return this.current();
        }

        setContext(context = {}, options = {}) {
            this.context = options.replace
                ? this._clone(context)
                : {
                    ...this.context,
                    ...this._clone(context)
                };

            const current = this.current();

            if (
                current &&
                !this.isStepVisible(current)
            ) {
                const fallback =
                    this.getVisibleSteps()[0] || null;

                this.currentStepId =
                    fallback ? fallback.id : null;

                this._emitStepChange(
                    "context_changed"
                );
            }

            return this.getContext();
        }

        getContext() {
            return this._clone(this.context);
        }

        current() {
            return this.currentStepId
                ? this.getStep(this.currentStepId)
                : null;
        }

        next() {
            this._requireLoaded();

            const visible = this.getVisibleSteps();
            const index = visible.findIndex(
                (step) => step.id === this.currentStepId
            );

            if (index === -1) {
                throw new Error(
                    "A etapa atual não pertence ao fluxo visível."
                );
            }

            if (index >= visible.length - 1) {
                return this.current();
            }

            this.currentStepId =
                visible[index + 1].id;

            this._emitStepChange("next");

            return this.current();
        }

        previous() {
            this._requireLoaded();

            const visible = this.getVisibleSteps();
            const index = visible.findIndex(
                (step) => step.id === this.currentStepId
            );

            if (index === -1) {
                throw new Error(
                    "A etapa atual não pertence ao fluxo visível."
                );
            }

            if (index <= 0) {
                return this.current();
            }

            this.currentStepId =
                visible[index - 1].id;

            this._emitStepChange("previous");

            return this.current();
        }

        goto(stepId) {
            this._requireLoaded();

            const step = this.getStep(stepId);

            if (!step) {
                throw new Error(
                    `Etapa '${stepId}' não encontrada.`
                );
            }

            if (!this.isStepVisible(step)) {
                throw new Error(
                    `Etapa '${stepId}' não está visível no contexto atual.`
                );
            }

            this.currentStepId = step.id;
            this._emitStepChange("goto");

            return this.current();
        }

        first() {
            this._requireLoaded();

            const first =
                this.getVisibleSteps()[0] || null;

            if (!first) {
                return null;
            }

            this.currentStepId = first.id;
            this._emitStepChange("first");

            return this.current();
        }

        last() {
            this._requireLoaded();

            const visible = this.getVisibleSteps();
            const last =
                visible[visible.length - 1] || null;

            if (!last) {
                return null;
            }

            this.currentStepId = last.id;
            this._emitStepChange("last");

            return this.current();
        }

        isFirst() {
            const current = this.current();
            const first =
                this.getVisibleSteps()[0] || null;

            return Boolean(
                current &&
                first &&
                current.id === first.id
            );
        }

        isLast() {
            const current = this.current();
            const visible = this.getVisibleSteps();
            const last =
                visible[visible.length - 1] || null;

            return Boolean(
                current &&
                last &&
                current.id === last.id
            );
        }

        reset() {
            this._requireLoaded();

            const start =
                this.getStep(this.workflow.start);

            if (
                start &&
                this.isStepVisible(start)
            ) {
                this.currentStepId = start.id;
            } else {
                const first =
                    this.getVisibleSteps()[0] || null;

                this.currentStepId =
                    first ? first.id : null;
            }

            this._emitStepChange("reset");

            return this.current();
        }

        getStep(stepId) {
            if (!stepId) {
                return null;
            }

            const step =
                this.stepsById.get(stepId);

            return step
                ? this._clone(step)
                : null;
        }

        getAllSteps() {
            return this._clone(
                this.stepsOrdered
            );
        }

        getVisibleSteps() {
            return this.stepsOrdered
                .filter((step) =>
                    this.isStepVisible(step)
                )
                .map((step) =>
                    this._clone(step)
                );
        }

        isStepVisible(stepOrId) {
            const step =
                typeof stepOrId === "string"
                    ? this.getStep(stepOrId)
                    : stepOrId;

            if (!step) {
                return false;
            }

            if (!step.visible_when) {
                return true;
            }

            return Object.entries(
                step.visible_when
            ).every(([field, expected]) => {
                const actual =
                    this._readContextValue(field);

                if (Array.isArray(expected)) {
                    return expected.includes(actual);
                }

                return actual === expected;
            });
        }

        getProgress() {
            const visible = this.getVisibleSteps();
            const index = visible.findIndex(
                (step) => step.id === this.currentStepId
            );

            return {
                current_index:
                    index >= 0 ? index : null,
                current_number:
                    index >= 0 ? index + 1 : null,
                total: visible.length,
                percentage:
                    index >= 0 && visible.length
                        ? Math.round(
                            ((index + 1) /
                                visible.length) *
                            100
                        )
                        : 0
            };
        }

        getWorkflow() {
            return this.workflow
                ? this._clone(this.workflow)
                : null;
        }

        clear() {
            this.workflow = null;
            this.context = {};
            this.stepsOrdered = [];
            this.stepsById.clear();
            this.currentStepId = null;
        }

        _readContextValue(path) {
            return String(path)
                .split(".")
                .reduce(
                    (value, key) =>
                        value == null
                            ? undefined
                            : value[key],
                    this.context
                );
        }

        _validateWorkflow(workflow) {
            if (
                !workflow ||
                typeof workflow !== "object"
            ) {
                throw new Error(
                    "Workflow inválido."
                );
            }

            if (!workflow.id) {
                throw new Error(
                    "O workflow precisa possuir um id."
                );
            }

            if (
                !Array.isArray(workflow.steps) ||
                !workflow.steps.length
            ) {
                throw new Error(
                    "O workflow precisa possuir etapas."
                );
            }

            workflow.steps.forEach(
                (step, index) => {
                    if (!step || !step.id) {
                        throw new Error(
                            `Etapa inválida na posição ${index}.`
                        );
                    }
                }
            );
        }

        _requireLoaded() {
            if (!this.workflow) {
                throw new Error(
                    "Nenhum workflow foi carregado."
                );
            }
        }

        _emitStepChange(reason) {
            if (!this.onStepChange) {
                return;
            }

            this.onStepChange({
                reason,
                step: this.current(),
                progress: this.getProgress(),
                context: this.getContext()
            });
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

    global.WorkflowEngine = WorkflowEngine;

})(window);

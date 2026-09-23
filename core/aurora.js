/**
 * ==========================================================
 * AURORA CORE
 * Aurora Kernel
 * ==========================================================
 *
 * Ponto único de orquestração do núcleo da Aurora.
 *
 * A interface deve conversar com o Kernel, não diretamente
 * com os Engines.
 *
 * O Kernel coordena:
 * - ProfileLoader;
 * - ProfileEngine;
 * - WorkflowLoader;
 * - WorkflowEngine;
 * - CaseEngine.
 * ==========================================================
 */

(function (global) {
    "use strict";

    class Aurora {
        constructor(options = {}) {
            this.paths = {
                profiles:
                    options.profilePath ||
                    "../config/profiles",
                workflows:
                    options.workflowPath ||
                    "../config/workflows"
            };

            this.events = new Map();

            this.profileLoader =
                options.profileLoader ||
                new global.ProfileLoader(
                    this.paths.profiles
                );

            this.profileEngine =
                options.profileEngine ||
                new global.ProfileEngine(
                    this.profileLoader
                );

            this.workflowLoader =
                options.workflowLoader ||
                new global.WorkflowLoader(
                    this.paths.workflows
                );

            this.caseEngine =
                options.caseEngine ||
                new global.CaseEngine({
                    idPrefix:
                        options.caseIdPrefix ||
                        "ATD"
                });

            this.workflowEngine =
                options.workflowEngine ||
                new global.WorkflowEngine({
                    onStepChange:
                        (event) =>
                            this._handleStepChange(
                                event
                            )
                });

            this.activeProfile = null;
            this.activeWorkflow = null;
            this.started = false;
        }

        async start() {
            this._validateDependencies();

            this.started = true;

            this.emit("started", {
                timestamp:
                    new Date().toISOString()
            });

            return this.getState();
        }

        async loadProfile(profileId) {
            this._requireStarted();

            const profile =
                await this.profileEngine.load(
                    profileId
                );

            const workflow =
                await this.workflowLoader.load(
                    profileId
                );

            this.activeProfile = profile;
            this.activeWorkflow = workflow;

            this.workflowEngine.load(
                workflow,
                {}
            );

            this.emit("profile_loaded", {
                profile:
                    this._clone(profile),
                workflow:
                    this._clone(workflow)
            });

            return {
                profile:
                    this.getProfile(),
                workflow:
                    this.getWorkflow(),
                step:
                    this.currentStep()
            };
        }

        newCase(input = {}) {
            this._requireStarted();
            this._requireProfile();

            const mode =
                input.mode ||
                "inspection_only";

            this.workflowEngine.setContext({
                mode
            }, {
                replace: true
            });

            this.workflowEngine.reset();

            const currentStep =
                this.workflowEngine.current();

            const created =
                this.caseEngine.create({
                    ...input,
                    profile_id:
                        this.activeProfile.id,
                    workflow_id:
                        this.activeWorkflow.id,
                    area:
                        input.area ||
                        this.activeProfile.id,
                    mode,
                    current_step:
                        currentStep
                            ? currentStep.id
                            : null
                });

            this.emit("case_created", {
                case: created
            });

            return created;
        }

        openCase(caseData) {
            this._requireStarted();

            const opened =
                this.caseEngine.open(caseData);

            if (
                opened.current_step &&
                this.workflowEngine.getStep(
                    opened.current_step
                )
            ) {
                this.workflowEngine.goto(
                    opened.current_step
                );
            }

            this.workflowEngine.setContext({
                mode: opened.mode
            });

            this.emit("case_opened", {
                case: opened
            });

            return opened;
        }

        currentStep() {
            return this.workflowEngine.current();
        }

        next() {
            this._requireCase();

            const step =
                this.workflowEngine.next();

            return step;
        }

        previous() {
            this._requireCase();

            return this.workflowEngine.previous();
        }

        goto(stepId) {
            this._requireCase();

            return this.workflowEngine.goto(
                stepId
            );
        }

        setMode(mode) {
            this._requireCase();

            this.workflowEngine.setContext({
                mode
            });

            const currentStep =
                this.workflowEngine.current();

            const updated =
                this.caseEngine.update(
                    {
                        mode,
                        current_step:
                            currentStep
                                ? currentStep.id
                                : null
                    },
                    {
                        type:
                            "case_mode_changed",
                        note:
                            `Modo alterado para '${mode}'.`
                    }
                );

            this.emit("mode_changed", {
                mode,
                case: updated,
                step: currentStep
            });

            return updated;
        }

        updateCase(patch, options = {}) {
            this._requireCase();

            const updated =
                this.caseEngine.update(
                    patch,
                    options
                );

            this.emit("case_updated", {
                case: updated
            });

            return updated;
        }

        setStatus(status, options = {}) {
            this._requireCase();

            const updated =
                this.caseEngine.setStatus(
                    status,
                    options
                );

            this.emit("status_changed", {
                case: updated
            });

            return updated;
        }

        addOccurrence(occurrence) {
            this._requireCase();

            const created =
                this.caseEngine.addOccurrence(
                    occurrence
                );

            this.emit("occurrence_added", {
                occurrence: created,
                case: this.getCase()
            });

            return created;
        }

        addReport(report) {
            this._requireCase();

            const created =
                this.caseEngine.addReport(
                    report
                );

            this.emit("report_added", {
                report: created,
                case: this.getCase()
            });

            return created;
        }

        getProfile() {
            return this.activeProfile
                ? this._clone(
                    this.activeProfile
                )
                : null;
        }

        getWorkflow() {
            return this.activeWorkflow
                ? this._clone(
                    this.activeWorkflow
                )
                : null;
        }

        getCase() {
            return this.caseEngine.getCurrent();
        }

        getVisibleSteps() {
            return this.workflowEngine
                .getVisibleSteps();
        }

        getProgress() {
            return this.workflowEngine
                .getProgress();
        }

        getState() {
            return {
                started: this.started,
                profile: this.getProfile(),
                workflow: this.getWorkflow(),
                case: this.getCase(),
                current_step:
                    this.currentStep(),
                progress:
                    this.activeWorkflow
                        ? this.getProgress()
                        : null
            };
        }

        closeCase() {
            this.caseEngine.close();

            if (this.activeWorkflow) {
                this.workflowEngine.reset();
            }

            this.emit("case_closed", {});

            return this.getState();
        }

        on(eventName, listener) {
            if (
                typeof listener !== "function"
            ) {
                throw new Error(
                    "O listener precisa ser uma função."
                );
            }

            if (!this.events.has(eventName)) {
                this.events.set(
                    eventName,
                    new Set()
                );
            }

            this.events
                .get(eventName)
                .add(listener);

            return () =>
                this.off(
                    eventName,
                    listener
                );
        }

        off(eventName, listener) {
            const listeners =
                this.events.get(eventName);

            if (!listeners) {
                return;
            }

            listeners.delete(listener);

            if (!listeners.size) {
                this.events.delete(eventName);
            }
        }

        emit(eventName, payload) {
            const listeners =
                this.events.get(eventName);

            if (!listeners) {
                return;
            }

            listeners.forEach(
                (listener) => {
                    listener(
                        this._clone(payload)
                    );
                }
            );
        }

        _handleStepChange(event) {
            if (
                this.caseEngine.hasCurrent() &&
                event.step
            ) {
                this.caseEngine.setCurrentStep(
                    event.step.id,
                    {
                        note:
                            `Kernel sincronizou a etapa '${event.step.id}'.`
                    }
                );
            }

            this.emit("step_changed", {
                ...event,
                case: this.getCase()
            });
        }

        _validateDependencies() {
            const required = [
                "ProfileLoader",
                "ProfileEngine",
                "WorkflowLoader",
                "WorkflowEngine",
                "CaseEngine"
            ];

            const missing =
                required.filter(
                    (name) =>
                        typeof global[name] !==
                        "function"
                );

            if (missing.length) {
                throw new Error(
                    "Dependências ausentes: " +
                    missing.join(", ")
                );
            }
        }

        _requireStarted() {
            if (!this.started) {
                throw new Error(
                    "A Aurora ainda não foi iniciada."
                );
            }
        }

        _requireProfile() {
            if (
                !this.activeProfile ||
                !this.activeWorkflow
            ) {
                throw new Error(
                    "Nenhum perfil foi carregado."
                );
            }
        }

        _requireCase() {
            if (!this.caseEngine.hasCurrent()) {
                throw new Error(
                    "Nenhum Case está aberto."
                );
            }
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

    global.Aurora = Aurora;

})(window);

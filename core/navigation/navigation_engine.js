(function (global) {
    "use strict";

    class NavigationEngine {
        constructor(options = {}) {
            if (!options.aurora) {
                throw new Error("Aurora instance is required.");
            }

            if (!options.router) {
                throw new Error("RouterAdapter instance is required.");
            }

            this.aurora = options.aurora;
            this.router = options.router;
            this.started = false;

            this.unsubscribeStep = this.aurora.on(
                "step_changed",
                (event) => {
                    if (this.started && event && event.step) {
                        this.renderStep(
                            event.step,
                            event.reason || "step_changed"
                        );
                    }
                }
            );
        }

        async start() {
            if (!this.aurora.started) {
                await this.aurora.start();
            }

            this.started = true;

            const step = this.aurora.currentStep();

            if (step) {
                await this.renderStep(step, "start");
            }

            return this.getState();
        }

        async renderStep(step, reason = "render") {
            if (!step || !step.id) {
                throw new Error("Invalid workflow step.");
            }

            const screen =
                typeof step.screen === "string" &&
                step.screen.trim()
                    ? step.screen.trim()
                    : step.id;

            await this.router.render({
                screen,
                step,
                output: {
                    title:
                        step.title ||
                        step.name ||
                        step.id
                },
                metadata: {
                    reason,
                    progress: this.aurora.getProgress()
                }
            });

            return this.getState();
        }

        async renderCurrent() {
            this._requireStarted();

            const step = this.aurora.currentStep();

            if (!step) {
                throw new Error("No current step.");
            }

            return this.renderStep(
                step,
                "render_current"
            );
        }

        async next() {
            this._requireStarted();
            this.aurora.next();
            await this._waitForRoute();
            return this.getState();
        }

        async previous() {
            this._requireStarted();
            this.aurora.previous();
            await this._waitForRoute();
            return this.getState();
        }

        async goto(stepId) {
            this._requireStarted();
            this.aurora.goto(stepId);
            await this._waitForRoute();
            return this.getState();
        }

        async refresh() {
            return this.renderCurrent();
        }

        getState() {
            const step = this.aurora.currentStep();
            const route = this.router.getCurrent();

            return {
                started: this.started,
                step: step ? this._clone(step) : null,
                screen: route ? route.screen : null,
                can_go_next:
                    this.aurora.activeWorkflow
                        ? !this.aurora.workflowEngine.isLast()
                        : false,
                can_go_previous:
                    this.aurora.activeWorkflow
                        ? !this.aurora.workflowEngine.isFirst()
                        : false,
                progress:
                    this.aurora.activeWorkflow
                        ? this.aurora.getProgress()
                        : null,
                route: route ? this._clone(route) : null,
                case: this.aurora.getCase()
            };
        }

        destroy() {
            if (this.unsubscribeStep) {
                this.unsubscribeStep();
            }

            this.started = false;
        }

        _requireStarted() {
            if (!this.started) {
                throw new Error(
                    "NavigationEngine is not started."
                );
            }
        }

        _waitForRoute() {
            return new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        }

        _clone(value) {
            return JSON.parse(
                JSON.stringify(value)
            );
        }
    }

    global.NavigationEngine =
        NavigationEngine;

})(window);
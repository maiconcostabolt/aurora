(function (global) {
"use strict";

class DynamicWorkflowBinder {
    constructor(options = {}) {
        if (!options.navigation) {
            throw new Error("DynamicWorkflowBinder requires a NavigationEngine.");
        }

        if (!options.viewManager) {
            throw new Error("DynamicWorkflowBinder requires a ViewManager.");
        }

        if (!options.caseBinder) {
            throw new Error("DynamicWorkflowBinder requires a CaseBinder.");
        }

        this.navigation = options.navigation;
        this.viewManager = options.viewManager;
        this.caseBinder = options.caseBinder;
        this.screenMap = options.screenMap || {};
        this.started = false;
        this.unsubscribe = null;
    }

    async start() {
        if (this.started) return this.getState();

        this.unsubscribe = this.navigation.on("rendered", async event => {
            if (event && event.route) {
                await this.renderRoute(event.route);
            }
        });

        this.started = true;

        const route = this.navigation.getCurrentRoute
            ? this.navigation.getCurrentRoute()
            : null;

        if (route) await this.renderRoute(route);

        return this.getState();
    }

    resolveControllerId(route) {
        return this.screenMap[route.screen] || route.screen;
    }

    async renderRoute(route) {
        const controllerId = this.resolveControllerId(route);

        await this.viewManager.show(
            controllerId,
            this.caseBinder.read()
        );

        return this.getState();
    }

    async saveCurrent() {
        const controller = this.viewManager.getCurrentController();

        if (!controller) return null;

        const valid = await this.viewManager.validateCurrent();

        if (!valid) {
            return {
                valid: false,
                saved: false
            };
        }

        const patch = await this.viewManager.saveCurrent();

        if (patch) {
            this.caseBinder.bindModule(controller.id, patch);
        }

        return {
            valid: true,
            saved: Boolean(patch),
            patch
        };
    }

    async next() {
        const result = await this.saveCurrent();

        if (result && result.valid === false) return result;

        await this.navigation.next();

        return {
            valid: true,
            navigated: true,
            state: this.getState()
        };
    }

    async previous() {
        await this.navigation.previous();
        return this.getState();
    }

    async goto(stepId) {
        await this.navigation.goto(stepId);
        return this.getState();
    }

    destroy() {
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = null;
        this.started = false;
    }

    getState() {
        return {
            started: this.started,
            navigation: this.navigation.getState ? this.navigation.getState() : null,
            view: this.viewManager.getState(),
            case: this.caseBinder.read()
        };
    }
}

global.DynamicWorkflowBinder = DynamicWorkflowBinder;
})(window);
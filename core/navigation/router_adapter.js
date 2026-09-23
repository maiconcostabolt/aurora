/**
 * ==========================================================
 * AURORA CORE
 * Router Adapter
 * ==========================================================
 *
 * Receives a route and sends it to the UI renderer.
 *
 * Responsibilities:
 * - render a route;
 * - keep the current route;
 * - keep navigation history;
 * - expose current state;
 * - clear router state.
 *
 * This module does not know the Workflow Engine,
 * the Case Engine or any specific HTML screen.
 * ==========================================================
 */

(function (global) {
    "use strict";

    class RouterAdapter {
        constructor(options = {}) {
            this.renderer =
                typeof options.renderer === "function"
                    ? options.renderer
                    : null;

            this.currentRoute = null;
            this.history = [];
        }

        async render(route) {
            const normalized =
                this._normalizeRoute(route);

            this.currentRoute = normalized;

            this.history.push(
                this._clone(normalized)
            );

            if (this.renderer) {
                await this.renderer(
                    this._clone(normalized)
                );
            }

            return this.getCurrent();
        }

        getCurrent() {
            return this.currentRoute
                ? this._clone(this.currentRoute)
                : null;
        }

        getHistory() {
            return this._clone(this.history);
        }

        count() {
            return this.history.length;
        }

        hasCurrent() {
            return Boolean(this.currentRoute);
        }

        clear() {
            this.currentRoute = null;
            this.history = [];
        }

        _normalizeRoute(route) {
            if (!route || typeof route !== "object") {
                throw new Error("Invalid route.");
            }

            if (
                typeof route.screen !== "string" ||
                !route.screen.trim()
            ) {
                throw new Error(
                    "The route requires a valid screen."
                );
            }

            return {
                screen: route.screen.trim(),
                step: route.step
                    ? this._clone(route.step)
                    : null,
                output: route.output === undefined
                    ? null
                    : this._clone(route.output),
                metadata: route.metadata
                    ? this._clone(route.metadata)
                    : {},
                rendered_at:
                    new Date().toISOString()
            };
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

    global.RouterAdapter = RouterAdapter;

})(window);

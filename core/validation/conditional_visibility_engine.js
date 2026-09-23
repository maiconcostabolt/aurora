(function (global) {
"use strict";

class ConditionalVisibilityEngine {
    evaluate(condition, context = {}) {
        if (condition === null || condition === undefined) return true;
        if (typeof condition === "boolean") return condition;

        if (Array.isArray(condition)) {
            return condition.every(item => this.evaluate(item, context));
        }

        if (typeof condition !== "object") {
            throw new Error("Invalid visibility condition.");
        }

        if (Array.isArray(condition.all)) {
            return condition.all.every(item => this.evaluate(item, context));
        }

        if (Array.isArray(condition.any)) {
            return condition.any.some(item => this.evaluate(item, context));
        }

        if (condition.not) return !this.evaluate(condition.not, context);

        const actual = this._getByPath(context, condition.path);

        if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
            return actual === condition.equals;
        }

        if (Array.isArray(condition.in)) {
            return condition.in.includes(actual);
        }

        if (Object.prototype.hasOwnProperty.call(condition, "exists")) {
            const exists = actual !== undefined && actual !== null && actual !== "";
            return condition.exists ? exists : !exists;
        }

        if (Object.prototype.hasOwnProperty.call(condition, "truthy")) {
            return condition.truthy ? Boolean(actual) : !Boolean(actual);
        }

        throw new Error("Unsupported visibility condition.");
    }

    filter(items = [], context = {}) {
        return items.filter(item => this.evaluate(item.visible_when, context));
    }

    applyToContainer(container, items, context = {}) {
        if (!container) throw new Error("A valid container is required.");

        items.forEach(item => {
            const element = container.querySelector(
                `[data-visibility-id="${item.id}"]`
            );

            if (element) {
                element.hidden = !this.evaluate(item.visible_when, context);
            }
        });
    }

    _getByPath(source, path) {
        if (!path) return undefined;

        return String(path).split(".").reduce((current, key) => {
            return current == null ? undefined : current[key];
        }, source);
    }
}

global.ConditionalVisibilityEngine = ConditionalVisibilityEngine;
})(window);
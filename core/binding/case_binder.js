(function (global) {
"use strict";

class CaseBinder {
    constructor(options = {}) {
        this.getCase = typeof options.getCase === "function" ? options.getCase : null;
        this.updateCase = typeof options.updateCase === "function" ? options.updateCase : null;
        this.caseData = this._clone(options.caseData || {});
        this.history = [];
    }

    read(path = "") {
        const source = this.getCase ? this.getCase() : this.caseData;
        if (!path) return this._clone(source || {});

        return this._clone(
            String(path).split(".").reduce((current, key) => {
                return current == null ? undefined : current[key];
            }, source || {})
        );
    }

    write(path, value, metadata = {}) {
        if (typeof path !== "string" || !path.trim()) {
            throw new Error("A valid case path is required.");
        }

        const current = this.read();
        const keys = path.trim().split(".");
        let target = current;

        keys.forEach((key, index) => {
            if (index === keys.length - 1) {
                target[key] = this._clone(value);
                return;
            }

            if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
                target[key] = {};
            }

            target = target[key];
        });

        this._commit(current);

        this.history.push({
            type: "case_write",
            path: path.trim(),
            value: this._clone(value),
            metadata: this._clone(metadata),
            timestamp: new Date().toISOString()
        });

        return this.read(path);
    }

    merge(patch = {}, metadata = {}) {
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
            throw new Error("Case patch must be an object.");
        }

        const merged = this._deepMerge(this.read(), patch);
        this._commit(merged);

        this.history.push({
            type: "case_merge",
            patch: this._clone(patch),
            metadata: this._clone(metadata),
            timestamp: new Date().toISOString()
        });

        return this.read();
    }

    bindModule(moduleId, patch) {
        if (typeof moduleId !== "string" || !moduleId.trim()) {
            throw new Error("A valid module id is required.");
        }

        if (!patch || typeof patch !== "object") {
            throw new Error("A valid module patch is required.");
        }

        const id = moduleId.trim();
        const value = Object.prototype.hasOwnProperty.call(patch, id)
            ? patch[id]
            : patch;

        return this.write(id, value, {
            source: "module",
            module_id: id
        });
    }

    getHistory() {
        return this._clone(this.history);
    }

    _commit(nextCase) {
        if (this.updateCase) {
            this.updateCase(this._clone(nextCase));
        } else {
            this.caseData = this._clone(nextCase);
        }
    }

    _deepMerge(target, patch) {
        const output = this._clone(target || {});

        Object.entries(patch).forEach(([key, value]) => {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                output[key] = this._deepMerge(output[key] || {}, value);
            } else {
                output[key] = this._clone(value);
            }
        });

        return output;
    }

    _clone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }
}

global.CaseBinder = CaseBinder;
})(window);
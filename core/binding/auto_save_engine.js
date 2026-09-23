(function (global) {
"use strict";

class AutoSaveEngine {
    constructor(options = {}) {
        if (typeof options.save !== "function") {
            throw new Error("AutoSaveEngine requires a save function.");
        }

        this.saveFunction = options.save;
        this.delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : 500;
        this.timer = null;
        this.pendingValue = null;
        this.saving = false;
        this.saveCount = 0;
        this.lastSavedAt = null;
        this.lastResult = null;
    }

    schedule(value) {
        this.pendingValue = this._clone(value);

        if (this.timer) clearTimeout(this.timer);

        this.timer = setTimeout(() => {
            this.flush();
        }, this.delay);

        return this.getState();
    }

    async flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.pendingValue === null) return this.lastResult;

        const value = this._clone(this.pendingValue);
        this.pendingValue = null;
        this.saving = true;

        try {
            this.lastResult = await this.saveFunction(value);
            this.saveCount += 1;
            this.lastSavedAt = new Date().toISOString();
            return this._clone(this.lastResult);
        } finally {
            this.saving = false;
        }
    }

    cancel() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.pendingValue = null;
        return this.getState();
    }

    getState() {
        return {
            pending: this.pendingValue !== null,
            saving: this.saving,
            save_count: this.saveCount,
            last_saved_at: this.lastSavedAt,
            last_result: this._clone(this.lastResult)
        };
    }

    _clone(value) {
        if (value === undefined) return undefined;
        if (value === null) return null;
        return JSON.parse(JSON.stringify(value));
    }
}

global.AutoSaveEngine = AutoSaveEngine;
})(window);
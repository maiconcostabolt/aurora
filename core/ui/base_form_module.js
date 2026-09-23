(function (global) {
"use strict";

class BaseFormModule extends global.ModuleController {
    constructor(options = {}) {
        super({id: options.id});

        if (!options.schemaEngine) {
            throw new Error("BaseFormModule requires a UISchemaEngine.");
        }

        if (!options.formRenderer) {
            throw new Error("BaseFormModule requires a FormRenderer.");
        }

        this.schemaEngine = options.schemaEngine;
        this.formRenderer = options.formRenderer;
        this.schema = options.schema || null;
        this.form = null;
        this.initialValues = {};
    }

    async onLoad(context = {}) {
        if (this.schema && !this.schemaEngine.get(this.schema.id)) {
            this.schemaEngine.register(this.schema);
        }

        this.initialValues = context[this.id] || {};
    }

    async render() {
        return [
            `<section class="aurora-module" data-module="${this.id}">`,
            `<div data-form-host="${this.id}"></div>`,
            `</section>`
        ].join("");
    }

    async bindEvents(container) {
        const host = container.querySelector(
            `[data-form-host="${this.id}"]`
        );

        this.form = this.formRenderer.mount(
            host,
            this.schemaEngine.get(this.id),
            this.initialValues
        );
    }

    async onValidate() {
        return this.formRenderer.validate(this.form).valid;
    }

    async onSave() {
        return {
            [this.id]: this.formRenderer.read(this.form)
        };
    }

    async onUnmount() {
        this.form = null;
    }
}

global.BaseFormModule = BaseFormModule;
})(window);
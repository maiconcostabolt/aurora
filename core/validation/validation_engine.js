(function (global) {
"use strict";

class ValidationEngine {
    constructor() {
        this.validators = new Map();
        this._registerDefaults();
    }

    register(name, validator) {
        if (typeof name !== "string" || !name.trim()) {
            throw new Error("A valid validator name is required.");
        }

        if (typeof validator !== "function") {
            throw new Error(`Validator '${name}' must be a function.`);
        }

        this.validators.set(name.trim(), validator);
    }

    validateField(field, value, data = {}) {
        const errors = [];

        this._normalizeRules(field).forEach(rule => {
            const validator = this.validators.get(rule.name);

            if (!validator) {
                throw new Error(`Validator '${rule.name}' is not registered.`);
            }

            const result = validator(value, rule.value, data, field);

            if (result !== true) {
                errors.push(
                    typeof result === "string"
                        ? result
                        : rule.message || `Campo '${field.id}' inválido.`
                );
            }
        });

        return {
            field_id: field.id,
            valid: errors.length === 0,
            errors
        };
    }

    validateSchema(schema, data = {}) {
        const results = (Array.isArray(schema.fields) ? schema.fields : [])
            .map(field => this.validateField(field, data[field.id], data));

        const errors = {};

        results.forEach(result => {
            if (!result.valid) errors[result.field_id] = result.errors;
        });

        return {
            valid: Object.keys(errors).length === 0,
            errors,
            results
        };
    }

    _registerDefaults() {
        this.register("required", value => {
            if (value === true || value === false) return true;
            return String(value ?? "").trim() ? true : "Campo obrigatório.";
        });

        this.register("minLength", (value, minimum) => {
            if (value === null || value === undefined || value === "") return true;
            return String(value).length >= Number(minimum)
                ? true
                : `Use pelo menos ${minimum} caracteres.`;
        });

        this.register("email", value => {
            if (!value) return true;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))
                ? true
                : "E-mail inválido.";
        });

        this.register("number", value => {
            if (value === "" || value === null || value === undefined) return true;
            return Number.isFinite(Number(value)) ? true : "Número inválido.";
        });
    }

    _normalizeRules(field) {
        const rules = [];

        if (field.required) rules.push({name:"required",value:true});
        if (field.type === "email") rules.push({name:"email",value:true});
        if (field.type === "number") rules.push({name:"number",value:true});

        if (Array.isArray(field.rules)) {
            field.rules.forEach(rule => {
                rules.push(
                    typeof rule === "string"
                        ? {name:rule,value:true}
                        : rule
                );
            });
        }

        return rules;
    }
}

global.ValidationEngine = ValidationEngine;
})(window);
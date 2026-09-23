(function (global) {
    "use strict";

    class UISchemaEngine {
        constructor() {
            this.schemas = new Map();
            this.currentSchemaId = null;
        }

        register(schema) {
            this._validate(schema);

            const copy = this._clone(schema);
            this.schemas.set(copy.id, copy);

            return this.get(copy.id);
        }

        registerMany(schemas = []) {
            if (!Array.isArray(schemas)) {
                throw new Error("Schemas must be an array.");
            }

            schemas.forEach((schema) => {
                this.register(schema);
            });

            return this.getIds();
        }

        select(schemaId) {
            if (!this.schemas.has(schemaId)) {
                throw new Error(
                    `Schema '${schemaId}' is not registered.`
                );
            }

            this.currentSchemaId = schemaId;
            return this.getCurrent();
        }

        get(schemaId) {
            const schema = this.schemas.get(schemaId);
            return schema ? this._clone(schema) : null;
        }

        getCurrent() {
            return this.currentSchemaId
                ? this.get(this.currentSchemaId)
                : null;
        }

        getIds() {
            return Array.from(this.schemas.keys());
        }

        getFields(schemaId = null) {
            const schema = schemaId
                ? this.get(schemaId)
                : this.getCurrent();

            return schema
                ? this._clone(schema.fields || [])
                : [];
        }

        clear() {
            this.schemas.clear();
            this.currentSchemaId = null;
        }

        _validate(schema) {
            if (!schema || typeof schema !== "object") {
                throw new Error("Invalid UI schema.");
            }

            if (
                typeof schema.id !== "string" ||
                !schema.id.trim()
            ) {
                throw new Error(
                    "UI schema requires a valid id."
                );
            }

            if (!Array.isArray(schema.fields)) {
                throw new Error(
                    `Schema '${schema.id}' requires a fields array.`
                );
            }

            const ids = new Set();

            schema.fields.forEach((field, index) => {
                if (
                    !field ||
                    typeof field.id !== "string" ||
                    !field.id.trim()
                ) {
                    throw new Error(
                        `Invalid field at position ${index}.`
                    );
                }

                if (ids.has(field.id)) {
                    throw new Error(
                        `Duplicated field id: '${field.id}'.`
                    );
                }

                ids.add(field.id);
            });
        }

        _clone(value) {
            return JSON.parse(JSON.stringify(value));
        }
    }

    global.UISchemaEngine = UISchemaEngine;

})(window);
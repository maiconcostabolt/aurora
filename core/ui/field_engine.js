(function (global) {
    "use strict";

    class FieldEngine {
        constructor(options = {}) {
            this.libraryEngine =
                options.libraryEngine ||
                null;

            this.renderers =
                new Map();

            this._registerDefaults();
        }

        register(type, renderer) {
            if (
                typeof type !== "string" ||
                !type.trim()
            ) {
                throw new Error(
                    "A valid field type is required."
                );
            }

            if (
                typeof renderer !==
                "function"
            ) {
                throw new Error(
                    `Renderer for '${type}' must be a function.`
                );
            }

            this.renderers.set(
                type.trim(),
                renderer
            );
        }

        render(field, value = "") {
            if (!field || !field.id) {
                throw new Error(
                    "Invalid field."
                );
            }

            const type =
                field.type || "text";

            const renderer =
                this.renderers.get(type);

            if (!renderer) {
                throw new Error(
                    `Field type '${type}' is not registered.`
                );
            }

            return renderer(
                this._clone(field),
                value
            );
        }

        renderMany(
            fields = [],
            values = {}
        ) {
            return fields
                .map((field) => {
                    return this.render(
                        field,
                        values[field.id] ?? ""
                    );
                })
                .join("");
        }

        getRegisteredTypes() {
            return Array.from(
                this.renderers.keys()
            );
        }

        _registerDefaults() {
            this.register(
                "text",
                (field, value) => {
                    return this._wrap(
                        field,
                        `<input type="text" id="${field.id}" name="${field.id}" value="${this._escape(value)}" ${field.placeholder ? `placeholder="${this._escape(field.placeholder)}"` : ""} ${field.required ? "required" : ""}>`
                    );
                }
            );

            this.register(
                "phone",
                (field, value) => {
                    return this._wrap(
                        field,
                        `<input type="tel" id="${field.id}" name="${field.id}" value="${this._escape(value)}" ${field.required ? "required" : ""}>`
                    );
                }
            );

            this.register(
                "email",
                (field, value) => {
                    return this._wrap(
                        field,
                        `<input type="email" id="${field.id}" name="${field.id}" value="${this._escape(value)}" ${field.required ? "required" : ""}>`
                    );
                }
            );

            this.register(
                "number",
                (field, value) => {
                    return this._wrap(
                        field,
                        `<input type="number" id="${field.id}" name="${field.id}" value="${this._escape(value)}" ${field.required ? "required" : ""}>`
                    );
                }
            );

            this.register(
                "date",
                (field, value) => {
                    return this._wrap(
                        field,
                        `<input type="date" id="${field.id}" name="${field.id}" value="${this._escape(value)}" ${field.required ? "required" : ""}>`
                    );
                }
            );

            /*
             * Vistoria veicular registra a hora de entrada do automóvel.
             * Sem um renderer para `time`, a montagem do formulário era
             * interrompida e a etapa permanecia visualmente vazia.
             */
            this.register(
                "time",
                (field, value) => {
                    return this._wrap(
                        field,
                        `<input type="time" id="${field.id}" name="${field.id}" value="${this._escape(value)}" ${field.required ? "required" : ""}>`
                    );
                }
            );

            this.register(
                "textarea",
                (field, value) => {
                    return this._wrap(
                        field,
                        `<textarea id="${field.id}" name="${field.id}" ${field.placeholder ? `placeholder="${this._escape(field.placeholder)}"` : ""} ${field.required ? "required" : ""}>${this._escape(value)}</textarea>`
                    );
                }
            );

            this.register(
                "checkbox",
                (field, value) => {
                    return [
                        `<div class="aurora-field aurora-field--checkbox" data-field-id="${field.id}">`,
                        `<label>`,
                        `<input type="checkbox" id="${field.id}" name="${field.id}" ${value ? "checked" : ""}>`,
                        `<span>${this._escape(field.label || field.id)}</span>`,
                        `</label>`,
                        `</div>`
                    ].join("");
                }
            );

            this.register(
                "select",
                (field, value) => {
                    return this._renderSelect(
                        field,
                        value,
                        field.options || []
                    );
                }
            );

            this.register(
                "library_select",
                (field, value) => {
                    if (!this.libraryEngine) {
                        throw new Error(
                            "library_select requires a LibraryEngine."
                        );
                    }

                    if (!field.library) {
                        throw new Error(
                            `Field '${field.id}' requires a library id.`
                        );
                    }

                    const options =
                        this.libraryEngine.getItems(
                            field.library
                        );

                    return this._renderSelect(
                        field,
                        value,
                        options
                    );
                }
            );
        }

        _renderSelect(
            field,
            value,
            options
        ) {
            const normalizedValue =
                String(value ?? "").trim();
            const html = options
                .map((option) => {
                    const item =
                        typeof option === "object"
                            ? option
                            : {
                                value: option,
                                label: option
                            };

                    const selected =
                        String(item.value) ===
                        normalizedValue
                            ? "selected"
                            : "";

                    return `<option value="${this._escape(item.value)}" ${selected}>${this._escape(item.label)}</option>`;
                })
                .join("");
            const hasValue = options.some((option) => {
                const item =
                    typeof option === "object"
                        ? option
                        : { value: option };
                return (
                    String(item.value) ===
                    normalizedValue
                );
            });
            const placeholderSelected =
                !hasValue ? " selected" : "";

            return this._wrap(
                field,
                `<select id="${field.id}" name="${field.id}" ${field.required ? "required" : ""}><option value="" disabled hidden${placeholderSelected}>Selecione</option>${html}</select>`
            );
        }

        _wrap(field, control) {
            return [
                `<div class="aurora-field" data-field-id="${field.id}">`,
                `<label for="${field.id}">${this._escape(field.label || field.id)}</label>`,
                control,
                field.help
                    ? `<small>${this._escape(field.help)}</small>`
                    : "",
                `</div>`
            ].join("");
        }

        _escape(value) {
            return String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        }

        _clone(value) {
            return JSON.parse(
                JSON.stringify(value)
            );
        }
    }

    global.FieldEngine =
        FieldEngine;

})(window);

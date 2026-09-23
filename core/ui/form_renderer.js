(function (global) {
    "use strict";

    class FormRenderer {
        constructor(options = {}) {
            if (!options.fieldEngine) {
                throw new Error(
                    "FormRenderer requires a FieldEngine."
                );
            }

            this.fieldEngine = options.fieldEngine;
        }

        render(schema, values = {}) {
            this._validateSchema(schema);

            return [
                `<form class="aurora-form" data-schema-id="${schema.id}" novalidate>`,
                `<header class="aurora-form__header">`,
                `<h2>${this._escape(schema.title || schema.id)}</h2>`,
                schema.description
                    ? `<p>${this._escape(schema.description)}</p>`
                    : "",
                `</header>`,
                `<div class="aurora-form__fields">`,
                this.fieldEngine.renderMany(
                    schema.fields.filter((field) => field.id !== "confirmed"),
                    values
                ),
                `</div>`,
                `</form>`
            ].join("");
        }

        mount(container, schema, values = {}) {
            if (
                !container ||
                typeof container.innerHTML !== "string"
            ) {
                throw new Error(
                    "A valid DOM container is required."
                );
            }

            container.innerHTML =
                this.render(schema, values);

            return container.querySelector(
                ".aurora-form"
            );
        }

        read(form) {
            if (!form || form.tagName !== "FORM") {
                throw new Error("A valid form is required.");
            }

            const data = {};

            form.querySelectorAll(
                "input, select, textarea"
            ).forEach((field) => {
                data[field.name || field.id] =
                    field.type === "checkbox"
                        ? field.checked
                        : field.value;
            });

            return data;
        }

        validate(form) {
            if (!form || form.tagName !== "FORM") {
                throw new Error("A valid form is required.");
            }

            const invalid = Array.from(
                form.querySelectorAll("[required]")
            ).filter((field) => {
                const value = String(
                    field.value || ""
                ).trim();

                if (!value) {
                    return true;
                }

                if (field.tagName === "SELECT") {
                    const allowed = Array.from(
                        field.options || []
                    )
                        .filter(
                            (option) =>
                                !option.disabled &&
                                String(
                                    option.value ||
                                        ""
                                ).trim()
                        )
                        .map((option) =>
                            String(
                                option.value
                            ).trim()
                        );

                    return !allowed.includes(value);
                }

                return false;
            });

            invalid.forEach((field) => {
                field.setAttribute(
                    "aria-invalid",
                    "true"
                );
            });

            return {
                valid: invalid.length === 0,
                invalid_fields:
                    invalid.map((field) => {
                        return field.name || field.id;
                    })
            };
        }

        _validateSchema(schema) {
            if (
                !schema ||
                !schema.id ||
                !Array.isArray(schema.fields)
            ) {
                throw new Error("Invalid form schema.");
            }
        }

        _escape(value) {
            return String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        }
    }

    global.FormRenderer = FormRenderer;

})(window);

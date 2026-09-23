(function (global) {
    "use strict";

    class OccurrenceModuleController
        extends global.ModuleController {

        constructor(options = {}) {
            super({
                id: "occurrence"
            });

            if (!options.formRenderer) {
                throw new Error(
                    "OccurrenceModuleController requires a FormRenderer."
                );
            }

            if (!options.schemaEngine) {
                throw new Error(
                    "OccurrenceModuleController requires a UISchemaEngine."
                );
            }

            this.formRenderer =
                options.formRenderer;

            this.schemaEngine =
                options.schemaEngine;

            this.form = null;
            this.initialValues = {};
        }

        async onLoad(context) {
            if (
                !this.schemaEngine.get(
                    "occurrence"
                )
            ) {
                this.schemaEngine.register({
                    id: "occurrence",
                    title: "Ocorrência",
                    description:
                        "Registre a condição encontrada.",
                    fields: [
                        {
                            id: "item",
                            type: "text",
                            label: "Item inspecionado",
                            required: true
                        },
                        {
                            id: "title",
                            type: "text",
                            label: "Título",
                            required: true
                        },
                        {
                            id: "description",
                            type: "textarea",
                            label: "Descrição",
                            required: true
                        },
                        {
                            id: "severity",
                            type: "library_select",
                            label: "Gravidade",
                            library: "severity"
                        },
                        {
                            id: "recommendation",
                            type: "textarea",
                            label: "Recomendação"
                        },
                        {
                            id: "follow_up",
                            type: "checkbox",
                            label:
                                "Criar acompanhamento periódico"
                        }
                    ]
                });
            }

            this.initialValues =
                context.occurrence || {};
        }

        async render() {
            return [
                `<section class="aurora-module aurora-module--occurrence" data-module="occurrence">`,
                `<div data-form-host="occurrence"></div>`,
                `</section>`
            ].join("");
        }

        async bindEvents(container) {
            const host =
                container.querySelector(
                    '[data-form-host="occurrence"]'
                );

            this.form =
                this.formRenderer.mount(
                    host,
                    this.schemaEngine.get(
                        "occurrence"
                    ),
                    this.initialValues
                );
        }

        async onValidate() {
            return this.formRenderer
                .validate(this.form)
                .valid;
        }

        async onSave() {
            return {
                occurrence:
                    this.formRenderer.read(
                        this.form
                    )
            };
        }

        async onUnmount() {
            this.form = null;
        }
    }

    global.OccurrenceModuleController =
        OccurrenceModuleController;

})(window);
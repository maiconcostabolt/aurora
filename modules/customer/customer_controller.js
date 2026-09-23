(function (global) {
    "use strict";

    class CustomerModuleController
        extends global.ModuleController {

        constructor(options = {}) {
            super({ id: "customer" });

            if (!options.formRenderer) {
                throw new Error(
                    "CustomerModuleController requires a FormRenderer."
                );
            }

            if (!options.schemaEngine) {
                throw new Error(
                    "CustomerModuleController requires a UISchemaEngine."
                );
            }

            this.formRenderer = options.formRenderer;
            this.schemaEngine = options.schemaEngine;
            this.form = null;
        }

        _buildSchema(serviceId) {
            const fields = [
                {
                    id: "name",
                    type: "text",
                    label: "Nome ou razão social",
                    required: true
                }
            ];

            if (serviceId === "grounding_equipotentialization") {
                fields.push(
                    {
                        id: "document",
                        type: "text",
                        label: "CNPJ",
                        placeholder: "00.000.000/0000-00"
                    },
                    {
                        id: "address",
                        type: "text",
                        label: "Endereço do cliente",
                        placeholder: "Rua, número, bairro, cidade"
                    }
                );
            } else if (serviceId === "sofa_cleaning") {
                fields.push({
                    id: "address",
                    type: "text",
                    label: "Endereço do cliente",
                    placeholder: "Rua, número, bairro, cidade",
                    required: true
                });
            }

            fields.push(
                {
                    id: "phone",
                    type: "phone",
                    label: "Telefone"
                },
                {
                    id: "email",
                    type: "email",
                    label: "E-mail"
                },
                {
                    id: "person_type",
                    type: "select",
                    label: "Tipo de cliente",
                    options: [
                        "Pessoa Física",
                        "Empresa",
                        "Condomínio"
                    ]
                }
            );

            return {
                id: "customer",
                title: "Cliente",
                description:
                    "Identifique quem solicitou o atendimento.",
                fields
            };
        }

        async onLoad(context) {
            const serviceId = String(
                context &&
                context.service &&
                context.service.id ||
                ""
            ).toLowerCase();

            this.schemaEngine.register(
                this._buildSchema(serviceId)
            );

            this.initialValues =
                context.customer || {};
        }

        async render() {
            const schema =
                this.schemaEngine.get("customer");

            return [
                `<section class="aurora-module aurora-module--customer" data-module="customer">`,
                `<div data-form-host="customer"></div>`,
                `</section>`
            ].join("");
        }

        async bindEvents(container) {
            const host = container.querySelector(
                '[data-form-host="customer"]'
            );

            this.form = this.formRenderer.mount(
                host,
                this.schemaEngine.get("customer"),
                this.initialValues || {}
            );
        }

        async onValidate() {
            return this.formRenderer
                .validate(this.form)
                .valid;
        }

        async onSave() {
            return {
                customer:
                    this.formRenderer.read(
                        this.form
                    )
            };
        }

        async onUnmount() {
            this.form = null;
        }
    }

    global.CustomerModuleController =
        CustomerModuleController;

})(window);

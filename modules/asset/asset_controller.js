(function (global) {
    "use strict";

    class AssetModuleController
        extends global.ModuleController {

        constructor(options = {}) {
            super({
                id: "asset"
            });

            if (!options.formRenderer) {
                throw new Error(
                    "AssetModuleController requires a FormRenderer."
                );
            }

            if (!options.schemaEngine) {
                throw new Error(
                    "AssetModuleController requires a UISchemaEngine."
                );
            }

            this.formRenderer =
                options.formRenderer;

            this.schemaEngine =
                options.schemaEngine;

            this.schema =
                options.schema || null;

            this.form = null;
            this.initialValues = {};
        }

        async onLoad(context) {
            const serviceId = String(
                context && context.service && context.service.id || ""
            ).toLowerCase();

            /*
             * Garantia local para a Vistoria Veicular. Mesmo durante a troca
             * de serviço, o controller monta imediatamente o formulário
             * correto e não depende de um schema antigo da Oficina.
             */
            if (serviceId === "vehicle_inspection") {
                this.schemaEngine.register({
                    id: "asset",
                    title: "Veículo recebido",
                    description: "Identifique o veículo e registre os dados exibidos no momento da entrada.",
                    fields: [
                        {id:"identification",type:"text",label:"Marca e modelo",placeholder:"Ex.: Honda Civic",required:true},
                        {id:"plate",type:"text",label:"Placa",required:true},
                        {id:"year_model",type:"text",label:"Ano / modelo"},
                        {id:"color",type:"text",label:"Cor"},
                        {id:"mileage",type:"number",label:"Quilometragem",required:true},
                        {id:"work_order",type:"text",label:"Número da OS"},
                        {id:"notes",type:"textarea",label:"Observações do veículo"}
                    ]
                });
            }

            if (
                this.schema &&
                !this.schemaEngine.get(
                    this.schema.id
                )
            ) {
                this.schemaEngine.register(
                    this.schema
                );
            }

            if (
                !this.schemaEngine.get("asset")
            ) {
                this.schemaEngine.register({
                    id: "asset",
                    title: "Ativo",
                    description:
                        "Identifique o item que será atendido.",
                    fields: [
                        {
                            id: "identification",
                            type: "text",
                            label: "Identificação",
                            required: true
                        },
                        {
                            id: "type",
                            type: "text",
                            label: "Tipo"
                        },
                        {
                            id: "manufacturer",
                            type: "text",
                            label: "Fabricante"
                        },
                        {
                            id: "model",
                            type: "text",
                            label: "Modelo"
                        },
                        {
                            id: "notes",
                            type: "textarea",
                            label: "Observações"
                        }
                    ]
                });
            }

            this.initialValues =
                context.asset || {};
        }

        async render() {
            return [
                `<section class="aurora-module aurora-module--asset" data-module="asset">`,
                `<div data-form-host="asset"></div>`,
                `</section>`
            ].join("");
        }

        async bindEvents(container) {
            const host =
                container.querySelector(
                    '[data-form-host="asset"]'
                );

            this.form =
                this.formRenderer.mount(
                    host,
                    this.schemaEngine.get(
                        "asset"
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
                asset:
                    this.formRenderer.read(
                        this.form
                    )
            };
        }

        async onUnmount() {
            this.form = null;
        }
    }

    global.AssetModuleController =
        AssetModuleController;

})(window);

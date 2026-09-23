(function (global) {
"use strict";

class ApprovalModuleController extends global.BaseFormModule {
    constructor(options = {}) {
        const schema = {
            id: "approval",
            title: "Finalização",
            description: "Conclua o atendimento e defina como o relatório será apresentado.",
            fields: [
                {
                    id:"report_title",
                    type:"text",
                    label:"Título do relatório",
                    placeholder:"Digite ou selecione um título para o relatório",
                    help:"Aparecerá em destaque no documento.",
                    required:true
                },
                {
                    id:"report_title_size",
                    type:"select",
                    label:"Tamanho do título",
                    options:["Pequeno","Normal","Grande"],
                    required:true
                },
                {
                    id:"show_severity",
                    type:"select",
                    label:"Exibir gravidade dos registros no relatório?",
                    options:["Sim","Não"],
                    required:true
                },
                {
                    id:"show_record_labels",
                    type:"select",
                    label:"Exibir Registro 1, Registro 2... no relatório?",
                    options:["Sim","Não"],
                    required:true
                },
                {
                    id:"status",
                    type:"select",
                    label:"Status",
                    required:true,
                    options:["Concluído","Em execução","Revisão","Rascunho"]
                },
                {id:"notes",type:"textarea",label:"Observação final"}
            ]
        };

        super({
            id:"approval",
            schemaEngine:options.schemaEngine,
            formRenderer:options.formRenderer,
            schema
        });
    }
}

global.ApprovalModuleController = ApprovalModuleController;
})(window);

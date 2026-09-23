(function (global) {
"use strict";

class IntakeModuleController extends global.BaseFormModule {
    constructor(options = {}) {
        const schema = {
            id: "intake",
            title: "Entrada do atendimento",
            description: "Registre as condições iniciais do serviço.",
            fields: [
                {id:"reason",type:"textarea",label:"Motivo da entrada",required:true},
                {id:"initial_condition",type:"textarea",label:"Condição inicial"},
                {id:"customer_request",type:"textarea",label:"Solicitação do cliente"},
                {id:"responsible",type:"text",label:"Responsável"},
                {id:"entry_date",type:"date",label:"Data de entrada"},
                {id:"priority",type:"select",label:"Prioridade",options:["Baixa","Normal","Alta","Urgente"]},
                {id:"confirmed",type:"checkbox",label:"Entrada conferida"}
            ]
        };

        super({
            id: "intake",
            schemaEngine: options.schemaEngine,
            formRenderer: options.formRenderer,
            schema
        });
    }
}

global.IntakeModuleController = IntakeModuleController;
})(window);
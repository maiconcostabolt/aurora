(function (global) {
"use strict";
const customerServices=Object.freeze({
workshop:Object.freeze(["vehicle_inspection","suspension","engine","brakes","vehicle_electrical","air_conditioning"]),
electrical:Object.freeze(["panel","thermography","installation","electric_motor","grounding"]),
industrial:Object.freeze(["machine","pipeline","structure","tank"]),
drone:Object.freeze(["roof","facade","tower","solar"]),
car_wash:Object.freeze(["basic_wash","complete_wash","technical_wash","interior_detailing","polishing","paint_protection"]),
upholstery_cleaning:Object.freeze(["sofa_cleaning","mattress_cleaning","armchair_cleaning","chair_cleaning","auto_upholstery","carpet_cleaning"]),
curtains_blinds:Object.freeze(["curtain_installation","blind_installation","curtain_maintenance","blind_maintenance","motorized_system","track_and_rod"]),
repairs_maintenance:Object.freeze(["small_repairs","masonry","painting","flooring","minor_renovation","general_maintenance"]),
condominiums:Object.freeze(["common_areas","electrical_system","hydraulic_system","pump_room","elevators","fire_safety","facade_roof","garage","access_gates","leisure_area","maintenance_occurrences"])
});
function customerSpec(profile,service){
 const sofa=profile==="upholstery_cleaning"&&service==="sofa_cleaning";
 const fields=sofa?["name","address","phone","email","person_type"]:["name","phone","email","person_type"];
 const checklist=sofa?["Nome ou razão social","Endereço do cliente","Telefone","E-mail","Tipo de cliente"]:["Nome ou razão social","Telefone","E-mail","Tipo de cliente"];
 return Object.freeze({controller:"CustomerModuleController",endpoint:"aurora_ai_customer",fields:Object.freeze(fields),selectFields:Object.freeze(["person_type"]),hint:"Fale os dados que souber.",listeningStatus:"Ouvindo… fale os dados do cliente.",ariaLabel:"Preencher dados do cliente por voz",ui:"customer",checklist:Object.freeze(checklist)});
}
const registry={};
Object.keys(customerServices).forEach(profile=>{
 registry[profile]={};
 customerServices[profile].forEach(service=>{registry[profile][service]={customer:customerSpec(profile,service)};});
});
/* Condomínios nasce no molde global e usa o extrator dinâmico seguro. */
Object.keys(registry.condominiums||{}).forEach(function(service){
 registry.condominiums[service].customer=Object.freeze({controller:"CustomerModuleController",endpoint:"aurora_ai_asset",fields:Object.freeze(["name","phone","email","person_type"]),selectFields:Object.freeze(["person_type"]),hint:"Fale os dados que souber.",listeningStatus:"Ouvindo… fale os dados do condomínio ou responsável.",ariaLabel:"Preencher dados do condomínio por voz",ui:"customer",checklist:Object.freeze(["Nome ou razão social","Telefone","E-mail","Tipo de cliente"]),dynamicFields:Object.freeze([{id:"name",label:"Nome ou razão social",type:"text",options:[]},{id:"phone",label:"Telefone",type:"text",options:[]},{id:"email",label:"E-mail",type:"text",options:[]},{id:"person_type",label:"Tipo de cliente",type:"select",options:["Pessoa Física","Empresa","Condomínio"]}]),screenTitle:"Cliente"});
});
/* Vistoria veicular é licença independente. Reutiliza o motor genérico seguro
 * para Customer, enviando o contexto comercial vehicle_inspection/vehicle_inspection. */
registry.workshop.vehicle_inspection.customer=Object.freeze({controller:"CustomerModuleController",endpoint:"aurora_ai_asset",fields:Object.freeze(["name","phone","email","person_type"]),selectFields:Object.freeze(["person_type"]),hint:"Fale os dados que souber.",listeningStatus:"Ouvindo… fale os dados do cliente.",ariaLabel:"Preencher dados do cliente por voz",ui:"customer",checklist:Object.freeze(["Nome ou razão social","Telefone","E-mail","Tipo de cliente"]),dynamicFields:Object.freeze([{id:"name",label:"Nome ou razão social",type:"text",options:[]},{id:"phone",label:"Telefone",type:"text",options:[]},{id:"email",label:"E-mail",type:"text",options:[]},{id:"person_type",label:"Tipo de cliente",type:"select",options:["Pessoa Física","Empresa","Condomínio"]}]),screenTitle:"Cliente"});
const panel=registry.electrical.panel;
panel.asset=Object.freeze({controller:"AssetModuleController",endpoint:"aurora_ai_asset",fields:Object.freeze(["identification","asset_type","tag","location","voltage","manufacturer","model","notes"]),selectFields:Object.freeze([]),hint:"Fale os dados que souber sobre o ativo.",listeningStatus:"Ouvindo… fale os dados do painel ou instalação.",ariaLabel:"Preencher dados do ativo por voz",ui:"asset",checklist:Object.freeze(["Equipamento","Categoria","TAG / identificação técnica","Localização","Tensão nominal","Fabricante","Modelo","Observações técnicas"])});
panel.intake=Object.freeze({controller:"IntakeModuleController",endpoint:"aurora_ai_asset",fields:Object.freeze(["reason","service_condition","responsible","initial_condition"]),selectFields:Object.freeze(["service_condition"]),hint:"Fale os dados da entrada que souber.",listeningStatus:"Ouvindo… fale os dados da entrada.",ariaLabel:"Preencher dados da entrada por voz",ui:"asset",checklist:Object.freeze(["Objetivo da inspeção","Condição do ativo","Responsável pelo acompanhamento","Condição inicial observada"])});
panel.occurrence=Object.freeze({controller:"OccurrenceModuleController",endpoint:"aurora_ai_asset",fields:Object.freeze(["title","component","anomaly_type","severity","description","immediate_action","recommendation"]),selectFields:Object.freeze(["anomaly_type","severity"]),hint:"Fale os dados da ocorrência que souber.",listeningStatus:"Ouvindo… fale os dados da ocorrência.",ariaLabel:"Preencher ocorrência por voz",ui:"asset",checklist:Object.freeze(["Título","Componente/ponto","Tipo de anomalia","Gravidade","Descrição técnica","Ação imediata","Recomendação"])});
panel.diagnostic=Object.freeze({controller:"DiagnosticModuleController",endpoint:"aurora_ai_asset",fields:Object.freeze(["summary","recommendation","report_title","notes"]),selectFields:Object.freeze([]),hint:"Fale os dados do diagnóstico que souber.",listeningStatus:"Ouvindo… fale os dados do diagnóstico.",ariaLabel:"Preencher diagnóstico por voz",ui:"asset",checklist:Object.freeze(["Resumo técnico","Recomendação geral","Título do relatório","Observações"])});
panel.approval=Object.freeze({controller:"ApprovalModuleController",endpoint:"aurora_ai_asset",fields:Object.freeze(["report_title","notes"]),selectFields:Object.freeze([]),hint:"Fale os dados da finalização que souber.",listeningStatus:"Ouvindo… fale os dados da finalização.",ariaLabel:"Preencher finalização por voz",ui:"asset",checklist:Object.freeze(["Título do relatório","Observações"])});
Object.keys(registry).forEach(profile=>{Object.keys(registry[profile]).forEach(service=>Object.freeze(registry[profile][service]));Object.freeze(registry[profile]);});
global.AuroraAiRegistry=Object.freeze(registry);
global.AuroraAiCustomerServices=customerServices;
})(window);

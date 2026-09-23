(function(global){
'use strict';
const OPERATION_LABELS={
 inspection:'Inspeção técnica',technical_visit:'Visita técnica',budget:'Orçamento técnico',survey:'Levantamento em campo',audit:'Auditoria',checklist:'Checklist operacional',delivery:'Entrega / recebimento',maintenance:'Manutenção',inventory:'Inventário'
};
function slug(value){return String(value||'campo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'campo';}
function currentCase(){const rt=global.auroraRuntime;return rt&&rt.caseData?rt.caseData:null;}
function enrichCase(){
 const c=currentCase(); if(!c) return;
 c.operation_type=c.operation_type||(c.service&&c.service.operation_type)||'inspection';
 c.flow_template=c.flow_template||(c.service&&c.service.flow_template)||'technical';
 c.operation_type_label=OPERATION_LABELS[c.operation_type]||'Operação técnica';
 c.record_section_title=c.record_section_title||(c.service&&c.service.record_section_title)||'Registros técnicos';
 c.custom_values=c.custom_values||{};
}

/* Shapes personalizadas não herdam o formulário do módulo de origem. */
if(global.AssetModuleController){
 const proto=global.AssetModuleController.prototype;
 const originalLoad=proto.onLoad;
 const originalBind=proto.bindEvents;
 const originalSave=proto.onSave;
 proto.onLoad=async function(context){
   const service=context&&context.service||{};
   if(!service.custom){this.__auroraCustom=false;return originalLoad.call(this,context);}
   this.__auroraCustom=true;
   const fields=Array.isArray(service.custom_fields)?service.custom_fields:[];
   const schemaId='custom_service_'+slug(service.id||service.title);
   const schema={id:schemaId,title:service.title||'Dados do serviço',description:service.description||'Preencha os dados específicos deste serviço.',fields:(fields.length?fields:['Observações do serviço']).map((label,index)=>({id:slug(label)+'_'+index,type:index===fields.length-1&&/observ|descr|condi|detalh/i.test(label)?'textarea':'text',label,required:false}))};
   if(!this.schemaEngine.get(schemaId)) this.schemaEngine.register(schema);
   this.__auroraSchemaId=schemaId;
   this.__auroraCustomSchema=schema;
   const stored=context.custom_values||{};
   this.initialValues={};
   schema.fields.forEach((field)=>{
     this.initialValues[field.id]=stored[field.label] ?? stored[field.id] ?? '';
   });
 };
 proto.bindEvents=async function(container){
   if(!this.__auroraCustom) return originalBind.call(this,container);
   const host=container.querySelector('[data-form-host="asset"]');
   this.form=this.formRenderer.mount(host,this.schemaEngine.get(this.__auroraSchemaId),this.initialValues||{});
 };
 proto.onSave=async function(){
   if(!this.__auroraCustom) return originalSave.call(this);
   const raw=this.formRenderer.read(this.form);
   const values={};
   (this.__auroraCustomSchema&&this.__auroraCustomSchema.fields||[]).forEach((field)=>{values[field.label]=raw[field.id]??'';});
   return {custom_values:values};
 };
}

function addServiceSummary(){
 const c=currentCase(); if(!c||!(c.service&&c.service.custom)) return;
 const module=document.querySelector('.aurora-module--customer');
 if(!module||module.querySelector('[data-custom-service-summary]')) return;
 const card=document.createElement('section');
 card.className='aurora-custom-service-summary';
 card.dataset.customServiceSummary='true';
 const fields=(c.service.custom_fields||[]).map(x=>'<li>'+String(x).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</li>').join('');
 card.innerHTML='<span>Modelo do atendimento</span><h2>'+String(c.service.title||'Serviço')+'</h2><p>'+String(c.service.description||'')+'</p><dl><div><dt>Tipo de operação</dt><dd>'+ (OPERATION_LABELS[c.operation_type]||'Operação técnica') +'</dd></div><div><dt>Fluxo</dt><dd>'+String(c.flow_template||'technical')+'</dd></div><div><dt>Título no relatório</dt><dd>'+String(c.record_section_title||'Registros técnicos')+'</dd></div></dl>'+(fields?'<strong>Campos do serviço</strong><ul>'+fields+'</ul>':'');
 module.prepend(card);
}

document.addEventListener('DOMContentLoaded',()=>{enrichCase();setTimeout(addServiceSummary,300);});
document.addEventListener('aurora:case-changed',()=>{enrichCase();setTimeout(addServiceSummary,100);});
let commercialFrame=0;
new MutationObserver((mutations)=>{
 if(!mutations.some(m=>m.addedNodes&&m.addedNodes.length)) return;
 if(commercialFrame) return;
 commercialFrame=requestAnimationFrame(()=>{
   commercialFrame=0;
   enrichCase();
   addServiceSummary();
 });
}).observe(document.documentElement,{childList:true,subtree:true});
})(window);

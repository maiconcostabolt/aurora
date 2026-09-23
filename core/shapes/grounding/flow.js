(function(global){
'use strict';
const BUILD='AURORA V47 RECONCILIATION RC1 R07';
function trace35(label,data){try{const api=global.AuroraTraceV35||global.AuroraBoltTraceV140;api&&api.mark&&api.mark('V35 '+label,data||{});}catch(_){}}
const KEY='aurora_grounding_draft_v2';
const CUSTOM_KEY='aurora_grounding_custom_suggestions_v2';
const NATIVE={
 system:['BEP / equipotencialização','Malha de aterramento','Haste individual','Aterramento de equipamento','Aterramento estrutural','Sistema combinado'],
 building:['Edificação industrial','Estrutura metálica industrial','Edificação comercial','Edificação residencial','Área externa / pátio','Subestação / casa de força'],
 soil:['Solo argiloso compactado','Solo arenoso','Solo rochoso','Solo compactado','Solo com umidade localizada','Solo seco','Aterro / solo modificado'],
 rod:['Haste cobreada 5/8” × 2,40 m','Haste cobreada 5/8” × 3,00 m','Eletrodo vertical','Eletrodo horizontal','Malha de aterramento'],
 conductor:['Cabo de cobre nu','Cabo de cobre isolado','Fita de cobre','Barramento de cobre','Barramento de alumínio','Condutor de equipotencialização'],
 connection:['Solda exotérmica','Conector mecânico aparafusado','Terminal prensado','Barramento BEP','Conexão soldada'],
 inspection:['Inspeção visual','Medição de resistência','Verificação de continuidade','Medição e inspeção combinadas'],
 standards:['NBR-5410:2004 — Instalações elétricas em baixa tensão','NBR-5419:2015 — Proteção de estruturas contra descargas atmosféricas','NBR-15749:2009 — Medição de resistência e de potenciais na superfície do solo em sistemas de aterramento','NR 10:2004 — Segurança em instalações e segurança em eletricidade'],
 category:['Caixa de inspeção','Barramento BEP','Painel elétrico','Estrutura metálica','Coluna','Guarda-corpo','Haste de aterramento','Malha de aterramento','Equipamento / máquina'],
 description:['Caixa de inspeção do aterramento','Barramento principal de equipotencialização (BEP)','Conexão de aterramento do painel elétrico','Estrutura metálica equipotencializada','Haste de aterramento no ponto de inspeção','Condutor de proteção do equipamento','Malha de aterramento da instalação','Carcaça da máquina / equipamento'],
 condition:['Adequada','Com oxidação','Conexão frouxa','Condutor danificado','Sem identificação','Acesso obstruído','Necessita manutenção','Não avaliado'],
 opinion:['Conforme','Não conforme','Requer correção','Requer acompanhamento','Requer nova medição','Requer avaliação'],
 observation:['Conexão em boas condições aparentes','Ponto acessível e identificado','Presença de oxidação na conexão','Fixação do condutor requer correção','Condutor apresenta dano aparente','Ponto sem identificação','Acesso ao ponto parcialmente obstruído','Recomenda-se nova aferição após a correção'],
 recommendations:['Revisar a integridade das conexões acessíveis','Executar correção nos pontos com sinais de deterioração','Realizar nova aferição após a intervenção','Manter os pontos identificados e acessíveis para inspeções futuras'],
 conclusion:['Pontos inspecionados e registrados conforme o escopo da vistoria','Resultados sujeitos à validação do responsável técnico','Recomendações registradas para acompanhamento técnico'],
 generalities:['Sistema de aterramento inspecionado visualmente e por aferição nos pontos acessíveis.','Conexões, condutores e elementos de equipotencialização verificados conforme o escopo da vistoria.','Pontos de aterramento identificados e registrados individualmente para rastreabilidade.','Condições encontradas registradas por medições e evidências fotográficas.','Inspeção limitada aos pontos acessíveis e às condições existentes no momento da vistoria.']
};
const MULTI=new Set(['system','building','soil','rod','conductor','connection','inspection','standards','category','description','condition','opinion','observation','recommendations','conclusion','generalities']);
const OFFICIAL_CATEGORIES={system:'grounding_system',building:'grounding_building',soil:'grounding_soil',rod:'grounding_rod',conductor:'grounding_conductor',connection:'grounding_connection',inspection:'grounding_inspection',standards:'grounding_standards',category:'grounding_point_category',description:'grounding_point_description',condition:'grounding_condition',opinion:'grounding_opinion',observation:'grounding_point_observation',recommendations:'grounding_recommendations',conclusion:'grounding_conclusion',generalities:'grounding_generalities'};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function uid(){return 'GND-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)}
function runtime(){return global.auroraRuntime||global.AuroraRuntime||null}
function identity(){try{return JSON.parse(localStorage.getItem('aurora_company_identity_rc1_5')||'{}')}catch(_){return {}}}
function customs(){try{return JSON.parse(localStorage.getItem(CUSTOM_KEY)||'{}')}catch(_){return {}}}
function saveCustom(type,v){v=String(v||'').trim();if(!v)return;const c=customs();c[type]=Array.from(new Set([...(c[type]||[]),v]));localStorage.setItem(CUSTOM_KEY,JSON.stringify(c));}
function deleteCustom(type,v){const c=customs();c[type]=(c[type]||[]).filter(x=>x!==v);localStorage.setItem(CUSTOM_KEY,JSON.stringify(c));}
function blank(){const p=identity();return {id:uid(),profile_id:'grounding_equipotentialization',module_id:'grounding_equipotentialization',status:'Em andamento',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),service:{id:'grounding_equipotentialization',title:'Aterramento e Equipotencialização',profile:'grounding_equipotentialization',operation_type:'inspection',flow_template:'grounding_points',record_section_title:'Pontos de aferição'},customer:{name:'',document:'',phone:'',email:'',address:''},grounding:{report_points_layout:'cards',identification:{unit:'',sector:'',title:'Relatório técnico de aterramento e equipotencialização',report_number:'',art:'',date:new Date().toISOString().slice(0,10),technical_responsible:p.professional||'',professional_registration:'',location:''},method:{building_type:'',soil_type:'',system_type:'',system_description:'',rod_type:'',conductor:'',connection_type:'',inspection_type:'',instrument_make:'',instrument_model:'',instrument_serial:'',calibration:'',methodology:'',objective:'',generalities:'',applicable_standards:'',building_length:'',building_width:'',building_perimeter:'',exposure_area:'',protection_level_notes:''},reference_value:'',points:[],recommendations:'',conclusion:''},approval:{report_title:'Relatório técnico de aterramento e equipotencialização'},occurrences:[]};}
let state=null,root=null,editing=-1,openingEvidencePointId=null,editReportMeta=null;
function getPath(path){return path.split('.').reduce((o,k)=>o&&o[k],state)??''}
function setPath(path,val){const a=path.split('.');let o=state;for(let i=0;i<a.length-1;i++)o=o[a[i]]||(o[a[i]]={});o[a[a.length-1]]=val;if(path==='grounding.method.building_length'||path==='grounding.method.building_width'){const l=parseFloat(state.grounding.method.building_length),w=parseFloat(state.grounding.method.building_width);state.grounding.method.building_perimeter=(Number.isFinite(l)&&Number.isFinite(w))?String((2*(l+w)).toFixed(2)).replace(/\.00$/,''):'';}persist();}
function toOccurrences(){return (state.grounding.points||[]).map((p,i)=>({id:p.id,title:`Ponto ${String(i+1).padStart(2,'0')} — ${p.description||p.category||'Aferição'}`,component:p.category||'',description:[p.description,p.value?`Valor medido: ${p.value} Ω`:'',p.reference?`Referência: ${p.reference} Ω`:'',p.condition?`Condição: ${p.condition}`:'',p.opinion?`Parecer: ${p.opinion}`:'',p.observation].filter(Boolean).join(' · '),severity:'Sem gravidade',recommendation:p.observation||'',photos:(p.photos||[]).map((src,j)=>({id:(p.photo_ids&&p.photo_ids[j])||`${p.id}-ph-${j}`,data_url:src,src,title:`Ponto ${String(i+1).padStart(2,'0')}`,description:(p.photo_descriptions&&p.photo_descriptions[j])||''}))}));}
function compactForStorage(value){const copy=JSON.parse(JSON.stringify(value||{}));if(copy.grounding&&Array.isArray(copy.grounding.points))copy.grounding.points.forEach(p=>{p.photos=[];});if(copy.coverPhoto&&copy.coverPhoto.src)copy.coverPhoto={...copy.coverPhoto,src:null};return copy;}function persist(){if(!state)return;state.updated_at=new Date().toISOString();state.occurrences=toOccurrences();state.approval={...(state.approval||{}),report_points_layout:state.grounding&&state.grounding.report_points_layout==='table_b2'?'table_b2':'cards'};try{localStorage.setItem(KEY,JSON.stringify(compactForStorage(state)))}catch(e){console.warn('[GROUNDING DRAFT]',e)}try{const rt=runtime();if(rt&&rt.caseBinder&&typeof rt.caseBinder.merge==='function'){const patch={grounding:state.grounding,customer:state.customer,evidence_groups:state.evidence_groups||[],occurrences:state.occurrences,approval:state.approval,status:state.status,updated_at:state.updated_at};if(state.coverPhoto)patch.coverPhoto={...state.coverPhoto};rt.caseBinder.merge(patch,{source:'grounding_shape'});}}catch(_){} }
const REQUIRED_PATHS=new Set(['grounding.identification.unit','grounding.identification.sector','grounding.identification.title','grounding.identification.date','grounding.identification.technical_responsible','grounding.identification.professional_registration','grounding.method.system_type','grounding.method.inspection_type','grounding.method.objective','grounding.method.methodology','grounding.conclusion']);
const REQUIRED_LABELS={'grounding.identification.unit':'Unidade','grounding.identification.sector':'Setor / instalação','grounding.identification.title':'Título do laudo','grounding.identification.date':'Data da vistoria','grounding.identification.technical_responsible':'Responsável técnico','grounding.identification.professional_registration':'Registro profissional','grounding.method.system_type':'Configuração do sistema','grounding.method.inspection_type':'Tipo de inspeção','grounding.method.objective':'Objetivo do laudo','grounding.method.methodology':'Metodologia','grounding.conclusion':'Conclusão'};
function requiredMark(path){return REQUIRED_PATHS.has(path)?'<b class="ag-required" aria-label="obrigatório"> *</b>':''}
function requiredAttr(path){return REQUIRED_PATHS.has(path)?' required aria-required="true"':''}
function field(label,path,type='text',wide=false){return `<label class="field aurora-field${wide?' wide':''}"><span>${label}${requiredMark(path)}</span><input class="control" type="${type}" data-ag-field="${path}" value="${esc(getPath(path))}" ${type==='number'?'step="0.01"':''}${requiredAttr(path)}></label>`}
function area(label,path,wide=true){return `<label class="field aurora-field${wide?' wide':''}"><span>${label}${requiredMark(path)}</span><textarea class="control area" data-ag-field="${path}"${requiredAttr(path)}>${esc(getPath(path))}</textarea></label>`}
function pickerArea(label,path,type,wide=true){return `<label class="field aurora-field${wide?' wide':''}"><span>${label}${requiredMark(path)}</span><div class="aurora-field--picker"><textarea class="control area has-suggestion-picker" data-ag-field="${path}"${requiredAttr(path)}>${esc(getPath(path))}</textarea><button type="button" class="aurora-suggestion-toggle" data-ag-picker="${type}" data-ag-target="${path}" aria-label="Abrir sugestões"><i class="aurora-chevron"></i></button></div></label>`}
function picker(label,path,type,wide=false){return `<label class="field aurora-field${wide?' wide':''}"><span>${label}${requiredMark(path)}</span><div class="aurora-field--picker"><input class="control has-suggestion-picker" data-ag-field="${path}" value="${esc(getPath(path))}" autocomplete="off"${requiredAttr(path)}><button type="button" class="aurora-suggestion-toggle" data-ag-picker="${type}" data-ag-target="${path}" aria-label="Abrir sugestões"><i class="aurora-chevron"></i></button></div></label>`}
function progress(section){return `<div class="avi-progress" aria-label="Etapa técnica ${section} de 4">${[1,2,3,4].map(i=>`<i class="${i<=section?'is-on':''}"></i>`).join('')}</div>`}
function shell(body,section){return `<main class="avi-screen"><section class="avi-hero"><span>Novo atendimento</span><h1>Aterramento e equipotencialização</h1><p>${section===1?'Identificação da vistoria':section===2?'Sistema, metodologia e instrumento':section===3?'Pontos de aferição, medições e evidências fotográficas':'Finalização técnica do laudo'}</p></section>${progress(section)}${body}</main>`}
function step1(){return `<section class="aurora-form"><div class="section-head"><small>DADOS INICIAIS</small><h2>Identificação da vistoria</h2><p>Identifique a instalação e os dados técnicos do laudo.</p></div><div class="fields">${field('Unidade','grounding.identification.unit')}${field('Setor / instalação','grounding.identification.sector')}${field('Título do laudo','grounding.identification.title','text',true)}${field('Número do laudo','grounding.identification.report_number')}${field('Número da ART','grounding.identification.art')}${field('Data da vistoria','grounding.identification.date','date')}${field('Responsável técnico','grounding.identification.technical_responsible')}${field('Registro profissional','grounding.identification.professional_registration')}</div></section>`}
function step2(){return `<section class="aurora-form"><div class="section-head"><small>DADOS TÉCNICOS</small><h2>Sistema, metodologia e instrumento</h2><p>Use a seta para abrir as sugestões Aurora. É possível selecionar várias opções e criar sugestões próprias.</p></div><div class="fields">${picker('Configuração do sistema','grounding.method.system_type','system')}${picker('Tipo de edificação','grounding.method.building_type','building')}${picker('Tipo de solo','grounding.method.soil_type','soil')}${picker('Haste / eletrodo','grounding.method.rod_type','rod')}${picker('Condutor / malha','grounding.method.conductor','conductor')}${picker('Tipo de conexão','grounding.method.connection_type','connection')}${picker('Tipo de inspeção','grounding.method.inspection_type','inspection')}${field('Valor de referência (Ω)','grounding.reference_value','number')}${field('Comprimento (m)','grounding.method.building_length','number')}${field('Largura (m)','grounding.method.building_width','number')}<label class="field"><span>Perímetro (m)</span><input class="control" type="number" data-ag-field="grounding.method.building_perimeter" value="${esc(getPath('grounding.method.building_perimeter'))}" readonly></label>${field('Área de exposição (m²)','grounding.method.exposure_area','number')}${field('Fabricante do instrumento','grounding.method.instrument_make')}${field('Modelo','grounding.method.instrument_model')}${field('Nº de série','grounding.method.instrument_serial')}${field('Calibração / certificado','grounding.method.calibration')}${area('Objetivo do laudo','grounding.method.objective')}${picker('Normas aplicáveis','grounding.method.applicable_standards','standards',true)}${pickerArea('Generalidades / descrição técnica','grounding.method.generalities','generalities',true)}${area('Metodologia','grounding.method.methodology')}${area('Nível de proteção / gerenciamento de risco','grounding.method.protection_level_notes')}</div></section>`}
function pointForm(p,i){return `<article class="aurora-evidence-group is-open" data-point-editor="${i}"><header class="aurora-evidence-group__header"><div><span>EVIDÊNCIA ${i+1}</span><h3>Ponto ${String(i+1).padStart(2,'0')} — Aferição</h3></div></header><div class="aurora-evidence-group__form">${pointPicker('Categoria / item inspecionado','category',p.category,'category')}${pointPicker('Descrição técnica / localização','description',p.description,'description')}${pointInput('Valor medido (Ω)','value',p.value,'number')}${pointInput('Referência (Ω)','reference',p.reference||state.grounding.reference_value,'number')}${pointPicker('Condição','condition',p.condition,'condition')}${pointPicker('Parecer técnico','opinion',p.opinion,'opinion')}${pointAreaPicker('Observação','observation',p.observation,'observation')}</div><button type="button" class="aurora-evidence-add-photo" data-ag-point-evidence="${i}">📷 Adicionar foto</button><div class="aurora-evidence-photo-empty">${Number(p.photo_count||0)?`${Number(p.photo_count||0)} foto(s) vinculada(s)`:'Nenhuma foto adicionada nesta evidência.'}</div><div data-ag-linked-photos="${esc(p.id)}"></div><footer class="aurora-evidence-group__footer"><button type="button" class="is-secondary" data-ag-point-close="${i}">Fechar</button><button type="button" class="is-primary" data-ag-point-finish="${i}">Finalizar ocorrência</button></footer></article>`}
function pointInput(label,key,val,type='text'){return `<label class="field aurora-field"><span>${label}</span><input type="${type}" data-point-key="${key}" value="${esc(val||'')}" ${type==='number'?'step="0.01"':''}></label>`}
function pointArea(label,key,val){return `<label class="field aurora-field wide"><span>${label}</span><textarea class="control area" data-point-key="${key}">${esc(val||'')}</textarea></label>`}
function pointAreaPicker(label,key,val,type){return `<label class="field aurora-field wide"><span>${label}</span><div class="aurora-field--picker"><textarea class="control area" data-point-key="${key}">${esc(val||'')}</textarea><button type="button" class="aurora-suggestion-toggle" data-ag-picker="${type}" data-ag-point-target="${key}" aria-label="Abrir sugestões"><i class="aurora-chevron"></i></button></div></label>`}
function pointPicker(label,key,val,type){return `<label class="field aurora-field"><span>${label}</span><div class="aurora-field--picker"><input class="control" data-point-key="${key}" value="${esc(val||'')}"><button type="button" class="aurora-suggestion-toggle" data-ag-picker="${type}" data-ag-point-target="${key}" aria-label="Abrir sugestões"><i class="aurora-chevron"></i></button></div></label>`}
function step3(){const pts=state.grounding.points||[];const summaries=pts.map((p,i)=>i===editing?'':`<article class="aurora-evidence-summary"><button type="button" class="aurora-evidence-summary__main" data-ag-point-edit="${i}"><span class="aurora-evidence-summary__number">${i+1}</span><span class="aurora-evidence-summary__content"><strong>${esc(p.description||p.category||'Ponto de aferição')}</strong><small>${[p.value?`${esc(p.value)} Ω`:'',esc(p.condition||''),esc(p.opinion||''),`${Number(p.photo_count||0)} foto(s)`].filter(Boolean).join(' · ')}</small></span><span class="aurora-evidence-summary__arrow">›</span></button><button type="button" class="aurora-evidence-summary__delete" data-ag-point-delete="${i}">×</button></article>`).join('');const editor=editing>=0&&pts[editing]?pointForm(pts[editing],editing):'';return `<section class="aurora-evidence-hub"><div class="aurora-evidence-group-list">${summaries}${editor}</div><button type="button" class="aurora-add-evidence-group" data-ag-new-point>＋ Nova ocorrência</button></section>`}
function step4(){const pts=state.grounding.points||[];const photos=pts.reduce((n,p)=>n+Number(p.photo_count||0),0);const hasCover=!!(state.coverPhoto&&state.coverPhoto.has_photo);const layout=(state.grounding.report_points_layout==='table_b2'?'table_b2':'cards');return `<section class="aurora-form"><div class="section-head"><small>FINALIZAÇÃO</small><h2>Conclusão do laudo</h2><p>Revise o conteúdo. A conclusão definitiva permanece sob validação do responsável técnico.</p></div>${picker('Recomendações','grounding.recommendations','recommendations',true)}${picker('Conclusão','grounding.conclusion','conclusion',true)}<div class="avi-card ag-report-layout-card"><div class="section-head"><small>APRESENTAÇÃO DOS PONTOS NO RELATÓRIO</small><h3>Escolha o formato</h3><p>A escolha fica salva neste atendimento e altera somente a apresentação dos mesmos dados no relatório.</p></div><div class="ag-report-layout-options"><button type="button" class="ag-report-layout-option ${layout==='cards'?'is-selected':''}" data-ag-report-layout="cards"><strong>Cards detalhados</strong><span>Modelo A · leitura individual de cada ponto</span></button><button type="button" class="ag-report-layout-option ${layout==='table_b2'?'is-selected':''}" data-ag-report-layout="table_b2"><strong>Tabela técnica</strong><span>Modelo B2 · compacto para muitos pontos</span></button></div></div><div class="avi-card ag-cover-card"><div class="section-head"><small>FOTO DE CAPA DO RELATÓRIO</small><h3>Imagem geral do equipamento ou instalação</h3><p>Opcional. Esta imagem será utilizada exclusivamente na capa do relatório.</p></div><div data-ag-cover-photo></div>${hasCover?'<div class="ag-cover-saved"><span aria-hidden="true">✓</span><div><strong>Foto de capa salva</strong><small>Esta imagem já será utilizada na capa do relatório.</small></div></div>':''}<button type="button" class="aurora-add-evidence-group ag-cover-action" data-ag-cover-add>${hasCover?'Substituir foto de capa':'+ Adicionar foto de capa'}</button></div><div class="final-count"><strong>${pts.length}</strong><span>pontos de aferição registrados · ${photos} fotos vinculadas</span></div></section>`}
function render(){if(!root)return;const section=Number(root.dataset.groundingSection||1);root.innerHTML=shell(section===1?step1():section===2?step2():section===3?step3():step4(),section);bind();}
/* V47 R04 — o DOM visível é a fonte imediata durante a edição. Antes de validar
 * ou navegar, copie os controles para o estado canônico da shape. Isso evita que
 * um contexto antigo do Runtime apague o que acabou de ser digitado. */

/* R07 — mesma lei dos controllers maduros (Customer/Asset): validar e salvar
 * diretamente os controles montados. Mantém a tela Grounding existente; não
 * cria FormRenderer, schema, storage ou navegação paralelos. */
const IDENTIFICATION_PATHS=[
 'grounding.identification.unit',
 'grounding.identification.sector',
 'grounding.identification.title',
 'grounding.identification.report_number',
 'grounding.identification.art',
 'grounding.identification.date',
 'grounding.identification.technical_responsible',
 'grounding.identification.professional_registration'
];
const IDENTIFICATION_REQUIRED=new Set([
 'grounding.identification.unit',
 'grounding.identification.sector',
 'grounding.identification.title',
 'grounding.identification.date',
 'grounding.identification.technical_responsible',
 'grounding.identification.professional_registration'
]);
function readMountedFields(host,paths){
 const values={};
 (paths||[]).forEach(path=>{
  const el=host&&host.querySelector(`[data-ag-field="${path}"]`);
  values[path]=el?String(el.value??''):'';
 });
 return values;
}
function applyMountedFields(values){
 Object.entries(values||{}).forEach(([path,value])=>{
  const parts=path.split('.');let obj=state;
  for(let i=0;i<parts.length-1;i++)obj=obj[parts[i]]||(obj[parts[i]]={});
  obj[parts[parts.length-1]]=value;
 });
}
function validateMountedIdentification(host){
 const values=readMountedFields(host,IDENTIFICATION_PATHS);
 const missing=[];
 IDENTIFICATION_REQUIRED.forEach(path=>{
  const el=host&&host.querySelector(`[data-ag-field="${path}"]`);
  const invalid=!String(values[path]||'').trim();
  if(el){if(invalid)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');}
  if(invalid)missing.push(path);
 });
 return {valid:missing.length===0,values,missing};
}
function syncVisibleFields(host){
 const scope=host||root;
 if(!scope||!state)return;
 scope.querySelectorAll('[data-ag-field]').forEach(el=>{
  if(el.readOnly)return;
  const path=el.dataset.agField;
  if(!path)return;
  const parts=path.split('.');let obj=state;
  for(let i=0;i<parts.length-1;i++)obj=obj[parts[i]]||(obj[parts[i]]={});
  obj[parts[parts.length-1]]=el.value;
 });
}
function markRequiredFields(missingPaths,host){
 const scope=host||root;
 if(!scope)return;
 const missing=new Set(missingPaths||[]);
 scope.querySelectorAll('[data-ag-field]').forEach(el=>{
  const invalid=missing.has(el.dataset.agField);
  if(invalid)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');
 });
 const first=scope.querySelector('[data-ag-field][aria-invalid="true"]');
 if(first&&typeof first.scrollIntoView==='function')first.scrollIntoView({block:'center',behavior:'smooth'});
}
function pointMissingKeys(point){
 const p=point||{};
 return ['category','description','value','condition','opinion'].filter(key=>!String(p[key]||'').trim());
}
function markPointRequiredFields(index){
 if(!root)return [];
 const point=state&&state.grounding&&state.grounding.points&&state.grounding.points[index];
 const missing=pointMissingKeys(point);
 const editor=root.querySelector(`[data-point-editor="${index}"]`);
 if(!editor)return missing;
 editor.querySelectorAll('[data-point-key]').forEach(el=>{
  const invalid=missing.includes(el.dataset.pointKey);
  if(invalid)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');
 });
 const first=editor.querySelector('[data-point-key][aria-invalid="true"]');
 if(first&&typeof first.scrollIntoView==='function')first.scrollIntoView({block:'center',behavior:'smooth'});
 return missing;
}
function canClosePoint(index){
 const missing=markPointRequiredFields(index);
 if(!missing.length)return true;
 global.__AURORA_VALIDATION_MESSAGE__='Preencha os campos obrigatórios desta ocorrência antes de fechar.';
 return false;
}
function bind(){root.querySelectorAll('[data-ag-report-layout]').forEach(b=>b.onclick=()=>{state.grounding.report_points_layout=b.dataset.agReportLayout==='table_b2'?'table_b2':'cards';persist();render()});root.querySelectorAll('[data-ag-field]').forEach(el=>el.oninput=()=>{if(el.readOnly)return;el.removeAttribute('aria-invalid');setPath(el.dataset.agField,el.value);if(el.dataset.agField==='grounding.method.building_length'||el.dataset.agField==='grounding.method.building_width')render()});root.querySelectorAll('[data-ag-picker]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();openPicker(b)});root.querySelector('[data-ag-new-point]')?.addEventListener('click',()=>{state.grounding.points.push({id:uid(),category:'',description:'',value:'',reference:state.grounding.reference_value||'',condition:'',opinion:'',observation:'',photos:[],photo_ids:[],photo_descriptions:[],photo_count:0});editing=state.grounding.points.length-1;persist();render()});root.querySelectorAll('[data-ag-point-edit]').forEach(b=>b.onclick=()=>{editing=Number(b.dataset.agPointEdit);render()});root.querySelectorAll('[data-ag-point-delete]').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset.agPointDelete),point=state.grounding.points[i];const ok=global.AuroraDialog&&global.AuroraDialog.confirm?await global.AuroraDialog.confirm('O ponto de aferição será excluído.',{title:'Excluir registro?',confirmLabel:'Excluir',tone:'danger'}):confirm('Excluir este ponto de aferição?');if(ok){const api=global.AuroraEvidenceFeature;if(point&&api&&typeof api.removeLinkedGroups==='function')await api.removeLinkedGroups({entity_type:'grounding_point',entity_id:point.id,link_key:'grounding_point_id'});state.grounding.points.splice(i,1);editing=-1;persist();render()}});root.querySelectorAll('[data-point-key]').forEach(el=>el.oninput=()=>{if(editing<0)return;el.removeAttribute('aria-invalid');state.grounding.points[editing][el.dataset.pointKey]=el.value;persist()});root.querySelectorAll('[data-ag-point-close]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.agPointClose);if(!canClosePoint(i))return;editing=-1;persist();render()});root.querySelectorAll('[data-ag-point-finish]').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset.agPointFinish);if(!canClosePoint(i))return;await syncEvidence();editing=-1;persist();render()});root.querySelectorAll('[data-ag-point-evidence]').forEach(b=>b.onclick=()=>openPointEvidence(Number(b.dataset.agPointEvidence)));const api=global.AuroraEvidenceFeature;if(api&&typeof api.mountLinkedPhotos==='function')root.querySelectorAll('[data-ag-linked-photos]').forEach(host=>api.mountLinkedPhotos(host,{presentation_mode:'photo_only',linked_entity_type:'grounding_point',linked_entity_id:host.dataset.agLinkedPhotos,linked_entity_key:'grounding_point_id',grounding_point_id:host.dataset.agLinkedPhotos}));const coverApi=global.AuroraEvidenceFeature;const coverHost=root.querySelector('[data-ag-cover-photo]');if(coverApi&&coverHost&&typeof coverApi.mountLinkedPhotos==='function')coverApi.mountLinkedPhotos(coverHost,{presentation_mode:'photo_only',linked_entity_type:'report_cover',linked_entity_id:state.id,linked_entity_key:'report_case_id',report_case_id:state.id});const coverAdd=root.querySelector('[data-ag-cover-add]');if(coverAdd)coverAdd.onclick=async()=>{if(!coverApi||typeof coverApi.addLinkedCoverPhoto!=='function'){alert('Motor oficial de fotos da Aurora indisponível.');return;}const result=await coverApi.addLinkedCoverPhoto({title:'Foto de capa do relatório',item:'Imagem geral do equipamento ou instalação',record_kind:'report_cover_photo',presentation_mode:'photo_only',linked_entity_type:'report_cover',linked_entity_id:state.id,linked_entity_key:'report_case_id',report_case_id:state.id});if(result&&result.status==='added'){const ph=result.photo||null;if(ph){const src=ph.edited_src||ph.src||ph.data_url||ph.object_url||ph.url||'';if(src)state.coverPhoto={id:`cover-photo-${state.id}`,src,alt:ph.description||ph.title||'',has_photo:true,created_at:ph.created_at||new Date().toISOString(),source_photo_id:ph.id||null};}await syncCoverPhoto();persist();render();}};} 
global.addEventListener('aurora:linked-photo-changed',event=>{const detail=event&&event.detail||{};if(!root||detail.action==='added'||detail.linked_entity_type!=='grounding_point')return;if(!(state.grounding.points||[]).some(point=>String(point.id)===String(detail.linked_entity_id)))return;syncEvidence().then(render).catch(error=>console.warn('[GROUNDING LINKED PHOTO]',error));});
global.addEventListener('aurora:cover-photo-changed',()=>{if(!root)return;syncCoverPhoto().then(()=>{if(Number(root.dataset.groundingSection||0)===4)render()}).catch(error=>console.warn('[GROUNDING COVER PHOTO]',error));});
async function openPicker(button){const type=button.dataset.agPicker,target=button.dataset.agTarget,pointTarget=button.dataset.agPointTarget,category=OFFICIAL_CATEGORIES[type],api=global.AuroraSuggestionsPicker;if(!api||typeof api.open!=='function'){console.error('[GROUNDING] AuroraSuggestionsPicker indisponível.');return}if(button.getAttribute('aria-expanded')==='true'){api.close();return}const field=button.parentElement&&button.parentElement.querySelector('input,textarea');const legacy=customs()[type]||[];const suggestions=Array.from(new Set([...(NATIVE[type]||[]),...legacy].map(v=>String(v||'').trim()).filter(Boolean)));if(!field||!category||!suggestions.length){console.error('[GROUNDING] Configuração de sugestões inválida.',{type,category,field:!!field,suggestions:suggestions.length});return}try{const result=await api.open({field,category,multiple:MULTI.has(type),suggestions,profileId:'grounding_equipotentialization',serviceId:'grounding_equipotentialization'});if(!result||result.status!=='applied')return;const value=(result.values||[]).map(v=>String(v||'').trim()).filter(Boolean).join(' • ');if(target){setPath(target,value)}else if(editing>=0&&pointTarget){state.grounding.points[editing][pointTarget]=value;persist()}render()}catch(error){console.error('[GROUNDING] Falha ao abrir sugestões.',error)}}
async function openPointEvidence(i){const p=state.grounding.points[i];if(!p||openingEvidencePointId===p.id)return;const api=global.AuroraEvidenceFeature;if(!api||typeof api.addLinkedPhotos!=='function'){alert('Motor de fotos da Aurora indisponível.');return;}openingEvidencePointId=p.id;try{await api.addLinkedPhotos({title:`Ponto ${String(i+1).padStart(2,'0')} — ${p.description||p.category||'Aferição'}`,item:p.category||'Ponto de aferição',description:p.description||'',recommendation:p.observation||'',severity:'Sem gravidade',record_kind:'grounding_point',presentation_mode:'photo_only',linked_entity_type:'grounding_point',linked_entity_id:p.id,linked_entity_key:'grounding_point_id',grounding_point_id:p.id});await syncEvidence();render();}finally{openingEvidencePointId=null;}}
async function syncEvidence(){try{const api=global.AuroraEvidenceFeature;if(api&&typeof api.flush==='function')await api.flush();const groups=api&&typeof api.getGroups==='function'?api.getGroups():[];const linked=[];for(const p of state.grounding.points){const gs=(groups||[]).filter(g=>String(g.grounding_point_id||'')===String(p.id));const photos=[],ids=[],descs=[];for(const g of gs){linked.push({...g,photos:(g.photos||[]).map(ph=>({id:ph.id||'',title:ph.title||'',description:ph.description||ph.caption||'',category:ph.category||'general',created_at:ph.created_at||null}))});for(const ph of (g.photos||[])){const src=ph.edited_src||ph.src||ph.data_url||ph.object_url||ph.url||'';if(src){photos.push(src);ids.push(ph.id||'');descs.push(ph.description||ph.caption||'')}}}p.photos=photos;p.photo_ids=ids;p.photo_descriptions=descs;p.photo_count=photos.length;}/* A foto de capa usa o mesmo Evidence Engine oficial. Preserve também a referência
   do grupo report_cover no snapshot do atendimento; o Report Preview reidrata o src
   pelo source_photo_id depois que o Report Engine compacta o relatório. */
for(const g of (groups||[])){
 const isCover=String(g&&g.record_kind||'')==='report_cover_photo'||(String(g&&g.linked_entity_type||'')==='report_cover'&&String(g&&g.linked_entity_id||'')===String(state.id||''));
 if(!isCover||!g||!g.id||linked.some(item=>String(item&&item.id||'')===String(g.id)))continue;
 linked.push({...g,photos:(g.photos||[]).map(ph=>({id:ph.id||'',title:ph.title||'',description:ph.description||ph.caption||'',category:ph.category||'general',created_at:ph.created_at||null}))});
}
state.evidence_groups=linked;persist();}catch(e){console.warn('[GROUNDING EVIDENCE SYNC]',e)}}
async function syncCoverPhoto(){try{const api=global.AuroraCoverPhotoFeature;if(!api||typeof api.loadStoredCoverPhoto!=='function')return state&&state.coverPhoto||null;/* Never destructively clear a cover during hydration. The official EvidenceStore is authoritative; Runtime/state are safe fallbacks while the async store settles. */let cover=await api.loadStoredCoverPhoto(state);if(!cover||!cover.src){try{const rt=runtime();const live=rt&&typeof rt.getCase==='function'?rt.getCase():null;const fallback=live&&(live.coverPhoto||live.cover_photo);if(fallback&&fallback.src)cover=fallback;}catch(_){}}if(cover&&cover.src){state.coverPhoto={...cover,has_photo:true};delete state.cover_photo;persist();return state.coverPhoto;}return state&&state.coverPhoto||null;}catch(e){console.warn('[GROUNDING COVER PHOTO SYNC]',e);return state&&state.coverPhoto||null;}}
async function finish(){trace35('FINISH_START',{state_updated_at:state&&state.updated_at,customer:state&&state.customer});await syncEvidence();await syncCoverPhoto();try{const rt=runtime();const live=rt&&typeof rt.getCase==='function'?rt.getCase():null;if(live&&live.customer){trace35('FINISH_LIVE_CUSTOMER',{live_customer:live.customer,state_customer_before:state.customer});const lc=live.customer||{};state.customer={name:String(lc.name??''),document:String(lc.document??''),phone:String(lc.phone??''),email:String(lc.email??''),address:String(lc.address??''),person_type:String(lc.person_type??'')};trace35('FINISH_CUSTOMER_MERGED',{state_customer_after:state.customer});}}catch(_){}state.status='Concluído';state.approval={...(state.approval||{}),report_points_layout:state.grounding.report_points_layout==='table_b2'?'table_b2':'cards',report_title:state.grounding.identification.title||'Relatório técnico de aterramento e equipotencialização',summary:`${state.grounding.points.length} pontos de aferição registrados.`,recommendation:state.grounding.recommendations||'',final_observation:state.grounding.conclusion||''};state.asset={identification:state.grounding.identification.unit||state.grounding.identification.sector||'Sistema de aterramento',notes:state.grounding.method.system_description||''};state.intake={reason:state.grounding.method.inspection_type||'Inspeção de aterramento',initial_condition:state.grounding.method.methodology||'',responsible:state.grounding.identification.technical_responsible||'',confirmed:true};persist();try{const rt=runtime();if(rt&&rt.resetCase)rt.resetCase(state,{reason:'grounding_shape_finalize'});const eng=global.AuroraReportFeature&&global.AuroraReportFeature.engine;if(!eng)throw new Error('Report Engine indisponível');/* Repete o pipeline canônico já usado pelas shapes maduras da Aurora: a capa é
   hidratada pelo AuroraReportFeature imediatamente antes de criar o relatório. */
let reportCase=state;
const reportFeature=global.AuroraReportFeature;
if(reportFeature&&typeof reportFeature.hydrateCoverPhoto==='function')reportCase=await reportFeature.hydrateCoverPhoto(reportCase);
if(reportFeature&&typeof reportFeature.hydrateEvidenceGroups==='function')reportCase=await reportFeature.hydrateEvidenceGroups(reportCase);
state=reportCase;
const report=eng.createFromCase(reportCase,{status:'Concluído',...(editReportMeta?{id:editReportMeta.id,publicId:editReportMeta.public_id,createdAt:editReportMeta.created_at}: {})});/* Persist Grounding presentation choices redundantly in the report record so reopening never falls back to defaults. */report.report_points_layout=state.grounding&&state.grounding.report_points_layout==='table_b2'?'table_b2':'cards';report.grounding={...(report.grounding||{}),report_points_layout:report.report_points_layout};report.approval={...(report.approval||{}),report_points_layout:report.report_points_layout};report.snapshot=report.snapshot||{};report.snapshot.grounding={...(report.snapshot.grounding||state.grounding||{}),report_points_layout:report.report_points_layout};if(state.coverPhoto){report.coverPhoto={...state.coverPhoto};report.snapshot.coverPhoto={...state.coverPhoto};}if(typeof eng.save==='function')eng.save(report);editReportMeta={id:report.id,public_id:report.public_id,created_at:report.created_at};trace35('CANONICAL_REPORT_REPLACED',{id:report.id,public_id:report.public_id,updated_at:report.updated_at,customer:report.customer,snapshot_customer:report.snapshot&&report.snapshot.customer});global.__auroraCompletedCaseForAutoSync=JSON.parse(JSON.stringify(state));try{if(global.AuroraCloudSync&&typeof global.AuroraCloudSync.syncSelectedCase==='function'){await global.AuroraCloudSync.syncSelectedCase({...state,status:'completed'});global.__auroraCompletedCaseForAutoSync=null;}else if(global.AuroraCloudSync&&global.AuroraCloudSync.queueCaseForSync){global.AuroraCloudSync.queueCaseForSync(state);}}catch(syncError){try{global.AuroraCloudSync&&global.AuroraCloudSync.queueCaseForSync&&global.AuroraCloudSync.queueCaseForSync(state)}catch(_){}console.warn('[GROUNDING AUTO SYNC]',syncError)}localStorage.removeItem(KEY);root?.remove();root=null;if(global.auroraReportPreview&&global.auroraReportPreview.open)global.auroraReportPreview.open(report.id);}catch(e){alert('Não foi possível gerar o relatório: '+e.message)}}
async function open(){editReportMeta=null;let draft=null;try{draft=JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){}state=draft&&draft.service&&['grounding','grounding_equipotentialization'].includes(String(draft.service.id||''))?draft:blank();editing=-1;root=null;const rt=runtime();if(!rt)return false;rt.resetCase&&rt.resetCase(state,{reason:'grounding_shape_start_v44'});if(typeof rt.openStep==='function')await rt.openStep('customer',{saveCurrent:false});return true;}
async function hydrateReportEvidence(report){if(!report||!report.snapshot)return report;const hydrated=JSON.parse(JSON.stringify(report));try{const store=new global.EvidenceStore();const groups=await store.listByCase(String(hydrated.snapshot.id||hydrated.id||''));if(groups&&groups.length){hydrated.snapshot.evidence_groups=groups;const pts=hydrated.snapshot.grounding&&Array.isArray(hydrated.snapshot.grounding.points)?hydrated.snapshot.grounding.points:[];for(const p of pts){const gs=groups.filter(g=>String(g.grounding_point_id||g.linked_entity_id||'')===String(p.id));p.photos=[];p.photo_ids=[];p.photo_descriptions=[];for(const g of gs)for(const ph of (g.photos||[])){const src=ph.edited_src||ph.src||ph.data_url||ph.object_url||ph.url||'';if(src){p.photos.push(src);p.photo_ids.push(ph.id||'');p.photo_descriptions.push(ph.description||ph.caption||'')}}p.photo_count=p.photos.length;}}}catch(e){console.warn('[GROUNDING HYDRATE LOCAL]',e)}return hydrated;}
async function openFromReport(report){if(!report||!report.snapshot)return false;report=await hydrateReportEvidence(report);editReportMeta={id:report.id,public_id:report.public_id||'',created_at:report.created_at||report.snapshot.created_at||new Date().toISOString()};state=JSON.parse(JSON.stringify(report.snapshot));if(!state.grounding||!['grounding','grounding_equipotentialization'].includes(String(state.service&&state.service.id).toLowerCase()))return false;localStorage.setItem(KEY,JSON.stringify(compactForStorage(state)));const rt=runtime();if(!rt)return false;rt.resetCase&&rt.resetCase(state,{reason:'grounding_report_edit_v44'});root=null;if(typeof rt.openStep==='function')await rt.openStep('customer',{saveCurrent:false});return true;}
document.addEventListener('click',e=>{const card=e.target.closest&&e.target.closest('[data-service-id="grounding"]');if(!card||root)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open();},true);
function reportStep(){return `<main class="avi-screen"><section class="avi-hero"><span>Etapa final</span><h1>Relatório de aterramento</h1><p>O atendimento mantém o mesmo identificador, os pontos, as fotos e a foto de capa.</p></section><section class="aurora-form"><div class="section-head"><small>RELATÓRIO ESPECIALIZADO</small><h2>Gerar e abrir relatório</h2><p>Use “Finalizar inspeção” para persistir e abrir o relatório técnico Grounding.</p></div><div class="final-count"><strong>${(state&&state.grounding&&state.grounding.points||[]).length}</strong><span>pontos de aferição preservados</span></div></section></main>`;}

function adoptRuntimeCase(context){
 const incoming=JSON.parse(JSON.stringify(context||{}));
 const serviceId=String(incoming&&incoming.service&&incoming.service.id||incoming&&incoming.profile_id||'').toLowerCase();
 if(!incoming.grounding){
  if(!['grounding','grounding_equipotentialization'].includes(serviceId))return;
  /* Mesmo contrato das shapes maduras: a etapa recebe o case do Runtime.
   * Quando o Home criou somente o envelope canônico do atendimento, complete
   * exclusivamente o payload próprio de Grounding usando o template Grounding
   * já existente. Nenhum dado de outra shape é transplantado. */
  incoming.grounding=JSON.parse(JSON.stringify(blank().grounding));
  incoming.approval=incoming.approval||{report_title:'Relatório técnico de aterramento e equipotencialização'};
  incoming.occurrences=Array.isArray(incoming.occurrences)?incoming.occurrences:[];
 }
 state=incoming;
 try{
  const eng=global.AuroraReportFeature&&global.AuroraReportFeature.engine;
  const reports=eng&&typeof eng.list==='function'?eng.list():[];
  const current=reports.find(r=>String(r&&r.snapshot&&r.snapshot.id||r&&r.case_id||'')===String(state.id||''));
  if(current)editReportMeta={id:current.id,public_id:current.public_id||'',created_at:current.created_at||state.created_at||new Date().toISOString()};
 }catch(_){}
}

class GroundingWorkflowController extends global.ModuleController{
 constructor(id,number){super({id});this.number=number;this.host=null;}
 async onLoad(context){adoptRuntimeCase(context);editing=-1;}
 async render(){
  const body=this.number===1?step1():this.number===2?step2():this.number===3?step3():this.number===4?step4():reportStep();
   return `<section id="aurora-grounding-shape" class="aurora-grounding-runtime" data-grounding-section="${this.number}">${this.number===5?body:shell(body,this.number)}</section>`;
 }
 async bindEvents(container){this.host=(container&&container.matches&&container.matches('#aurora-grounding-shape'))?container:container.querySelector('#aurora-grounding-shape');root=this.host;if(this.number<5&&this.host)bind();}
 async onValidate(){
  if(this.number===1){
   const result=validateMountedIdentification(this.host);
   if(!result.valid){
    global.__AURORA_VALIDATION_MESSAGE__='Preencha os campos obrigatórios: '+result.missing.map(path=>REQUIRED_LABELS[path]).join(', ')+'.';
    return false;
   }
   global.__AURORA_VALIDATION_MESSAGE__='';
   return true;
  }
  syncVisibleFields(this.host);
  const missing=[],missingPaths=[];
  const requirePath=(path)=>{if(!String(getPath(path)||'').trim()){missing.push(REQUIRED_LABELS[path]);missingPaths.push(path);}};
  if(this.number===2){['grounding.method.system_type','grounding.method.inspection_type','grounding.method.objective','grounding.method.methodology'].forEach(requirePath);}
  if(this.number===3){const pts=state&&state.grounding&&Array.isArray(state.grounding.points)?state.grounding.points:[];if(!pts.length)missing.push('ao menos um ponto de aferição');else{const incomplete=pts.findIndex(p=>pointMissingKeys(p).length);if(incomplete>=0){editing=incomplete;render();markPointRequiredFields(incomplete);missing.push(`Ponto ${String(incomplete+1).padStart(2,'0')}: categoria, descrição, valor, condição e parecer`);}}}
  if(this.number===4)requirePath('grounding.conclusion');
  markRequiredFields(missingPaths,this.host);
  if(missing.length){global.__AURORA_VALIDATION_MESSAGE__='Preencha os campos obrigatórios: '+missing.join(', ')+'.';return false;}
  global.__AURORA_VALIDATION_MESSAGE__='';
  persist();
  return true;
 }
 async onSave(){
  if(this.number===1){
   applyMountedFields(readMountedFields(this.host,IDENTIFICATION_PATHS));
  }else{
   syncVisibleFields(this.host);
  }
  /* Os campos Grounding já persistem durante a edição. A navegação nunca deve
   * ser bloqueada por um refresh de evidência ou por persistência auxiliar. */
  if(this.number===3){try{await syncEvidence();}catch(error){console.warn('[GROUNDING NAV SAVE EVIDENCE]',error);}}
  persist();
  if(this.number===5){await finish();return null;}
  return {grounding:state.grounding,customer:state.customer,evidence_groups:state.evidence_groups||[],occurrences:state.occurrences||[],approval:state.approval||{},coverPhoto:state.coverPhoto||null,status:state.status,updated_at:state.updated_at};
 }
 async onUnmount(){if(root===this.host)root=null;this.host=null;}
}

function createWorkflowControllers(){return [
 new GroundingWorkflowController('grounding_identification',1),
 new GroundingWorkflowController('grounding_method',2),
 new GroundingWorkflowController('grounding_occurrences',3),
 new GroundingWorkflowController('grounding_conclusion',4),
 new GroundingWorkflowController('grounding_report',5)
];}

global.AuroraGroundingShape={open,openFromReport,hydrateReportEvidence,createWorkflowControllers,build:BUILD,officialWorkflow:true};
})(window);

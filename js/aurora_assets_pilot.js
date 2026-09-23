(function(global){
'use strict';
const STORAGE='aurora_assets_electrical_pilot_v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ui=null;
const CATALOGS=Object.freeze({
 workshop:{profile:'workshop',title:'Veículos',section:'Oficina',singular:'veículo',plural:'veículos',codeLabel:'Placa / código',nameLabel:'Identificação do veículo',search:'Placa, veículo, cliente ou local',newLabel:'Cadastrar veículo',types:['Automóvel','Utilitário','Caminhão','Motocicleta','Outro veículo'],icon:'🚘'},
 electrical:{profile:'electrical',title:'Painéis e equipamentos',section:'Elétrica',singular:'equipamento',plural:'equipamentos',codeLabel:'Código do ativo',nameLabel:'Nome do ativo',search:'Código, nome, setor ou local',newLabel:'Cadastrar equipamento',types:['Painel elétrico','Quadro de distribuição','Centro de controle de motores','Motor elétrico','Transformador','Gerador','Outro equipamento elétrico'],icon:'⚡'},
 industrial:{profile:'industrial',title:'Máquinas e equipamentos',section:'Industrial',singular:'equipamento',plural:'equipamentos',codeLabel:'Código do ativo',nameLabel:'Nome do ativo',search:'Código, nome, setor ou local',newLabel:'Cadastrar equipamento',types:['Máquina','Tubulação','Estrutura','Tanque','Outro equipamento industrial'],icon:'🏭'},
 drone:{profile:'drone',title:'Estruturas inspecionadas',section:'Drone',singular:'estrutura',plural:'estruturas',codeLabel:'Código / identificação',nameLabel:'Nome da estrutura',search:'Código, estrutura, cliente ou local',newLabel:'Cadastrar estrutura',types:['Telhado','Fachada','Torre','Usina solar','Outra estrutura'],icon:'🚁'},
 car_wash:{profile:'car_wash',title:'Veículos',section:'Lavação automotiva',singular:'veículo',plural:'veículos',codeLabel:'Placa / código',nameLabel:'Identificação do veículo',search:'Placa, veículo ou cliente',newLabel:'Cadastrar veículo',types:['Automóvel','Utilitário','Caminhão','Motocicleta','Outro veículo'],icon:'🚘'},
 upholstery_cleaning:{profile:'upholstery_cleaning',title:'Estofados cadastrados',section:'Higienização de estofados',singular:'estofado',plural:'estofados',codeLabel:'Código do item',nameLabel:'Identificação do estofado',search:'Código, estofado, cliente ou local',newLabel:'Cadastrar estofado',types:['Sofá','Colchão','Poltrona','Cadeiras','Banco automotivo','Tapete e carpete','Outro estofado'],icon:'🛋'},
 curtains_blinds:{profile:'curtains_blinds',title:'Cortinas e persianas',section:'Cortinas e persianas',singular:'item',plural:'itens',codeLabel:'Código do item',nameLabel:'Identificação do item',search:'Código, item, cliente ou local',newLabel:'Cadastrar item',types:['Cortina','Persiana','Sistema motorizado','Trilho e varão','Outro item'],icon:'▤'},
 repairs_maintenance:{profile:'repairs_maintenance',title:'Locais e manutenções',section:'Reparos e manutenção',singular:'local',plural:'locais',codeLabel:'Código / referência',nameLabel:'Nome do local',search:'Código, local, cliente ou setor',newLabel:'Cadastrar local',types:['Local de pequenos reparos','Alvenaria','Pintura','Pisos e revestimentos','Pequena reforma','Manutenção geral','Outro local'],icon:'🛠'},
 condominiums:{profile:'condominiums',title:'Áreas e equipamentos',section:'Condomínios',singular:'área ou equipamento',plural:'áreas e equipamentos',codeLabel:'Código / identificação',nameLabel:'Nome da área ou equipamento',search:'Código, área, equipamento ou local',newLabel:'Cadastrar área/equipamento',types:['Área comum','Sistema elétrico','Sistema hidráulico','Bombas e casa de máquinas','Elevador','Sistema de incêndio','Fachada e cobertura','Garagem','Portões e acessos','Piscina e área de lazer','Outro'],icon:'🏢'}
});
function catalogHome(){
 const h=document.querySelector('.aurora-home-layer');
 if(!h)return null;
 const grid=h.querySelector('.aurora-company-management__grid');
 const card=grid&&grid.querySelector('[data-open-assets]');
 if(!grid||!card)return null;
 const profile=String(card.dataset.assetsProfile||'electrical').toLowerCase();
 const ctx=CATALOGS[profile]||null;
 return ctx?{h,grid,card,ctx}:null;
}
function currentContext(){const x=catalogHome();return x&&x.ctx?x.ctx:CATALOGS.electrical}
function contextRows(rows){const ctx=currentContext();return (Array.isArray(rows)?rows:[]).filter(r=>String(r.module_code||'electrical').toLowerCase()===ctx.profile)}
function load(){try{return JSON.parse(localStorage.getItem(STORAGE)||'[]')}catch(_){return []}}
function save(x){localStorage.setItem(STORAGE,JSON.stringify(x))}
function uid(){return 'asset_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function token(){try{const a=new Uint8Array(18);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,'0')).join('')}catch(_){return uid()+uid()}}
function qrPayload(r){return location.origin.replace(/\/$/,'')+'/?aurora_asset='+encodeURIComponent(r.qr_token||'')}
function cloud(){return global.AuroraCloudSync&&global.AuroraCloudSync.client?global.AuroraCloudSync.client:null}
let assetPerms={can_view:true,can_inspect:true,can_view_history:true,can_print_qr:false,can_create:false,can_edit:false,can_deactivate:false};
let assetIsAdmin=false;
const historyIcons={edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7"/><path d="M10 11v5m4-5v5"/></svg>'};
async function loadPermissions(){
 const c=cloud();
 if(!c)return assetPerms;
 try{
   if(global.AuroraCompanyAccess&&typeof global.AuroraCompanyAccess.refresh==='function'){
     try{await global.AuroraCompanyAccess.refresh(c)}catch(_){}
   }
   const claim=global.AuroraCompanyAccess&&typeof global.AuroraCompanyAccess.get==='function'?global.AuroraCompanyAccess.get():global.AURORA_COMPANY_ACCESS||{};
   let role=String(claim&&claim.role||'').trim().toUpperCase();
   // Fonte autenticada adicional: membership ativa. Evita esconder ações do ADMIN
   // quando o claim de CompanyAccess ainda não terminou de hidratar a Home.
   if(!role){
     try{
       const direct=await c.rpc('aurora_my_company_access');
       let dr=Array.isArray(direct.data)?direct.data[0]:direct.data;
       if(typeof dr==='string'){try{dr=JSON.parse(dr)}catch(_){dr=null}}
       role=String(dr&&(dr.role||dr.company_role)||'').trim().toUpperCase().replace(/\s+/g,'_');
     }catch(_){}
   }
   if(!role){
     try{
       const membership=await c.rpc('aurora_my_active_membership');
       const mr=Array.isArray(membership.data)?membership.data[0]:membership.data;
       role=String(mr&&(mr.role||mr.company_role||mr.membership_role)||'').trim().toUpperCase().replace(/\s+/g,'_');
     }catch(_){}
   }
   assetIsAdmin=(role==='COMPANY_ADMIN'||role==='ADMIN_BOLT'||role==='OWNER');
   if(assetIsAdmin){
     assetPerms={can_view:true,can_inspect:true,can_view_history:true,can_print_qr:true,can_create:true,can_edit:true,can_deactivate:true};
     return assetPerms;
   }
   const {data,error}=await c.rpc('aurora_asset_my_permissions');
   if(error)throw error;
   const x=Array.isArray(data)?data[0]:data;
   if(x)assetPerms={...assetPerms,...x};
 }catch(e){console.warn('Aurora Ativos: permissões indisponíveis.',e)}
 return assetPerms
}
function cloudRowToLocal(x){return {id:x.client_key||x.id,cloud_id:x.id,qr_token:x.public_token||'',code:x.code||'',name:x.name||'',type:x.asset_type||'',status:x.status||'active',unit:x.unit||'',sector:x.sector||'',location:x.internal_location||'',notes:x.notes||'',module_code:x.module_code||'electrical',service_code:x.service_code||'panel',created_at:x.created_at||'',updated_at:x.updated_at||'',cloud_synced_at:new Date().toISOString()}}
async function cloudLoadAssets(){const c=cloud();if(!c)return load();try{const {data,error}=await c.rpc('aurora_assets_my_list');if(error)throw error;const remote=(Array.isArray(data)?data:[]).map(cloudRowToLocal),local=load(),by=new Map();local.forEach(r=>by.set(String(r.cloud_id||r.id),r));remote.forEach(r=>{const k=String(r.cloud_id||r.id),old=by.get(k)||{};by.set(k,{...old,...r})});const rows=[...by.values()];save(rows);return contextRows(rows)}catch(e){console.warn('Aurora Ativos: leitura da nuvem indisponível.',e);return load()}}
async function cloudUpsert(r){const c=cloud();if(!c)return r;const {data,error}=await c.rpc('aurora_asset_upsert',{p_client_key:r.id,p_code:r.code,p_name:r.name,p_asset_type:r.type,p_status:r.status||'active',p_unit:r.unit||null,p_sector:r.sector||null,p_internal_location:r.location||null,p_notes:r.notes||null,p_module_code:r.module_code||currentContext().profile,p_service_code:r.service_code||''});if(error)throw error;const x=Array.isArray(data)?data[0]:data;if(x&&x.public_token){r.qr_token=x.public_token;r.cloud_id=x.id;r.cloud_synced_at=new Date().toISOString()}return r}
async function syncLocalToCloud(){const c=cloud();if(!c)return false;const rows=load();let changed=false;for(const r of rows){try{const before=r.qr_token;await cloudUpsert(r);if(r.qr_token!==before||!r.cloud_synced_at)changed=true}catch(e){console.warn('Aurora Ativos: sincronização pendente.',e)}}if(changed)save(rows);return true}
function qrSvg(payload){if(!payload||!global.AuroraQRCode)return '';try{const q=new global.AuroraQRCode(-1,1);q.addData(payload);q.make();const n=q.getModuleCount(),z=4,size=n+z*2;let d='';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))d+=`M${c+z} ${r+z}h1v1h-1z`;return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#102d46"/></svg>`}catch(_){return ''}}
async function shareQr(r){
 if(!r||!r.qr_token)return;
 const url=qrPayload(r);
 const display=assetDisplayParts(r);
 const title=display.name?(display.code+' · '+display.name):display.code;
 const text='QR Code permanente do ativo '+title;
 try{
   if(navigator.share){
     await navigator.share({title:'Aurora · '+title,text,url});
     return;
   }
 }catch(error){
   if(error&&error.name==='AbortError')return;
   console.warn('Aurora Ativos: compartilhamento nativo do QR indisponível.',error);
 }
 try{
   if(navigator.clipboard&&navigator.clipboard.writeText){
     await navigator.clipboard.writeText(url);
     alert('Link do QR Code copiado para compartilhar.');
     return;
   }
 }catch(error){console.warn('Aurora Ativos: cópia do QR indisponível.',error)}
 prompt('Copie o link do QR Code:',url);
}
async function printLabel(r){
 const display=assetDisplayParts(r);
 if(!r)return;
 const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const code=safe(r.code||r.client_key||'SEM CÓDIGO');
 const name=safe(r.name||r.description||'');
 const payload=qrPayload(r), qrMarkup=qrSvg(payload);
 if(!qrMarkup){alert('Não foi possível gerar a etiqueta deste cadastro.');return;}

 let company='';
 try{
   const c=window.AuroraCloudSync&&AuroraCloudSync.client;
   if(c){
     const {data}=await c.rpc('aurora_my_active_membership');
     const row=Array.isArray(data)?data[0]:data;
     const cid=row&&(row.company_id||row.id);
     if(cid){
       const q=await c.from('aurora_companies').select('name').eq('id',cid).maybeSingle();
       company=(q.data&&q.data.name)||'';
     }
   }
 }catch(e){console.warn('[AuroraAssets] company label lookup',e)}
 if(!company){
   try{
     const candidates=[
       window.AuroraCompanyProfile&&AuroraCompanyProfile.company_name,
       window.AuroraCompanyProfile&&AuroraCompanyProfile.name,
       localStorage.getItem('aurora_company_name')
     ];
     company=candidates.find(v=>v&&String(v).trim()&&!/^empresa$/i.test(String(v).trim()))||'';
   }catch(_){}
 }
 company=String(company||'').trim();
 const cc=company.length>36?'company xl':company.length>26?'company lg':company.length>18?'company md':'company';

 const html=`<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta ${code}</title><style>
 @page{size:50.8mm 50.8mm;margin:0}
 *{box-sizing:border-box}
 html,body{margin:0!important;padding:0!important;width:50.8mm;height:50.8mm;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}
 .label{position:relative;width:50.8mm;height:50.8mm;border:.25mm solid #000;border-radius:50%;overflow:hidden;background:#fff;text-align:center}
 .company{position:absolute;left:8.2mm;right:8.2mm;top:4.2mm;height:5.2mm;display:flex;align-items:center;justify-content:center;font-size:6.7pt;line-height:1.03;font-weight:900;text-transform:uppercase}
 .company.md{font-size:6.0pt}.company.lg{font-size:5.25pt}.company.xl{font-size:4.6pt}
 .code{position:absolute;left:6.2mm;right:6.2mm;top:10.5mm;font-size:12.2pt;line-height:1;font-weight:900;letter-spacing:.06mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .name{position:absolute;left:7mm;right:7mm;top:15.1mm;font-size:5.8pt;line-height:1.05;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .qr{position:absolute;left:50%;transform:translateX(-50%);top:19.1mm;width:25.8mm;height:25.8mm}
 .qr svg{width:100%;height:100%;display:block}
 .phonehint{position:absolute;left:3.7mm;top:24.7mm;width:9.6mm;height:13.0mm;display:flex;align-items:center;justify-content:center}
 .phonehint img{width:100%;height:100%;display:block;object-fit:contain;filter:grayscale(1) contrast(1.35)}
 .footer{position:absolute;left:8mm;right:8mm;bottom:4.15mm;font-size:4.25pt;line-height:1}
 .footer strong{font-size:5.7pt}
 </style></head><body><div class="label">
 ${company?`<div class="${cc}">${safe(company)}</div>`:''}
 <div class="code">${code}</div>
 <div class="name">${name}</div>
 <div class="phonehint" aria-hidden="true"><img src="./assets/icons/aurora_qr_phone_official.svg" alt=""></div>
 <div class="qr">${qrMarkup}</div>
 <div class="footer">Powered by <strong>Aurora</strong></div>
 </div></body></html>`;

 let frame=document.getElementById('aurora-asset-print-frame');if(frame)frame.remove();
 frame=document.createElement('iframe');frame.id='aurora-asset-print-frame';
 frame.style.cssText='position:fixed;left:-10000px;top:0;width:50.8mm;height:50.8mm;border:0;visibility:hidden';
 document.body.appendChild(frame);
 const d=frame.contentDocument||frame.contentWindow.document;
 d.open();d.write(html);d.close();
 const icon=d.querySelector('.phonehint img');
 let printStarted=false;
 const runPrint=()=>{
   if(printStarted)return;
   printStarted=true;
   setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print()}catch(e){console.error('[AuroraAssets] print label',e);alert('Não foi possível abrir a impressão da etiqueta.')}},120);
 };
 if(icon&&!icon.complete){icon.onload=runPrint;icon.onerror=runPrint;setTimeout(runPrint,900)}else{runPrint()}
 setTimeout(()=>{try{frame.remove()}catch(_){}},10000);
}
function status(v){return v==='maintenance'?'Em manutenção':v==='inactive'?'Desativado':'Ativo'}
function ensure(){
 const x=catalogHome();if(!x)return false;
 const {h,grid,ctx}=x;
 let card=x.card;
 const st=card.querySelector('strong'),sm=card.querySelector('small');
 if(st&&!card.querySelector('[data-assets-info]'))st.innerHTML=`${esc(ctx.title)} <i class="aurora-assets-info" data-assets-info role="button" tabindex="0" aria-label="O que é ${esc(ctx.title)}?">ⓘ</i>`;
 if(sm&&!sm.textContent.trim())sm.textContent=`Identificação, serviços e histórico de ${ctx.plural}`;
 if(ui&&ui.home===h&&ui.panel&&ui.panel.isConnected&&ui.profile===ctx.profile){card.onclick=ui.showPanel;return true}
 h.querySelectorAll('[data-assets-panel],[data-assets-detail],[data-assets-editor],[data-asset-qr-modal],[data-assets-help-modal]').forEach(n=>n.remove());
 const typeOptions=ctx.types.map(v=>`<option>${esc(v)}</option>`).join('');
 h.insertAdjacentHTML('beforeend',`<section class="aurora-assets-panel" data-assets-panel hidden><div class="aurora-assets-top"><button type="button" class="aurora-company-team-back" data-assets-back>← Início</button><div><span>${esc(ctx.section)}</span><h3>${esc(ctx.title)}</h3><small>${esc(ctx.plural.charAt(0).toUpperCase()+ctx.plural.slice(1))} cadastrados e seu histórico de serviços.</small></div></div><div class="aurora-assets-toolbar"><label><span>Buscar ${esc(ctx.singular)}</span><input type="search" data-assets-search placeholder="${esc(ctx.search)}"></label><button type="button" class="aurora-assets-primary" data-assets-new>＋ ${esc(ctx.newLabel)}</button></div><div class="aurora-assets-summary" data-assets-summary></div><div class="aurora-assets-list" data-assets-list></div></section>
<section class="aurora-assets-detail" data-assets-detail hidden>
<div class="aurora-assets-top"><button type="button" class="aurora-company-team-back" data-assets-detail-back>← ${esc(ctx.title)}</button><div><span>${esc(ctx.section)}</span><h3 data-assets-detail-title>${esc(ctx.singular)}</h3><small>Identificação permanente, etiqueta QR e histórico de atendimentos.</small></div></div>
<div class="aurora-asset-detail-hero"><div><span data-assets-detail-type></span><h2 data-assets-detail-name></h2><small data-assets-detail-meta></small></div><span class="aurora-asset-detail-status" data-assets-detail-status></span></div>
<div class="aurora-asset-detail-actions"><button type="button" class="aurora-assets-primary" data-assets-new-inspection>＋ Nova vistoria</button><button type="button" data-assets-detail-qr>Etiqueta QR</button><button type="button" data-assets-detail-public-preview>Visualizar informações do QR Code</button><button type="button" data-assets-detail-edit>Editar equipamento</button><button type="button" class="is-danger" data-assets-detail-delete>Excluir equipamento</button></div>
<section class="aurora-asset-history"><div class="aurora-asset-history-head"><div><span>HISTÓRICO</span><h3>Atendimentos deste ${esc(ctx.singular)}</h3></div><strong data-assets-history-count>0 atendimentos</strong></div><div data-assets-history-list></div></section></section>
<section class="aurora-assets-editor" data-assets-editor hidden><form data-assets-form><div class="aurora-assets-top"><button type="button" class="aurora-company-team-back" data-assets-editor-back>← ${esc(ctx.title)}</button><div><span>Cadastro permanente</span><h3 data-assets-editor-title>Novo ${esc(ctx.singular)}</h3><small>Identificação permanente para serviços e histórico de ${esc(ctx.section)}.</small></div></div><div class="aurora-assets-form-grid"><label><span>${esc(ctx.codeLabel)} *</span><input name="code" maxlength="60" required></label><label><span>${esc(ctx.nameLabel)} *</span><input name="name" maxlength="100" required></label><label><span>Tipo *</span><select name="type" required><option value="">Selecione</option>${typeOptions}</select></label><label><span>Status</span><select name="status"><option value="active">Ativo</option><option value="maintenance">Em manutenção</option><option value="inactive">Desativado</option></select></label><label><span>Cliente / unidade</span><input name="unit" maxlength="100"></label><label><span>Setor</span><input name="sector" maxlength="100"></label><label class="is-wide"><span>Localização</span><input name="location" maxlength="140"></label><label class="is-wide"><span>Observações</span><textarea name="notes" maxlength="500" rows="3"></textarea></label></div><article class="aurora-assets-qr-placeholder" data-asset-qr><div class="aurora-assets-qr-icon" data-asset-qr-image>▦</div><div><span>Identificação permanente</span><strong>QR Code</strong><small data-asset-qr-help>O QR será gerado automaticamente após salvar.</small></div><button type="button" data-asset-print-qr hidden>Imprimir etiqueta</button></article><input type="hidden" name="id"><footer class="aurora-assets-actions"><button type="button" data-assets-cancel>Cancelar</button><button type="submit" class="aurora-assets-primary">Salvar</button></footer></form></section>
<section class="aurora-assets-help-modal" data-assets-help-modal hidden><div class="aurora-assets-help-card"><span>${esc(ctx.title).toUpperCase()}</span><h3>O que é esta área?</h3><p>Aqui ficam ${esc(ctx.plural)} que podem receber mais de um atendimento. Cada cadastro reúne serviços, relatórios e o QR de identificação ao longo do tempo.</p><p>Você cadastra uma vez e mantém o histórico dos próximos atendimentos.</p><button type="button" data-assets-help-close>Entendi</button></div></section>
<section class="aurora-asset-qr-modal" data-asset-qr-modal hidden><div class="aurora-asset-qr-modal__card"><small>IDENTIFICAÇÃO PERMANENTE</small><h3 data-qr-modal-title>QR Code</h3><p data-qr-modal-subtitle></p><div class="aurora-asset-qr-modal__qr" data-qr-modal-image></div><div class="aurora-asset-qr-modal__actions"><button type="button" data-qr-modal-close>Fechar</button><button type="button" data-qr-modal-share>Compartilhar QR</button><button type="button" class="is-primary" data-qr-modal-print>Imprimir etiqueta</button></div></div></section>`);
 const panel=h.querySelector('[data-assets-panel]'),detail=h.querySelector('[data-assets-detail]'),editor=h.querySelector('[data-assets-editor]'),modal=h.querySelector('[data-asset-qr-modal]'),helpModal=h.querySelector('[data-assets-help-modal]');let current=null;
 const normal=()=>[...h.children].filter(n=>n!==panel&&n!==detail&&n!==editor&&n!==modal&&n!==helpModal);
 const homeVisibility=new Map(normal().map(n=>[n,n.hidden]));
 function closeQr(){modal.hidden=true;current=null}
 function openQr(r){if(!r||!r.qr_token)return;current=r;modal.querySelector('[data-qr-modal-title]').textContent=r.code+' · '+r.name;modal.querySelector('[data-qr-modal-subtitle]').textContent='QR permanente deste ativo';modal.querySelector('[data-qr-modal-image]').innerHTML=qrSvg(qrPayload(r));const share=modal.querySelector('[data-qr-modal-share]');if(share)share.onclick=()=>shareQr(r);modal.hidden=false}
 function reportRows(){try{const x=global.AuroraReportFeature&&global.AuroraReportFeature.engine;return x&&typeof x.list==='function'?x.list():[]}catch(e){return []}}
 function reportAssetKeys(report){
   const a=report&&report.asset||{};
   return [a.tag,a.code,a.identification,a.name,a.asset_name].map(v=>String(v||'').trim().toLocaleLowerCase('pt-BR')).filter(Boolean);
 }
 function localAssetHistory(r){
   const keys=[r.code,r.name].map(v=>String(v||'').trim().toLocaleLowerCase('pt-BR')).filter(Boolean);
   return reportRows().filter(rep=>reportAssetKeys(rep).some(k=>keys.includes(k))).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
 }
 async function assetHistory(r){
   const c=cloud();
   if(c&&r&&r.cloud_id){
     try{
       const {data,error}=await c.rpc('aurora_asset_history_list',{p_asset_id:r.cloud_id});
       if(error)throw error;
       const rows=Array.isArray(data)?data:[];
       return rows.map(row=>({...row,__aurora_cloud_asset_history:true,id:row.project_id||row.id}));
     }catch(error){
       console.warn('Aurora Ativos: histórico empresarial indisponível; usando dados locais.',error);
     }
   }
   return localAssetHistory(r);
 }
 function formatHistoryDate(v){try{return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch(e){return '—'}}
 function historyServiceLabel(v){try{if(global.AuroraI18n&&typeof global.AuroraI18n.serviceLabel==='function')return global.AuroraI18n.serviceLabel(v)}catch(_){}return String(v||'Atendimento').replace(/_/g,' ')}
 function isCompanyAdmin(){return assetIsAdmin}
 async function hydrateAssetHistoryEvidence(caseData,projectId,client){
   const cloudSync=global.AuroraCloudSync;
   if(cloudSync&&typeof cloudSync.hydrateAuthorizedProjectEvidence==='function')return cloudSync.hydrateAuthorizedProjectEvidence(caseData,projectId);
   return caseData;
 }
 async function openHistoryReport(id){
   const f=global.AuroraReportFeature;
   const c=cloud();
   if(c&&detailCurrent&&detailCurrent.cloud_id){
     try{
       const {data,error}=await c.rpc('aurora_asset_history_project_get',{p_asset_id:detailCurrent.cloud_id,p_project_id:id});
       if(error)throw error;
       const payload=data&&typeof data==='object'?data:null;
       const project=payload&&payload.project;
       const records=payload&&Array.isArray(payload.records)?payload.records:[];
       if(!project||!global.AuroraCloudSync||typeof global.AuroraCloudSync.caseFromCloud!=='function')throw new Error('AURORA_ASSET_REPORT_INVALID');
       let caseData=global.AuroraCloudSync.caseFromCloud(project,records);
       caseData.company_id=project.company_id||caseData.company_id||'';
       if(f&&typeof f.hydrateEvidenceGroups==='function')caseData=await f.hydrateEvidenceGroups(caseData);
       if(f&&typeof f.hydrateCoverPhoto==='function')caseData=await f.hydrateCoverPhoto(caseData);
       caseData=await hydrateAssetHistoryEvidence(caseData,project.id,c);
       const report=f.engine.createFromCase(caseData,{id:'asset-history-'+project.id,createdAt:project.created_at,updatedAt:project.updated_at,status:'Concluído'});
       f.preview.open(report.id);
       return true;
     }catch(error){
       console.error('Aurora Ativos: relatório empresarial indisponível.',error);
       alert('Não foi possível abrir este relatório agora. Atualize a Aurora e tente novamente.');
       return false;
     }
   }
   if(f&&f.preview&&typeof f.preview.open==='function'){f.preview.open(id);return true}
   alert('Não foi possível abrir este relatório agora.');return false;
 }
 let detailCurrent=null;
 async function showDetail(r){
   if(!r)return;
   // Resolve a autorização ANTES de desenhar as ações. Isso elimina a corrida
   // que deixava ADMIN com apenas "Nova vistoria" ao entrar pelo card/QR.
   await loadPermissions();
   detailCurrent=r;panel.hidden=true;editor.hidden=true;normal().forEach(n=>n.hidden=true);detail.hidden=false;
   const d=assetDisplayParts(r),hist=await assetHistory(r);
   detail.querySelector('[data-assets-detail-title]').textContent=d.code;
   detail.querySelector('[data-assets-detail-name]').textContent=d.name||d.code;
   detail.querySelector('[data-assets-detail-type]').textContent=r.type||ctx.singular;
   detail.querySelector('[data-assets-detail-meta]').textContent=[r.unit,r.sector,r.location].filter(Boolean).join(' · ')||'Sem localização complementar';
   const st=detail.querySelector('[data-assets-detail-status]');st.textContent=status(r.status);st.className='aurora-asset-detail-status is-'+String(r.status||'active');
   detail.querySelector('[data-assets-history-count]').textContent=hist.length+' '+(hist.length===1?'atendimento':'atendimentos');
   const newBtn=detail.querySelector('[data-assets-new-inspection]'),qrBtn=detail.querySelector('[data-assets-detail-qr]'),previewBtn=detail.querySelector('[data-assets-detail-public-preview]'),editBtn=detail.querySelector('[data-assets-detail-edit]'),deleteBtn=detail.querySelector('[data-assets-detail-delete]');if(newBtn)newBtn.hidden=!assetPerms.can_inspect;if(qrBtn)qrBtn.hidden=!assetPerms.can_print_qr;if(previewBtn)previewBtn.hidden=!CATALOGS[String(ctx.profile||'').toLowerCase()]||!assetPerms.can_view;if(editBtn)editBtn.hidden=!assetPerms.can_edit;if(deleteBtn)deleteBtn.hidden=!assetPerms.can_deactivate;
   const list=detail.querySelector('[data-assets-history-list]');
   const adminHistoryActions=isCompanyAdmin();
   list.innerHTML=!assetPerms.can_view_history?'<div class="aurora-assets-empty"><strong>Histórico restrito.</strong><span>O administrador não liberou a consulta do histórico para este usuário.</span></div>':hist.length?hist.map(rep=>{
     const title=String(rep.title||rep.customer?.name||'Atendimento');
     const date=formatHistoryDate(rep.updated_at||rep.created_at);
     const service=historyServiceLabel(rep.service_type||rep.service?.id||rep.service?.title);
     const creator=String(rep.creator_name||'Usuário');
     const done=String(rep.status||'').toLowerCase();
     const statusLabel=(done==='completed'||done==='concluído'||done==='concluido')?'Concluído':'Em andamento';
     const actions=adminHistoryActions?`<div class="aurora-recent-card__actions"><button type="button" class="aurora-recent-action" data-asset-history-edit="${esc(rep.id)}" aria-label="Editar atendimento" title="Editar atendimento">${historyIcons.edit}</button><button type="button" class="aurora-recent-action is-danger" data-asset-history-delete="${esc(rep.id)}" aria-label="Excluir atendimento" title="Excluir atendimento">${historyIcons.trash}</button></div>`:'';
     return `<article class="aurora-recent-card aurora-asset-history-recent"><button type="button" class="aurora-recent-card__main" data-asset-history-report="${esc(rep.id)}" aria-label="Abrir relatório"><span class="aurora-recent-card__icon">▤</span><span><strong>${esc(title)}</strong><small>${esc(service)} · Feito por ${esc(creator)} · ${esc(date)}</small></span><b class="${statusLabel==='Concluído'?'is-done':'is-open'}">${statusLabel}</b></button>${actions}</article>`;
   }).join(''):'<div class="aurora-assets-empty"><strong>Nenhum atendimento vinculado ainda.</strong><span>Os próximos atendimentos deste cadastro aparecerão aqui.</span></div>';
   list.querySelectorAll('[data-asset-history-report]').forEach(b=>b.onclick=()=>openHistoryReport(b.dataset.assetHistoryReport));
   list.querySelectorAll('[data-asset-history-edit]').forEach(b=>b.onclick=async()=>{
     const id=b.dataset.assetHistoryEdit,cloudSync=global.AuroraCloudSync;
     if(!adminHistoryActions||!cloudSync||typeof cloudSync.restoreCompanyProjectForAdmin!=='function')return;
     try{const result=await cloudSync.restoreCompanyProjectForAdmin(id);const f=global.AuroraReportFeature;const rows=f&&f.engine&&typeof f.engine.list==='function'?f.engine.list():[];const local=rows.find(x=>String((x.snapshot&&x.snapshot.id)||x.case_id||x.id||'')===String(result.caseData.id));if(local)window.dispatchEvent(new CustomEvent('aurora:edit-report',{detail:{report:local}}));}
     catch(e){console.error('Aurora Ativos: edição do histórico indisponível.',e);alert('Não foi possível editar este atendimento agora.')}
   });
   list.querySelectorAll('[data-asset-history-delete]').forEach(b=>b.onclick=async()=>{
     if(!adminHistoryActions)return;const id=b.dataset.assetHistoryDelete;if(!confirm('Excluir este atendimento do histórico?'))return;
     try{const c=cloud();const rep=hist.find(x=>String(x.id)===String(id));const owner=String(rep&&rep.created_by||''),me=String(global.AURORA_ACCOUNT_USER_ID||'');const rpc=owner&&me&&owner!==me?'aurora_company_hide_projects':'aurora_company_soft_delete_projects';const q=await c.rpc(rpc,{p_project_ids:[id]});if(q.error)throw q.error;await showDetail(detailCurrent)}catch(e){console.error('Aurora Ativos: exclusão indisponível.',e);alert('Não foi possível excluir este atendimento agora.')}
   });
   scrollTo(0,0);
 }
 function render(){
   const nb=panel.querySelector('[data-assets-new]');if(nb)nb.hidden=!assetPerms.can_create;
   const q=(panel.querySelector('[data-assets-search]').value||'').trim().toLocaleLowerCase('pt-BR'),all=load(),rows=contextRows(all),f=rows.filter(r=>!q||[r.code,r.name,r.type,r.unit,r.sector,r.location].join(' ').toLocaleLowerCase('pt-BR').includes(q));
   panel.querySelector('[data-assets-summary]').innerHTML=`<span><strong>${rows.length}</strong><small>${esc(ctx.plural)}</small></span><span><strong>${rows.filter(r=>r.status==='active').length}</strong><small>Ativos</small></span><span><strong>${rows.filter(r=>r.status==='maintenance').length}</strong><small>Em manutenção</small></span>`;
   panel.querySelector('[data-assets-list]').innerHTML=f.length?f.map(r=>{
     const actions=`<div class="aurora-asset-card__actions">${assetPerms.can_edit?`<button type="button" class="aurora-recent-action" data-asset-registry-edit="${esc(r.id)}" aria-label="Editar ${esc(ctx.singular)}" title="Editar">${historyIcons.edit}</button>`:''}${assetPerms.can_deactivate?`<button type="button" class="aurora-recent-action is-danger" data-asset-registry-delete="${esc(r.id)}" aria-label="Excluir ${esc(ctx.singular)}" title="Excluir">${historyIcons.trash}</button>`:''}</div>`;
     return `<article class="aurora-asset-card"><div class="aurora-asset-card__icon">${ctx.icon}</div><button type="button" class="aurora-asset-card__main" data-asset-open="${esc(r.id)}"><strong>${esc(r.code)} · ${esc(r.name)}</strong><small>${esc(r.type)}${r.sector?' · '+esc(r.sector):''}${r.location?' · '+esc(r.location):''}</small><span class="is-${esc(r.status)}">${status(r.status)}</span></button>${actions}<button type="button" class="aurora-asset-card__more" data-asset-open="${esc(r.id)}">›</button></article>`;
   }).join(''):`<div class="aurora-assets-empty"><strong>Nenhum ${esc(ctx.singular)} cadastrado.</strong><span>Cadastre o primeiro item deste ambiente.</span></div>`;
   panel.querySelectorAll('[data-asset-open]').forEach(b=>b.onclick=async()=>{const r=rows.find(x=>x.id===b.dataset.assetOpen);if(!r)return;try{await cloudUpsert(r);save(all)}catch(e){console.warn('Aurora Ativos: item ainda não sincronizado.',e)}showDetail(r)});
   panel.querySelectorAll('[data-asset-registry-edit]').forEach(b=>b.onclick=e=>{e.stopPropagation();const r=rows.find(x=>x.id===b.dataset.assetRegistryEdit);if(r)showEditor(r)});
   panel.querySelectorAll('[data-asset-registry-delete]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const r=rows.find(x=>x.id===b.dataset.assetRegistryDelete);if(!r||!assetPerms.can_deactivate)return;if(!confirm(`Excluir este ${ctx.singular} do cadastro?\n\nOs atendimentos e relatórios já realizados não serão apagados.`))return;try{const c=cloud();if(r.cloud_id&&c){const result=await c.rpc('aurora_asset_delete',{p_asset_id:r.cloud_id});if(result.error)throw result.error}const next=load().filter(x=>String(x.id)!==String(r.id));save(next);render()}catch(err){console.error('Aurora Ativos: exclusão do cadastro indisponível.',err);alert('Não foi possível excluir este cadastro agora.')}});
 }
 function showPanel(){normal().forEach(n=>n.hidden=true);detail.hidden=true;editor.hidden=true;modal.hidden=true;panel.hidden=false;render();scrollTo(0,0)}
 function showHome(){panel.hidden=true;detail.hidden=true;editor.hidden=true;modal.hidden=true;helpModal.hidden=true;normal().forEach(n=>{n.hidden=homeVisibility.get(n)===true});scrollTo(0,0)}
 function showEditor(r){panel.hidden=true;detail.hidden=true;normal().forEach(n=>n.hidden=true);editor.hidden=false;const f=editor.querySelector('form');f.reset();f.id.value=r?.id||'';['code','name','type','status','unit','sector','location','notes'].forEach(k=>{if(r)f.elements[k].value=r[k]||''});editor.querySelector('[data-assets-editor-title]').textContent=r?`Editar ${ctx.singular}`:`Novo ${ctx.singular}`;const box=editor.querySelector('[data-asset-qr-image]'),help=editor.querySelector('[data-asset-qr-help]'),pr=editor.querySelector('[data-asset-print-qr]'),qc=editor.querySelector('[data-asset-qr]');if(r?.qr_token){box.innerHTML=qrSvg(qrPayload(r))||'▦';help.textContent='Toque aqui para visualizar o QR. A etiqueta pode ser impressa em 80 × 80 mm.';pr.hidden=false;pr.onclick=e=>{e.stopPropagation();printLabel(r)};qc.onclick=()=>openQr(r)}else{box.textContent='▦';help.textContent='O QR será gerado automaticamente após salvar o ativo.';pr.hidden=true;qc.onclick=null}scrollTo(0,0)}
 const showHelp=e=>{if(e){e.preventDefault();e.stopPropagation()}helpModal.hidden=false};const closeHelp=()=>{helpModal.hidden=true};card.querySelectorAll('[data-assets-info]').forEach(i=>{i.onclick=showHelp;i.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){showHelp(e)}}});helpModal.querySelector('[data-assets-help-close]').onclick=closeHelp;helpModal.onclick=e=>{if(e.target===helpModal)closeHelp()};
 card.onclick=showPanel;panel.querySelector('[data-assets-back]').onclick=showHome;
 detail.querySelector('[data-assets-detail-back]').onclick=showPanel;
 detail.querySelector('[data-assets-detail-edit]').onclick=()=>detailCurrent&&showEditor(detailCurrent);
 detail.querySelector('[data-assets-detail-qr]').onclick=()=>detailCurrent&&openQr(detailCurrent);
 detail.querySelector('[data-assets-detail-public-preview]').onclick=()=>{
   if(!detailCurrent||!detailCurrent.qr_token)return;
   const u=new URL(qrPayload(detailCurrent));
   u.searchParams.set('aurora_asset_preview','1');
   global.open(u.toString(),'_blank','noopener');
 };
 detail.querySelector('[data-assets-detail-delete]').onclick=async()=>{
   const r=detailCurrent;
   if(!r||!assetPerms.can_deactivate)return;
   if(!confirm(`Excluir este ${ctx.singular} do cadastro?\n\nOs atendimentos e relatórios já realizados não serão apagados.`))return;
   try{
     const c=cloud();
     if(r.cloud_id&&c){
       const result=await c.rpc('aurora_asset_delete',{p_asset_id:r.cloud_id});
       if(result.error)throw result.error;
     }
     const next=load().filter(x=>String(x.id)!==String(r.id));
     save(next);
     detailCurrent=null;
     showPanel();
   }catch(err){
     console.error('Aurora Ativos: exclusão do cadastro indisponível.',err);
     alert('Não foi possível excluir este cadastro agora.');
   }
 };

 detail.querySelector('[data-assets-new-inspection]').onclick=async()=>{
   if(!detailCurrent)return;
   const selected=detailCurrent;
   const hist=await assetHistory(selected);
   const previous=hist[0]||null;
   const reusable={
     asset_registry_id:selected.id||'',
     qr_token:selected.qr_token||'',
     code:selected.code||'',
     name:selected.name||'',
     type:selected.type||'',
     status:selected.status||'active',
     unit:selected.unit||'',
     sector:selected.sector||'',
     location:selected.location||'',
     notes:selected.notes||'',
     previous_customer:previous&&previous.customer?previous.customer:null,
     previous_asset:previous&&previous.asset?previous.asset:null,
     origin:'asset_detail',
     selected_at:new Date().toISOString()
   };
   try{
     sessionStorage.setItem('aurora_asset_registry_selected_v1',JSON.stringify(reusable));
     sessionStorage.setItem('aurora_asset_workflow_origin_v1',JSON.stringify({asset_id:selected.id||'',at:new Date().toISOString()}));
   }catch(e){}
   /* V33 — Nova vistoria a partir do ativo NÃO escolhe o serviço pelo usuário.
    * Volta à Home operacional e mantém o ativo pendente até a pessoa tocar no
    * tipo de trabalho desejado (Painel, Aterramento, Termografia etc.). */
   showHome();
   try{
     const grid=h.querySelector('[data-operational-service-grid]');
     if(grid&&typeof grid.scrollIntoView==='function')grid.scrollIntoView({block:'start',behavior:'smooth'});
   }catch(_){}
 };
panel.querySelector('[data-assets-new]').onclick=()=>showEditor(null);panel.querySelector('[data-assets-search]').oninput=render;editor.querySelector('[data-assets-editor-back]').onclick=()=>{const id=editor.querySelector('form').id.value;if(id&&detailCurrent)showDetail(detailCurrent);else showPanel()};
 editor.querySelector('[data-assets-cancel]').onclick=()=>{const id=editor.querySelector('form').id.value;if(id&&detailCurrent)showDetail(detailCurrent);else showPanel()};modal.querySelector('[data-qr-modal-close]').onclick=closeQr;modal.querySelector('[data-qr-modal-print]').onclick=()=>current&&printLabel(current);modal.onclick=e=>{if(e.target===modal)closeQr()};
 editor.querySelector('[data-assets-form]').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,row=Object.fromEntries(new FormData(f).entries()),rows=load(),submit=f.querySelector('[type=submit]');if(submit)submit.disabled=true;row.module_code=ctx.profile;row.service_code=row.service_code||'registry';try{let saved;if(row.id){const old=rows.find(x=>x.id===row.id)||{};saved={...old,...row,updated_at:new Date().toISOString()};await cloudUpsert(saved);const next=rows.map(x=>x.id===row.id?saved:x);save(next)}else{row.id=uid();row.created_at=new Date().toISOString();saved=row;await cloudUpsert(saved);if(!saved.qr_token)saved.qr_token=token();rows.unshift(saved);save(rows)}if(row.id)showDetail(saved);else showEditor(saved)}catch(err){console.error(err);alert('Não foi possível registrar este ativo na nuvem. Confira a conexão e tente novamente.')}finally{if(submit)submit.disabled=false}};
 ui={home:h,profile:ctx.profile,panel,detail,editor,modal,helpModal,showPanel,showHome,showDetail,closeIfOpen(){if(!helpModal.hidden){closeHelp();return true}if(!modal.hidden){closeQr();return true}if(!editor.hidden){if(detailCurrent)showDetail(detailCurrent);else showPanel();return true}if(!detail.hidden){showPanel();return true}if(!panel.hidden){showHome();return true}return false}};return true;
}
function openAsset(id){
 if(!ensure())return false;
 const r=contextRows(load()).find(x=>String(x.id)===String(id));
 if(!r){ui.showPanel();return false}
 ui.showDetail(r);
 return true;
}
function open(){if(!ensure())return false;ui.showPanel();setTimeout(async()=>{await loadPermissions();if(!assetPerms.can_view){ui.showHome();alert(`O administrador não liberou o acesso a ${currentContext().title} para este usuário.`);return}await cloudLoadAssets();if(ui&&ui.panel&&!ui.panel.hidden)ui.showPanel()},0);return true}
function closeIfOpen(){return ui&&ui.closeIfOpen?ui.closeIfOpen():false}
function cleanAssetLabel(value){
 const raw=String(value??'').trim().replace(/\s+/g,' ');
 return raw
   .replace(/^(?:equipamento|ativo|painel(?:\s+el[eé]trico)?|ve[ií]culo|estofado|estrutura|local|cortina|persiana|área)\s*[-–—:·]?\s*/i,'')
   .trim();
}
function assetDisplayParts(row){
 const rawCode=String(row?.code??'').trim();
 const rawName=String(row?.name??'').trim();
 let code=cleanAssetLabel(rawCode)||rawCode||'Equipamento';
 let name=cleanAssetLabel(rawName)||rawName||'';
 if(name && code && name.toLocaleLowerCase('pt-BR')===code.toLocaleLowerCase('pt-BR')) name='';
 return {code,name};
}
async function openForReport(report){
 if(!report)return false;
 const service=report.service||{}, profile=String(service.profile||report.profile_id||'').toLowerCase();
 const sid=String(service.id||service.service_id||'').toLowerCase();
 const normalizedProfile=profile==='eletrica'?'electrical':profile;
 if(!CATALOGS[normalizedProfile] || sid==='vehicle_inspection' || sid==='eletrica_tupy'){
   alert('A identificação permanente não está disponível para este serviço nesta rodada.');
   return false;
 }
 const asset=report.asset||{}, customer=report.customer||{};
 const moduleCode=normalizedProfile;
 const serviceCode=sid||String(report.service_id||'').toLowerCase()||'panel';
 const clean=v=>String(v??'').trim();
 const rawCode=clean(((moduleCode==='workshop'||moduleCode==='car_wash')&&asset.plate)||asset.tag||asset.code||asset.identification||asset.name);
 const reportCtx=CATALOGS[moduleCode]||CATALOGS.electrical;
 const rawName=clean(asset.identification||asset.name||asset.asset_name||asset.tag||reportCtx.singular);
 const code=cleanAssetLabel(rawCode)||rawCode;
 const name=cleanAssetLabel(rawName)||rawName;
 const rows=load();
 const norm=v=>clean(v).toLocaleLowerCase('pt-BR');
 let row=rows.find(x=>String(x.module_code||'electrical').toLowerCase()===moduleCode && (
   (code&&[x.code,x.name,x.id].some(v=>norm(v)===norm(code))) ||
   (name&&[x.name,x.code].some(v=>norm(v)===norm(name)))
 ));
 if(!row){
   const ok=confirm('Este atendimento ainda não possui identificação permanente.\n\nDeseja cadastrar este item e gerar uma etiqueta QR permanente?');
   if(!ok)return false;
   row={
     id:uid(),
     code:code||('EQ-'+String(report.id||Date.now()).replace(/[^a-z0-9]/gi,'').slice(-8).toUpperCase()),
     name:name||reportCtx.singular,
     type:clean(asset.asset_type)||reportCtx.types[0],
     status:'active',
     unit:clean(customer.name||customer.company_name||customer.company||''),
     sector:clean(asset.sector||''),
     location:clean(asset.location||asset.internal_location||''),
     notes:clean(asset.notes||''),
     module_code:moduleCode,
     service_code:serviceCode,
     created_at:new Date().toISOString(),
     source_report_id:String(report.id||'')
   };
   try{
     await cloudUpsert(row);
     if(!row.qr_token)row.qr_token=token();
     rows.unshift(row);save(rows);
   }catch(err){
     console.error('Aurora Assets: falha ao identificar equipamento pelo relatório.',err);
     const message=String(err&&err.message||err||'');
     if(message.includes('AURORA_ASSET_CREATE_FORBIDDEN'))alert('O administrador não liberou novos cadastros para este usuário.');
     else if(message.includes('AURORA_ASSET_EDIT_FORBIDDEN'))alert('O administrador não liberou a edição deste cadastro para este usuário.');
     else alert('Não foi possível identificar este cadastro na nuvem. Confira a conexão e tente novamente.');
     return false;
   }
 }else{
   try{await cloudUpsert(row);save(rows)}catch(err){console.warn('Aurora Assets: sincronização pendente.',err)}
 }
 if(!row.qr_token){
   alert('Não foi possível preparar a etiqueta QR deste cadastro.');
   return false;
 }
 if(!ensure())return false;
 const m=ui&&ui.home&&ui.home.querySelector('[data-asset-qr-modal]');
 if(!m)return false;
 if(m.parentElement!==document.body)document.body.appendChild(m);
 m.style.setProperty('position','fixed','important');
 m.style.setProperty('inset','0','important');
 m.style.setProperty('z-index','2147483646','important');
 m.setAttribute('data-aurora-top-overlay','asset-qr');
 let current=row;
 const display=assetDisplayParts(row);
 m.querySelector('[data-qr-modal-title]').textContent=display.name ? (display.code+' · '+display.name) : display.code;
 m.querySelector('[data-qr-modal-subtitle]').textContent='Identificação permanente por QR Code';
 m.querySelector('[data-qr-modal-image]').innerHTML=qrSvg(qrPayload(row));
 const close=m.querySelector('[data-qr-modal-close]');
 const share=m.querySelector('[data-qr-modal-share]');
 const print=m.querySelector('[data-qr-modal-print]');
 if(close)close.onclick=()=>{m.hidden=true};
 if(share)share.onclick=()=>shareQr(current);
 if(print)print.onclick=()=>printLabel(current);
 m.hidden=false;
 return true;
}
async function openByQrToken(qrToken){if(!qrToken||!ensure())return false;await loadPermissions();if(!assetPerms.can_view)return false;const rows=await cloudLoadAssets();const r=rows.find(x=>String(x.qr_token||'')===String(qrToken));if(!r)return false;/* V61 — após bootstrap e hidratação completos, abre o ativo pelo MESMO caminho público já usado pelo catálogo. openAsset() resolve o registro no contexto atual e delega à showDetail(), preservando histórico e permissões existentes. */return openAsset(r.id)}
global.AuroraAssetsPilot={sync:function(){return true},open,openAsset,closeIfOpen,openForReport,printLabel,openByQrToken};
document.addEventListener('click',e=>{
 const homeBtn=e.target.closest&&e.target.closest('[data-footer-home]');
 if(!homeBtn||!ui)return;
 const assetView=!ui.panel.hidden||!ui.detail.hidden||!ui.editor.hidden||!ui.modal.hidden||!ui.helpModal.hidden;
 const homeVisible=!ui.home.hidden&&(!global.getComputedStyle||global.getComputedStyle(ui.home).display!=='none');
 if(!assetView&&!homeVisible)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(assetView)ui.showHome();
 try{sessionStorage.removeItem('aurora_asset_workflow_origin_v1')}catch(_){}
},true);
document.addEventListener('click',e=>{
 const info=e.target.closest&&e.target.closest('[data-assets-info]');
 const b=e.target.closest&&e.target.closest('[data-open-assets]');
 if(!catalogHome())return;
 if(info){
   e.preventDefault();e.stopImmediatePropagation();
   if(!ensure())return;
   const m=ui&&ui.home&&ui.home.querySelector('[data-assets-help-modal]');
   if(m)m.hidden=false;
   return;
 }
 if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();
 // Entrada única: passa pelo mesmo gate autenticado usado pelo restante do módulo.
 // Não abrir o painel diretamente com assetPerms ainda no estado inicial.
 if(!open())return;
 setTimeout(()=>syncLocalToCloud().then(()=>{if(ui&&ui.panel&&!ui.panel.hidden)ui.showPanel()}).catch(()=>{}),0);
},true);

async function consumeQrRoute(){
 try{
  const u=new URL(location.href),t=u.searchParams.get('aurora_asset_open'),target=String(u.searchParams.get('aurora_asset_module')||'').trim();
  if(!t)return;

  /* V61 — QR não participa do bootstrap. Só executa depois
   * da Home operacional existir. A troca de ambiente replica o mecanismo já
   * aprovado de Perfil > Trocar segmento: identidade local + activate + 1 reload. */
  const run=async()=>{
   try{
    const ready=global.__AURORA_OPERATIONAL_READY__;
    if(!ready)return;
    const current=String((ready&&ready.profile)||currentContext().profile||'').trim();
    if(target&&target!==current){
     const guardKey='aurora_qr_operational_reload_v61';
     const signature=target+'|'+t;
     const guard=String(sessionStorage.getItem(guardKey)||'');
     if(guard===signature){
      console.warn('Aurora QR: ambiente não aplicado após reload operacional único.',{target,current});
      return;
     }
     let identity={};
     try{identity=JSON.parse(localStorage.getItem('aurora_company_identity_rc1_5')||'{}')||{}}catch(_){identity={}}
     const map=identity&&identity.selected_services_by_module;
     const services=(map&&Array.isArray(map[target]))?map[target].map(String).filter(Boolean):[];
     if(!services.length){console.warn('Aurora QR: ambiente autorizado sem serviços operacionais locais.',{target});return}
     const next={...identity,profile:target,selected_services:services};
     localStorage.setItem('aurora_company_identity_rc1_5',JSON.stringify(next));
     if(global.AuroraModuleAccess&&typeof global.AuroraModuleAccess.activate==='function')global.AuroraModuleAccess.activate(target);
     sessionStorage.setItem(guardKey,signature);
     location.reload();
     return;
    }
    let tries=0;
    const go=async()=>{tries++;if(await openByQrToken(t)){
      try{sessionStorage.removeItem('aurora_qr_operational_reload_v61')}catch(_){}
      u.searchParams.delete('aurora_asset_open');u.searchParams.delete('aurora_asset_module');
      history.replaceState({},'',u.pathname+(u.searchParams.toString()?'?'+u.searchParams.toString():''));return;
     }if(tries<30)setTimeout(go,300)};
    setTimeout(go,100);
   }catch(e){console.warn('Aurora QR: falha na entrega pós-Home.',e)}
  };
  if(global.__AURORA_OPERATIONAL_READY__)run();
  else global.addEventListener('AuroraOperationalReady',run,{once:true});
 }catch(_){ }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',consumeQrRoute,{once:true});else consumeQrRoute();
})(window);

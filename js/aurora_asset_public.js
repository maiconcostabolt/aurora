(function(global){
'use strict';
const params=new URLSearchParams(global.location.search);const token=(params.get('aurora_asset')||'').trim();const forcePublicPreview=params.get('aurora_asset_preview')==='1';if(!token)return;
global.__AURORA_PUBLIC_ASSET_PAGE__=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const status=v=>v==='maintenance'?'Em manutenção':v==='inactive'?'Desativado':'Ativo';
function shell(body){document.documentElement.classList.add('aurora-public-asset-mode');let root=document.getElementById('aurora-public-asset');if(!root){root=document.createElement('main');root.id='aurora-public-asset';document.body.appendChild(root)}root.innerHTML=body;}
function loading(){shell('<section class="apa-card"><div class="apa-brand">AURORA</div><div class="apa-loader"></div><h1>Consultando ativo…</h1><p>Validando a identificação na Aurora.</p></section>')}
function fail(){shell('<section class="apa-card"><div class="apa-brand">AURORA</div><div class="apa-mark is-bad">!</div><h1>Ativo não encontrado</h1><p>Este QR Code não corresponde a um ativo público válido da Aurora.</p></section>')}
function publicDate(value){if(!value)return 'Nenhuma inspeção registrada';try{return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value))}catch(_){return 'Data indisponível'}}
function brandFooter(){return `<section class="apa-powered apa-powered-compact"><span>IDENTIFICAÇÃO DIGITAL FORNECIDA POR</span><strong>AURORA</strong><small>Inspeções, manutenção e histórico digital de ativos.</small></section>`}
function infoRows(rows){const clean=rows.filter(x=>String(x[1]??'').trim());if(!clean.length)return '';return `<dl>${clean.map(x=>`<div><dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd></div>`).join('')}</dl>`;}
function lastInspection(a){
 const count=Math.max(0,Number(a.inspection_count)||0);
 if(!count)return '<section class="apa-service"><h2>Última inspeção</h2><p class="apa-service-empty">Nenhuma inspeção concluída vinculada a este ativo.</p></section>';
 return `<section class="apa-service"><h2>Última inspeção</h2>${infoRows([
  ['Data',publicDate(a.last_inspection_at)],
  ['Status',a.last_inspection_status||'Concluída'],
  ['Condição encontrada',a.inspection_condition],
  ['Objetivo',a.inspection_objective],
  ['Responsável pelo acompanhamento',a.inspection_responsible]
 ])}</section>`;
}
function inspectionSummary(a){
 const rows=[['Diagnóstico técnico',a.diagnostic_summary],['Recomendação',a.recommendation]];
 if(!rows.some(x=>String(x[1]||'').trim()))return '';
 return `<section class="apa-service"><h2>Resumo da última inspeção</h2>${infoRows(rows)}</section>`;
}
function historySummary(a){
 const count=Math.max(0,Number(a.inspection_count)||0),next=a.next_inspection_at?publicDate(a.next_inspection_at):'Não programada';
 return `<section class="apa-service"><h2>Histórico do equipamento</h2>${infoRows([
  ['Última inspeção',count?publicDate(a.last_inspection_at):'Nenhuma inspeção registrada'],
  ['Inspeções registradas',String(count)],
  ['Próxima inspeção',next]
 ])}</section>`;
}
function workPlan(items){if(!Array.isArray(items)||!items.length)return '';const clean=items.filter(x=>x&&String(x.text||'').trim());if(!clean.length)return '';return `<section class="apa-service apa-work-plan"><h2>Trabalhos a realizar</h2><div class="apa-work-items">${clean.map(x=>`<div><b>${x.done?'☑':'☐'}</b><span>${esc(x.text)}</span></div>`).join('')}</div></section>`;}
function show(a,workItems){
 const identityRows=[
  ['Tipo',a.asset_type],
  ['Cliente / local',a.customer_name],
  ['Status do ativo',status(a.status)],
  ['Empresa responsável',a.company_name]
 ];
 shell(`<section class="apa-card"><div class="apa-brand">AURORA</div><div class="apa-mark">✓</div><span class="apa-kicker">IDENTIFICAÇÃO DIGITAL DO EQUIPAMENTO</span><h1>${esc(a.code)}${a.name?` · ${esc(a.name)}`:''}</h1><section class="apa-identity">${infoRows(identityRows)}</section>${lastInspection(a)}${workPlan(workItems)}${inspectionSummary(a)}${historySummary(a)}${brandFooter()}<footer>Consulta pública somente leitura · detalhes restritos à equipe autorizada</footer></section>`);
}
async function publicWorkItems(cfg){try{const r=await fetch(`${String(cfg.url).replace(/\/$/,'')}/rest/v1/rpc/aurora_asset_public_work_items`,{method:'POST',headers:{apikey:cfg.anon_key,Authorization:`Bearer ${cfg.anon_key}`,'Content-Type':'application/json'},body:JSON.stringify({p_token:token})});if(!r.ok)return [];const d=await r.json();return Array.isArray(d)?d:[]}catch(_){return []}}
async function publicGet(cfg){const r=await fetch(`${String(cfg.url).replace(/\/$/,'')}/rest/v1/rpc/aurora_asset_public_get_v2`,{method:'POST',headers:{apikey:cfg.anon_key,Authorization:`Bearer ${cfg.anon_key}`,'Content-Type':'application/json'},body:JSON.stringify({p_token:token})});if(!r.ok)throw 0;const d=await r.json();return Array.isArray(d)?d[0]:d;}
function authClient(cfg){if(global.AuroraCloudSync&&global.AuroraCloudSync.client)return global.AuroraCloudSync.client;if(global.supabase&&global.supabase.createClient)return global.supabase.createClient(cfg.url,cfg.anon_key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});return null;}
async function memberGet(cfg){try{/* QR autenticado: aguarda a autenticação canônica terminar antes de decidir que é visitante. O script público não pode competir com a restauração da sessão. */if(global.AuroraAuthReady){try{await Promise.race([global.AuroraAuthReady,new Promise(r=>setTimeout(()=>r(null),8000))])}catch(_){}}const c=authClient(cfg);if(!c)return null;let session=null;for(let i=0;i<20&&!session;i++){const s=await c.auth.getSession();session=s&&s.data&&s.data.session;if(!session)await new Promise(r=>setTimeout(r,250))}if(!session)return null;const q=await c.rpc('aurora_asset_member_context_v2',{p_token:token});if(q&&q.error)return null;const x=Array.isArray(q&&q.data)?q.data[0]:q&&q.data;if(!x||x.can_view===false)return null;return {can_view:true,asset_id:x.asset_id||'',module_code:x.module_code||''};}catch(e){console.warn('Aurora QR: sessão não pôde ser validada.',e);return null}}
function internalUrl(moduleCode){const u=new URL(location.href);u.searchParams.delete('aurora_asset');u.searchParams.set('aurora_asset_open',token);if(moduleCode)u.searchParams.set('aurora_asset_module',moduleCode);return u.pathname+u.search;}
function remember(assetId){try{sessionStorage.setItem('aurora_asset_qr_pending_v1',JSON.stringify({token:token,asset_id:assetId||'',at:new Date().toISOString()}))}catch(_){}}
function openApp(){remember('');location.href=internalUrl();}
async function run(){loading();try{const cfg=global.AURORA_CLOUD_CONFIG;if(!cfg||!cfg.url||!cfg.anon_key)throw 0;const a=await publicGet(cfg);if(!a)return fail();/* Aguarda o bootstrap carregar o cliente canônico da Aurora. */if(!global.AuroraCloudSync)await new Promise(r=>setTimeout(r,250));const m=forcePublicPreview?null:await memberGet(cfg);if(m&&m.can_view!==false){remember(m.asset_id);location.replace(internalUrl(m.module_code));return}const workItems=await publicWorkItems(cfg);show(a,workItems)}catch(_){fail()}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})(window);

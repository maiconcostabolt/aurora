(function (global) {
"use strict";
/* AURORA V176 — roteador universal da Aurora AI.
 * A Aurora e o container; cada profile e tratado como um aplicativo interno.
 * A IA pode sair de qualquer aplicativo e abrir qualquer servico autorizado.
 * Esta camada NAO altera bootstrap/auth/cloud_sync/service_worker/offline. */
const IDENTITY_KEY = "aurora_company_identity_rc1_5";
const PENDING_KEY = "aurora_ai_universal_pending_v2";
const ROUTE_MAX_AGE = 120000;
let segments = [];
let original = null;


const SPEECH_HINTS=Object.freeze({
 panel:["painel elétrico","painel","quadro elétrico","quadro de distribuição","vistoria de painel","inspeção de painel","disjuntores","componentes elétricos"],
 thermography:["termografia","inspeção termográfica","câmera térmica","ponto quente","aquecimento no painel","temperatura de painel"],
 installation:["instalação elétrica","manutenção elétrica","instalação","tomada","circuito","fiação","cabos","reforma elétrica"],
 electric_motor:["motor elétrico","motor industrial","isolamento de motor","vibração de motor"],grounding:["aterramento","malha de terra","continuidade","equipotencialização"],
 vehicle_inspection:["vistoria veicular","vistoria de veículo","vistoria de carro","inspeção veicular","avaliar carro","carro antes da compra"],
 suspension:["suspensão","amortecedor","trocar amortecedor","amortecedor dianteiro","amortecedor traseiro","mola do carro"],engine:["motor do carro","motor automotivo","falha no motor"],brakes:["freio","freios","pastilha de freio","disco de freio"],vehicle_electrical:["elétrica automotiva","parte elétrica do carro","bateria","alternador"],air_conditioning:["ar condicionado do carro","ar-condicionado automotivo"],
 sofa_cleaning:["sofá","limpeza de sofá","higienização de sofá","higienizar sofá","higienizar o sofá","limpar sofá","limpar o sofá","lavar sofá","lavar o sofá","lavagem de sofá","estofado"],mattress_cleaning:["colchão","limpeza de colchão","higienização de colchão"],armchair_cleaning:["poltrona","limpeza de poltrona"],chair_cleaning:["cadeira","cadeiras","limpeza de cadeira"],auto_upholstery:["banco automotivo","banco de carro","estofado automotivo"],carpet_cleaning:["tapete","carpete","limpeza de tapete"],
 small_repairs:["pequenos reparos","reparo","conserto"],masonry:["alvenaria","parede","reboco"],painting:["pintura","pintar banheiro","refazer pintura","pintura de parede"],flooring:["piso","revestimento","trocar piso","azulejo"],minor_renovation:["pequena reforma","reforma","reforma de banheiro","reforma de cozinha"],general_maintenance:["manutenção geral","manutenção predial"],
 common_areas:["área comum","escada do condomínio","corredor do condomínio","vistoria nas escadas"],electrical_system:["sistema elétrico do condomínio","quadro do condomínio"],hydraulic_system:["hidráulica do condomínio","vazamento","tubulação de água"],pump_room:["bomba","casa de máquinas","bomba d'água"],elevators:["elevador","elevadores"],fire_safety:["extintor","extintores","incêndio","sistema de incêndio","vistoria nos extintores"],facade_roof:["fachada do condomínio","cobertura do condomínio","telhado do condomínio"],garage:["garagem","estacionamento do condomínio"],access_gates:["portão","portaria","controle de acesso"],leisure_area:["piscina","área de lazer"],maintenance_occurrences:["ocorrência no condomínio","manutenção do condomínio"],
 roof:["telhado","drone no telhado","inspeção de telhado"],facade:["fachada","drone na fachada","inspeção de fachada"],tower:["torre","inspeção de torre"],solar:["usina solar","placa solar","painel solar","inspeção solar"],
 machine:["máquina","inspeção de máquina"],pipeline:["tubulação industrial","pipeline"],structure:["estrutura industrial","estrutura metálica"],tank:["tanque","reservatório industrial"],
 basic_wash:["lavação simples","lavar carro"],complete_wash:["lavação completa","lavagem completa do carro"],technical_wash:["lavação técnica"],interior_detailing:["higienização interna do carro","limpeza interna do carro"],polishing:["polimento","polir carro"],paint_protection:["proteção da pintura","proteção de pintura"],
 curtain_installation:["instalar cortina","instalação de cortina"],blind_installation:["instalar persiana","instalação de persiana"],curtain_maintenance:["manutenção de cortina","consertar cortina"],blind_maintenance:["manutenção de persiana","consertar persiana"],motorized_system:["cortina motorizada","persiana motorizada","sistema motorizado"],track_and_rod:["trilho","varão","trilho de cortina"]
});

function semanticNorm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();}
function candidateScores(text,routes){
 const q=semanticNorm(text);if(!q)return [];
 const words=new Set(q.split(" ").filter(x=>x.length>2));const out=[];
 for(const r of (Array.isArray(routes)?routes:[])){
   let score=0;const hints=Array.isArray(r.speech_hints)?r.speech_hints:[];
   for(const raw of hints){const h=semanticNorm(raw);if(!h)continue;if(q===h)score=Math.max(score,100);else if(q.includes(h)||h.includes(q))score=Math.max(score,82);else{const hw=h.split(" ").filter(x=>x.length>2),hit=hw.filter(x=>words.has(x)).length;if(hit)score=Math.max(score,Math.round(60*hit/Math.max(1,hw.length)));}}
   const id=String(r.id||"");
   if(id==="sofa_cleaning"&&/\bsofa\b/.test(q)&&/(higien|limp|lav)/.test(q))score=Math.max(score,99);
   if(id==="mattress_cleaning"&&/\bcolchao\b/.test(q)&&/(higien|limp|lav)/.test(q))score=Math.max(score,98);
   if(id==="vehicle_inspection"&&/(vistori|inspec|avali)/.test(q)&&/(veiculo|carro|automovel)/.test(q))score=Math.max(score,98);
   if(id==="suspension"&&/(amortec|suspens|mola)/.test(q)&&/(carro|veiculo|automovel|amortec|suspens)/.test(q))score=Math.max(score,99);
   if(id==="thermography"&&/(termograf|camera termica|ponto quente)/.test(q))score=Math.max(score,98);
   if(id==="panel"&&/(vistori|inspec)/.test(q)&&/(painel eletrico|quadro eletrico)/.test(q))score=Math.max(score,98);
   if(id==="minor_renovation"&&/(reform)/.test(q)&&/(banheiro|cozinha|comodo)/.test(q))score=Math.max(score,98);
   if(score>=28)out.push({route:r,score});
 }
 return out.sort((a,b)=>b.score-a.score||String(a.route.title).localeCompare(String(b.route.title))).slice(0,8);
}
function deterministicResolve(text,routes){
 const ranked=candidateScores(text,routes);if(!ranked.length)return null;const best=ranked[0],second=ranked[1]?ranked[1].score:0;return best.score>=75&&best.score-second>=8?best:null;
}
function speechHints(id,title){const a=(SPEECH_HINTS[String(id||"")]||[]).slice();const t=String(title||"").trim();if(t&&!a.some(x=>norm(x)===norm(t)))a.unshift(t);return a;}
function readIdentity(){try{return JSON.parse(localStorage.getItem(IDENTITY_KEY)||"null")||{};}catch(_){return {};}}
function writeIdentity(value){try{localStorage.setItem(IDENTITY_KEY,JSON.stringify(value));return true;}catch(_){return false;}}
function norm(v){return String(v||"").trim().toLowerCase();}
function profileSegment(profile){const p=norm(profile);return segments.find(s=>norm(s&&s.id)===p)||null;}
function serviceMeta(profile,id){const seg=profileSegment(profile);if(!seg)return null;return (Array.isArray(seg.services)?seg.services:[]).find(x=>String(x&&x.id||"")===String(id||""))||null;}

/* Fonte unica para a IA: somente servicos que ja constam como selecionados/autorizados
 * na identidade local da conta. Nenhum servico e inventado ou liberado por esta camada. */
function authorizedRoutes(){
 const identity=readIdentity(), current=norm(identity.profile), map=identity.selected_services_by_module||{}, routes=[], seen=new Set();
 function add(profile,id){
   profile=norm(profile);id=String(id||"").trim();if(!profile||!id)return;
   const seg=profileSegment(profile),svc=serviceMeta(profile,id);if(!seg||!svc)return;
   /* Atividades Rotineiras e um aplicativo proprio dentro do ambiente empresarial;
    * nao e um servico comum da grade Eletrica e nao deve ser misturado aos 6 servicos. */
   if(id==="eletrica_tupy")return;
   const key=profile+"::"+id;if(seen.has(key))return;seen.add(key);
   routes.push({id,profile,service_title:String(svc.title||id),app_title:String(seg.title||profile),description:String(svc.description||seg.description||""),icon:String(svc.icon||seg.icon||""),title:String(seg.title||profile)+" — "+String(svc.title||id),speech_hints:speechHints(id,svc.title||id)});
 }
 Object.keys(map).forEach(profile=>(Array.isArray(map[profile])?map[profile]:[]).forEach(id=>add(profile,id)));
 /* Compatibilidade com contas antigas: os servicos do profile atual podem estar apenas
  * em selected_services. Isso nao amplia permissao para outros profiles. */
 (Array.isArray(identity.selected_services)?identity.selected_services:[]).forEach(id=>add(current,id));
 return routes;
}

function activeApplication(identity){
 const license=norm(identity.active_license_module_code),profile=norm(identity.profile);
 if(license==="eletrica_tupy")return "eletrica_tupy";
 return license||profile;
}
function targetServices(identity,target){
 const map=identity.selected_services_by_module||{};
 return Array.isArray(map[target])?map[target].map(String):[];
}
function routeAuthorized(target,serviceId){
 return authorizedRoutes().some(r=>r.profile===target&&String(r.id)===String(serviceId||""));
}
function savePending(target,serviceId,customer,fromApp){
 try{sessionStorage.setItem(PENDING_KEY,JSON.stringify({profile:target,service_code:String(serviceId||""),customer:customer&&typeof customer==="object"?customer:{name:String(customer||"").trim()},at:Date.now(),from_app:fromApp}));return true;}catch(_){return false;}
}
function switchApplication(target,serviceId,customer){
 const identity=readIdentity(),fromApp=activeApplication(identity);
 if(!routeAuthorized(target,serviceId))return false;
 const services=targetServices(identity,target);
 /* Se a conta usa o formato legado e o servico autorizado esta somente no profile atual,
  * preserve selected_services sem fabricar uma lista para outro aplicativo. */
 const selected=services.length?services:(norm(identity.profile)===target&&Array.isArray(identity.selected_services)?identity.selected_services.map(String):[]);
 if(!selected.includes(String(serviceId||"")))return false;
 if(!savePending(target,serviceId,customer,fromApp))return false;
 const next=Object.assign({},identity,{profile:target,active_license_module_code:target,preferred_service:String(serviceId||""),selected_services:selected});
 if(!writeIdentity(next))return false;
 /* V183 — o clique do usuário no card é uma escolha explícita de aplicativo.
  * O bootstrap empresarial prioriza Atividades Rotineiras quando não existe esse
  * marcador; por isso a V182 voltava para Tupy mesmo após escolher Elétrica.
  * Replica aqui o mesmo marcador usado por Perfil > Trocar segmento. */
 try{
   const uid=String(global.AURORA_ACCOUNT_USER_ID||"anonymous");
   sessionStorage.setItem("aurora_explicit_module_session_v1:"+uid,target);
   if(global.AuroraModuleAccess&&typeof global.AuroraModuleAccess.activate==="function")global.AuroraModuleAccess.activate(target);
 }catch(_){ }
 window.location.reload();
 return true;
}
function install(){
 if(!global.AuroraAiHome||global.AuroraAiHome.__universalV176)return false;
 original=global.AuroraAiHome;
 const api={
   __universalV176:true,
   getContext(){
     const base=original.getContext?original.getContext():null;
     if(!base||!base.active)return base;
     const routes=authorizedRoutes();
     return routes.length?{profile:"aurora_universal",current_profile:norm(readIdentity().profile),services:routes,active:true}:base;
   },
   async start(serviceId,customerData,routeProfile){
     const identity=readIdentity(),target=norm(routeProfile),currentProfile=norm(identity.profile),activeApp=activeApplication(identity);
     if(!target)return original.start(serviceId,customerData);
     if(!routeAuthorized(target,serviceId))return false;
     /* So abre localmente quando o aplicativo renderizado E o aplicativo destino.
      * Caso contrario troca o bloco inteiro e retoma o mesmo pedido depois do reload. */
     if(target===currentProfile&&activeApp===target)return original.start(serviceId,customerData);
     return switchApplication(target,serviceId,customerData);
   }
 };
 global.AuroraAiHome=api;
 return true;
}
async function resume(){
 let p=null;try{p=JSON.parse(sessionStorage.getItem(PENDING_KEY)||"null");}catch(_){ }
 if(!p||Date.now()-Number(p.at||0)>ROUTE_MAX_AGE){try{sessionStorage.removeItem(PENDING_KEY);}catch(_){}return;}
 const identity=readIdentity();
 if(norm(identity.profile)!==norm(p.profile)||activeApplication(identity)!==norm(p.profile))return;
 if(!routeAuthorized(norm(p.profile),p.service_code)||!original||typeof original.start!=="function")return;
 try{sessionStorage.removeItem(PENDING_KEY);}catch(_){ }
 await original.start(p.service_code,p.customer);
}
function chooseSuggestion(text,candidates){
 const list=(Array.isArray(candidates)?candidates:[]).slice(0,3);
 return new Promise(resolve=>{
  const old=document.getElementById("aurora-ai-suggestion-overlay");if(old)old.remove();
  const ov=document.createElement("div");ov.id="aurora-ai-suggestion-overlay";ov.className="aurora-ai-suggestion-overlay";
  const cards=list.map((c,i)=>{const r=c.route||c;return `<button type="button" class="aurora-ai-suggestion-card" data-i="${i}"><span class="aurora-ai-suggestion-icon">${r.icon||"✦"}</span><span><strong>${r.service_title||r.title||r.id}</strong><small>${r.app_title||r.profile}${r.description?" · "+r.description:""}</small></span><b>Selecionar</b></button>`;}).join("");
  ov.innerHTML=`<div class="aurora-ai-suggestion-modal" role="dialog" aria-modal="true" aria-label="Serviços encontrados"><button class="aurora-ai-suggestion-close" type="button" aria-label="Fechar">×</button><div class="aurora-ai-suggestion-kicker">AURORA AI</div><h2>Encontrei opções para o seu pedido</h2><div class="aurora-ai-suggestion-spoken">Você disse: “${String(text||"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}”</div><div class="aurora-ai-suggestion-list">${cards||'<p class="aurora-ai-suggestion-empty">Não encontrei um serviço compatível entre os disponíveis.</p>'}</div><button type="button" class="aurora-ai-suggestion-again">🎙 Falar novamente</button></div>`;
  document.body.appendChild(ov);
  const done=v=>{ov.remove();resolve(v);};ov.querySelector(".aurora-ai-suggestion-close").onclick=()=>done(null);ov.querySelector(".aurora-ai-suggestion-again").onclick=()=>done({again:true});ov.addEventListener("click",e=>{if(e.target===ov)done(null);const b=e.target.closest&&e.target.closest(".aurora-ai-suggestion-card");if(b)done(list[Number(b.dataset.i)]||null);});
 });
}
global.AuroraAiDispatcher=Object.freeze({
 getAuthorizedRoutes:authorizedRoutes,
 resolveTranscript(text){return deterministicResolve(text,authorizedRoutes());},
 getSuggestions(text){return candidateScores(text,authorizedRoutes());},
 chooseSuggestion(text,candidates){return chooseSuggestion(text,candidates);},
 async dispatch(serviceId,customerData,routeProfile){
   if(!global.AuroraAiHome||typeof global.AuroraAiHome.start!=="function")return false;
   return global.AuroraAiHome.start(serviceId,customerData,routeProfile);
 },
 version:"V183"
});
fetch("./config/onboarding.json?v=AURORA-V176-AI-UNIVERSAL").then(r=>r.ok?r.json():null).then(c=>{segments=c&&Array.isArray(c.segments)?c.segments:[];}).catch(()=>{});
let tries=0;const timer=setInterval(()=>{tries++;if(install()){clearInterval(timer);setTimeout(resume,900);}else if(tries>40)clearInterval(timer);},100);
})(window);

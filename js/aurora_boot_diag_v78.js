(function(global){
"use strict";
const KEY="aurora_offline_boot_diag_v79";
const EVENTS="aurora_offline_boot_diag_events_v163";
const MAX=180;
function now(){return new Date().toISOString()}
function read(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(_){return {}}}
function readEvents(){try{const a=JSON.parse(localStorage.getItem(EVENTS)||"[]");return Array.isArray(a)?a:[]}catch(_){return []}}
function push(type,msg,extra){
  try{const a=readEvents();a.push({at:now(),type:String(type||"INFO"),msg:String(msg||""),extra:extra==null?"":String(extra)});while(a.length>MAX)a.shift();localStorage.setItem(EVENTS,JSON.stringify(a));}catch(_){}
  render();
}
function mark(stage,detail){
  const s=read();s.last=String(stage||"");s.detail=detail==null?"":String(detail);s.at=now();s.trail=Array.isArray(s.trail)?s.trail:[];s.trail.push(s.last);if(s.trail.length>40)s.trail=s.trail.slice(-40);
  try{localStorage.setItem(KEY,JSON.stringify(s))}catch(_){}
  push("MARK",s.last,s.detail);
}
function safe(k){try{const v=localStorage.getItem(k);return v==null?"<ausente>":("presente ("+v.length+" chars)")}catch(e){return "erro: "+e.message}}
function report(){
 const s=read(), ev=readEvents();
 const lines=[
  "AURORA DIAGNOSTICO ONLINE/OFFLINE V168", "Gerado: "+now(),
  "online(navigator): "+String(navigator.onLine),
  "visibility: "+String(document.visibilityState),
  "readyState: "+String(document.readyState),
  "url: "+location.href,
  "userAgent: "+navigator.userAgent,
  "--- ULTIMO MARCO ---", "last: "+(s.last||"<nenhum>"), "detail: "+(s.detail||""), "at: "+(s.at||""),
  "trail: "+(Array.isArray(s.trail)?s.trail.join(" > "):""),
  "--- ESTADO LOCAL (somente presenca/tamanho; sem expor token) ---",
  "license ticket: "+safe("aurora_license_ticket_v1"),
  "selected services: "+safe("aurora_selected_services"),
  "current service: "+safe("aurora_current_service"),
  "--- SERVICE WORKER ---",
  "controller: "+(navigator.serviceWorker&&navigator.serviceWorker.controller ? (navigator.serviceWorker.controller.scriptURL||"sim") : "nao"),
  "--- EVENTOS ---"
 ];
 ev.forEach((e,i)=>lines.push(String(i+1).padStart(3,"0")+" | "+e.at+" | "+e.type+" | "+e.msg+(e.extra?" | "+e.extra:"")));
 lines.push("--- REGRA DESTA RODADA ---","BASE: V156","AREA PROIBIDA PARA CORRECAO: bootstrap/auth/cold-start","OBJETIVO V168: diagnostico permanente + troca de ambiente offline por snapshot autorizado");
 return lines.join("\n");
}
function copyReport(){const t=report(); if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(()=>flash("COPIADO ✓"),()=>fallback(t));}else fallback(t)}
function fallback(t){try{const x=document.createElement("textarea");x.value=t;x.style.position="fixed";x.style.opacity="0";document.body.appendChild(x);x.select();document.execCommand("copy");x.remove();flash("COPIADO ✓");}catch(_){flash("FALHA AO COPIAR")}}
function flash(t){const b=document.getElementById("auroraDiagCopy");if(!b)return;const old=b.textContent;b.textContent=t;setTimeout(()=>b.textContent=old,1600)}
function render(){
 if(!document.body||document.getElementById("auroraDiagV163"))return;
 const box=document.createElement("div");box.id="auroraDiagV163";box.innerHTML='<div id="auroraDiagHead"><b>DIAG AURORA</b><span id="auroraDiagMini">−</span></div><div id="auroraDiagBody"><div id="auroraDiagLast">Inicializando…</div><button id="auroraDiagCopy" type="button">COPIAR DIAGNÓSTICO</button><button id="auroraDiagClear" type="button">LIMPAR LOG</button><small>Arraste pelo topo • toque − para minimizar</small></div>';
 Object.assign(box.style,{position:"fixed",right:"10px",top:"90px",zIndex:"2147483647",width:"260px",background:"#071b2d",border:"1px solid #28c7c7",borderRadius:"14px",boxShadow:"0 8px 30px rgba(0,0,0,.45)",color:"white",fontFamily:"Arial,sans-serif",fontSize:"12px",touchAction:"none"});
 box.hidden=true;box.setAttribute("aria-hidden","true");box.style.display="none";document.body.appendChild(box);
 const head=box.querySelector("#auroraDiagHead"),body=box.querySelector("#auroraDiagBody"),mini=box.querySelector("#auroraDiagMini");
 Object.assign(head.style,{padding:"10px 12px",cursor:"move",display:"flex",justifyContent:"space-between",alignItems:"center"});
 Object.assign(body.style,{padding:"0 12px 12px"});
 box.querySelectorAll("button").forEach(b=>Object.assign(b.style,{width:"100%",marginTop:"8px",padding:"9px",borderRadius:"9px",border:"1px solid #2f657a",background:"#0d3048",color:"white",fontWeight:"700"}));
 mini.style.fontSize="20px"; mini.style.padding="0 5px";
 mini.onclick=(e)=>{e.stopPropagation();const hidden=body.style.display==="none";body.style.display=hidden?"block":"none";mini.textContent=hidden?"−":"+";box.style.width=hidden?"260px":"145px"};
 box.querySelector("#auroraDiagCopy").onclick=copyReport;
 box.querySelector("#auroraDiagClear").onclick=()=>{try{localStorage.removeItem(EVENTS)}catch(_){};push("INFO","LOG_LIMPO_PELO_USUARIO","")};
 let drag=false,ox=0,oy=0;
 head.addEventListener("pointerdown",e=>{drag=true;ox=e.clientX-box.offsetLeft;oy=e.clientY-box.offsetTop;try{head.setPointerCapture(e.pointerId)}catch(_){}});
 head.addEventListener("pointermove",e=>{if(!drag)return;box.style.left=Math.max(0,Math.min(innerWidth-box.offsetWidth,e.clientX-ox))+"px";box.style.top=Math.max(0,Math.min(innerHeight-box.offsetHeight,e.clientY-oy))+"px";box.style.right="auto"});
 head.addEventListener("pointerup",()=>drag=false);head.addEventListener("pointercancel",()=>drag=false);
 update();
}
function update(){const el=document.getElementById("auroraDiagLast");if(!el)return;const s=read(),ev=readEvents(),last=ev[ev.length-1];el.textContent="Último: "+(last?last.type+" • "+last.msg:(s.last||"aguardando"));}
const oldRender=render; render=function(){oldRender();update()};
global.AuroraBootDiagV78={mark:mark,render:render,copyReport:copyReport,report:report,push:push};
try{localStorage.setItem(KEY,JSON.stringify({last:"DIAG_V163_EARLY_LOADED",detail:"diagnostico visual carregado antes da cadeia de scripts",at:now(),trail:["DIAG_V163_EARLY_LOADED"]}))}catch(_){}
push("BOOT","DIAG_V163_EARLY_LOADED",location.href);
global.addEventListener("error",e=>push("ERROR",e.message||"window.error",(e.filename||"")+":"+(e.lineno||0)+":"+(e.colno||0)));
global.addEventListener("unhandledrejection",e=>{let r="";try{r=e.reason&&e.reason.stack?e.reason.stack:(e.reason&&e.reason.message?e.reason.message:String(e.reason))}catch(_){r="unhandled rejection"}push("REJECTION",r,"")});
global.addEventListener("online",()=>push("NETWORK","ONLINE",""));global.addEventListener("offline",()=>push("NETWORK","OFFLINE",""));
if(global.fetch){const nativeFetch=global.fetch.bind(global);global.fetch=function(input,init){let u="";try{u=typeof input==="string"?input:(input&&input.url)||""}catch(_){};if(!navigator.onLine)push("FETCH_OFFLINE","tentativa de rede",u);return nativeFetch(input,init).catch(err=>{push("FETCH_FAIL",u,err&&err.message||String(err));throw err})}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{push("DOM","DOMContentLoaded","");render()},{once:true});else render();
global.addEventListener("load",()=>{push("DOM","window.load","");render()},{once:true});
setTimeout(()=>{render();push("WATCHDOG_3S","app children="+String((document.getElementById("app")||{}).childElementCount||0),"ready="+document.readyState)},3000);
setTimeout(()=>{render();push("WATCHDOG_8S","app children="+String((document.getElementById("app")||{}).childElementCount||0),"ready="+document.readyState)},8000);
})(window);

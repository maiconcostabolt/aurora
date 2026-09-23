(function(global){
"use strict";
let root=null,current=null,registrations=[],mode="idle",timer=null,started=0,homeTrigger=null,processTimer=null,processStarted=0,processElapsed=0;
const POSITION_KEY="aurora_ai_floating_position_v1";
let dragging=false,dragMoved=false,dragStart=null,dragOrigin=null,suppressClick=false;
function connected(item){
  if(!(item&&item.form&&item.form.isConnected))return false;
  if(item.form.closest("[hidden]"))return false;
  const layer=item.form.closest(".aurora-layer,.aurora-workflow-layer,[data-aurora-layer]");
  if(layer&&layer.hidden)return false;
  return !item.form.getClientRects||item.form.getClientRects().length>0;
}
function isReportOpen(){return !!document.querySelector(".aurora-report-preview.is-open,.report-preview.is-open,[data-report-preview].is-open");}
function visible(el){if(!el||el.hidden)return false;const s=global.getComputedStyle?global.getComputedStyle(el):null;return(!s||(s.display!=="none"&&s.visibility!=="hidden"))&&(!el.getClientRects||el.getClientRects().length>0);}
function blocked(){if(global.__AURORA_PUBLIC_ASSET_PAGE__||isReportOpen())return true;const selectors=["[data-assets-panel]:not([hidden])","[data-assets-detail]:not([hidden])","[data-assets-editor]:not([hidden])","[data-assets-help-modal]:not([hidden])","[data-asset-qr-modal]:not([hidden])",".aurora-settings-modal.is-open","[data-company-modal]:not([hidden])",".aurora-custom-service-modal.is-open",".aurora-module-access-overlay:not([hidden])",".aurora-demo-overlay:not([hidden])","[role='dialog']:not([hidden])"];return Array.from(document.querySelectorAll(selectors.join(','))).some(visible);}
function homeAvailable(){try{const h=global.AuroraAiHome&&global.AuroraAiHome.getContext&&global.AuroraAiHome.getContext();return typeof homeTrigger==="function"&&h&&h.active}catch(_){return false}}
function clampPosition(x,y){const n=ensure(),r=n.getBoundingClientRect(),pad=8;return{x:Math.max(pad,Math.min(window.innerWidth-r.width-pad,x)),y:Math.max(pad,Math.min(window.innerHeight-r.height-pad,y))};}
function applyPosition(x,y,persist){const n=ensure(),p=clampPosition(x,y);n.style.left=p.x+"px";n.style.top=p.y+"px";n.style.right="auto";n.style.bottom="auto";if(persist){try{localStorage.setItem(POSITION_KEY,JSON.stringify(p));}catch(_){}}}
function restorePosition(){try{const p=JSON.parse(localStorage.getItem(POSITION_KEY)||"null");if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){requestAnimationFrame(()=>applyPosition(p.x,p.y,false));}}catch(_){}}
function resolve(){registrations=registrations.filter(connected);current=registrations.length?registrations[registrations.length-1]:null;render();return current;}
function ensure(){
  if(root)return root;
  root=document.createElement("div");root.className="aurora-ai-floating";
  root.innerHTML='<button type="button" class="aurora-ai-floating__button" aria-label="Abrir Aurora AI" title="Aurora AI"><span class="aurora-ai-floating__spark" aria-hidden="true">✦</span><span class="aurora-ai-floating__mic" aria-hidden="true">🎙</span><span class="aurora-ai-floating__timer" aria-hidden="true"></span><span class="aurora-ai-floating__label">Aurora AI</span></button><div class="aurora-ai-floating__process-time" aria-live="polite" hidden><span class="aurora-ai-floating__progress-text">Entendendo sua solicitação…</span><span class="aurora-ai-floating__progress-track" aria-hidden="true"><i></i></span></div><div class="aurora-ai-floating__transcript" role="status" aria-live="polite" hidden></div><div class="aurora-ai-floating__message" role="status" aria-live="polite" hidden></div>';
  document.body.appendChild(root);const button=root.querySelector("button");
  button.addEventListener("click",e=>{if(suppressClick){suppressClick=false;e.preventDefault();return;}const item=resolve();if(item)item.trigger();else if(homeAvailable())homeTrigger();});
  button.addEventListener("pointerdown",e=>{if(mode==="listening"||mode==="processing")return;dragging=true;dragMoved=false;const r=root.getBoundingClientRect();dragStart={x:e.clientX,y:e.clientY};dragOrigin={x:r.left,y:r.top};button.setPointerCapture?.(e.pointerId);});
  button.addEventListener("pointermove",e=>{if(!dragging||!dragStart||!dragOrigin)return;const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;if(Math.hypot(dx,dy)>6)dragMoved=true;if(dragMoved){root.classList.add("is-dragging");applyPosition(dragOrigin.x+dx,dragOrigin.y+dy,false);e.preventDefault();}});
  const finish=e=>{if(!dragging)return;dragging=false;root.classList.remove("is-dragging");if(dragMoved){const r=root.getBoundingClientRect();applyPosition(r.left,r.top,true);suppressClick=true;setTimeout(()=>suppressClick=false,350);e&&e.preventDefault();}dragStart=dragOrigin=null;};
  button.addEventListener("pointerup",finish);button.addEventListener("pointercancel",finish);window.addEventListener("resize",()=>{if(root.style.left){const r=root.getBoundingClientRect();applyPosition(r.left,r.top,false);}});restorePosition();setInterval(resolve,500);return root;
}
function transcript(text){const box=ensure().querySelector(".aurora-ai-floating__transcript");const value=String(text||"").trim();box.textContent=value?"Você disse: “"+value+"”":"";box.hidden=!value;}
function clearTranscript(){const box=ensure().querySelector(".aurora-ai-floating__transcript");box.textContent="";box.hidden=true;}
function message(text){const box=ensure().querySelector(".aurora-ai-floating__message");box.textContent=text;box.hidden=false;clearTimeout(message.timer);message.timer=setTimeout(()=>{box.hidden=true;},8000);}
function fmt(ms){const sec=Math.max(0,Math.floor(ms/1000));return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");}
function processBox(){return ensure().querySelector(".aurora-ai-floating__process-time");}
function setProcessText(text){const box=processBox(),label=box.querySelector(".aurora-ai-floating__progress-text");if(label)label.textContent=text||"Entendendo sua solicitação…";}
function startProcessingTimer(){processStarted=performance.now();processElapsed=0;const box=processBox();box.hidden=false;box.dataset.state="working";setProcessText("Entendendo sua solicitação…");}
function completeProcessingTimer(){processElapsed=processStarted?performance.now()-processStarted:0;processStarted=0;const box=processBox();box.dataset.state="done";setProcessText("Solicitação entendida");setTimeout(()=>{if(box.dataset.state==="done")box.hidden=true;},1400);}
function failProcessingTimer(){processElapsed=processStarted?performance.now()-processStarted:0;processStarted=0;const box=processBox();box.dataset.state="error";setProcessText("Não consegui concluir");setTimeout(()=>{if(box.dataset.state==="error")box.hidden=true;},2200);}
function resetProcessingTimer(){processStarted=0;processElapsed=0;const box=processBox();box.hidden=true;box.dataset.state="";setProcessText("Entendendo sua solicitação…");}
document.addEventListener("aurora:ai:fields-applied",()=>{completeProcessingTimer();idle();});
function render(){const n=ensure(),button=n.querySelector("button"),active=connected(current),available=!blocked()&&(active||homeAvailable());n.hidden=!available;n.dataset.available=available?"true":"false";n.dataset.mode=mode;button.setAttribute("aria-label",mode==="listening"?"Parar gravação Aurora AI":"Usar Aurora AI nesta etapa");button.title=mode==="listening"?"Toque para finalizar":"Aurora AI";}
function setHomeTrigger(fn){homeTrigger=typeof fn==="function"?fn:null;render();}
function register(item){if(!item||!item.form||typeof item.trigger!=="function")return;registrations=registrations.filter(old=>old.form!==item.form);registrations.push(item);current=item;ensure();render();}
function listening(){clearTranscript();resetProcessingTimer();mode="listening";started=performance.now();const n=ensure(),mic=n.querySelector(".aurora-ai-floating__mic"),label=n.querySelector(".aurora-ai-floating__label"),clock=n.querySelector(".aurora-ai-floating__timer");mic.textContent="■";label.textContent="Ouvindo";clock.textContent="00:00";clearInterval(timer);timer=setInterval(()=>clock.textContent=fmt(performance.now()-started),250);render();}
function processing(text){startProcessingTimer();setProcessText(text||"Entendendo sua solicitação…");mode="processing";clearInterval(timer);const n=ensure();n.querySelector(".aurora-ai-floating__mic").textContent="✦";n.querySelector(".aurora-ai-floating__label").textContent=text||"Organizando...";n.querySelector(".aurora-ai-floating__timer").textContent="";render();}
function idle(){mode="idle";clearInterval(timer);const n=ensure();n.querySelector(".aurora-ai-floating__mic").textContent="🎙";n.querySelector(".aurora-ai-floating__label").textContent="Aurora AI";n.querySelector(".aurora-ai-floating__timer").textContent="";render();}
function init(){ensure();resolve();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
global.AuroraAiFloating=Object.freeze({register,refresh:resolve,message,listening,processing,idle,setHomeTrigger,startProcessingTimer,completeProcessingTimer,failProcessingTimer,resetProcessingTimer,transcript,clearTranscript});
})(window);

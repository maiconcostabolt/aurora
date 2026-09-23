(function(global){
"use strict";
const MAX=60000;
function cfg(){return global.AURORA_CLOUD_CONFIG||{};}
function uuid(){return crypto.randomUUID();}
function client(){return global.AuroraCloudSync&&global.AuroraCloudSync.client;}
async function token(){const c=client();if(!c)throw Error("Nuvem Aurora indisponível.");const r=await c.auth.getSession();const t=r&&r.data&&r.data.session&&r.data.session.access_token;if(!t)throw Error("Sessão Aurora não encontrada.");return t;}
function group(){try{let id=sessionStorage.getItem("aurora_ai_home_group");if(!id){id=uuid();sessionStorage.setItem("aurora_ai_home_group",id);}return id;}catch(_){return uuid();}}
function options(){if(typeof MediaRecorder==="undefined")return{};for(const m of ["audio/webm;codecs=opus","audio/webm","audio/mp4"]){if(!MediaRecorder.isTypeSupported||MediaRecorder.isTypeSupported(m))return{mimeType:m};}return{};}
function isReport(){return !!document.querySelector('.aurora-report-preview.is-open,.report-preview.is-open') || /Prévia do relatório/i.test(document.body.innerText.slice(0,400));}
function home(){const h=global.AuroraAiHome&&global.AuroraAiHome.getContext?global.AuroraAiHome.getContext():null;return h&&h.active&&h.services&&h.services.length?h:null;}
async function send(blob,mime,duration,h){
 const c=cfg(),t=await token(),anchor=h.services[0],vehicleOnly=h.services.length===1&&String(anchor.id)==="vehicle_inspection";
 const fd=new FormData();fd.set("request_id",uuid());fd.set("usage_group_id",group());fd.set("audio_duration_ms",String(Math.round(duration)));fd.set("audio",blob,"aurora-home.webm");
 if(vehicleOnly){
   fd.set("module_code","vehicle_inspection");fd.set("service_code","vehicle_inspection");fd.set("stage","customer");fd.set("screen_title","Cliente");
   fd.set("field_schema",JSON.stringify([{id:"name",label:"Nome ou razão social",type:"text",options:[]},{id:"phone",label:"Telefone",type:"text",options:[]},{id:"email",label:"E-mail",type:"text",options:[]},{id:"person_type",label:"Tipo de cliente",type:"select",options:["Pessoa Física","Empresa","Condomínio"]}]));
   const r=await fetch(`${String(c.url).replace(/\/$/,"")}/functions/v1/aurora_ai_asset`,{method:"POST",headers:{Authorization:`Bearer ${t}`,apikey:c.anon_key},body:fd});let b={};try{b=await r.json();}catch(_){}if(!r.ok||!b.ok){const code=String(b.error||r.status||"ERRO");throw Object.assign(Error("Aurora AI não conseguiu concluir esta etapa."),{aiCode:code});}
   return {ok:true,service_code:"vehicle_inspection",customer:b.fields||{},latency_ms:b.timings&&Number(b.timings.to_fields_ms)||null,timings:b.timings||{}};
 }
 fd.set("module_code",h.current_profile||h.profile);fd.set("quota_service_code",anchor.id);fd.set("services",JSON.stringify(h.services));
 const r=await fetch(`${String(c.url).replace(/\/$/,"")}/functions/v1/aurora_ai_home`,{method:"POST",headers:{Authorization:`Bearer ${t}`,apikey:c.anon_key},body:fd});let b={};try{b=await r.json();}catch(_){}if(!r.ok||!b.ok){const code=String(b.error||r.status||"ERRO");throw Object.assign(Error("Aurora AI não conseguiu concluir esta etapa."),{aiCode:code});}return b;
}
let rec=null,stream=null,chunks=[],started=0,timer=null;
async function start(h){
 if(rec&&rec.state==="recording"){rec.stop();return;}
 if(rec&&rec.state!=="inactive")return;
 stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];rec=new MediaRecorder(stream,options());const mime=rec.mimeType||"audio/webm";rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};rec.onstop=async()=>{clearTimeout(timer);stream&&stream.getTracks().forEach(t=>t.stop());global.AuroraAiFloating&&global.AuroraAiFloating.processing("Entendendo pedido...");try{
      const blob=new Blob(chunks,{type:mime});
      if(!blob.size) throw Object.assign(Error("A gravação terminou sem áudio."),{aiCode:"EMPTY_AUDIO"});
      global.AuroraAiFloating&&global.AuroraAiFloating.message("Áudio recebido. Identificando serviço...");
      const b=await send(blob,mime,performance.now()-started,h);
      const spoken=String(b.transcript||b.transcription||b.text||"").trim();
      if(spoken&&global.AuroraAiFloating&&global.AuroraAiFloating.transcript)global.AuroraAiFloating.transcript(spoken);
      global.AuroraAiFloating&&global.AuroraAiFloating.processing("Identificando o serviço...");
      let suggestions=[];try{suggestions=spoken&&global.AuroraAiDispatcher&&global.AuroraAiDispatcher.getSuggestions?global.AuroraAiDispatcher.getSuggestions(spoken):[];}catch(_){}
      if(b.service_code){const br=h.services.find(x=>String(x.id)===String(b.service_code));if(br&&!suggestions.some(x=>String((x.route||{}).id)===String(br.id)&&String((x.route||{}).profile)===String(br.profile)))suggestions.unshift({route:br,score:70});}
      global.AuroraAiFloating&&global.AuroraAiFloating.completeProcessingTimer&&global.AuroraAiFloating.completeProcessingTimer();global.AuroraAiFloating&&global.AuroraAiFloating.idle();
      if(!suggestions.length){global.AuroraAiFloating&&global.AuroraAiFloating.message("Entendi o que você disse, mas não encontrei um serviço compatível entre os serviços disponíveis.");return;}
      const chosen=global.AuroraAiDispatcher&&global.AuroraAiDispatcher.chooseSuggestion?await global.AuroraAiDispatcher.chooseSuggestion(spoken,suggestions):suggestions[0];
      if(!chosen||chosen.again){if(chosen&&chosen.again)setTimeout(()=>start(home()||h),120);return;}
      const route=chosen.route||chosen;const label=route.service_title||route.title||route.id;
      const customer=(b.customer&&typeof b.customer==="object")?b.customer:{name:String(b.customer_name||"").trim()};
      global.AuroraAiFloating&&global.AuroraAiFloating.processing("Abrindo "+label+"...");
      const openStarted=performance.now();
      const ok=await global.AuroraAiDispatcher.dispatch(route.id,customer,route.profile);
      const totalMs=Math.round(performance.now()-started),openMs=Math.round(performance.now()-openStarted),backendMs=Number(b.latency_ms)||null;
      try{sessionStorage.setItem("aurora_ai_last_latency_v1",JSON.stringify({total_ms:totalMs,backend_ms:backendMs,open_ms:openMs,at:new Date().toISOString()}));}catch(_){}
      global.AuroraAiFloating&&global.AuroraAiFloating.completeProcessingTimer&&global.AuroraAiFloating.completeProcessingTimer();
      global.AuroraAiFloating&&global.AuroraAiFloating.idle();
      if(!ok){global.AuroraAiFloating.message("Identifiquei "+label+", mas não consegui abrir o atendimento.");return;}
    }catch(e){console.warn("Aurora AI Home",e);global.AuroraAiFloating&&global.AuroraAiFloating.failProcessingTimer&&global.AuroraAiFloating.failProcessingTimer();global.AuroraAiFloating&&global.AuroraAiFloating.idle();const code=String(e&&e.aiCode||"");const friendly={INVALID_CONTEXT:"O contexto da tela inicial não foi aceito.",AI_CAPABILITY_DENIED:"Aurora AI não está habilitada para iniciar este atendimento.",AI_MODULE_DENIED:"Este módulo não está liberado para esta conta.",AI_SERVICE_DENIED:"O serviço usado pela IA não está liberado para esta conta.",AI_MEMBER_DISABLED:"Aurora AI está desativada para este usuário.",AI_RATE_LIMITED_USER:"Aguarde alguns segundos e tente novamente.",AI_RATE_LIMITED_SUBJECT:"Aguarde alguns segundos e tente novamente.",AI_QUOTA_EXCEEDED:"O limite mensal da Aurora AI foi atingido.",TRANSCRIPTION_FAILED:"Não consegui entender o áudio. Tente novamente.",INTERPRETATION_FAILED:"Entendi o áudio, mas não consegui identificar o serviço."};global.AuroraAiFloating.message(friendly[code]||(code?"Falha ao iniciar atendimento ("+code+").":"Não consegui iniciar o atendimento."));}finally{rec=null;stream=null;}};started=performance.now();rec.start();global.AuroraAiFloating&&global.AuroraAiFloating.listening();timer=setTimeout(()=>rec&&rec.state==="recording"&&rec.stop(),MAX);}
function refresh(){const h=home();if(global.AuroraAiFloating)global.AuroraAiFloating.setHomeTrigger(h&&!isReport()?()=>start(h):null);}
setInterval(refresh,500);document.addEventListener("DOMContentLoaded",refresh,{once:true});
})(window);

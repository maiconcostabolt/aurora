(function(global){
"use strict";

function esc(v){
    return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function moneyNumber(v){
    let s=String(v==null?"":v).trim().replace(/\s/g,"").replace(/^R\$/i,"");
    if(s.includes(",") && s.includes(".")) s=s.replace(/\./g,"").replace(",",".");
    else if(s.includes(",")) s=s.replace(",",".");
    s=s.replace(/[^\d.-]/g,"");
    const n=Number(s); return Number.isFinite(n)?n:0;
}
function money(v){
    try{return moneyNumber(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
    catch(_){return "R$ "+moneyNumber(v).toFixed(2).replace(".",",");}
}

/* R57 — assinatura usa o mesmo campo canônico, porém o PNG é recortado e
 * reduzido antes da persistência. Evita gastar quota com os 900x260 vazios
 * do canvas sem criar storage, autoridade ou fluxo paralelo. */
function compactSignatureCanvas(sourceCanvas){
    try {
        const sourceCtx=sourceCanvas.getContext("2d",{willReadFrequently:true});
        const w=sourceCanvas.width,h=sourceCanvas.height;
        const pixels=sourceCtx.getImageData(0,0,w,h).data;
        let minX=w,minY=h,maxX=-1,maxY=-1;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
            const i=(y*w+x)*4;
            if(pixels[i+3]>12){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
        }
        if(maxX<minX||maxY<minY)return "";
        const pad=14;
        minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);
        maxX=Math.min(w-1,maxX+pad);maxY=Math.min(h-1,maxY+pad);
        const cropW=Math.max(1,maxX-minX+1),cropH=Math.max(1,maxY-minY+1);
        const scale=Math.min(1,480/cropW,140/cropH);
        const out=document.createElement("canvas");
        out.width=Math.max(1,Math.round(cropW*scale));out.height=Math.max(1,Math.round(cropH*scale));
        out.getContext("2d").drawImage(sourceCanvas,minX,minY,cropW,cropH,0,0,out.width,out.height);
        return out.toDataURL("image/png");
    } catch (_) { return sourceCanvas.toDataURL("image/png"); }
}

class BudgetModuleController extends global.ModuleController {
    constructor(){ super({id:"budget"}); this.data={mode:"detailed",show_on_report:"Sim",items:[],total_value:"",notes:"",collect_signature:false,signature_data:""}; }
    async onLoad(context={}){
        const b=context.budget||{};
        this.data={
            mode:b.mode==="total"?"total":"detailed",
            show_on_report:b.show_on_report==="Não"?"Não":"Sim",
            items:Array.isArray(b.items)?b.items.map(x=>({description:String(x.description||""),value:String(x.value||"")})):[],
            total_value:String(b.total_value||""),
            notes:String(b.notes||""),
            collect_signature:Boolean(b.collect_signature),
            signature_data:String(b.signature_data||"")
        };
        if(!this.data.items.length) this.data.items=[{description:"",value:""}];
    }
    async render(){
        return `<section class="aurora-module aurora-budget" data-module="budget">
          <header class="aurora-budget__head"><div><h1>Orçamento / serviços</h1><p>Informe somente o valor total ou detalhe os trabalhos e seus respectivos valores.</p></div><label class="aurora-report-switch"><span>Incluir no relatório</span><input type="checkbox" data-budget-show-toggle><i aria-hidden="true"></i></label></header>
          <div class="aurora-budget__report-body" data-budget-report-body>
          <div class="aurora-budget__mode">
            <button type="button" data-budget-mode="detailed">Serviços detalhados</button>
            <button type="button" data-budget-mode="total">Somente valor total</button>
          </div>
          <div data-budget-detailed>
            <div class="aurora-budget__section-title"><div><strong>Trabalhos e valores</strong><small>Adicione quantos serviços forem necessários.</small></div><button type="button" data-budget-add>+ Adicionar serviço</button></div>
            <div data-budget-items></div>
            <div class="aurora-budget__total"><span>Valor total</span><strong data-budget-total>R$ 0,00</strong></div>
          </div>
          <div data-budget-total-only>
            <label class="aurora-budget__field"><span>Valor total do serviço / orçamento (R$)</span><input data-budget-total-value inputmode="decimal" placeholder="Ex.: 550,00"></label>
          </div>
          <div class="aurora-budget__options">
            <label class="aurora-budget__field"><span>Observação comercial</span><textarea data-budget-notes data-field-label="Observação comercial" name="commercial_notes" placeholder="Opcional"></textarea></label>
          </div>
          <article class="aurora-budget__signature">
            <div class="aurora-budget__signature-head">
              <div><strong>Assinatura do cliente</strong><small>Opcional. Colete a assinatura após apresentar os serviços e valores.</small></div>
              <label><input type="checkbox" data-budget-signature-toggle> Coletar assinatura</label>
            </div>
            <div class="aurora-budget__signature-pad" data-budget-signature-pad hidden>
              <canvas width="900" height="260" aria-label="Área para assinatura do cliente"></canvas>
              <div class="aurora-budget__signature-actions">
                <button type="button" data-budget-signature-confirm>Confirmar assinatura</button>
                <button type="button" data-budget-signature-clear>Limpar</button>
              </div>
              <p data-budget-signature-status></p>
            </div>
          </article>
          </div>
        </section>`;
    }
    _row(item={},idx=0){
        return `<div class="aurora-budget__row" data-budget-row>
          <label class="aurora-budget__field aurora-budget__field--service"><span>Serviço / trabalho</span><input data-budget-desc value="${esc(item.description||"")}" placeholder="Ex.: Pintura da porta"></label>
          <label class="aurora-budget__field aurora-budget__field--value"><span>Valor (R$)</span><input data-budget-value inputmode="decimal" value="${esc(item.value||"")}" placeholder="Ex.: 250,00"></label>
          <button type="button" class="aurora-budget__remove" data-budget-remove aria-label="Remover serviço">×</button>
        </div>`;
    }
    _renderRows(){
        const host=this.container.querySelector("[data-budget-items]");
        host.innerHTML=this.data.items.map((x,i)=>this._row(x,i)).join("");
        this._updateTotal();
    }
    _readRows(){
        return Array.from(this.container.querySelectorAll("[data-budget-row]")).map(row=>({
            description:(row.querySelector("[data-budget-desc]")?.value||"").trim(),
            value:(row.querySelector("[data-budget-value]")?.value||"").trim()
        })).filter(x=>x.description||moneyNumber(x.value)>0);
    }
    _updateTotal(){
        const total=this._readRows().reduce((a,x)=>a+moneyNumber(x.value),0);
        const el=this.container.querySelector("[data-budget-total]"); if(el) el.textContent=money(total);
    }
    _applyMode(){
        const detailed=this.data.mode!=="total";
        this.container.querySelector("[data-budget-detailed]").hidden=!detailed;
        this.container.querySelector("[data-budget-total-only]").hidden=detailed;
        this.container.querySelectorAll("[data-budget-mode]").forEach(b=>b.classList.toggle("is-active",b.dataset.budgetMode===this.data.mode));
    }
    async bindEvents(container){
        this._renderRows();
        container.querySelector("[data-budget-total-value]").value=this.data.total_value||"";
        const reportToggle=container.querySelector("[data-budget-show-toggle]");
        reportToggle.checked=(this.data.show_on_report||"Sim")!=="Não";
        const syncReportState=()=>container.querySelector("[data-budget-report-body]")?.classList.toggle("is-report-off",!reportToggle.checked);
        reportToggle.addEventListener("change",syncReportState);
        syncReportState();
        container.querySelector("[data-budget-notes]").value=this.data.notes||"";
        this._applyMode();
        container.addEventListener("click",e=>{
            const mode=e.target.closest("[data-budget-mode]");
            if(mode){this.data.mode=mode.dataset.budgetMode;this._applyMode();return;}
            if(e.target.closest("[data-budget-add]")){this.data.items=this._readRows();this.data.items.push({description:"",value:""});this._renderRows();return;}
            const rem=e.target.closest("[data-budget-remove]");
            if(rem){const rows=Array.from(container.querySelectorAll("[data-budget-row]"));const idx=rows.indexOf(rem.closest("[data-budget-row]"));this.data.items=this._readRows();if(idx>=0)this.data.items.splice(idx,1);if(!this.data.items.length)this.data.items=[{description:"",value:""}];this._renderRows();}
        });
        container.addEventListener("input",e=>{if(e.target.matches("[data-budget-value]"))this._updateTotal();});

        const sigToggle=container.querySelector("[data-budget-signature-toggle]");
        const sigPad=container.querySelector("[data-budget-signature-pad]");
        const sigCanvas=sigPad.querySelector("canvas");
        const sigStatus=container.querySelector("[data-budget-signature-status]");
        const sigCtx=sigCanvas.getContext("2d");
        sigCtx.lineWidth=3; sigCtx.lineCap="round"; sigCtx.lineJoin="round"; sigCtx.strokeStyle="#102d46";
        sigToggle.checked=Boolean(this.data.collect_signature);
        sigPad.hidden=!sigToggle.checked;

        const restoreSignature=()=>{
            sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height);
            if(!this.data.signature_data) return;
            const img=new Image();
            img.onload=()=>{sigCtx.drawImage(img,0,0,sigCanvas.width,sigCanvas.height);sigStatus.textContent="Assinatura confirmada.";};
            img.src=this.data.signature_data;
        };
        restoreSignature();

        let drawing=false;
        const sigPoint=(ev)=>{
            const rect=sigCanvas.getBoundingClientRect();
            return {x:(ev.clientX-rect.left)*(sigCanvas.width/rect.width),y:(ev.clientY-rect.top)*(sigCanvas.height/rect.height)};
        };
        sigCanvas.addEventListener("pointerdown",ev=>{drawing=true;const q=sigPoint(ev);sigCtx.beginPath();sigCtx.moveTo(q.x,q.y);sigCanvas.setPointerCapture?.(ev.pointerId);ev.preventDefault();});
        sigCanvas.addEventListener("pointermove",ev=>{if(!drawing)return;const q=sigPoint(ev);sigCtx.lineTo(q.x,q.y);sigCtx.stroke();ev.preventDefault();});
        ["pointerup","pointercancel","pointerleave"].forEach(name=>sigCanvas.addEventListener(name,()=>{drawing=false;}));
        sigToggle.addEventListener("change",()=>{
            sigPad.hidden=!sigToggle.checked;
            if(!sigToggle.checked){this.data.signature_data="";sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height);sigStatus.textContent="";}
        });
        container.querySelector("[data-budget-signature-clear]").addEventListener("click",()=>{
            this.data.signature_data="";sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height);sigStatus.textContent="Assinatura limpa.";
        });
        container.querySelector("[data-budget-signature-confirm]").addEventListener("click",()=>{
            const compact=compactSignatureCanvas(sigCanvas);
            if(!compact){this.data.signature_data="";sigStatus.textContent="Desenhe a assinatura antes de confirmar.";return;}
            this.data.signature_data=compact;
            sigStatus.textContent="Assinatura confirmada.";
        });
    }
    async onValidate(){ return true; } // etapa comercial sempre opcional
    async onSave(){
        const items=this._readRows();
        const detailedTotal=items.reduce((a,x)=>a+moneyNumber(x.value),0);
        const totalOnly=(this.container.querySelector("[data-budget-total-value]")?.value||"").trim();
        return {budget:{
            mode:this.data.mode,
            items:this.data.mode==="detailed"?items:[],
            total_value:this.data.mode==="detailed"?String(detailedTotal):totalOnly,
            show_on_report:this.container.querySelector("[data-budget-show-toggle]")?.checked ? "Sim" : "Não",
            notes:(this.container.querySelector("[data-budget-notes]")?.value||"").trim(),
            collect_signature:Boolean(this.container.querySelector("[data-budget-signature-toggle]")?.checked),
            signature_data:this.container.querySelector("[data-budget-signature-toggle]")?.checked ? String(this.data.signature_data||"") : ""
        }};
    }
}
global.BudgetModuleController=BudgetModuleController;
})(window);

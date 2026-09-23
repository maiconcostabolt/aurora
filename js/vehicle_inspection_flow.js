(function (global) {
"use strict";

const SERVICE_ID = "vehicle_inspection";
const SERVICES = ["Revisão preventiva","Troca de óleo e filtros","Alinhamento e balanceamento","Freios","Diagnóstico","Funilaria e pintura","Lavagem","Outro serviço"];
const RECEIVED = ["Manual e documentos","Chave reserva","Tapetes","Objetos no interior","Estepe e macaco","Triângulo"];
const CHECKS = [
    ["internal_external","Iluminação externa"],
    ["windshield","Palhetas e para-brisa"],
    ["levels","Níveis e fluidos"],
    ["brakes","Freios"],
    ["tires","Pneus e estepe"],
    ["suspension_steering","Suspensão e direção"],
    ["battery","Bateria e sistema elétrico"],
    ["safety_items","Itens de segurança"]
];

function active(context) {
    return String(context && context.service && context.service.id || "").toLowerCase() === SERVICE_ID;
}
function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function list(value) {
    if (Array.isArray(value)) return value;
    return String(value || "").split("|").map(x => x.trim()).filter(Boolean);
}
function localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function localTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function choiceGroup(title, subtitle, values, selected, name) {
    return `<article class="avi-card"><header><div><h2>${title}</h2><p>${subtitle}</p></div><span class="avi-count" data-count-for="${name}">${selected.length}</span></header><div class="avi-choices">${values.map(value => `<label class="avi-choice${selected.includes(value)?" is-selected":""}"><input type="checkbox" name="${name}" value="${esc(value)}" ${selected.includes(value)?"checked":""}><span>${esc(value)}</span></label>`).join("")}</div></article>`;
}
function hero(step) {
    return `<section class="avi-hero"><span>Novo atendimento</span><h1>Vistoria veicular</h1><p>Registre as condições do veículo no recebimento com checklist, fotos e confirmação.</p></section><div class="avi-progress" aria-label="Etapa ${step} de 5">${[1,2,3,4,5].map(i=>`<i class="${i<=step?"is-on":""}"></i>`).join("")}</div>`;
}

function syncAviIntakeSelection(form) {
    if (!form) return;
    form.querySelectorAll(".avi-choice").forEach((choice) => {
        const input = choice.querySelector("input");
        if (!input) return;
        const selected = input.checked;
        if (choice.classList.contains("is-selected") !== selected) {
            choice.classList.toggle("is-selected", selected);
        }
    });
    form.querySelectorAll(".avi-state").forEach((state) => {
        const input = state.querySelector("input");
        if (!input) return;
        const selected = input.checked;
        if (state.classList.contains("is-selected") !== selected) {
            state.classList.toggle("is-selected", selected);
        }
    });
    form.querySelectorAll("[data-count-for]").forEach((counter) => {
        const next = String(
            form.querySelectorAll(
                `input[name="${counter.dataset.countFor}"]:checked`
            ).length
        );
        if (counter.textContent !== next) {
            counter.textContent = next;
        }
    });
    const checklistCounter = form.querySelector("[data-check-count]");
    if (checklistCounter) {
        const next = `${form.querySelectorAll(".avi-check input:checked").length}/8`;
        if (checklistCounter.textContent !== next) {
            checklistCounter.textContent = next;
        }
    }
}

function detachAviIntakeChange(controller) {
    if (!controller || !controller.__aviIntakeChangeHandler) return;
    const target = controller.__aviIntakeChangeTarget;
    if (target) {
        target.removeEventListener(
            "change",
            controller.__aviIntakeChangeHandler
        );
    }
    controller.__aviIntakeChangeHandler = null;
    controller.__aviIntakeChangeTarget = null;
}

/* Cliente: primeira etapa do mesmo fluxo visual. */
if (global.CustomerModuleController) {
    const p=global.CustomerModuleController.prototype, load=p.onLoad, bind=p.bindEvents;
    p.onLoad=async function(context){this.__avi=active(context);await load.call(this,context);};
    p.bindEvents=async function(container){
        await bind.call(this,container); if(!this.__avi)return;
        container.classList.add("avi-screen","avi-customer");
        const module=container.querySelector('[data-module="customer"]');
        if(module)module.insertAdjacentHTML("afterbegin",hero(1));
        if(this.form)this.form.classList.add("avi-form","avi-form--customer");
    };
}

/* Veículo: formulário real, compacto e em duas colunas. */
if (global.AssetModuleController) {
    const p = global.AssetModuleController.prototype;
    const load = p.onLoad, bind = p.bindEvents;
    p.onLoad = async function (context) {
        this.__avi = active(context);
        await load.call(this, context);
    };
    p.bindEvents = async function (container) {
        await bind.call(this, container);
        if (!this.__avi) return;
        container.classList.add("avi-screen","avi-vehicle");
        const module = container.querySelector('[data-module="asset"]');
        if (module) module.insertAdjacentHTML("afterbegin", hero(2));
        if (this.form) this.form.classList.add("avi-form","avi-form--vehicle");
    };
}

function readLoggedInUserFullName() {
    if (
        global.AuroraUserProfile &&
        typeof global.AuroraUserProfile.getUserFullName === "function"
    ) {
        return String(
            global.AuroraUserProfile.getUserFullName() || ""
        ).trim();
    }

    return "";
}

function readLoggedInUserId() {
    if (
        global.AuroraUserProfile &&
        typeof global.AuroraUserProfile.getUserId === "function"
    ) {
        return String(
            global.AuroraUserProfile.getUserId() || ""
        ).trim();
    }

    return String(global.AURORA_ACCOUNT_USER_ID || "").trim();
}

function buildPerformedBySnapshot(currentCase, responsible) {
    const current =
        currentCase && typeof currentCase === "object"
            ? currentCase
            : {};
    const trimmedResponsible = String(responsible || "").trim();
    let performedByUserId = current.performed_by_user_id || null;
    let performedByName = String(current.performed_by_name || "").trim();

    if (!performedByName) {
        performedByUserId =
            readLoggedInUserId() ||
            current.user_id ||
            null;
        performedByName =
            trimmedResponsible ||
            readLoggedInUserFullName();
    } else if (
        trimmedResponsible &&
        trimmedResponsible !== performedByName
    ) {
        performedByName = trimmedResponsible;
    }

    return {
        performed_by_user_id: performedByUserId,
        performed_by_name: performedByName,
        user_id: current.user_id || performedByUserId || null
    };
}

/* Entrada: cartões clicáveis + checklist de três estados + data/hora automáticas. */
if (global.IntakeModuleController) {
    const p = global.IntakeModuleController.prototype;
    const load = p.onLoad, render = p.render, bind = p.bindEvents, validate = p.onValidate, save = p.onSave, unmount = p.onUnmount;
    p.onLoad = async function (context) {
        this.__avi = active(context);
        if (!this.__avi) return load.call(this, context);
        this.initialValues = Object.assign({}, context.intake || {});
        if (!this.initialValues.entry_date) this.initialValues.entry_date = localDate();
        if (!this.initialValues.entry_time) this.initialValues.entry_time = localTime();
        if (!String(this.initialValues.responsible || "").trim()) {
            const currentCase =
                global.auroraRuntime &&
                typeof global.auroraRuntime.getCase === "function"
                    ? global.auroraRuntime.getCase()
                    : {};
            this.initialValues.responsible =
                String(currentCase.performed_by_name || "").trim() ||
                readLoggedInUserFullName();
        }
    };
    p.render = async function () {
        if (!this.__avi) return render.call(this);
        const v=this.initialValues, services=list(v.requested_services || v.reason), received=list(v.received_items);
        return `<section class="aurora-module avi-screen avi-intake" data-module="intake">${hero(3)}
        ${choiceGroup("Serviço solicitado","Marque uma ou várias opções.",SERVICES,services,"requested_services")}
        ${choiceGroup("Itens recebidos","Objetos e acessórios entregues com o veículo.",RECEIVED,received,"received_items")}
        <article class="avi-card"><header><div><h2>Checklist de inspeção</h2><p>Toque no estado observado em cada item.</p></div><span class="avi-count" data-check-count>0/8</span></header>
        <div class="avi-checklist">${CHECKS.map(([id,label])=>`<div class="avi-check" data-check="${id}"><strong>${label}</strong><div>${["OK","Atenção","Reparo"].map(state=>`<label class="avi-state avi-state--${state==='OK'?'ok':state==='Atenção'?'warn':'bad'}${v[id]===state?' is-selected':''}"><input type="radio" name="${id}" value="${state}" ${v[id]===state?'checked':''}><span>${state}</span></label>`).join("")}</div></div>`).join("")}</div></article>
        <article class="avi-card avi-meta"><div class="avi-grid"><label class="avi-full"><span>Responsável pela vistoria</span><input name="responsible" type="text" value="${esc(v.responsible || "")}" placeholder="Quem realizou esta vistoria"></label><label><span>Nível de combustível</span><select name="fuel_level"><option value="">Selecione</option>${["Reserva","1/4","1/2","3/4","Cheio"].map(x=>`<option ${v.fuel_level===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>Estepe</span><select name="spare_tire"><option value="">Selecione</option>${["OK","Atenção","Ausente","Não verificado"].map(x=>`<option ${v.spare_tire===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>Data de entrada</span><input name="entry_date" type="date" value="${esc(v.entry_date)}"></label><label><span>Hora de entrada</span><input name="entry_time" type="time" value="${esc(v.entry_time)}"></label><label class="avi-full"><span>Observações do checklist</span><textarea name="initial_condition" placeholder="Informe somente quando houver alguma condição relevante.">${esc(v.initial_condition)}</textarea></label></div></article></section>`;
    };
    p.bindEvents = async function (container) {
        if (!this.__avi) return bind.call(this, container);
        detachAviIntakeChange(this);
        this.form = container.querySelector('[data-module="intake"]');
        if (!this.form) return;
        const form = this.form;
        const update = () => syncAviIntakeSelection(form);
        this.__aviIntakeChangeHandler = update;
        this.__aviIntakeChangeTarget = form;
        form.addEventListener("change", update);
        update();
    };
    p.onUnmount = async function (context) {
        if (this.__avi) {
            detachAviIntakeChange(this);
        }
        return unmount.call(this, context);
    };
    p.onValidate = async function () {
        if (!this.__avi) return validate.call(this);
        return this.form.querySelectorAll('input[name="requested_services"]:checked').length > 0;
    };
    p.onSave = async function () {
        if (!this.__avi) return save.call(this);
        const one=n=>{
            const field=this.form.querySelector(`[name="${n}"]`);
            if(!field)return "";
            if(field.type==="radio"||field.type==="checkbox"){
                return this.form.querySelector(`[name="${n}"]:checked`)?.value||"";
            }
            return field.value||"";
        };
        const many=n=>[...this.form.querySelectorAll(`[name="${n}"]:checked`)].map(x=>x.value);
        const intake={requested_services:many('requested_services'),reason:many('requested_services').join(' • '),received_items:many('received_items'),responsible:one('responsible'),fuel_level:one('fuel_level'),spare_tire:one('spare_tire'),entry_date:one('entry_date'),entry_time:one('entry_time'),initial_condition:one('initial_condition')};
        CHECKS.forEach(([id])=>intake[id]=one(id));
        const rt=global.auroraRuntime, current=rt&&rt.getCase?rt.getCase():{};
        const performedBy=buildPerformedBySnapshot(current, intake.responsible);
        return Object.assign({
            intake,
            asset:Object.assign({},current.asset||{}, {fuel_level:intake.fuel_level,spare_tire:intake.spare_tire})
        }, performedBy);
    };
}

function currentCase(){const rt=global.auroraRuntime;return rt&&rt.getCase?rt.getCase():{};}
function photoCount(group){return Array.isArray(group&&group.photos)?group.photos.length:0;}
function slotHasRealPhoto(label){
    return Boolean(getHydratedGuidePhoto(label));
}
function capturedPhotoCount(){
    return GUIDED_SEQUENCE.reduce((total,label)=>total+(slotHasRealPhoto(label)?1:0),0);
}
function damageOccurrenceCount(groups){
    return (groups||[]).filter(group=>
        group&&group.record_kind!=="vehicle_guided_photo"&&!PHOTO_GUIDE.slice(0,-1).some(label=>legacyGuideTitles(label).includes(String(group.title||"").trim().toLocaleLowerCase("pt-BR")))
    ).length;
}
async function openEvidence(options){
    const api=global.AuroraEvidenceFeature;
    if(!api||typeof api.createGroup!=='function')return false;
    const result=await api.createGroup(options||{});
    document.querySelector(`[data-evidence-group="${result&&result.group&&result.group.id||''}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});
    return Boolean(result&&result.created);
}
const GUIDE_ASSETS = {
    front: "./assets/guided-photos/vehicle_front_guide.png",
    rear: "./assets/guided-photos/vehicle_rear_guide.png",
    right: "./assets/guided-photos/vehicle_right_guide.png",
    left: "./assets/guided-photos/vehicle_left_guide.png",
    dashboard: "./assets/guided-photos/dashboard_odometer_guide.png"
};

function carGraphic(){
    return `<article class="avi-card avi-damage"><header><div><h2>Registro visual do veículo</h2><p>Toque em uma região para ir até o card correspondente.</p></div></header><div class="avi-car-wrap"><div class="avi-car-visual" role="group" aria-label="Perspectivas dianteira e traseira do veículo"><img src="./assets/vehicle/aurora-vehicle-perspectives-v1.png" alt="Veículo visto em perspectiva dianteira e traseira"><button type="button" class="avi-car-hotspot avi-car-hotspot--front" data-car-part="Frente" aria-label="Ir para o card Frente do veículo"></button><button type="button" class="avi-car-hotspot avi-car-hotspot--left" data-car-part="Lateral esquerda" aria-label="Ir para o card Lateral esquerda"></button><button type="button" class="avi-car-hotspot avi-car-hotspot--rear" data-car-part="Traseira" aria-label="Ir para o card Traseira do veículo"></button><button type="button" class="avi-car-hotspot avi-car-hotspot--right" data-car-part="Lateral direita" aria-label="Ir para o card Lateral direita"></button><button type="button" class="avi-car-hotspot avi-car-hotspot--dashboard" data-car-part="Painel / km" aria-label="Ir para o card Painel / KM"></button></div></div></article>`;
}
const PHOTO_GUIDE=['Frente','Traseira','Lateral esquerda','Lateral direita','Painel / km','Avarias'];
const EXTERNAL_RING=['Frente','Lateral direita','Traseira','Lateral esquerda'];
const DASHBOARD_LABEL='Painel / km';
const GUIDED_SEQUENCE=EXTERNAL_RING.concat([DASHBOARD_LABEL]);
const CAPTURE_COPY={
    'Frente':'Foto da frente do veículo',
    'Lateral direita':'Foto da lateral direita',
    'Traseira':'Foto da traseira do veículo',
    'Lateral esquerda':'Foto da lateral esquerda',
    'Painel / km':'Foto do painel / KM'
};
const PHOTO_META={
    'Frente':{slot:'front',title:'Frente do veículo',guideAsset:GUIDE_ASSETS.front},
    'Traseira':{slot:'rear',title:'Traseira do veículo',guideAsset:GUIDE_ASSETS.rear},
    'Lateral esquerda':{slot:'left',title:'Lateral esquerda do veículo',guideAsset:GUIDE_ASSETS.left},
    'Lateral direita':{slot:'right',title:'Lateral direita do veículo',guideAsset:GUIDE_ASSETS.right},
    'Painel / km':{slot:'dashboard',title:'Painel / KM (Odômetro)',guideAsset:GUIDE_ASSETS.dashboard}
};
function guideAssetForLabel(label){
    return PHOTO_META[label] && PHOTO_META[label].guideAsset
        ? PHOTO_META[label].guideAsset
        : "";
}
function photoGuideCardId(label){
    const meta=PHOTO_META[label];
    return meta && meta.slot ? `avi-photo-card-${meta.slot}` : "";
}
function scrollToGuidedPhotoCard(label, options){
    options=options||{};
    const cardId=photoGuideCardId(label);
    const card=cardId ? document.getElementById(cardId) : null;
    if(!card){
        return false;
    }
    card.scrollIntoView({
        behavior:"smooth",
        block:"center"
    });
    if(options.highlight!==false){
        card.classList.add("is-scroll-highlight");
        window.setTimeout(()=>{
            card.classList.remove("is-scroll-highlight");
        },1400);
    }
    return true;
}
function guideTitle(label){return PHOTO_META[label]?.title||'';}
function legacyGuideTitles(label){return [guideTitle(label),`Foto ${label}`].map(value=>value.toLocaleLowerCase('pt-BR'));}
function liveGuidedGroupBySlot(slot){
    if(!slot)return null;
    const api=global.AuroraEvidenceFeature;
    if(!api||typeof api.getGroups!=='function')return null;
    return (api.getGroups()||[]).find(group=>
        group&&group.record_kind==='vehicle_guided_photo'&&group.vehicle_photo_slot===slot
    )||null;
}
function liveGuidedGroupForLabel(label){
    const meta=PHOTO_META[label];
    return meta&&meta.slot?liveGuidedGroupBySlot(meta.slot):null;
}
function guideGroup(label){
    if(label==='Avarias')return null;
    const live=liveGuidedGroupForLabel(label);
    if(live)return live;
    const meta=PHOTO_META[label], titles=legacyGuideTitles(label);
    return (currentCase().evidence_groups||[]).find(group=>
        (group&&group.record_kind==='vehicle_guided_photo'&&group.vehicle_photo_slot===meta.slot)||
        titles.includes(String(group&&group.title||'').trim().toLocaleLowerCase('pt-BR'))
    )||null;
}
function getHydratedGuidePhoto(label){
    const live=liveGuidedGroupForLabel(label);
    if(live&&Array.isArray(live.photos)&&live.photos.length){
        const photo=live.photos[0];
        if(photo&&(photo.edited_src||photo.src)){
            return {group:live,photo};
        }
    }
    const reference=guideGroup(label);
    if(!reference||!reference.id)return null;
    const api=global.AuroraEvidenceFeature;
    if(!api||typeof api.getGroups!=='function')return null;
    const hydrated=(api.getGroups()||[]).find(group=>group&&group.id===reference.id);
    if(!hydrated||!Array.isArray(hydrated.photos)||!hydrated.photos.length)return null;
    const photo=hydrated.photos[0];
    if(!(photo&&(photo.edited_src||photo.src)))return null;
    return {group:hydrated,photo};
}
function slotHasPersistedPhoto(label){
    const live=liveGuidedGroupForLabel(label);
    if(live){
        if(live.saved_at)return true;
        if(Array.isArray(live.photos)&&live.photos.some(photo=>
            photo&&(photo.has_photo||photo.src||photo.edited_src)
        ))return true;
    }
    const group=guideGroup(label);
    if(!group)return false;
    if(group.saved_at)return true;
    return Array.isArray(group.photos)&&group.photos.some(photo=>
        photo&&(photo.has_photo||photo.src||photo.edited_src)
    );
}
function slotAwaitingHydration(label){
    return !getHydratedGuidePhoto(label)&&slotHasPersistedPhoto(label);
}
function guidePhoto(label){
    const hydrated=getHydratedGuidePhoto(label);
    if(hydrated)return hydrated;
    const group=guideGroup(label);
    if(!group||!Array.isArray(group.photos)||!group.photos.length)return null;
    const photo=group.photos[0];
    if(photo&&(photo.edited_src||photo.src))return {group,photo};
    return null;
}
function photoGuideMarkup(){
    const groups=currentCase().evidence_groups||[];
    return PHOTO_GUIDE.map(label=>{
        if(label==='Avarias'){
            const amount=damageOccurrenceCount(groups);
            return `<button type="button" data-photo-guide="${label}" class="avi-photo-guide avi-photo-guide--damage${amount?' is-done':''}"><span class="avi-photo-icon">${amount?'✓':'+'}</span><strong>Avarias</strong><small>${amount?`${amount} registro(s)`:'Adicionar ocorrência'}</small></button>`;
        }
        const found=guidePhoto(label);
        const src=found&&(found.photo.edited_src||found.photo.src);
        const pending=slotAwaitingHydration(label);
        const cardId=photoGuideCardId(label);
        const cardClass=[
            "avi-photo-guide",
            found?"is-done has-real-photo":"",
            pending?"has-pending-photo is-hydrating":"",
            !found&&!pending?"has-guide":""
        ].filter(Boolean).join(" ");
        const cardAttrs=[
            'type="button"',
            `data-photo-guide="${esc(label)}"`,
            cardId ? `id="${esc(cardId)}"` : "",
            `class="${cardClass}"`
        ].join(" ");
        if(src){
            return `<button ${cardAttrs}><span class="avi-photo-thumb avi-photo-thumb--contain"><img src="${esc(src)}" alt="${esc(guideTitle(label))}"><span type="button" data-guided-photo-replace aria-label="Substituir foto">&#9998;</span></span><strong>${esc(label)}</strong><small>Foto adicionada · toque para visualizar</small></button>`;
        }
        if(pending){
            return `<button ${cardAttrs} aria-busy="true"><span class="avi-photo-pending" aria-hidden="true"></span><strong>${esc(label)}</strong><small>Carregando foto salva…</small></button>`;
        }
        const guideSrc=guideAssetForLabel(label);
        return `<button ${cardAttrs}><span class="avi-photo-guide-visual"><img src="${esc(guideSrc)}" alt="Guia ${esc(label)}" class="avi-photo-guide-img"></span><strong>${esc(label)}</strong><small>Toque para adicionar foto</small></button>`;
    }).join('');
}
function photoGuideSignature(){
    return PHOTO_GUIDE.map(label=>{
        if(label==='Avarias')return `damage:${damageOccurrenceCount(currentCase().evidence_groups||[])}`;
        const found=guidePhoto(label), photo=found&&found.photo;
        const pending=slotAwaitingHydration(label);
        return `${label}:${found&&found.group.id||''}:${photo&&photo.id||''}:${photo&&(photo.edited_src||photo.src)||''}:${pending?'pending':''}`;
    }).join('|');
}
function evidenceExtras(){
    return `${carGraphic()}<article class="avi-card avi-photos"><header><div><h2>Fotos da vistoria</h2><p>Toque nos cards ou no desenho do veículo para registrar cada ângulo.</p></div><span class="avi-count" data-avi-photo-count>${capturedPhotoCount()}</span></header><div class="avi-photo-grid" data-avi-photo-grid>${photoGuideMarkup()}</div></article>`;
}
let guidedCaptureBusy=false;
let pendingGuidedCaptureLabel=null;
let guidedCaptureSuppressSequence=false;
let guidedPhotoViewerBackHandler=null;
let guidedFileInput=null;
function guidedCaptureLog(entry){
    if(!Array.isArray(global.__GUIDED_PHOTO_CAPTURE_LOG__))global.__GUIDED_PHOTO_CAPTURE_LOG__=[];
    global.__GUIDED_PHOTO_CAPTURE_LOG__.push(Object.assign({at:new Date().toISOString()},entry));
}
function ensureGuidedFileInput(){
    if(guidedFileInput&&guidedFileInput.isConnected)return guidedFileInput;
    guidedFileInput=document.createElement("input");
    guidedFileInput.type="file";
    guidedFileInput.accept="image/*";
    guidedFileInput.hidden=true;
    guidedFileInput.setAttribute("data-avi-guided-file-input","");
    guidedFileInput.addEventListener("change",()=>{
        void handleGuidedFileInputChange();
    });
    document.body.appendChild(guidedFileInput);
    return guidedFileInput;
}
async function handleGuidedFileInputChange(sourceInput){
    const input=sourceInput||ensureGuidedFileInput();
    const owningSheet=sourceInput&&typeof sourceInput.closest==="function"
        ? sourceInput.closest("[data-guided-photo-source]")
        : null;
    const label=pendingGuidedCaptureLabel||input.dataset.pendingLabel||"";
    const files=Array.from(input.files||[]);
    const meta=PHOTO_META[label]||null;
    const logBase={
        slot:meta?meta.slot:null,
        label:label||null,
        inputFilesLength:files.length,
        fileName:files[0]?files[0].name:null,
        fileType:files[0]?files[0].type:null,
        fileSize:files[0]?files[0].size:null,
        fileReceived:files.length>0
    };
    if(!label||!files.length){
        guidedCaptureLog(Object.assign(logBase,{processed:false,reason:"missing-label-or-file"}));
        input.value="";
        pendingGuidedCaptureLabel=null;
        delete input.dataset.pendingLabel;
        return;
    }
    try{
        const saved=await saveGuidedPhotoForLabel(label,files);
        const found=saved?guidePhoto(label):null;
        const photo=found&&found.photo;
        const src=photo&&(photo.edited_src||photo.src)||"";
        guidedCaptureLog(Object.assign(logBase,{
            processed:Boolean(saved),
            srcType:src? (String(src).startsWith("data:")?"data-url":String(src).startsWith("blob:")?"blob":"other") :null,
            srcLength:src?String(src).length:0,
            storedInIndexedDB:Boolean(saved&&found&&found.group&&found.group.saved_at),
            groupId:found&&found.group?found.group.id:null,
            vehicle_photo_slot:meta?meta.slot:null,
            hydrated:Boolean(found&&photo&&src),
            rendered:Boolean(document.querySelector(`[data-photo-guide="${label}"]`)?.classList.contains("has-real-photo"))
        }));
    }catch(error){
        console.error(error);
        guidedCaptureLog(Object.assign(logBase,{processed:false,error:String(error&&error.message||error)}));
    }finally{
        input.value="";
        pendingGuidedCaptureLabel=null;
        delete input.dataset.pendingLabel;
        if(owningSheet){
            closeGuidedPhotoSourceSheet(owningSheet);
        }
    }
}
function firstEmptyExternalLabel(preferFront){
    if(preferFront&&!slotHasPersistedPhoto('Frente'))return 'Frente';
    for(const label of EXTERNAL_RING){
        if(!slotHasPersistedPhoto(label))return label;
    }
    return null;
}
function nextEmptyInExternalRing(fromLabel){
    const startIndex=EXTERNAL_RING.indexOf(fromLabel);
    if(startIndex<0)return firstEmptyExternalLabel(true);
    for(let step=1;step<=EXTERNAL_RING.length;step+=1){
        const label=EXTERNAL_RING[(startIndex+step)%EXTERNAL_RING.length];
        if(!slotHasPersistedPhoto(label))return label;
    }
    return null;
}
function nextGuidedSequenceLabel(fromLabel){
    if(!fromLabel)return null;
    if(fromLabel===DASHBOARD_LABEL){
        return firstEmptyExternalLabel(true);
    }
    if(EXTERNAL_RING.includes(fromLabel)){
        const nextExternal=nextEmptyInExternalRing(fromLabel);
        if(nextExternal)return nextExternal;
        if(!slotHasPersistedPhoto(DASHBOARD_LABEL))return DASHBOARD_LABEL;
        return null;
    }
    return null;
}
function labelFromSlot(slot){
    const entry=Object.entries(PHOTO_META).find(([,meta])=>meta.slot===slot);
    return entry?entry[0]:null;
}
function closeGuidedPhotoSourceSheet(sheet){
    if(sheet){
        if(sheet.isConnected)sheet.remove();
    }else{
        document.querySelectorAll("[data-guided-photo-source]").forEach(node=>node.remove());
    }
    if(!document.querySelector("[data-guided-photo-source]")){
        document.documentElement.classList.remove("aurora-guided-source-open");
        if(guidedPhotoViewerBackHandler===closeGuidedPhotoSourceSheet){
            guidedPhotoViewerBackHandler=null;
        }
    }
}
function openGuidedPhotoSourceSheet(label){
    if(!label||label==="Avarias")return false;
    closeGuidedPhotoSourceSheet();
    pendingGuidedCaptureLabel=label;
    const copy=CAPTURE_COPY[label]||guideTitle(label);
    const root=document.createElement("div");
    root.className="avi-guided-viewer-backdrop aurora-photo-source-sheet";
    root.setAttribute("data-guided-photo-source","");
    root.innerHTML=[
        `<section class="avi-guided-viewer" role="dialog" aria-modal="true" aria-labelledby="avi-guided-source-title">`,
        `<h2 id="avi-guided-source-title" class="avi-guided-viewer__title">${esc(copy)}</h2>`,
        `<div class="aurora-evidence-actions">`,
        `<label class="aurora-evidence-action is-primary">`,
        `<input type="file" accept="image/*" capture="environment" data-guided-source-camera>`,
        `<span aria-hidden="true">📷</span>Tirar foto`,
        `</label>`,
        `<label class="aurora-evidence-action">`,
        `<input type="file" accept="image/*" data-guided-source-gallery>`,
        `<span aria-hidden="true">🖼️</span>Escolher da galeria`,
        `</label>`,
        `</div>`,
        `<div class="avi-guided-viewer__actions">`,
        `<button type="button" class="is-secondary" data-guided-source-cancel>Cancelar</button>`,
        `</div>`,
        `</section>`
    ].join("");
    const cameraInput=root.querySelector("[data-guided-source-camera]");
    const galleryInput=root.querySelector("[data-guided-source-gallery]");
    const onPick=(input)=>{
        pendingGuidedCaptureLabel=label;
        input.dataset.pendingLabel=label;
        void handleGuidedFileInputChange(input);
    };
    cameraInput.addEventListener("change",()=>onPick(cameraInput));
    galleryInput.addEventListener("change",()=>onPick(galleryInput));
    root.querySelector("[data-guided-source-cancel]").addEventListener("click",()=>closeGuidedPhotoSourceSheet(root));
    root.addEventListener("click",event=>{
        if(event.target===root)closeGuidedPhotoSourceSheet(root);
    });
    document.body.appendChild(root);
    document.documentElement.classList.add("aurora-guided-source-open");
    guidedPhotoViewerBackHandler=closeGuidedPhotoSourceSheet;
    return true;
}
async function promptGuidedCapture(label,options){
    options=options||{};
    if(!label||label==='Avarias')return false;
    scrollToGuidedPhotoCard(label,{highlight:true});
    if(!options.isNext){
        return openGuidedPhotoSourceSheet(label);
    }
    if(guidedCaptureBusy)return false;
    const copy=CAPTURE_COPY[label]||guideTitle(label);
    const dialog=global.AuroraDialog;
    if(!dialog||typeof dialog.confirm!=='function')return false;
    guidedCaptureBusy=true;
    try{
        const accepted=await dialog.confirm('',{
            title:copy,
            layout:'simple',
            hideBrand:true,
            centered:true,
            interceptBack:true,
            confirmLabel:'Adicionar foto',
            cancelLabel:'Agora não'
        });
        if(!accepted)return false;
        return openGuidedPhotoSourceSheet(label);
    }finally{
        guidedCaptureBusy=false;
    }
}
function triggerGuidedFilePicker(label){
    return openGuidedPhotoSourceSheet(label);
}
async function saveGuidedPhotoForLabel(label,fileList){
    const api=global.AuroraEvidenceFeature, meta=PHOTO_META[label];
    const files=Array.from(fileList||[]);
    if(!api||!meta||typeof api.saveGuidedSlotPhoto!=="function"||!files.length)return false;
    guidedCaptureSuppressSequence=slotHasRealPhoto(label);
    await api.saveGuidedSlotPhoto({
        slot:meta.slot,
        vehicle_photo_slot:meta.slot,
        title:meta.title
    },files);
    refreshPhotoGuide({force:true});
    const found=guidePhoto(label);
    return Boolean(found&&found.photo&&(found.photo.src||found.photo.edited_src));
}
function closeGuidedPhotoViewer(){
    document.querySelectorAll("[data-guided-photo-viewer]").forEach(node=>node.remove());
    document.documentElement.classList.remove("aurora-guided-viewer-open");
    guidedPhotoViewerBackHandler=null;
}
async function deleteGuidedPhoto(label){
    const meta=PHOTO_META[label], dialog=global.AuroraDialog, api=global.AuroraEvidenceFeature;
    if(!meta||!dialog||typeof dialog.confirm!=="function"||!api||typeof api.clearGuidedSlotPhoto!=="function")return false;
    const previousViewerHandler=guidedPhotoViewerBackHandler;
    guidedPhotoViewerBackHandler=null;
    const accepted=await dialog.confirm("",{
        title:`Excluir foto da ${label.toLowerCase()}?`,
        layout:"simple",
        hideBrand:true,
        centered:true,
        interceptBack:true,
        confirmLabel:"Excluir",
        cancelLabel:"Cancelar",
        tone:"danger"
    });
    if(!accepted){
        guidedPhotoViewerBackHandler=previousViewerHandler;
        return false;
    }
    closeGuidedPhotoViewer();
    await api.clearGuidedSlotPhoto(meta.slot);
    refreshPhotoGuide({force:true});
    return true;
}
async function replaceGuidedPhoto(label){
    guidedCaptureSuppressSequence=true;
    closeGuidedPhotoViewer();
    return openGuidedPhotoSourceSheet(label);
}
async function openGuidedPhotoViewer(label){
    const found=guidePhoto(label);
    if(!found)return false;
    const src=found.photo.edited_src||found.photo.src;
    if(!src)return false;
    closeGuidedPhotoViewer();
    const root=document.createElement("div");
    root.className="avi-guided-viewer-backdrop";
    root.setAttribute("data-guided-photo-viewer","");
    root.innerHTML=[
        `<section class="avi-guided-viewer" role="dialog" aria-modal="true" aria-labelledby="avi-guided-viewer-title">`,
        `<div class="avi-guided-viewer__media"><img src="${esc(src)}" alt="${esc(label)}"></div>`,
        `<h2 id="avi-guided-viewer-title" class="avi-guided-viewer__title">${esc(label)}</h2>`,
        `<div class="avi-guided-viewer__actions">`,
        `<button type="button" class="is-primary" data-guided-viewer-replace>Substituir foto</button>`,
        `<button type="button" class="is-danger" data-guided-viewer-delete>Excluir foto</button>`,
        `<button type="button" class="is-secondary" data-guided-viewer-close>Fechar</button>`,
        `</div>`,
        `</section>`
    ].join("");
    document.body.appendChild(root);
    document.documentElement.classList.add("aurora-guided-viewer-open");
    guidedPhotoViewerBackHandler=closeGuidedPhotoViewer;
    root.querySelector("[data-guided-viewer-close]").addEventListener("click",closeGuidedPhotoViewer);
    root.querySelector("[data-guided-viewer-replace]").addEventListener("click",()=>{
        void replaceGuidedPhoto(label);
    });
    root.querySelector("[data-guided-viewer-delete]").addEventListener("click",()=>{
        void deleteGuidedPhoto(label);
    });
    root.addEventListener("click",event=>{
        if(event.target===root)closeGuidedPhotoViewer();
    });
    return true;
}
function installGuidedPhotoBackPressBridge(){
    if(global.__AVI_GUIDED_BACK_BRIDGE__)return;
    const dialog=global.AuroraDialog;
    if(!dialog||typeof dialog.consumeBackPress!=="function")return;
    const originalConsume=dialog.consumeBackPress.bind(dialog);
    dialog.consumeBackPress=function(){
        if(typeof guidedPhotoViewerBackHandler==="function"){
            guidedPhotoViewerBackHandler();
            return true;
        }
        return originalConsume();
    };
    global.__AVI_GUIDED_BACK_BRIDGE__=true;
}
async function advanceGuidedSequence(fromLabel){
    const next=nextGuidedSequenceLabel(fromLabel);
    if(next){
        await promptGuidedCapture(next,{isNext:true});
        return;
    }
    if(GUIDED_SEQUENCE.every(label=>slotHasPersistedPhoto(label))){
        const dialog=global.AuroraDialog;
        if(dialog&&typeof dialog.alert==='function'){
            await dialog.alert('Registro fotográfico principal concluído.',{title:'Fotos da vistoria'});
        }
    }
}
async function handleGuidedLabelAction(label,options){
    options=options||{};
    if(!label||label==='Avarias')return;
    scrollToGuidedPhotoCard(label,{highlight:true});
    if(options.forceReplace){
        guidedCaptureSuppressSequence=true;
        openGuidedPhotoSourceSheet(label);
        return;
    }
    if(options.forceCapture||!slotHasRealPhoto(label)){
        await promptGuidedCapture(label,{isNext:false});
        return;
    }
    await openGuidedPhotoViewer(label);
}
async function openGuidedPhoto(label){
    return handleGuidedLabelAction(label);
}
function refreshPhotoGuide(options){
    options=options||{};
    const grid=document.querySelector('[data-avi-photo-grid]'), count=document.querySelector('[data-avi-photo-count]'); if(!grid)return;
    const signature=photoGuideSignature();
    if(options.force||grid.dataset.signature!==signature){
        grid.dataset.signature=signature;
        grid.innerHTML=photoGuideMarkup();
    }
    const total=String(capturedPhotoCount());
    if(count&&count.textContent!==total)count.textContent=total;
}
function setupEvidence(){
    const node=document.querySelector('[data-module="evidence"]'); if(!node||!active(currentCase()))return;
    node.classList.add('avi-screen');
    if(!node.querySelector('.avi-hero'))node.insertAdjacentHTML('afterbegin',hero(4));
    const hub=node.querySelector('[data-evidence-hub]');
    if(hub&&!node.querySelector('.avi-evidence-extras')){
        hub.insertAdjacentHTML('beforebegin',`<div class="avi-evidence-extras">${evidenceExtras()}</div>`);
        node.addEventListener('click',async e=>{
            const replaceShortcut=e.target.closest('[data-guided-photo-replace]');
            if(replaceShortcut){
                e.preventDefault();
                e.stopPropagation();
                const card=replaceShortcut.closest('[data-photo-guide]');
                const label=card&&card.dataset.photoGuide;
                if(label&&label!=='Avarias'){
                    await handleGuidedLabelAction(label,{forceReplace:true});
                }
                return;
            }
            const part=e.target.closest('[data-car-part]');
            if(part){
                e.preventDefault();
                await handleGuidedLabelAction(part.dataset.carPart);
                return;
            }
            const photo=e.target.closest('[data-photo-guide]');
            if(photo){
                const label=photo.dataset.photoGuide;
                if(label==='Avarias')await openEvidence({title:'',item:'',severity:'Média',description:'',recommendation:''});
                else await handleGuidedLabelAction(label);
            }
        });
        ensureGuidedFileInput();
        installGuidedPhotoBackPressBridge();
    } else if(node.querySelector('[data-avi-photo-grid]')){
        refreshPhotoGuide();
    }
    const hydrateCards=async()=>{
        const needsHydration=PHOTO_GUIDE.slice(0,-1).some(label=>slotAwaitingHydration(label));
        if(
            needsHydration &&
            global.AuroraEvidenceFeature &&
            typeof global.AuroraEvidenceFeature.reload==='function'
        ){
            await global.AuroraEvidenceFeature.reload();
        }
        refreshPhotoGuide();
    };
    if(node.querySelector('[data-avi-photo-grid]')){
        hydrateCards().catch(()=>refreshPhotoGuide());
    }
}

/* Resumo e assinatura opcional na última etapa. */
if(global.DiagnosticModuleController){
    const p=global.DiagnosticModuleController.prototype, load=p.onLoad, bind=p.bindEvents, save=p.onSave;
    p.onLoad=async function(context){
        this.__avi=active(context);
        if(
            global.AuroraBugARuntimeTrace&&
            typeof global.AuroraBugARuntimeTrace.capture==="function"
        ){
            global.AuroraBugARuntimeTrace.capture(
                "E",
                context&&Array.isArray(context.evidence_groups)?context.evidence_groups:[],
                {note:"Diagnostic onLoad context.evidence_groups"}
            );
        }
        await load.call(this,context);
        this.__aviContext=context||{};
    };
    p.bindEvents=async function(container){
        await bind.call(this,container); if(!this.__avi)return;
        const module=container.querySelector('[data-module="diagnostic"]'); module?.classList.add('avi-screen');
        if(module&&!module.querySelector('.avi-hero'))module.insertAdjacentHTML('afterbegin',hero(5));
        const c=this.__aviContext||{}, a=c.asset||{}, i=c.intake||{}, groups=c.evidence_groups||[], approval=c.approval||{};
        const services=list(i.requested_services||i.reason);
        const fields=this.form?.querySelector('.aurora-form__fields'); if(!fields)return;
        fields.insertAdjacentHTML('afterbegin',`<article class="avi-card avi-summary"><header><div><h2>Resumo do recebimento</h2><p>Confira antes de finalizar.</p></div><span class="avi-count">5/5</span></header><dl><div><dt>Veículo</dt><dd>${esc([a.identification,a.plate].filter(Boolean).join(' • ')||'Não informado')}</dd></div><div><dt>Quilometragem</dt><dd>${esc(a.mileage?`${a.mileage} km`:'Não informada')}</dd></div><div><dt>Serviços marcados</dt><dd>${services.length}</dd></div><div><dt>Avarias registradas</dt><dd>${groups.filter(g=>g&&g.record_kind!=='vehicle_guided_photo').length}</dd></div><div><dt>Fotos adicionadas</dt><dd>${capturedPhotoCount(groups)}</dd></div></dl></article>`);
        fields.insertAdjacentHTML('beforeend',`<article class="avi-card avi-signature"><label class="avi-signature-toggle"><input type="checkbox" name="collect_signature" ${approval.collect_signature?'checked':''}><span>Coletar assinatura do cliente</span></label><div class="avi-signature-pad" ${approval.collect_signature?'':'hidden'}><p>Assine no espaço abaixo com dedo ou caneta</p><canvas width="720" height="220"></canvas><div class="avi-signature-actions"><button type="button" data-confirm-signature>Confirmar assinatura</button><button type="button" data-clear-signature>Limpar</button><button type="button" data-cancel-signature>Cancelar</button></div><p class="avi-signature-status" data-signature-status ${approval.signature_data?'':'hidden'}>${approval.signature_data?'Assinatura confirmada':'Assinatura pendente'}</p></div></article>`);
        const toggle=fields.querySelector('[name="collect_signature"]'), pad=fields.querySelector('.avi-signature-pad'), canvas=pad.querySelector('canvas'), ctx=canvas.getContext('2d'), status=fields.querySelector('[data-signature-status]'); let drawing=false;
        this.__aviSignatureData=approval.signature_data||'';
        this.__aviSignatureConfirmed=Boolean(approval.signature_data);
        ctx.lineWidth=3;ctx.lineCap='round';ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--aurora-primary')||'#119a94';
        if(approval.signature_data){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);img.src=approval.signature_data;}
        const syncSignatureStatus=(message,visible=true)=>{if(!status)return;status.textContent=message||'';status.hidden=!visible;};
        const point=e=>{const r=canvas.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return [(t.clientX-r.left)*canvas.width/r.width,(t.clientY-r.top)*canvas.height/r.height];};
        const start=e=>{drawing=true;ctx.beginPath();ctx.moveTo(...point(e));e.preventDefault();}, move=e=>{if(!drawing)return;ctx.lineTo(...point(e));ctx.stroke();e.preventDefault();}, end=()=>{drawing=false;this.__aviSignatureConfirmed=false;syncSignatureStatus('Assinatura pendente — toque em Confirmar',true);};
        ['pointerdown','touchstart'].forEach(x=>canvas.addEventListener(x,start,{passive:false}));['pointermove','touchmove'].forEach(x=>canvas.addEventListener(x,move,{passive:false}));['pointerup','pointerleave','touchend'].forEach(x=>canvas.addEventListener(x,end));
        toggle.addEventListener('change',()=>{pad.hidden=!toggle.checked;if(!toggle.checked){syncSignatureStatus('',false);}});
        fields.querySelector('[data-clear-signature]').addEventListener('click',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);this.__aviSignatureData='';this.__aviSignatureConfirmed=false;syncSignatureStatus('Assinatura limpa',true);});
        fields.querySelector('[data-cancel-signature]').addEventListener('click',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);this.__aviSignatureData='';this.__aviSignatureConfirmed=false;toggle.checked=false;pad.hidden=true;syncSignatureStatus('',false);});
        fields.querySelector('[data-confirm-signature]').addEventListener('click',()=>{if(!toggle.checked)return;const blank=document.createElement('canvas');blank.width=canvas.width;blank.height=canvas.height;if(canvas.toDataURL('image/png')===blank.toDataURL('image/png')){syncSignatureStatus('Desenhe a assinatura antes de confirmar',true);return;}this.__aviSignatureData=canvas.toDataURL('image/png');this.__aviSignatureConfirmed=true;syncSignatureStatus('Assinatura confirmada',true);});
        this.__aviSignature=()=>toggle.checked&&this.__aviSignatureConfirmed?this.__aviSignatureData||'':'';
    };
    p.onSave=async function(){const result=await save.call(this);if(!this.__avi)return result;const toggle=this.form?.querySelector('[name="collect_signature"]');result.template='legacy';result.approval=Object.assign({},result.approval,{collect_signature:!!toggle?.checked,signature_data:this.__aviSignature?this.__aviSignature():'',template:'legacy'});return result;};
}

document.addEventListener('aurora:evidence-host-ready',()=>setTimeout(setupEvidence,0));
document.addEventListener('aurora:guided-photos-changed',()=>refreshPhotoGuide());
document.addEventListener('aurora:guided-photo-saved',async event=>{
    const slot=event&&event.detail?event.detail.slot:null;
    const label=slot?labelFromSlot(slot):null;
    refreshPhotoGuide({force:true});
    if(window.__SUPPRESS_GUIDED_SEQUENCE__||guidedCaptureSuppressSequence){
        guidedCaptureSuppressSequence=false;
        return;
    }
    if(label)await advanceGuidedSequence(label);
});
let evidenceSetupFrame=0;
new MutationObserver(mutations=>{
    if(!mutations.some(m=>m.type==='childList'&&m.addedNodes.length))return;
    if(evidenceSetupFrame)return;
    evidenceSetupFrame=requestAnimationFrame(()=>{evidenceSetupFrame=0;setupEvidence();});
}).observe(document.documentElement,{childList:true,subtree:true});

installGuidedPhotoBackPressBridge();

global.AuroraVehicleInspectionPhotos={
    refresh: refreshPhotoGuide,
    scrollToCard: scrollToGuidedPhotoCard,
    guideAssetForLabel,
    GUIDE_ASSETS,
    GUIDED_SEQUENCE,
    EXTERNAL_RING,
    DASHBOARD_LABEL,
    nextGuidedSequenceLabel,
    CAPTURE_COPY,
    capturedPhotoCount,
    damageOccurrenceCount,
    saveGuidedPhotoForLabel,
    promptGuidedCapture,
    handleGuidedLabelAction,
    advanceGuidedSequence,
    ensureGuidedFileInput,
    handleGuidedFileInputChange,
    slotHasRealPhoto,
    openGuidedPhotoViewer,
    closeGuidedPhotoViewer,
    deleteGuidedPhoto,
    replaceGuidedPhoto,
    installGuidedPhotoBackPressBridge,
    slotHasPersistedPhoto,
    guideGroup,
    PHOTO_META
};

})(window);

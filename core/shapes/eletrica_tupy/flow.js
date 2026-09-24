(function (global) {
"use strict";

const SERVICE_ID = "eletrica_tupy";
const PHOTO_TITLES = ["Antes do serviço", "Durante o serviço", "Após o serviço"];
const PHOTO_SLOTS = ["antes", "durante", "depois"];
const PHOTO_ANTES_TITLE = PHOTO_TITLES[0];
const PHOTO_ANTES_SLOT = PHOTO_SLOTS[0];
const PHOTO_FINAL_TITLE = "Foto do trabalho finalizado";
const PHOTO_FINAL_SLOT = "finalizado";
const TUPY_PHASE_RECORD_KIND = "tupy_phase_photo";
const TUPY_FINAL_RECORD_KIND = "tupy_final_work";

function domain() {
    return global.AuroraEletricaTupyDomain || {};
}

function data() {
    return global.AURORA_ELETRICA_TUPY_DATA || { items: [], sugestoes: {} };
}

function active(context) {
    return String(context && context.service && context.service.id || "").toLowerCase() === SERVICE_ID;
}

function caseData() {
    const rt = global.auroraRuntime;
    return rt && typeof rt.getCase === "function" ? rt.getCase() : {};
}

function deepCloneJson(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function isAdminReviewContext(context) {
    const c = context && typeof context === "object" ? context : caseData();
    return !!(c && c.admin_review === true);
}

function isUserBoltVistoriaFlow(context) {
    if (!active(context || caseData())) return false;
    if (isAdminReviewContext(context)) return false;
    var d = domain();
    if (d.isAdminBolt && d.isAdminBolt()) return false;
    return true;
}

function adminReviewStepTotal() {
    /* ADMIN review: 5 etapas. USER_BOLT vistoria: 5 etapas. ADMIN_BOLT criação: 6. */
    if (isAdminReviewContext()) return 5;
    if (isUserBoltVistoriaFlow()) return 5;
    return 6;
}

function emptyDetail() {
    return {
        description_id: "",
        descricao: "",
        quantidade: "",
        data: "",
        day_type: "",
        day_types: [],
        tipo_dia: ""
    };
}

function emptyState() {
    const d = domain();
    return {
        servico: {
            cliente: d.CLIENT_NAME || "Tupy S.A.",
            empresa: d.EXECUTOR_NAME || "Bolt Soluções Elétricas",
            responsavel: "",
            solicitante: "",
            setor: "",
            local: "",
            ponto_referencia: "",
            titulo: "",
            descricao: "",
            data_inicio: "",
            budget_number: null
        },
        atividades: {
            iluminacao: false,
            ventiladores: false,
            escritorio: false,
            outros: false
        },
        detalhes: {
            iluminacao: emptyDetail(),
            ventiladores: emptyDetail(),
            escritorio: emptyDetail(),
            outros: Object.assign(emptyDetail(), { nome_trabalho: "" })
        },
        materiais: {},
        conclusao: {
            status: "",
            descricao: "",
            pendencias: "",
            observacoes: "",
            data: "",
            responsavel: "",
            status_auto_from_photo: false
        },
        workflow_state: (d.WORKFLOW_STATES && d.WORKFLOW_STATES.IN_PROGRESS) || "IN_PROGRESS",
        filtro: "sugeridos",
        busca: "",
        service_codes: []
    };
}

function normalizeDayType(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "weekday" || raw === "semana") return "weekday";
    if (raw === "saturday" || raw === "sabado" || raw === "sábado") return "saturday";
    if (raw === "sunday" || raw === "domingo") return "sunday";
    if (raw === "fim" || raw === "final") return "";
    return "";
}


function catalogUnitBySap(sap) {
    var pack = (typeof data === "function" ? data() : null) || {};
    var items = pack.items || [];
    var key = String(sap || "").trim();
    for (var i = 0; i < items.length; i += 1) {
        if (String(items[i].sap || "").trim() === key) {
            return String(items[i].unidade || "").trim();
        }
    }
    var pri = global.AURORA_ELETRICA_TUPY_MATERIALS_PRIORITY;
    var pItems = pri && Array.isArray(pri.items) ? pri.items : [];
    for (var j = 0; j < pItems.length; j += 1) {
        if (String(pItems[j].sap || "").trim() === key) {
            return String(pItems[j].unidade || "").trim();
        }
    }
    return "";
}

function resolveMaterialUnit(m) {
    if (!m || typeof m !== "object") return "";
    var u = String(m.unidade || m.unit || m.unidade_medida || "").trim();
    if (u) return u;
    return catalogUnitBySap(m.sap);
}

function formatMaterialQuantity(quantity, unit) {
    var raw = quantity == null ? "" : String(quantity).trim();
    if (!raw) return "";
    var n = Number(raw);
    var u = String(unit || "").trim().toLowerCase();
    if (u === "m" || u === "metro" || u === "metros") {
        if (Number.isFinite(n) && n === 1) return "1 metro";
        return raw + " metros";
    }
    if (u === "pc" || u === "pç" || u === "pçs" || u === "peca" || u === "peça" || u === "pecas" || u === "peças") {
        if (Number.isFinite(n) && n === 1) return "1 peça";
        return raw + " peças";
    }
    return raw;
}

function normalizeMaterial(m) {
    if (!m || typeof m !== "object") return m;
    var qty = m.quantity;
    if (qty == null || qty === "") qty = m.quantidade;
    if (qty == null || qty === "") qty = m.planned_quantity;
    if (qty == null || qty === "") qty = m.used_quantity;
    if (qty == null || qty === "") qty = m.utilizado;
    m.quantity = qty == null ? "" : String(qty);
    m.quantidade = m.quantity;
    delete m.planned_quantity;
    delete m.used_quantity;
    delete m.utilizado;
    if (!m.source) {
        m.source = m.origem === "custom" ? "custom" : "catalog";
    }
    return m;
}

function tupyOf(context) {
    const src = (context && context.eletrica_tupy) || (caseData().eletrica_tupy) || {};
    const base = emptyState();
    const d = domain();
    const detalhes = {
        iluminacao: Object.assign({}, base.detalhes.iluminacao, (src.detalhes || {}).iluminacao || {}),
        ventiladores: Object.assign({}, base.detalhes.ventiladores, (src.detalhes || {}).ventiladores || {}),
        escritorio: Object.assign({}, base.detalhes.escritorio, (src.detalhes || {}).escritorio || {}),
        outros: Object.assign({}, base.detalhes.outros, (src.detalhes || {}).outros || {})
    };
    ["iluminacao", "ventiladores", "escritorio", "outros"].forEach(function (id) {
        const rawTypes = Array.isArray(detalhes[id].day_types) ? detalhes[id].day_types : [];
        let types = rawTypes.map(normalizeDayType).filter(Boolean);
        if (!types.length) {
            const single = normalizeDayType(detalhes[id].day_type || detalhes[id].tipo_dia);
            if (single) types = [single];
        }
        types = types.filter(function (t, i, arr) { return arr.indexOf(t) === i; });
        detalhes[id].day_types = types;
        detalhes[id].day_type = types[0] || "";
        detalhes[id].tipo_dia = detalhes[id].day_type;
    });
    const bag = src.materiais && typeof src.materiais === "object" ? src.materiais : {};
    Object.keys(bag).forEach(function (sap) { normalizeMaterial(bag[sap]); });
    return {
        servico: Object.assign({}, base.servico, src.servico || {}, {
            cliente: d.CLIENT_NAME || "Tupy S.A.",
            empresa: d.EXECUTOR_NAME || "Bolt Soluções Elétricas"
        }),
        atividades: Object.assign({}, base.atividades, src.atividades || {}),
        detalhes: detalhes,
        materiais: bag,
        conclusao: Object.assign({}, base.conclusao, src.conclusao || {}),
        workflow_state: src.workflow_state || base.workflow_state,
        filtro: src.filtro || "sugeridos",
        busca: src.busca || "",
        service_codes: Array.isArray(src.service_codes) ? src.service_codes.slice() : []
    };
}

function sapStr(value) {
    return value == null ? "" : String(value);
}

function tipoLabel(tipo) {
    if (tipo == null || String(tipo).trim() === "") return "Tipo não informado";
    return String(tipo);
}

function esc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function selectedActivityIds(state) {
    return ["iluminacao", "ventiladores", "escritorio", "outros"].filter(function (id) {
        return state.atividades[id];
    });
}

function selectedMaterials(state) {
    return Object.keys(state.materiais || {}).map(function (k) {
        return state.materiais[k];
    }).filter(function (m) {
        return m && m.selected;
    });
}

function sectorStorageKey() {
    var account = "local";
    try {
        if (global.AuroraAccountStorage && typeof global.AuroraAccountStorage.activeUserId === "function") {
            account = global.AuroraAccountStorage.activeUserId() || "local";
        }
    } catch (error) { /* ignore */ }
    return "aurora_tupy_sectors_v1:" + account;
}

function loadCustomSectors() {
    try {
        return JSON.parse(localStorage.getItem(sectorStorageKey()) || "[]");
    } catch (error) {
        return [];
    }
}

function saveCustomSector(value) {
    const next = String(value || "").trim();
    if (!next) return loadCustomSectors();
    const list = loadCustomSectors().filter(function (item) {
        return String(item).toLowerCase() !== next.toLowerCase();
    });
    list.unshift(next);
    localStorage.setItem(sectorStorageKey(), JSON.stringify(list.slice(0, 40)));
    return list;
}

function applySuggestions(state) {
    const pack = data().sugestoes || {};
    selectedActivityIds(state).forEach(function (id) {
        (pack[id] || []).forEach(function (item) {
            const sap = sapStr(item.sap);
            if (!sap || state.materiais[sap]) return;
            state.materiais[sap] = normalizeMaterial({
                sap: sap,
                descricao: item.descricao,
                tipo: item.tipo,
                linha_excel: item.linha_excel,
                unidade: item.unidade || catalogUnitBySap(sap),
                selected: true,
                quantity: "",
                origem: "sugerido",
                source: "catalog",
                atividade: item.atividade,
                abas: item.abas || [],
                ocorrencias: item.ocorrencias || 0,
                evidencia: item.evidencia,
                classificacao: item.classificacao,
                adicional: false
            });
        });
    });
    ensurePriorityMaterials(state);
    return state;
}

function priorityMaterialsPack() {
    var pack = global.AURORA_ELETRICA_TUPY_MATERIALS_PRIORITY;
    return pack && Array.isArray(pack.items) ? pack.items : [];
}

function ensurePriorityMaterials(state) {
    if (!state.materiais || typeof state.materiais !== "object") state.materiais = {};
    priorityMaterialsPack().forEach(function (item) {
        var sap = sapStr(item && item.sap);
        if (!sap) return;
        if (state.materiais[sap]) {
            if (!state.materiais[sap].origem) state.materiais[sap].origem = "sugerido";
            state.materiais[sap].priority = true;
            return;
        }
        var abas = [];
        if (Array.isArray(item.abas)) abas = item.abas.slice();
        else if (item.abas) abas = String(item.abas).split(";").map(function (s) {
            return String(s || "").trim();
        }).filter(Boolean);
        state.materiais[sap] = normalizeMaterial({
            sap: sap,
            descricao: item.descricao || "",
            tipo: item.tipo || "",
            unidade: item.unidade || catalogUnitBySap(sap),
            selected: false,
            quantity: "",
            origem: "sugerido",
            source: "priority",
            priority: true,
            atividade: "",
            abas: abas,
            ocorrencias: item.trabalhos_historicos || 0,
            evidencia: "",
            classificacao: "",
            adicional: false
        });
    });
    return state;
}

function fuzzyTokenMatch(haystack, query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    var tokens = q.split(/\s+/).filter(Boolean);
    var blob = String(haystack || "").toLowerCase();
    return tokens.every(function (t) { return blob.indexOf(t) !== -1; });
}

function catalogBySap(sap) {
    sap = sapStr(sap);
    const items = data().items || [];
    for (let i = 0; i < items.length; i += 1) {
        if (sapStr(items[i].sap) === sap) return items[i];
    }
    return null;
}

function searchCatalog(query) {
    const q = String(query || "").trim().toLowerCase();
    const items = data().items || [];
    const out = [];
    for (let i = 0; i < items.length; i += 1) {
        const rec = items[i];
        if (!rec.sap) continue;
        if (!q) {
            out.push(rec);
        } else {
            const blob = rec.sap + " " + (rec.descricao || "") + " " + tipoLabel(rec.tipo);
            if (fuzzyTokenMatch(blob, q)) out.push(rec);
        }
        if (out.length >= 80) break;
    }
    return out;
}

function addCustomMaterial(state, descricao, options) {
    options = options || {};
    const desc = String(descricao || "").trim();
    if (!desc) return state;
    const key = "custom_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
    state.materiais[key] = normalizeMaterial({
        sap: key,
        descricao: desc,
        tipo: options.tipo || "Avulso",
        unidade: options.unidade || "UN",
        selected: true,
        quantity: options.quantity == null ? "" : String(options.quantity),
        origem: "custom",
        source: "custom",
        atividade: "",
        abas: [],
        ocorrencias: 0,
        evidencia: "",
        classificacao: "",
        adicional: true
    });
    return state;
}

function addManual(state, sap, options) {
    options = options || {};
    const rec = catalogBySap(sap);
    if (!rec || !rec.sap) return state;
    if (state.materiais[rec.sap]) {
        state.materiais[rec.sap].selected = true;
        if (options.quantity != null && options.quantity !== "") {
            state.materiais[rec.sap].quantity = String(options.quantity);
            state.materiais[rec.sap].quantidade = state.materiais[rec.sap].quantity;
        }
        normalizeMaterial(state.materiais[rec.sap]);
        return state;
    }
    state.materiais[rec.sap] = normalizeMaterial({
        sap: rec.sap,
        descricao: rec.descricao,
        tipo: rec.tipo,
        linha_excel: rec.linha_excel,
        selected: true,
        quantity: options.quantity == null ? "" : String(options.quantity),
        origem: "manual",
        source: "catalog",
        atividade: "",
        abas: [],
        ocorrencias: 0,
        evidencia: "",
        classificacao: "",
        adicional: false,
        suspeito: !!rec.suspeito
    });
    return state;
}

function mirrorForReport(state) {
    Object.keys(state.materiais || {}).forEach(function (sap) {
        normalizeMaterial(state.materiais[sap]);
    });
    const d = domain();
    const acts = selectedActivityIds(state).map(function (id) {
        const labels = { iluminacao: "Iluminação", ventiladores: "Ventiladores", escritorio: "Escritório", outros: "Outros" };
        const det = state.detalhes[id] || {};
        const activityLabel = id === "outros" ? (String(det.nome_trabalho || "").trim() || labels[id]) : labels[id];
        return activityLabel + (det.descricao ? " — " + det.descricao : "") +
            (det.quantidade ? " · qtde " + det.quantidade : "");
    });
    const s = state.servico;
    const summaryParts = [s.titulo || "Serviço Elétrica Tupy", acts.join("; ")].filter(Boolean);
    return {
        customer: {
            name: d.CLIENT_NAME || "Tupy S.A.",
            phone: "",
            email: "",
            person_type: "Empresa",
            address: s.setor || "",
            responsible: s.solicitante || ""
        },
        asset: {
            identification: s.local || s.titulo || "Elétrica Tupy",
            notes: s.titulo || "",
            setor: s.setor || "",
            local_execucao: s.local || "",
            ponto_referencia: s.ponto_referencia || "",
            entry_date: s.data_inicio || ""
        },
        intake: {
            reason: s.titulo || "",
            initial_condition: "",
            customer_request: s.solicitante || "",
            responsible: s.solicitante || "",
            entry_date: s.data_inicio || "",
            priority: "Normal",
            confirmed: true
        },
        diagnostic: {
            summary: summaryParts.join(". ") || "Serviço Elétrica Tupy",
            recommendation: state.conclusao.pendencias || "",
            conclusion: state.conclusao.descricao || "",
            notes: state.conclusao.observacoes || "",
            status: state.conclusao.status || "Concluído"
        },
        approval: {
            status: state.conclusao.status || "Concluído",
            notes: [state.conclusao.pendencias, state.conclusao.observacoes].filter(Boolean).join(" · "),
            approved_by: state.conclusao.responsavel || s.solicitante || "",
            report_title: s.titulo || "Relatório Elétrica Tupy",
            show_severity: "Não",
            show_record_labels: "Não"
        }
    };
}

function persist(state) {
    if (state.workflow_state === "IN_PROGRESS" && state.conclusao && state.conclusao.status) {
        const ws = domain().WORKFLOW_STATES || {};
        state.workflow_state = ws.AWAITING_REVIEW || "AWAITING_REVIEW";
    }
    return Object.assign({ eletrica_tupy: state }, mirrorForReport(state));
}

async function persistAdminReviewCanonicalState(state) {
    if (!isAdminReviewContext()) return null;
    var api = global.AuroraEletricaTupy;
    var ctx = api && api._adminReviewContext;
    var cloud = global.AuroraCloudSync;
    if (!ctx || !ctx.working_case || !cloud || typeof cloud.saveAdminProjectState !== "function") return null;

    var patch = persist(state);
    Object.keys(patch).forEach(function (key) {
        ctx.working_case[key] = deepCloneJson(patch[key]);
    });
    var pid = String(ctx.project_id || ctx.working_case.cloud_project_id || ctx.working_case.project_id || "").trim();
    var pedidosApi = global.AuroraEletricaTupyPedidos;
    var reportApi = global.AuroraEletricaTupyReportNumber;
    if (pid) {
        state.admin_orders = pedidosApi && typeof pedidosApi.get === "function" ? pedidosApi.get(pid) : (state.admin_orders || []);
        state.admin_report_number = reportApi && typeof reportApi.get === "function" ? reportApi.get(pid) : (state.admin_report_number || "");
        ctx.working_case.eletrica_tupy = state;
    }
    return cloud.saveAdminProjectState(pid, ctx.working_case);
}

function hero(step, title, text, options) {
    options = options || {};
    const total = adminReviewStepTotal();
    const eyebrow = isAdminReviewContext()
        ? ("MODO DE REVISÃO ADMINISTRATIVA · etapa " + step + " de " + total)
        : ("Elétrica Tupy · etapa " + step + " de " + total);
    var klass = isAdminReviewContext() ? "aet-hero aet-hero--admin-review" : "aet-hero";
    if (options.compact) klass += " aet-hero--compact";
    var desc = text ? "<p>" + esc(text) + "</p>" : "";
    return '<section class="' + klass + '"><span>' + eyebrow + "</span><h1>" + esc(title) + "</h1>" + desc + "</section>";
}

function field(label, name, value, type, extra) {
    extra = extra || {};
    const invalid = extra.invalid ? " is-invalid" : "";
    return '<label class="aet-field' + invalid + '" data-aet-field="' + esc(name) + '"><span>' + esc(label) +
        (extra.required ? " *" : "") + '</span><input type="' + (type || "text") + '" name="' + name +
        '" value="' + esc(value || "") + '"' + (extra.readonly ? " readonly" : "") +
        (extra.placeholder ? ' placeholder="' + esc(extra.placeholder) + '"' : "") + "></label>";
}

function area(label, name, value, extra) {
    extra = extra || {};
    var placeholder = extra.placeholder
        ? ' placeholder="' + esc(extra.placeholder) + '"'
        : "";
    return '<label class="aet-field" data-aet-field="' + esc(name) + '"><span>' + esc(label) + "</span><textarea name=\"" + name + "\"" + placeholder + ">" + esc(value || "") + "</textarea></label>";
}

function readForm(form) {
    const out = {};
    if (!form) return out;
    form.querySelectorAll("[name]").forEach(function (el) {
        if (el.type === "checkbox") out[el.name] = el.checked;
        else if (el.type === "radio") {
            if (el.checked) out[el.name] = el.value;
        } else out[el.name] = el.value;
    });
    return out;
}

/** Lê só campos da Etapa 1 — evita poluir servico com setor_novo etc. */
function readServicoForm(form) {
    const v = readForm(form);
    const result = {
        cliente: v.cliente,
        titulo: v.titulo,
        solicitante: v.solicitante,
        setor: v.setor,
        local: v.local,
        ponto_referencia: v.ponto_referencia,
        data_inicio: v.data_inicio
    };
    /* A entrada operacional não possui orçamento. Só atualiza o valor
     * administrativo quando o campo canônico está realmente montado. */
    if (v.budget_number != null) {
        result.budget_number = String(v.budget_number).trim();
    }
    return result;
}

/**
 * Remonta a etapa SEM reler o formulário.
 * Usar depois de aplicar seleção intencional no state — senão readForm
 * sobrescreve com o valor antigo ainda no DOM (bug Setor/Área e chips).
 */
async function remountModule(controller, container) {
    container.innerHTML = await controller.render();
    await controller.bindEvents(container);
}

function attrData(el, name) {
    if (!el) return "";
    if (typeof el.getAttribute === "function") {
        const raw = el.getAttribute(name);
        if (raw != null && raw !== "") return raw;
    }
    return "";
}

function validationBanner(message) {
    if (!message) return "";
    return '<div class="aet-banner aet-banner--error" role="alert">' + esc(message) + "</div>";
}

function evidenciaChip(ev) {
    if (ev === "alta") return '<span class="aet-chip aet-chip-ok">Evidência histórica: Alta</span>';
    if (ev === "media") return '<span class="aet-chip aet-chip-warn">Evidência histórica: Média</span>';
    return "";
}

function grupoChip(g) {
    const map = {
        por_unidade: "Por unidade · preliminar",
        infraestrutura_compartilhada: "Infraestrutura compartilhada · preliminar",
        opcional: "Opcional · preliminar"
    };
    return map[g] ? '<span class="aet-chip">' + map[g] + "</span>" : "";
}

function reportQtyPositive(qty) {
    if (qty == null || qty === "") return false;
    var raw = String(qty).trim();
    if (!raw || raw === "—" || raw === "-") return false;
    var n = Number(raw.replace(",", "."));
    return Number.isFinite(n) && n > 0;
}

function hasValidReportMaterialQuantity(qty) {
    if (qty == null || qty === "") return false;
    var raw = String(qty).trim();
    if (!raw || raw === "—" || raw === "-") return false;
    var n = Number(raw.replace(",", "."));
    return Number.isFinite(n);
}

function matCard(m, options) {
    options = options || {};
    const clean = !!options.clean;
    const sap = sapStr(m.sap);
    const selected = !!m.selected;
    const abas = (m.abas || []).map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("");
    const isCustom = m.origem === "custom" || m.source === "custom" || String(sap).indexOf("custom_") === 0;
    const chips = clean
        ? ""
        : ('<div class="aet-mat__chips">' + evidenciaChip(m.evidencia) + grupoChip(m.classificacao) +
            '<span class="aet-chip">' + (isCustom ? "Material avulso" : (m.origem === "sugerido" ? "✨ Sugerido pela Aurora" : "Catálogo SAP Tupy")) +
            "</span></div>");
    return (
        '<label class="aet-mat' + (selected ? " is-selected" : "") + '">' +
        '<input class="aet-mat__input" type="checkbox" name="sel-' + esc(sap) + '"' + (selected ? " checked" : "") + (options.lockSelected && selected ? ' disabled' : '') + ">" +
        '<span class="aet-mat__mark" aria-hidden="true"></span>' +
        '<div class="aet-mat__body">' +
        (isCustom ? '<div class="sap">Material avulso</div>' : '<div class="sap">SAP ' + esc(sap) + "</div>") +
        '<div class="desc">' + esc(m.descricao) + "</div>" +
        '<div class="meta">' + (isCustom ? ('Unidade: ' + esc(m.unidade || 'UN')) : ('Tipo: ' + esc(tipoLabel(m.tipo)))) + "</div>" +
        chips +
        (selected
            ? (options.lockSelected ? '<button type="button" class="aet-btn aet-btn--danger aet-mat-remove" data-aet-remove-selected="' + esc(sap) + '">Remover da seleção</button>' : '') + '<div class="aet-qty-single"><label class="aet-field"><span>Quantidade</span>' +
              '<input type="number" min="0" step="any" name="qtd-' + esc(sap) + '" value="' + esc(m.quantity || "") + '" inputmode="decimal"></label></div>'
            : "") +
        (!clean && abas
            ? '<details class="aet-why"><summary>Por que este material foi sugerido?</summary><ul>' + abas + "</ul></details>"
            : "") +
        "</div></label>"
    );
}

function syncMaterialsFromForm(form, state) {
    if (!form) return state;
    Object.keys(state.materiais).forEach(function (sap) {
        const m = state.materiais[sap];
        const cb = form.querySelector('[name="sel-' + sap + '"]');
        const q = form.querySelector('[name="qtd-' + sap + '"]');
        if (cb) m.selected = cb.checked;
        if (q) {
            m.quantity = q.value;
            m.quantidade = q.value;
        }
        normalizeMaterial(m);
    });
    return state;
}

function suggestionOptionsHtml(items, selectedId, selectedText, prefix) {
    return (items || []).map(function (item) {
        const id = item.id || item;
        const text = item.text || item;
        const on = (selectedId && selectedId === id) || (!selectedId && selectedText === text);
        return '<button type="button" class="aurora-suggestion-option' + (on ? " is-on" : "") +
            '" data-aet-sug="' + esc(prefix) + '" data-aet-sug-id="' + esc(id) + '" data-aet-sug-text="' + esc(text) +
            '" aria-pressed="' + (on ? "true" : "false") + '">' +
            '<span class="aurora-suggestion-check" aria-hidden="true">✓</span><span>' + esc(text) + "</span></button>";
    }).join("");
}

function dayTypeHtml(activityId, currentTypes) {
    const days = domain().DAY_TYPES || [];
    let selected = Array.isArray(currentTypes) ? currentTypes.slice() : [];
    if (!selected.length && currentTypes) {
        const single = normalizeDayType(currentTypes);
        if (single) selected = [single];
    }
    selected = selected.map(normalizeDayType).filter(Boolean);
    return '<div class="aet-day-grid" role="group" aria-label="Tipos de dia">' +
        days.map(function (day) {
            const on = selected.indexOf(day.id) !== -1;
            return '<label class="aet-day' + (on ? " is-selected" : "") + '">' +
                '<input type="checkbox" name="' + activityId + '_day_' + esc(day.id) + '" value="' + esc(day.id) + '"' +
                ' data-aet-day-type="' + esc(day.id) + '"' +
                (on ? " checked" : "") + ">" +
                '<span class="aet-day__check" aria-hidden="true">✓</span>' +
                "<span>" + esc(day.label) + "</span></label>";
        }).join("") +
        "</div>";
}

function readDayTypesFromForm(form, activityId) {
    const types = [];
    ["weekday", "saturday", "sunday"].forEach(function (day) {
        const el = form && form.querySelector('[name="' + activityId + "_day_" + day + '"]');
        if (el && el.checked) types.push(day);
    });
    return types;
}

function applyDayTypesToDetail(det, types) {
    const uniq = (types || []).map(normalizeDayType).filter(Boolean)
        .filter(function (t, i, arr) { return arr.indexOf(t) === i; });
    det.day_types = uniq;
    det.day_type = uniq[0] || "";
    det.tipo_dia = uniq.length > 1 ? uniq.join(",") : det.day_type;
    return det;
}

function bindNumberInputGuards(root) {
    if (!root || root.__aetNumGuardBound) return;
    root.__aetNumGuardBound = true;
    root.addEventListener("wheel", function (e) {
        var t = e.target;
        if (t && t.tagName === "INPUT" && String(t.type).toLowerCase() === "number" &&
            document.activeElement === t) {
            e.preventDefault();
        }
    }, { passive: false });
    root.addEventListener("input", function (e) {
        var t = e.target;
        if (!t || t.tagName !== "INPUT" || String(t.type).toLowerCase() !== "number") return;
        if (t.min !== "" && Number(t.min) >= 0 && String(t.value).indexOf("-") !== -1) {
            t.value = String(t.value).replace(/-/g, "");
        }
        var n = Number(t.value);
        if (Number.isFinite(n) && n < 0) t.value = "0";
    });
}

function bindAetScrollAssist(root) {
    if (!root || root.__aetScrollAssistBound) return;
    root.__aetScrollAssistBound = true;
    root.addEventListener("wheel", function (e) {
        if (e.defaultPrevented) return;
        var t = e.target;
        if (t && t.tagName === "INPUT" && String(t.type).toLowerCase() === "number" &&
            document.activeElement === t) {
            return;
        }
        var card = t && t.closest ? t.closest(".aet-mat, .aet-card, [data-aet-detail], .aet-codes-grid__scroll") : null;
        if (!card) return;
        var scroller = root.closest(".aurora-module-host, .aurora-workflow-body, .aurora-scroll, main") ||
            root.parentElement;
        if (!scroller || scroller === card) return;
        var overflowY = window.getComputedStyle(card).overflowY;
        var canSelfScroll = (overflowY === "auto" || overflowY === "scroll") &&
            card.scrollHeight > card.clientHeight + 2;
        if (canSelfScroll) return;
        if (scroller.scrollHeight <= scroller.clientHeight + 2) return;
        scroller.scrollTop += e.deltaY;
    }, { passive: true });
}

function hasAfterPhoto(context) {
    const groups = (context && context.evidence_groups) || caseData().evidence_groups || [];
    return (groups || []).some(function (group) {
        const title = String(group.title || group.item || "").toLowerCase();
        const photos = group.photos || [];
        if (!photos.length) return false;
        return title.indexOf("após") !== -1 || title.indexOf("apos") !== -1 || title.indexOf("depois") !== -1;
    });
}

function groupHasRealPhoto(g) {
    var photos = g && Array.isArray(g.photos) ? g.photos : [];
    if (!photos.length) return false;
    return photos.some(function (p) {
        if (!p) return false;
        if (p.has_photo === true) return true;
        if (p.src || p.edited_src || p.object_url || p.url || p.blob) return true;
        if (p.id) return true;
        return false;
    });
}

function isAntesGroupTitle(g) {
    var t = String((g && (g.title || g.item || "")) || "").trim().toLowerCase();
    return t.indexOf("antes do serviço") !== -1 ||
        t.indexOf("antes do servico") !== -1 ||
        t === "antes" ||
        (g && g.tupy_photo_slot === "antes");
}

function isTupyAntesPhotoGroup(g) {
    if (!g) return false;
    if (String(g.tupy_photo_slot || "").trim() === "antes") return true;
    return isAntesGroupTitle(g);
}

function hasTupyAntesPhotoSaved(groups) {
    return (groups || []).some(function (g) {
        return isTupyAntesPhotoGroup(g) && groupHasRealPhoto(g);
    });
}

function resolveTupyEvidenceStepRoot(containerOrHost) {
    if (!containerOrHost) return null;
    if (containerOrHost.matches && containerOrHost.matches("[data-module=\"evidence\"]")) {
        return containerOrHost;
    }
    var nested = containerOrHost.querySelector
        ? containerOrHost.querySelector("[data-module=\"evidence\"]")
        : null;
    if (nested) return nested;
    return containerOrHost.closest
        ? containerOrHost.closest("[data-module=\"evidence\"]")
        : containerOrHost;
}

function updateTupyEvidenceHubVisibility(stepRoot) {
    /* TUPY ETAPA 4 CANÔNICA: jamais ocultar o Evidence Hub ou o botão Novo registro.
     * USER e ADMIN usam o mesmo componente nativo, sem bootstrap visual paralelo. */
    var root = resolveTupyEvidenceStepRoot(stepRoot);
    if (!root) return;
    var hub = root.querySelector("[data-evidence-hub]");
    if (!hub) return;
    hub.classList.remove(
        "aet-evidence-hub--user-vistoria",
        "aet-evidence-hub--deferred",
        "aet-evidence-hub--unlocked",
        "aet-evidence-hub--vistoria-open"
    );
    var addBtn = hub.querySelector("[data-add-evidence-group]");
    if (addBtn) {
        addBtn.disabled = false;
        addBtn.setAttribute("aria-disabled", "false");
        addBtn.title = "Novo registro";
    }
}

function countTupyVistoriaPhotos(groups) {
    var total = 0;
    (groups || []).forEach(function (g) {
        if (!isTupyAntesPhotoGroup(g) || !groupHasRealPhoto(g)) return;
        var photos = Array.isArray(g.photos) ? g.photos : [];
        total += photos.filter(function (p) {
            return p && (p.has_photo === true || p.src || p.edited_src || p.object_url || p.url || p.blob || p.id);
        }).length;
    });
    return total;
}

function renderTupyVistoriaPhotoPreview(groups) {
    var thumbs = [];
    (groups || []).forEach(function (g) {
        if (!isTupyAntesPhotoGroup(g)) return;
        (g.photos || []).forEach(function (p) {
            if (!p) return;
            var src = p.edited_src || p.src || p.object_url || p.url || "";
            if (!src) return;
            thumbs.push(
                '<figure class="aet-vistoria-thumb"><img src="' + esc(src) +
                '" alt="Foto da vistoria"></figure>'
            );
        });
    });
    if (!thumbs.length) return "";
    return '<div class="aet-vistoria-preview">' + thumbs.join("") + "</div>";
}

function findTupyPhotoGroup(slot, title) {
    var api = global.AuroraEvidenceFeature;
    var groups = api && typeof api.getGroups === "function" ? api.getGroups() : [];
    var normalizedTitle = String(title || "").trim().toLowerCase();
    for (var i = 0; i < groups.length; i += 1) {
        var g = groups[i];
        if (!g) continue;
        if (slot && g.tupy_photo_slot === slot) return g;
        var t = String(g.title || g.item || "").trim().toLowerCase();
        if (normalizedTitle && t === normalizedTitle) return g;
    }
    return null;
}

/* ---- Customer: dados do atendimento ---- */
try {
if (global.CustomerModuleController) {
    const p = global.CustomerModuleController.prototype;
    const load = p.onLoad, render = p.render, bind = p.bindEvents, validate = p.onValidate, save = p.onSave;
    p.onLoad = async function (context) {
        this.__aet = active(context);
        if (!this.__aet) return load.call(this, context);
        this.__aetState = tupyOf(context);
        this.__aetError = "";
        this.__aetInvalid = {};
        this.__aetSectorOpen = false;
        this.__aetAdminReview = isAdminReviewContext(context);
        this.__aetProjectId = String(
            (context && (context.cloud_project_id || context.project_id)) ||
            (caseData().cloud_project_id) || ""
        );
        if (this.__aetAdminReview && this.__aetProjectId) {
            var pedidosApi = global.AuroraEletricaTupyPedidos;
            var reportApi = global.AuroraEletricaTupyReportNumber;
            if (pedidosApi && typeof pedidosApi.set === "function" && Array.isArray(this.__aetState.admin_orders)) {
                pedidosApi.set(this.__aetProjectId, this.__aetState.admin_orders);
            }
            if (reportApi && typeof reportApi.set === "function" && this.__aetState.admin_report_number != null) {
                reportApi.set(this.__aetProjectId, this.__aetState.admin_report_number);
            }
        }
    };
    p.render = async function () {
        if (!this.__aet) return render.call(this);
        const s = this.__aetState.servico;
        const d = domain();
        const presets = (d.SECTOR_PRESETS || []).concat(loadCustomSectors());
        var pedidosCard = "";
        var reportNumberCard = "";
        if (this.__aetAdminReview && global.AuroraEletricaTupyPedidos &&
            typeof global.AuroraEletricaTupyPedidos.renderHtml === "function") {
            pedidosCard = global.AuroraEletricaTupyPedidos.renderHtml(this.__aetProjectId);
        }
        if (this.__aetAdminReview && global.AuroraEletricaTupyReportNumber &&
            typeof global.AuroraEletricaTupyReportNumber.renderHtml === "function") {
            reportNumberCard = global.AuroraEletricaTupyReportNumber.renderHtml(this.__aetProjectId);
        }
        var budgetNumberCard = this.__aetAdminReview
            ? '<article class="aet-card aet-report-number aet-admin-meta-card aet-budget-number-card" data-aet-budget-number>' +
              '<h2>Número do orçamento <small>(opcional)</small></h2>' +
              '<input type="text" class="aet-report-number__input" name="budget_number" value="' + esc(s.budget_number || "") +
              '" placeholder="Ex.: 45821" autocomplete="off" maxlength="80">' +
              '</article>'
            : "";
        var adminMeta = (pedidosCard || reportNumberCard || budgetNumberCard)
            ? '<div class="aet-admin-meta-grid aet-admin-meta-grid--stacked">' + pedidosCard + reportNumberCard + budgetNumberCard + "</div>"
            : "";
        const sectorPanel = this.__aetSectorOpen
            ? '<div class="aurora-suggestion-panel aet-inline-panel aet-sector-popover" data-aet-sector-panel>' +
              '<div class="aurora-suggestion-panel__list">' +
              presets.map(function (item) {
                  const on = String(s.setor || "") === String(item);
                  return '<button type="button" class="aurora-suggestion-option' + (on ? " is-on" : "") +
                      '" data-aet-sector="' + esc(item) +
                      '" aria-pressed="' + (on ? "true" : "false") + '"><span>' +
                      esc(item) + "</span></button>";
              }).join("") +
              "</div>" +
              '<div class="aurora-suggestion-add">' +
              '<input type="text" name="setor_novo" maxlength="80" placeholder="Novo setor/área" autocomplete="off">' +
              '<button type="button" data-aet-sector-add>+ Adicionar</button></div>' +
              '<div class="aurora-suggestion-panel__footer"><button type="button" data-aet-sector-close>Fechar</button></div></div>'
            : "";
        return '<section class="aurora-module" data-module="customer">' +
            hero(1, "Dados do atendimento", "Cliente e executora fixos. Preencha o trabalho na Tupy.") +
            validationBanner(this.__aetError) +
            adminMeta +
            '<article class="aet-card">' +
            field("Cliente", "cliente", d.CLIENT_NAME || "Tupy S.A.", "text", { readonly: true }) +
            field("Título do trabalho", "titulo", s.titulo, "text", { required: true, invalid: !!this.__aetInvalid.titulo }) +
            field("Responsável Tupy", "solicitante", s.solicitante, "text", { required: true, invalid: !!this.__aetInvalid.solicitante }) +
            '<div class="aet-field aurora-field--picker aet-sector-field' + (this.__aetInvalid.setor ? " is-invalid" : "") +
            '" data-aet-field="setor" data-aet-managed-picker="1">' +
            "<span>Setor / Área *</span>" +
            '<div class="aet-setor-row">' +
            '<input type="text" name="setor" value="' + esc(s.setor) +
            '" readonly placeholder="Selecione" data-aet-setor-input="1" autocomplete="off">' +
            '<button type="button" class="aurora-suggestion-toggle" data-aet-sector-toggle aria-label="Abrir lista" aria-expanded="' +
            (this.__aetSectorOpen ? "true" : "false") + '">▾</button></div>' +
            sectorPanel +
            "</div>" +
            '<div class="aet-field' + (this.__aetInvalid.local ? " is-invalid" : "") + '" data-aet-field="local">' +
            '<span class="aet-field__label-row"><span class="aet-loc-ico" aria-hidden="true">📍</span> Local da execução *</span>' +
            '<input type="text" name="local" value="' + esc(s.local) + '" placeholder="Ex.: Fundição — corredor principal" autocomplete="off">' +
            "</div>" +
            '<div class="aet-field" data-aet-field="ponto_referencia">' +
            "<span>Ponto de referência</span>" +
            '<input type="text" name="ponto_referencia" value="' + esc(s.ponto_referencia || "") +
            '" placeholder="Ex.: próximo ao forno 03" autocomplete="off">' +
            "</div>" +
            field("Data prevista / execução", "data_inicio", s.data_inicio, "date", { required: true, invalid: !!this.__aetInvalid.data_inicio }) +
            "</article></section>";
    };
    p.bindEvents = async function (container) {
        if (!this.__aet) return bind.call(this, container);
        const self = this;
        this.form = container.querySelector("[data-module='customer']");
        if (!this.form) return;
        bindNumberInputGuards(this.form);
        bindAetScrollAssist(this.form);

        if (this.__aetAdminReview && global.AuroraEletricaTupyPedidos &&
            typeof global.AuroraEletricaTupyPedidos.bind === "function") {
            global.AuroraEletricaTupyPedidos.bind(this.form, { projectId: this.__aetProjectId });
        }
        if (this.__aetAdminReview && global.AuroraEletricaTupyReportNumber &&
            typeof global.AuroraEletricaTupyReportNumber.bind === "function") {
            global.AuroraEletricaTupyReportNumber.bind(this.form, { projectId: this.__aetProjectId });
        }

        const syncDraft = function () {
            Object.assign(self.__aetState.servico, readServicoForm(self.form));
        };
        const remount = async function () {
            await remountModule(self, container);
        };

        this.form.addEventListener("click", function (e) {
            const toggle = e.target.closest("[data-aet-sector-toggle]");
            if (toggle) {
                e.preventDefault();
                e.stopPropagation();
                syncDraft();
                self.__aetSectorOpen = !self.__aetSectorOpen;
                remount();
                return;
            }
            if (e.target.closest("[data-aet-sector-close]")) {
                e.preventDefault();
                e.stopPropagation();
                syncDraft();
                self.__aetSectorOpen = false;
                remount();
                return;
            }
            const pick = e.target.closest("[data-aet-sector]");
            if (pick) {
                e.preventDefault();
                e.stopPropagation();
                const value = attrData(pick, "data-aet-sector") ||
                    (pick.dataset && pick.dataset.aetSector) || "";
                syncDraft();
                self.__aetState.servico.setor = String(value || "").trim();
                self.__aetInvalid.setor = false;
                self.__aetError = "";
                self.__aetSectorOpen = false;
                remount();
                return;
            }
            if (e.target.closest("[data-aet-sector-add]")) {
                e.preventDefault();
                e.stopPropagation();
                const draft = readForm(self.form);
                const novo = String(draft.setor_novo || "").trim();
                const inputNovo = self.form.querySelector("[name='setor_novo']");
                if (!novo) {
                    if (inputNovo && typeof inputNovo.focus === "function") inputNovo.focus();
                    return;
                }
                syncDraft();
                saveCustomSector(novo);
                self.__aetState.servico.setor = novo;
                self.__aetInvalid.setor = false;
                self.__aetError = "";
                self.__aetSectorOpen = false;
                remount();
            }
        });

        this.form.addEventListener("keydown", function (e) {
            if (e.key !== "Enter") return;
            if (!e.target || e.target.name !== "setor_novo") return;
            e.preventDefault();
            const addBtn = self.form.querySelector("[data-aet-sector-add]");
            if (addBtn) addBtn.click();
        });
    };
    p.onValidate = async function () {
        if (!this.__aet) return validate.call(this);
        Object.assign(this.__aetState.servico, readServicoForm(this.form));
        const s = this.__aetState.servico;
        const missing = [];
        this.__aetInvalid = {};
        if (!String(s.titulo || "").trim()) { missing.push("Título do trabalho"); this.__aetInvalid.titulo = true; }
        if (!String(s.solicitante || "").trim()) { missing.push("Responsável Tupy"); this.__aetInvalid.solicitante = true; }
        if (!String(s.setor || "").trim()) { missing.push("Setor / Área"); this.__aetInvalid.setor = true; }
        if (!String(s.local || "").trim()) { missing.push("Local da execução"); this.__aetInvalid.local = true; }
        if (!String(s.data_inicio || "").trim()) { missing.push("Data prevista / execução"); this.__aetInvalid.data_inicio = true; }
        if (missing.length) {
            this.__aetError = "Preencha: " + missing.join(", ") + ".";
            this.__aetSectorOpen = !!this.__aetInvalid.setor;
            const root = this.form && this.form.closest(".aurora-module");
            const host = root && root.parentElement;
            if (host) {
                await remountModule(this, host);
                const first = host.querySelector(".is-invalid input, .is-invalid [name], [data-aet-setor-input]");
                if (first && typeof first.focus === "function") first.focus();
                if (first && typeof first.scrollIntoView === "function") {
                    first.scrollIntoView({ block: "center" });
                }
            }
            return false;
        }
        this.__aetError = "";
        return true;
    };
    p.onSave = async function () {
        if (!this.__aet) return save.call(this);
        Object.assign(this.__aetState.servico, readServicoForm(this.form));
        const d = domain();
        this.__aetState.servico.cliente = d.CLIENT_NAME || "Tupy S.A.";
        this.__aetState.servico.empresa = d.EXECUTOR_NAME || "Bolt Soluções Elétricas";
        if (this.__aetState.servico.budget_number === "") {
            this.__aetState.servico.budget_number = null;
        }
        if (this.__aetAdminReview) await persistAdminReviewCanonicalState(this.__aetState);
        return persist(this.__aetState);
    };
}

/* ---- Asset: atividades ---- */
if (global.AssetModuleController) {
    const p = global.AssetModuleController.prototype;
    const load = p.onLoad, render = p.render, bind = p.bindEvents, validate = p.onValidate, save = p.onSave;
    p.onLoad = async function (context) {
        this.__aet = active(context);
        if (!this.__aet) return load.call(this, context);
        this.__aetState = tupyOf(context);
        this.__aetError = "";
    };
    p.render = async function () {
        if (!this.__aet) return render.call(this);
        const st = this.__aetState;
        const adminReview = isAdminReviewContext();
        const acts = [
            { id: "iluminacao", icon: "💡", label: "ILUMINAÇÃO" },
            { id: "ventiladores", icon: "🌀", label: "VENTILADORES" },
            { id: "escritorio", icon: "🖥️", label: "ESCRITÓRIO" },
            { id: "outros", icon: "➕", label: "OUTROS" }
        ];
        const cards = acts.map(function (a) {
            const on = st.atividades[a.id] ? " is-on" : "";
            const det = st.detalhes[a.id];
            const qLabel = a.id === "iluminacao"
                ? "Quantidade de pontos/unidades"
                : (a.id === "ventiladores" ? "Quantidade de ventiladores" : (a.id === "escritorio" ? "Quantidade de postos/áreas" : "Quantidade"));
            const dayTypes = Array.isArray(det.day_types) && det.day_types.length
                ? det.day_types
                : (det.day_type ? [det.day_type] : []);
            const dayBlock = adminReview
                ? ""
                : ('<div class="aet-field"><span>Tipo(s) de dia *</span>' +
                   '<p class="aet-hint aet-hint--tight">Pode marcar mais de um.</p>' +
                   dayTypeHtml(a.id, dayTypes) + "</div>");
            return '<button type="button" class="aet-act' + on + '" data-aet-act="' + a.id + '"><div class="ico">' + a.icon +
                "</div><div><strong>" + a.label + "</strong></div></button>" +
                (st.atividades[a.id] ? (
                    '<article class="aet-card" data-aet-detail="' + a.id + '">' +
                    (a.id === "outros" ? ('<div class="aet-field"><span>Defina outro trabalho *</span>' +
                    '<input name="outros_nome_trabalho" type="text" placeholder="Ex.: Instalação de tomada" value="' + esc(det.nome_trabalho || "") + '"></div>') : "") +
                    '<div class="aet-field"><span>Descrição do trabalho *</span>' +
                    '<textarea name="' + a.id + '_descricao" rows="3" placeholder="Descreva o trabalho">' +
                    esc(det.descricao || "") + "</textarea></div>" +
                    field(qLabel, a.id + "_quantidade", det.quantidade, "number") +
                    field("Data prevista / execução", a.id + "_data", det.data || st.servico.data_inicio, "date") +
                    dayBlock +
                    "</article>"
                ) : "");
        }, this).join("");
        return '<section class="aurora-module" data-module="asset">' +
            hero(2, "Atividades",
                adminReview
                    ? "Selecione ou revise as atividades. Tipos de dia são classificados na etapa Códigos."
                    : "Selecione uma ou mais atividades e o(s) tipo(s) de dia.") +
            validationBanner(this.__aetError) +
            cards + "</section>";
    };
    p.bindEvents = async function (container) {
        if (!this.__aet) return bind.call(this, container);
        const self = this;
        this.form = container.querySelector("[data-module='asset']");
        bindNumberInputGuards(this.form);
        bindAetScrollAssist(this.form);
        const capture = function () {
            const v = readForm(self.form);
            ["iluminacao", "ventiladores", "escritorio", "outros"].forEach(function (id) {
                if (id === "outros" && v.outros_nome_trabalho != null) {
                    self.__aetState.detalhes.outros.nome_trabalho = v.outros_nome_trabalho;
                }
                if (v[id + "_descricao"] != null) {
                    self.__aetState.detalhes[id].descricao = v[id + "_descricao"];
                    self.__aetState.detalhes[id].description_id = "";
                }
                self.__aetState.detalhes[id].quantidade = v[id + "_quantidade"] || self.__aetState.detalhes[id].quantidade;
                self.__aetState.detalhes[id].data = v[id + "_data"] || self.__aetState.detalhes[id].data;
                /* ADMIN Etapa 2 não edita tipos de dia — preservar histórico. */
                if (!isAdminReviewContext()) {
                    applyDayTypesToDetail(self.__aetState.detalhes[id], readDayTypesFromForm(self.form, id));
                }
            });
        };
        const remount = async function () {
            await remountModule(self, container);
        };
        const refresh = async function () {
            capture();
            await remount();
        };
        this.form.addEventListener("click", function (e) {
            const act = e.target.closest("[data-aet-act]");
            if (act) {
                e.preventDefault();
                e.stopPropagation();
                capture();
                const id = attrData(act, "data-aet-act") || (act.dataset && act.dataset.aetAct) || "";
                if (!id) return;
                self.__aetState.atividades[id] = !self.__aetState.atividades[id];
                remount();
            }
        });
        this.form.addEventListener("change", function (e) {
            if (e.target && e.target.getAttribute && e.target.getAttribute("data-aet-day-type")) {
                refresh();
            }
        });
    };
    p.onValidate = async function () {
        if (!this.__aet) return validate.call(this);
        const v = readForm(this.form);
        ["iluminacao", "ventiladores", "escritorio", "outros"].forEach(function (id) {
            if (id === "outros" && v.outros_nome_trabalho != null) {
                this.__aetState.detalhes.outros.nome_trabalho = v.outros_nome_trabalho;
            }
            if (v[id + "_descricao"] != null) {
                this.__aetState.detalhes[id].descricao = v[id + "_descricao"];
                this.__aetState.detalhes[id].description_id = "";
            }
            if (!isAdminReviewContext()) {
                applyDayTypesToDetail(this.__aetState.detalhes[id], readDayTypesFromForm(this.form, id));
            }
            this.__aetState.detalhes[id].quantidade = v[id + "_quantidade"] || this.__aetState.detalhes[id].quantidade;
            this.__aetState.detalhes[id].data = v[id + "_data"] || this.__aetState.detalhes[id].data;
        }, this);
        const ids = selectedActivityIds(this.__aetState);
        if (!ids.length) {
            this.__aetError = "Selecione pelo menos uma atividade.";
            return false;
        }
        for (let i = 0; i < ids.length; i += 1) {
            const id = ids[i];
            const det = this.__aetState.detalhes[id];
            if (id === "outros" && !String(det.nome_trabalho || "").trim()) {
                this.__aetError = "Defina qual outro trabalho foi executado.";
                return false;
            }
            if (!String(det.descricao || "").trim()) {
                this.__aetError = "Informe a descrição de " + id + ".";
                return false;
            }
            if (!isAdminReviewContext()) {
                if (!Array.isArray(det.day_types) || !det.day_types.length) {
                    this.__aetError = "Selecione ao menos um tipo de dia (Dia de semana, Sábado ou Domingo).";
                    return false;
                }
            }
        }
        this.__aetError = "";
        return true;
    };
    p.onSave = async function () {
        if (!this.__aet) return save.call(this);
        await this.onValidate();
        applySuggestions(this.__aetState);
        if (isAdminReviewContext()) await persistAdminReviewCanonicalState(this.__aetState);
        return persist(this.__aetState);
    };
}

/* ---- Intake: materiais ---- */
if (global.IntakeModuleController) {
    const p = global.IntakeModuleController.prototype;
    const load = p.onLoad, render = p.render, bind = p.bindEvents, validate = p.onValidate, save = p.onSave;
    p.onLoad = async function (context) {
        this.__aet = active(context);
        if (!this.__aet) return load.call(this, context);
        this.__aetState = applySuggestions(tupyOf(context));
        this.__aetFilter = selectedActivityIds(this.__aetState).join(",") === "escritorio" ? "todos" : "sugeridos";
        this.__aetQuery = "";
        this.__aetModal = false;
        this.__aetModalQuery = "";
        this.__aetModalDraft = {};
    };
    function materialsHtml(st, filter, query, options) {
        options = options || {};
        const clean = !!options.clean;
        const q = String(query || "");
        let list = Object.keys(st.materiais).map(function (k) { return st.materiais[k]; }).filter(function (m) {
            if (filter === "sugeridos" && m.origem !== "sugerido" && !m.priority) return false;
            if (filter === "selecionados" && !m.selected) return false;
            if (!q) return true;
            return fuzzyTokenMatch(m.sap + " " + (m.descricao || "") + " " + tipoLabel(m.tipo), q);
        });
        if (filter === "sugeridos") {
            list.sort(function (a, b) {
                var pa = a && a.priority ? 1 : 0;
                var pb = b && b.priority ? 1 : 0;
                if (pa !== pb) return pb - pa;
                var oa = Number(a && a.ocorrencias) || 0;
                var ob = Number(b && b.ocorrencias) || 0;
                return ob - oa;
            });
        }
        if (!list.length) return '<div class="aet-empty">Nenhum material neste filtro. Use + Adicionar material.</div>';
        var cards = list.map(function (m) { return matCard(m, { clean: clean, lockSelected: filter === "selecionados" }); }).join("");
        if (clean) {
            return '<div class="aet-mat-grid">' + cards + "</div>";
        }
        var sugApi = global.AuroraEletricaTupyServiceSuggestions;
        var sugHtml = "";
        if (sugApi && typeof sugApi.suggestForMaterial === "function") {
            var seen = {};
            selectedMaterials(st).forEach(function (m) {
                var hits = sugApi.suggestForMaterial(m) || [];
                hits.forEach(function (h) {
                    var fam = h.family || {};
                    var key = String(fam.item) + "|" + String(m.sap || "");
                    if (seen[key]) return;
                    seen[key] = true;
                    sugHtml += '<div class="aet-mat-suggest" data-aet-mat-suggest="' + esc(fam.item) + '">' +
                        "<strong>Sugestão de serviço</strong>" +
                        "<p>Material <em>" + esc(m.descricao || m.sap) + "</em> → " +
                        esc(fam.descricao_servico || ("Família " + fam.item)) +
                        (h.confidence ? " · confiança " + esc(h.confidence) : "") + "</p>" +
                        '<p class="aet-hint">Não seleciona automaticamente. Confirme na etapa Códigos dos trabalhos.</p>' +
                        "</div>";
                });
            });
        }
        return cards + (sugHtml ? '<div class="aet-mat-suggest-host">' + sugHtml + "</div>" : "");
    }
    function catalogHitsHtml(query, draft) {
        draft = draft || {};
        return searchCatalog(query).slice(0, 50).map(function (r) {
            const on = !!draft[r.sap];
            return '<button type="button" class="aet-cat-hit' + (on ? " is-on" : "") + '" data-aet-draft-toggle="' + esc(r.sap) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
                '<span class="aet-cat-hit__mark" aria-hidden="true">✓</span>' +
                '<span class="aet-cat-hit__body">' +
                '<span class="sap">SAP ' + esc(r.sap) + "</span>" +
                '<span class="desc">' + esc(r.descricao) + "</span>" +
                '<span class="meta">Tipo: ' + esc(tipoLabel(r.tipo)) + "</span>" +
                "</span></button>";
        }).join("");
    }
    function renderCatalogList(self) {
        const q = self.__aetModalQuery;
        const hits = searchCatalog(q);
        const hasQuery = String(q || "").trim().length > 0;
        var units = ["PÇ","UN","M","M²","M³","KG","L","CX","RL","KIT","Outro"];
        var customBlock =
            '<div class="aet-custom-mat aet-custom-mat--top">' +
            '<strong>Material avulso</strong><p class="aet-hint">Se o item não possui SAP oficial, cadastre diretamente aqui.</p>' +
            '<input class="aet-search" type="text" data-aet-custom-desc autocomplete="off" placeholder="Nome/descrição do material (ex.: Ferro de solda)" value="' +
            esc(self.__aetCustomDraft || "") + '">' +
            '<select class="aet-search" data-aet-custom-unit aria-label="Unidade do material">' + units.map(function(u){ return '<option value="' + esc(u) + '"' + ((self.__aetCustomUnit || "UN") === u ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join("") + '</select>' +
            '<button type="button" class="aet-btn aet-btn--primary" data-aet-add-custom>+ Adicionar material avulso</button>' +
            "</div>";
        if (hits.length) return customBlock + catalogHitsHtml(q, self.__aetModalDraft);
        if (hasQuery) return customBlock + '<div class="aet-empty">Nenhum material encontrado no catálogo SAP.</div>';
        return customBlock + '<div class="aet-empty">Digite SAP, descrição ou tipo (ex.: cabo aço).</div>';
    }
    function setModalScrollLock(on) {
        try {
            document.documentElement.classList.toggle("aet-modal-open", !!on);
            document.body.classList.toggle("aet-modal-open", !!on);
            document.body.classList.toggle("aurora-modal-scroll-lock", !!on);
        } catch (error) { /* ignore */ }
    }
    function unmountMaterialModalPortal() {
        var existing = document.getElementById("aet-mat-modal-portal");
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        setModalScrollLock(false);
    }
    function addModalHtml(self) {
        if (!self.__aetModal) return "";
        const q = self.__aetModalQuery;
        const draftCount = Object.keys(self.__aetModalDraft || {}).length;
        return '<div class="aet-modal is-open" id="aet-mat-modal-portal" role="dialog" aria-modal="true" aria-label="Adicionar material" data-aet-mat-modal>' +
            '<button type="button" class="aet-modal__backdrop" data-aet-close-cat tabindex="-1" aria-label="Fechar"></button>' +
            '<div class="aet-modal-card">' +
            '<header class="aet-modal__head"><h2>Adicionar material</h2>' +
            '<p class="aet-hint">Catálogo SAP Tupy (Plan1). Selecione um ou mais e toque em Salvar.</p></header>' +
            '<div class="aet-modal__search">' +
            '<input class="aet-search" name="catq" type="search" enterkeyhint="search" autocomplete="off" ' +
            'placeholder="Buscar código SAP, descrição ou tipo" value="' + esc(q) + '" data-aet-catq>' +
            "</div>" +
            '<div class="aet-modal__list" data-aet-cat-list>' + renderCatalogList(self) + "</div>" +
            '<footer class="aet-modal__foot">' +
            '<button type="button" class="aet-btn" data-aet-close-cat>Fechar</button>' +
            '<button type="button" class="aet-btn aet-btn--primary" data-aet-save-cat>Salvar' +
            (draftCount ? " (" + draftCount + ")" : "") + "</button>" +
            "</footer></div></div>";
    }
    function mountMaterialModalPortal(self) {
        unmountMaterialModalPortal();
        if (!self.__aetModal) {
            setModalScrollLock(false);
            return null;
        }
        var html = addModalHtml(self);
        if (!html) return null;
        var wrap = document.createElement("div");
        wrap.innerHTML = html;
        var modal = wrap.firstChild;
        document.body.appendChild(modal);
        setModalScrollLock(true);
        return modal;
    }
    p.render = async function () {
        if (!this.__aet) return render.call(this);
        const st = this.__aetState;
        const adminReview = isAdminReviewContext();
        /* Modal sobe para document.body no bindEvents — não fica embutido na etapa. */
        return '<section class="aurora-module' + (adminReview ? " aet-admin-materials" : "") + '" data-module="intake">' +
            hero(3, "Materiais do serviço", "Catálogo SAP Tupy · Plan1. Quantidade definida por você.") +
            '<input class="aet-search" name="busca" placeholder="Buscar código SAP, descrição ou tipo" value="' + esc(this.__aetQuery) + '">' +
            '<div class="aet-filters">' +
            '<button type="button" data-aet-filter="todos"' + (this.__aetFilter === "todos" ? ' class="is-on"' : "") + ">Todos</button>" +
            '<button type="button" data-aet-filter="sugeridos"' + (this.__aetFilter === "sugeridos" ? ' class="is-on"' : "") + ">Sugeridos</button>" +
            '<button type="button" data-aet-filter="selecionados"' + (this.__aetFilter === "selecionados" ? ' class="is-on"' : "") + ">Selecionados</button>" +
            '<button type="button" class="aet-filters__add" data-aet-open-cat>+ Adicionar material</button></div>' +
            '<div data-aet-list>' + materialsHtml(st, this.__aetFilter, this.__aetQuery, { clean: adminReview }) + "</div>" +
            "</section>";
    };
    p.bindEvents = async function (container) {
        if (!this.__aet) return bind.call(this, container);
        const self = this;
        this.form = container.querySelector("[data-module='intake']");
        const remount = async function () {
            await remountModule(self, container);
        };
        const refresh = async function () {
            syncMaterialsFromForm(self.form, self.__aetState);
            await remount();
        };
        const refreshCatalogListOnly = function () {
            const portal = document.getElementById("aet-mat-modal-portal");
            const list = portal && portal.querySelector("[data-aet-cat-list]");
            if (list) list.innerHTML = renderCatalogList(self);
            const saveBtn = portal && portal.querySelector("[data-aet-save-cat]");
            if (saveBtn) {
                const n = Object.keys(self.__aetModalDraft || {}).length;
                saveBtn.textContent = n ? "Salvar (" + n + ")" : "Salvar";
            }
        };
        const portal = mountMaterialModalPortal(self);

        function onModalClick(e) {
            if (e.target.closest("[data-aet-close-cat]")) {
                self.__aetModal = false;
                self.__aetModalDraft = {};
                self.__aetModalQuery = "";
                unmountMaterialModalPortal();
                refresh();
                return;
            }
            if (e.target.closest("[data-aet-save-cat]")) {
                Object.keys(self.__aetModalDraft || {}).forEach(function (sap) {
                    addManual(self.__aetState, sap, {});
                });
                self.__aetModal = false;
                self.__aetModalDraft = {};
                self.__aetModalQuery = "";
                self.__aetFilter = "selecionados";
                unmountMaterialModalPortal();
                refresh();
                return;
            }
            if (e.target.closest("[data-aet-add-custom]")) {
                e.preventDefault();
                const descEl = portal && portal.querySelector("[data-aet-custom-desc]");
                const desc = descEl ? String(descEl.value || "").trim() : "";
                if (!desc) {
                    if (descEl) descEl.focus();
                    return;
                }
                const unitEl = portal && portal.querySelector("[data-aet-custom-unit]");
                const unidade = unitEl ? String(unitEl.value || "UN") : "UN";
                addCustomMaterial(self.__aetState, desc, { unidade: unidade });
                self.__aetCustomDraft = "";
                self.__aetModal = false;
                self.__aetModalDraft = {};
                self.__aetModalQuery = "";
                self.__aetFilter = "selecionados";
                unmountMaterialModalPortal();
                refresh();
                return;
            }
            const draftToggle = e.target.closest("[data-aet-draft-toggle]");
            if (draftToggle) {
                e.preventDefault();
                const sap = attrData(draftToggle, "data-aet-draft-toggle") ||
                    (draftToggle.dataset && draftToggle.dataset.aetDraftToggle) || "";
                if (!sap) return;
                if (!self.__aetModalDraft) self.__aetModalDraft = {};
                if (self.__aetModalDraft[sap]) delete self.__aetModalDraft[sap];
                else self.__aetModalDraft[sap] = true;
                refreshCatalogListOnly();
            }
        }

        this.form.addEventListener("click", function (e) {
            const remove = e.target.closest("[data-aet-remove-selected]");
            if (remove) {
                e.preventDefault(); e.stopPropagation();
                const sap = remove.getAttribute("data-aet-remove-selected") || "";
                if (sap && self.__aetState.materiais[sap]) self.__aetState.materiais[sap].selected = false;
                refresh(); return;
            }
            const f = e.target.closest("[data-aet-filter]");
            if (f) { self.__aetFilter = f.dataset.aetFilter; refresh(); return; }
            if (e.target.closest("[data-aet-open-cat]")) {
                self.__aetModal = true;
                self.__aetModalQuery = "";
                self.__aetModalDraft = {};
                refresh();
                return;
            }
        });
        if (portal) {
            portal.addEventListener("click", onModalClick);
            portal.addEventListener("input", function (e) {
                if (e.target.name === "catq" || e.target.hasAttribute("data-aet-catq")) {
                    self.__aetModalQuery = e.target.value;
                    refreshCatalogListOnly();
                }
                if (e.target.hasAttribute("data-aet-custom-desc")) self.__aetCustomDraft = e.target.value;
                if (e.target.hasAttribute("data-aet-custom-unit")) self.__aetCustomUnit = e.target.value;
            });
        }
        this.form.addEventListener("change", function (e) {
            if (e.target && e.target.name && String(e.target.name).indexOf("sel-") === 0) refresh();
        });
        this.form.addEventListener("input", function (e) {
            if (e.target.name === "busca") {
                self.__aetQuery = e.target.value;
                const list = self.form.querySelector("[data-aet-list]");
                if (list) list.innerHTML = materialsHtml(self.__aetState, self.__aetFilter, self.__aetQuery);
            }
        });
        bindNumberInputGuards(this.form);
        bindAetScrollAssist(this.form);
    };
    p.onValidate = async function () {
        if (!this.__aet) return validate.call(this);
        return true;
    };
    p.onSave = async function () {
        if (!this.__aet) return save.call(this);
        syncMaterialsFromForm(this.form, this.__aetState);
        unmountMaterialModalPortal();
        if (isAdminReviewContext()) await persistAdminReviewCanonicalState(this.__aetState);
        return persist(this.__aetState);
    };
    p.onUnmount = async function () {
        if (this.__aet) unmountMaterialModalPortal();
        this.container = null;
    };
}

/* Occurrence removida do fluxo Tupy — patch neutro se algum caminho ainda abrir. */
if (global.OccurrenceModuleController) {
    const p = global.OccurrenceModuleController.prototype;
    const load = p.onLoad, render = p.render, bind = p.bindEvents, validate = p.onValidate, save = p.onSave;
    p.onLoad = async function (context) {
        this.__aet = active(context);
        if (!this.__aet) return load.call(this, context);
        this.__aetState = tupyOf(context);
    };
    p.render = async function () {
        if (!this.__aet) return render.call(this);
        return '<section class="aurora-module" data-module="occurrence"><div class="aet-empty">Etapa não utilizada neste fluxo.</div></section>';
    };
    p.bindEvents = async function (container) {
        if (!this.__aet) return bind.call(this, container);
    };
    p.onValidate = async function () {
        if (!this.__aet) return validate.call(this);
        return true;
    };
    p.onSave = async function () {
        if (!this.__aet) return save.call(this);
        return persist(this.__aetState);
    };
}

/* ---- Evidence ---- */
if (global.EvidenceModuleController) {
    const p = global.EvidenceModuleController.prototype;
    const load = p.onLoad, bind = p.bindEvents, renderEv = p.render, validateEv = p.onValidate, saveEv = p.onSave, unmountEv = p.onUnmount;
    p.onLoad = async function (context) {
        this.__aet = active(context);
        this.__aetContext = context || {};
        this.__aetAdminEvidence = !!(this.__aet && isAdminReviewContext(context));
        /* R7: USER e ADMIN carregam o mesmo EvidenceFeature/EvidenceStore nativo.
         * A revisão administrativa não mantém uma segunda renderização de fotos. */
        await load.call(this, context);
    };
    p.render = async function () {
        /* ADMIN e demais shapes usam o mesmo host nativo do módulo Evidence. */
        return renderEv.call(this);
    };
    p.bindEvents = async function (container) {
        /* USER Tupy usa o MESMO Evidence Hub visual/operacional já validado no ADMIN.
         * Esta flag é somente de UI do EvidenceFeature: não transforma USER em ADMIN,
         * não altera company role, permissões, persistência ou revisão administrativa. */
        if (this.__aet && !this.__aetAdminEvidence) {
            global.__AURORA_TUPY_CANONICAL_EVIDENCE_UI__ = true;
        }
        await bind.call(this, container);
        if (!this.__aet) return;

        /* ADMIN: preservar o componente nativo e apenas especializar o novo
         * registro como foto final Tupy. Não inserir hero/cards/containers paralelos. */
        if (this.__aetAdminEvidence) {
            const aetAdmin = global.AuroraEletricaTupy;
            /* R15: marco visual ADMIN aprovado. A Etapa 4 recebe somente o
             * mesmo hero sólido das demais etapas administrativas, sem tocar
             * no componente nativo de Ocorrências/Evidências abaixo dele. */
            if (container && !container.querySelector(".aet-hero.aet-hero--admin-review")) {
                container.insertAdjacentHTML(
                    "afterbegin",
                    hero(
                        4,
                        "Ocorrências",
                        "Revise as ocorrências e evidências fotográficas do trabalho."
                    )
                );
            }
            /* Cadeia histórica R9/R14: a tela é montada primeiro e a bridge
             * cloud alimenta o EvidenceStore nativo depois. A navegação nunca
             * aguarda rede; records sem foto permanecem visíveis. */
            if (aetAdmin && typeof aetAdmin.rehydrateAdminEvidenceAfterMount === "function") {
                aetAdmin.rehydrateAdminEvidenceAfterMount(container).catch(function (error) {
                    console.warn("[AET ADMIN EVIDENCE post-mount]", error);
                });
            }
            if (!container.__aetAdminFinalNativeAddBound) {
                container.__aetAdminFinalNativeAddBound = true;
                container.addEventListener("click", async function (event) {
                    var button = event.target && event.target.closest
                        ? event.target.closest("[data-add-evidence-group]")
                        : null;
                    if (!button || !container.contains(button)) return;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    var api = global.AuroraEvidenceFeature;
                    if (!api) return;
                    var existing = findTupyPhotoGroup(PHOTO_FINAL_SLOT, PHOTO_FINAL_TITLE);
                    if (existing && typeof api.openGroup === "function") {
                        await api.openGroup(existing.id);
                    } else if (typeof api.createGroup === "function") {
                        await api.createGroup({
                            title: PHOTO_FINAL_TITLE,
                            item: PHOTO_FINAL_TITLE,
                            description: "Registro fotográfico do trabalho finalizado.",
                            severity: "Sem gravidade",
                            record_kind: TUPY_FINAL_RECORD_KIND,
                            tupy_photo_slot: PHOTO_FINAL_SLOT
                        });
                    }
                    if (aetAdmin && typeof aetAdmin.syncAdminFinalEvidenceFromNativeHub === "function") {
                        await aetAdmin.syncAdminFinalEvidenceFromNativeHub();
                    }
                }, true);
            }
            return;
        }
        const stepRoot = resolveTupyEvidenceStepRoot(container);
        /* USER não possui mais card/wrapper/renderer próprio. O mesmo helper
         * canônico usado pela tela ADMIN monta o cabeçalho no mesmo nível do
         * EvidenceModuleController; abaixo dele permanece o mesmo hub nativo. */
        if (container && !container.querySelector(".aet-hero")) {
            container.insertAdjacentHTML(
                "afterbegin",
                hero(4, "Ocorrências", "Registre e edite as ocorrências e evidências fotográficas do trabalho.")
            );
        }
        updateTupyEvidenceHubVisibility(stepRoot);
        if (stepRoot && !stepRoot.__aetEvidenceHubBound) {
            stepRoot.__aetEvidenceHubBound = true;
            stepRoot.addEventListener("aurora:evidence-groups-changed", function () {
                updateTupyEvidenceHubVisibility(stepRoot);
            });
        }
        stepRoot && stepRoot.addEventListener("click", async function (e) {
            const btn = e.target.closest("[data-aet-photo], [data-aet-vistoria-add]");
            if (!btn) return;
            e.preventDefault();
            const api = global.AuroraEvidenceFeature;
            if (!api) return;
            const slot = btn.dataset.aetSlot || "";
            const isFinal = btn.dataset.aetFinalPhoto === "1" || slot === PHOTO_FINAL_SLOT;
            if (!isFinal && typeof api.openOrCreateTupyAntesGroup === "function") {
                await api.openOrCreateTupyAntesGroup();
            } else if (typeof api.createGroup === "function") {
                const title = btn.dataset.aetPhoto || PHOTO_FINAL_TITLE;
                const recordKind = TUPY_FINAL_RECORD_KIND;
                var existing = findTupyPhotoGroup(slot, title);
                if (existing && typeof api.openGroup === "function") {
                    await api.openGroup(existing.id);
                } else {
                    await api.createGroup({
                        title: title,
                        item: title,
                        description: "Registro fotográfico Elétrica Tupy (" + slot + ").",
                        severity: "Sem gravidade",
                        record_kind: recordKind,
                        tupy_photo_slot: slot
                    });
                }
            }
            updateTupyEvidenceHubVisibility(stepRoot);
            var openPanel = stepRoot.querySelector(".aurora-evidence-group.is-open");
            if (openPanel && typeof openPanel.scrollIntoView === "function") {
                openPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        });
    };
    p.onValidate = async function () {
        /* ADMIN review: não aplicar gate USER de foto Antes.
         * Flush canônico ANTES de sair da Etapa 4 — senão o onSave antigo
         * devolvia evidence_groups stale e a ocorrência sumia no 4→5→4. */
        if (this.__aetAdminEvidence) {
            var apiAdmin = global.AuroraEvidenceFeature;
            if (apiAdmin && typeof apiAdmin.flush === "function") {
                try { await apiAdmin.flush(); } catch (flushErr) {
                    console.warn("[AET ADMIN EVIDENCE flush/validate]", flushErr);
                }
            }
            return true;
        }
        if (this.__aet) {
            var api = global.AuroraEvidenceFeature;
            /* USER 5 etapas: sair de Fotos NÃO finaliza a vistoria.
             * A finalização canônica ocorre somente após Códigos dos trabalhos. */
            if (api && typeof api.flush === "function") {
                try { await api.flush(); } catch (flushErr) {
                    console.warn("[AET FOTO GATE flush]", flushErr);
                }
            }
            /*
             * Fonte canônica = mesma da UI (EvidenceFeature.getGroups → EvidenceStore).
             * NÃO usar this.__aetContext.evidence_groups (stale no onLoad).
             * NÃO usar só case.evidence_groups sem has_photo (refs sem blob).
             */
            var groups = [];
            if (api && typeof api.getGroups === "function") {
                try { groups = api.getGroups() || []; } catch (gErr) { groups = []; }
            }
            if (!Array.isArray(groups) || !groups.length) {
                var c = caseData();
                groups = (c && Array.isArray(c.evidence_groups)) ? c.evidence_groups : [];
            }

            function groupHasRealPhoto(g) {
                var photos = g && Array.isArray(g.photos) ? g.photos : [];
                if (!photos.length) return false;
                return photos.some(function (p) {
                    if (!p) return false;
                    if (p.has_photo === true) return true;
                    if (p.src || p.edited_src || p.object_url || p.url || p.blob) return true;
                    if (p.id) return true;
                    return false;
                });
            }

            function isAntesGroup(g) {
                if (g && String(g.tupy_photo_slot || "").trim() === "antes") return true;
                var t = String((g && (g.title || g.item || "")) || "").trim().toLowerCase();
                return t.indexOf("antes do serviço") !== -1 ||
                    t.indexOf("antes do servico") !== -1 ||
                    t === "antes";
            }

            /* USER usa a tela canônica de Ocorrências do ADMIN: para avançar,
             * basta existir ao menos uma foto salva em uma ocorrência real. */
            var hasOccurrencePhoto = groups.some(function (g) {
                return groupHasRealPhoto(g);
            });

            if (!hasOccurrencePhoto) {
                window.alert(
                    "É obrigatório incluir ao menos 1 foto em uma ocorrência para avançar."
                );
                return false;
            }
            return true;
        }
        return validateEv.call(this);
    };
    p.onSave = async function () {
        if (this.__aetAdminEvidence) {
            /* Mesmo patch canônico do USER (flush + refs do CaseBinder vivo).
             * NÃO devolver this.__aetContext.evidence_groups (snapshot do onLoad). */
            const patch = await saveEv.call(this);
            try {
                const aet = global.AuroraEletricaTupy;
                if (aet && aet._adminReviewContext && aet._adminReviewContext.working_case && patch) {
                    if (patch.evidence_groups) {
                        aet._adminReviewContext.working_case.evidence_groups = patch.evidence_groups;
                    }
                    if (patch.evidences) {
                        aet._adminReviewContext.working_case.evidences = patch.evidences;
                    }
                    const cloud = global.AuroraCloudSync;
                    const ctx = aet._adminReviewContext;
                    if (cloud && typeof cloud.saveAdminProjectRecords === "function") {
                        await cloud.saveAdminProjectRecords(ctx.project_id, ctx.working_case);
                    }
                    if (cloud && cloud.client && global.AuroraEvidenceCloudSync &&
                        typeof global.AuroraEvidenceCloudSync.syncCaseEvidence === "function") {
                        await global.AuroraEvidenceCloudSync.syncCaseEvidence({
                            client: cloud.client,
                            caseData: ctx.working_case,
                            projectId: ctx.project_id,
                            companyId: ctx.company_id || null
                        });
                    }
                }
            } catch (syncErr) {
                console.warn("[AET ADMIN EVIDENCE CLOUD SAVE]", syncErr);
                /*
                 * O patch local já foi persistido pelo EvidenceFeature/CaseBinder.
                 * Falha de rede/RPC não é falha de campo obrigatório e não deve
                 * impedir a navegação. A sincronização existente poderá ser
                 * repetida; informamos a causa real sem deixar o bootstrap
                 * classificá-la incorretamente como validação de formulário.
                 */
                var status = document.getElementById("app-status");
                if (status) {
                    status.textContent =
                        "As evidências foram salvas neste dispositivo, mas a sincronização com a nuvem falhou: " +
                        String(syncErr && syncErr.message || syncErr || "erro não informado") +
                        ". Tente sincronizar novamente.";
                    status.classList.add("is-visible");
                }
            }
            return patch;
        }
        return saveEv.call(this);
    };
    p.onUnmount = async function () {
        if (this.__aetAdminEvidence) {
            try { await unmountEv.call(this); } catch (unmountErr) {
                console.warn("[AET ADMIN EVIDENCE unmount]", unmountErr);
            }
            if (global.AuroraEletricaTupy &&
                typeof global.AuroraEletricaTupy.releaseAdminReviewEvidenceSession === "function") {
                global.AuroraEletricaTupy.releaseAdminReviewEvidenceSession();
            }
            this.container = null;
            return;
        }
        global.__AURORA_TUPY_CANONICAL_EVIDENCE_UI__ = false;
        return unmountEv.call(this);
    };
}

/* ---- Diagnostic: conclusão ---- */
if (global.DiagnosticModuleController) {
    const p = global.DiagnosticModuleController.prototype;
    const load = p.onLoad, render = p.render, bind = p.bindEvents, validate = p.onValidate, save = p.onSave;
    p.onLoad = async function (context) {
        this.__aet = active(context);
        if (!this.__aet) return load.call(this, context);
        this.__aetState = tupyOf(context);
        this.__aetContext = context || {};
        this.__aetAdminConclusion = isAdminReviewContext(context);
        if (this.__aetAdminConclusion) {
            return;
        }
        /* Regra: se já existe foto “Após o serviço” e status ainda vazio,
           sugere Concluído. Não sobrescreve escolha explícita posterior
           (status_auto_from_photo=false após mudança manual). */
        if (!this.__aetState.conclusao.status && hasAfterPhoto(context)) {
            this.__aetState.conclusao.status = "Concluído";
            this.__aetState.conclusao.status_auto_from_photo = true;
        }
        this.__aetConclOpen = false;
        this.__aetPendOpen = false;
        this.__aetCustomConclusion = false;
        this.__aetCustomPending = false;
    };
    function closedPickerHtml(label, name, value, open, optionsHtml, addAttr, addLabel, customHtml) {
        return '<div class="aet-field aurora-field--picker" data-aet-picker="' + esc(name) + '">' +
            "<span>" + esc(label) + "</span>" +
            '<div class="aet-setor-row">' +
            '<input type="text" name="' + esc(name) + '" value="' + esc(value || "") +
            '" readonly placeholder="Selecione uma opção" autocomplete="off">' +
            '<button type="button" class="aurora-suggestion-toggle" data-aet-picker-toggle="' + esc(name) +
            '" aria-expanded="' + (open ? "true" : "false") + '">▾</button></div>' +
            (open
                ? '<div class="aurora-suggestion-panel aet-inline-panel" data-aet-picker-panel="' + esc(name) + '">' +
                  '<div class="aurora-suggestion-panel__list aet-sug-list">' + optionsHtml + "</div>" +
                  '<button type="button" class="aet-btn" ' + addAttr + ">" + esc(addLabel) + "</button>" +
                  (customHtml || "") +
                  '<div class="aurora-suggestion-panel__footer"><button type="button" data-aet-picker-close="' +
                  esc(name) + '">Fechar</button></div></div>'
                : "") +
            "</div>";
    }
    p.render = async function () {
        if (!this.__aet) return render.call(this);
        if (isUserBoltVistoriaFlow(this.__aetContext || caseData())) {
            return '<section class="aurora-module" data-module="diagnostic">' +
                '<article class="aet-card"><p class="aet-hint">A conclusão da execução é feita pelo administrador após a vistoria.</p></article>' +
                "</section>";
        }
        if (this.__aetAdminConclusion && global.AuroraEletricaTupy &&
            typeof global.AuroraEletricaTupy.renderAdminReviewConclusionHtml === "function") {
            return global.AuroraEletricaTupy.renderAdminReviewConclusionHtml(this.__aetContext || caseData());
        }
        const c = this.__aetState.conclusao;
        const pending = domain().PENDING_SUGGESTIONS || [];
        const statuses = ["Concluído", "Concluído com pendências", "Parcial"];
        const pendOpts = suggestionOptionsHtml(
            pending.map(function (t) { return { id: t, text: t }; }),
            "",
            c.pendencias,
            "pend"
        );
        const pendCustom = this.__aetCustomPending
            ? '<input class="aet-search" name="pendencias_custom" placeholder="Escreva a observação" value="' + esc(c.pendencias) + '">'
            : "";
        return '<section class="aurora-module" data-module="diagnostic">' +
            hero(6, "Conclusão", "Status, descrição da vistoria e pendências.") +
            '<article class="aet-card">' +
            '<div class="aet-field"><span>Status da execução *</span>' +
            '<div class="aet-status-grid">' +
            statuses.map(function (st) {
                const on = c.status === st ? " is-selected" : "";
                return '<label class="aet-status' + on + '"><input type="radio" name="status" value="' + esc(st) + '"' +
                    (c.status === st ? " checked" : "") +
                    '><span class="aet-day__check" aria-hidden="true">✓</span><span>' + esc(st) + "</span></label>";
            }).join("") +
            "</div>" +
            (c.status_auto_from_photo
                ? '<p class="aet-hint">Sugerido automaticamente após foto “Após o serviço”. Você pode alterar.</p>'
                : "") +
            "</div>" +
            area(
                "Descrição do que foi encontrado / observado",
                "descricao",
                c.descricao,
                { placeholder: "Ex.: Necessária substituição de 3 luminárias no setor C4." }
            ) +
            closedPickerHtml(
                "Pendências / Observação final",
                "pendencias",
                c.pendencias,
                this.__aetPendOpen,
                pendOpts,
                'data-aet-add-pend',
                "+ Adicionar observação",
                pendCustom
            ) +
            field("Data de conclusão", "data", c.data, "date") +
            field("Responsável pela execução", "responsavel", c.responsavel || this.__aetState.servico.solicitante) +
            "</article></section>";
    };
    p.bindEvents = async function (container) {
        if (!this.__aet) return bind.call(this, container);
        if (this.__aetAdminConclusion) {
            if (global.AuroraEletricaTupy &&
                typeof global.AuroraEletricaTupy.bindAdminReviewConclusion === "function") {
                global.AuroraEletricaTupy.bindAdminReviewConclusion(container);
            }
            return;
        }
        const self = this;
        this.form = container.querySelector("[data-module='diagnostic']");
        const syncConclusao = function () {
            const v = readForm(self.form);
            if (v.descricao != null) {
                self.__aetState.conclusao.descricao = v.descricao;
            }
            if (v.pendencias_custom != null) {
                self.__aetState.conclusao.pendencias = v.pendencias_custom;
            } else if (v.pendencias != null) {
                self.__aetState.conclusao.pendencias = v.pendencias;
            }
            if (v.status) self.__aetState.conclusao.status = v.status;
            if (v.data != null) self.__aetState.conclusao.data = v.data;
            if (v.responsavel != null) self.__aetState.conclusao.responsavel = v.responsavel;
        };
        const remount = async function () {
            await remountModule(self, container);
        };
        this.form.addEventListener("click", function (e) {
            const toggle = e.target.closest("[data-aet-picker-toggle]");
            if (toggle) {
                e.preventDefault();
                e.stopPropagation();
                syncConclusao();
                const which = attrData(toggle, "data-aet-picker-toggle");
                if (which === "pendencias") {
                    self.__aetPendOpen = !self.__aetPendOpen;
                }
                remount();
                return;
            }
            const close = e.target.closest("[data-aet-picker-close]");
            if (close) {
                e.preventDefault();
                syncConclusao();
                const which = attrData(close, "data-aet-picker-close");
                if (which === "pendencias") self.__aetPendOpen = false;
                remount();
                return;
            }
            const sug = e.target.closest("[data-aet-sug]");
            if (sug) {
                e.preventDefault();
                e.stopPropagation();
                syncConclusao();
                const kind = attrData(sug, "data-aet-sug") || "";
                const text = attrData(sug, "data-aet-sug-text") ||
                    (sug.dataset && sug.dataset.aetSugText) || "";
                if (kind === "pend") {
                    self.__aetState.conclusao.pendencias = text;
                    self.__aetCustomPending = false;
                    self.__aetPendOpen = false;
                }
                remount();
                return;
            }
            if (e.target.closest("[data-aet-add-pend]")) {
                e.preventDefault();
                syncConclusao();
                self.__aetCustomPending = true;
                self.__aetPendOpen = true;
                remount();
            }
        });
        this.form.addEventListener("change", function (e) {
            if (e.target && e.target.name === "status") {
                self.__aetState.conclusao.status_auto_from_photo = false;
                syncConclusao();
                remount();
            }
        });
    };
    p.onValidate = async function () {
        if (!this.__aet) return validate.call(this);
        if (isUserBoltVistoriaFlow(this.__aetContext || caseData())) return true;
        if (this.__aetAdminConclusion) return true;
        const v = readForm(this.form);
        if (v.descricao != null) this.__aetState.conclusao.descricao = v.descricao;
        if (v.pendencias_custom != null) this.__aetState.conclusao.pendencias = v.pendencias_custom;
        else if (v.pendencias != null) this.__aetState.conclusao.pendencias = v.pendencias;
        if (v.status) this.__aetState.conclusao.status = v.status;
        return Boolean(this.__aetState.conclusao.status);
    };
    p.onSave = async function () {
        if (!this.__aet) return save.call(this);
        if (this.__aetAdminConclusion) {
            return { admin_review: true };
        }
        await this.onValidate();
        const patch = persist(this.__aetState);
        patch.report_title = this.__aetState.servico.titulo || "Relatório Elétrica Tupy";
        return patch;
    };
}

} catch (error) {
    console.error("[AuroraEletricaTupy] falha isolada ao integrar shape — Aurora continua:", error);
}

function createTupyCodesModuleController(controllerId, mode) {
    class TupyCodesModuleController extends global.ModuleController {
        constructor() {
            super({ id: controllerId });
            this.mode = mode;
            this.adapter = null;
        }
        async onLoad(context) {
            this.context = context || {};
            this.__aet = active(context);
            var api = global.AuroraEletricaTupy;
            this.adapter = api && typeof api.createCodesStepAdapter === "function"
                ? api.createCodesStepAdapter(this.mode)
                : null;
        }
        async render() {
            var api = global.AuroraEletricaTupy;
            if (!this.__aet || !this.adapter) return "<p>Etapa indisponível.</p>";
            return api && typeof api.renderCodesStepHtml === "function"
                ? api.renderCodesStepHtml(this.adapter)
                : "<p>Códigos indisponíveis.</p>";
        }
        async bindEvents(container) {
            this.container = container;
            var api = global.AuroraEletricaTupy;
            if (api && typeof api.bindCodesStep === "function" && this.adapter) {
                await api.bindCodesStep(container, this.adapter);
            }
        }
        async onValidate() { return true; }
        async onSave() {
            if (!this.adapter || typeof this.adapter.save !== "function") return {};
            /* USER: capturar também a quantidade ainda focada antes de finalizar.
             * O ADMIN não entra neste bloco e permanece exatamente como validado. */
            if (this.mode === "user" && this.container) {
                var grid = global.AuroraEletricaTupyCodesGrid;
                if (grid && typeof grid.collectFromDom === "function" &&
                    typeof this.adapter.setAssociations === "function" &&
                    typeof this.adapter.listActivities === "function") {
                    this.adapter.listActivities().forEach(function (act) {
                        var host = this.container.querySelector('[data-aet-codes-grid-host="' + act.id + '"]');
                        var root = host && host.querySelector ? host.querySelector("[data-aet-codes-grid]") : null;
                        if (!root) return;
                        this.adapter.setAssociations(act.id, grid.collectFromDom(root, act.id));
                    }, this);
                }
            }
            return this.adapter.save();
        }
    }
    return new TupyCodesModuleController();
}

global.AuroraEletricaTupy = {
    formatMaterialQuantity: formatMaterialQuantity,
    hasValidReportMaterialQuantity: hasValidReportMaterialQuantity,
    resolveMaterialUnit: resolveMaterialUnit,
    SERVICE_ID: SERVICE_ID,
    active: active,
    tupyOf: tupyOf,
    emptyState: emptyState,
    catalogCount: function () { return (data().items || []).length; },
    servicesCount: function () {
        var pack = global.AURORA_ELETRICA_TUPY_SERVICES;
        return pack && Array.isArray(pack.items) ? pack.items.length : 0;
    },
    isAdmin: function () {
        return domain().canManageEletricaTupy
            ? domain().canManageEletricaTupy()
            : (domain().isAdminBolt ? domain().isAdminBolt() : false);
    },
    isAdminBolt: function () {
        return domain().isAdminBolt ? domain().isAdminBolt() : false;
    },
    isUserBoltVistoriaFlow: function (context) {
        return isUserBoltVistoriaFlow(context);
    },
    updateTupyEvidenceHubVisibility: function (stepRoot) {
        return updateTupyEvidenceHubVisibility(stepRoot);
    },
    resolveWorkflowNextLabel: function (caseObj, isLastStep) {
        if (!isLastStep) return "Próximo →";
        if (isAdminReviewContext(caseObj)) return "Finalizar revisão ✓";
        if (isUserBoltVistoriaFlow(caseObj)) return "Finalizar vistoria ✓";
        return "Finalizar inspeção ✓";
    },
    finalizeUserVistoria: async function (runtime) {
        if (!runtime || typeof runtime.getCase !== "function") {
            return { ok: false, reason: "missing_runtime" };
        }
        /* Etapa 5 -> relatório: o bootstrap finaliza diretamente no último passo.
         * Portanto, salve explicitamente o controller canônico de Códigos antes
         * de sincronizar/criar o snapshot do relatório. */
        if (typeof runtime.saveCurrent === "function") {
            var step5Save = await runtime.saveCurrent({ validate: true });
            if (step5Save && step5Save.valid === false) {
                return { ok: false, reason: "validation_failed" };
            }
        }
        var api = global.AuroraEvidenceFeature;
        if (api && typeof api.finalizeTupyVistoriaForNavigation === "function") {
            await api.finalizeTupyVistoriaForNavigation();
        }
        var tupy = tupyOf(runtime.getCase() || {});
        /* USER -> relatório: preserve exatamente os códigos já salvos na Etapa 5.
         * A sincronização pode reidratar o case com uma versão cloud anterior; o relatório
         * deve usar o mesmo estado canônico que acabou de ser confirmado na Etapa 5. */
        var userReportServiceCodes = Array.isArray(tupy.service_codes)
            ? deepCloneJson(tupy.service_codes)
            : [];
        var ws = domain().WORKFLOW_STATES || {};
        tupy.workflow_state = ws.AWAITING_REVIEW || "AWAITING_REVIEW";
        tupy.vistoria_sent_for_review = true;
        var patch = persist(tupy);
        if (runtime.caseBinder && typeof runtime.caseBinder.merge === "function") {
            runtime.caseBinder.merge(patch, {
                source: "user_vistoria_pre_finalize",
                controller_id: "evidence"
            });
        }
        /* Após a Etapa 5, tenta sincronização canônica.
         * Falha de rede não perde a vistoria: mantém local e marca pendência. */
        var cloud = global.AuroraCloudSync;
        if (cloud && typeof cloud.syncSelectedCase === "function") {
            try {
                await cloud.syncSelectedCase(runtime.getCase());
                tupy.cloud_sync_pending = false;
            } catch (syncErr) {
                console.warn("[AET USER SYNC PENDING]", syncErr);
                tupy.cloud_sync_pending = true;
                var pendingPatch = persist(tupy);
                if (runtime.caseBinder && typeof runtime.caseBinder.merge === "function") {
                    runtime.caseBinder.merge(pendingPatch, {
                        source: "user_vistoria_sync_pending",
                        controller_id: "aet_service_codes"
                    });
                }
                /* V156 — a falha offline precisa entrar na mesma fila canônica
                   usada pelos demais relatórios; conexão não significa sincronizado. */
                if (cloud && typeof cloud.queueCaseForSync === "function") {
                    cloud.queueCaseForSync(runtime.getCase());
                }
            }
        }

        /* Reaplica os códigos da Etapa 5 no case que alimentará o motor compartilhado
         * do relatório, exatamente antes da finalização. Não altera o caminho ADMIN. */
        if (userReportServiceCodes.length) {
            var reportCase = runtime.getCase() || {};
            var reportTupy = tupyOf(reportCase);
            reportTupy.service_codes = deepCloneJson(userReportServiceCodes);
            var reportCodesPatch = persist(reportTupy);
            if (runtime.caseBinder && typeof runtime.caseBinder.merge === "function") {
                runtime.caseBinder.merge(reportCodesPatch, {
                    source: "user_vistoria_report_service_codes",
                    controller_id: "aet_service_codes"
                });
            } else {
                reportCase.eletrica_tupy = reportTupy;
            }
        }

        var reportFeature = global.AuroraReportFeature;
        if (!reportFeature || typeof reportFeature.finalize !== "function") {
            return { ok: false, reason: "report_feature_missing" };
        }
        var result = await reportFeature.finalize(runtime);
        if (result && result.ok === true) {
            if (global.AuroraUi && typeof global.AuroraUi.showHome === "function") {
                await global.AuroraUi.showHome();
            }
        }
        return result || { ok: false, reason: "unknown" };
    },
    canManageEletricaTupy: function () {
        if (domain().canManageEletricaTupy) return domain().canManageEletricaTupy();
        if (global.AuroraCompanyAccess && typeof global.AuroraCompanyAccess.canManageEletricaTupy === "function") {
            return global.AuroraCompanyAccess.canManageEletricaTupy();
        }
        return false;
    },
    canOpenGestao: function () {
        return this.canManageEletricaTupy();
    },

    isCompanyPeerProjectRow: function (row, userId) {
        var access = global.AuroraCompanyAccess;
        if (access && typeof access.isCompanyPeerProject === "function") {
            return access.isCompanyPeerProject(row, userId);
        }
        if (!row || !userId) return false;
        var createdBy = row.created_by != null ? String(row.created_by) : "";
        return Boolean(createdBy && createdBy !== String(userId));
    },

    resolveGestaoAuthUserId: async function () {
        if (this._gestaoCurrentUserId) return this._gestaoCurrentUserId;
        var cloud = global.AuroraCloudSync;
        var access = global.AuroraCompanyAccess;
        var client = cloud && cloud.client ? cloud.client : null;
        if (access && typeof access.getAuthUserId === "function") {
            var uid = await access.getAuthUserId(client);
            if (uid) this._gestaoCurrentUserId = uid;
            return uid;
        }
        return global.AURORA_ACCOUNT_USER_ID ? String(global.AURORA_ACCOUNT_USER_ID) : null;
    },

    canAccessModule: function () {
        return domain().canAccessEletricaTupyModule ? domain().canAccessEletricaTupyModule() : true;
    },
    listContractServices: function () {
        return domain().listContractServices ? domain().listContractServices() : [];
    },

    /**
     * TEMPORÁRIO — DIAG READ-ONLY do inventário local.
     * Reutiliza a mesma API do STORAGE-B: auroraEvidenceStore.listByCase(caseId).
     * Não salva, não sincroniza, não chama Supabase.
     */
    runLocalInventoryDiag: async function () {
        var FORENSIC = {
            A: "evidence-photo-1787278393494-f2f4b25b1cafb8",
            B: "evidence-photo-1787278398161-2993e084c0b4d",
            C: "evidence-photo-1787278704185-61e4cfafadc648",
            D: "evidence-photo-1787278708987-5418e856a601"
        };

        function closeDiag() {
            var overlay = document.getElementById("aet-local-inventory-diag-overlay");
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }

        var caseData = null;
        if (global.auroraRuntime && typeof global.auroraRuntime.getCase === "function") {
            caseData = global.auroraRuntime.getCase();
        }
        var caseId = caseData && caseData.id != null ? String(caseData.id) : "";

        var store = global.auroraEvidenceStore;
        var groups = [];
        var readError = null;
        if (!caseId) {
            readError = "Case ID local indisponível.";
        } else if (!store || typeof store.listByCase !== "function") {
            readError = "EvidenceStore.listByCase indisponível.";
        } else {
            try {
                /* MESMA chamada usada por STORAGE-B (listLocalPhotos → listByCase). */
                groups = await store.listByCase(caseId);
                if (!Array.isArray(groups)) groups = [];
            } catch (error) {
                readError = String(error && error.message || error || "falha na leitura");
                groups = [];
            }
        }

        var photoIds = {};
        var photosTotal = 0;
        var groupViews = [];

        groups.forEach(function (group, gIndex) {
            var list = group && Array.isArray(group.photos) ? group.photos : [];
            var photoViews = [];
            list.forEach(function (photo, pIndex) {
                var pid = photo && photo.id != null ? String(photo.id) : "";
                if (pid) photoIds[pid] = true;
                photosTotal += 1;
                var edited = photo && photo.edited_src != null ? String(photo.edited_src).trim() : "";
                var sourceKind = edited ? "edited_src" : "src";
                photoViews.push({
                    photo_index: pIndex,
                    photo_id: pid || "(sem id)",
                    source_kind: sourceKind,
                    width: photo && photo.width != null ? photo.width : "—",
                    height: photo && photo.height != null ? photo.height : "—"
                });
            });
            groupViews.push({
                group_index: gIndex + 1,
                group_id: group && group.id != null ? String(group.id) : "(sem id)",
                photos_count: list.length,
                photos: photoViews
            });
        });

        var present = {
            A: Boolean(photoIds[FORENSIC.A]),
            B: Boolean(photoIds[FORENSIC.B]),
            C: Boolean(photoIds[FORENSIC.C]),
            D: Boolean(photoIds[FORENSIC.D])
        };

        var resultText = "Inventário local divergente. Revisar IDs exibidos.";
        if (present.A && present.B && present.C && present.D) {
            resultText = "4 fotos estão no inventário local. A/B não foram efetivamente removidas do inventário usado pelo STORAGE-B.";
        } else if (!present.A && !present.B && present.C && present.D) {
            resultText = "Inventário local contém somente as 2 fotos atuais. A/B não estão no EvidenceStore retornado ao STORAGE-B. Investigar reconciliação/soft-delete.";
        } else if (present.A && present.B && !present.C && !present.D) {
            resultText = "Inventário local está desatualizado.";
        }

        try {
            console.log("[STORAGE-B LOCAL INVENTORY DIAG]", {
                case_id: caseId || null,
                groups_total: groupViews.length,
                photos_total: photosTotal,
                forensic: present,
                result: resultText,
                groups: groupViews
            });
        } catch (logError) { /* ignore */ }

        closeDiag();
        var overlay = document.createElement("div");
        overlay.id = "aet-local-inventory-diag-overlay";
        overlay.className = "aet-local-inventory-diag-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");

        var bodyHtml = "";
        bodyHtml += "<p><strong>Case ID:</strong> " + esc(caseId || "(vazio)") + "</p>";
        if (readError) {
            bodyHtml += '<p class="aet-hint aet-hint--error">' + esc(readError) + "</p>";
        }
        bodyHtml += "<p><strong>Total de groups retornados:</strong> " + esc(String(groupViews.length)) + "</p>";
        bodyHtml += "<p><strong>Total de photos encontradas:</strong> " + esc(String(photosTotal)) + "</p>";

        groupViews.forEach(function (g) {
            bodyHtml += '<div class="aet-local-inventory-diag-group">';
            bodyHtml += "<strong>Grupo " + esc(String(g.group_index)) + "</strong>";
            bodyHtml += "<div>group_id: " + esc(g.group_id) + "</div>";
            bodyHtml += "<div>photos: " + esc(String(g.photos_count)) + "</div>";
            g.photos.forEach(function (p, idx) {
                bodyHtml += '<div class="aet-local-inventory-diag-photo">';
                bodyHtml += "<div>Foto " + esc(String(idx + 1)) + "</div>";
                bodyHtml += "<div>photo_id: " + esc(p.photo_id) + "</div>";
                bodyHtml += "<div>source: " + esc(p.source_kind) + "</div>";
                bodyHtml += "<div>width: " + esc(String(p.width)) + "</div>";
                bodyHtml += "<div>height: " + esc(String(p.height)) + "</div>";
                bodyHtml += "</div>";
            });
            bodyHtml += "</div>";
        });

        bodyHtml += '<div class="aet-local-inventory-diag-forensic">';
        bodyHtml += "<strong>FORENSE</strong>";
        bodyHtml += "<div>A presente localmente: " + (present.A ? "SIM" : "NÃO") + "</div>";
        bodyHtml += "<div>B presente localmente: " + (present.B ? "SIM" : "NÃO") + "</div>";
        bodyHtml += "<div>C presente localmente: " + (present.C ? "SIM" : "NÃO") + "</div>";
        bodyHtml += "<div>D presente localmente: " + (present.D ? "SIM" : "NÃO") + "</div>";
        bodyHtml += "</div>";

        bodyHtml += '<div class="aet-local-inventory-diag-result"><strong>RESULTADO:</strong><br>' +
            esc(resultText) + "</div>";

        overlay.innerHTML =
            '<div class="aet-local-inventory-diag-panel">' +
            '<header class="aet-local-inventory-diag-panel__head">' +
            "<strong>DIAGNÓSTICO LOCAL DE EVIDÊNCIAS</strong>" +
            '<button type="button" class="aet-local-inventory-diag-close" data-aet-local-inventory-diag-close>Fechar</button>' +
            "</header>" +
            '<div class="aet-local-inventory-diag-body">' + bodyHtml + "</div>" +
            "</div>";

        document.body.appendChild(overlay);
        var closeBtn = overlay.querySelector("[data-aet-local-inventory-diag-close]");
        if (closeBtn) closeBtn.addEventListener("click", closeDiag);
        overlay.addEventListener("click", function (ev) {
            if (ev.target === overlay) closeDiag();
        });
    },

    /**
     * Shell da Gestão — lista de trabalhos + catálogo.
     * NÃO é etapa do fluxo (sem "etapa 0 de 5").
     */
    renderGestaoStub: function () {
        if (!this.canOpenGestao()) {
            return '<section class="aet-card"><p class="aet-hint">Gestão disponível somente para administrador Bolt autorizado.</p></section>';
        }
        const sections = (domain().GESTAO_SECTIONS || []).map(function (s) {
            if (s.id === "recent_activities") {
                return '<article class="aet-gestao-panel" data-aet-gestao-section="recent_activities">' +
                    '<div class="aet-gestao-toolbar">' +
                    '<div class="aet-gestao-filters" data-aet-gestao-filters>' +
                    '<button type="button" class="is-on" data-aet-gestao-filter="todos">Todos</button>' +
                    '<button type="button" data-aet-gestao-filter="com_pedido">Com pedido</button>' +
                    '<button type="button" data-aet-gestao-filter="sem_pedido">Sem pedido</button>' +
                    "</div>" +
                    '<input type="search" class="aet-gestao-search" data-aet-gestao-search ' +
                    'placeholder="Buscar por pedido, título, cliente, responsável ou nº relatório…" autocomplete="off">' +
                    "</div>" +
                    '<div class="aet-gestao-activities" data-aet-company-activities>' +
                    '<p class="aet-hint">Carregando atendimentos da equipe…</p>' +
                    "</div></article>";
            }
            if (s.id === "service_codes") {
                return "";
            }
            return "";
        }).join("");
        return '<section class="aurora-module aet-gestao-shell" data-module="aet-gestao">' +
            sections +
            '<div class="aet-catalog-overlay" data-aet-catalog-overlay hidden></div>' +
            "</section>";
    },

    formatGestaoDate: function (value) {
        if (!value) return "—";
        try {
            var d = new Date(value);
            if (isNaN(d.getTime())) return String(value);
            return d.toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch (error) {
            return String(value);
        }
    },

    /**
     * JSON columns da RPC (setof aurora_projects) podem vir objeto ou string.
     */
    parseGestaoJson: function (value) {
        if (!value) return {};
        if (typeof value === "object") return value;
        if (typeof value === "string") {
            try {
                var parsed = JSON.parse(value);
                return parsed && typeof parsed === "object" ? parsed : {};
            } catch (error) {
                return {};
            }
        }
        return {};
    },

    gestaoNormText: function (value) {
        return String(value == null ? "" : value).trim();
    },

    gestaoLooksLikeUuid: function (value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(this.gestaoNormText(value));
    },

    /**
     * Extrai payload útil do projeto cloud Tupy sem inventar campos.
     * title na coluna aurora_projects costuma ser customer.name (ex.: "Tupy S.A.")
     * — o título do trabalho fica em servico.titulo / report_title / intake.reason.
     */
    extractGestaoActivityFields: function (row) {
        var customer = this.parseGestaoJson(row && row.customer);
        var intake = this.parseGestaoJson(row && row.intake);
        var asset = this.parseGestaoJson(row && row.asset);
        var approval = this.parseGestaoJson(row && row.approval);
        var diagnostic = this.parseGestaoJson(row && row.diagnostic);
        var workflow = this.parseGestaoJson(row && row.workflow_state);
        var fullCase = this.parseGestaoJson(workflow.full_case);
        var tupy = fullCase.eletrica_tupy || workflow.eletrica_tupy || {};
        if (typeof tupy !== "object" || !tupy) tupy = {};
        var servico = tupy.servico && typeof tupy.servico === "object" ? tupy.servico : {};
        var conclusao = tupy.conclusao && typeof tupy.conclusao === "object" ? tupy.conclusao : {};
        var fullApproval = fullCase.approval && typeof fullCase.approval === "object" ? fullCase.approval : {};
        var fullCustomer = fullCase.customer && typeof fullCase.customer === "object" ? fullCase.customer : {};

        var clientName = this.gestaoNormText(
            customer.name || customer.company_name || customer.company ||
            fullCustomer.name || fullCustomer.company_name || fullCustomer.company ||
            servico.cliente || ""
        );

        function sameAsClient(text) {
            var t = String(text || "").trim();
            if (!t || !clientName) return false;
            return t.toLowerCase() === clientName.toLowerCase();
        }

        var titleCandidates = [
            servico.titulo,
            approval.report_title,
            fullApproval.report_title,
            fullCase.report_title,
            intake.reason,
            asset.notes,
            diagnostic.summary
        ];
        var title = "";
        for (var i = 0; i < titleCandidates.length; i += 1) {
            var candidate = this.gestaoNormText(titleCandidates[i]);
            if (!candidate || sameAsClient(candidate)) continue;
            /* summary pode trazer "Título. Atividades…" — usar só o trecho inicial */
            if (titleCandidates[i] === diagnostic.summary && candidate.indexOf(". ") !== -1) {
                candidate = this.gestaoNormText(candidate.split(". ")[0]);
                if (!candidate || sameAsClient(candidate)) continue;
            }
            title = candidate;
            break;
        }
        if (!title) {
            var rawTitle = this.gestaoNormText(row && row.title);
            if (rawTitle && !sameAsClient(rawTitle) && rawTitle.toLowerCase() !== "projeto aurora") {
                title = rawTitle;
            }
        }
        if (!title) title = "Atendimento Elétrica Tupy";

        var responsibleCandidates = [
            conclusao.responsavel,
            servico.solicitante,
            approval.approved_by,
            fullApproval.approved_by,
            intake.responsible,
            intake.customer_request,
            customer.responsible,
            fullCustomer.responsible
        ];
        var responsible = "";
        for (var r = 0; r < responsibleCandidates.length; r += 1) {
            var name = this.gestaoNormText(responsibleCandidates[r]);
            if (!name || this.gestaoLooksLikeUuid(name) || /@/.test(name)) continue;
            responsible = name;
            break;
        }

        var activityDefs = [
            { id: "iluminacao", label: "Iluminação" },
            { id: "ventiladores", label: "Ventiladores" },
            { id: "escritorio", label: "Escritório" },
            { id: "outros", label: "Outros" }
        ];
        var activityLabels = [];
        for (var ai = 0; ai < activityDefs.length; ai += 1) {
            var def = activityDefs[ai];
            if (tupy.atividades && tupy.atividades[def.id]) {
                var actDet = tupy.detalhes && tupy.detalhes[def.id] ? tupy.detalhes[def.id] : {};
                activityLabels.push(def.id === "outros" ? (this.gestaoNormText(actDet.nome_trabalho) || def.label) : def.label);
            }
        }

        return {
            title: title,
            client: clientName,
            responsible: responsible,
            executed_by: responsible || null,
            budget_number: servico.budget_number != null ? String(servico.budget_number).trim() : "",
            created_by: row && row.created_by ? String(row.created_by) : null,
            activity_summary: activityLabels.join(" · "),
            status: row && row.status,
            updated_at: row && (row.updated_at || row.created_at),
            created_at: row && row.created_at,
            id: row && row.id
        };
    },

    statusGestaoLabel: function (status) {
        var s = String(status || "").toLowerCase().trim();
        if (s === "completed" || s === "concluído" || s === "concluido") return "Concluído";
        if (s === "in_progress" || s === "em andamento") return "Em andamento";
        if (s === "draft" || s === "rascunho") return "Rascunho";
        if (s === "awaiting_review" || s === "aguardando revisão" || s === "aguardando revisao") {
            return "Aguardando revisão";
        }
        return status ? String(status) : "—";
    },

    statusGestaoTone: function (status) {
        var s = String(status || "").toLowerCase().trim();
        if (s === "completed" || s === "concluído" || s === "concluido") return "ok";
        if (s === "in_progress" || s === "em andamento") return "progress";
        if (s === "draft" || s === "rascunho" || s === "awaiting_review" ||
            s === "aguardando revisão" || s === "aguardando revisao") {
            return "pending";
        }
        return "neutral";
    },

    gestaoEyeIconHtml: function () {
        return '<svg class="aet-gestao-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
            'd="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z"/>' +
            '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
    },

    gestaoEditIconHtml: function () {
        return '<svg class="aet-gestao-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
            'd="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/>' +
            '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
            'd="m13.5 6.5 4 4"/></svg>';
    },

    gestaoDeleteIconHtml: function () {
        return '<svg class="aet-gestao-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
            'd="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12Z"/>' +
            '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M10 11v6M14 11v6"/></svg>';
    },

    renderGestaoCardActionsHtml: function (fields, options) {
        options = options || {};
        var isPeer = !!options.isPeer;
        var showDelete = options.showDelete !== false;
        if (!fields || !fields.id) return "";
        var eye = this.gestaoEyeIconHtml();
        var edit = this.gestaoEditIconHtml();
        var trash = this.gestaoDeleteIconHtml();
        var reviewBtn = this.canOpenGestao()
            ? '<button type="button" class="aet-gestao-action aet-gestao-action--edit" data-aet-admin-review="' +
                esc(fields.id) + '" title="Revisar vistoria" aria-label="Revisar vistoria">' +
                '<span class="aet-gestao-action__icon">' + edit + "</span>" +
                '<span class="aet-gestao-action__label">Revisar</span></button>'
            : "";
        var viewBtn =
            '<button type="button" class="aet-gestao-action aet-gestao-action--view" data-aet-admin-open="' +
            esc(fields.id) + '" title="Visualizar relatório" aria-label="Visualizar relatório">' +
            '<span class="aet-gestao-action__icon">' + eye + "</span>" +
            '<span class="aet-gestao-action__label">Visualizar</span></button>';
        var deleteBtn = showDelete
            ? '<button type="button" class="aet-gestao-action aet-gestao-action--delete" data-aet-gestao-delete="' +
                esc(fields.id) + '" title="Excluir orçamento" aria-label="Excluir orçamento">' +
                '<span class="aet-gestao-action__icon">' + trash + "</span>" +
                '<span class="aet-gestao-action__label">Excluir</span></button>'
            : "";
        return '<div class="aet-gestao-rich-card__actions-inner">' + reviewBtn + viewBtn + deleteBtn + "</div>";
    },

    computeGestaoMetrics: function (rows) {
        var list = Array.isArray(rows) ? rows : [];
        var metrics = { total: list.length, completed: 0, in_progress: 0, pending: 0 };
        for (var i = 0; i < list.length; i += 1) {
            var tone = this.statusGestaoTone(list[i] && list[i].status);
            if (tone === "ok") metrics.completed += 1;
            else if (tone === "progress") metrics.in_progress += 1;
            else metrics.pending += 1;
        }
        return metrics;
    },

    renderGestaoMetricsHtml: function (rows) {
        var m = this.computeGestaoMetrics(rows);
        return '<div class="aet-gestao-metrics" data-aet-gestao-metrics>' +
            '<div class="aet-gestao-metric"><span>Total de atendimentos</span><strong>' + esc(String(m.total)) + "</strong></div>" +
            '<div class="aet-gestao-metric aet-gestao-metric--ok"><span>Concluídos</span><strong>' + esc(String(m.completed)) + "</strong></div>" +
            '<div class="aet-gestao-metric aet-gestao-metric--progress"><span>Em andamento</span><strong>' + esc(String(m.in_progress)) + "</strong></div>" +
            '<div class="aet-gestao-metric aet-gestao-metric--pending"><span>Pendentes</span><strong>' + esc(String(m.pending)) + "</strong></div>" +
            "</div>";
    },

    sortCompanyActivityRows: function (rows) {
        var list = Array.isArray(rows) ? rows.slice() : [];
        list.sort(function (a, b) {
            var ta = new Date((a && (a.updated_at || a.created_at)) || 0).getTime();
            var tb = new Date((b && (b.updated_at || b.created_at)) || 0).getTime();
            if (isNaN(ta)) ta = 0;
            if (isNaN(tb)) tb = 0;
            return tb - ta;
        });
        return list;
    },

    renderCompanyActivitiesHtml: function (rows, options) {
        options = options || {};
        var filter = String(options.filter || this._gestaoFilter || "todos");
        var query = String(options.query != null ? options.query : (this._gestaoSearch || "")).trim().toLowerCase();
        var pageSize = 8;
        var page = Math.max(1, Number(options.page || this._gestaoPage || 1) || 1);
        var allRows = Array.isArray(rows) ? rows : [];
        var metricsHtml = this.renderGestaoMetricsHtml(allRows);

        if (!allRows.length) {
            return metricsHtml + '<p class="aet-hint">Nenhum atendimento da equipe encontrado.</p>';
        }

        var self = this;
        var pedidosApi = global.AuroraEletricaTupyPedidos;
        var reportApi = global.AuroraEletricaTupyReportNumber;
        var currentUserId = String(this._gestaoCurrentUserId || "");
        var ordered = this.sortCompanyActivityRows(allRows).filter(function (row) {
            var fields = self.extractGestaoActivityFields(row);
            var pid = String(fields.id || "");
            var pedidos = (pedidosApi && typeof pedidosApi.get === "function") ? pedidosApi.get(pid) : [];
            var hasPedido = Array.isArray(pedidos) && pedidos.length > 0;
            if (filter === "com_pedido" && !hasPedido) return false;
            if (filter === "sem_pedido" && hasPedido) return false;
            if (!query) return true;
            var reportNo = (reportApi && typeof reportApi.get === "function") ? (reportApi.get(pid) || "") : "";
            var blob = [
                fields.title,
                fields.client,
                fields.responsible,
                fields.activity_summary,
                fields.budget_number,
                fields.id,
                fields.legacy_case_id,
                reportNo,
                (pedidos || []).map(function (p) { return p.numero; }).join(" ")
            ].join(" ").toLowerCase();
            return blob.indexOf(query) !== -1;
        });

        if (!ordered.length) {
            return metricsHtml + '<p class="aet-hint">Nenhum atendimento neste filtro.</p>';
        }

        var totalFiltered = ordered.length;
        var totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
        if (page > totalPages) page = totalPages;
        this._gestaoPage = page;
        var start = (page - 1) * pageSize;
        var pageRows = ordered.slice(start, start + pageSize);
        var endShown = Math.min(start + pageRows.length, totalFiltered);

        var header =
            '<div class="aet-gestao-rich-head">' +
            "<span>" + totalFiltered + " atendimento(s)</span>" +
            '<button type="button" class="aet-gestao-select-mode" data-aet-gestao-select-mode>Selecionar vários</button>' +
            '<div class="aet-gestao-bulk" data-aet-gestao-bulk hidden>' +
            '<label><input type="checkbox" data-aet-gestao-select-page> Selecionar desta página</label>' +
            '<button type="button" class="aet-gestao-bulk-delete" data-aet-gestao-delete-selected disabled>Excluir selecionados</button>' +
            '</div></div>';

        var rowsHtml = pageRows.map(function (row) {
            var fields = self.extractGestaoActivityFields(row);
            var status = self.statusGestaoLabel(fields.status);
            var tone = self.statusGestaoTone(fields.status);
            var updated = self.formatGestaoDate(fields.updated_at);
            var pedidos = (pedidosApi && typeof pedidosApi.get === "function") ? pedidosApi.get(fields.id) : [];
            var pedidoTxt = (pedidos || []).map(function (p) { return p.numero; }).filter(Boolean).join(", ") || "—";
            var reportNo = (reportApi && typeof reportApi.get === "function")
                ? (reportApi.get(fields.id) || "—")
                : "—";
            var budgetNo = fields.budget_number || "—";
            var isPeer = self.isCompanyPeerProjectRow(row, currentUserId);
            var actionsHtml = self.renderGestaoCardActionsHtml(fields, { isPeer: isPeer });
            var peerBadge = isPeer
                ? '<span class="aet-gestao-badge aet-gestao-badge--peer">Equipe</span>'
                : "";
            var subtitle = fields.activity_summary
                ? '<p class="aet-gestao-rich-card__sub">' + esc(fields.activity_summary) + "</p>"
                : "";
            return '<article class="aet-gestao-rich-card' + (isPeer ? " aet-gestao-rich-card--peer" : "") +
                '" data-project-id="' + esc(fields.id || "") + '" data-is-peer="' + (isPeer ? "1" : "0") + '">' +
                '<label class="aet-gestao-select" data-aet-gestao-select-wrap title="Selecionar atividade" hidden><input type="checkbox" data-aet-gestao-select value="' + esc(fields.id || "") + '"><span>Selecionar</span></label>' +
                '<div class="aet-gestao-rich-card__main">' +
                '<div class="aet-gestao-rich-card__icon" aria-hidden="true">▤</div>' +
                '<div class="aet-gestao-rich-card__body">' +
                '<div class="aet-gestao-rich-card__title-row">' + peerBadge +
                "<strong>" + esc(fields.title || "Atendimento") + "</strong>" +
                '<span class="aet-gestao-badge aet-gestao-badge--' + esc(tone) + '">' + esc(status) + "</span></div>" +
                subtitle +
                '<div class="aet-gestao-rich-card__meta">' +
                "<span>Cliente: <b>" + esc(fields.client || "Tupy S.A.") + "</b></span>" +
                "<span>Responsável: <b>" + esc(fields.responsible || "não informado") + "</b></span>" +
                "<span>Orçamento: <b>" + esc(budgetNo) + "</b></span>" +
                "<span>Pedido: <b>" + esc(pedidoTxt) + "</b></span>" +
                "<span>Relatório: <b>" + esc(reportNo) + "</b></span>" +
                "<span>Atualizado: <b>" + esc(updated) + "</b></span>" +
                "</div></div></div>" +
                '<div class="aet-gestao-rich-card__actions">' + actionsHtml + "</div>" +
                "</article>";
        }).join("");

        var pagerBtns = "";
        if (totalPages > 1) {
            pagerBtns += '<button type="button" class="aet-gestao-page" data-aet-gestao-page="' +
                Math.max(1, page - 1) + '"' + (page <= 1 ? " disabled" : "") + " aria-label=\"Página anterior\">←</button>";
            for (var p = 1; p <= totalPages; p += 1) {
                if (totalPages > 7 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) {
                    if (p === 2 || p === totalPages - 1) {
                        pagerBtns += '<span class="aet-gestao-page-ellipsis">…</span>';
                    }
                    continue;
                }
                pagerBtns += '<button type="button" class="aet-gestao-page' + (p === page ? " is-on" : "") +
                    '" data-aet-gestao-page="' + p + '">' + p + "</button>";
            }
            pagerBtns += '<button type="button" class="aet-gestao-page" data-aet-gestao-page="' +
                Math.min(totalPages, page + 1) + '"' + (page >= totalPages ? " disabled" : "") +
                " aria-label=\"Próxima página\">→</button>";
        }

        var pager = '<div class="aet-gestao-pager" data-aet-gestao-pager>' +
            '<div class="aet-gestao-pager__pages">' + pagerBtns + "</div>" +
            '<p class="aet-gestao-pager__info">Mostrando ' + (start + 1) + "–" + endShown +
            " de " + totalFiltered + " atendimentos</p></div>";

        return metricsHtml +
            '<div class="aet-gestao-board aet-gestao-board--rich">' +
            header +
            '<div class="aet-gestao-rich-list" role="list">' + rowsHtml + "</div>" +
            pager +
            "</div>";
    },

    bindGestaoFilters: function (root) {
        if (!root) return;
        var self = this;
        var filterHost = root.querySelector("[data-aet-gestao-filters]");
        var search = root.querySelector("[data-aet-gestao-search]");
        var activitiesHost = root.querySelector("[data-aet-company-activities]");
        if (!this._gestaoFilter) this._gestaoFilter = "todos";
        if (this._gestaoSearch == null) this._gestaoSearch = "";
        if (!this._gestaoPage) this._gestaoPage = 1;

        function refreshList() {
            if (!activitiesHost) return;
            var rows = self._gestaoCompanyRows || [];
            activitiesHost.innerHTML = self.renderCompanyActivitiesHtml(rows, {
                filter: self._gestaoFilter,
                query: self._gestaoSearch,
                page: self._gestaoPage
            });
            self.bindAdminDetailOpen(activitiesHost);
            self.bindAdminReviewOpen(activitiesHost);
            self.bindGestaoDeleteOpen(activitiesHost);
            self.bindGestaoBulkDelete(activitiesHost);
            self.bindGestaoPagination(activitiesHost);
        }

        if (filterHost && !filterHost.__aetBound) {
            filterHost.__aetBound = true;
            filterHost.addEventListener("click", function (e) {
                var btn = e.target.closest("[data-aet-gestao-filter]");
                if (!btn) return;
                self._gestaoFilter = btn.getAttribute("data-aet-gestao-filter") || "todos";
                self._gestaoPage = 1;
                var buttons = filterHost.querySelectorAll("[data-aet-gestao-filter]");
                for (var i = 0; i < buttons.length; i += 1) {
                    buttons[i].classList.toggle("is-on", buttons[i] === btn);
                }
                refreshList();
            });
        }
        if (search && !search.__aetBound) {
            search.__aetBound = true;
            search.value = this._gestaoSearch || "";
            search.addEventListener("input", function () {
                self._gestaoSearch = search.value || "";
                self._gestaoPage = 1;
                refreshList();
            });
        }

        this._refreshGestaoList = refreshList;
    },

    bindGestaoPagination: function (host) {
        if (!host) return;
        var self = this;
        var buttons = host.querySelectorAll("[data-aet-gestao-page]");
        for (var i = 0; i < buttons.length; i += 1) {
            (function (btn) {
                btn.addEventListener("click", function (ev) {
                    ev.preventDefault();
                    var next = Number(btn.getAttribute("data-aet-gestao-page") || 1) || 1;
                    self._gestaoPage = Math.max(1, next);
                    if (typeof self._refreshGestaoList === "function") self._refreshGestaoList();
                });
            })(buttons[i]);
        }
    },

    /**
     * Extrai modelo READ-ONLY do row cloud (RPC listagem) sem importar localmente.
     * Fotos cloud entram depois via STORAGE-C (group_id ↔ evidence_groups[].id).
     */
    buildAdminDetailModel: function (row) {
        var fields = this.extractGestaoActivityFields(row);
        var customer = this.parseGestaoJson(row && row.customer);
        var intake = this.parseGestaoJson(row && row.intake);
        var asset = this.parseGestaoJson(row && row.asset);
        var workflow = this.parseGestaoJson(row && row.workflow_state);
        var fullCase = this.parseGestaoJson(workflow.full_case);
        var tupy = fullCase.eletrica_tupy || workflow.eletrica_tupy || {};
        if (typeof tupy !== "object" || !tupy) tupy = {};
        var servico = tupy.servico && typeof tupy.servico === "object" ? tupy.servico : {};
        var atividades = tupy.atividades && typeof tupy.atividades === "object" ? tupy.atividades : {};
        var detalhes = tupy.detalhes && typeof tupy.detalhes === "object" ? tupy.detalhes : {};
        var materiaisBag = tupy.materiais && typeof tupy.materiais === "object" ? tupy.materiais : {};
        var conclusao = tupy.conclusao && typeof tupy.conclusao === "object" ? tupy.conclusao : {};

        var activityDefs = [
            { id: "iluminacao", label: "Iluminação" },
            { id: "ventiladores", label: "Ventiladores" },
            { id: "escritorio", label: "Escritório" },
            { id: "outros", label: "Outros" }
        ];
        var dayLabels = { weekday: "Dia de semana", saturday: "Sábado", sunday: "Domingo" };
        var activities = [];
        for (var a = 0; a < activityDefs.length; a += 1) {
            var def = activityDefs[a];
            if (!atividades[def.id]) continue;
            var det = detalhes[def.id] && typeof detalhes[def.id] === "object" ? detalhes[def.id] : {};
            var dayKey = String(det.day_type || det.tipo_dia || "").trim();
            activities.push({
                id: def.id,
                label: def.id === "outros" ? (this.gestaoNormText(det.nome_trabalho) || def.label) : def.label,
                descricao: this.gestaoNormText(det.descricao),
                quantidade: this.gestaoNormText(det.quantidade),
                data: this.gestaoNormText(det.data),
                tipo_dia: dayLabels[dayKey] || this.gestaoNormText(dayKey),
                day_type_key: dayKey || ""
            });
        }

        var materials = [];
        Object.keys(materiaisBag).forEach(function (key) {
            var m = materiaisBag[key];
            if (!m || typeof m !== "object") return;
            var selected = m.selected === true || m.selected === "true" || m.selected === 1;
            var qty = m.quantity != null && m.quantity !== "" ? m.quantity : m.quantidade;
            var hasQty = qty != null && String(qty).trim() !== "" && Number(qty) !== 0;
            if (!selected && !hasQty) return;
            materials.push({
                sap: this.gestaoNormText(m.sap || key),
                descricao: this.gestaoNormText(m.descricao || m.description || m.nome),
                quantidade: this.gestaoNormText(qty),
                unidade: this.gestaoNormText(m.unidade || m.unit || m.unidade_medida),
                tipo: this.gestaoNormText(m.tipo || m.type),
                atividade: this.gestaoNormText(m.atividade)
            });
        }, this);

        var groupsRaw = Array.isArray(fullCase.evidence_groups)
            ? fullCase.evidence_groups
            : (Array.isArray(fullCase.occurrences) ? fullCase.occurrences : []);
        var records = [];
        for (var g = 0; g < groupsRaw.length; g += 1) {
            var group = groupsRaw[g];
            if (!group || typeof group !== "object") continue;
            records.push({
                group_id: this.gestaoNormText(group.id),
                title: this.gestaoNormText(group.title || group.item || group.label || "Registro"),
                description: this.gestaoNormText(group.description || group.descricao),
                severity: this.gestaoNormText(group.severity || group.gravidade),
                recommendation: this.gestaoNormText(group.recommendation || group.recomendacao),
                record_kind: this.gestaoNormText(group.record_kind || group.tipo || group.phase || group.fase),
                local_photo_count: Array.isArray(group.photos) ? group.photos.length : 0
            });
        }

        return {
            project_id: fields.id || null,
            company_id: row && row.company_id ? String(row.company_id) : null,
            title: fields.title,
            client: fields.client,
            responsible: fields.responsible,
            status: fields.status,
            status_label: this.statusGestaoLabel(fields.status),
            updated_at: fields.updated_at,
            created_at: fields.created_at,
            legacy_case_id: row && row.legacy_case_id ? String(row.legacy_case_id) : this.gestaoNormText(fullCase.id),
            servico: {
                cliente: this.gestaoNormText(servico.cliente || fields.client),
                empresa: this.gestaoNormText(servico.empresa),
                solicitante: this.gestaoNormText(servico.solicitante),
                setor: this.gestaoNormText(servico.setor || asset.sector || asset.setor),
                local: this.gestaoNormText(servico.local || asset.location || asset.local),
                ponto_referencia: this.gestaoNormText(servico.ponto_referencia),
                titulo: this.gestaoNormText(servico.titulo || fields.title),
                descricao: this.gestaoNormText(servico.descricao || intake.reason),
                data_inicio: this.gestaoNormText(servico.data_inicio),
                budget_number: servico.budget_number != null && String(servico.budget_number).trim() !== ""
                    ? String(servico.budget_number)
                    : ""
            },
            conclusao: {
                status: this.gestaoNormText(conclusao.status),
                descricao: this.gestaoNormText(conclusao.descricao),
                pendencias: this.gestaoNormText(conclusao.pendencias),
                observacoes: this.gestaoNormText(conclusao.observacoes),
                responsavel: this.gestaoNormText(conclusao.responsavel || fields.responsible),
                data: this.gestaoNormText(conclusao.data)
            },
            customer_name: this.gestaoNormText(customer.name || customer.company_name),
            activities: activities,
            materials: materials,
            records: records,
            association_by_group_id: true
        };
    },

    adminDetailKvHtml: function (label, value) {
        var text = this.gestaoNormText(value);
        if (!text) return "";
        return '<div class="aet-admin-kv"><span>' + esc(label) + "</span><strong>" + esc(text) + "</strong></div>";
    },

    renderAdminDetailHtml: function (model) {
        var self = this;
        var headerBits =
            this.adminDetailKvHtml("Cliente", model.client || model.servico.cliente) +
            this.adminDetailKvHtml("Responsável", model.responsible || model.conclusao.responsavel) +
            this.adminDetailKvHtml("Status", model.status_label) +
            this.adminDetailKvHtml("Atualizado", this.formatGestaoDate(model.updated_at)) +
            this.adminDetailKvHtml("Criado", this.formatGestaoDate(model.created_at)) +
            this.adminDetailKvHtml("Identificação local", model.legacy_case_id);

        var servicoBits =
            this.adminDetailKvHtml("Título", model.servico.titulo) +
            this.adminDetailKvHtml("Cliente", model.servico.cliente) +
            this.adminDetailKvHtml("Empresa executora", model.servico.empresa) +
            this.adminDetailKvHtml("Solicitante", model.servico.solicitante) +
            this.adminDetailKvHtml("Setor", model.servico.setor) +
            this.adminDetailKvHtml("Local", model.servico.local) +
            this.adminDetailKvHtml("Ponto de referência", model.servico.ponto_referencia) +
            this.adminDetailKvHtml("Descrição", model.servico.descricao) +
            this.adminDetailKvHtml("Data início", model.servico.data_inicio) +
            this.adminDetailKvHtml("Budget", model.servico.budget_number);

        var activitiesHtml = "";
        if (!model.activities.length) {
            activitiesHtml = '<p class="aet-hint">Nenhuma atividade marcada no registro de campo.</p>';
        } else {
            activitiesHtml = model.activities.map(function (act) {
                return '<article class="aet-admin-subcard" data-aet-admin-activity="' + esc(act.id) + '">' +
                    "<strong>" + esc(act.label) + "</strong>" +
                    self.adminDetailKvHtml("Descrição", act.descricao) +
                    self.adminDetailKvHtml("Quantidade", act.quantidade) +
                    self.adminDetailKvHtml("Data de início", act.data) +
                    "</article>";
            }).join("");
        }

        var materialsHtml = "";
        if (!model.materials.length) {
            materialsHtml = '<p class="aet-hint">Nenhum material registrado.</p>';
        } else {
            materialsHtml = '<ul class="aet-admin-mat-list">' + model.materials.map(function (m) {
                var line = esc(m.descricao || m.sap || "Material");
                if (m.sap && String(m.sap).indexOf("custom_") !== 0) line += " <small>SAP " + esc(m.sap) + "</small>";
                else if (m.sap) line += " <small>Material avulso</small>";
                if (m.quantidade) line += " <small>Qtd: " + esc(m.quantidade) + "</small>";
                if (m.atividade) line += " <small>" + esc(m.atividade) + "</small>";
                return "<li>" + line + "</li>";
            }).join("") + "</ul>";
        }

        var recordsHtml = "";
        if (!model.records.length) {
            recordsHtml = '<p class="aet-hint">Nenhum registro de campo encontrado no payload sincronizado.</p>';
        } else {
            recordsHtml = model.records.map(function (rec) {
                return '<article class="aet-admin-subcard aet-admin-record" data-aet-admin-group="' +
                    esc(rec.group_id) + '">' +
                    "<strong>" + esc(rec.title || "Registro") + "</strong>" +
                    self.adminDetailKvHtml("Tipo / fase", rec.record_kind) +
                    self.adminDetailKvHtml("Descrição", rec.description) +
                    self.adminDetailKvHtml("Gravidade", rec.severity) +
                    self.adminDetailKvHtml("Recomendações", rec.recommendation) +
                    '<div class="aet-admin-record-photos" data-aet-admin-group-photos="' +
                    esc(rec.group_id) + '">' +
                    '<p class="aet-hint">Carregando evidências…</p>' +
                    "</div>" +
                    "</article>";
            }).join("");
        }

        return '<div class="aet-admin-detail" data-aet-admin-detail>' +
            '<header class="aet-admin-detail__head">' +
            "<div><p class=\"aet-admin-eyebrow\">GESTÃO ELÉTRICA TUPY</p>" +
            "<h2>" + esc(model.title || "Atendimento") + "</h2>" +
            '<p class="aet-hint aet-admin-readonly-badge">Visão administrativa · somente leitura</p></div>' +
            '<button type="button" class="aet-admin-detail-close" data-aet-admin-close>Fechar</button>' +
            "</header>" +
            '<section class="aet-admin-section">' +
            "<h3>Identificação</h3>" +
            '<div class="aet-admin-grid">' + headerBits + "</div>" +
            '<p class="aet-hint aet-admin-diag">project_id: ' + esc(model.project_id || "—") + "</p>" +
            "</section>" +
            '<section class="aet-admin-section" data-aet-admin-field-block>' +
            "<h3>Registro de campo — Dados do serviço</h3>" +
            '<div class="aet-admin-grid">' + (servicoBits || '<p class="aet-hint">Sem dados de serviço no payload.</p>') +
            "</div></section>" +
            '<section class="aet-admin-section">' +
            "<h3>Registro de campo — Atividades executadas</h3>" +
            activitiesHtml +
            "</section>" +
            '<section class="aet-admin-section">' +
            "<h3>Registro de campo — Materiais</h3>" +
            materialsHtml +
            "</section>" +
            '<section class="aet-admin-section">' +
            "<h3>Registro de campo — Registros</h3>" +
            recordsHtml +
            '<div class="aet-admin-orphan-photos" data-aet-admin-orphan-photos hidden></div>' +
            "</section>" +
            '<section class="aet-admin-section aet-admin-section--admin" data-aet-admin-treatment>' +
            "<h3>Tratamento administrativo</h3>" +
            '<p class="aet-hint aet-admin-ephemeral">Protótipo de revisão — alterações de texto ainda não são salvas.</p>' +
            this.renderAdminReportReviewHtml(model) +
            '<div class="aet-admin-codes-block">' +
            "<h4 class=\"aet-admin-block-title\">Códigos administrativos</h4>" +
            '<p class="aet-hint">Associe os códigos dos serviços aos trabalhos executados. O botão Salvar abaixo persiste somente os códigos.</p>' +
            this.renderAdminServiceCodesSectionHtml(model) +
            '<div class="aet-admin-save-bar">' +
            '<button type="button" class="aet-admin-save-codes" data-aet-admin-save-codes>Salvar tratamento administrativo</button>' +
            '<p class="aet-hint aet-admin-save-status" data-aet-admin-save-status></p>' +
            "</div></div>" +
            "</section>" +
            "</div>";
    },

    /**
     * Protótipo EM MEMÓRIA — revisão para relatório.
     * Não persiste; não altera payload de campo / códigos cloud.
     */
    renderAdminReportReviewHtml: function (model) {
        var titleSuggest = this.gestaoNormText(
            (model.servico && model.servico.titulo) || model.title || ""
        );
        var acts = model && Array.isArray(model.activities) ? model.activities : [];
        var self = this;
        var activityReviews = "";
        if (!acts.length) {
            activityReviews = '<p class="aet-hint">Nenhuma atividade de campo para revisar.</p>';
        } else {
            activityReviews = acts.map(function (act) {
                return '<article class="aet-admin-review-activity" data-aet-admin-review-activity="' +
                    esc(act.id) + '">' +
                    '<div class="aet-admin-review-activity__original">' +
                    "<h5>Atividade original</h5>" +
                    "<strong>" + esc(act.label) + "</strong>" +
                    self.adminDetailKvHtml("Descrição de campo", act.descricao || "—") +
                    self.adminDetailKvHtml("Quantidade", act.quantidade) +
                    self.adminDetailKvHtml("Data de início", act.data) +
                    "</div>" +
                    '<label class="aet-admin-review-field">' +
                    "<span>Descrição para o relatório</span>" +
                    '<textarea rows="3" data-aet-admin-review-activity-desc="' + esc(act.id) + '" ' +
                    'placeholder="Texto profissional desta atividade para o relatório">' +
                    esc(act.descricao || "") +
                    "</textarea></label>" +
                    "</article>";
            }).join("");
        }

        return '<div class="aet-admin-review" data-aet-admin-review>' +
            '<div class="aet-admin-review__original">' +
            "<h4 class=\"aet-admin-block-title\">Registro original</h4>" +
            '<p class="aet-hint">Somente leitura — enviado pelo campo (USER_BOLT).</p>' +
            '<div class="aet-admin-grid">' +
            this.adminDetailKvHtml("Título original", titleSuggest) +
            this.adminDetailKvHtml("Cliente", model.client || (model.servico && model.servico.cliente)) +
            this.adminDetailKvHtml("Responsável", model.responsible) +
            this.adminDetailKvHtml("Descrição de serviço (campo)", model.servico && model.servico.descricao) +
            "</div></div>" +
            '<div class="aet-admin-review__edit">' +
            "<h4 class=\"aet-admin-block-title\">Revisão para o relatório</h4>" +
            '<p class="aet-hint">Campos experimentais em memória — não sobrescrevem o registro original.</p>' +
            '<label class="aet-admin-review-field"><span>Título do trabalho</span>' +
            '<input type="text" data-aet-admin-review-title value="' + esc(titleSuggest) + '" ' +
            'placeholder="Título profissional para o relatório">' +
            "</label>" +
            '<label class="aet-admin-review-field"><span>Descrição administrativa do serviço</span>' +
            '<textarea rows="4" data-aet-admin-review-service-desc ' +
            'placeholder="Descrição profissional do serviço para o relatório final"></textarea>' +
            "</label>" +
            '<label class="aet-admin-review-field"><span>Observações administrativas</span>' +
            '<textarea rows="3" data-aet-admin-review-notes ' +
            'placeholder="Opcional — observações para o relatório"></textarea>' +
            "</label>" +
            "<h5 class=\"aet-admin-review-sub\">Descrição para o relatório por atividade</h5>" +
            activityReviews +
            "</div></div>";
    },

    bindAdminReportReviewUi: function (overlay, model) {
        if (!overlay || !model) return;
        var self = this;
        var acts = Array.isArray(model.activities) ? model.activities : [];
        var activityDesc = {};
        acts.forEach(function (act) {
            if (act && act.id) activityDesc[act.id] = act.descricao || "";
        });
        this._adminReportReviewState = {
            title: this.gestaoNormText((model.servico && model.servico.titulo) || model.title || ""),
            service_description: "",
            notes: "",
            activity_descriptions: activityDesc
        };

        function syncState() {
            var st = self._adminReportReviewState;
            if (!st) return;
            var titleEl = overlay.querySelector("[data-aet-admin-review-title]");
            var descEl = overlay.querySelector("[data-aet-admin-review-service-desc]");
            var notesEl = overlay.querySelector("[data-aet-admin-review-notes]");
            if (titleEl) st.title = titleEl.value;
            if (descEl) st.service_description = descEl.value;
            if (notesEl) st.notes = notesEl.value;
            var areas = overlay.querySelectorAll("[data-aet-admin-review-activity-desc]");
            for (var i = 0; i < areas.length; i += 1) {
                var aid = areas[i].getAttribute("data-aet-admin-review-activity-desc") || "";
                if (aid) st.activity_descriptions[aid] = areas[i].value;
            }
        }

        var fields = overlay.querySelectorAll(
            "[data-aet-admin-review-title], [data-aet-admin-review-service-desc], " +
            "[data-aet-admin-review-notes], [data-aet-admin-review-activity-desc]"
        );
        for (var f = 0; f < fields.length; f += 1) {
            fields[f].addEventListener("input", syncState);
            fields[f].addEventListener("change", syncState);
        }
    },

    /**
     * Catálogo B (serviços) — NÃO misturar com catálogo A (materiais/SAP).
     */
    listAdminServiceCatalogItems: function () {
        var items = [];
        try {
            if (domain().listContractServices) {
                items = domain().listContractServices() || [];
            } else if (global.AURORA_ELETRICA_TUPY_SERVICES && Array.isArray(global.AURORA_ELETRICA_TUPY_SERVICES.items)) {
                items = global.AURORA_ELETRICA_TUPY_SERVICES.items.slice();
            }
        } catch (error) {
            items = [];
        }
        return Array.isArray(items) ? items : [];
    },

    /** Códigos por tipo de dia da família — SEM seleção automática pela data. */
    listAdminServiceDayCodeOptions: function (catalogRow) {
        if (!catalogRow) return [];
        return [
            {
                day_type: "weekday",
                day_label: "Dias úteis",
                service_code: String(catalogRow.codigo_dia_semana || "").trim()
            },
            {
                day_type: "saturday",
                day_label: "Sábado",
                service_code: String(catalogRow.codigo_sabado || "").trim()
            },
            {
                day_type: "sunday",
                day_label: "Domingo",
                service_code: String(catalogRow.codigo_domingo || "").trim()
            }
        ].filter(function (opt) {
            return Boolean(opt.service_code);
        });
    },

    adminServiceAssocKey: function (assoc) {
        return [
            String(assoc && assoc.activity_id || ""),
            String(assoc && assoc.service_item != null ? assoc.service_item : ""),
            String(assoc && assoc.service_code || "")
        ].join("|");
    },

    renderAdminServiceCodesSectionHtml: function (model) {
        var acts = model && Array.isArray(model.activities) ? model.activities : [];
        if (!acts.length) {
            return '<p class="aet-hint">Nenhuma atividade de campo para classificar neste atendimento.</p>';
        }
        var self = this;
        return acts.map(function (act) {
            return '<article class="aet-admin-code-card" data-aet-admin-code-card="' + esc(act.id) + '">' +
                '<div class="aet-admin-code-card__field">' +
                "<h4>Atividade de campo (original)</h4>" +
                "<strong>" + esc(act.label) + "</strong>" +
                self.adminDetailKvHtml("Descrição de campo", act.descricao) +
                self.adminDetailKvHtml("Quantidade", act.quantidade) +
                self.adminDetailKvHtml("Data de início", act.data) +
                "</div>" +
                '<div class="aet-admin-code-card__admin">' +
                "<h4>Códigos administrativos</h4>" +
                '<div class="aet-admin-code-list" data-aet-admin-code-list="' + esc(act.id) + '">' +
                '<p class="aet-hint">Nenhum código associado.</p>' +
                "</div>" +
                '<button type="button" class="aet-admin-add-code" data-aet-admin-add-code="' +
                esc(act.id) + '">+ Adicionar código de serviço</button>' +
                '<p class="aet-hint aet-admin-code-msg" data-aet-admin-code-msg="' + esc(act.id) + '" hidden></p>' +
                "</div>" +
                "</article>";
        }).join("");
    },

    getAdminServiceAssociations: function (activityId) {
        var state = this._adminServiceCodeState || {};
        var list = state[activityId];
        return Array.isArray(list) ? list : [];
    },

    setAdminServiceAssociations: function (activityId, list) {
        if (!this._adminServiceCodeState) this._adminServiceCodeState = {};
        this._adminServiceCodeState[activityId] = Array.isArray(list) ? list : [];
    },

    renderAdminServiceAssociationList: function (overlay, activityId) {
        if (!overlay) return;
        var host = overlay.querySelector('[data-aet-admin-code-list="' + activityId + '"]');
        if (!host) return;
        var list = this.getAdminServiceAssociations(activityId);
        host.textContent = "";
        if (!list.length) {
            var empty = document.createElement("p");
            empty.className = "aet-hint";
            empty.textContent = "Nenhum código associado.";
            host.appendChild(empty);
            return;
        }

        var groups = [];
        var indexByFamily = {};
        list.forEach(function (assoc) {
            var famKey = String(assoc.service_item != null ? assoc.service_item : "") +
                "|" + String(assoc.service_description || "");
            if (indexByFamily[famKey] == null) {
                indexByFamily[famKey] = groups.length;
                groups.push({
                    service_item: assoc.service_item,
                    service_description: assoc.service_description,
                    service_unit: assoc.service_unit,
                    items: []
                });
            }
            groups[indexByFamily[famKey]].items.push(assoc);
        });

        var self = this;
        groups.forEach(function (group) {
            var family = document.createElement("div");
            family.className = "aet-admin-code-family";

            var title = document.createElement("strong");
            title.className = "aet-admin-code-family__title";
            title.textContent = String(group.service_description || "Serviço");
            family.appendChild(title);

            if (group.service_unit) {
                var unit = document.createElement("small");
                unit.className = "aet-admin-code-family__unit";
                unit.textContent = "Unidade: " + String(group.service_unit);
                family.appendChild(unit);
            }

            group.items.forEach(function (assoc) {
                var row = document.createElement("div");
                row.className = "aet-admin-code-assoc";
                row.setAttribute("data-aet-admin-assoc-key", self.adminServiceAssocKey(assoc));

                var codeEl = document.createElement("strong");
                codeEl.className = "aet-admin-code-assoc__code";
                codeEl.textContent = String(assoc.service_code || "");
                row.appendChild(codeEl);

                var dayEl = document.createElement("span");
                dayEl.className = "aet-admin-code-assoc__day";
                dayEl.textContent = String(assoc.day_label || assoc.day_type || "");
                row.appendChild(dayEl);

                var qtyEl = document.createElement("span");
                qtyEl.className = "aet-admin-code-assoc__qty";
                qtyEl.textContent = "Quantidade: " +
                    String(assoc.quantity != null ? assoc.quantity : "") +
                    (assoc.service_unit ? " " + String(assoc.service_unit) : "");
                row.appendChild(qtyEl);

                var removeBtn = document.createElement("button");
                removeBtn.type = "button";
                removeBtn.className = "aet-admin-code-remove";
                removeBtn.textContent = "Remover";
                removeBtn.addEventListener("click", function (ev) {
                    ev.preventDefault();
                    self.removeAdminServiceAssociation(overlay, activityId, assoc);
                });
                row.appendChild(removeBtn);
                family.appendChild(row);
            });

            host.appendChild(family);
        });
    },

    showAdminServiceCodeMessage: function (overlay, activityId, message) {
        if (!overlay) return;
        var el = overlay.querySelector('[data-aet-admin-code-msg="' + activityId + '"]');
        if (!el) return;
        if (!message) {
            el.hidden = true;
            el.textContent = "";
            return;
        }
        el.hidden = false;
        el.textContent = String(message);
    },

    removeAdminServiceAssociation: function (overlay, activityId, assoc) {
        var key = this.adminServiceAssocKey(assoc);
        var list = this.getAdminServiceAssociations(activityId).filter(function (item) {
            return this.adminServiceAssocKey(item) !== key;
        }, this);
        this.setAdminServiceAssociations(activityId, list);
        this.renderAdminServiceAssociationList(overlay, activityId);
        this.showAdminServiceCodeMessage(overlay, activityId, "");
    },

    addAdminServiceAssociationsBatch: function (overlay, activity, catalogRow, selectedRows) {
        var activityId = activity && activity.id ? String(activity.id) : "";
        if (!activityId || !catalogRow || !selectedRows || !selectedRows.length) return { ok: false, added: 0, skipped: 0 };

        var list = this.getAdminServiceAssociations(activityId).slice();
        var added = 0;
        var skipped = 0;
        var self = this;

        selectedRows.forEach(function (sel) {
            var assoc = {
                activity_id: activityId,
                service_item: catalogRow.item != null ? catalogRow.item : null,
                service_description: String(catalogRow.descricao_servico || ""),
                service_unit: String(catalogRow.unidade || ""),
                day_type: String(sel.day_type || ""),
                day_label: String(sel.day_label || ""),
                service_code: String(sel.service_code || ""),
                quantity: sel.quantity
            };
            if (!assoc.service_code) {
                skipped += 1;
                return;
            }
            var key = self.adminServiceAssocKey(assoc);
            var exists = list.some(function (item) {
                return self.adminServiceAssocKey(item) === key;
            });
            if (exists) {
                skipped += 1;
                return;
            }
            list.push(assoc);
            added += 1;
        });

        this.setAdminServiceAssociations(activityId, list);
        this.renderAdminServiceAssociationList(overlay, activityId);

        if (added === 0 && skipped > 0) {
            this.showAdminServiceCodeMessage(
                overlay,
                activityId,
                "Este código já está associado a esta atividade."
            );
            return { ok: false, added: added, skipped: skipped };
        }
        this.showAdminServiceCodeMessage(overlay, activityId, "");
        return { ok: added > 0, added: added, skipped: skipped };
    },

    closeAdminServiceCodePicker: function () {
        var picker = document.getElementById("aet-admin-service-picker");
        if (picker && picker.parentNode) {
            picker.parentNode.removeChild(picker);
        }
    },

    openAdminServiceDaySelectionStep: function (overlay, activity, catalogRow, picker) {
        var self = this;
        var panel = picker.querySelector(".aet-admin-service-picker__panel");
        if (!panel) return;

        var options = this.listAdminServiceDayCodeOptions(catalogRow);
        var suggestedQty = activity && activity.quantidade != null && String(activity.quantidade).trim() !== ""
            ? String(activity.quantidade).trim()
            : "";

        panel.innerHTML =
            '<header class="aet-admin-service-picker__head">' +
            "<div><strong>Selecionar códigos da família</strong>" +
            '<p class="aet-hint">Atividade: ' + esc(activity.label || activity.id) + "</p></div>" +
            '<button type="button" class="aet-admin-service-picker__close" data-aet-picker-close>Fechar</button>' +
            "</header>" +
            '<div class="aet-admin-service-family-head">' +
            "<strong>" + esc(catalogRow.descricao_servico || "") + "</strong>" +
            (catalogRow.unidade
                ? '<p class="aet-hint">Unidade: ' + esc(String(catalogRow.unidade)) + "</p>"
                : "") +
            '<p class="aet-hint">Marque um ou mais tipos de dia. A data de início do campo não escolhe o código automaticamente.</p>' +
            "</div>" +
            '<div class="aet-admin-service-day-options" data-aet-day-options></div>' +
            '<p class="aet-hint aet-admin-picker-msg" data-aet-picker-msg hidden></p>' +
            '<div class="aet-admin-service-picker__actions">' +
            '<button type="button" class="aet-admin-picker-back" data-aet-picker-back>← Voltar</button>' +
            '<button type="button" class="aet-admin-add-codes-confirm" data-aet-picker-confirm>Adicionar códigos</button>' +
            "</div>";

        var closeBtn = panel.querySelector("[data-aet-picker-close]");
        if (closeBtn) {
            closeBtn.addEventListener("click", function () {
                self.closeAdminServiceCodePicker();
            });
        }
        var backBtn = panel.querySelector("[data-aet-picker-back]");
        if (backBtn) {
            backBtn.addEventListener("click", function () {
                self.openAdminServiceCodePicker(overlay, activity);
            });
        }

        var optionsHost = panel.querySelector("[data-aet-day-options]");
        if (optionsHost) {
            if (!options.length) {
                optionsHost.innerHTML = '<p class="aet-hint aet-hint--error">Esta família não possui códigos no catálogo.</p>';
            } else {
                options.forEach(function (opt) {
                    var row = document.createElement("label");
                    row.className = "aet-admin-service-day-option";
                    row.innerHTML =
                        '<div class="aet-admin-service-day-option__check">' +
                        '<input type="checkbox" data-aet-day-check data-day-type="' + esc(opt.day_type) + '" ' +
                        'data-day-label="' + esc(opt.day_label) + '" data-service-code="' + esc(opt.service_code) + '">' +
                        "<span>" + esc(opt.day_label) + "</span>" +
                        "</div>" +
                        '<div class="aet-admin-service-day-option__code">Código: <strong>' +
                        esc(opt.service_code) + "</strong></div>" +
                        '<div class="aet-admin-service-day-option__qty">' +
                        "<span>Quantidade</span>" +
                        '<input type="number" min="0" step="any" data-aet-day-qty value="' +
                        esc(suggestedQty) + '" ' +
                        'aria-label="Quantidade ' + esc(opt.day_label) + '">' +
                        (catalogRow.unidade
                            ? '<small>' + esc(String(catalogRow.unidade)) + "</small>"
                            : "") +
                        "</div>";
                    optionsHost.appendChild(row);
                });
            }
        }

        var msg = panel.querySelector("[data-aet-picker-msg]");
        var confirmBtn = panel.querySelector("[data-aet-picker-confirm]");
        if (confirmBtn) {
            confirmBtn.addEventListener("click", function () {
                var selected = [];
                var checks = panel.querySelectorAll("[data-aet-day-check]");
                for (var i = 0; i < checks.length; i += 1) {
                    var input = checks[i];
                    if (!input.checked) continue;
                    var wrap = input.closest(".aet-admin-service-day-option");
                    var qtyInput = wrap ? wrap.querySelector("[data-aet-day-qty]") : null;
                    var rawQty = qtyInput ? String(qtyInput.value || "").trim() : "";
                    var qtyNum = rawQty === "" ? null : Number(rawQty);
                    selected.push({
                        day_type: input.getAttribute("data-day-type") || "",
                        day_label: input.getAttribute("data-day-label") || "",
                        service_code: input.getAttribute("data-service-code") || "",
                        quantity: Number.isFinite(qtyNum) ? qtyNum : rawQty
                    });
                }
                if (!selected.length) {
                    if (msg) {
                        msg.hidden = false;
                        msg.textContent = "Selecione ao menos um tipo de dia.";
                    }
                    return;
                }
                var result = self.addAdminServiceAssociationsBatch(overlay, activity, catalogRow, selected);
                if (!result.ok) {
                    if (msg) {
                        msg.hidden = false;
                        msg.textContent = result.skipped
                            ? "Os códigos selecionados já estavam associados a esta atividade."
                            : "Não foi possível adicionar os códigos.";
                    }
                    return;
                }
                self.closeAdminServiceCodePicker();
            });
        }
    },

    openAdminServiceCodePicker: function (overlay, activity) {
        var self = this;
        this.closeAdminServiceCodePicker();
        if (!activity || !activity.id) return;

        var catalog = this.listAdminServiceCatalogItems();
        var picker = document.createElement("div");
        picker.id = "aet-admin-service-picker";
        picker.className = "aet-admin-service-picker";
        picker.setAttribute("role", "dialog");
        picker.setAttribute("aria-modal", "true");
        picker.innerHTML =
            '<div class="aet-admin-service-picker__panel">' +
            '<header class="aet-admin-service-picker__head">' +
            "<div><strong>Selecionar família de serviço</strong>" +
            '<p class="aet-hint">Atividade: ' + esc(activity.label || activity.id) + "</p>" +
            '<p class="aet-hint">Escolha o serviço. Depois você selecionará Dias úteis / Sábado / Domingo.</p></div>' +
            '<button type="button" class="aet-admin-service-picker__close" data-aet-picker-close>Fechar</button>' +
            "</header>" +
            '<label class="aet-admin-service-picker__search"><span>Pesquisar código ou descrição</span>' +
            '<input type="search" data-aet-picker-query placeholder="Ex.: ventilador ou 50012384" autocomplete="off">' +
            "</label>" +
            '<div class="aet-admin-service-picker__results" data-aet-picker-results></div>' +
            "</div>";

        document.body.appendChild(picker);

        var closeBtn = picker.querySelector("[data-aet-picker-close]");
        if (closeBtn) {
            closeBtn.addEventListener("click", function () {
                self.closeAdminServiceCodePicker();
            });
        }
        picker.addEventListener("click", function (ev) {
            if (ev.target === picker) self.closeAdminServiceCodePicker();
        });

        var resultsHost = picker.querySelector("[data-aet-picker-results]");
        var queryInput = picker.querySelector("[data-aet-picker-query]");

        function renderResults(query) {
            if (!resultsHost) return;
            resultsHost.textContent = "";
            var q = String(query || "").trim().toLowerCase();
            var matched = catalog.filter(function (row) {
                if (!row) return false;
                if (!q) return true;
                var blob = [
                    row.descricao_servico,
                    row.codigo_dia_semana,
                    row.codigo_sabado,
                    row.codigo_domingo,
                    row.unidade,
                    row.item
                ].join(" ").toLowerCase();
                return blob.indexOf(q) !== -1;
            });
            if (!matched.length) {
                var empty = document.createElement("p");
                empty.className = "aet-hint";
                empty.textContent = "Nenhum item encontrado no catálogo de serviços.";
                resultsHost.appendChild(empty);
                return;
            }
            matched.forEach(function (row) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "aet-admin-service-picker__item";
                btn.innerHTML =
                    '<span class="aet-admin-service-picker__desc">' + esc(row.descricao_servico || "") + "</span>" +
                    (row.unidade
                        ? '<small>Unidade: ' + esc(String(row.unidade)) + "</small>"
                        : "") +
                    '<small class="aet-admin-service-picker__days">Dias úteis: ' +
                    esc(String(row.codigo_dia_semana || "—")) +
                    " · Sábado: " + esc(String(row.codigo_sabado || "—")) +
                    " · Domingo: " + esc(String(row.codigo_domingo || "—")) +
                    "</small>";
                btn.addEventListener("click", function () {
                    self.openAdminServiceDaySelectionStep(overlay, activity, row, picker);
                });
                resultsHost.appendChild(btn);
            });
        }

        if (queryInput) {
            queryInput.addEventListener("input", function () {
                renderResults(queryInput.value);
            });
            setTimeout(function () {
                try { queryInput.focus(); } catch (e) { /* ignore */ }
            }, 0);
        }
        renderResults("");
    },

    collectAdminServiceAssociationsFlat: function () {
        var state = this._adminServiceCodeState || {};
        var flat = [];
        Object.keys(state).forEach(function (activityId) {
            var list = state[activityId] || [];
            list.forEach(function (assoc) {
                flat.push(Object.assign({}, assoc, {
                    activity_id: assoc.activity_id || activityId
                }));
            });
        });
        return flat;
    },

    applyLoadedAdminServiceAssociations: function (overlay, model, associations) {
        var acts = model && Array.isArray(model.activities) ? model.activities : [];
        var byActivity = {};
        acts.forEach(function (act) {
            if (act && act.id) byActivity[act.id] = [];
        });
        (associations || []).forEach(function (assoc) {
            if (!assoc || !assoc.activity_id) return;
            if (!byActivity[assoc.activity_id]) byActivity[assoc.activity_id] = [];
            byActivity[assoc.activity_id].push(assoc);
        });
        var self = this;
        Object.keys(byActivity).forEach(function (activityId) {
            self.setAdminServiceAssociations(activityId, byActivity[activityId]);
            self.renderAdminServiceAssociationList(overlay, activityId);
        });
    },

    setAdminSaveStatus: function (overlay, message, isError) {
        if (!overlay) return;
        var el = overlay.querySelector("[data-aet-admin-save-status]");
        if (!el) return;
        el.textContent = message || "";
        if (isError) el.classList.add("aet-hint--error");
        else el.classList.remove("aet-hint--error");
    },

    saveAdminServiceCodesToCloud: async function (overlay, projectId) {
        var api = global.AuroraAdminServiceCodesCloud;
        var cloud = global.AuroraCloudSync;
        var client = cloud && cloud.client ? cloud.client : null;
        if (!api || typeof api.replaceProjectAdminServiceCodes !== "function") {
            throw new Error("AURORA_ADMIN_CODES_MODULE_MISSING");
        }
        var flat = this.collectAdminServiceAssociationsFlat();
        return api.replaceProjectAdminServiceCodes(client, projectId, flat);
    },

    loadAdminServiceCodesFromCloud: async function (overlay, model) {
        /* USER -> ADMIN: o full_case sincronizado é a fonte canônica da Etapa 5.
         * Se o usuário alterou códigos/quantidades e finalizou, esses valores já estão
         * em eletrica_tupy.service_codes no projeto cloud. O ADMIN deve revisar exatamente
         * esse estado atualizado; a tabela administrativa separada fica apenas como fallback
         * para projetos históricos que ainda não possuem service_codes no full_case.
         * Não altera renderer, layout, permissões ou finalização ADMIN. */
        var canonicalState = tupyOf(caseData());
        var canonicalRows = Array.isArray(canonicalState.service_codes)
            ? canonicalState.service_codes.slice()
            : [];
        if (canonicalRows.length) {
            this.applyLoadedAdminServiceAssociations(overlay, model, canonicalRows);
            return;
        }

        var api = global.AuroraAdminServiceCodesCloud;
        var cloud = global.AuroraCloudSync;
        var client = cloud && cloud.client ? cloud.client : null;
        if (!api || typeof api.listProjectAdminServiceCodes !== "function") {
            this.applyLoadedAdminServiceAssociations(overlay, model, []);
            return;
        }
        var rows = await api.listProjectAdminServiceCodes(client, model.project_id);
        this.applyLoadedAdminServiceAssociations(overlay, model, Array.isArray(rows) ? rows : []);
    },

    bindAdminServiceCodesUi: function (overlay, model) {
        if (!overlay || !model) return;
        var self = this;
        this._adminServiceCodeState = {};
        var acts = Array.isArray(model.activities) ? model.activities : [];
        var byId = {};
        acts.forEach(function (act) {
            if (act && act.id) byId[act.id] = act;
            self.setAdminServiceAssociations(act.id, []);
            self.renderAdminServiceAssociationList(overlay, act.id);
        });

        var addButtons = overlay.querySelectorAll("[data-aet-admin-add-code]");
        for (var i = 0; i < addButtons.length; i += 1) {
            (function (btn) {
                btn.addEventListener("click", function (ev) {
                    ev.preventDefault();
                    var aid = btn.getAttribute("data-aet-admin-add-code") || "";
                    var activity = byId[aid];
                    if (!activity) return;
                    self.showAdminServiceCodeMessage(overlay, aid, "");
                    self.openAdminServiceCodePicker(overlay, activity);
                });
            })(addButtons[i]);
        }

        var saveBtn = overlay.querySelector("[data-aet-admin-save-codes]");
        if (saveBtn) {
            saveBtn.addEventListener("click", function (ev) {
                ev.preventDefault();
                self.setAdminSaveStatus(overlay, "Salvando…", false);
                saveBtn.disabled = true;
                self.saveAdminServiceCodesToCloud(overlay, model.project_id)
                    .then(function () {
                        self.setAdminSaveStatus(overlay, "Tratamento administrativo salvo.", false);
                    })
                    .catch(function (error) {
                        console.error("[ADMIN CODES SAVE]", error);
                        var msg = error && error.message ? String(error.message) : String(error);
                        if (/function|does not exist|PGRST|404/i.test(msg)) {
                            msg = "Persistência ainda não disponível no banco (execute migration 17).";
                        } else if (/42501|FORBIDDEN|WRITE_FORBIDDEN/i.test(msg)) {
                            msg = "Sem permissão para salvar tratamento administrativo.";
                        }
                        self.setAdminSaveStatus(overlay, msg, true);
                    })
                    .finally(function () {
                        saveBtn.disabled = false;
                    });
            });
        }
    },

    closeAdminDetailPanel: function () {
        this.closeAdminServiceCodePicker();
        this._adminServiceCodeState = null;
        this._adminReportReviewState = null;
        var reader = global.AuroraEvidenceCloudReader;
        if (this._adminDetailEvidenceSession && reader && typeof reader.release === "function") {
            reader.release(this._adminDetailEvidenceSession);
        }
        this._adminDetailEvidenceSession = null;
        var overlay = document.getElementById("aet-admin-detail-overlay");
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    },

    appendAdminEvidenceThumb: function (host, item) {
        if (!host || !item) return;
        var objectUrl = item.object_url || item.url || "";
        if (!objectUrl) return;
        var figure = document.createElement("figure");
        figure.className = "aet-admin-thumb";
        var img = document.createElement("img");
        img.alt = "Evidência de campo";
        img.loading = "lazy";
        img.decoding = "async";
        img.src = objectUrl;
        figure.appendChild(img);
        host.appendChild(figure);
    },

    fillAdminDetailEvidence: function (overlay, model, session) {
        if (!overlay) return;
        var items = session && Array.isArray(session.items) ? session.items : [];
        var byGroup = {};
        var orphans = [];
        var knownGroups = {};
        (model.records || []).forEach(function (rec) {
            if (rec.group_id) knownGroups[rec.group_id] = true;
        });

        items.forEach(function (item) {
            var gid = item && item.group_id ? String(item.group_id) : "";
            if (gid && knownGroups[gid]) {
                if (!byGroup[gid]) byGroup[gid] = [];
                byGroup[gid].push(item);
            } else {
                orphans.push(item);
            }
        });

        (model.records || []).forEach(function (rec) {
            var host = overlay.querySelector('[data-aet-admin-group-photos="' + rec.group_id + '"]');
            if (!host) return;
            host.textContent = "";
            var list = byGroup[rec.group_id] || [];
            if (!list.length) {
                var empty = document.createElement("p");
                empty.className = "aet-hint";
                empty.textContent = "Nenhuma evidência cloud associada a este registro.";
                host.appendChild(empty);
                return;
            }
            var wrap = document.createElement("div");
            wrap.className = "aet-admin-thumbs";
            list.forEach(function (item) {
                this.appendAdminEvidenceThumb(wrap, item);
            }, this);
            host.appendChild(wrap);
        }, this);

        var orphanHost = overlay.querySelector("[data-aet-admin-orphan-photos]");
        if (orphanHost) {
            if (!orphans.length) {
                orphanHost.hidden = true;
                orphanHost.textContent = "";
                return;
            }
            orphanHost.hidden = false;
            orphanHost.textContent = "";
            var title = document.createElement("h4");
            title.textContent = model.records.length
                ? "Evidências sem associação de group_id"
                : "Evidências do atendimento";
            orphanHost.appendChild(title);
            var note = document.createElement("p");
            note.className = "aet-hint";
            note.textContent = model.records.length
                ? "Fotos cloud cujo group_id não bate com evidence_groups do payload."
                : "Payload sem evidence_groups; fotos listadas pelo project_id via STORAGE-C.";
            orphanHost.appendChild(note);
            var wrap = document.createElement("div");
            wrap.className = "aet-admin-thumbs";
            orphans.forEach(function (item) {
                this.appendAdminEvidenceThumb(wrap, item);
            }, this);
            orphanHost.appendChild(wrap);
        }
    },

    openAdminDetailPanel: async function (projectId) {
        if (!this.canOpenGestao()) return;
        var pid = String(projectId || "").trim();
        if (!pid) return;

        var row = null;
        var cache = this._gestaoCompanyRowsById || {};
        if (cache[pid]) row = cache[pid];
        if (!row) {
            throw new Error("AURORA_ADMIN_DETAIL_PROJECT_NOT_IN_LIST");
        }

        this.closeEvidenceCloudTestPanel();
        this.closeAdminDetailPanel();

        var model = this.buildAdminDetailModel(row);
        var overlay = document.createElement("div");
        overlay.id = "aet-admin-detail-overlay";
        overlay.className = "aet-admin-detail-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.innerHTML =
            '<div class="aet-admin-detail-panel">' +
            this.renderAdminDetailHtml(model) +
            "</div>";
        document.body.appendChild(overlay);

        var self = this;
        this.bindAdminReportReviewUi(overlay, model);
        this.bindAdminServiceCodesUi(overlay, model);
        this.loadAdminServiceCodesFromCloud(overlay, model).catch(function (error) {
            console.error("[ADMIN CODES LOAD]", error);
            self.setAdminSaveStatus(
                overlay,
                "Não foi possível carregar classificação salva (migration 17 necessária ou sem permissão).",
                true
            );
        });
        var closeBtn = overlay.querySelector("[data-aet-admin-close]");
        if (closeBtn) {
            closeBtn.addEventListener("click", function () {
                self.closeAdminDetailPanel();
            });
        }
        overlay.addEventListener("click", function (ev) {
            if (ev.target === overlay) self.closeAdminDetailPanel();
        });

        var reader = global.AuroraEvidenceCloudReader;
        var cloud = global.AuroraCloudSync;
        var client = cloud && cloud.client ? cloud.client : null;
        if (!reader || typeof reader.loadProjectEvidence !== "function" || !reader.isEnabled()) {
            this.fillAdminDetailEvidence(overlay, model, { items: [] });
            var hosts = overlay.querySelectorAll("[data-aet-admin-group-photos]");
            for (var i = 0; i < hosts.length; i += 1) {
                hosts[i].innerHTML = '<p class="aet-hint">Leitura de evidências cloud indisponível nesta sessão.</p>';
            }
            return;
        }

        try {
            var session = await reader.loadProjectEvidence(client, pid);
            this._adminDetailEvidenceSession = session;
            if (session.skipped) {
                var skippedHosts = overlay.querySelectorAll("[data-aet-admin-group-photos]");
                for (var s = 0; s < skippedHosts.length; s += 1) {
                    skippedHosts[s].innerHTML = '<p class="aet-hint">Leitura cloud desabilitada (' +
                        esc(session.reason || "flag_off") + ").</p>";
                }
                return;
            }
            this.fillAdminDetailEvidence(overlay, model, session);
        } catch (error) {
            console.error("[ADMIN DETAIL evidence]", error);
            var errHosts = overlay.querySelectorAll("[data-aet-admin-group-photos]");
            for (var e = 0; e < errHosts.length; e += 1) {
                errHosts[e].innerHTML = '<p class="aet-hint aet-hint--error">Falha ao carregar evidências.</p>';
            }
        }
    },

    bindAdminDetailOpen: function (host) {
        if (!host || !this.canOpenGestao()) return;
        var self = this;
        var buttons = host.querySelectorAll("[data-aet-admin-open]");
        for (var i = 0; i < buttons.length; i += 1) {
            (function (btn) {
                btn.addEventListener("click", function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var pid = btn.getAttribute("data-aet-admin-open") || "";
                    if (!pid) return;
                    self.openAdminFinalDocumentFromGestao(pid).catch(function (error) {
                        console.error("[ADMIN OPEN REPORT]", error);
                        window.alert(
                            "Não foi possível abrir o relatório.\n" +
                            String((error && error.message) || error || "")
                        );
                    });
                });
            })(buttons[i]);
        }
        this.bindAdminReviewOpen(host);
        this.bindGestaoDeleteOpen(host);
    },

    /**
     * Abrir relatório final a partir da Gestão (sem tela somente-leitura).
     * Entra temporariamente no working_case, gera HTML e restaura o case anterior.
     */
    openAdminFinalDocumentFromGestao: async function (projectId) {
        if (!this.canOpenGestao()) throw new Error("AURORA_ADMIN_OPEN_FORBIDDEN");
        var pid = String(projectId || "").trim();
        if (!pid) throw new Error("AURORA_ADMIN_OPEN_MISSING_PROJECT");
        var row = (this._gestaoCompanyRowsById || {})[pid];
        if (!row) throw new Error("AURORA_ADMIN_OPEN_PROJECT_NOT_IN_LIST");

        var runtime = global.auroraRuntime;
        if (!runtime || typeof runtime.resetCase !== "function") {
            throw new Error("AURORA_RUNTIME_UNAVAILABLE");
        }

        var previousCase = deepCloneJson(
            typeof runtime.getCase === "function" ? runtime.getCase() : {}
        );
        if (previousCase && previousCase.admin_review) {
            previousCase = (this._adminReviewContext && this._adminReviewContext.previous_user_case)
                ? deepCloneJson(this._adminReviewContext.previous_user_case)
                : {};
        }

        var workingCase = await this.resolveGestaoWorkingCase(row, pid);
        workingCase.admin_review = true;
        workingCase.restored_from_cloud = false;
        workingCase.admin_review_source = "gestao_cloud_row";
        workingCase.cloud_project_id = pid;
        workingCase.project_id = pid;
        this._adminReviewContext = {
            mode: "admin_document_preview",
            project_id: pid,
            company_id: row.company_id ? String(row.company_id) : null,
            project_row: row,
            original_case: deepCloneJson(workingCase),
            working_case: workingCase,
            previous_user_case: previousCase
        };
        runtime.resetCase(workingCase, { reason: "admin_document_preview" });
        try {
            /*
             * R27 — após F5/retorno pela Gestão, o case cloud contém apenas
             * referências leves. Recarrega o EvidenceFeature para o case que
             * acabou de ser ativado antes de o relatório consumir o EvidenceStore.
             * Não cria nova persistência nem duplica fotos.
             */
            var evidenceFeature = global.AuroraEvidenceFeature;
            if (evidenceFeature && typeof evidenceFeature.reload === "function") {
                await evidenceFeature.reload();
            }
            await this.openAdminDemoFinalReport(null);
        } finally {
            this.releaseAdminReviewEvidenceSession();
            this._adminReviewContext = null;
            if (previousCase && previousCase.admin_review) delete previousCase.admin_review;
            runtime.resetCase(previousCase && previousCase.id ? previousCase : (previousCase || {}), {
                reason: "admin_document_preview_exit"
            });
        }
    },

    bindServiceCatalogOpen: function (host) {
        if (!host || !this.canOpenGestao()) return;
        var self = this;
        var btn = host.querySelector("[data-aet-open-service-catalog]");
        if (!btn || btn.__aetBound) return;
        btn.__aetBound = true;
        btn.addEventListener("click", function () {
            self.openServiceCatalogOverlay(host);
        });
    },

    serviceCatalogClient: function () {
        var cloud = global.AuroraCloudSync;
        return cloud && cloud.client ? cloud.client : (global.AURORA_SUPABASE_CLIENT || null);
    },

    listServiceCatalogCloud: async function () {
        var client = this.serviceCatalogClient();
        if (!client || typeof client.rpc !== "function") throw new Error("AURORA_BACKEND_UNAVAILABLE");
        var result = await client.rpc("aurora_list_tupy_service_catalog", { p_include_inactive: true });
        if (result.error) throw result.error;
        return Array.isArray(result.data) ? result.data : [];
    },

    saveServiceCatalogCloud: async function (row) {
        var client = this.serviceCatalogClient();
        if (!client || typeof client.rpc !== "function") throw new Error("AURORA_BACKEND_UNAVAILABLE");
        var result = await client.rpc("aurora_admin_upsert_tupy_service_catalog", {
            p_id: row.id || null, p_item: row.item == null || row.item === "" ? null : Number(row.item),
            p_descricao_servico: String(row.descricao_servico || "").trim(), p_unidade: String(row.unidade || "").trim(),
            p_quantidade_minima: Number(row.quantidade_minima || 0), p_codigo_dia_semana: String(row.codigo_dia_semana || "").trim(),
            p_codigo_sabado: String(row.codigo_sabado || "").trim(), p_codigo_domingo: String(row.codigo_domingo || "").trim(),
            p_ativo: row.ativo !== false, p_ordem_exibicao: row.ordem_exibicao == null ? null : Number(row.ordem_exibicao)
        });
        if (result.error) throw result.error; return result.data;
    },

    setServiceCatalogActiveCloud: async function (id, active) {
        var client = this.serviceCatalogClient();
        var result = await client.rpc("aurora_admin_set_tupy_service_catalog_active", { p_id: id, p_ativo: !!active });
        if (result.error) throw result.error; return result.data;
    },

    openServiceCatalogOverlay: async function (host) {
        var overlay = (host && host.querySelector("[data-aet-catalog-overlay]")) || document.querySelector("[data-aet-catalog-overlay]");
        if (!overlay) return; var self=this; overlay.hidden=false;
        overlay.innerHTML='<div class="aet-catalog-panel" role="dialog" aria-modal="true"><header><div><h3>Catálogo de serviços</h3><p>Carregando catálogo oficial…</p></div><button type="button" class="aet-catalog-close" data-aet-service-close aria-label="Fechar">×</button></header></div>';
        function close(){overlay.hidden=true;overlay.innerHTML="";}
        var items=await this.listServiceCatalogCloud();
        overlay.innerHTML='<div class="aet-catalog-panel" role="dialog" aria-modal="true"><header><div><h3>Catálogo de serviços</h3><p><strong data-aet-service-count></strong> · Dias úteis / Sábado / Domingo</p></div><button type="button" class="aet-catalog-close" data-aet-service-close aria-label="Fechar">×</button></header><div class="aet-catalog-toolbar"><input class="aet-catalog-control aet-catalog-search" type="search" data-aet-service-search placeholder="Buscar descrição ou código…"><select class="aet-catalog-control" data-aet-service-status><option value="active">Ativos</option><option value="all">Todos</option><option value="inactive">Inativos</option></select><button type="button" class="aet-btn aet-btn--primary" data-aet-service-new>+ Novo serviço</button></div><div data-aet-service-form hidden></div><div class="aet-catalog-table-wrap"><table class="aet-catalog-table"><thead><tr><th>Item</th><th>Descrição</th><th>Un.</th><th>Dias úteis</th><th>Sábado</th><th>Domingo</th><th>Status</th><th></th></tr></thead><tbody data-aet-service-body></tbody></table></div></div>';
        var body=overlay.querySelector('[data-aet-service-body]'), search=overlay.querySelector('[data-aet-service-search]'), status=overlay.querySelector('[data-aet-service-status]'), count=overlay.querySelector('[data-aet-service-count]'), form=overlay.querySelector('[data-aet-service-form]');
        function render(){var q=String(search.value||'').toLowerCase(), st=status.value; var rows=items.filter(function(r){if(st==='active'&&r.ativo===false)return false;if(st==='inactive'&&r.ativo!==false)return false;return !q||String((r.descricao_servico||'')+' '+(r.codigo_dia_semana||'')+' '+(r.codigo_sabado||'')+' '+(r.codigo_domingo||'')).toLowerCase().indexOf(q)>=0;}); count.textContent=rows.length+' serviços'; body.innerHTML=rows.map(function(r){return '<tr><td data-label="Item">'+esc(r.item||'')+'</td><td data-label="Descrição">'+esc(r.descricao_servico||'')+'</td><td data-label="Unidade">'+esc(r.unidade||'')+'</td><td data-label="Dias úteis">'+esc(r.codigo_dia_semana||'')+'</td><td data-label="Sábado">'+esc(r.codigo_sabado||'')+'</td><td data-label="Domingo">'+esc(r.codigo_domingo||'')+'</td><td data-label="Status"><span class="aet-catalog-status '+(r.ativo===false?'is-inactive':'is-active')+'">'+(r.ativo===false?'Inativo':'Ativo')+'</span></td><td class="aet-catalog-actions" data-label="Ações"><button type="button" class="aet-catalog-icon-action aet-catalog-icon-action--edit" data-aet-service-edit="'+esc(r.id)+'" aria-label="Editar serviço" title="Editar">✎</button><button type="button" class="aet-catalog-icon-action aet-catalog-icon-action--delete" data-aet-service-active="'+esc(r.id)+'" aria-label="'+(r.ativo===false?'Reativar':'Desativar')+' serviço" title="'+(r.ativo===false?'Reativar':'Desativar')+'">'+(r.ativo===false?'↻':'♜')+'</button></td></tr>';}).join('')||'<tr class="aet-catalog-empty"><td colspan="8">Nenhum serviço encontrado.</td></tr>'; }
        function openForm(row){row=row||{};form.hidden=false;form.innerHTML='<article class="aet-card"><div class="aet-grid"><label class="aet-field"><span>Item</span><input data-sf="item" type="number" value="'+esc(row.item||'')+'"></label><label class="aet-field"><span>Descrição</span><input data-sf="descricao_servico" value="'+esc(row.descricao_servico||'')+'"></label><label class="aet-field"><span>Unidade</span><input data-sf="unidade" value="'+esc(row.unidade||'')+'"></label><label class="aet-field"><span>Dias úteis</span><input data-sf="codigo_dia_semana" value="'+esc(row.codigo_dia_semana||'')+'"></label><label class="aet-field"><span>Sábado</span><input data-sf="codigo_sabado" value="'+esc(row.codigo_sabado||'')+'"></label><label class="aet-field"><span>Domingo</span><input data-sf="codigo_domingo" value="'+esc(row.codigo_domingo||'')+'"></label></div><div class="aet-actions"><button type="button" class="aet-btn" data-aet-service-cancel>Cancelar</button><button type="button" class="aet-btn aet-btn--primary" data-aet-service-save>Salvar</button></div></article>'; form.querySelector('[data-aet-service-cancel]').onclick=function(){form.hidden=true;form.innerHTML='';}; form.querySelector('[data-aet-service-save]').onclick=async function(){var payload=Object.assign({},row); form.querySelectorAll('[data-sf]').forEach(function(el){payload[el.getAttribute('data-sf')]=el.value;}); await self.saveServiceCatalogCloud(payload); items=await self.listServiceCatalogCloud(); form.hidden=true;form.innerHTML='';render();};}
        overlay.querySelector('[data-aet-service-close]').onclick=close; overlay.onclick=function(ev){if(ev.target===overlay)close(); var eb=ev.target.closest('[data-aet-service-edit]'); if(eb){var r=items.find(function(x){return String(x.id)===eb.getAttribute('data-aet-service-edit');}); if(r)openForm(r);} var ab=ev.target.closest('[data-aet-service-active]'); if(ab){var r2=items.find(function(x){return String(x.id)===ab.getAttribute('data-aet-service-active');}); if(r2) self.setServiceCatalogActiveCloud(r2.id,r2.ativo===false).then(async function(){items=await self.listServiceCatalogCloud();render();});}}; search.oninput=render;status.onchange=render;overlay.querySelector('[data-aet-service-new]').onclick=function(){openForm(null);};render();
    },

    bindMaterialCatalogOpen: function (host) {
        if (!host || !this.canOpenGestao()) return;
        var self = this;
        var btn = host.querySelector("[data-aet-open-material-catalog]");
        if (!btn || btn.__aetBound) return;
        btn.__aetBound = true;
        btn.addEventListener("click", function () {
            self.openMaterialCatalogOverlay(host).catch(function (error) {
                console.error("[TUPY MATERIAL CATALOG]", error);
                window.alert("Não foi possível abrir os materiais Tupy.\n" + String((error && error.message) || error || ""));
            });
        });
    },

    materialCatalogClient: function () {
        var cloud = global.AuroraCloudSync;
        return cloud && cloud.client ? cloud.client : (global.AURORA_SUPABASE_CLIENT || null);
    },

    listMaterialCatalogCloud: async function () {
        var client = this.materialCatalogClient();
        if (!client || typeof client.rpc !== "function") throw new Error("AURORA_BACKEND_UNAVAILABLE");
        var result = await client.rpc("aurora_list_tupy_material_catalog", { p_include_inactive: true });
        if (result.error) throw result.error;
        return Array.isArray(result.data) ? result.data : [];
    },

    saveMaterialCatalogCloud: async function (payload) {
        var client = this.materialCatalogClient();
        if (!client || typeof client.rpc !== "function") throw new Error("AURORA_BACKEND_UNAVAILABLE");
        var result = await client.rpc("aurora_admin_upsert_tupy_material", {
            p_id: payload.id || null,
            p_codigo: String(payload.codigo || "").trim(),
            p_descricao: String(payload.descricao || "").trim(),
            p_tipo: String(payload.tipo || "").trim(),
            p_ativo: payload.ativo !== false
        });
        if (result.error) throw result.error;
        return result.data;
    },

    setMaterialCatalogActiveCloud: async function (id, active) {
        var client = this.materialCatalogClient();
        if (!client || typeof client.rpc !== "function") throw new Error("AURORA_BACKEND_UNAVAILABLE");
        var result = await client.rpc("aurora_admin_set_tupy_material_active", { p_id: id, p_ativo: !!active });
        if (result.error) throw result.error;
        return result.data;
    },

    openMaterialCatalogOverlay: async function (host) {
        var overlay = (host && host.querySelector("[data-aet-catalog-overlay]")) || document.querySelector("[data-aet-catalog-overlay]");
        if (!overlay) return;
        var self = this;
        overlay.hidden = false;
        overlay.innerHTML = '<div class="aet-catalog-panel" role="dialog" aria-modal="true">' +
            '<header><div><h3>Materiais Tupy</h3><p>Carregando catálogo oficial…</p></div>' +
            '<button type="button" class="aet-catalog-close" data-aet-material-close aria-label="Fechar">×</button></header></div>';

        function closeOverlay() { overlay.hidden = true; overlay.innerHTML = ""; }
        var initialClose = overlay.querySelector("[data-aet-material-close]");
        if (initialClose) initialClose.addEventListener("click", closeOverlay);

        var items = await this.listMaterialCatalogCloud();
        var types = [];
        items.forEach(function (row) {
            var t = String(row.tipo || "").trim();
            if (t && types.indexOf(t) < 0) types.push(t);
        });
        types.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });

        overlay.innerHTML = '<div class="aet-catalog-panel" role="dialog" aria-modal="true">' +
            '<header><div><h3>Materiais Tupy</h3><p><strong data-aet-material-count></strong> · catálogo oficial Bolt</p></div>' +
            '<button type="button" class="aet-catalog-close" data-aet-material-close aria-label="Fechar">×</button></header>' +
            '<div class="aet-catalog-toolbar">' +
            '<input class="aet-catalog-control aet-catalog-search" type="search" data-aet-material-search placeholder="Buscar SAP ou descrição…" autocomplete="off">' +
            '<select class="aet-catalog-control" data-aet-material-type><option value="">Todos os tipos</option>' + types.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join("") + '</select>' +
            '<select class="aet-catalog-control" data-aet-material-status><option value="active">Ativos</option><option value="all">Todos</option><option value="inactive">Inativos</option></select>' +
            '<button type="button" class="aet-btn aet-btn--primary" data-aet-material-new>+ Adicionar material</button>' +
            '</div>' +
            '<div data-aet-material-form hidden></div>' +
            '<div class="aet-catalog-table-wrap"><table class="aet-catalog-table">' +
            '<thead><tr><th>SAP</th><th>Descrição</th><th>Tipo</th><th>Status</th><th></th></tr></thead>' +
            '<tbody data-aet-material-body></tbody></table></div></div>';

        var body = overlay.querySelector("[data-aet-material-body]");
        var search = overlay.querySelector("[data-aet-material-search]");
        var typeFilter = overlay.querySelector("[data-aet-material-type]");
        var statusFilter = overlay.querySelector("[data-aet-material-status]");
        var count = overlay.querySelector("[data-aet-material-count]");
        var formHost = overlay.querySelector("[data-aet-material-form]");

        function renderRows() {
            var q = String(search && search.value || "").trim().toLocaleLowerCase("pt-BR");
            var tf = String(typeFilter && typeFilter.value || "");
            var sf = String(statusFilter && statusFilter.value || "active");
            var filtered = items.filter(function (row) {
                if (tf && String(row.tipo || "") !== tf) return false;
                if (sf === "active" && row.ativo === false) return false;
                if (sf === "inactive" && row.ativo !== false) return false;
                if (q) {
                    var hay = (String(row.codigo || "") + " " + String(row.descricao || "")).toLocaleLowerCase("pt-BR");
                    if (hay.indexOf(q) < 0) return false;
                }
                return true;
            });
            if (count) count.textContent = filtered.length + (filtered.length === 1 ? " material" : " materiais");
            body.innerHTML = filtered.map(function (row) {
                return '<tr>' +
                    '<td data-label="SAP"><strong>' + esc(row.codigo || "") + '</strong></td>' +
                    '<td data-label="Descrição">' + esc(row.descricao || "") + '</td>' +
                    '<td data-label="Tipo">' + esc(row.tipo || "") + '</td>' +
                    '<td data-label="Status"><span class="aet-catalog-status ' + (row.ativo === false ? "is-inactive" : "is-active") + '">' + (row.ativo === false ? "Inativo" : "Ativo") + '</span></td>' +
                    '<td class="aet-catalog-actions" data-label="Ações"><button type="button" class="aet-catalog-icon-action aet-catalog-icon-action--edit" data-aet-material-edit="' + esc(row.id || "") + '" aria-label="Editar material" title="Editar">✎</button>' +
                    '<button type="button" class="aet-catalog-icon-action aet-catalog-icon-action--delete" data-aet-material-toggle="' + esc(row.id || "") + '" data-next-active="' + (row.ativo === false ? "true" : "false") + '" aria-label="' + (row.ativo === false ? "Reativar" : "Desativar") + ' material" title="' + (row.ativo === false ? "Reativar" : "Desativar") + '">' + (row.ativo === false ? "↻" : "♜") + '</button></td></tr>';
            }).join("") || '<tr><td colspan="5">Nenhum material encontrado.</td></tr>';
            bindRowActions();
        }

        function openForm(row) {
            row = row || {};
            formHost.hidden = false;
            formHost.innerHTML = '<div class="aet-card">' +
                '<strong>' + (row.id ? "Editar material" : "Adicionar material") + '</strong>' +
                '<div class="aet-catalog-toolbar">' +
                '<input class="aet-catalog-control" type="text" data-aet-material-form-code placeholder="Código SAP" value="' + esc(row.codigo || "") + '">' +
                '<input class="aet-catalog-control aet-catalog-search" type="text" data-aet-material-form-desc placeholder="Descrição" value="' + esc(row.descricao || "") + '">' +
                '<input class="aet-catalog-control" type="text" data-aet-material-form-type placeholder="Tipo" value="' + esc(row.tipo || "") + '">' +
                '<button type="button" class="aet-btn aet-btn--primary" data-aet-material-save>Salvar</button>' +
                '<button type="button" class="aet-catalog-secondary" data-aet-material-cancel>Cancelar</button></div>' +
                '<p class="aet-hint" data-aet-material-form-status></p></div>';
            var cancel = formHost.querySelector("[data-aet-material-cancel]");
            if (cancel) cancel.addEventListener("click", function () { formHost.hidden = true; formHost.innerHTML = ""; });
            var save = formHost.querySelector("[data-aet-material-save]");
            if (save) save.addEventListener("click", async function () {
                var code = formHost.querySelector("[data-aet-material-form-code]");
                var desc = formHost.querySelector("[data-aet-material-form-desc]");
                var typ = formHost.querySelector("[data-aet-material-form-type]");
                var status = formHost.querySelector("[data-aet-material-form-status]");
                var payload = { id: row.id || null, codigo: code && code.value, descricao: desc && desc.value, tipo: typ && typ.value, ativo: row.ativo !== false };
                if (!String(payload.codigo || "").trim() || !String(payload.descricao || "").trim() || !String(payload.tipo || "").trim()) {
                    if (status) status.textContent = "Preencha código SAP, descrição e tipo.";
                    return;
                }
                save.disabled = true;
                if (status) status.textContent = "Salvando…";
                try {
                    await self.saveMaterialCatalogCloud(payload);
                    items = await self.listMaterialCatalogCloud();
                    formHost.hidden = true; formHost.innerHTML = "";
                    renderRows();
                } catch (error) {
                    if (status) status.textContent = "Erro ao salvar: " + String((error && error.message) || error || "");
                    save.disabled = false;
                }
            });
        }

        function bindRowActions() {
            var edits = body.querySelectorAll("[data-aet-material-edit]");
            for (var i = 0; i < edits.length; i += 1) edits[i].addEventListener("click", function () {
                var id = this.getAttribute("data-aet-material-edit");
                var row = items.find(function (it) { return String(it.id) === String(id); });
                if (row) openForm(row);
            });
            var toggles = body.querySelectorAll("[data-aet-material-toggle]");
            for (var j = 0; j < toggles.length; j += 1) toggles[j].addEventListener("click", async function () {
                var btn = this;
                var id = btn.getAttribute("data-aet-material-toggle");
                var next = btn.getAttribute("data-next-active") === "true";
                var action = next ? "reativar" : "desativar";
                if (!window.confirm("Deseja " + action + " este material?")) return;
                btn.disabled = true;
                try {
                    await self.setMaterialCatalogActiveCloud(id, next);
                    items = await self.listMaterialCatalogCloud();
                    renderRows();
                } catch (error) {
                    btn.disabled = false;
                    window.alert("Não foi possível " + action + " o material.\n" + String((error && error.message) || error || ""));
                }
            });
        }

        var close = overlay.querySelector("[data-aet-material-close]");
        if (close) close.addEventListener("click", closeOverlay);
        overlay.addEventListener("click", function (ev) { if (ev.target === overlay) closeOverlay(); });
        if (search) search.addEventListener("input", renderRows);
        if (typeFilter) typeFilter.addEventListener("change", renderRows);
        if (statusFilter) statusFilter.addEventListener("change", renderRows);
        var add = overlay.querySelector("[data-aet-material-new]");
        if (add) add.addEventListener("click", function () { openForm(null); });
        renderRows();
    },

    bindAdminReviewOpen: function (host) {
        if (!host || !this.canOpenGestao()) return;
        var self = this;
        var buttons = host.querySelectorAll("[data-aet-admin-review]");
        for (var i = 0; i < buttons.length; i += 1) {
            (function (btn) {
                btn.addEventListener("click", function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var pid = btn.getAttribute("data-aet-admin-review") || "";
                    if (!pid) return;
                    self.startAdminReview(pid).catch(function (error) {
                        console.error("[ADMIN REVIEW]", error);
                        window.alert(
                            "Não foi possível iniciar a revisão administrativa.\n" +
                            String((error && error.message) || error || "")
                        );
                    });
                });
            })(buttons[i]);
        }
    },

    bindGestaoBulkDelete: function (host) {
        if (!host || !this.canOpenGestao() || host.__aetBulkDeleteBound) return;
        host.__aetBulkDeleteBound = true;
        var self = this;
        function sync() {
            var checks = Array.prototype.slice.call(host.querySelectorAll("[data-aet-gestao-select]"));
            var selected = checks.filter(function (el) { return el.checked; });
            var all = host.querySelector("[data-aet-gestao-select-page]");
            var remove = host.querySelector("[data-aet-gestao-delete-selected]");
            if (all) {
                all.checked = checks.length > 0 && selected.length === checks.length;
                all.indeterminate = selected.length > 0 && selected.length < checks.length;
            }
            if (remove) {
                remove.disabled = selected.length === 0;
                remove.textContent = selected.length ? "Excluir selecionados (" + selected.length + ")" : "Excluir selecionados";
            }
        }
        host.addEventListener("change", function (ev) {
            if (ev.target.matches("[data-aet-gestao-select-page]")) {
                host.querySelectorAll("[data-aet-gestao-select]").forEach(function (el) { el.checked = ev.target.checked; });
            }
            if (ev.target.matches("[data-aet-gestao-select-page], [data-aet-gestao-select]")) sync();
        });
        host.addEventListener("click", async function (ev) {
            var mode = ev.target.closest("[data-aet-gestao-select-mode]");
            if (mode) {
                ev.preventDefault();
                var bulk = host.querySelector("[data-aet-gestao-bulk]");
                var wraps = host.querySelectorAll("[data-aet-gestao-select-wrap]");
                var active = mode.getAttribute("aria-pressed") === "true";
                mode.setAttribute("aria-pressed", active ? "false" : "true");
                mode.textContent = active ? "Selecionar vários" : "Cancelar seleção";
                if (bulk) bulk.hidden = active;
                wraps.forEach(function (el) { el.hidden = active; });
                if (active) {
                    host.querySelectorAll("[data-aet-gestao-select], [data-aet-gestao-select-page]").forEach(function(el){ el.checked=false; });
                    sync();
                }
                return;
            }
            var btn = ev.target.closest("[data-aet-gestao-delete-selected]");
            if (!btn) return;
            ev.preventDefault();
            var ids = Array.prototype.slice.call(host.querySelectorAll("[data-aet-gestao-select]:checked")).map(function (el) { return el.value; }).filter(Boolean);
            if (!ids.length) return;
            var dialog = global.AuroraDialog;
            var ok = dialog && typeof dialog.confirm === "function"
                ? await dialog.confirm("Excluir definitivamente " + ids.length + " atividade(s) selecionada(s)?", { title: "Excluir atividades?", confirmLabel: "Excluir", cancelLabel: "Cancelar", tone: "danger" })
                : global.confirm("Excluir definitivamente " + ids.length + " atividade(s) selecionada(s)?");
            if (!ok) return;
            btn.disabled = true;
            btn.textContent = "Excluindo…";
            try {
                var cloud = global.AuroraCloudSync;
                var client = cloud && cloud.client ? cloud.client : null;
                if (!client || typeof client.rpc !== "function") throw new Error("AURORA_BACKEND_UNAVAILABLE");
                var result = await client.rpc("aurora_company_soft_delete_projects", { p_project_ids: ids });
                if (result.error) throw result.error;
                var idMap = {};
                ids.forEach(function (id) { idMap[String(id)] = true; });
                self._gestaoCompanyRows = (self._gestaoCompanyRows || []).filter(function (row) { return !idMap[String(row && row.id || "")]; });
                ids.forEach(function (id) { delete (self._gestaoCompanyRowsById || {})[String(id)]; });
                host.innerHTML = self.renderCompanyActivitiesHtml(self._gestaoCompanyRows || [], { filter: self._gestaoFilter, query: self._gestaoSearch, page: self._gestaoPage });
                host.__aetBulkDeleteBound = false;
                self.bindAdminDetailOpen(host);
                self.bindAdminReviewOpen(host);
                self.bindGestaoDeleteOpen(host);
                self.bindGestaoBulkDelete(host);
                self.bindGestaoPagination(host);
            } catch (error) {
                console.error("[GESTAO BULK DELETE]", error);
                if (dialog && typeof dialog.alert === "function") await dialog.alert("Não foi possível excluir as atividades selecionadas.", { title: "Exclusão não concluída", tone: "danger" });
                else global.alert("Não foi possível excluir as atividades selecionadas.");
                sync();
            }
        });
        sync();
    },

    bindGestaoDeleteOpen: function (host) {
        if (!host || !this.canOpenGestao()) return;
        var self = this;
        host.querySelectorAll("[data-aet-gestao-delete]").forEach(function (btn) {
            if (btn.__aetDeleteBound) return;
            btn.__aetDeleteBound = true;
            btn.addEventListener("click", function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                var pid = btn.getAttribute("data-aet-gestao-delete") || "";
                if (!pid) return;
                self.deleteGestaoProjectWithPassword(pid).catch(function (error) {
                    console.error("[GESTAO DELETE]", error);
                    window.alert(
                        "Não foi possível excluir o orçamento.\n" +
                        String((error && error.message) || error || "")
                    );
                });
            });
        });
    },

    resolveAuthenticatedEmail: async function () {
        var cloud = global.AuroraCloudSync;
        var client = cloud && cloud.client ? cloud.client : null;
        if (!client || !client.auth || typeof client.auth.getUser !== "function") {
            throw new Error("Autenticação indisponível.");
        }
        var result = await client.auth.getUser();
        var user = result && result.data ? result.data.user : null;
        if (result && result.error) throw result.error;
        if (!user || !user.email) throw new Error("Sessão inválida. Faça login novamente.");
        return String(user.email).trim();
    },

    confirmAccountPassword: async function (options) {
        options = options || {};
        var dialog = global.AuroraDialog;
        if (!dialog || typeof dialog.prompt !== "function") {
            throw new Error("Confirmação indisponível.");
        }
        var confirmed = await dialog.confirm(
            options.message ||
                "Esta exclusão é permanente. Será necessário confirmar com a senha da sua conta.",
            {
                title: options.title || "Excluir orçamento?",
                confirmLabel: "Continuar",
                tone: "danger"
            }
        );
        if (!confirmed) return false;
        var password = await dialog.prompt(
            "Digite a senha da conta autenticada para confirmar.",
            "",
            {
                title: "Confirmar senha",
                fieldLabel: "Senha da conta",
                inputType: "password",
                confirmLabel: "Confirmar exclusão",
                tone: "danger"
            }
        );
        if (password == null || !String(password).trim()) return false;
        var email = await this.resolveAuthenticatedEmail();
        var cloud = global.AuroraCloudSync;
        var client = cloud && cloud.client ? cloud.client : null;
        if (!client || !client.auth || typeof client.auth.signInWithPassword !== "function") {
            throw new Error("Autenticação indisponível.");
        }
        var authResult = await client.auth.signInWithPassword({
            email: email,
            password: String(password)
        });
        if (authResult.error) {
            if (dialog.alert) {
                await dialog.alert("Senha incorreta. O orçamento não foi excluído.", {
                    title: "Senha inválida",
                    tone: "danger"
                });
            }
            return false;
        }
        return true;
    },

    deleteGestaoProjectWithPassword: async function (projectId) {
        if (!this.canOpenGestao()) throw new Error("AURORA_GESTAO_DELETE_FORBIDDEN");
        var pid = String(projectId || "").trim();
        if (!pid) throw new Error("AURORA_GESTAO_DELETE_MISSING_PROJECT");
        var row = (this._gestaoCompanyRowsById || {})[pid];
        if (!row) throw new Error("AURORA_GESTAO_DELETE_NOT_FOUND");
        var userId = this._gestaoCurrentUserId || global.AURORA_ACCOUNT_USER_ID || "";
        var isPeer = this.isCompanyPeerProjectRow(row, userId);
        var fields = this.extractGestaoActivityFields(row);
        var ok = await this.confirmAccountPassword({
            title: "Excluir orçamento?",
            message: "O atendimento \"" + (fields.title || "Elétrica Tupy") +
                "\" será excluído permanentemente da nuvem e deste dispositivo."
        });
        if (!ok) return false;
        var cloud = global.AuroraCloudSync;
        if (isPeer) {
            var client = cloud && cloud.client ? cloud.client : null;
            if (!client || typeof client.rpc !== "function") {
                throw new Error("Exclusão na nuvem indisponível.");
            }
            var peerDelete = await client.rpc("aurora_company_soft_delete_projects", { p_project_ids: [pid] });
            if (peerDelete && peerDelete.error) throw peerDelete.error;
        } else {
            if (!cloud || typeof cloud.deleteCloudProject !== "function") {
                throw new Error("Exclusão na nuvem indisponível.");
            }
            await cloud.deleteCloudProject(pid);
            if (typeof cloud.removeLocalCaseByProjectId === "function") {
                cloud.removeLocalCaseByProjectId(pid);
            }
        }
        delete (this._gestaoCompanyRowsById || {})[pid];
        this._gestaoCompanyRows = (this._gestaoCompanyRows || []).filter(function (item) {
            return String(item && item.id || "") !== pid;
        });
        var host = document.querySelector("[data-aet-company-activities]");
        if (host) {
            host.innerHTML = this.renderCompanyActivitiesHtml(this._gestaoCompanyRows || []);
            this.bindAdminDetailOpen(host);
            this.bindAdminReviewOpen(host);
            this.bindGestaoDeleteOpen(host);
            this.bindGestaoBulkDelete(host);
            this.bindGestaoPagination(host);
        }
        var homeHost = document.querySelector("[data-aet-home-recent-admin]");
        if (homeHost) {
            homeHost.innerHTML = this.renderHomeRecentActivitiesHtml(this._gestaoCompanyRows || []);
            this.bindAdminDetailOpen(homeHost);
            this.bindAdminReviewOpen(homeHost);
            this.bindGestaoDeleteOpen(homeHost);
        }
        return true;
    },

    hasTupyAntesPhotoSaved: function (groups) {
        var list = groups;
        if (!list) {
            var api = global.AuroraEvidenceFeature;
            list = api && typeof api.getGroups === "function" ? api.getGroups() : [];
        }
        return hasTupyAntesPhotoSaved(list);
    },

    canCreateOccurrences: function (groups) {
        var c = caseData();
        if (!active(c)) return true;
        return hasTupyAntesPhotoSaved(groups);
    },

    validateBudgetNumber: function (context) {
        var c = context && typeof context === "object" ? context : caseData();
        if (!active(c)) return { ok: true };
        var tupy = tupyOf(c);
        var budget = tupy && tupy.servico ? tupy.servico.budget_number : null;
        var value = budget == null ? "" : String(budget).trim();
        return value ? { ok: true, value: value } : { ok: true };
    },

    /**
     * Harness TEMPORÁRIO STORAGE-C — só existe com flag ADMIN READ true.
     * Não é UI definitiva de Relatórios.
     */
    closeEvidenceCloudTestPanel: function () {
        var reader = global.AuroraEvidenceCloudReader;
        if (this._evidenceCloudTestSession && reader && typeof reader.release === "function") {
            reader.release(this._evidenceCloudTestSession);
        }
        this._evidenceCloudTestSession = null;
        var overlay = document.getElementById("aet-evidence-cloud-test-overlay");
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    },

    openEvidenceCloudTestPanel: async function (projectId) {
        var reader = global.AuroraEvidenceCloudReader;
        if (!reader || typeof reader.isEnabled !== "function" || !reader.isEnabled()) {
            return;
        }
        if (!this.canOpenGestao()) {
            return;
        }
        var cloud = global.AuroraCloudSync;
        var client = cloud && cloud.client ? cloud.client : null;
        this.closeEvidenceCloudTestPanel();

        var overlay = document.createElement("div");
        overlay.id = "aet-evidence-cloud-test-overlay";
        overlay.className = "aet-evidence-cloud-test-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.innerHTML =
            '<div class="aet-evidence-cloud-test-panel">' +
            '<header class="aet-evidence-cloud-test-panel__head">' +
            "<strong>Teste STORAGE-C (READ-ONLY)</strong>" +
            '<button type="button" class="aet-evidence-cloud-test-close" data-aet-evidence-test-close>Fechar</button>' +
            "</header>" +
            '<p class="aet-hint">Carregando evidências cloud…</p>' +
            '<div class="aet-evidence-cloud-test-body" data-aet-evidence-test-body></div>' +
            "</div>";
        document.body.appendChild(overlay);

        var self = this;
        var closeBtn = overlay.querySelector("[data-aet-evidence-test-close]");
        if (closeBtn) {
            closeBtn.addEventListener("click", function () {
                self.closeEvidenceCloudTestPanel();
            });
        }
        overlay.addEventListener("click", function (ev) {
            if (ev.target === overlay) {
                self.closeEvidenceCloudTestPanel();
            }
        });

        var body = overlay.querySelector("[data-aet-evidence-test-body]");
        try {
            var session = await reader.loadProjectEvidence(client, projectId);
            this._evidenceCloudTestSession = session;
            if (!body) return;
            if (session.skipped) {
                body.innerHTML = '<p class="aet-hint">Leitura cloud desabilitada (' +
                    esc(session.reason || "flag_off") + ").</p>";
                return;
            }
            body.textContent = "";

            var summary = document.createElement("p");
            summary.innerHTML = "<strong>Quantidade:</strong> " +
                esc(String(session.loaded)) + " / " + esc(String(session.total)) +
                (session.failed ? " (falhas: " + esc(String(session.failed)) + ")" : "");
            body.appendChild(summary);

            var pidLine = document.createElement("p");
            pidLine.className = "aet-hint";
            pidLine.textContent = "project_id: " + String(session.project_id || projectId || "");
            body.appendChild(pidLine);

            if (session.items && session.items.length) {
                var thumbs = document.createElement("div");
                thumbs.className = "aet-evidence-cloud-test-thumbs";
                session.items.forEach(function (item) {
                    var objectUrl = item && (item.object_url || item.url) || "";
                    if (!item || !objectUrl) return;

                    var figure = document.createElement("figure");
                    figure.className = "aet-evidence-cloud-test-thumb";

                    var img = document.createElement("img");
                    img.alt = "Evidência";
                    img.loading = "lazy";
                    img.decoding = "async";
                    img.src = objectUrl;
                    figure.appendChild(img);

                    var cap = document.createElement("figcaption");
                    var blobOk = String(objectUrl).indexOf("blob:") === 0 ? "SIM" : "NÃO";
                    cap.textContent =
                        "id: " + String(item.evidence_id || "").slice(0, 12) +
                        " | meta: " + String(item.mime_type || "—") +
                        " | blob.type: " + String(item.blob_type || "—") +
                        " | size: " + String(item.blob_size != null ? item.blob_size : "—") +
                        " | blob: " + blobOk;
                    figure.appendChild(cap);
                    thumbs.appendChild(figure);
                });
                body.appendChild(thumbs);
            } else {
                var empty = document.createElement("p");
                empty.className = "aet-hint";
                empty.textContent = "Nenhuma evidência em nuvem encontrada para este atendimento.";
                body.appendChild(empty);
            }

            if (session.failures && session.failures.length) {
                var fail = document.createElement("p");
                fail.className = "aet-hint aet-hint--error";
                fail.textContent = "Falhas: " + JSON.stringify(session.failures);
                body.appendChild(fail);
            }

            var hint = overlay.querySelector(".aet-evidence-cloud-test-panel > .aet-hint");
            if (hint) hint.textContent = "Preview efêmero em memória — fechar revoga Blob URLs.";
        } catch (error) {
            if (body) {
                body.innerHTML = '<p class="aet-hint aet-hint--error">' +
                    esc(String(error && error.message || error || "falha")) + "</p>";
            }
        }
    },

    bindEvidenceCloudTestHarness: function (host) {
        var reader = global.AuroraEvidenceCloudReader;
        if (!host || !reader || typeof reader.isEnabled !== "function" || !reader.isEnabled()) {
            return;
        }
        if (!this.canOpenGestao()) return;
        var self = this;
        var buttons = host.querySelectorAll("[data-aet-evidence-test]");
        for (var i = 0; i < buttons.length; i += 1) {
            (function (btn) {
                btn.addEventListener("click", function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var pid = btn.getAttribute("data-aet-evidence-test") || "";
                    if (!pid) return;
                    self.openEvidenceCloudTestPanel(pid).catch(function (error) {
                        console.error("[STORAGE-C harness]", error);
                    });
                });
            })(buttons[i]);
        }
    },

    /* ============================================================
     * ADMIN REVIEW — reutiliza etapas USER (working_case em memória)
     * ============================================================ */

    isAdminReviewActive: function () {
        return isAdminReviewContext();
    },

    getAdminReviewContext: function () {
        return this._adminReviewContext || null;
    },

    buildWorkingCaseFromGestaoRow: function (row) {
        var cloud = global.AuroraCloudSync;
        if (!cloud || typeof cloud.caseFromCloud !== "function") {
            throw new Error("AURORA_CLOUD_SYNC_UNAVAILABLE");
        }
        var workflow = this.parseGestaoJson(row && row.workflow_state);
        var project = {
            id: row.id,
            legacy_case_id: row.legacy_case_id,
            title: row.title,
            status: row.status,
            service_profile: row.service_profile || "electrical",
            service_type: row.service_type || SERVICE_ID,
            created_at: row.created_at,
            updated_at: row.updated_at,
            company_id: row.company_id,
            customer: row.customer,
            asset: row.asset,
            intake: row.intake,
            diagnostic: row.diagnostic,
            approval: row.approval,
            custom_fields: row.custom_fields,
            workflow_state: workflow
        };
        var restored = cloud.caseFromCloud(project, []);
        if (!restored.service || typeof restored.service !== "object") restored.service = {};
        restored.service.id = SERVICE_ID;
        if (!restored.service.title) restored.service.title = "Elétrica Tupy";
        if (!restored.service.profile) restored.service.profile = "electrical";
        restored.profile_id = restored.profile_id || "electrical";
        restored.module_id = restored.module_id || "electrical";
        restored.admin_review = true;
        restored.cloud_project_id = String(row.id);
        if (row.company_id) restored.company_id = String(row.company_id);
        if (row.created_by) restored.cloud_created_by = String(row.created_by);
        /* Revisão ADMIN deve poder editar vistorias da equipe — não marcar readonly. */
        /* Não marcar restored_from_cloud como import USER — só contexto ADMIN. */
        restored.restored_from_cloud = false;
        restored.admin_review_source = "gestao_cloud_row";
        return restored;
    },

    ensureAdminCodesControllerRegistered: function () {
        var runtime = global.auroraRuntime;
        if (!runtime || !runtime.viewManager || typeof runtime.viewManager.register !== "function") {
            return;
        }
        if (this._adminCodesControllerRegistered) return;
        if (!global.ModuleController) return;
        runtime.viewManager.register(createTupyCodesModuleController("aet_admin_codes", "admin"));
        this._adminCodesControllerRegistered = true;
    },

    ensureUserCodesControllerRegistered: function () {
        var runtime = global.auroraRuntime;
        if (!runtime || !runtime.viewManager || typeof runtime.viewManager.register !== "function") {
            return;
        }
        if (this._userCodesControllerRegistered) return;
        if (!global.ModuleController) return;
        runtime.viewManager.register(createTupyCodesModuleController("aet_service_codes", "user"));
        this._userCodesControllerRegistered = true;
    },

    listUserActivityDefsFromCase: function () {
        var tupy = tupyOf(caseData());
        var defs = [
            { id: "iluminacao", label: "Iluminação" },
            { id: "ventiladores", label: "Ventiladores" },
            { id: "escritorio", label: "Escritório" },
            { id: "outros", label: "Outros" }
        ];
        return defs.filter(function (d) { return !!(tupy.atividades && tupy.atividades[d.id]); }).map(function (d) {
            var det = (tupy.detalhes && tupy.detalhes[d.id]) || {};
            return {
                id: d.id,
                label: d.id === "outros" ? (String(det.nome_trabalho || "").trim() || d.label) : d.label,
                descricao: det.descricao || "",
                quantidade: det.quantidade || ""
            };
        });
    },

    getUserServiceAssociations: function (activityId) {
        var tupy = tupyOf(caseData());
        var list = Array.isArray(tupy.service_codes) ? tupy.service_codes : [];
        var aid = String(activityId || "");
        return list.filter(function (a) {
            return String((a && a.activity_id) || "") === aid;
        });
    },

    setUserServiceAssociations: function (activityId, list) {
        var c = caseData();
        var tupy = tupyOf(c);
        var aid = String(activityId || "");
        var others = (Array.isArray(tupy.service_codes) ? tupy.service_codes : []).filter(function (a) {
            return String((a && a.activity_id) || "") !== aid;
        });
        tupy.service_codes = others.concat(Array.isArray(list) ? list : []);

        /* USER Etapa 5 — persistência canônica.
         * runtime.getCase()/caseData() devolve clone; alterar `c` localmente não grava
         * no atendimento. Commit explícito no CaseBinder garante que as quantidades
         * sobrevivam à finalização, reabertura e cheguem ao motor compartilhado do relatório.
         * O caminho ADMIN não passa por esta função. */
        var runtime = global.auroraRuntime;
        if (runtime && runtime.caseBinder && typeof runtime.caseBinder.merge === "function") {
            runtime.caseBinder.merge(persist(tupy), {
                source: "aet_user_service_codes",
                controller_id: "aet_service_codes"
            });
        }
    },

    collectUserServiceCodesFlat: function () {
        var tupy = tupyOf(caseData());
        return Array.isArray(tupy.service_codes) ? tupy.service_codes.slice() : [];
    },

    createCodesStepAdapter: function (mode) {
        var api = this;
        var admin = mode === "admin";
        var model = admin ? this.buildAdminModelFromWorkingCase() : null;
        if (admin) {
            this._adminServiceCodeState = {};
            var canonicalRows = tupyOf(caseData()).service_codes;
            this.applyLoadedAdminServiceAssociations(
                null,
                model,
                Array.isArray(canonicalRows) ? canonicalRows : []
            );
        }
        return {
            mode: admin ? "admin" : "user",
            moduleId: admin ? "aet_admin_codes" : "aet_service_codes",
            canEdit: true,
            canFinalize: true,
            model: model,
            listActivities: function () {
                return admin
                    ? ((model && Array.isArray(model.activities)) ? model.activities : [])
                    : api.listUserActivityDefsFromCase();
            },
            getAssociations: function (activityId) {
                return admin
                    ? api.getAdminServiceAssociations(activityId)
                    : api.getUserServiceAssociations(activityId);
            },
            setAssociations: function (activityId, list) {
                if (admin) api.setAdminServiceAssociations(activityId, list);
                else api.setUserServiceAssociations(activityId, list);
            },
            save: async function () {
                var state = tupyOf(caseData());
                state.service_codes = admin
                    ? api.collectAdminServiceAssociationsFlat()
                    : api.collectUserServiceCodesFlat();
                if (admin) await persistAdminReviewCanonicalState(state);
                return persist(state);
            }
        };
    },

    renderCodesStepHtml: function (adapter) {
        var grid = global.AuroraEletricaTupyCodesGrid;
        var acts = adapter.listActivities();
        var grids = acts.map(function (act) {
            var gridHtml = (grid && typeof grid.renderHtml === "function")
                ? grid.renderHtml({
                    activityId: act.id,
                    associations: adapter.getAssociations(act.id),
                    query: "",
                    layout: "cards",
                    catalogHtml: ""
                })
                : "";
            return '<article class="aet-admin-code-card aet-codes-step__service" data-aet-code-card="' + esc(act.id) + '">' +
                '<div data-aet-codes-grid-host="' + esc(act.id) + '">' + gridHtml + "</div>" +
                "</article>";
        }).join("");
        if (!acts.length) {
            grids = '<p class="aet-hint">Nenhuma atividade de campo para classificar neste atendimento.</p>';
        }
        var contextAction = adapter.mode === "admin"
            ? '<button type="button" class="aet-btn" data-aet-admin-review-exit>Sair da revisão</button>'
            : '<p class="aet-hint">Revise os códigos e use <strong>Finalizar vistoria ✓</strong> na barra inferior.</p>';
        return '<section class="aurora-module aet-codes-step" data-module="' + esc(adapter.moduleId) + '" data-aet-codes-mode="' + esc(adapter.mode) + '">' +
            hero(5, "Códigos dos trabalhos", "Selecione o período executado e informe a quantidade.") +
            '<article class="aet-card aet-admin-section aet-codes-step__content">' +
            grids +
            '<div class="aet-admin-review-exit-row aet-codes-step__context-action">' + contextAction + "</div>" +
            "</article>" +
            '<div class="aet-catalog-overlay" data-aet-catalog-overlay hidden></div>' +
            "</section>";
    },

    bindCodesStep: async function (container, adapter) {
        var grid = global.AuroraEletricaTupyCodesGrid;
        var self = this;
        if (!container || !grid || typeof grid.bind !== "function") return;

        function wireGrids() {
            adapter.listActivities().forEach(function (act) {
                var host = container.querySelector('[data-aet-codes-grid-host="' + act.id + '"]');
                if (!host) return;
                grid.bind(host, {
                    getAssociations: function () { return adapter.getAssociations(act.id); },
                    setAssociations: function (list) { adapter.setAssociations(act.id, list); }
                });
            });
        }

        if (adapter.mode === "admin") {
            await this.loadAdminServiceCodesFromCloud(container, adapter.model);
            adapter.listActivities().forEach(function (act) {
                var host = container.querySelector('[data-aet-codes-grid-host="' + act.id + '"]');
                if (!host) return;
                host.innerHTML = grid.renderHtml({
                    activityId: act.id,
                    associations: adapter.getAssociations(act.id),
                    query: "",
                    layout: "cards",
                    catalogHtml: ""
                });
            });
        }
        wireGrids();
        this.bindServiceCatalogOpen(container);

        var exitBtn = container.querySelector("[data-aet-admin-review-exit]");
        if (exitBtn) {
            exitBtn.addEventListener("click", function () {
                self.exitAdminReview({ confirm: true }).catch(function (error) {
                    console.error("[ADMIN REVIEW EXIT]", error);
                });
            });
        }
    },

    applyAdminReviewWorkflowSteps: function () {
        var runtime = global.auroraRuntime;
        if (!runtime || !Array.isArray(runtime.steps)) return;
        var caseObj = typeof runtime.getCase === "function" ? runtime.getCase() : {};
        if (!isAdminReviewContext(caseObj)) return;

        if (typeof runtime._applyServiceWorkflowSteps === "function") {
            runtime._applyServiceWorkflowSteps(caseObj);
        }

        runtime.steps = runtime.steps.filter(function (s) {
            return !(s && (s.id === "aet_service_codes" || s.id === "diagnostic"));
        });

        var hasCodes = runtime.steps.some(function (s) { return s && s.id === "aet_admin_codes"; });
        if (!hasCodes) {
            runtime.steps.push({
                id: "aet_admin_codes",
                label: "Códigos dos trabalhos",
                controller: "aet_admin_codes",
                icon: "tag"
            });
        }

        runtime.steps.forEach(function (step) {
            if (!step) return;
            if (step.id === "aet_admin_codes") step.label = "Códigos dos trabalhos";
        });

        if (runtime.shell && typeof runtime.shell.setNavigationItems === "function") {
            var activeStep = runtime.steps[runtime.currentIndex] || runtime.steps[0];
            runtime.shell.setNavigationItems(
                runtime.steps.map(function (step) {
                    return { id: step.id, label: step.label, icon: step.icon };
                }),
                activeStep ? activeStep.id : null
            );
        }
    },

    mountAdminReviewChrome: function () {
        this.unmountAdminReviewChrome();
    },

    unmountAdminReviewChrome: function () {
        var bar = document.getElementById("aet-admin-review-bar");
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
        document.body.classList.remove("aet-admin-review-active");
    },

    startAdminReview: async function (projectId) {
        if (!this.canOpenGestao()) {
            throw new Error("AURORA_ADMIN_REVIEW_FORBIDDEN");
        }
        var pid = String(projectId || "").trim();
        if (!pid) throw new Error("AURORA_ADMIN_REVIEW_MISSING_PROJECT");

        var row = (this._gestaoCompanyRowsById || {})[pid];
        if (!row) throw new Error("AURORA_ADMIN_REVIEW_MISSING_PROJECT");

        var runtime = global.auroraRuntime;
        if (!runtime || typeof runtime.resetCase !== "function") {
            throw new Error("AURORA_RUNTIME_UNAVAILABLE");
        }

        this.closeEvidenceCloudTestPanel();
        this.closeAdminDetailPanel();

        var previousCase = deepCloneJson(
            typeof runtime.getCase === "function" ? runtime.getCase() : {}
        );
        if (previousCase && previousCase.admin_review) {
            previousCase = (this._adminReviewContext && this._adminReviewContext.previous_user_case)
                ? deepCloneJson(this._adminReviewContext.previous_user_case)
                : {};
        }

        var workingCase = await this.resolveGestaoWorkingCase(row, pid);
        workingCase.admin_review = true;
        workingCase.restored_from_cloud = false;
        workingCase.admin_review_source = "gestao_cloud_row";
        workingCase.cloud_project_id = pid;
        workingCase.project_id = pid;
        var originalCase = deepCloneJson(workingCase);
        /* original imutável: remove flag de edição se alguém mutar working depois */
        originalCase.admin_review = true;
        originalCase._admin_original_frozen = true;

        this._adminReviewContext = {
            mode: "admin_review",
            project_id: pid,
            company_id: row.company_id ? String(row.company_id) : null,
            project_row: row,
            original_case: originalCase,
            working_case: workingCase,
            previous_user_case: previousCase
        };

        this.ensureAdminCodesControllerRegistered();
        this.ensureUserCodesControllerRegistered();
        runtime.resetCase(workingCase, { reason: "admin_review" });
        /*
         * R27 — reidrata as ocorrências do case recém-aberto antes da primeira
         * renderização. Evita Etapa 4 vazia após F5 sem alterar o layout.
         */
        var evidenceFeature = global.AuroraEvidenceFeature;
        if (evidenceFeature && typeof evidenceFeature.reload === "function") {
            await evidenceFeature.reload();
        }
        this.applyAdminReviewWorkflowSteps();
        this.mountAdminReviewChrome();

        var ui = global.AuroraUi;
        if (ui && typeof ui.showWorkflow === "function") {
            ui.showWorkflow();
        }

        var first = runtime.steps && runtime.steps[0];
        if (first && typeof runtime.openStep === "function") {
            await runtime.openStep(first.id, { saveCurrent: false, validateCurrent: false });
        }
    },

    exitAdminReview: async function (options) {
        options = options || {};
        var ctx = this._adminReviewContext;
        if (!ctx) {
            this.unmountAdminReviewChrome();
            return;
        }
        if (options.confirm) {
            var ok = window.confirm(
                "Esta revisão ainda não foi salva. Deseja sair e descartar as alterações em memória?"
            );
            if (!ok) return;
        }

        this.releaseAdminReviewEvidenceSession();
        this.closeAdminServiceCodePicker();
        this._adminServiceCodeState = null;
        this.unmountAdminReviewChrome();

        var runtime = global.auroraRuntime;
        var previous = ctx.previous_user_case || {};
        this._adminReviewContext = null;

        if (runtime && typeof runtime.resetCase === "function") {
            /* Restaura case USER anterior (sem admin_review) — case_changed pode persistir o USER. */
            if (previous && previous.admin_review) {
                delete previous.admin_review;
            }
            runtime.resetCase(previous && previous.id ? previous : previous, {
                reason: "admin_review_exit"
            });
        }

        var ui = global.AuroraUi;
        if (ui && typeof ui.showGestaoEletricaTupy === "function") {
            await ui.showGestaoEletricaTupy();
        }
    },

    buildAdminModelFromWorkingCase: function () {
        var ctx = this._adminReviewContext || {};
        var c = caseData();
        var row = Object.assign({}, ctx.project_row || {}, {
            id: ctx.project_id || (c && c.cloud_project_id),
            company_id: ctx.company_id || (c && c.company_id),
            workflow_state: {
                full_case: c,
                service: c && c.service,
                eletrica_tupy: c && c.eletrica_tupy
            },
            customer: c && c.customer,
            asset: c && c.asset,
            intake: c && c.intake,
            diagnostic: c && c.diagnostic,
            approval: c && c.approval
        });
        return this.buildAdminDetailModel(row);
    },

    getAdminFinalEvidence: function () {
        var c = caseData();
        var tupy = tupyOf(c);
        if (!tupy.admin_final_evidence || typeof tupy.admin_final_evidence !== "object") {
            tupy.admin_final_evidence = {
                title: "Foto atividade finalizada",
                description: "",
                photo_data_url: "",
                photos: [],
                added_at: "",
                cloud_upload: false
            };
            c.eletrica_tupy = tupy;
        }
        if (!Array.isArray(tupy.admin_final_evidence.photos)) {
            tupy.admin_final_evidence.photos = [];
        }
        return tupy.admin_final_evidence;
    },

    setAdminFinalEvidence: function (patch) {
        var c = caseData();
        var tupy = tupyOf(c);
        var cur = this.getAdminFinalEvidence();
        tupy.admin_final_evidence = Object.assign({}, cur, patch || {});
        c.eletrica_tupy = tupy;
        if (this._adminReviewContext && this._adminReviewContext.working_case) {
            this._adminReviewContext.working_case = c;
            if (!this._adminReviewContext.working_case.eletrica_tupy) {
                this._adminReviewContext.working_case.eletrica_tupy = tupy;
            } else {
                this._adminReviewContext.working_case.eletrica_tupy.admin_final_evidence =
                    tupy.admin_final_evidence;
            }
        }
        return tupy.admin_final_evidence;
    },

    adminFinalEvidenceHasPhoto: function () {
        var ev = this.getAdminFinalEvidence();
        return !!(ev && ev.photo_data_url && String(ev.photo_data_url).indexOf("data:") === 0);
    },

    releaseAdminReviewEvidenceSession: function () {
        var reader = global.AuroraEvidenceCloudReader;
        if (this._adminReviewEvidenceSession && reader && typeof reader.release === "function") {
            reader.release(this._adminReviewEvidenceSession);
        }
        this._adminReviewEvidenceSession = null;
    },

    rehydrateAdminEvidenceAfterMount: async function (container) {
        if (!container || container.__aetAdminCloudRehydrateStarted) return;
        container.__aetAdminCloudRehydrateStarted = true;

        var context = this._adminReviewContext || {};
        var projectId = String(context.project_id || "").trim();
        var runtime = global.auroraRuntime;
        var c = runtime && typeof runtime.getCase === "function" ? runtime.getCase() : null;
        var groups = c && Array.isArray(c.evidence_groups) ? c.evidence_groups : [];
        var reader = global.AuroraEvidenceCloudReader;
        var cloud = global.AuroraCloudSync;
        var client = cloud && cloud.client ? cloud.client : null;

        if (!projectId || !c || !reader || typeof reader.loadProjectEvidence !== "function") return;

        this.releaseAdminReviewEvidenceSession();
        var session = await reader.loadProjectEvidence(client, projectId);
        this._adminReviewEvidenceSession = session;

        var byGroupId = {};
        groups.forEach(function (group) {
            if (group && group.id) byGroupId[String(group.id)] = group;
        });

        (Array.isArray(session && session.items) ? session.items : []).forEach(function (item) {
            var group = item && byGroupId[String(item.group_id || "")];
            if (!group) return;
            if (!Array.isArray(group.photos)) group.photos = [];
            var evidenceId = String(item.evidence_id || "");
            var photo = group.photos.find(function (candidate) {
                return candidate && String(candidate.id || "") === evidenceId;
            });
            if (!photo) {
                photo = { id: evidenceId, title: "", description: "", category: "general", created_at: null };
                group.photos.push(photo);
            }
            var source = item.object_url || item.url || "";
            photo.src = source;
            photo.url = source;
            photo.object_url = source;
            photo.blob = item.blob || null;
            photo.has_photo = Boolean(source || item.blob);
        });

        /* ADMIN: converte o Blob cloud autenticado em fonte durável.
           Object URLs são temporárias e não podem ser a fonte final do relatório. */
        for (var photoGroupIndex = 0; photoGroupIndex < groups.length; photoGroupIndex += 1) {
            var durableGroup = groups[photoGroupIndex];
            var durablePhotos = Array.isArray(durableGroup && durableGroup.photos) ? durableGroup.photos : [];
            for (var durablePhotoIndex = 0; durablePhotoIndex < durablePhotos.length; durablePhotoIndex += 1) {
                var durablePhoto = durablePhotos[durablePhotoIndex];
                if (!durablePhoto || !durablePhoto.blob) continue;
                var currentSrc = String(durablePhoto.edited_src || durablePhoto.src || durablePhoto.url || "");
                if (currentSrc.indexOf("data:") === 0) continue;
                try {
                    var durableSrc = await this.blobToDataUrlForDemo(durablePhoto.blob);
                    if (durableSrc && durableSrc.indexOf("data:") === 0) {
                        durablePhoto.src = durableSrc;
                        durablePhoto.url = durableSrc;
                        durablePhoto.object_url = "";
                        durablePhoto.has_photo = true;
                    }
                } catch (durableErr) {
                    console.warn("[AET ADMIN evidence durable]", durableErr);
                }
            }
        }

        var store = global.auroraEvidenceStore;
        if (store && typeof store.save === "function") {
            for (var index = 0; index < groups.length; index += 1) {
                await store.save(groups[index]);
            }
        }
        if (runtime.caseBinder && typeof runtime.caseBinder.merge === "function") {
            runtime.caseBinder.merge({ evidence_groups: groups }, {
                source: "admin_evidence_post_mount",
                controller_id: "evidence"
            });
        }
        if (context.working_case) context.working_case.evidence_groups = groups;

        var feature = global.AuroraEvidenceFeature;
        if (feature && typeof feature.reload === "function") await feature.reload();
    },

    syncAdminFinalEvidenceFromNativeHub: async function () {
        try {
            var api = global.AuroraEvidenceFeature;
            if (api && typeof api.flush === "function") {
                try { await api.flush(); } catch (flushErr) { /* ignore */ }
            }
            var groups = api && typeof api.getGroups === "function" ? (api.getGroups() || []) : [];
            var finalGroups = groups.filter(function (g) {
                if (!g) return false;
                var title = String(g.title || g.item || "").trim().toLowerCase();
                return g.record_kind === TUPY_FINAL_RECORD_KIND ||
                    g.tupy_photo_slot === PHOTO_FINAL_SLOT ||
                    title.indexOf("trabalho finalizado") !== -1;
            });

            var photos = [];
            for (var i = 0; i < finalGroups.length; i += 1) {
                var g = finalGroups[i];
                var groupPhotos = Array.isArray(g.photos) ? g.photos : [];
                for (var pIdx = 0; pIdx < groupPhotos.length; pIdx += 1) {
                    var ph = groupPhotos[pIdx];
                    if (!ph) continue;
                    var src = ph.src || ph.edited_src || ph.data_url || ph.url || ph.object_url || "";
                    if (!(src && String(src).indexOf("data:") === 0) && ph.blob && typeof this.blobToDataUrlForDemo === "function") {
                        try { src = await this.blobToDataUrlForDemo(ph.blob); }
                        catch (convErr) { src = ""; }
                    }
                    if (!(src && String(src).indexOf("data:") === 0)) continue;
                    photos.push({
                        id: ph.id ? String(ph.id) : "",
                        src: src,
                        title: String(ph.title || g.title || PHOTO_FINAL_TITLE),
                        description: String(ph.description || g.description || g.observation || "")
                    });
                }
            }

            var unique = [];
            var seen = {};
            photos.forEach(function (photo) {
                var key = photo.id || photo.src;
                if (!key || seen[key]) return;
                seen[key] = true;
                unique.push(photo);
            });

            this.setAdminFinalEvidence({
                title: unique.length ? (unique[0].title || PHOTO_FINAL_TITLE) : PHOTO_FINAL_TITLE,
                description: unique.length ? (unique[0].description || "") : "",
                photo_data_url: unique.length ? unique[0].src : "",
                photos: unique,
                added_at: unique.length ? new Date().toISOString() : "",
                cloud_upload: false,
                source: "native_evidence_hub"
            });
        } catch (err) {
            console.warn("[AET ADMIN evidence sync]", err);
        }
    },

    countAdminCodesInMemory: function () {
        var state = this._adminServiceCodeState || {};
        var n = 0;
        Object.keys(state).forEach(function (k) {
            var list = state[k];
            if (Array.isArray(list)) n += list.length;
        });
        return n;
    },

    /* Compatibilidade ADMIN: se um caminho legado ainda abrir diagnostic após Fotos,
       renderiza/binda a Etapa 5 real em vez do placeholder de Conclusão removida. */
    renderAdminReviewConclusionHtml: function () {
        return this.renderCodesStepHtml(this.createCodesStepAdapter("admin"));
    },

    bindAdminReviewConclusion: function (container) {
        return this.bindCodesStep(container, this.createCodesStepAdapter("admin"));
    },

    /**
     * DEMO — carrega/recupera sessão STORAGE-C para o relatório HTML.
     * Não importa EvidenceStore. Não altera bucket/policies.
     */
    ensureAdminReviewEvidenceSessionForDemo: async function () {
        var session = this._adminReviewEvidenceSession;
        if (session && Array.isArray(session.items) && session.items.length) {
            return session;
        }
        var model = this.buildAdminModelFromWorkingCase();
        var projectId = model.project_id;
        var reader = global.AuroraEvidenceCloudReader;
        var cloud = global.AuroraCloudSync;
        var client = cloud && cloud.client ? cloud.client : null;
        if (!projectId || !reader || typeof reader.loadProjectEvidence !== "function") {
            return session || { items: [] };
        }
        try {
            this.releaseAdminReviewEvidenceSession();
            session = await reader.loadProjectEvidence(client, projectId);
            this._adminReviewEvidenceSession = session;
            return session;
        } catch (error) {
            console.error("[ADMIN DEMO evidence reload]", error);
            return { items: [], failures: [{ reason: String(error && error.message || error) }] };
        }
    },

    /**
     * DEMO — se códigos ainda não estão em memória, tenta carregar da tabela validada.
     */
    ensureAdminCodesLoadedForDemo: async function () {
        if (this.countAdminCodesInMemory() > 0) return;
        var model = this.buildAdminModelFromWorkingCase();
        var projectId = model.project_id;
        var api = global.AuroraAdminServiceCodesCloud;
        var cloud = global.AuroraCloudSync;
        var client = cloud && cloud.client ? cloud.client : null;
        if (!projectId || !api || typeof api.listProjectAdminServiceCodes !== "function") return;
        try {
            var associations = await api.listProjectAdminServiceCodes(client, projectId);
            var byActivity = {};
            (model.activities || []).forEach(function (act) {
                if (act && act.id) byActivity[act.id] = [];
            });
            (associations || []).forEach(function (assoc) {
                if (!assoc || !assoc.activity_id) return;
                if (!byActivity[assoc.activity_id]) byActivity[assoc.activity_id] = [];
                byActivity[assoc.activity_id].push(assoc);
            });
            var self = this;
            Object.keys(byActivity).forEach(function (activityId) {
                self.setAdminServiceAssociations(activityId, byActivity[activityId]);
            });
        } catch (error) {
            console.error("[ADMIN DEMO codes reload]", error);
        }
    },

    blobToDataUrlForDemo: function (blob) {
        return new Promise(function (resolve, reject) {
            if (!blob) {
                resolve("");
                return;
            }
            if (typeof FileReader === "undefined") {
                reject(new Error("FileReader indisponível"));
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                resolve(String(reader.result || ""));
            };
            reader.onerror = function () {
                reject(new Error("Falha ao ler foto para o relatório"));
            };
            reader.readAsDataURL(blob);
        });
    },

    collectAdminDemoMaterialsRows: function (model, tupy) {
        var rows = [];
        if (model && Array.isArray(model.materials) && model.materials.length) {
            model.materials.forEach(function (m) {
                var qty = m.quantidade != null && m.quantidade !== "" ? m.quantidade : m.quantity;
                if (!reportQtyPositive(qty)) return;
                rows.push({
                    descricao: m.descricao || "",
                    sap: m.sap || "",
                    quantidade: String(qty),
                    unidade: resolveMaterialUnit(m),
                    atividade: m.atividade || m.tipo || ""
                });
            });
            return rows;
        }
        var bag = tupy && tupy.materiais && typeof tupy.materiais === "object" ? tupy.materiais : {};
        Object.keys(bag).forEach(function (key) {
            var m = bag[key];
            if (!m || typeof m !== "object") return;
            var qty = m.quantity != null && m.quantity !== "" ? m.quantity : m.quantidade;
            /* SELECIONADO ≠ EXECUTADO: só entra no relatório com quantity > 0. */
            if (!reportQtyPositive(qty)) return;
            rows.push({
                descricao: String(m.descricao || m.description || m.nome || "").trim(),
                sap: String(m.sap || key || "").trim(),
                quantidade: String(qty),
                unidade: resolveMaterialUnit(Object.assign({}, m, { sap: m.sap || key })),
                atividade: String(m.atividade || m.tipo || "").trim()
            });
        });
        return rows;
    },

    collectAdminDemoCodeRows: function (model) {
        var labels = {};
        (model && model.activities || []).forEach(function (a) {
            if (a && a.id) labels[a.id] = a.label || a.id;
        });
        return this.collectAdminServiceAssociationsFlat().filter(function (r) {
            return reportQtyPositive(r && r.quantity);
        }).map(function (r) {
            return {
                activity: labels[r.activity_id] || r.activity_id || "",
                service: r.service_description || r.service_item || "",
                day: r.day_label || r.day_type || "",
                code: r.service_code || "",
                qty: String(r.quantity),
                unit: r.service_unit || ""
            };
        });
    },

    buildAdminDemoReportHtmlDocument: async function (payload) {
        var model = payload.model;
        var servico = (model && model.servico) || {};
        var tupy = payload.tupy || {};
        var conclusao = (tupy.conclusao && typeof tupy.conclusao === "object") ? tupy.conclusao : (model.conclusao || {});
        var activities = model.activities || [];
        var materials = payload.materials || [];
        var codeRows = payload.codeRows || [];
        var photoBlocks = payload.photoBlocks || [];
        var pedidos = payload.pedidos || [];
        var reportNumber = payload.reportNumber || "";
        var coverPhotoSrc = String(payload.coverPhotoSrc || "").trim();
        var generatedAt = new Date().toLocaleString("pt-BR");

        function cell(v) {
            return esc(v == null || v === "" ? "—" : String(v));
        }

        var actRows = activities.map(function (a) {
            return "<tr><td>" + cell(a.label) + "</td><td>" + cell(a.descricao) +
                "</td><td>" + cell(a.quantidade) + "</td><td>" + cell(a.data) + "</td></tr>";
        }).join("");

        var matRows = materials.map(function (m) {
            var qtyLabel = formatMaterialQuantity(m.quantidade, m.unidade);
            return "<tr><td>" + cell(m.descricao) + "</td><td>" + cell(m.sap) +
                "</td><td>" + esc(qtyLabel || String(m.quantidade || "")) + "</td></tr>";
        }).join("");

        var codeTable = codeRows.map(function (r) {
            return "<tr><td>" + cell(r.activity) + "</td><td>" + cell(r.service) +
                "</td><td>" + cell(r.day) + "</td><td>" + cell(r.code) +
                "</td><td>" + cell(r.qty) + "</td><td>" + cell(r.unit) + "</td></tr>";
        }).join("");

        var pedidoHighlight = (pedidos || []).map(function (p) {
            return '<span class="pedido-pill">' + cell(p.numero || p) + "</span>";
        }).join(" ");

        var photosHtml = '<div class="demo-photos">';
        photoBlocks.forEach(function (block) {
            (block.images || []).forEach(function (src, photoIndex) {
                var caption = (block.captions && block.captions[photoIndex]) || block.title || "";
                photosHtml += '<figure class="demo-photo"><img src="' + src + '" alt="Foto do trabalho">' +
                    (caption ? '<figcaption>' + cell(caption) + "</figcaption>" : "") +
                    "</figure>";
            });
        });
        photosHtml += "</div>";
        var hasPhotos = photoBlocks.some(function (b) { return b.images && b.images.length; });

        var desc = String(conclusao.descricao || "").trim();
        var notes = [conclusao.pendencias, conclusao.observacoes]
            .map(function (part) { return String(part || "").trim(); })
            .filter(Boolean)
            .join(" · ");
        var workTitle = servico.titulo || model.title || "";

        return "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">" +
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
            "<title>Atividades Rotineiras Tupy S.A</title>" +
            "<style>" +
            "*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#142033;background:#f4f6f8}" +
            ".toolbar{position:sticky;top:0;z-index:5;display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px;background:#0f2a24;color:#e8fff9}" +
            ".toolbar button{padding:8px 12px;border:0;border-radius:8px;font-weight:700;cursor:pointer}" +
            ".toolbar .print{background:#64f0e5;color:#06221c}.toolbar .close{background:#d7e2ea;color:#142033}" +
            ".page{width:min(210mm,100%);margin:18px auto;padding:14mm 14mm 16mm;background:#fff;box-shadow:0 8px 28px rgba(15,30,50,.18);border:1px solid #d7e0ea}" +
            ".hero{padding:16px 18px;border-radius:14px;background:linear-gradient(135deg,#0b1a31,#123b47);color:#fff;margin-bottom:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
            ".hero-grid{display:grid;grid-template-columns:minmax(0,1fr) 74mm;gap:18px;align-items:center}" +
            ".hero .brand{font-size:12px;letter-spacing:.14em;font-weight:800;color:#64f0e5;text-transform:uppercase}" +
            ".hero h1{margin:7px 0 3px;font-size:21px;font-weight:700;line-height:1.2}" +
            ".hero .work-title{margin:10px 0 0;font-size:25px;font-weight:800;line-height:1.15;color:#fff}" +
            ".hero .pedidos{margin-top:12px;font-size:13px;font-weight:400;color:#c6d4df}" +
            ".hero .pedidos-label{display:block;font-weight:400;font-size:10px;color:#a9bcc8;margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em}" +
            ".hero .report-no{margin-top:8px;font-size:13px;font-weight:400;color:#c6d4df}" +
            ".hero .report-no-label{display:block;font-weight:400;font-size:10px;color:#a9bcc8;margin-bottom:2px;text-transform:uppercase;letter-spacing:.08em}" +
            ".hero .report-no-value{font-weight:700;font-size:13px;color:#e8fff9}" +
            ".hero-cover{margin:0;border:1px solid rgba(232,255,249,.28);border-radius:12px;overflow:hidden;background:rgba(0,0,0,.18);height:52mm;display:flex;align-items:center;justify-content:center}" +
            ".hero-cover img{display:block;width:100%;height:100%;object-fit:contain}" +
            ".badge{display:inline-block;margin-top:10px;padding:4px 8px;border-radius:999px;background:rgba(100,240,229,.18);color:#9ff7ef;font-size:11px;font-weight:700}" +
            ".pedido-pill{display:inline-block;margin:4px 6px 0 0;padding:6px 10px;border-radius:10px;background:rgba(100,240,229,.22);color:#e8fff9;font-size:14px;font-weight:700}" +
            "section{background:#fff;border:1px solid #d7e0ea;border-radius:14px;padding:13px 15px;margin:0 0 10px}" +
            "h3{margin:0 0 10px;font-size:15px;letter-spacing:.04em;text-transform:uppercase;color:#0f3d36}" +
            "table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #e6edf4;padding:8px 6px;text-align:left;vertical-align:top}" +
            "th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5b6b7c;background:#f7fafc}" +
            ".kv{display:grid;grid-template-columns:1fr 1fr;gap:7px 18px;font-size:12.5px}.kv span{display:block;color:#5b6b7c;font-size:10px}.kv strong{display:block;font-weight:600;margin-bottom:4px}.kv span{color:#5b6b7c}.kv strong{font-weight:600}" +
            ".demo-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:8px}" +
            ".demo-photo{margin:0;min-width:0;border:1px solid #d7e0ea;border-radius:10px;overflow:hidden;background:#f7fafc;break-inside:avoid}" +
            ".demo-photo img{display:block;width:100%;height:105mm;object-fit:contain;background:#f1f4f7}" +
            ".demo-photo figcaption{padding:6px 8px;background:#fff;color:#5b6b7c;font-size:10px;border-top:1px solid #e6edf4}" +
            ".meta{color:#5b6b7c;font-size:12px}" +
            ".aurora-print-page__footer{display:grid;grid-template-columns:1fr auto auto;gap:18px;align-items:end;" +
            "margin-top:18px;padding:12px 4px 0;border-top:1px solid #e4eaee;font-size:11px;color:#718096}" +
            ".aurora-print-footer__brand{display:grid;gap:2px}.aurora-print-footer__brand strong{color:#142033;font-size:12px}" +
            ".aurora-footer-generated{font-size:10px;color:#718096}" +
            ".aurora-print-footer__date,.aurora-print-footer__code{display:grid;gap:2px;text-align:right}" +
            ".aurora-print-footer__date span,.aurora-print-footer__code span{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:#7a8796}" +
            ".aurora-print-footer__date b,.aurora-print-footer__code b{color:#314458;font-size:11px}" +
            "@page{size:A4 portrait;margin:12mm 12mm 18mm;" +
            "@bottom-left{content:\"Atividades Rotineiras Tupy · by Aurora\";font:6pt Arial,sans-serif;color:#718096;" +
            "border-top:.25mm solid #e4eaee;padding-top:2mm;vertical-align:top}" +
            "@bottom-center{content:\"\";}" +
            "@bottom-right{content:\"Página \" counter(page) \" de \" counter(pages);font:6pt Arial,sans-serif;font-weight:700;color:#314458;" +
            "border-top:.25mm solid #e4eaee;padding-top:2mm;vertical-align:top}}" +
            "@media print{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;" +
            ".toolbar{display:none!important}body{background:#fff!important}" +
            ".page{max-width:none;width:auto;margin:0;padding:0 0 8mm;box-shadow:none;border:0}" +
            ".hero{background:#0b1a31!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
            ".hero-grid{grid-template-columns:minmax(0,1fr) 65mm}" +
            ".hero-cover{height:44mm}" +
            ".aurora-print-page__footer{display:none!important}" +
            "section{break-inside:avoid}}" +
            "</style></head><body>" +
            '<div class="toolbar">' +
            '<button type="button" class="print" onclick="window.print()">Imprimir / Salvar PDF</button>' +
            '<button type="button" class="close" onclick="window.close()">Fechar</button>' +
            "<span>Gerado em " + esc(generatedAt) + "</span></div>" +
            '<div class="page">' +
            '<header class="hero"><div class="hero-grid"><div><div class="brand">AURORA</div>' +
            "<h1>Atividades Rotineiras Tupy S.A</h1>" +
            '<p class="work-title">' + cell(workTitle) + "</p>" +
            '<div class="pedidos"><span class="pedidos-label">Número pedido</span>' +
            (pedidoHighlight || "—") + "</div>" +
            '<div class="report-no"><span class="report-no-label">Número do relatório</span>' +
            '<span class="report-no-value">' + cell(reportNumber) + "</span></div></div>" +
            (coverPhotoSrc ? '<figure class="hero-cover"><img src="' + esc(coverPhotoSrc) + '" alt="Foto de capa do relatório"></figure>' : '') +
            '</div></header>' +

            "<section><h3>Identificação</h3><div class=\"kv\">" +
            "<span>Cliente</span><strong>" + cell(servico.cliente || model.client) + "</strong>" +
            "<span>Empresa executora</span><strong>" + cell(servico.empresa) + "</strong>" +
            "<span>Responsável</span><strong>" + cell(servico.solicitante || model.responsible) + "</strong>" +
            "<span>Setor</span><strong>" + cell(servico.setor) + "</strong>" +
            "<span>Local</span><strong>" + cell(servico.local) + "</strong>" +
            "<span>Ponto de referência</span><strong>" + cell(servico.ponto_referencia) + "</strong>" +
            "<span>Data de início</span><strong>" + cell(servico.data_inicio) + "</strong>" +
            "<span>Número do relatório</span><strong>" + cell(reportNumber) + "</strong>" +
            "</div></section>" +

            "<section><h3>Códigos dos serviços executados</h3>" +
            "<p class=\"meta\">Tabela administrativa de códigos de trabalho (não confundir com SAP).</p>" +
            (codeTable
                ? "<table><thead><tr><th>Atividade</th><th>Serviço</th><th>Tipo de dia</th><th>Código</th><th>Quantidade</th><th>Unidade</th></tr></thead><tbody>" +
                  codeTable + "</tbody></table>"
                : "<p>Nenhum código de trabalho associado. Volte à etapa Códigos dos trabalhos.</p>") +
            "</section>" +

            (desc
                ? "<section><h3>Descrição do que foi encontrado / observado</h3><p>" + cell(desc) + "</p></section>"
                : "") +

            "<section><h3>Atividades executadas</h3>" +
            (actRows
                ? "<table><thead><tr><th>Atividade</th><th>Descrição</th><th>Quantidade</th><th>Data de início</th></tr></thead><tbody>" +
                  actRows + "</tbody></table>"
                : "<p>Nenhuma atividade selecionada.</p>") +
            "</section>" +

            "<section><h3>Materiais</h3>" +
            "<p class=\"meta\">Códigos SAP dos materiais (distintos dos códigos de serviço/trabalho).</p>" +
            (matRows
                ? "<table><thead><tr><th>Material</th><th>Código SAP</th><th>Quantidade</th></tr></thead><tbody>" +
                  matRows + "</tbody></table>"
                : "<p>Nenhum material registrado.</p>") +
            "</section>" +

            "<section><h3>Fotos do trabalho</h3>" +
            "<p class=\"meta\">Registro fotográfico do atendimento (sem enquadramento Antes/Durante/Depois).</p>" +
            (hasPhotos ? photosHtml : "<p>Nenhuma evidência disponível nesta sessão.</p>") +
            "</section>" +

            (notes
                ? "<section><h3>Observações / conclusão</h3><p>" + cell(notes) + "</p></section>"
                : "") +

            '<footer class="aurora-print-page__footer">' +
            '<div class="aurora-print-footer__brand">' +
            "<strong>Atividades Rotineiras Tupy</strong>" +
            '<span class="aurora-footer-generated">by Aurora</span></div>' +
            '<div class="aurora-print-footer__date">' +
            "<span>DATA DE EMISSÃO</span><b>" + esc(generatedAt) + "</b></div>" +
            '<div class="aurora-print-footer__code">' +
            "<span>NÚMERO DO RELATÓRIO</span><b>" + cell(reportNumber) + "</b>" +
            "</div></footer>" +
            "</div></body></html>";
    },

    finalizeAdminInspection: async function (container) {
        var statusEl = container && container.querySelector("[data-aet-admin-finalize-status]");
        var btn = container && container.querySelector("[data-aet-admin-finalize-inspection]");
        if (btn) btn.disabled = true;
        if (statusEl) {
            statusEl.classList.remove("aet-hint--error");
            statusEl.textContent = "Salvando códigos e gerando relatório…";
        }
        var model = this.buildAdminModelFromWorkingCase();
        try {
            await this.saveAdminServiceCodesToCloud(container, model.project_id);
            var finalState = tupyOf(caseData());
            finalState.service_codes = this.collectAdminServiceAssociationsFlat();
            await persistAdminReviewCanonicalState(finalState);
        } catch (error) {
            console.warn("[ADMIN FINALIZE codes]", error);
            if (statusEl) {
                statusEl.textContent = "Códigos não persistidos na nuvem nesta sessão — gerando relatório mesmo assim.";
            }
        }
        await this.openAdminDemoFinalReport(container);
        if (statusEl) statusEl.textContent = "Relatório aberto. Use Imprimir / Salvar PDF no documento.";
        if (btn) btn.disabled = false;
        /* Após finalizar, sair da revisão e voltar à Gestão (viewer permanece aberto). */
        try {
            await this.exitAdminReview({ confirm: false });
        } catch (e2) {
            console.warn("[ADMIN FINALIZE exit]", e2);
        }
        try {
            var ui = global.AuroraUi;
            if (ui && typeof ui.showGestaoEletricaTupy === "function") ui.showGestaoEletricaTupy();
            else if (typeof global.showGestaoEletricaTupy === "function") global.showGestaoEletricaTupy();
        } catch (e3) { /* ignore */ }
    },

    openAdminDemoFinalReport: async function (container) {
        if (!this.isAdminReviewActive()) {
            throw new Error("AURORA_ADMIN_DEMO_NOT_IN_REVIEW");
        }
        var statusEl = container && container.querySelector("[data-aet-admin-demo-report-status]");
        var genBtn = container && container.querySelector("[data-aet-admin-generate-report]");
        if (genBtn) genBtn.disabled = true;
        if (statusEl) {
            statusEl.classList.remove("aet-hint--error");
            statusEl.textContent = "Montando relatório…";
        }

        try {
            /*
             * ADMIN usa o MESMO motor e a MESMA prévia do relatório USER.
             * Não existe um segundo template visual para a revisão administrativa.
             */
            await this.syncAdminFinalEvidenceFromNativeHub();
            await this.ensureAdminCodesLoadedForDemo();

            var reportFeature = global.AuroraReportFeature;
            var engine = reportFeature && reportFeature.engine;
            var preview = reportFeature && reportFeature.preview;
            var hooks = reportFeature && reportFeature.__testHooks;
            var runtime = global.auroraRuntime || global.AuroraRuntime;
            if (!reportFeature || !engine || !preview || !runtime || typeof runtime.getCase !== "function") {
                throw new Error("AURORA_STANDARD_REPORT_UNAVAILABLE");
            }

            var reportCase = deepCloneJson(runtime.getCase() || {});
            /* Os códigos definidos pelo ADMIN entram no mesmo snapshot do relatório padrão. */
            var reportTupy = tupyOf(reportCase);
            reportTupy.service_codes = this.collectAdminServiceAssociationsFlat();
            var reportProjectId = String(this.__aetProjectId || reportCase.cloud_project_id || reportCase.project_id || "").trim();
            var pedidosApi = global.AuroraEletricaTupyPedidos;
            var reportNumberApi = global.AuroraEletricaTupyReportNumber;
            reportTupy.admin_orders = (pedidosApi && typeof pedidosApi.get === "function")
                ? pedidosApi.get(reportProjectId)
                : [];
            reportTupy.admin_report_number = (reportNumberApi && typeof reportNumberApi.get === "function")
                ? reportNumberApi.get(reportProjectId)
                : "";
            reportCase.eletrica_tupy = reportTupy;
            reportCase.__aet_admin_review_report = true;

            /* ADMIN: garante no snapshot do relatório as fotos cloud autenticadas
               em data URL durável antes da hidratação padrão. */
            try {
                var reportEvidenceSession = await this.ensureAdminReviewEvidenceSessionForDemo();
                var reportEvidenceItems = Array.isArray(reportEvidenceSession && reportEvidenceSession.items)
                    ? reportEvidenceSession.items : [];
                var reportGroups = Array.isArray(reportCase.evidence_groups) ? reportCase.evidence_groups : [];
                var reportGroupsById = {};
                reportGroups.forEach(function (group) {
                    if (group && group.id) reportGroupsById[String(group.id)] = group;
                });
                for (var rei = 0; rei < reportEvidenceItems.length; rei += 1) {
                    var reportItem = reportEvidenceItems[rei];
                    if (!reportItem) continue;
                    var reportGroup = reportGroupsById[String(reportItem.group_id || "")];
                    if (!reportGroup) continue;
                    if (!Array.isArray(reportGroup.photos)) reportGroup.photos = [];
                    var reportEvidenceId = String(reportItem.evidence_id || "");
                    var reportPhoto = reportGroup.photos.find(function (candidate) {
                        return candidate && String(candidate.id || "") === reportEvidenceId;
                    });
                    if (!reportPhoto) {
                        reportPhoto = { id: reportEvidenceId, title: "", description: "", category: "general", created_at: null };
                        reportGroup.photos.push(reportPhoto);
                    }
                    var reportSrc = String(reportPhoto.edited_src || reportPhoto.src || reportPhoto.url || "");
                    if (reportSrc.indexOf("data:") !== 0 && reportItem.blob) {
                        reportSrc = await this.blobToDataUrlForDemo(reportItem.blob);
                    }
                    if (reportSrc && reportSrc.indexOf("data:") === 0) {
                        reportPhoto.src = reportSrc;
                        reportPhoto.url = reportSrc;
                        reportPhoto.object_url = "";
                        reportPhoto.has_photo = true;
                    }
                }
                reportCase.evidence_groups = reportGroups;
            } catch (reportEvidenceErr) {
                console.warn("[AET ADMIN report evidence]", reportEvidenceErr);
            }

            if (typeof reportFeature.hydrateCoverPhoto === "function") {
                reportCase = await reportFeature.hydrateCoverPhoto(reportCase);
            }
            if (typeof reportFeature.hydrateEvidenceGroups === "function") {
                reportCase = await reportFeature.hydrateEvidenceGroups(reportCase);
            }

            /*
             * ADMIN: hydrateEvidenceGroups() dá prioridade ao EvidenceStore.
             * Na revisão cloud esse store pode conter blob: de uma sessão anterior.
             * Reaplica a fonte durável da sessão cloud no ÚLTIMO ponto antes do engine.
             */
            try {
                var finalEvidenceSession = await this.ensureAdminReviewEvidenceSessionForDemo();
                var finalEvidenceItems = Array.isArray(finalEvidenceSession && finalEvidenceSession.items)
                    ? finalEvidenceSession.items : [];
                var finalGroups = Array.isArray(reportCase.evidence_groups) ? reportCase.evidence_groups : [];
                var finalByGroup = {};
                finalGroups.forEach(function (group) {
                    if (group && group.id) finalByGroup[String(group.id)] = group;
                });
                for (var fei = 0; fei < finalEvidenceItems.length; fei += 1) {
                    var finalItem = finalEvidenceItems[fei];
                    if (!finalItem) continue;
                    var finalGroup = finalByGroup[String(finalItem.group_id || "")];
                    if (!finalGroup) continue;
                    if (!Array.isArray(finalGroup.photos)) finalGroup.photos = [];
                    var finalId = String(finalItem.evidence_id || "");
                    var finalPhoto = finalGroup.photos.find(function (photo) {
                        return photo && String(photo.id || "") === finalId;
                    });
                    if (!finalPhoto) {
                        finalPhoto = { id: finalId, title: "", description: "", category: "general", created_at: null };
                        finalGroup.photos.push(finalPhoto);
                    }
                    var finalSrc = finalItem.blob ? await this.blobToDataUrlForDemo(finalItem.blob) : "";
                    if (finalSrc && finalSrc.indexOf("data:image/") === 0) {
                        finalPhoto.src = finalSrc;
                        finalPhoto.url = finalSrc;
                        finalPhoto.object_url = "";
                        finalPhoto.has_photo = true;
                    }
                }
                reportCase.evidence_groups = finalGroups;
            } catch (finalEvidenceError) {
                console.warn("[AET ADMIN final evidence hydration]", finalEvidenceError);
            }

            /* Reutiliza o mesmo relatório do atendimento quando ele já existe. */
            var existing = hooks && typeof hooks.findExistingReportForCase === "function"
                ? hooks.findExistingReportForCase(reportCase, engine)
                : null;
            var reportId = existing && existing.id
                ? String(existing.id)
                : (hooks && typeof hooks.uniqueReportId === "function"
                    ? hooks.uniqueReportId(reportCase.id, engine)
                    : ("report-" + String(reportCase.id || Date.now())));
            var options = hooks && typeof hooks.buildReportEngineOptions === "function"
                ? hooks.buildReportEngineOptions(reportCase, existing, reportId)
                : { id: reportId };

            var generated = engine.createFromCase(reportCase, options);
            var opened = preview.open(generated.id) === true;
            if (!opened) throw new Error("AURORA_STANDARD_REPORT_PREVIEW_FAILED");

            if (statusEl) statusEl.textContent = "Relatório aberto.";
            return generated;
        } catch (error) {
            if (statusEl) {
                statusEl.classList.add("aet-hint--error");
                statusEl.textContent = "Não foi possível abrir o relatório.";
            }
            throw error;
        } finally {
            if (genBtn) genBtn.disabled = false;
        }
    },

    /**
     * Carrega Atividades recentes via aurora_list_my_company_projects.
     * READ-ONLY. Não grava storage local. Não exige download prévio.
     */
    /* V178 — fronteira canônica do aplicativo Atividades Rotineiras Tupy.
     * A RPC empresarial lista projetos de toda a empresa; por isso a Home/Gestão
     * Tupy deve aceitar somente projetos cujo serviço é eletrica_tupy OU cujo
     * snapshot preserva o bloco eletrica_tupy. service_profile=electrical não é
     * suficiente, pois também pertence ao aplicativo Elétrica comum. */
    isEletricaTupyCompanyRow: function (row) {
        if (!row || typeof row !== "object") return false;
        var serviceType = String(row.service_type || "").trim().toLowerCase();
        if (serviceType === "eletrica_tupy") return true;
        var workflow = this.parseGestaoJson(row.workflow_state);
        var fullCase = this.parseGestaoJson(workflow.full_case);
        var tupy = (fullCase && fullCase.eletrica_tupy) || workflow.eletrica_tupy;
        return !!(tupy && typeof tupy === "object" && Object.keys(tupy).length);
    },

    filterEletricaTupyCompanyRows: function (rows) {
        var self = this;
        return (Array.isArray(rows) ? rows : []).filter(function (row) {
            return self.isEletricaTupyCompanyRow(row);
        });
    },

    /* R54 — uma única autoridade visual para Home/Gestão Tupy.
     * A conectividade escolhe apenas a fonte de dados; nunca uma UI alternativa.
     * Relatórios locais recém-criados entram na mesma coleção exibida pelos rows
     * empresariais, inclusive antes da próxima sincronização com a nuvem. */
    localEletricaTupyCompanyRows: function () {
        var reports = [];
        try {
            reports = JSON.parse(localStorage.getItem("aurora_reports") || "[]");
        } catch (_) { reports = []; }
        if (!Array.isArray(reports)) reports = [];
        var self = this;
        return reports.map(function (report) {
            var snapshot = report && report.snapshot && typeof report.snapshot === "object"
                ? deepCloneJson(report.snapshot) : null;
            if (!snapshot) return null;
            var serviceId = String(snapshot.service && snapshot.service.id || snapshot.service_type || "").trim().toLowerCase();
            var tupy = snapshot.eletrica_tupy && typeof snapshot.eletrica_tupy === "object" ? snapshot.eletrica_tupy : null;
            if (serviceId !== SERVICE_ID && !(tupy && Object.keys(tupy).length)) return null;
            var localCaseId = String(snapshot.id || report.case_id || report.id || "").trim();
            if (!localCaseId) return null;
            var cloudProjectId = String(snapshot.cloud_project_id || report.cloud_project_id || "").trim();
            var rowId = cloudProjectId || localCaseId;
            return {
                id: rowId,
                legacy_case_id: localCaseId,
                title: snapshot.report_title || snapshot.title || (snapshot.customer && snapshot.customer.name) || "Atendimento",
                status: report.status || snapshot.status || "Rascunho",
                service_profile: snapshot.profile_id || (snapshot.service && snapshot.service.profile) || "electrical",
                service_type: SERVICE_ID,
                created_at: report.created_at || snapshot.created_at || "",
                updated_at: report.updated_at || snapshot.updated_at || report.created_at || snapshot.created_at || "",
                company_id: snapshot.company_id || "",
                created_by: snapshot.cloud_created_by || snapshot.created_by || "",
                customer: snapshot.customer || {},
                asset: snapshot.asset || {},
                intake: snapshot.intake || {},
                diagnostic: snapshot.diagnostic || {},
                approval: snapshot.approval || {},
                custom_fields: snapshot.custom_fields || snapshot.custom_values || {},
                workflow_state: { full_case: snapshot, eletrica_tupy: snapshot.eletrica_tupy || {} },
                _aurora_local_snapshot: snapshot,
                _aurora_local_report_id: String(report.id || "")
            };
        }).filter(Boolean);
    },

    mergeEletricaTupyActivityRows: function (companyRows) {
        var self = this;
        var merged = [];
        var indexByKey = {};
        function keys(row) {
            return [row && row.id, row && row.legacy_case_id].map(function (value) {
                return String(value || "").trim();
            }).filter(Boolean);
        }
        function put(row, preferLocal) {
            if (!row || !self.isEletricaTupyCompanyRow(row)) return;
            var rowKeys = keys(row);
            var found = -1;
            rowKeys.some(function (key) {
                if (Object.prototype.hasOwnProperty.call(indexByKey, key)) { found = indexByKey[key]; return true; }
                return false;
            });
            if (found >= 0) {
                if (preferLocal) {
                    var cloudRow = merged[found];
                    var localRow = row;
                    merged[found] = Object.assign({}, cloudRow, localRow, {
                        id: String(cloudRow.id || localRow.id || ""),
                        company_id: cloudRow.company_id || localRow.company_id || "",
                        created_by: cloudRow.created_by || localRow.created_by || "",
                        _aurora_cloud_row: cloudRow
                    });
                }
                keys(merged[found]).concat(rowKeys).forEach(function (key) { indexByKey[key] = found; });
                return;
            }
            var nextIndex = merged.length;
            merged.push(row);
            rowKeys.forEach(function (key) { indexByKey[key] = nextIndex; });
        }
        self.filterEletricaTupyCompanyRows(companyRows).forEach(function (row) { put(row, false); });
        self.localEletricaTupyCompanyRows().forEach(function (row) { put(row, true); });
        return merged;
    },

    resolveGestaoWorkingCase: async function (row, projectId) {
        var localSnapshot = row && row._aurora_local_snapshot;
        if (localSnapshot && typeof localSnapshot === "object") {
            return deepCloneJson(localSnapshot);
        }
        var offline = typeof navigator !== "undefined" && navigator.onLine === false;
        var cloudAdmin = global.AuroraCloudSync;
        if (!offline && cloudAdmin && typeof cloudAdmin.loadCompanyProjectForAdmin === "function") {
            try {
                var adminCloudData = await cloudAdmin.loadCompanyProjectForAdmin(projectId);
                if (adminCloudData) return cloudAdmin.caseFromCloud(adminCloudData.project, adminCloudData.records || []);
            } catch (error) {
                if (!row) throw error;
                console.warn("[AET R54] cloud indisponível; usando snapshot empresarial/local já carregado.", error);
            }
        }
        return this.buildWorkingCaseFromGestaoRow(row);
    },

    loadCompanyActivitiesInto: async function (host) {
        if (!host) return;
        if (!this.canOpenGestao()) {
            host.innerHTML = '<p class="aet-hint aet-hint--error">Gestão indisponível para esta conta.</p>';
            return;
        }
        host.innerHTML = '<p class="aet-hint">Carregando atendimentos da equipe…</p>';
        try {
            var cloud = global.AuroraCloudSync;
            var access = global.AuroraCompanyAccess;
            if (!access || typeof access.listMyCompanyProjects !== "function") {
                throw new Error("AURORA_BACKEND_UNAVAILABLE");
            }
            var client = cloud && cloud.client ? cloud.client : null;
            this._gestaoCurrentUserId = await this.resolveGestaoAuthUserId();
            var rows = await access.listMyCompanyProjects(client);
            rows = this.mergeEletricaTupyActivityRows(rows);
            var byId = {};
            (rows || []).forEach(function (row) {
                if (row && row.id) byId[String(row.id)] = row;
            });
            this._gestaoCompanyRowsById = byId;
            this._gestaoCompanyRows = rows || [];
            host.innerHTML = this.renderCompanyActivitiesHtml(rows);
            this.bindAdminDetailOpen(host);
            this.bindAdminReviewOpen(host);
            this.bindGestaoDeleteOpen(host);
            this.bindGestaoBulkDelete(host);
            var gestaoRoot = host.closest("[data-module='aet-gestao']") || host.parentElement;
            this.bindGestaoFilters(gestaoRoot || host);
            this.bindGestaoPagination(host);
            this.bindServiceCatalogOpen(gestaoRoot || host);
        } catch (error) {
            var code = error && error.code ? String(error.code) : "";
            var msg = "Não foi possível carregar os atendimentos da equipe.";
            if (code === "AURORA_GESTAO_FORBIDDEN" || /42501|forbidden|não autorizado|nao autorizado/i.test(String(error && error.message || ""))) {
                msg = "Sem permissão para listar atendimentos da empresa.";
            } else if (code === "AURORA_BACKEND_UNAVAILABLE") {
                msg = "Backend indisponível. Verifique a conexão e tente novamente.";
            } else if (error && error.message) {
                msg = "Erro ao consultar a empresa: " + String(error.message);
            }
            host.innerHTML = '<p class="aet-hint aet-hint--error">' + esc(msg) + "</p>";
        }
    },

    renderHomeRecentActivitiesHtml: function (rows) {
        var ordered = this.sortCompanyActivityRows(rows).slice(0, 3);
        if (!ordered.length) {
            return '<p class="aet-hint">Nenhuma atividade adicionada ainda.</p>';
        }
        var self = this;
        var currentUserId = String(this._gestaoCurrentUserId || "");
        var pedidosApi = global.AuroraEletricaTupyPedidos;
        var reportApi = global.AuroraEletricaTupyReportNumber;
        return '<div class="aet-home-recent-rich-list">' + ordered.map(function (row) {
            var fields = self.extractGestaoActivityFields(row);
            var status = self.statusGestaoLabel(fields.status);
            var tone = self.statusGestaoTone(fields.status);
            var updated = self.formatGestaoDate(fields.updated_at || fields.created_at);
            var pedidos = (pedidosApi && typeof pedidosApi.get === "function") ? pedidosApi.get(fields.id) : [];
            var pedidoTxt = (pedidos || []).map(function (p) { return p.numero; }).filter(Boolean).join(", ") || "—";
            var reportNo = (reportApi && typeof reportApi.get === "function")
                ? (reportApi.get(fields.id) || "—")
                : "—";
            var budgetNo = fields.budget_number || "—";
            var isPeer = self.isCompanyPeerProjectRow(row, currentUserId);
            var actionsHtml = self.renderGestaoCardActionsHtml(fields, { isPeer: isPeer, showDelete: false });
            var peerBadge = isPeer
                ? '<span class="aet-gestao-badge aet-gestao-badge--peer">Equipe</span>'
                : "";
            var subtitle = fields.activity_summary
                ? '<p class="aet-gestao-rich-card__sub">' + esc(fields.activity_summary) + "</p>"
                : "";
            return '<article class="aet-gestao-rich-card aet-home-recent-rich-card' +
                (isPeer ? " aet-gestao-rich-card--peer" : "") +
                '" data-project-id="' + esc(fields.id || "") + '" data-is-peer="' + (isPeer ? "1" : "0") + '">' +
                '<div class="aet-gestao-rich-card__main">' +
                '<div class="aet-gestao-rich-card__icon" aria-hidden="true">▤</div>' +
                '<div class="aet-gestao-rich-card__body">' +
                '<div class="aet-gestao-rich-card__title-row">' + peerBadge +
                "<strong>" + esc(fields.title || "Atendimento") + "</strong>" +
                '<span class="aet-gestao-badge aet-gestao-badge--' + esc(tone) + '">' + esc(status) + "</span></div>" +
                subtitle +
                '<div class="aet-gestao-rich-card__meta">' +
                "<span>Cliente: <b>" + esc(fields.client || "Tupy S.A.") + "</b></span>" +
                "<span>Responsável: <b>" + esc(fields.responsible || "não informado") + "</b></span>" +
                "<span>Orçamento: <b>" + esc(budgetNo) + "</b></span>" +
                (pedidoTxt !== "—" ? "<span>Pedido: <b>" + esc(pedidoTxt) + "</b></span>" : "") +
                "<span>Relatório: <b>" + esc(reportNo) + "</b></span>" +
                "<span>Atualizado: <b>" + esc(updated) + "</b></span>" +
                "</div></div></div>" +
                '<div class="aet-gestao-rich-card__actions">' + actionsHtml + "</div>" +
                "</article>";
        }).join("") + "</div>";
    },

    loadHomeRecentActivitiesInto: async function (host) {
        if (!host) return;
        if (!this.canOpenGestao()) {
            host.innerHTML = '<p class="aet-hint">Indisponível para esta conta.</p>';
            return;
        }
        host.innerHTML = '<p class="aet-hint">Carregando atividades…</p>';
        try {
            var cloud = global.AuroraCloudSync;
            var access = global.AuroraCompanyAccess;
            if (!access || typeof access.listMyCompanyProjects !== "function") {
                throw new Error("AURORA_BACKEND_UNAVAILABLE");
            }
            var client = cloud && cloud.client ? cloud.client : null;
            this._gestaoCurrentUserId = await this.resolveGestaoAuthUserId();
            var rows = await access.listMyCompanyProjects(client);
            rows = this.mergeEletricaTupyActivityRows(rows);
            var byId = {};
            (rows || []).forEach(function (row) {
                if (row && row.id) byId[String(row.id)] = row;
            });
            this._gestaoCompanyRowsById = byId;
            this._gestaoCompanyRows = rows || [];
            host.innerHTML = this.renderHomeRecentActivitiesHtml(rows);
            this.bindAdminDetailOpen(host);
            this.bindAdminReviewOpen(host);
            this.bindGestaoDeleteOpen(host);
        } catch (error) {
            console.error("[HOME recent admin]", error);
            host.innerHTML = '<p class="aet-hint aet-hint--error">Não foi possível carregar as últimas atividades.</p>';
        }
    }
};

try {
    if (global.AuroraEletricaTupy && typeof global.AuroraEletricaTupy.ensureUserCodesControllerRegistered === "function") {
        global.AuroraEletricaTupy.ensureUserCodesControllerRegistered();
    }
} catch (error) {
    console.error("[AET USER CODES REGISTER]", error);
}

})(window);

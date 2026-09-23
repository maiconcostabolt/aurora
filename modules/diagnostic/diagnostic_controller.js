(function (global) {
"use strict";

const CONCLUSION_STATUS_OPTIONS = [
    "Concluído",
    "Em execução",
    "Revisão",
    "Rascunho"
];

function normalizeYesNo(value, fallback = "Sim") {
    if (value === true || value === "true") {
        return "Sim";
    }

    if (value === false || value === "false") {
        return "Não";
    }

    if (value === "Sim" || value === "Não") {
        return value;
    }

    return fallback;
}

const REPORT_TITLE_SIZE_OPTIONS = [
    "Pequeno",
    "Normal",
    "Grande"
];

function normalizeReportTitleSize(value, fallback = "Normal") {
    const raw = String(value || "").trim();

    if (REPORT_TITLE_SIZE_OPTIONS.includes(raw)) {
        return raw;
    }

    const aliases = {
        small: "Pequeno",
        normal: "Normal",
        large: "Grande"
    };
    const mapped =
        aliases[raw.toLocaleLowerCase("pt-BR")] ||
        raw;

    return REPORT_TITLE_SIZE_OPTIONS.includes(mapped)
        ? mapped
        : fallback;
}

function normalizeConclusionStatus(value, fallback = "Concluído") {
    const raw = String(value || "").trim();

    if (!raw) {
        return fallback;
    }

    if (CONCLUSION_STATUS_OPTIONS.includes(raw)) {
        return raw;
    }

    const aliases = {
        "em revisão": "Revisão",
        "revisao": "Revisão",
        "revisão": "Revisão",
        "concluido": "Concluído",
        "concluído": "Concluído",
        "completed": "Concluído",
        "complete": "Concluído",
        "em execução": "Em execução",
        "em execucao": "Em execução",
        "executando": "Em execução",
        "in execution": "Em execução",
        "rascunho": "Rascunho",
        "draft": "Rascunho",
        "em andamento": "Rascunho",
        "in_progress": "Rascunho"
    };
    const mapped =
        aliases[raw.toLocaleLowerCase("pt-BR")] ||
        raw;

    return CONCLUSION_STATUS_OPTIONS.includes(mapped)
        ? mapped
        : fallback;
}

function buildConclusionInitialValues(context = {}) {
    const diagnostic = context.diagnostic || {};
    const approval = context.approval || {};
    const reportTitle = String(
        approval.report_title ||
        diagnostic.report_title ||
        context.report_title ||
        ""
    ).trim();
    const summaryCandidate = String(
        diagnostic.summary ||
        diagnostic.recommendation ||
        approval.notes ||
        ""
    ).trim();

    return {
        summary:
            summaryCandidate ||
            (reportTitle
                ? `Resumo: ${reportTitle}`
                : ""),
        recommendation:
            diagnostic.recommendation || "",
        report_title:
            reportTitle,
        report_title_size:
            normalizeReportTitleSize(
                approval.report_title_size,
                "Normal"
            ),
        show_severity:
            normalizeYesNo(
                approval.show_severity,
                "Sim"
            ),
        show_record_labels:
            normalizeYesNo(
                approval.show_record_labels,
                "Sim"
            ),
        status:
            normalizeConclusionStatus(
                approval.status ||
                diagnostic.status,
                "Concluído"
            ),
        notes:
            approval.notes ||
            diagnostic.notes ||
            ""
    };
}

class DiagnosticModuleController extends global.BaseFormModule {
    constructor(options = {}) {
        const schema = {
            id: "diagnostic",
            title: "Diagnóstico e conclusão",
            description: "Registre o diagnóstico técnico e conclua o atendimento na mesma tela.",
            fields: [
                {id:"summary",type:"textarea",label:"Resumo técnico",required:true},
                {id:"recommendation",type:"textarea",label:"Recomendação geral"},
                {
                    id:"report_title",
                    type:"text",
                    label:"Título do relatório",
                    placeholder:"Digite ou selecione um título para o relatório",
                    help:"Aparecerá em destaque no documento.",
                    required:true
                },
                {
                    id:"report_title_size",
                    type:"select",
                    label:"Tamanho do título",
                    options: REPORT_TITLE_SIZE_OPTIONS,
                    required:true
                },
                {
                    id:"show_severity",
                    type:"select",
                    label:"Exibir gravidade dos registros no relatório?",
                    options:["Sim","Não"],
                    required:true
                },
                {
                    id:"show_record_labels",
                    type:"select",
                    label:"Exibir Registro 1, Registro 2... no relatório?",
                    options:["Sim","Não"],
                    required:true
                },
                {
                    id:"status",
                    type:"select",
                    label:"Status",
                    required:true,
                    options: CONCLUSION_STATUS_OPTIONS
                },
                {id:"notes",type:"textarea",label:"Observação final"}
            ]
        };

        super({
            id:"diagnostic",
            schemaEngine:options.schemaEngine,
            formRenderer:options.formRenderer,
            schema
        });
    }

    async onLoad(context = {}) {
        await super.onLoad(context);

        this._diagnosticContext = context || {};
        const diagnosticProfile = String(
            context.profile_id || context.module_id || context.service_profile || ""
        ).toLowerCase();
        const diagnosticService = String(
            (context.service && context.service.id) || context.service_type || ""
        ).toLowerCase();
        /* V93 — checklist comum às modalidades operacionais.
           Mantém fora os dois fluxos explicitamente congelados:
           Vistoria Veicular e Atividades Rotineiras / Elétrica Tupy. */
        this._workItemsEnabled =
            diagnosticProfile !== "vehicle_inspection" &&
            diagnosticService !== "vehicle_inspection" &&
            diagnosticService !== "eletrica_tupy";
        const diagnostic = context.diagnostic || {};
        this._workItems = Array.isArray(diagnostic.work_items)
            ? diagnostic.work_items.map((item) => ({
                text: String((item && item.text) || ""),
                done: Boolean(item && item.done)
            }))
            : [];
        this._workItemsShowOnReport = diagnostic.work_items_show_on_report !== false;
        this.initialValues =
            buildConclusionInitialValues(
                context
            );
    }

    async bindEvents(container) {
        await super.bindEvents(container);

        const fields = this.form && this.form.querySelector(".aurora-form__fields");
        const statusField = this.form && this.form.querySelector('[data-field-id="status"]');

        if (fields) {
            fields.insertAdjacentHTML(
                "afterbegin",
                '<div class="aurora-conclusion-section"><span>Diagnóstico técnico</span><small>Resumo e recomendação do atendimento.</small></div>'
            );
        }

        if (statusField) {
            statusField.insertAdjacentHTML(
                "beforebegin",
                '<div class="aurora-conclusion-section aurora-conclusion-section--final"><span>Conclusão</span><small>Status e observação final.</small></div>'
            );
        }

        if (this._workItemsEnabled && fields) {
            const technicalHeader = fields.querySelector(".aurora-conclusion-section");
            if (technicalHeader) technicalHeader.insertAdjacentHTML("afterend", `
                <section class="aurora-work-plan" data-work-plan>
                  <div class="aurora-work-plan__head">
                    <div><strong>Trabalhos a realizar</strong><small>Adicione os trabalhos previstos e marque conforme forem executados.</small></div>
                    <label class="aurora-report-switch"><span>Incluir no relatório</span><input type="checkbox" data-work-plan-report><i aria-hidden="true"></i></label>
                  </div>
                  <div class="aurora-work-plan__body" data-work-plan-body>
                    <div data-work-plan-items></div>
                    <button type="button" class="aurora-work-plan__add" data-work-plan-add>+ Adicionar trabalho</button>
                  </div>
                </section>`);
            const plan = fields.querySelector("[data-work-plan]");
            const host = plan.querySelector("[data-work-plan-items]");
            const toggle = plan.querySelector("[data-work-plan-report]");
            const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
            const read = () => Array.from(host.querySelectorAll("[data-work-plan-row]")).map((row) => ({
                text: String(row.querySelector("[data-work-plan-text]")?.value || "").trim(),
                done: Boolean(row.querySelector("[data-work-plan-done]")?.checked)
            })).filter((item) => item.text);
            const render = () => {
                const items = this._workItems.length ? this._workItems : [{text:"",done:false}];
                host.innerHTML = items.map((item) => `<div class="aurora-work-plan__row" data-work-plan-row><label class="aurora-work-plan__check" title="Marcar como executado"><input type="checkbox" data-work-plan-done ${item.done ? "checked" : ""}><span></span></label><input type="text" data-work-plan-text value="${esc(item.text)}" placeholder="Ex.: Trocar fonte 24 V"><button type="button" data-work-plan-remove aria-label="Remover trabalho">×</button></div>`).join("");
            };
            const syncDim = () => plan.classList.toggle("is-report-off", !toggle.checked);
            toggle.checked = this._workItemsShowOnReport;
            render(); syncDim();
            plan.addEventListener("input", () => { this._workItems = read(); });
            toggle.addEventListener("change", () => { this._workItemsShowOnReport = toggle.checked; syncDim(); });
            plan.addEventListener("click", (event) => {
                if (event.target.closest("[data-work-plan-add]")) { this._workItems = read(); this._workItems.push({text:"",done:false}); render(); host.querySelector("[data-work-plan-row]:last-child [data-work-plan-text]")?.focus(); return; }
                const remove = event.target.closest("[data-work-plan-remove]");
                if (remove) { const rows = Array.from(host.querySelectorAll("[data-work-plan-row]")); const index = rows.indexOf(remove.closest("[data-work-plan-row]")); this._workItems = read(); if (index >= 0) this._workItems.splice(index,1); render(); }
            });
            this._readWorkItems = read;
        }
    }

    async onSave() {
        const values = this.formRenderer.read(this.form);

        return {
            diagnostic: {
                summary: values.summary || "",
                recommendation: values.recommendation || "",
                ...(this._workItemsEnabled ? {
                    work_items: this._readWorkItems ? this._readWorkItems() : this._workItems,
                    work_items_show_on_report: Boolean(this._workItemsShowOnReport)
                } : {})
            },
            approval: {
                report_title: values.report_title || "",
                report_title_size:
                    normalizeReportTitleSize(
                        values.report_title_size,
                        "Normal"
                    ),
                show_severity:
                    normalizeYesNo(
                        values.show_severity,
                        "Sim"
                    ),
                show_record_labels:
                    normalizeYesNo(
                        values.show_record_labels,
                        "Sim"
                    ),
                status:
                    (() => {
                        const selected = normalizeConclusionStatus(values.status, "Concluído");
                        const profile = String(
                            (this._diagnosticContext && (this._diagnosticContext.profile_id || this._diagnosticContext.module_id || this._diagnosticContext.service_profile)) || ""
                        ).toLowerCase();
                        const service = String(
                            (this._diagnosticContext && this._diagnosticContext.service && this._diagnosticContext.service.id) ||
                            (this._diagnosticContext && this._diagnosticContext.service_type) || ""
                        ).toLowerCase();
                        const excluded = profile === "vehicle_inspection" || service === "vehicle_inspection" || service === "eletrica_tupy";
                        const items = this._readWorkItems ? this._readWorkItems() : this._workItems;
                        const hasPending = !excluded && Array.isArray(items) && items.some((item) =>
                            item && String(item.text || "").trim() && !item.done
                        );
                        return hasPending ? "Em execução" : selected;
                    })(),
                notes: values.notes || ""
            }
        };
    }
}

global.DiagnosticModuleController =
    DiagnosticModuleController;

global.AuroraDiagnosticConclusion =
    {
        normalizeYesNo,
        normalizeReportTitleSize,
        normalizeConclusionStatus,
        buildConclusionInitialValues,
        CONCLUSION_STATUS_OPTIONS,
        REPORT_TITLE_SIZE_OPTIONS
    };
})(window);

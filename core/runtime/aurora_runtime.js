(function (global) {
"use strict";

class AuroraRuntime {
    constructor(options = {}) {
        if (
            !options.container ||
            typeof options.container.innerHTML !== "string"
        ) {
            throw new Error(
                "AuroraRuntime requires a valid container."
            );
        }

        this.container =
            options.container;

        this.userName =
            options.userName ||
            "Usuário";

        this.profile =
            options.profile ||
            "workshop";

        this.caseData =
            this._clone(
                options.caseData || {}
            );

        this.steps =
            Array.isArray(options.steps) &&
            options.steps.length
                ? this._clone(options.steps)
                : this._defaultSteps();

        this.currentIndex = 0;
        this.started = false;
        this.events = new Map();
        this.navigationPending = false;

        this.schemaEngine =
            new global.UISchemaEngine();

        this.libraryEngine =
            new global.LibraryEngine();

        this.fieldEngine =
            new global.FieldEngine({
                libraryEngine:
                    this.libraryEngine
            });

        this.formRenderer =
            new global.FormRenderer({
                fieldEngine:
                    this.fieldEngine
            });

        this.caseBinder =
            new global.CaseBinder({
                getCase:
                    () => this.caseData,
                updateCase:
                    (nextCase) => {
                        this.caseData =
                            this._clone(nextCase);

                        this.emit(
                            "case_changed",
                            this.getCase()
                        );
                    }
            });

        this._registerLibraries();
        this._registerSchemas();
        this._applyServiceProtocolSchemas(this.caseData);
        this._applyServiceWorkflowSteps(this.caseData);

        this.shell =
            new global.AppShell({
                container:
                    this.container,
                title:
                    options.title ||
                    "AURORA",
                subtitle:
                    this._profileDefinition().subtitle,
                userName:
                    this.userName,
                activeNavigationId:
                    this.steps[0].id,
                navigationItems:
                    this.steps.map(
                        (step) => ({
                            id:
                                step.id,
                            label:
                                step.label,
                            icon:
                                step.icon
                        })
                    )
            });

        this.viewManager = null;
    }

    async start() {
        if (this.started) {
            return this.getState();
        }

        this.shell.mount();

        this.viewManager =
            new global.ViewManager({
                container:
                    this.shell.getContentHost()
            });

        this._registerModules();
        this._bindShellEvents();

        this.started = true;

        await this.openStep(
            this.steps[0].id,
            {
                saveCurrent: false
            }
        );

        this.emit(
            "started",
            this.getState()
        );

        return this.getState();
    }

    async openStep(
        stepId,
        options = {}
    ) {
        const targetIndex =
            this.steps.findIndex(
                (step) =>
                    step.id === stepId
            );

        if (targetIndex < 0) {
            throw new Error(
                `Runtime step '${stepId}' not found.`
            );
        }

        if (this.navigationPending) {
            return {
                ...this.getState(),
                navigation_ignored:
                    true
            };
        }

        this.navigationPending =
            true;

        try {
            const saveCurrent =
                options.saveCurrent !==
                false;

            if (
                saveCurrent &&
                this.viewManager &&
                this.viewManager
                    .getCurrentController()
            ) {
                const goingForward =
                    targetIndex >
                    this.currentIndex;

                const result =
                    await this.saveCurrent({
                        validate:
                            goingForward
                    });

                if (
                    goingForward &&
                    result.valid ===
                        false
                ) {
                    this.emit(
                        "validation_failed",
                        result
                    );

                    return result;
                }
            }

            this.currentIndex =
                targetIndex;

            const step =
                this.getCurrentStep();

            if (
                step &&
                step.controller === "aet_service_codes" &&
                global.AuroraEletricaTupy &&
                typeof global.AuroraEletricaTupy.ensureUserCodesControllerRegistered === "function"
            ) {
                global.AuroraEletricaTupy.ensureUserCodesControllerRegistered();
            }

            await this.viewManager.show(
                step.controller,
                this.caseBinder.read()
            );

            /* Toda etapa começa no topo. O conteúdo da Aurora é o contêiner
             * rolável tanto no PWA desktop quanto no celular. */
            if (
                this.shell &&
                typeof this.shell.scrollContentTop ===
                    "function"
            ) {
                this.shell.scrollContentTop();
            }

            this.shell
                .setActiveNavigation(
                    step.id
                );

            this._updateShellNavigation();

            this.emit(
                "step_changed",
                {
                    step:
                        this._clone(step),
                    progress:
                        this.getProgress()
                }
            );

            if (global.AuroraHomeReturnTrace) {
                const hr = global.AuroraHomeReturnTrace;
                const runtimeCase = hr.runtimeCaseSnapshot();

                hr.logHR2({
                    caseId: runtimeCase.id,
                    stepId: step.id,
                    controller: step.controller,
                    currentIndex: this.currentIndex,
                    activeAuroraView:
                        typeof hr.getActiveAuroraView === "function"
                            ? hr.getActiveAuroraView()
                            : "unknown"
                });
            }

            return this.getState();
        } finally {
            this.navigationPending =
                false;
        }
    }

    async next() {
        if (
            this.currentIndex >=
            this.steps.length - 1
        ) {
            const result =
                await this.saveCurrent({
                    validate: true
                });

            if (result.valid) {
                this.emit(
                    "workflow_completed",
                    {
                        case:
                            this.getCase()
                    }
                );
            }

            return result;
        }

        return this.openStep(
            this.steps[
                this.currentIndex + 1
            ].id
        );
    }

    async finish() {
        if (
            this.currentIndex !==
            this.steps.length - 1
        ) {
            return {
                valid: false,
                saved: false,
                reason: "not_last_step"
            };
        }

        return await this.next();
    }

    async previous() {
        if (this.currentIndex <= 0) {
            return this.getState();
        }

        return this.openStep(
            this.steps[
                this.currentIndex - 1
            ].id
        );
    }

    async saveCurrent(options = {}) {
        if (!this.viewManager) {
            return {
                valid: true,
                saved: false,
                patch: null
            };
        }

        const controller =
            this.viewManager
                .getCurrentController();

        if (!controller) {
            return {
                valid: true,
                saved: false,
                patch: null
            };
        }

        const shouldValidate =
            options.validate !== false;

        if (shouldValidate) {
            const valid =
                await this.viewManager
                    .validateCurrent();

            if (!valid) {
                return {
                    valid: false,
                    saved: false,
                    controller_id:
                        controller.id,
                    patch: null
                };
            }
        }

        const patch =
            await this.viewManager
                .saveCurrent();

        if (patch) {
            this.caseBinder.merge(
                patch,
                {
                    source:
                        "aurora_runtime",
                    controller_id:
                        controller.id
                }
            );

            if (
                controller.id === "evidence" &&
                global.AuroraBugARuntimeTrace &&
                typeof global.AuroraBugARuntimeTrace.captureCase ===
                    "function"
            ) {
                global.AuroraBugARuntimeTrace.captureCase(
                    "D",
                    this,
                    {
                        note:
                            "after flush + onSave + saveCurrent merge (evidence step)"
                    }
                );
            }
        }

        this.emit(
            "module_saved",
            {
                controller_id:
                    controller.id,
                patch:
                    this._clone(patch)
            }
        );

        return {
            valid: true,
            saved:
                Boolean(patch),
            controller_id:
                controller.id,
            patch:
                this._clone(patch)
        };
    }

    getCurrentStep() {
        return this._clone(
            this.steps[
                this.currentIndex
            ]
        );
    }

    getProgress() {
        return {
            current_index:
                this.currentIndex,
            current_number:
                this.currentIndex + 1,
            total:
                this.steps.length,
            percentage:
                Math.round(
                    (
                        (
                            this.currentIndex +
                            1
                        ) /
                        this.steps.length
                    ) *
                    100
                )
        };
    }

    getCase() {
        return this.caseBinder.read();
    }

    resetCase(caseData = {}, options = {}) {
        const hr = global.AuroraHomeReturnTrace;
        const beforeCase = hr ? hr.runtimeCaseSnapshot() : null;
        const beforeRepo = hr ? hr.repositoryCaseSnapshot() : null;

        this.caseData =
            this._clone(
                caseData
            );

        this._applyServiceProtocolSchemas(this.caseData);
        this._applyServiceWorkflowSteps(this.caseData);

        this.currentIndex = 0;

        if (hr) {
            const nextCase = this.getCase();
            const operation =
                nextCase && nextCase.id
                    ? "RESET_NEW_CASE"
                    : "RESET_EMPTY_CASE";

            hr.logHR7({
                operation: operation,
                caseIdBefore: beforeCase && beforeCase.id ? beforeCase.id : "",
                caseIdAfter: nextCase && nextCase.id ? String(nextCase.id) : "",
                origin: options.reason || "manual",
                currentIndex: this.currentIndex
            });

            hr.logHR1({
                caseId: nextCase && nextCase.id ? String(nextCase.id) : "",
                reason: options.reason || "manual",
                status: nextCase && nextCase.status ? String(nextCase.status) : "",
                service:
                    nextCase &&
                    nextCase.service &&
                    nextCase.service.id
                        ? String(nextCase.service.id)
                        : "",
                currentIndex: this.currentIndex,
                currentCase: nextCase && nextCase.id ? "SIM" : "NAO",
                repositoryCaseBefore: beforeRepo && beforeRepo.exists ? "SIM" : "NAO"
            });
        }

        this.emit(
            "case_changed",
            this.getCase()
        );

        this.emit(
            "case_reset",
            {
                reason:
                    options.reason ||
                    "manual",
                case:
                    this.getCase()
            }
        );

        return this.getCase();
    }

    getState() {
        return {
            started:
                this.started,
            profile:
                this.profile,
            current_step:
                this.getCurrentStep(),
            progress:
                this.getProgress(),
            case:
                this.getCase(),
            shell:
                this.shell.getState(),
            view:
                this.viewManager
                    ? this.viewManager.getState()
                    : null
        };
    }

    on(eventName, listener) {
        if (
            typeof listener !==
            "function"
        ) {
            throw new Error(
                "Listener must be a function."
            );
        }

        if (!this.events.has(eventName)) {
            this.events.set(
                eventName,
                new Set()
            );
        }

        this.events
            .get(eventName)
            .add(listener);

        return () => {
            this.events
                .get(eventName)
                .delete(listener);
        };
    }

    emit(eventName, payload) {
        const listeners =
            this.events.get(eventName);

        if (
            eventName === "case_changed" &&
            global.AuroraHomeReturnTrace
        ) {
            const hr = global.AuroraHomeReturnTrace;
            const runtimeCase = hr.runtimeCaseSnapshot();
            const caseData =
                payload && typeof payload === "object"
                    ? payload
                    : null;

            hr.logHR4({
                caseId:
                    caseData && caseData.id != null
                        ? String(caseData.id)
                        : runtimeCase.id,
                currentIndex: this.currentIndex,
                origin: "runtime.emit",
                currentCase:
                    (caseData && caseData.id) || runtimeCase.exists
                        ? "SIM"
                        : "NAO",
                stack: hr.shortStack(2)
            });
        }

        if (!listeners) {
            return;
        }

        listeners.forEach(
            (listener) => {
                listener(
                    this._clone(payload)
                );
            }
        );
    }

    _bindShellEvents() {
        this.shell.on(
            "navigation_selected",
            async (event) => {
                await this.openStep(
                    event.id
                );
            }
        );

        this.shell.on(
            "next_requested",
            async () => {
                await this.next();
            }
        );

        this.shell.on(
            "previous_requested",
            async () => {
                await this.previous();
            }
        );
    }

    _updateShellNavigation() {
        const isLastStep =
            this.currentIndex ===
            this.steps.length - 1;

        let nextLabel = isLastStep
            ? "Finalizar inspeção ✓"
            : "Próximo →";
        const aet = global.AuroraEletricaTupy;
        if (aet && typeof aet.resolveWorkflowNextLabel === "function") {
            nextLabel = aet.resolveWorkflowNextLabel(this.getCase(), isLastStep);
        }

        this.shell.updateNavigationState({
            can_go_previous:
                this.currentIndex > 0,
            can_go_next:
                true,
            is_last_step:
                isLastStep,
            next_label:
                nextLabel,
            progress:
                this.getProgress()
        });

    }

    _registerModules() {
        const modules = [
            new global.CustomerModuleController({
                schemaEngine:
                    this.schemaEngine,
                formRenderer:
                    this.formRenderer
            }),

            new global.AssetModuleController({
                schemaEngine:
                    this.schemaEngine,
                formRenderer:
                    this.formRenderer
            }),

            new global.IntakeModuleController({
                schemaEngine:
                    this.schemaEngine,
                formRenderer:
                    this.formRenderer
            }),

            new global.OccurrenceModuleController({
                schemaEngine:
                    this.schemaEngine,
                formRenderer:
                    this.formRenderer
            }),

            new global.EvidenceModuleController(),

            new global.DiagnosticModuleController({
                schemaEngine:
                    this.schemaEngine,
                formRenderer:
                    this.formRenderer
            }),

            new global.BudgetModuleController(),

            new global.ApprovalModuleController({
                schemaEngine:
                    this.schemaEngine,
                formRenderer:
                    this.formRenderer
            })
        ];

        /* V43 — Grounding participa do mesmo ViewManager/AppShell das demais
         * shapes. Os controllers especializados são registrados no runtime;
         * não existe mais um segundo roteador/sidebar sobreposto. */
        if (
            global.AuroraGroundingShape &&
            typeof global.AuroraGroundingShape.createWorkflowControllers === "function"
        ) {
            modules.push(
                ...global.AuroraGroundingShape.createWorkflowControllers()
            );
        }

        this.viewManager.registerMany(
            modules
        );
    }

    _registerLibraries() {
        this.libraryEngine.registerMany([
            {
                id:
                    "vehicle_colors",
                items: [
                    {
                        value:
                            "white",
                        label:
                            "Branco"
                    },
                    {
                        value:
                            "black",
                        label:
                            "Preto"
                    },
                    {
                        value:
                            "silver",
                        label:
                            "Prata"
                    },
                    {
                        value:
                            "gray",
                        label:
                            "Cinza"
                    },
                    {
                        value:
                            "red",
                        label:
                            "Vermelho"
                    },
                    {
                        value:
                            "blue",
                        label:
                            "Azul"
                    }
                ]
            },
            {
                id:
                    "severity",
                items: [
                    {
                        value:
                            "info",
                        label:
                            "Informativa"
                    },
                    {
                        value:
                            "low",
                        label:
                            "Baixa"
                    },
                    {
                        value:
                            "medium",
                        label:
                            "Média"
                    },
                    {
                        value:
                            "high",
                        label:
                            "Alta"
                    },
                    {
                        value:
                            "critical",
                        label:
                            "Crítica"
                    }
                ]
            }
        ]);
    }

    _registerSchemas() {
        const profile =
            this.profile ||
            "workshop";

        const schemas = {
            workshop: {
                asset: {
                    id: "asset",
                    title: "Veículo",
                    description:
                        "Identifique o veículo que será atendido.",
                    fields: [
                        {
                            id: "identification",
                            type: "text",
                            label: "Veículo",
                            placeholder:
                                "Ex.: Honda Civic 2020",
                            required: true
                        },
                        {
                            id: "plate",
                            type: "text",
                            label: "Placa"
                        },
                        {
                            id: "year_model",
                            type: "text",
                            label: "Ano / modelo"
                        },
                        {
                            id: "color",
                            type: "library_select",
                            label: "Cor",
                            library: "vehicle_colors"
                        },
                        {
                            id: "mileage",
                            type: "number",
                            label: "Quilometragem"
                        },
                        {
                            id: "notes",
                            type: "textarea",
                            label: "Observações"
                        }
                    ]
                },

                intake: {
                    id: "intake",
                    title:
                        "Entrada do atendimento",
                    description:
                        "Registre as condições iniciais do serviço automotivo.",
                    fields: [
                        {
                            id: "reason",
                            type: "textarea",
                            label: "Motivo da entrada",
                            required: true
                        },
                        {
                            id: "initial_condition",
                            type: "textarea",
                            label: "Condição inicial"
                        },
                        {
                            id: "customer_request",
                            type: "textarea",
                            label: "Solicitação do cliente"
                        },
                        {
                            id: "responsible",
                            type: "text",
                            label: "Responsável"
                        },
                        {
                            id: "entry_date",
                            type: "date",
                            label: "Data de entrada"
                        },
                        {
                            id: "priority",
                            type: "select",
                            label: "Prioridade",
                            options: [
                                "Baixa",
                                "Normal",
                                "Alta",
                                "Urgente"
                            ]
                        },
                        {
                            id: "confirmed",
                            type: "checkbox",
                            label: "Entrada conferida"
                        }
                    ]
                },

                occurrence: {
                    id: "occurrence",
                    title: "Ocorrência mecânica",
                    description:
                        "Registre o sistema, sintoma e condição encontrada.",
                    fields: [
                        {
                            id: "title",
                            type: "text",
                            label: "Título da ocorrência",
                            required: true
                        },
                        {
                            id: "system",
                            type: "text",
                            label: "Sistema / componente"
                        },
                        {
                            id: "severity",
                            type: "select",
                            label: "Gravidade",
                            options: [
                                "Baixa",
                                "Média",
                                "Alta",
                                "Crítica"
                            ],
                            required: true
                        },
                        {
                            id: "description",
                            type: "textarea",
                            label: "Descrição",
                            required: true
                        },
                        {
                            id: "recommendation",
                            type: "textarea",
                            label: "Recomendação"
                        }
                    ]
                }
            },

            electrical: {
                asset: {
                    id: "asset",
                    title: "Ativo elétrico",
                    description:
                        "Identifique o painel, motor, circuito, instalação ou equipamento inspecionado.",
                    fields: [
                        {
                            id: "identification",
                            type: "text",
                            label: "Equipamento",
                            placeholder:
                                "Ex.: Painel QGBT-01",
                            required: true
                        },
                        {
                            id: "asset_type",
                            type: "text",
                            label: "Categoria",
                            placeholder: "Selecione ou crie uma categoria",
                            required: true
                        },
                        {
                            id: "tag",
                            type: "text",
                            label: "TAG / identificação técnica"
                        },
                        {
                            id: "location",
                            type: "text",
                            label: "Localização"
                        },
                        {
                            id: "voltage",
                            type: "text",
                            label: "Tensão nominal"
                        },
                        {
                            id: "manufacturer",
                            type: "text",
                            label: "Fabricante"
                        },
                        {
                            id: "model",
                            type: "text",
                            label: "Modelo"
                        },
                        {
                            id: "notes",
                            type: "textarea",
                            label: "Observações técnicas"
                        }
                    ]
                },

                intake: {
                    id: "intake",
                    title:
                        "Dados iniciais da inspeção elétrica",
                    description:
                        "Registre o objetivo, a condição de operação e os requisitos de segurança.",
                    fields: [
                        {
                            id: "reason",
                            type: "textarea",
                            label: "Objetivo da inspeção",
                            required: true
                        },
                        {
                            id: "service_condition",
                            type: "select",
                            label: "Condição do ativo",
                            options: [
                                "Energizado",
                                "Desenergizado",
                                "Em operação",
                                "Parado",
                                "Não informado"
                            ],
                            required: true
                        },
                        {
                            id: "work_permit",
                            type: "select",
                            label: "Permissão de trabalho",
                            options: [
                                "Liberada",
                                "Não aplicável",
                                "Pendente"
                            ]
                        },
                        {
                            id: "lockout",
                            type: "select",
                            label: "Bloqueio e etiquetagem",
                            options: [
                                "Aplicado",
                                "Não aplicável",
                                "Não verificado"
                            ]
                        },
                        {
                            id: "responsible",
                            type: "text",
                            label:
                                "Responsável pelo acompanhamento"
                        },
                        {
                            id: "inspection_date",
                            type: "date",
                            label: "Data da inspeção"
                        },
                        {
                            id: "initial_condition",
                            type: "textarea",
                            label:
                                "Condição inicial observada"
                        },
                        {
                            id: "confirmed",
                            type: "checkbox",
                            label:
                                "Condições iniciais conferidas"
                        }
                    ]
                },

                occurrence: {
                    id: "occurrence",
                    title: "Ocorrência elétrica",
                    description:
                        "Registre o componente e a anomalia elétrica encontrada.",
                    fields: [
                        {
                            id: "title",
                            type: "text",
                            label: "Título da ocorrência",
                            required: true
                        },
                        {
                            id: "component",
                            type: "text",
                            label:
                                "Componente / ponto inspecionado",
                            required: true
                        },
                        {
                            id: "anomaly_type",
                            type: "select",
                            label: "Tipo de anomalia",
                            options: [
                                "Aquecimento",
                                "Mau contato",
                                "Sobrecarga",
                                "Isolamento",
                                "Proteção",
                                "Identificação",
                                "Aterramento",
                                "Dano físico",
                                "Outro"
                            ]
                        },
                        {
                            id: "severity",
                            type: "select",
                            label: "Gravidade",
                            options: [
                                "Baixa",
                                "Média",
                                "Alta",
                                "Crítica"
                            ],
                            required: true
                        },
                        {
                            id: "description",
                            type: "textarea",
                            label: "Descrição técnica",
                            required: true
                        },
                        {
                            id: "immediate_action",
                            type: "textarea",
                            label: "Ação imediata"
                        },
                        {
                            id: "recommendation",
                            type: "textarea",
                            label: "Recomendação"
                        }
                    ]
                }
            },

            industrial: {
                asset: {
                    id: "asset",
                    title: "Ativo industrial",
                    description:
                        "Identifique a máquina, estrutura ou equipamento industrial.",
                    fields: [
                        {
                            id: "identification",
                            type: "text",
                            label: "Equipamento",
                            placeholder:
                                "Ex.: Bomba B-101",
                            required: true
                        },
                        {
                            id: "asset_type",
                            type: "text",
                            label: "Categoria",
                            required: true
                        },
                        {
                            id: "tag",
                            type: "text",
                            label: "TAG"
                        },
                        {
                            id: "sector",
                            type: "text",
                            label: "Setor / área"
                        },
                        {
                            id: "manufacturer",
                            type: "text",
                            label: "Fabricante"
                        },
                        {
                            id: "model",
                            type: "text",
                            label: "Modelo"
                        },
                        {
                            id: "operating_status",
                            type: "select",
                            label: "Condição operacional",
                            options: [
                                "Em operação",
                                "Parado",
                                "Em manutenção",
                                "Fora de serviço"
                            ]
                        },
                        {
                            id: "notes",
                            type: "textarea",
                            label: "Observações técnicas"
                        }
                    ]
                },

                intake: {
                    id: "intake",
                    title:
                        "Dados iniciais da inspeção industrial",
                    description:
                        "Registre o escopo da inspeção e as liberações necessárias.",
                    fields: [
                        {
                            id: "reason",
                            type: "textarea",
                            label:
                                "Objetivo / escopo da inspeção",
                            required: true
                        },
                        {
                            id: "area_release",
                            type: "select",
                            label: "Liberação da área",
                            options: [
                                "Liberada",
                                "Parcial",
                                "Pendente"
                            ]
                        },
                        {
                            id: "responsible",
                            type: "text",
                            label: "Responsável local"
                        },
                        {
                            id: "inspection_date",
                            type: "date",
                            label: "Data da inspeção"
                        },
                        {
                            id: "initial_condition",
                            type: "textarea",
                            label: "Condição inicial"
                        },
                        {
                            id: "confirmed",
                            type: "checkbox",
                            label:
                                "Condições iniciais conferidas"
                        }
                    ]
                },

                occurrence: {
                    id: "occurrence",
                    title: "Ocorrência industrial",
                    description:
                        "Registre a anomalia observada no ativo industrial.",
                    fields: [
                        {
                            id: "title",
                            type: "text",
                            label: "Título da ocorrência",
                            required: true
                        },
                        {
                            id: "component",
                            type: "text",
                            label: "Componente / região"
                        },
                        {
                            id: "severity",
                            type: "select",
                            label: "Gravidade",
                            options: [
                                "Baixa",
                                "Média",
                                "Alta",
                                "Crítica"
                            ],
                            required: true
                        },
                        {
                            id: "description",
                            type: "textarea",
                            label: "Descrição técnica",
                            required: true
                        },
                        {
                            id: "recommendation",
                            type: "textarea",
                            label: "Recomendação"
                        }
                    ]
                }
            },

            car_wash: {
                asset: {
                    id: "asset",
                    title: "Veículo",
                    description: "Identifique o veículo e registre seu estado antes do serviço.",
                    fields: [
                        { id: "identification", type: "text", label: "Veículo", placeholder: "Ex.: Chevrolet Corsa Sedan", required: true },
                        { id: "plate", type: "text", label: "Placa" },
                        { id: "year_model", type: "text", label: "Ano / modelo" },
                        { id: "color", type: "library_select", label: "Cor", library: "vehicle_colors" },
                        { id: "mileage", type: "number", label: "Quilometragem" },
                        { id: "notes", type: "textarea", label: "Itens deixados no veículo / observações" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Condição inicial do veículo",
                    description: "Registre o estado de entrada e o serviço contratado.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviço contratado", required: true },
                        { id: "initial_condition", type: "textarea", label: "Condição externa e interna" },
                        { id: "customer_request", type: "textarea", label: "Solicitação do cliente" },
                        { id: "responsible", type: "text", label: "Responsável pelo recebimento" },
                        { id: "entry_date", type: "date", label: "Data de entrada" },
                        { id: "confirmed", type: "checkbox", label: "Condição inicial conferida" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro do atendimento",
                    description: "Registre condições, avarias, etapas executadas e evidências.",
                    fields: [
                        { id: "title", type: "text", label: "Título do registro", required: true },
                        { id: "component", type: "text", label: "Área do veículo" },
                        { id: "severity", type: "select", label: "Relevância", options: ["Informativa", "Atenção", "Importante"], required: true },
                        { id: "description", type: "textarea", label: "Descrição", required: true },
                        { id: "recommendation", type: "textarea", label: "Orientação / recomendação" }
                    ]
                }
            },

            upholstery_cleaning: {
                asset: {
                    id: "asset",
                    title: "Estofado atendido",
                    description: "Identifique o item, material, cor e quantidade.",
                    fields: [
                        { id: "identification", type: "text", label: "Item atendido", placeholder: "Ex.: Sofá retrátil de 3 lugares", required: true },
                        { id: "asset_type", type: "select", label: "Categoria", options: ["Sofá", "Poltrona", "Colchão", "Cadeira", "Banco automotivo", "Tapete", "Carpete", "Outro"], required: true },
                        { id: "material", type: "text", label: "Material / tecido" },
                        { id: "color", type: "text", label: "Cor" },
                        { id: "quantity", type: "number", label: "Quantidade" },
                        { id: "location", type: "text", label: "Ambiente / endereço" },
                        { id: "notes", type: "textarea", label: "Observações" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Condição inicial do estofado",
                    description: "Registre sujeira, manchas, odores e integridade antes da higienização.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviço contratado", required: true },
                        { id: "initial_condition", type: "textarea", label: "Condição inicial" },
                        { id: "customer_request", type: "textarea", label: "Pontos indicados pelo cliente" },
                        { id: "responsible", type: "text", label: "Responsável local" },
                        { id: "entry_date", type: "date", label: "Data do atendimento" },
                        { id: "confirmed", type: "checkbox", label: "Condição inicial conferida" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro do serviço",
                    description: "Registre manchas, danos prévios, etapas executadas e resultado obtido.",
                    fields: [
                        { id: "title", type: "text", label: "Título do registro", required: true },
                        { id: "component", type: "text", label: "Parte / região" },
                        { id: "severity", type: "select", label: "Resultado", options: ["Informativo", "Removido", "Parcial", "Não removido", "Dano pré-existente"], required: true },
                        { id: "description", type: "textarea", label: "Descrição", required: true },
                        { id: "recommendation", type: "textarea", label: "Cuidados e recomendação" }
                    ]
                }
            },

            curtains_blinds: {
                asset: {
                    id: "asset",
                    title: "Produto e ambiente",
                    description: "Identifique a cortina, persiana, ambiente e medidas principais.",
                    fields: [
                        { id: "identification", type: "text", label: "Produto / ambiente", placeholder: "Ex.: Persiana rolô da sala", required: true },
                        { id: "asset_type", type: "select", label: "Categoria", options: ["Cortina tradicional", "Persiana horizontal", "Persiana vertical", "Rolô", "Romana", "Blackout", "Painel", "Motorizada", "Trilho / varão", "Outro"], required: true },
                        { id: "width", type: "text", label: "Largura" },
                        { id: "height", type: "text", label: "Altura" },
                        { id: "quantity", type: "number", label: "Quantidade" },
                        { id: "color", type: "text", label: "Cor / acabamento" },
                        { id: "notes", type: "textarea", label: "Observações" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Condição inicial do produto",
                    description: "Registre o serviço solicitado, funcionamento e condição da instalação.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviço solicitado", required: true },
                        { id: "initial_condition", type: "textarea", label: "Condição inicial" },
                        { id: "customer_request", type: "textarea", label: "Solicitação do cliente" },
                        { id: "responsible", type: "text", label: "Responsável local" },
                        { id: "entry_date", type: "date", label: "Data do atendimento" },
                        { id: "confirmed", type: "checkbox", label: "Condição inicial conferida" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro da instalação ou manutenção",
                    description: "Registre medições, ajustes, componentes e resultado do serviço.",
                    fields: [
                        { id: "title", type: "text", label: "Título do registro", required: true },
                        { id: "component", type: "text", label: "Componente / ambiente" },
                        { id: "severity", type: "select", label: "Situação", options: ["Informativa", "Concluída", "Ajuste necessário", "Peça necessária", "Pendente"], required: true },
                        { id: "description", type: "textarea", label: "Descrição do serviço", required: true },
                        { id: "recommendation", type: "textarea", label: "Orientação / recomendação" }
                    ]
                }
            },

            repairs_maintenance: {
                asset: {
                    id: "asset",
                    title: "Local do serviço",
                    description: "Identifique o imóvel, o ambiente e o ponto onde o serviço será realizado.",
                    fields: [
                        { id: "identification", type: "text", label: "Local ou identificação do serviço", placeholder: "Ex.: Banheiro do apartamento 302", required: true },
                        { id: "property_type", type: "select", label: "Tipo de imóvel", options: ["Casa", "Apartamento", "Comércio", "Escritório", "Condomínio", "Galpão", "Outro"], required: true },
                        { id: "environment", type: "select", label: "Ambiente", options: ["Sala", "Quarto", "Cozinha", "Banheiro", "Área externa", "Garagem", "Fachada", "Área comercial", "Vários ambientes", "Outro"], required: true },
                        { id: "address", type: "text", label: "Endereço" },
                        { id: "access_conditions", type: "textarea", label: "Acesso, medidas ou cuidados no local" },
                        { id: "notes", type: "textarea", label: "Observações" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Condição inicial e serviço solicitado",
                    description: "Registre o pedido do cliente e as condições encontradas antes de iniciar.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviço solicitado", required: true },
                        { id: "initial_condition", type: "textarea", label: "Condição inicial do local" },
                        { id: "customer_request", type: "textarea", label: "Resultado esperado pelo cliente" },
                        { id: "responsible", type: "text", label: "Responsável no local" },
                        { id: "entry_date", type: "date", label: "Data do atendimento" },
                        { id: "confirmed", type: "checkbox", label: "Condição inicial conferida" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro do serviço",
                    description: "Registre o problema encontrado, a etapa executada, o material utilizado ou uma pendência.",
                    fields: [
                        { id: "title", type: "text", label: "Título do registro", placeholder: "Ex.: Reparo do reboco junto à janela", required: true },
                        { id: "component", type: "text", label: "Ambiente / ponto do serviço" },
                        { id: "severity", type: "select", label: "Situação", options: ["Informativo", "Concluído", "Em andamento", "Material necessário", "Pendente"], required: true },
                        { id: "description", type: "textarea", label: "Descrição do serviço", required: true },
                        { id: "recommendation", type: "textarea", label: "Orientação, acabamento ou próxima etapa" }
                    ]
                }
            },

            drone: {
                asset: {
                    id: "asset",
                    title: "Local inspecionado",
                    description:
                        "Identifique a edificação, área ou estrutura do levantamento aéreo.",
                    fields: [
                        {
                            id: "identification",
                            type: "text",
                            label: "Local ou estrutura",
                            placeholder:
                                "Ex.: Cobertura do galpão principal",
                            required: true
                        },
                        {
                            id: "inspection_type",
                            type: "select",
                            label: "Tipo de levantamento",
                            options: [
                                "Cobertura",
                                "Fachada",
                                "Estrutura",
                                "Energia solar",
                                "Área externa",
                                "Mapeamento",
                                "Outro"
                            ],
                            required: true
                        },
                        {
                            id: "address",
                            type: "text",
                            label: "Endereço / localização"
                        },
                        {
                            id: "area",
                            type: "text",
                            label: "Área aproximada"
                        },
                        {
                            id: "access_conditions",
                            type: "textarea",
                            label:
                                "Condições de acesso e voo"
                        },
                        {
                            id: "notes",
                            type: "textarea",
                            label: "Observações"
                        }
                    ]
                },

                intake: {
                    id: "intake",
                    title:
                        "Planejamento do levantamento aéreo",
                    description:
                        "Registre objetivo, clima, acesso e segurança da operação.",
                    fields: [
                        {
                            id: "reason",
                            type: "textarea",
                            label: "Objetivo do levantamento",
                            required: true
                        },
                        {
                            id: "weather",
                            type: "text",
                            label: "Condições climáticas"
                        },
                        {
                            id: "wind",
                            type: "text",
                            label: "Condição de vento"
                        },
                        {
                            id: "flight_authorization",
                            type: "select",
                            label: "Autorização da operação",
                            options: [
                                "Confirmada",
                                "Não aplicável",
                                "Pendente"
                            ],
                            required: true
                        },
                        {
                            id: "responsible",
                            type: "text",
                            label: "Responsável local"
                        },
                        {
                            id: "inspection_date",
                            type: "date",
                            label: "Data do levantamento"
                        },
                        {
                            id: "risk_notes",
                            type: "textarea",
                            label: "Riscos e restrições"
                        },
                        {
                            id: "confirmed",
                            type: "checkbox",
                            label: "Planejamento conferido"
                        }
                    ]
                },

                occurrence: {
                    id: "occurrence",
                    title: "Ocorrência do levantamento",
                    description:
                        "Registre a região e a anomalia identificada nas imagens.",
                    fields: [
                        {
                            id: "title",
                            type: "text",
                            label: "Título da ocorrência",
                            required: true
                        },
                        {
                            id: "location",
                            type: "text",
                            label: "Região / localização"
                        },
                        {
                            id: "severity",
                            type: "select",
                            label: "Gravidade",
                            options: [
                                "Baixa",
                                "Média",
                                "Alta",
                                "Crítica"
                            ],
                            required: true
                        },
                        {
                            id: "description",
                            type: "textarea",
                            label: "Descrição visual",
                            required: true
                        },
                        {
                            id: "recommendation",
                            type: "textarea",
                            label: "Recomendação"
                        }
                    ]
                }
            }
        };

        const selected =
            schemas[profile] ||
            schemas.workshop;

        /*
         * A gravidade e uma classificacao opcional. "Sem gravidade" nao
         * gera selo no relatorio e atende trabalhos apenas descritivos.
         */
        const severityField = selected.occurrence.fields.find(
            (field) => field.id === "severity"
        );

        if (severityField) {
            severityField.required = false;
            severityField.options = Array.isArray(severityField.options)
                ? severityField.options.filter((option) => option !== "Sem gravidade").concat("Sem gravidade")
                : ["Baixa", "Média", "Alta", "Crítica", "Sem gravidade"];
        }

        /*
         * Estes registros acontecem antes da criação dos módulos.
         * Os controllers genéricos só registram fallback quando o
         * schema ainda não existe, portanto não conseguem sobrescrever
         * a shape selecionada.
         */
        this.schemaEngine.register(
            selected.asset
        );

        this.schemaEngine.register(
            selected.intake
        );

        this.schemaEngine.register(
            selected.occurrence
        );
    }

    _applyServiceProtocolSchemas(caseData = {}) {
        const serviceId = String(
            caseData && caseData.service && caseData.service.id || ""
        ).toLowerCase();

        const caseProfile = String(
            caseData && (caseData.profile_id || caseData.module_id) || this.profile || ""
        ).toLowerCase();

        /*
         * O perfil do runtime pode permanecer com o valor anterior durante o
         * reset de um atendimento. A shape deve ser decidida pelo próprio
         * caso aberto, que é a fonte canônica da navegação e do relatório.
         */
        if (caseProfile === "condominiums") {
            const protocols = {
                "common_areas":{asset:{"id": "asset", "title": "Áreas comuns", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "area_type", "type": "select", "label": "Área inspecionada", "options": ["Hall de entrada", "Corredor", "Escada", "Recepção", "Jardim", "Circulação externa", "Área de serviço", "Outro"], "required": true}, {"id": "block", "type": "text", "label": "Bloco / torre"}, {"id": "floor", "type": "text", "label": "Pavimento"}, {"id": "conservation", "type": "select", "label": "Conservação geral", "options": ["Ótima", "Boa", "Regular", "Ruim", "Crítica"]}, {"id": "accessibility", "type": "select", "label": "Acessibilidade", "options": ["Adequada", "Parcial", "Inadequada", "Não se aplica"]}, {"id": "cleanliness", "type": "select", "label": "Limpeza e organização", "options": ["Adequada", "Atenção", "Inadequada"]}, {"id": "signage", "type": "select", "label": "Sinalização", "options": ["Adequada", "Parcial", "Ausente", "Não se aplica"]}, {"id": "notes", "type": "textarea", "label": "Observações da área"}]},intake:{"id": "intake", "title": "Condição inicial · Áreas comuns", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Áreas comuns", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "electrical_system":{asset:{"id": "asset", "title": "Sistema elétrico", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "area_type", "type": "select", "label": "Ponto / sistema", "options": ["Quadro geral", "Quadro de distribuição", "Iluminação comum", "Iluminação de emergência", "Tomadas", "Gerador", "Outro"], "required": true}, {"id": "block", "type": "text", "label": "Bloco / torre"}, {"id": "location", "type": "text", "label": "Localização"}, {"id": "condition", "type": "select", "label": "Condição aparente", "options": ["Normal", "Atenção", "Crítica", "Não verificado"]}, {"id": "identification", "type": "select", "label": "Identificação dos circuitos", "options": ["Adequada", "Parcial", "Ausente", "Não se aplica"]}, {"id": "protection", "type": "select", "label": "Proteções / fechamentos", "options": ["Adequados", "Atenção", "Inadequados", "Não verificado"]}, {"id": "notes", "type": "textarea", "label": "Observações elétricas"}]},intake:{"id": "intake", "title": "Condição inicial · Sistema elétrico", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Sistema elétrico", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "hydraulic_system":{asset:{"id": "asset", "title": "Sistema hidráulico", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "area_type", "type": "select", "label": "Ponto / sistema", "options": ["Reservatório", "Barrilete", "Prumada", "Registro", "Tubulação aparente", "Caixa de inspeção", "Ralo / drenagem", "Outro"], "required": true}, {"id": "block", "type": "text", "label": "Bloco / torre"}, {"id": "location", "type": "text", "label": "Localização"}, {"id": "leak", "type": "select", "label": "Vazamento aparente", "options": ["Não identificado", "Leve", "Moderado", "Intenso"]}, {"id": "pressure", "type": "select", "label": "Condição de abastecimento", "options": ["Normal", "Oscilação relatada", "Baixa pressão", "Sem abastecimento", "Não testado"]}, {"id": "moisture", "type": "select", "label": "Umidade / infiltração", "options": ["Não aparente", "Indício", "Presente", "Crítica"]}, {"id": "notes", "type": "textarea", "label": "Observações hidráulicas"}]},intake:{"id": "intake", "title": "Condição inicial · Sistema hidráulico", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Sistema hidráulico", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "pump_room":{asset:{"id": "asset", "title": "Bombas e casa de máquinas", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "equipment", "type": "select", "label": "Equipamento", "options": ["Bomba de recalque", "Bomba de drenagem", "Bomba de incêndio", "Pressurizador", "Motor elétrico", "Painel de comando", "Reservatório / vaso", "Outro"], "required": true}, {"id": "tag", "type": "text", "label": "TAG / identificação"}, {"id": "location", "type": "text", "label": "Localização"}, {"id": "operation", "type": "select", "label": "Funcionamento", "options": ["Normal", "Ruído anormal", "Vibração", "Não parte", "Intermitente", "Não testado"]}, {"id": "leak", "type": "select", "label": "Vazamentos", "options": ["Sem vazamento aparente", "Leve", "Moderado", "Intenso"]}, {"id": "panel", "type": "select", "label": "Painel / comando", "options": ["Normal", "Atenção", "Falha aparente", "Não verificado"]}, {"id": "cleanliness", "type": "select", "label": "Organização da casa de máquinas", "options": ["Adequada", "Atenção", "Inadequada"]}, {"id": "notes", "type": "textarea", "label": "Observações do equipamento"}]},intake:{"id": "intake", "title": "Condição inicial · Bombas e casa de máquinas", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Bombas e casa de máquinas", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "elevators":{asset:{"id": "asset", "title": "Elevadores", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "elevator", "type": "text", "label": "Elevador / identificação"}, {"id": "type", "type": "select", "label": "Tipo", "options": ["Social", "Serviço", "Carga", "Plataforma de acessibilidade", "Outro"]}, {"id": "location", "type": "text", "label": "Torre / bloco"}, {"id": "doors", "type": "select", "label": "Portas", "options": ["Funcionamento normal", "Ruído / impacto", "Falha aparente", "Não testado"]}, {"id": "leveling", "type": "select", "label": "Nivelamento de parada", "options": ["Adequado", "Atenção", "Inadequado", "Não testado"]}, {"id": "signage", "type": "select", "label": "Sinalização / avisos", "options": ["Adequada", "Parcial", "Ausente"]}, {"id": "cabin", "type": "select", "label": "Condição da cabine", "options": ["Boa", "Regular", "Ruim", "Crítica"]}, {"id": "notes", "type": "textarea", "label": "Ocorrências observadas"}]},intake:{"id": "intake", "title": "Condição inicial · Elevadores", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Elevadores", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "fire_safety":{asset:{"id": "asset", "title": "Sistema de incêndio", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "item", "type": "select", "label": "Item inspecionado", "options": ["Extintor", "Hidrante", "Mangueira", "Porta corta-fogo", "Iluminação de emergência", "Sinalização de emergência", "Alarme / detector", "Bomba de incêndio", "Rota de fuga", "Outro"], "required": true}, {"id": "identification", "type": "text", "label": "Identificação / número"}, {"id": "location", "type": "text", "label": "Localização"}, {"id": "access", "type": "select", "label": "Acesso", "options": ["Livre", "Parcialmente obstruído", "Obstruído"]}, {"id": "validity", "type": "select", "label": "Validade / inspeção", "options": ["Dentro do prazo", "Próximo do vencimento", "Vencido", "Não se aplica", "Não verificado"]}, {"id": "condition", "type": "select", "label": "Condição aparente", "options": ["Adequada", "Atenção", "Inadequada", "Crítica"]}, {"id": "signage", "type": "select", "label": "Sinalização", "options": ["Adequada", "Parcial", "Ausente", "Não se aplica"]}, {"id": "notes", "type": "textarea", "label": "Observações de segurança"}]},intake:{"id": "intake", "title": "Condição inicial · Sistema de incêndio", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Sistema de incêndio", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "facade_roof":{asset:{"id": "asset", "title": "Fachada e cobertura", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "area_type", "type": "select", "label": "Área inspecionada", "options": ["Fachada frontal", "Fachada lateral", "Fachada posterior", "Cobertura", "Telhado", "Calha", "Rufo", "Laje técnica", "Outro"], "required": true}, {"id": "block", "type": "text", "label": "Bloco / torre"}, {"id": "location", "type": "text", "label": "Trecho / localização"}, {"id": "cracks", "type": "select", "label": "Trincas / fissuras", "options": ["Não aparentes", "Leves", "Moderadas", "Relevantes"]}, {"id": "moisture", "type": "select", "label": "Umidade / infiltração", "options": ["Não aparente", "Indício", "Presente", "Crítica"]}, {"id": "coating", "type": "select", "label": "Revestimento / acabamento", "options": ["Bom", "Desgaste", "Soltura aparente", "Desplacamento"]}, {"id": "drainage", "type": "select", "label": "Calhas / drenagem", "options": ["Adequada", "Atenção", "Obstruída", "Não se aplica"]}, {"id": "notes", "type": "textarea", "label": "Observações da fachada/cobertura"}]},intake:{"id": "intake", "title": "Condição inicial · Fachada e cobertura", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Fachada e cobertura", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "garage":{asset:{"id": "asset", "title": "Garagem", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "sector", "type": "text", "label": "Setor / pavimento"}, {"id": "area_type", "type": "select", "label": "Ponto inspecionado", "options": ["Circulação", "Vagas", "Rampa", "Portão", "Drenagem", "Iluminação", "Sinalização", "Pilar / parede", "Outro"], "required": true}, {"id": "floor_condition", "type": "select", "label": "Piso", "options": ["Bom", "Desgaste", "Trincado", "Quebrado", "Escorregadio"]}, {"id": "lighting", "type": "select", "label": "Iluminação", "options": ["Adequada", "Parcial", "Deficiente", "Falha localizada"]}, {"id": "drainage", "type": "select", "label": "Drenagem", "options": ["Adequada", "Atenção", "Obstruída", "Acúmulo de água"]}, {"id": "signage", "type": "select", "label": "Sinalização", "options": ["Adequada", "Parcial", "Ausente"]}, {"id": "safety", "type": "select", "label": "Condição de segurança", "options": ["Adequada", "Atenção", "Risco identificado"]}, {"id": "notes", "type": "textarea", "label": "Observações da garagem"}]},intake:{"id": "intake", "title": "Condição inicial · Garagem", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Garagem", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "access_gates":{asset:{"id": "asset", "title": "Portões e acessos", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "item", "type": "select", "label": "Item", "options": ["Portão de veículos", "Portão de pedestres", "Interfone", "Fechadura elétrica", "Controle de acesso", "Catraca", "Leitor / biometria", "Barreira", "Outro"], "required": true}, {"id": "location", "type": "text", "label": "Localização"}, {"id": "operation", "type": "select", "label": "Funcionamento", "options": ["Normal", "Lento", "Intermitente", "Falha", "Não testado"]}, {"id": "safety", "type": "select", "label": "Dispositivos de segurança", "options": ["Adequados", "Atenção", "Inadequados", "Não verificado"]}, {"id": "structure", "type": "select", "label": "Estrutura / fixação", "options": ["Boa", "Desgaste", "Folga", "Corrosão", "Dano aparente"]}, {"id": "accessibility", "type": "select", "label": "Acessibilidade", "options": ["Adequada", "Parcial", "Inadequada", "Não se aplica"]}, {"id": "notes", "type": "textarea", "label": "Observações do acesso"}]},intake:{"id": "intake", "title": "Condição inicial · Portões e acessos", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Portões e acessos", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "leisure_area":{asset:{"id": "asset", "title": "Piscina e área de lazer", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "area_type", "type": "select", "label": "Área", "options": ["Piscina", "Playground", "Salão de festas", "Academia", "Quadra", "Churrasqueira", "Sauna", "Espaço kids", "Outro"], "required": true}, {"id": "location", "type": "text", "label": "Localização"}, {"id": "conservation", "type": "select", "label": "Conservação", "options": ["Ótima", "Boa", "Regular", "Ruim", "Crítica"]}, {"id": "cleanliness", "type": "select", "label": "Limpeza", "options": ["Adequada", "Atenção", "Inadequada"]}, {"id": "safety", "type": "select", "label": "Segurança aparente", "options": ["Adequada", "Atenção", "Risco identificado"]}, {"id": "equipment", "type": "select", "label": "Equipamentos / mobiliário", "options": ["Adequados", "Desgaste", "Item danificado", "Não se aplica"], "required": true}, {"id": "signage", "type": "select", "label": "Regras / sinalização", "options": ["Adequada", "Parcial", "Ausente", "Não se aplica"]}, {"id": "notes", "type": "textarea", "label": "Observações da área de lazer"}]},intake:{"id": "intake", "title": "Condição inicial · Piscina e área de lazer", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Piscina e área de lazer", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}},
                "maintenance_occurrences":{asset:{"id": "asset", "title": "Ocorrências e manutenção", "description": "Registre o local, sistema ou equipamento com opções rápidas e complemente somente quando necessário.", "fields": [{"id": "category", "type": "select", "label": "Categoria", "options": ["Elétrica", "Hidráulica", "Civil", "Pintura", "Impermeabilização", "Elevador", "Portão / acesso", "Limpeza", "Jardinagem", "Segurança", "Outro"], "required": true}, {"id": "location", "type": "text", "label": "Local da ocorrência"}, {"id": "status", "type": "select", "label": "Situação", "options": ["Nova ocorrência", "Em acompanhamento", "Aguardando orçamento", "Aguardando material", "Em execução", "Concluída"]}, {"id": "priority", "type": "select", "label": "Prioridade", "options": ["Baixa", "Normal", "Alta", "Urgente"]}, {"id": "responsible", "type": "text", "label": "Responsável / fornecedor"}, {"id": "deadline", "type": "date", "label": "Prazo previsto"}, {"id": "notes", "type": "textarea", "label": "Descrição da ocorrência / manutenção"}]},intake:{"id": "intake", "title": "Condição inicial · Ocorrências e manutenção", "description": "Faça a conferência inicial por toques e registre somente os detalhes necessários.", "fields": [{"id": "reason", "type": "textarea", "label": "Objetivo da inspeção / serviço", "required": true}, {"id": "service_condition", "type": "select", "label": "Condição geral", "options": ["Normal", "Atenção", "Requer manutenção", "Crítica", "Não verificado"], "required": true}, {"id": "responsible", "type": "text", "label": "Responsável pelo acompanhamento"}, {"id": "initial_condition", "type": "textarea", "label": "Condição inicial observada"}, {"id": "customer_request", "type": "textarea", "label": "Solicitação do cliente / condomínio"}]},occurrence:{"id": "occurrence", "title": "Ocorrência · Ocorrências e manutenção", "description": "Registre cada pendência encontrada e anexe as evidências correspondentes.", "fields": [{"id": "title", "type": "text", "label": "Título da ocorrência", "required": true}, {"id": "component", "type": "text", "label": "Item / componente / local", "required": true}, {"id": "anomaly_type", "type": "select", "label": "Tipo de ocorrência", "options": ["Conservação", "Falha de funcionamento", "Vazamento / umidade", "Dano físico", "Desgaste", "Segurança", "Sinalização", "Limpeza / organização", "Preventiva", "Informativo", "Outro"]}, {"id": "severity", "type": "select", "label": "Gravidade", "options": ["Sem gravidade", "Atenção", "Alta", "Crítica"], "required": true}, {"id": "description", "type": "textarea", "label": "Descrição da ocorrência", "required": true}, {"id": "immediate_action", "type": "textarea", "label": "Ação imediata"}, {"id": "recommendation", "type": "textarea", "label": "Recomendação / próxima ação"}]}}
            };
            const selected = protocols[serviceId];
            if (selected) {
                this.schemaEngine.register(selected.asset);
                this.schemaEngine.register(selected.intake);
                this.schemaEngine.register(selected.occurrence);
                return;
            }
        }

        if (caseProfile === "workshop" && serviceId === "vehicle_inspection") {
            const inspectionSchemas = {
                asset: {
                    id: "asset",
                    title: "Veículo recebido",
                    description: "Identifique o veículo e registre os dados exibidos no momento da entrada.",
                    fields: [
                        { id: "identification", type: "text", label: "Marca e modelo", placeholder: "Ex.: Honda Civic", required: true },
                        { id: "plate", type: "text", label: "Placa", required: true },
                        { id: "year_model", type: "text", label: "Ano / modelo" },
                        { id: "color", type: "text", label: "Cor" },
                        { id: "mileage", type: "number", label: "Quilometragem", required: true },
                        { id: "work_order", type: "text", label: "Número da OS" },
                        { id: "fuel_level", type: "select", label: "Nível de combustível", options: ["Reserva", "1/4", "1/2", "3/4", "Cheio"] },
                        { id: "spare_tire", type: "select", label: "Estepe", options: ["OK", "Atenção", "Ausente", "Não verificado"] },
                        { id: "notes", type: "textarea", label: "Observações do veículo" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Recebimento e checklist",
                    description: "Registre o serviço solicitado, os itens entregues e a condição de entrada.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviços solicitados", required: true },
                        { id: "received_items", type: "textarea", label: "Itens e acessórios recebidos", placeholder: "Manual, documentos, chave reserva, tapetes, estepe, macaco e triângulo." },
                        { id: "internal_external", type: "select", label: "Iluminação, interior e exterior", options: ["OK", "Atenção", "Reparo imediato", "Não verificado"] },
                        { id: "levels", type: "select", label: "Óleo, fluidos e níveis", options: ["OK", "Atenção", "Reparo imediato", "Não verificado"] },
                        { id: "brakes", type: "select", label: "Sistema de freios", options: ["OK", "Atenção", "Reparo imediato", "Não verificado"] },
                        { id: "tires", type: "select", label: "Pneus e rodas", options: ["OK", "Atenção", "Reparo imediato", "Não verificado"] },
                        { id: "suspension_steering", type: "select", label: "Suspensão e direção", options: ["OK", "Atenção", "Reparo imediato", "Não verificado"] },
                        { id: "battery", type: "select", label: "Bateria e sistema elétrico", options: ["OK", "Atenção", "Reparo imediato", "Não verificado"] },
                        { id: "safety_items", type: "select", label: "Itens de segurança", options: ["OK", "Atenção", "Reparo imediato", "Não verificado"] },
                        { id: "initial_condition", type: "textarea", label: "Condição geral e avarias já observadas" },
                        { id: "customer_request", type: "textarea", label: "Observações do cliente" },
                        { id: "responsible", type: "text", label: "Consultor / vistoriador" },
                        { id: "entry_date", type: "date", label: "Data de entrada" },
                        { id: "entry_time", type: "time", label: "Hora de entrada" },
                        { id: "confirmed", type: "checkbox", label: "Condições conferidas com o cliente" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Avaria ou condição registrada",
                    description: "Crie um registro para cada risco, amassado, item ausente ou condição relevante e adicione as fotos.",
                    fields: [
                        { id: "title", type: "text", label: "Título da ocorrência", placeholder: "Ex.: Risco no para-choque dianteiro", required: true },
                        { id: "component", type: "select", label: "Região do veículo", options: ["Dianteira", "Traseira", "Lateral esquerda", "Lateral direita", "Teto", "Capô", "Porta-malas", "Para-brisa / vidros", "Roda / pneu", "Interior", "Acessório", "Outro"], required: true },
                        { id: "damage_type", type: "select", label: "Tipo de registro", options: ["Riscado", "Amassado", "Quebrado", "Manchado", "Descascado", "Ausente", "Desgaste", "Informativo"] },
                        { id: "severity", type: "select", label: "Situação", options: ["Informativo", "Atenção", "Reparo imediato", "Sem gravidade"], required: true },
                        { id: "description", type: "textarea", label: "Descrição", required: true },
                        { id: "recommendation", type: "textarea", label: "Orientação / ação recomendada" }
                    ]
                }
            };

            this.schemaEngine.register(inspectionSchemas.asset);
            this.schemaEngine.register(inspectionSchemas.intake);
            this.schemaEngine.register(inspectionSchemas.occurrence);
            return;
        }

        if (this.profile !== "upholstery_cleaning") {
            return;
        }

        const sharedResultOptions = [
            "Informativo",
            "Removido",
            "Parcial",
            "Não removido",
            "Dano pré-existente"
        ];

        const protocols = {
            sofa_cleaning: {
                asset: {
                    id: "asset",
                    title: "Sofá atendido",
                    description: "Caracterize o sofá, o ambiente e o serviço contratado antes da higienização.",
                    fields: [
                        { id: "location", type: "text", label: "Ambiente", placeholder: "Ex.: Sala de estar", required: true },
                        { id: "sofa_type", type: "select", label: "Tipo do sofá", options: ["Fixo", "Retrátil", "Reclinável", "Retrátil e reclinável", "Sofá-cama", "Modular", "Chaise", "Outro"], required: true },
                        { id: "seats", type: "select", label: "Quantidade de lugares", options: ["1", "2", "3", "4", "5", "6+", "Sob medida"], required: true },
                        { id: "material", type: "select", label: "Tecido / revestimento", options: ["Suede", "Veludo", "Linho", "Chenille", "Jacquard", "Sarja", "Couro natural", "Couro sintético / courino", "Microfibra", "Tecido misto", "Não identificado", "Outro"] },
                        { id: "color", type: "text", label: "Cor" },
                        { id: "mechanism_condition", type: "select", label: "Condição do mecanismo", options: ["Não possui", "Funcionando normalmente", "Com resistência", "Com folga", "Travado", "Não testado"] },
                        { id: "loose_cushions", type: "number", label: "Almofadas soltas" },
                        { id: "stain_profile", type: "select", label: "Principal ocorrência percebida", options: ["Sem manchas aparentes", "Bebida / alimento", "Gordura / oleosidade", "Urina", "Mofo / umidade", "Pelos de animais", "Sujidade de uso", "Origem não identificada", "Múltiplas ocorrências", "Outro"] },
                        { id: "odor_level", type: "select", label: "Odor", options: ["Sem odor perceptível", "Leve", "Moderado", "Forte", "Crítico / persistente"] },
                        { id: "contracted_services", type: "textarea", label: "Serviço contratado", placeholder: "Selecione uma ou mais opções", required: true },
                        { id: "notes", type: "textarea", label: "Detalhes específicos do sofá" },
                        { id: "entry_date", type: "date", label: "Data do atendimento", required: true }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Avaliação inicial do sofá",
                    description: "Etapa legada preservada apenas para compatibilidade com atendimentos antigos.",
                    fields: []
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro técnico do sofá",
                    description: "Registre cada mancha, dano pré-existente, etapa ou resultado por região do sofá.",
                    fields: [
                        { id: "title", type: "text", label: "Tipo da ocorrência", placeholder: "Ex.: Mancha de bebida no assento", required: true },
                        { id: "component", type: "select", label: "Região do sofá", options: ["Assento", "Encosto", "Braço", "Almofada solta", "Chaise", "Saia / lateral", "Parte traseira", "Entre módulos", "Costura / acabamento", "Mecanismo", "Outro"] },
                        { id: "severity", type: "select", label: "Resultado", options: sharedResultOptions, required: true },
                        { id: "description", type: "textarea", label: "Descrição", required: true },
                        { id: "recommendation", type: "textarea", label: "Cuidados e recomendação" }
                    ]
                }
            },

            mattress_cleaning: {
                asset: {
                    id: "asset",
                    title: "Colchão atendido",
                    description: "Identifique tamanho, construção e faces do colchão antes da higienização.",
                    fields: [
                        { id: "identification", type: "text", label: "Identificação do colchão", placeholder: "Ex.: Colchão do quarto principal", required: true },
                        { id: "mattress_size", type: "select", label: "Tamanho", options: ["Solteiro", "Solteiro king", "Casal", "Queen", "King", "Infantil", "Sob medida", "Outro"], required: true },
                        { id: "mattress_type", type: "select", label: "Construção", options: ["Espuma", "Molas", "Molas ensacadas", "Látex", "Pillow top", "Não identificado", "Outro"] },
                        { id: "faces", type: "select", label: "Faces a higienizar", options: ["Uma face", "Duas faces", "Faces e laterais"] },
                        { id: "material", type: "select", label: "Tecido / revestimento", options: ["Malha", "Jacquard", "Poliéster", "Algodão", "Viscose", "Tecido misto", "Sintético", "Não identificado", "Outro"] },
                        { id: "stain_profile", type: "select", label: "Principal ocorrência percebida", options: ["Sem manchas aparentes", "Urina", "Sangue", "Suor / oleosidade corporal", "Mofo / umidade", "Bebida", "Mancha orgânica", "Origem não identificada", "Múltiplas ocorrências", "Outro"] },
                        { id: "odor_level", type: "select", label: "Odor", options: ["Sem odor perceptível", "Leve", "Moderado", "Forte", "Crítico / persistente"] },
                        { id: "quantity", type: "number", label: "Quantidade" },
                        { id: "location", type: "text", label: "Ambiente / endereço" },
                        { id: "notes", type: "textarea", label: "Detalhes específicos do colchão" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Avaliação inicial do colchão",
                    description: "Registre manchas, odor, umidade e condições relevantes antes da extração.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviço contratado", required: true },
                        { id: "soil_level", type: "select", label: "Nível de sujidade", options: ["Leve", "Moderado", "Pesado", "Crítico"], required: true },
                        { id: "initial_condition", type: "textarea", label: "Manchas, odor, umidade e condição inicial" },
                        { id: "customer_request", type: "textarea", label: "Histórico / prioridade informada pelo cliente" },
                        { id: "responsible", type: "text", label: "Responsável local" },
                        { id: "entry_date", type: "date", label: "Data do atendimento" },
                        { id: "confirmed", type: "checkbox", label: "Colchão conferido antes da higienização" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro técnico do colchão",
                    description: "Registre as ocorrências por face e região, preservando o histórico do tratamento.",
                    fields: [
                        { id: "title", type: "text", label: "Tipo da ocorrência", placeholder: "Ex.: Mancha de urina", required: true },
                        { id: "component", type: "select", label: "Região do colchão", options: ["Face superior", "Face inferior", "Lateral", "Cabeceira", "Peseira", "Costura / acabamento", "Outro"] },
                        { id: "severity", type: "select", label: "Resultado", options: sharedResultOptions, required: true },
                        { id: "description", type: "textarea", label: "Descrição", required: true },
                        { id: "recommendation", type: "textarea", label: "Secagem e recomendação" }
                    ]
                }
            },

            armchair_cleaning: {
                asset: {
                    id: "asset",
                    title: "Poltrona atendida",
                    description: "Caracterize a poltrona, seu revestimento e eventuais mecanismos.",
                    fields: [
                        { id: "identification", type: "text", label: "Identificação da poltrona", placeholder: "Ex.: Poltrona de leitura", required: true },
                        { id: "armchair_type", type: "select", label: "Tipo de poltrona", options: ["Fixa", "Reclinável", "Giratória", "Balanço", "Papai", "Decorativa", "Outro"], required: true },
                        { id: "material", type: "text", label: "Tecido / revestimento" },
                        { id: "color", type: "text", label: "Cor" },
                        { id: "mechanism_condition", type: "select", label: "Condição do mecanismo", options: ["Não possui", "Funcionando normalmente", "Com resistência", "Com folga", "Travado", "Não testado"] },
                        { id: "quantity", type: "number", label: "Quantidade" },
                        { id: "location", type: "text", label: "Ambiente / endereço" },
                        { id: "notes", type: "textarea", label: "Detalhes específicos da poltrona" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Avaliação inicial da poltrona",
                    description: "Registre sujidade, manchas, desgaste e estabilidade antes do serviço.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviço contratado", required: true },
                        { id: "soil_level", type: "select", label: "Nível de sujidade", options: ["Leve", "Moderado", "Pesado", "Crítico"], required: true },
                        { id: "initial_condition", type: "textarea", label: "Condição do tecido, braços, encosto e base" },
                        { id: "customer_request", type: "textarea", label: "Prioridades indicadas pelo cliente" },
                        { id: "responsible", type: "text", label: "Responsável local" },
                        { id: "entry_date", type: "date", label: "Data do atendimento" },
                        { id: "confirmed", type: "checkbox", label: "Poltrona conferida antes da higienização" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro técnico da poltrona",
                    description: "Registre ocorrências e resultados nas áreas específicas da poltrona.",
                    fields: [
                        { id: "title", type: "text", label: "Título do registro", required: true },
                        { id: "component", type: "select", label: "Região da poltrona", options: ["Assento", "Encosto", "Braço", "Apoio de cabeça", "Base", "Mecanismo", "Parte traseira", "Outro"] },
                        { id: "severity", type: "select", label: "Resultado", options: sharedResultOptions, required: true },
                        { id: "description", type: "textarea", label: "Descrição", required: true },
                        { id: "recommendation", type: "textarea", label: "Cuidados e recomendação" }
                    ]
                }
            },

            chair_cleaning: {
                asset: {
                    id: "asset",
                    title: "Cadeiras atendidas",
                    description: "Registre o lote, as áreas estofadas e a estrutura das cadeiras.",
                    fields: [
                        { id: "identification", type: "text", label: "Identificação / conjunto", placeholder: "Ex.: 8 cadeiras da sala de reunião", required: true },
                        { id: "chair_type", type: "select", label: "Tipo de cadeira", options: ["Jantar", "Escritório", "Auditório", "Recepção", "Decorativa", "Banqueta", "Outro"], required: true },
                        { id: "quantity", type: "number", label: "Quantidade de cadeiras", required: true },
                        { id: "upholstered_parts", type: "select", label: "Áreas estofadas", options: ["Somente assento", "Assento e encosto", "Assento, encosto e braços", "Integral", "Outro"] },
                        { id: "material", type: "text", label: "Tecido / revestimento" },
                        { id: "structure", type: "select", label: "Estrutura", options: ["Madeira", "Metal", "Plástico", "Mista", "Não identificada"] },
                        { id: "location", type: "text", label: "Ambiente / endereço" },
                        { id: "notes", type: "textarea", label: "Detalhes do lote" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Avaliação inicial das cadeiras",
                    description: "Avalie o conjunto e registre diferenças relevantes entre as unidades.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviço contratado", required: true },
                        { id: "soil_level", type: "select", label: "Nível predominante de sujidade", options: ["Leve", "Moderado", "Pesado", "Crítico", "Variável no lote"], required: true },
                        { id: "initial_condition", type: "textarea", label: "Condição do lote / diferenças entre cadeiras" },
                        { id: "customer_request", type: "textarea", label: "Prioridades indicadas pelo cliente" },
                        { id: "responsible", type: "text", label: "Responsável local" },
                        { id: "entry_date", type: "date", label: "Data do atendimento" },
                        { id: "confirmed", type: "checkbox", label: "Lote conferido antes da higienização" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro técnico das cadeiras",
                    description: "Registre uma unidade específica ou uma condição comum ao lote.",
                    fields: [
                        { id: "title", type: "text", label: "Título / cadeira ou grupo", required: true },
                        { id: "component", type: "select", label: "Região", options: ["Assento", "Encosto", "Braço", "Estrutura", "Base / pés", "Conjunto completo", "Outro"] },
                        { id: "severity", type: "select", label: "Resultado", options: sharedResultOptions, required: true },
                        { id: "description", type: "textarea", label: "Descrição", required: true },
                        { id: "recommendation", type: "textarea", label: "Cuidados e recomendação" }
                    ]
                }
            },

            auto_upholstery: {
                asset: {
                    id: "asset",
                    title: "Interior automotivo atendido",
                    description: "Identifique o veículo e defina exatamente quais áreas internas fazem parte do serviço.",
                    fields: [
                        { id: "identification", type: "text", label: "Veículo", placeholder: "Ex.: Chevrolet Onix", required: true },
                        { id: "plate", type: "text", label: "Placa" },
                        { id: "year_model", type: "text", label: "Ano / modelo" },
                        { id: "interior_scope", type: "select", label: "Escopo principal", options: ["Bancos", "Bancos e carpete", "Interior completo", "Banco individual", "Teto", "Porta-malas", "Outro"], required: true },
                        { id: "seat_material", type: "select", label: "Revestimento dos bancos", options: ["Tecido", "Couro", "Sintético", "Misto", "Outro"] },
                        { id: "seat_count", type: "number", label: "Quantidade de assentos" },
                        { id: "headliner_included", type: "select", label: "Teto incluído", options: ["Sim", "Não"] },
                        { id: "notes", type: "textarea", label: "Itens pessoais / detalhes do interior" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Avaliação inicial do interior",
                    description: "Registre sujeira, odor e pontos críticos antes da higienização automotiva.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviço contratado", required: true },
                        { id: "soil_level", type: "select", label: "Nível de sujidade interna", options: ["Leve", "Moderado", "Pesado", "Crítico"], required: true },
                        { id: "initial_condition", type: "textarea", label: "Bancos, carpete, teto, odores e condição inicial" },
                        { id: "customer_request", type: "textarea", label: "Prioridades indicadas pelo cliente" },
                        { id: "responsible", type: "text", label: "Responsável pelo veículo" },
                        { id: "entry_date", type: "date", label: "Data do atendimento" },
                        { id: "confirmed", type: "checkbox", label: "Interior conferido antes da higienização" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro técnico do interior",
                    description: "Registre ocorrências e resultados por área do veículo.",
                    fields: [
                        { id: "title", type: "text", label: "Título do registro", required: true },
                        { id: "component", type: "select", label: "Área do interior", options: ["Banco dianteiro esquerdo", "Banco dianteiro direito", "Banco traseiro", "Carpete", "Teto", "Porta-malas", "Painel / portas", "Cintos", "Outro"] },
                        { id: "severity", type: "select", label: "Resultado", options: sharedResultOptions, required: true },
                        { id: "description", type: "textarea", label: "Descrição", required: true },
                        { id: "recommendation", type: "textarea", label: "Cuidados e recomendação" }
                    ]
                }
            },

            carpet_cleaning: {
                asset: {
                    id: "asset",
                    title: "Tapete ou carpete atendido",
                    description: "Registre tipo, dimensões, material e forma de instalação para dimensionar o serviço.",
                    fields: [
                        { id: "identification", type: "text", label: "Identificação / ambiente", placeholder: "Ex.: Tapete da sala 2,00 x 3,00 m", required: true },
                        { id: "carpet_type", type: "select", label: "Tipo", options: ["Tapete solto", "Passadeira", "Carpete fixo", "Carpete em placa", "Capacho", "Outro"], required: true },
                        { id: "dimensions", type: "text", label: "Dimensões (L x C)" },
                        { id: "area_m2", type: "number", label: "Área aproximada (m²)" },
                        { id: "material", type: "text", label: "Material / fibra" },
                        { id: "fringe", type: "select", label: "Possui franjas", options: ["Não", "Sim", "Não se aplica"] },
                        { id: "quantity", type: "number", label: "Quantidade" },
                        { id: "location", type: "text", label: "Ambiente / endereço" },
                        { id: "notes", type: "textarea", label: "Detalhes específicos" }
                    ]
                },
                intake: {
                    id: "intake",
                    title: "Avaliação inicial do tapete/carpete",
                    description: "Registre tráfego, manchas, odor e limitações do local antes da limpeza.",
                    fields: [
                        { id: "reason", type: "textarea", label: "Serviço contratado", required: true },
                        { id: "traffic_level", type: "select", label: "Nível de tráfego", options: ["Baixo", "Moderado", "Alto", "Muito alto", "Não se aplica"] },
                        { id: "soil_level", type: "select", label: "Nível de sujidade", options: ["Leve", "Moderado", "Pesado", "Crítico"], required: true },
                        { id: "initial_condition", type: "textarea", label: "Manchas, odor, umidade e condição inicial" },
                        { id: "customer_request", type: "textarea", label: "Áreas críticas indicadas pelo cliente" },
                        { id: "responsible", type: "text", label: "Responsável local" },
                        { id: "entry_date", type: "date", label: "Data do atendimento" },
                        { id: "confirmed", type: "checkbox", label: "Área / peça conferida antes da limpeza" }
                    ]
                },
                occurrence: {
                    id: "occurrence",
                    title: "Registro técnico do tapete/carpete",
                    description: "Registre ocorrências por região ou ambiente e o resultado obtido.",
                    fields: [
                        { id: "title", type: "text", label: "Título do registro", required: true },
                        { id: "component", type: "select", label: "Região", options: ["Centro", "Borda", "Franja", "Área de alto tráfego", "Sob mobiliário", "Emenda / junção", "Área localizada", "Outro"] },
                        { id: "severity", type: "select", label: "Resultado", options: sharedResultOptions, required: true },
                        { id: "description", type: "textarea", label: "Descrição", required: true },
                        { id: "recommendation", type: "textarea", label: "Secagem e recomendação" }
                    ]
                }
            }
        };

        const protocol = protocols[serviceId];
        if (!protocol) {
            return;
        }

        this.schemaEngine.registerMany([
            protocol.asset,
            protocol.intake,
            protocol.occurrence
        ]);
    }

    _applyServiceWorkflowSteps(caseData = {}) {
        const serviceId = String(
            caseData && caseData.service && caseData.service.id || ""
        ).toLowerCase();

        const caseProfile = String(
            caseData && (caseData.profile_id || caseData.module_id) || this.profile || ""
        ).toLowerCase();

        if (!this.__auroraBaseSteps) {
            this.__auroraBaseSteps = this._clone(
                this.steps && this.steps.length
                    ? this.steps
                    : this._defaultSteps()
            );
        }

        let steps = this._clone(this.__auroraBaseSteps);

        if (caseProfile === "grounding_equipotentialization" || serviceId === "grounding_equipotentialization") {
            /* V43 — contrato canônico completo do Grounding. AppShell,
             * ViewManager e FooterNavigation passam a controlar todas as
             * etapas; a shape fornece somente os controllers especializados. */
            steps = [
                { id: "customer", label: "Cliente", icon: "👤", controller: "customer" },
                { id: "grounding_identification", label: "Identificação", icon: "📋", controller: "grounding_identification" },
                { id: "grounding_method", label: "Sistema / metodologia", icon: "⚙", controller: "grounding_method" },
                { id: "grounding_occurrences", label: "Ocorrências", icon: "📷", controller: "grounding_occurrences" },
                { id: "grounding_conclusion", label: "Conclusão", icon: "✓", controller: "grounding_conclusion" },
                { id: "grounding_report", label: "Relatório", icon: "📄", controller: "grounding_report" }
            ];
            this.schemaEngine.register({
                id: "customer",
                title: "Cliente",
                description: "Identifique quem solicitou o atendimento.",
                fields: [
                    { id: "name", type: "text", label: "Nome ou razão social", required: true },
                    { id: "document", type: "text", label: "CNPJ" },
                    { id: "address", type: "text", label: "Endereço", placeholder: "Rua, número, bairro, cidade / UF" },
                    { id: "phone", type: "phone", label: "Telefone" },
                    { id: "email", type: "email", label: "E-mail" },
                    { id: "person_type", type: "select", label: "Tipo de cliente", options: ["Pessoa Física", "Empresa", "Condomínio"] }
                ]
            });
        } else if (
            caseProfile === "upholstery_cleaning" &&
            serviceId === "sofa_cleaning"
        ) {
            steps = steps
                .filter((step) => step.id !== "intake")
                .map((step) => {
                    if (step.id === "asset") {
                        return {
                            ...step,
                            label: "Sofá atendido"
                        };
                    }

                    if (step.id === "evidence") {
                        return {
                            ...step,
                            label: "Registros / evidências"
                        };
                    }

                    return step;
                });

            this.schemaEngine.register({
                id: "customer",
                title: "Cliente",
                description: "Identifique quem solicitou o atendimento.",
                fields: [
                    {
                        id: "name",
                        type: "text",
                        label: "Nome ou razão social",
                        required: true
                    },
                    {
                        id: "address",
                        type: "text",
                        label: "Endereço do cliente",
                        placeholder: "Rua, número, bairro, cidade",
                        required: true
                    },
                    {
                        id: "phone",
                        type: "phone",
                        label: "Telefone"
                    },
                    {
                        id: "email",
                        type: "email",
                        label: "E-mail"
                    },
                    {
                        id: "person_type",
                        type: "select",
                        label: "Tipo de cliente",
                        options: [
                            "Pessoa Física",
                            "Empresa",
                            "Condomínio"
                        ]
                    }
                ]
            });
        } else {
            this.schemaEngine.register({
                id: "customer",
                title: "Cliente",
                description: "Identifique quem solicitou o atendimento.",
                fields: [
                    {
                        id: "name",
                        type: "text",
                        label: "Nome ou razão social",
                        required: true
                    },
                    {
                        id: "phone",
                        type: "phone",
                        label: "Telefone"
                    },
                    {
                        id: "email",
                        type: "email",
                        label: "E-mail"
                    },
                    {
                        id: "person_type",
                        type: "select",
                        label: "Tipo de cliente",
                        options: [
                            "Pessoa Física",
                            "Empresa",
                            "Condomínio"
                        ]
                    }
                ]
            });
        }

        const commercialBudgetExcluded =
            serviceId === "vehicle_inspection" ||
            serviceId === "eletrica_tupy" ||
            serviceId === "grounding_equipotentialization" ||
            caseProfile === "grounding_equipotentialization" ||
            caseProfile === "condominiums" ||
            caseProfile === "tupy";

        if (!commercialBudgetExcluded) {
            const hasBudget = steps.some((step) => step && step.id === "budget");
            if (!hasBudget) {
                const diagnosticIndex = steps.findIndex((step) => step && step.id === "diagnostic");
                const budgetStep = {
                    id: "budget",
                    controller: "budget",
                    label: "Orçamento / serviços",
                    icon: "R$"
                };
                if (diagnosticIndex >= 0) steps.splice(diagnosticIndex + 1, 0, budgetStep);
                else steps.push(budgetStep);
            }
        } else {
            steps = steps.filter((step) => !(step && step.id === "budget"));
        }

        if (caseProfile === "electrical" && serviceId === "eletrica_tupy") {
            /* Dados → Atividades → Materiais → Fotos → Códigos → Conclusão.
               Execução (occurrence) existia só para Planejado×Utilizado e foi removida. */
            const tupyLabels = {
                customer: "Dados do serviço",
                asset: "Atividades",
                intake: "Materiais",
                evidence: "Fotos",
                aet_service_codes: "Códigos dos trabalhos",
                diagnostic: "Conclusão"
            };
            steps = steps
                .filter((step) => step.id !== "occurrence")
                .map((step) => ({
                    ...step,
                    label: tupyLabels[step.id] || step.label
                }));
            /* USER: etapa Códigos (grid compartilhado). ADMIN review usa aet_admin_codes. */
            if (!(caseData && caseData.admin_review === true)) {
                const hasUserCodes = steps.some((step) => step && step.id === "aet_service_codes");
                if (!hasUserCodes) {
                    const diagIdx = steps.findIndex((step) => step && step.id === "diagnostic");
                    const codesStep = {
                        id: "aet_service_codes",
                        label: "Códigos dos trabalhos",
                        controller: "aet_service_codes",
                        icon: "tag"
                    };
                    if (diagIdx >= 0) steps.splice(diagIdx, 0, codesStep);
                    else steps.push(codesStep);
                }
                const aet = global.AuroraEletricaTupy;
                const userVistoria =
                    aet &&
                    typeof aet.isUserBoltVistoriaFlow === "function" &&
                    aet.isUserBoltVistoriaFlow(caseData);
                if (userVistoria) {
                    /* USER TUPY = 5 etapas:
                       Dados → Atividades → Materiais → Fotos → Códigos.
                       A antiga Conclusão sai; Códigos permanece como etapa final. */
                    steps = steps.filter((step) => !(
                        step && step.id === "diagnostic"
                    ));
                }
            } else {
                steps = steps.filter((step) => !(step && step.id === "aet_service_codes"));
            }
        }

        this.steps = steps;

        if (
            this.started &&
            this.shell &&
            typeof this.shell.setNavigationItems === "function"
        ) {
            const activeStep =
                this.steps[this.currentIndex] ||
                this.steps[0];

            this.shell.setNavigationItems(
                this.steps.map((step) => ({
                    id: step.id,
                    label: step.label,
                    icon: step.icon
                })),
                activeStep ? activeStep.id : null
            );
        }

        if (
            this.currentIndex >= this.steps.length
        ) {
            this.currentIndex = Math.max(
                this.steps.length - 1,
                0
            );
        }
    }

    _profileDefinition() {
        const definitions = {
            workshop: {
                subtitle:
                    "Oficina mecânica · Atendimento",
                asset_label:
                    "Veículo",
                asset_title:
                    "Veículo",
                asset_description:
                    "Identifique o veículo que será atendido.",
                asset_identification_label:
                    "Veículo",
                asset_identification_placeholder:
                    "Ex.: Honda Civic 2020"
            },

            grounding_equipotentialization: {
                subtitle:
                    "Aterramento e Equipotencialização · Atendimento",
                asset_label:
                    "Sistema de aterramento",
                asset_title:
                    "Sistema de aterramento",
                asset_description:
                    "Identifique a instalação ou sistema de aterramento inspecionado.",
                asset_identification_label:
                    "Instalação",
                asset_identification_placeholder:
                    "Ex.: Malha de aterramento da unidade"
            },

            electrical: {
                subtitle:
                    "Serviços elétricos · Atendimento",
                asset_label:
                    "Ativo elétrico",
                asset_title:
                    "Ativo elétrico",
                asset_description:
                    "Identifique o painel, motor, instalação ou equipamento inspecionado.",
                asset_identification_label:
                    "Equipamento",
                asset_identification_placeholder:
                    "Ex.: Painel QGBT-01"
            },

            industrial: {
                subtitle:
                    "Inspeção industrial · Atendimento",
                asset_label:
                    "Ativo industrial",
                asset_title:
                    "Ativo industrial",
                asset_description:
                    "Identifique a máquina, estrutura ou equipamento industrial.",
                asset_identification_label:
                    "Equipamento",
                asset_identification_placeholder:
                    "Ex.: Bomba B-101"
            },

            car_wash: {
                subtitle:
                    "Lavação automotiva · Atendimento",
                asset_label:
                    "Veículo",
                asset_title:
                    "Veículo atendido",
                asset_description:
                    "Identifique o veículo que receberá a lavação ou o detalhamento.",
                asset_identification_label:
                    "Veículo",
                asset_identification_placeholder:
                    "Ex.: Honda Civic 2020"
            },

            upholstery_cleaning: {
                subtitle:
                    "Sofás e estofados · Atendimento",
                asset_label:
                    "Estofado",
                asset_title:
                    "Estofado atendido",
                asset_description:
                    "Identifique o sofá, colchão, poltrona ou outro estofado atendido.",
                asset_identification_label:
                    "Estofado",
                asset_identification_placeholder:
                    "Ex.: Sofá retrátil da sala"
            },

            curtains_blinds: {
                subtitle:
                    "Cortinas e persianas · Atendimento",
                asset_label:
                    "Cortina ou persiana",
                asset_title:
                    "Cortina ou persiana atendida",
                asset_description:
                    "Identifique a cortina, persiana e o ambiente do atendimento.",
                asset_identification_label:
                    "Item atendido",
                asset_identification_placeholder:
                    "Ex.: Cortina da sala principal"
            },

            repairs_maintenance: {
                subtitle:
                    "Reparos e manutenção · Atendimento",
                asset_label:
                    "Local do serviço",
                asset_title:
                    "Local do serviço",
                asset_description:
                    "Identifique o imóvel, o ambiente e o ponto onde o serviço será realizado.",
                asset_identification_label:
                    "Local ou identificação do serviço",
                asset_identification_placeholder:
                    "Ex.: Janela do quarto principal"
            },

            condominiums: {
                subtitle:
                    "Condomínios · Inspeção predial",
                asset_label:
                    "Área / sistema",
                asset_title:
                    "Área ou sistema inspecionado",
                asset_description:
                    "Identifique o local, bloco, pavimento ou sistema que será inspecionado.",
                asset_identification_label:
                    "Local / identificação",
                asset_identification_placeholder:
                    "Ex.: Bloco A · térreo"
            },

            drone: {
                subtitle:
                    "Inspeção aérea · Atendimento",
                asset_label:
                    "Local inspecionado",
                asset_title:
                    "Local inspecionado",
                asset_description:
                    "Identifique a edificação, área ou estrutura do levantamento aéreo.",
                asset_identification_label:
                    "Local ou estrutura",
                asset_identification_placeholder:
                    "Ex.: Cobertura do galpão principal"
            }
        };

        return (
            definitions[this.profile] ||
            definitions.workshop
        );
    }

    _clone(value) {
        if (value === undefined) {
            return undefined;
        }

        return JSON.parse(
            JSON.stringify(value)
        );
    }

    _defaultSteps() {
        const profile =
            this._profileDefinition();

        return [
            {
                id:
                    "customer",
                controller:
                    "customer",
                label:
                    "Cliente",
                icon:
                    "👤"
            },
            {
                id:
                    "asset",
                controller:
                    "asset",
                label:
                    profile.asset_label,
                icon:
                    this.profile === "workshop"
                        ? "🚗"
                        : "▦"
            },
            {
                id:
                    "intake",
                controller:
                    "intake",
                label:
                    "Dados iniciais",
                icon:
                    "↳"
            },
            {
                id:
                    "evidence",
                controller:
                    "evidence",
                label:
                    "Ocorrências",
                icon:
                    "▧"
            },
            {
                id:
                    "diagnostic",
                controller:
                    "diagnostic",
                label:
                    "Diagnóstico e conclusão",
                icon:
                    "✓"
            }
        ];
    }
}

global.AuroraRuntime =
    AuroraRuntime;

})(window);

(function (global) {
"use strict";

class ReportPreview {
    constructor(options = {}) {
        if (!options.engine) {
            throw new Error(
                "ReportPreview requires a ReportEngine."
            );
        }

        this.engine =
            options.engine;

        this.modal =
            null;

        this.currentReportId =
            null;

        this.onNotify =
            typeof options.onNotify === "function"
                ? options.onNotify
                : () => {};

        this._htmlShareCache = null;
        this._htmlSharePrepareToken = 0;
        this._htmlShareClickGuard = false;
        this._htmlShareActivationLog = null;
        this._pdfShareCache = null;
        this._pdfShareClickGuard = false;
        this._previewReadyPromise = null;
        this._previewCycleStats = null;
    }

    _vehicleColorLabel(value) {
        const raw =
            String(value || "").trim();

        if (!raw) {
            return "";
        }

        const colors = {
            white: "Branco",
            black: "Preto",
            silver: "Prata",
            gray: "Cinza",
            grey: "Cinza",
            red: "Vermelho",
            blue: "Azul"
        };

        return colors[raw.toLowerCase()] || raw;
    }

    _normalizeChecklistStatus(value) {
        const normalized = String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

        if (!normalized || /nao verificado|não verificado|pendente|sem registro/.test(normalized)) {
            return "unknown";
        }

        if (/reparo|reparar|defeito|falha|substitu/.test(normalized)) {
            return "repair";
        }

        if (/atencao|atenção|alerta|cuidado|observ/.test(normalized)) {
            return "attention";
        }

        if (/^ok|regular|conforme|aprovado|normal/.test(normalized)) {
            return "ok";
        }

        return "unknown";
    }

    _fact(value, label) {
        return [
            '<div class="aurora-report-fact">',
            `<strong class="aurora-report-fact__value">${this._escape(value || "Não informado")}</strong>`,
            `<span class="aurora-report-fact__label">${this._escape(label)}</span>`,
            '</div>'
        ].join("");
    }

    _specCell(label, value) {
        return [
            '<div class="aurora-report-spec-cell">',
            `<span class="aurora-report-spec-cell__label">${this._escape(label)}</span>`,
            `<strong class="aurora-report-spec-cell__value">${this._escape(value || "Não informado")}</strong>`,
            '</div>'
        ].join("");
    }

    _specCellOptional(label, value) {
        const normalized = String(value || "").trim();

        if (!normalized) {
            return "";
        }

        return this._specCell(label, normalized);
    }

    _formatContractedServices(asset = {}, intake = {}) {
        const raw = String(
            asset.contracted_services ||
            intake.reason ||
            ""
        ).trim();

        if (!raw) {
            return "";
        }

        return raw
            .split(/\s{2,}|[.;•·—–]+\s*|\n+/g)
            .map((item) => item.trim())
            .filter(Boolean)
            .join(" · ");
    }

    _formatServiceDate(asset = {}, intake = {}) {
        return String(
            asset.entry_date ||
            intake.entry_date ||
            intake.inspection_date ||
            ""
        ).trim();
    }

    _technicalDetailsConfig(profileId, serviceId) {
        const resolver =
            global.AURORA_REPORT_TECHNICAL_DETAILS &&
            global.AURORA_REPORT_TECHNICAL_DETAILS.resolveTechnicalDetailsConfig;

        if (typeof resolver === "function") {
            return resolver(profileId, serviceId);
        }

        return null;
    }

    _readContextPath(context, path) {
        const parts = String(path || "").split(".");
        let current = context;

        for (const part of parts) {
            if (!current || typeof current !== "object") {
                return "";
            }

            current = current[part];
        }

        if (current === undefined || current === null) {
            return "";
        }

        return current;
    }

    _resolveTechnicalFieldValue(field, context = {}) {
        const asset = context.asset || {};
        const intake = context.intake || {};

        if (field.computed === "contracted_services") {
            return this._formatContractedServices(asset, intake);
        }

        if (field.computed === "entry_date") {
            return this._formatServiceDate(asset, intake);
        }

        if (!field.path) {
            return "";
        }

        let value = this._readContextPath(context, field.path);

        if (field.format === "vehicle_color") {
            value = this._vehicleColorLabel(value);
        } else if (field.format === "mileage") {
            value = this._formatVehicleMileage(value);
        } else if (field.format === "date") {
            value = this._formatServiceDate(
                field.path.startsWith("asset.") ? asset : {},
                field.path.startsWith("intake.") ? intake : intake
            ) || String(value || "").trim();
        }

        return String(value == null ? "" : value).trim();
    }

    _factOptional(value, label) {
        const normalized = String(value || "").trim();

        if (!normalized) {
            return "";
        }

        return this._fact(normalized, label);
    }

    _renderReportIdentification(customer = {}, company = {}, asset = {}) {
        const config =
            global.AURORA_REPORT_TECHNICAL_DETAILS ||
            {};
        const fields =
            Array.isArray(config.REPORT_IDENTIFICATION_FIELDS)
                ? config.REPORT_IDENTIFICATION_FIELDS
                : [];
        const context = {
            customer,
            company,
            asset
        };
        const cells = fields.map((field) => {
            let value = "";

            (field.paths || []).some((path) => {
                const candidate = String(
                    this._readContextPath(context, path) || ""
                ).trim();

                if (candidate) {
                    value = candidate;
                    return true;
                }

                return false;
            });

            if (!value && field.alwaysShow) {
                return this._fact(
                    value || "Não informado",
                    field.label
                );
            }

            return this._factOptional(value, field.label);
        }).filter(Boolean);

        if (!cells.length) {
            return "";
        }

        const rows = [];

        for (let index = 0; index < cells.length; index += 2) {
            rows.push(
                `<div class="aurora-report-fact-sheet__row">${cells.slice(index, index + 2).join("")}</div>`
            );
        }

        return this._section(
            "Identificação",
            `<div class="aurora-report-fact-sheet aurora-report-fact-sheet--identity">${rows.join("")}</div>`,
            "identity"
        );
    }

    _resolveCoverPhoto(report = {}) {
        const raw =
            report.coverPhoto ||
            report.cover_photo ||
            null;

        if (!raw || typeof raw !== "object") {
            return null;
        }

        const src = String(
            raw.src ||
            raw.url ||
            raw.href ||
            ""
        ).trim();

        if (!src) {
            return null;
        }

        return {
            src,
            alt: String(raw.alt || raw.description || "").trim(),
            width: Number(raw.width) > 0 ? Number(raw.width) : null,
            height: Number(raw.height) > 0 ? Number(raw.height) : null
        };
    }

    _resolveReportCompany(report) {
        const snapshot =
            (report && report.company) || {};

        const liveIdentity =
            this.engine &&
            typeof this.engine.companyProvider === "function"
                ? this.engine.companyProvider() || {}
                : {};

        if (
            global.AuroraReportCompanyIdentity &&
            typeof global.AuroraReportCompanyIdentity.mergeCompany ===
                "function"
        ) {
            return global.AuroraReportCompanyIdentity.mergeCompany(
                liveIdentity,
                snapshot
            );
        }

        return Object.assign({}, snapshot);
    }

    _resolveVehicleInspectionResponsible(intake, company, reportOrCase) {
        if (
            global.AuroraReportCompanyIdentity &&
            typeof global.AuroraReportCompanyIdentity
                .resolveVehicleInspectionResponsible === "function"
        ) {
            return global.AuroraReportCompanyIdentity
                .resolveVehicleInspectionResponsible(
                    intake,
                    company,
                    reportOrCase
                );
        }

        const snapshot =
            reportOrCase &&
            reportOrCase.snapshot &&
            typeof reportOrCase.snapshot === "object"
                ? reportOrCase.snapshot
                : null;

        return String(
            (reportOrCase && reportOrCase.performed_by_name) ||
            (snapshot && snapshot.performed_by_name) ||
            (intake && intake.responsible) ||
            ""
        ).trim();
    }

    _buildCoverPhotoImgTag(
        coverPhoto,
        altText
    ) {
        const width =
            Number(
                coverPhoto &&
                coverPhoto.width
            );
        const height =
            Number(
                coverPhoto &&
                coverPhoto.height
            );
        const attrs =
            [];

        if (
            width > 0 &&
            height > 0
        ) {
            attrs.push(
                `width="${width}"`,
                `height="${height}"`,
                `data-cover-aspect="${(
                    width /
                    height
                ).toFixed(4)}"`
            );
        }

        return [
            `<img src="${this._escapeAttribute(coverPhoto.src)}"`,
            `alt="${this._escapeAttribute(altText)}"`,
            attrs.join(" "),
            ">"
        ].join(" ");
    }

    _classifyCoverPhotoAspect(
        ratio
    ) {
        if (ratio >= 1.85) {
            return "ultrawide";
        }

        if (ratio >= 1.15) {
            return "landscape";
        }

        if (ratio >= 0.85) {
            return "square";
        }

        return "portrait";
    }

    _applyCoverPhotoLayouts(
        root
    ) {
        if (!root) {
            return;
        }

        root
            .querySelectorAll(
                ".aurora-report-cover__photo"
            )
            .forEach(
                (figure) => {
                    const img =
                        figure.querySelector(
                            "img"
                        );

                    if (!img) {
                        return;
                    }

                    const sync =
                        () => {
                            const width =
                                img.naturalWidth ||
                                Number(
                                    img.getAttribute(
                                        "width"
                                    )
                                ) ||
                                0;
                            const height =
                                img.naturalHeight ||
                                Number(
                                    img.getAttribute(
                                        "height"
                                    )
                                ) ||
                                0;

                            if (
                                !(
                                    width >
                                        0 &&
                                    height >
                                        0
                                )
                            ) {
                                return;
                            }

                            const ratio =
                                width /
                                height;

                            figure.style.setProperty(
                                "--aurora-cover-aspect-ratio",
                                String(
                                    ratio
                                )
                            );
                            figure.dataset.coverOrientation =
                                this._classifyCoverPhotoAspect(
                                    ratio
                                );
                        };

                    if (
                        img.complete
                    ) {
                        sync();
                    } else {
                        img.addEventListener(
                            "load",
                            sync,
                            {
                                once:
                                    true
                            }
                        );
                    }
                }
            );
    }

    _photoDimensionAttrs(photo) {
        const width = Number(photo && photo.width);
        const height = Number(photo && photo.height);

        if (width > 0 && height > 0) {
            return ` width="${width}" height="${height}"`;
        }

        return "";
    }

    _isInternalReportAsset(
        src,
        photo
    ) {
        if (
            this.engine &&
            typeof this.engine._isInternalReportAsset ===
                "function"
        ) {
            return this.engine._isInternalReportAsset(
                src,
                photo
            );
        }

        const source =
            String(src || "")
                .trim()
                .toLowerCase();

        return (
            !source ||
            /orientacoes[_-]?avarias/i.test(source) ||
            /\/guided-photos\/[^/?#]*_ui\./i.test(source)
        );
    }

    _filterReportEvidencePhotos(photos = []) {
        return (
            Array.isArray(photos)
                ? photos.filter(Boolean).filter((photo) => {
                    const src =
                        photo.edited_src ||
                        photo.editedSrc ||
                        photo.src ||
                        photo.url ||
                        "";

                    return !this._isInternalReportAsset(
                        src,
                        photo
                    );
                })
                : []
        );
    }

    _renderReportCover(
        company = {},
        reportTitle = "",
        operationLabel = "",
        coverPhoto = null,
        coverOptions = {}
    ) {
        const isVehicleInspection = coverOptions.isVehicleInspection === true;
        const tagline = String(company.tagline || "").trim();
        const hasLogo = Boolean(company.logo);
        const hasCoverPhoto = Boolean(
            coverPhoto &&
            coverPhoto.src
        );
        const titleSizeClass = String(
            coverOptions.reportTitleSizeClass ||
            this._reportTitleSizeClass("Normal")
        ).trim();
        const titleSizeKey = this._normalizeReportTitleSize(
            coverOptions.reportTitleSize || "Normal"
        );

        const logoScale = Math.max(200, Math.min(300, Number(company.logo_report_scale) || 200));
        const coverPhotoScale = Math.max(150, Math.min(250, Number(company.cover_photo_report_scale) || 150));
        const logoBlock = hasLogo
            ? [
                `<figure class="aurora-report-cover__logo-slot" style="--aurora-report-logo-scale:${logoScale / 100}">`,
                `<img class="aurora-report-brand__logo" src="${this._escapeAttribute(company.logo)}" alt="Logo da empresa">`,
                '</figure>'
            ].join("")
            : "";

        /* Identidade única em todos os relatórios: logo à esquerda do nome. */
        const brandText = [
            '<div class="aurora-report-brand aurora-report-brand--text-only aurora-report-brand--cover">',
            logoBlock,
            '<div class="aurora-report-brand__text">',
            `<strong class="aurora-report-brand__name">${this._escape(company.name || "AURORA")}</strong>`,
            tagline
                ? `<small class="aurora-report-brand__tagline">${this._escape(tagline)}</small>`
                : "",
            '</div>',
            '</div>'
        ].join("");

        const configurableTitle = String(reportTitle || "").trim();
        const orderNumbers = Array.isArray(coverOptions.orderNumbers)
            ? coverOptions.orderNumbers.map((value) => String(value || "").trim()).filter(Boolean)
            : [];
        const adminReportNumber = String(coverOptions.adminReportNumber || "").trim();
        const adminMetaBlock = (orderNumbers.length || adminReportNumber)
            ? [
                '<div class="aurora-report-cover__admin-meta">',
                orderNumbers.length
                    ? `<div class="aurora-report-cover__orders"><span>Pedido${orderNumbers.length > 1 ? "s" : ""}</span><strong>${orderNumbers.map((value) => this._escape(value)).join(" · ")}</strong></div>`
                    : "",
                adminReportNumber
                    ? `<div class="aurora-report-cover__report-number"><span>Relatório</span><strong>${this._escape(adminReportNumber)}</strong></div>`
                    : "",
                '</div>'
            ].join("")
            : "";
        const headerBlock = [
            '<div class="aurora-report-cover__header">',
            brandText,
            adminMetaBlock,
            '</div>'
        ].join("");

        const technicalDescription = String(
            coverOptions.technicalDescription ||
            `${operationLabel || "Registro técnico em campo"}, evidências fotográficas, resumo técnico e finalização.`
        ).trim();
        const contentBlock = isVehicleInspection
            ? [
                '<div class="aurora-report-cover__content">',
                '<h1>RELATÓRIO DE VISTORIA VEICULAR</h1>',
                configurableTitle
                    ? `<p class="aurora-report-cover__subtitle ${titleSizeClass}" data-report-title-size="${this._escapeAttribute(titleSizeKey)}">${this._escape(configurableTitle)}</p>`
                    : "",
                '</div>'
            ].join("")
            : [
                '<div class="aurora-report-cover__content">',
                '<span class="aurora-report-cover__kicker">Documento técnico</span>',
                `<h1>${this._escape(reportTitle)}</h1>`,
                `<p>${this._escape(technicalDescription)}</p>`,
                '</div>'
            ].join("");

        const coverClasses = [
            "aurora-report-cover",
            isVehicleInspection ? "aurora-report-cover--refined" : "",
            hasCoverPhoto ? "aurora-report-cover--with-photo" : "",
            hasCoverPhoto && coverPhotoScale >= 140 ? "aurora-report-cover--photo-large" : "",
            hasLogo ? "aurora-report-cover--with-logo" : ""
        ]
            .filter(Boolean)
            .join(" ");

        if (!hasCoverPhoto) {
            return [
                `<section class="${coverClasses}">`,
                headerBlock,
                contentBlock,
                '</section>'
            ].join("");
        }

        const altText =
            coverPhoto.alt ||
            company.name ||
            "Foto principal do relatório";

        return [
            `<section class="${coverClasses}" style="--aurora-cover-photo-scale:${coverPhotoScale / 100}">`,
            headerBlock,
            '<div class="aurora-report-cover__layout">',
            contentBlock,
            '<figure class="aurora-report-cover__photo">',
            this._buildCoverPhotoImgTag(
                coverPhoto,
                altText
            ),
            '</figure>',
            '</div>',
            '</section>'
        ].join("");
    }

    _isUniversalGenericReport(profileId, serviceId) {
        const profile = String(profileId || "").toLowerCase();
        const service = String(serviceId || "").toLowerCase();
        return service !== "vehicle_inspection" &&
            service !== "eletrica_tupy" &&
            profile !== "tupy";
    }

    _universalReportLabel(key, section, context = {}) {
        const id = String(key || "").trim();
        const common = {
            identification:"Identificação", plate:"Placa", year_model:"Ano / modelo", color:"Cor", mileage:"Quilometragem",
            notes:"Observações", asset_type:"Categoria", tag:"TAG / identificação", location:"Localização", address:"Endereço",
            manufacturer:"Fabricante", model:"Modelo", sector:"Setor / área", operating_status:"Condição operacional",
            reason:"Objetivo da inspeção / serviço", service_condition:"Condição geral", responsible:"Responsável pelo acompanhamento",
            initial_condition:"Condição inicial observada", customer_request:"Solicitação do cliente / condomínio",
            title:"Título da ocorrência", component:"Item / componente / local", item:"Item / componente / local",
            anomaly_type:"Tipo de ocorrência", severity:"Gravidade", description:"Descrição da ocorrência",
            immediate_action:"Ação imediata", recommendation:"Recomendação / próxima ação",
            category:"Categoria", status:"Situação", priority:"Prioridade", deadline:"Prazo previsto",
            area_type:"Área / sistema", block:"Bloco / torre", floor:"Pavimento", conservation:"Conservação geral",
            accessibility:"Acessibilidade", cleanliness:"Limpeza e organização", signage:"Sinalização",
            condition:"Condição aparente", protection:"Proteções / fechamentos", leak:"Vazamento aparente",
            pressure:"Condição de abastecimento", moisture:"Umidade / infiltração", equipment:"Equipamento",
            operation:"Funcionamento", noise_vibration:"Ruído / vibração", panel_condition:"Painel / comando",
            structure:"Estrutura / fixação", safety:"Segurança aparente", validity:"Validade", access:"Acesso",
            width:"Largura", height:"Altura", quantity:"Quantidade", material:"Material / tecido",
            environment:"Ambiente", property_type:"Tipo de imóvel", access_conditions:"Acesso / cuidados",
            code:"Código", name:"Nome", type:"Tipo", asset_registry_id:"ID de registro do ativo", qr_token:"Token do QR Code",
            work_permit:"Permissão de trabalho", lockout:"Bloqueio de segurança", inspection_date:"Data da inspeção",
            due_date:"Data prevista", scheduled_date:"Data programada"
        };
        const serviceId = String(context.serviceId || "").toLowerCase();
        if (serviceId === "maintenance_occurrences" && section === "asset") {
            const maintenanceLabels = {
                category:"Categoria", location:"Local da ocorrência", status:"Situação", priority:"Prioridade",
                responsible:"Responsável / fornecedor", deadline:"Prazo previsto", notes:"Descrição da ocorrência / manutenção"
            };
            if (maintenanceLabels[id]) return maintenanceLabels[id];
        }
        if (common[id]) return common[id];

        if (section === "asset") {
            const cfg = this._technicalDetailsConfig(context.profileId || "", context.serviceId || "");
            if (cfg && Array.isArray(cfg.fields)) {
                const match = cfg.fields.find((field) => String(field.path || "") === `asset.${id}`);
                if (match && match.label) return match.label;
            }
        }

        return id.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    }

    _universalReportValue(value) {
        if (value === undefined || value === null) return "";
        if (Array.isArray(value)) return value.map((item) => this._universalReportValue(item)).filter(Boolean).join(" · ");
        if (typeof value === "boolean") return value ? "Sim" : "Não";
        if (typeof value === "object") return "";
        return String(value).trim();
    }

    _universalReportEntries(data, section, context = {}) {
        if (!data || typeof data !== "object" || Array.isArray(data)) return [];
        const ignored = new Set([
            "id","uuid","created_at","updated_at","deleted_at","saved_at","last_saved_at","synced_at","uploaded_at","downloaded_at",
            "row_version","version","revision","profile_id","module_id","service_id","company_id","user_id","created_by","updated_by",
            "photos","photo","images","evidence","evidences","attachments","custom","_meta","meta","metadata","ai","ai_fields","suggestions",
            "sync_status","sync_state","cloud_status","local_status","dirty","pending_sync","is_synced","storage_key","bucket","path",
            /* V36: identificadores internos do ativo continuam no estado, mas nunca são impressos no relatório ao cliente. */
            "code","asset_registry_id","qr_token"
        ]);
        const occurrenceAllowed = new Set([
            "title","description","severity","recommendation","item","component","anomaly_type","immediate_action",
            "category","location","status","priority","responsible","deadline","notes",
            "access","accessibility","cleanliness","signage","condition","protection","leak","pressure","moisture",
            "equipment","operation","noise_vibration","panel_condition","structure","safety","validity",
            "area_type","block","cabin","coating","conservation","cracks","doors","drainage","elevator","floor",
            "floor_condition","identification","leveling","lighting","panel","sector","tag"
        ]);
        return Object.entries(data).map(([key,value]) => {
            if (ignored.has(String(key).toLowerCase())) return null;
            const lowerKey = String(key).toLowerCase();
            /* Registros técnicos usam lista positiva: somente conteúdo profissional conhecido pode chegar ao documento. */
            if (section === "occurrence" && !occurrenceAllowed.has(lowerKey)) return null;
            if (lowerKey === "confirmed") return null;
            /* Campos auxiliares/defaults do estado-base não pertencem ao relatório quando não fazem parte da etapa exibida. */
            if (section === "intake" && lowerKey === "priority") return null;
            let normalized = this._universalReportValue(value);
            if (!normalized) return null;
            if (/^(deadline|date|due_date|scheduled_date|inspection_date)$/.test(lowerKey) && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
                const [year,month,day] = normalized.split("-");
                normalized = `${day}/${month}/${year}`;
            }
            return { label:this._universalReportLabel(key, section, context), value:normalized, key };
        }).filter(Boolean);
    }

    _renderUniversalDataSection(title, data, section, context = {}) {
        const entries = this._universalReportEntries(data, section, context);
        if (!entries.length) return "";
        const cells = entries.map((entry) => this._specCellOptional(entry.label, entry.value)).filter(Boolean);
        const rows = [];
        for (let index=0; index<cells.length; index+=3) {
            const slice=cells.slice(index,index+3);
            const rowClass=slice.length===1 ? "aurora-report-spec-sheet__row--1" : "aurora-report-spec-sheet__row--3";
            rows.push(`<div class="aurora-report-spec-sheet__row ${rowClass}">${slice.join("")}</div>`);
        }
        return this._section(title, `<div class="aurora-report-spec-sheet">${rows.join("")}</div>`, section === "intake" ? "conditions" : "technical");
    }

    _renderTechnicalDetailsSection(context = {}) {
        const profileId = context.profileId || "";
        const serviceId = context.serviceId || "";
        const config = this._technicalDetailsConfig(profileId, serviceId);

        if (
            !config ||
            config.renderer === "vehicle_inspection" ||
            !Array.isArray(config.fields)
        ) {
            return "";
        }

        const hideEmpty = config.hideEmpty !== false;
        const cells = config.fields.map((field) => {
            const value = this._resolveTechnicalFieldValue(field, context);

            if (hideEmpty) {
                return this._specCellOptional(field.label, value);
            }

            return this._specCell(
                field.label,
                value || "Não informado"
            );
        }).filter(Boolean);

        if (!cells.length) {
            return "";
        }

        const rows = [];

        for (let index = 0; index < cells.length; index += 3) {
            const slice = cells.slice(index, index + 3);
            const rowClass =
                slice.length === 1
                    ? "aurora-report-spec-sheet__row--1"
                    : "aurora-report-spec-sheet__row--3";

            rows.push(
                `<div class="aurora-report-spec-sheet__row ${rowClass}">${slice.join("")}</div>`
            );
        }

        return this._section(
            config.sectionTitle || "Detalhes técnicos",
            `<div class="aurora-report-spec-sheet">${rows.join("")}</div>`,
            "technical"
        );
    }

    _statusRow(label, value) {
        const status = this._normalizeChecklistStatus(value);
        const displayValue = String(value || "").trim() || "Não verificado";

        return [
            '<div class="aurora-report-status-row">',
            `<span class="aurora-report-status-row__label">${this._escape(label)}</span>`,
            `<span class="aurora-report-status-row__value" data-status="${this._escapeAttribute(status)}">`,
            '<i class="aurora-report-status-row__dot" aria-hidden="true"></i>',
            `<span>${this._escape(displayValue)}</span>`,
            '</span>',
            '</div>'
        ].join("");
    }

    _inlineValueList(items, fallback = "Não informado") {
        const values = Array.isArray(items)
            ? items.filter(Boolean)
            : String(items || "")
                .split(/[•·,;|]/)
                .map((item) => item.trim())
                .filter(Boolean);

        if (!values.length) {
            return this._escape(fallback);
        }

        return values.map((item) => this._escape(item)).join('<span class="aurora-report-inline-sep" aria-hidden="true"> · </span>');
    }

    _normalizeReportTitleSize(value) {
        const raw = String(value || "Normal").trim();
        const map = {
            Pequeno: "small",
            Normal: "normal",
            Grande: "large",
            small: "small",
            normal: "normal",
            large: "large"
        };

        return map[raw] || "normal";
    }

    _resolveReportTitleSize(approval) {
        return this._normalizeReportTitleSize(
            (approval && approval.report_title_size) || "Normal"
        );
    }

    _reportTitleSizeClass(size) {
        const normalized =
            this._normalizeReportTitleSize(size);

        return `aurora-report-cover__title-size--${normalized}`;
    }

    _resolveVehicleReportCoverTitle(report, approval, asset) {
        const fromApproval = String(
            (approval && approval.report_title) ||
            (report &&
                report.snapshot &&
                report.snapshot.approval &&
                report.snapshot.approval.report_title) ||
            ""
        ).trim();

        if (fromApproval) {
            return fromApproval;
        }

        const vehicleLabel = String(
            (asset && asset.identification) ||
            [
                asset && asset.brand,
                asset && asset.model
            ]
                .filter(Boolean)
                .join(" ") ||
            (asset && asset.plate) ||
            (asset && asset.vehicle) ||
            ""
        ).trim();

        return vehicleLabel || "Título do trabalho não informado";
    }

    _formatVehicleMileage(value) {
        const raw = String(value || "").trim();

        if (!raw) {
            return "Não informado";
        }

        if (/km/i.test(raw)) {
            return raw;
        }

        return `${raw} km`;
    }

    _renderVehicleInspectionIdentification(customer, asset, assetLabel, company) {
        const assetValue =
            asset.identification ||
            asset.vehicle ||
            asset.plate ||
            asset.tag ||
            asset.equipment ||
            "Não informado";

        const cells = [
            this._fact(
                customer.name || customer.company_name || "Não informado",
                "Cliente"
            ),
            this._fact(assetValue, assetLabel),
            this._fact(
                String(customer.person_type || "").trim() || "Não informado",
                "Tipo de cliente"
            ),
            this._fact(customer.phone || "Não informado", "Telefone"),
            this._factOptional(customer.email, "E-mail"),
            this._fact(
                company.professional || "Não informado",
                "Responsável técnico"
            )
        ].filter(Boolean);

        const rows = [];

        for (let index = 0; index < cells.length; index += 2) {
            rows.push(
                `<div class="aurora-report-fact-sheet__row">${cells.slice(index, index + 2).join("")}</div>`
            );
        }

        return this._section(
            "Identificação",
            [
                '<div class="aurora-report-fact-sheet aurora-report-fact-sheet--identity">',
                rows.join(""),
                '</div>'
            ].join(""),
            "identity"
        );
    }

    _renderVehicleInspectionSpec(asset) {
        return this._section(
            "Detalhes do veículo",
            [
                '<div class="aurora-report-spec-sheet">',
                '<div class="aurora-report-spec-sheet__row aurora-report-spec-sheet__row--3">',
                this._specCell("Placa", asset.plate || "Não informado"),
                this._specCell("Ano / modelo", asset.year_model || "Não informado"),
                this._specCell("Cor", this._vehicleColorLabel(asset.color) || "Não informado"),
                '</div>',
                '<div class="aurora-report-spec-sheet__row aurora-report-spec-sheet__row--3">',
                this._specCell("Quilometragem", this._formatVehicleMileage(asset.mileage)),
                this._specCell("Combustível", asset.fuel_level || "Não informado"),
                this._specCell("Estepe", asset.spare_tire || "Não verificado"),
                '</div>',
                '<div class="aurora-report-spec-sheet__row aurora-report-spec-sheet__row--1">',
                this._specCell("Nº da OS", asset.work_order || "Não informado"),
                '</div>',
                asset.notes
                    ? [
                        '<div class="aurora-report-spec-sheet__notes">',
                        '<span class="aurora-report-spec-sheet__notes-label">Observações</span>',
                        `<p>${this._escape(asset.notes)}</p>`,
                        '</div>'
                    ].join("")
                    : "",
                '</div>'
            ].join(""),
            "technical"
        );
    }

    _renderVehicleInspectionIntakeSummary(intake) {
        return this._section(
            "Serviços e itens recebidos",
            [
                '<div class="aurora-report-intake-summary">',
                '<div class="aurora-report-intake-summary__block">',
                '<span class="aurora-report-intake-summary__label">Serviços solicitados</span>',
                `<p class="aurora-report-intake-summary__value">${this._inlineValueList(intake.requested_services, intake.reason || "Não informado")}</p>`,
                '</div>',
                '<div class="aurora-report-intake-summary__block">',
                '<span class="aurora-report-intake-summary__label">Itens recebidos</span>',
                `<p class="aurora-report-intake-summary__value">${this._inlineValueList(intake.received_items, "Não informado")}</p>`,
                '</div>',
                '</div>'
            ].join(""),
            "intake-summary"
        );
    }

    _renderVehicleInspectionChecklist(intake, company, reportOrCase) {
        const inspectionResponsible =
            this._resolveVehicleInspectionResponsible(
                intake,
                company,
                reportOrCase
            );

        return this._section(
            "Checklist de recebimento",
            [
                '<div class="aurora-report-status-list">',
                this._statusRow("Iluminação externa", intake.internal_external),
                this._statusRow("Palhetas e para-brisa", intake.windshield),
                this._statusRow("Óleo, fluidos e níveis", intake.levels),
                this._statusRow("Sistema de freios", intake.brakes),
                this._statusRow("Pneus e rodas", intake.tires),
                this._statusRow("Suspensão e direção", intake.suspension_steering),
                this._statusRow("Bateria e sistema elétrico", intake.battery),
                this._statusRow("Itens de segurança", intake.safety_items),
                '</div>',
                (inspectionResponsible || intake.entry_date || intake.entry_time || intake.initial_condition)
                    ? [
                        '<div class="aurora-report-status-list__meta">',
                        inspectionResponsible
                            ? `<p><span>Responsável pela vistoria</span><strong>${this._escape(inspectionResponsible)}</strong></p>`
                            : "",
                        (intake.entry_date || intake.entry_time)
                            ? `<p><span>Entrada</span><strong>${this._escape([intake.entry_date, intake.entry_time].filter(Boolean).join(" · ") || "Não informado")}</strong></p>`
                            : "",
                        intake.initial_condition
                            ? `<p><span>Observações do checklist</span><strong>${this._escape(intake.initial_condition)}</strong></p>`
                            : "",
                        '</div>'
                    ].join("")
                    : ""
            ].join(""),
            "vehicle-checklist"
        );
    }

    _isUpholsteryPilotProfile(profileId, serviceId) {
        return String(profileId || "").toLowerCase() === "upholstery_cleaning" &&
            String(serviceId || "").toLowerCase() !== "vehicle_inspection";
    }

    _renderUpholsteryIdentification(customer, asset, assetLabel, company, serviceId = "") {
        return this._renderReportIdentification(customer, company, asset);
    }

    _renderUpholsterySpecSheet(asset, serviceId, upholsteryDetailFields, intake = {}, options = {}) {
        return this._renderTechnicalDetailsSection({
            asset,
            intake,
            serviceId,
            profileId: "upholstery_cleaning"
        });
    }

    _renderDescriptionMediaGallery(
        photos = [],
        options = {}
    ) {
        return this._renderUpholsteryMediaGallery(photos, options);
    }

    _renderUpholsteryMediaGallery(
        photos = [],
        options = {}
    ) {
        const items =
            Array.isArray(photos)
                ? photos.filter(Boolean)
                : [];

        if (!items.length) {
            return options.emptyHTML || "";
        }

        const count = items.length;
        const layout = this._mediaLayoutCountClass(count);

        return [
            `<div class="aurora-report-media aurora-report-photos aurora-report-media--${layout} aurora-report-media--editorial aurora-report-photos--${count === 1 ? "single" : "multiple"}" data-media-count="${count}">`,
            items.map((photo, photoIndex) => {
                const orientation = this._photoOrientation(photo);
                const caption = String(
                    photo && photo.description != null
                        ? photo.description
                        : ""
                ).trim();
                const altPrefix = String(options.altPrefix || "").trim();
                const alt = caption ||
                    (altPrefix
                        ? `${altPrefix} — foto ${photoIndex + 1}`
                        : `Foto ${photoIndex + 1}`);

                return [
                    `<figure class="aurora-report-media-item aurora-report-media-item--editorial${orientation !== "unknown" ? ` aurora-report-media-item--${this._escapeAttribute(orientation)}` : ""}">`,
                    `<div class="aurora-report-media-frame aurora-report-photo-frame"><img src="${this._escapeAttribute(photo.src)}" alt="${this._escapeAttribute(alt)}"></div>`,
                    caption
                        ? `<figcaption><span class="aurora-report-photo-caption">${this._escape(caption)}</span></figcaption>`
                        : "",
                    '</figure>'
                ].join("");
            }).join(""),
            '</div>'
        ].join("");
    }

    _renderTechnicalRecord(
        occurrence,
        index,
        options = {}
    ) {
        return this._renderUpholsteryOccurrence(
            occurrence,
            index,
            options
        );
    }

    _renderUpholsteryOccurrence(
        occurrence,
        index,
        options = {}
    ) {
        const photos =
            Array.isArray(occurrence && occurrence.photos)
                ? occurrence.photos
                : [];
        const showRecordLabels =
            this._activeReport ? this._activeReport.show_record_labels !== false : true;
        const showSeverity =
            this._activeReport ? this._activeReport.show_severity !== false : true;
        const severity = String(occurrence.severity || "").trim();
        const normalizedSeverity = severity.toLowerCase();
        const hasSeverity =
            showSeverity &&
            severity &&
            !normalizedSeverity.startsWith("sem gravidade");
        const title = String(occurrence.title || "").trim();
        const isAutomaticTitle = /^(registro|ocorrência)\s+\d+$/i.test(title);
        const visibleTitle =
            title && (showRecordLabels || !isAutomaticTitle)
                ? title
                : (title || "Registro fotográfico");
        const description = String(occurrence.description || "").trim();
        const item = String(occurrence.item || "").trim();
        const recommendation = String(occurrence.recommendation || "").trim();
        const occurrenceNumber = String(index + 1).padStart(2, "0");
        const occurrenceLabel = `Ocorrência ${occurrenceNumber}`;
        const genericContext = this._activeReport || {};
        const genericProfileId = String(genericContext.profile_id || (genericContext.snapshot && genericContext.snapshot.profile_id) || "").toLowerCase();
        const genericServiceId = String((genericContext.service && genericContext.service.id) || (genericContext.snapshot && genericContext.snapshot.service && genericContext.snapshot.service.id) || "").toLowerCase();
        const genericExtraEntries = this._isUniversalGenericReport(genericProfileId, genericServiceId)
            ? this._universalReportEntries(occurrence, "occurrence", { profileId:genericProfileId, serviceId:genericServiceId })
                .filter((entry) => !["title","description","severity","recommendation","item"].includes(String(entry.key)))
            : [];
        const genericExtraHTML = genericExtraEntries.length
            ? `<div class="aurora-report-spec-sheet">${genericExtraEntries.map((entry) => this._specCellOptional(entry.label, entry.value)).join("")}</div>`
            : "";
        const photosHTML = photos.length
            ? this._renderDescriptionMediaGallery(photos, {
                altPrefix: visibleTitle
            })
            : "";

        return [
            '<article class="aurora-report-occurrence aurora-report-record-card aurora-report-record-card--issue aurora-report-general-record-card">',
            '<header class="aurora-report-record-card__header aurora-report-occurrence__header">',
            showRecordLabels
                ? `<span class="aurora-report-record-card__label">${this._escape(occurrenceLabel)}</span>`
                : '<span></span>',
            hasSeverity
                ? `<b class="aurora-report-record-card__severity" data-severity="${this._escapeAttribute(normalizedSeverity)}">${this._escape(severity)}</b>`
                : "",
            '</header>',
            '<div class="aurora-report-record-card__body">',
            visibleTitle
                ? `<h3>${this._escape(visibleTitle)}</h3>`
                : "",
            item
                ? `<p class="aurora-report-record-card__meta">${this._escape(item)}</p>`
                : "",
            description
                ? `<p>${this._escape(description)}</p>`
                : "",
            genericExtraHTML,
            '</div>',
            photosHTML,
            recommendation
                ? `<div class="aurora-report-record-card__recommendation aurora-report-recommendation"><span>Recomendação</span><p>${this._escape(recommendation)}</p></div>`
                : "",
            '</article>'
        ].join("");
    }

    _mediaLayoutCountClass(count) {
        if (count <= 1) return "single";
        if (count === 2) return "duo";
        if (count === 3) return "trio";
        if (count === 4) return "quad";
        return "many";
    }

    _meaningfulSeverity(severity, type = "issue") {
        const normalized = String(severity || "").trim().toLowerCase();
        if (!normalized) return false;
        if (/^(não informada|nao informada|sem gravidade)/.test(normalized)) {
            return false;
        }
        if (type === "complementary") {
            return false;
        }
        return true;
    }

    _imageOrientation(image) {
        if (!image) return "landscape";
        const width = Number(image.naturalWidth || image.width || 0);
        const height = Number(image.naturalHeight || image.height || 0);
        if (width > 0 && height > 0) {
            if (height > width * 1.05) return "portrait";
            if (width > height * 1.05) return "landscape";
            return "square";
        }
        return "unknown";
    }

    _photoOrientation(photo) {
        const width = Number(photo && (photo.width || photo.naturalWidth) || 0);
        const height = Number(photo && (photo.height || photo.naturalHeight) || 0);
        if (width > 0 && height > 0) {
            if (height > width * 1.05) return "portrait";
            if (width > height * 1.05) return "landscape";
            return "square";
        }
        return "unknown";
    }

    async _waitDocumentImages(root) {
        if (!root) return;

        const images = Array.from(root.querySelectorAll("img"));

        await Promise.all(
            images.map((image) => {
                if (image.complete) {
                    return Promise.resolve();
                }

                return new Promise((resolve) => {
                    image.addEventListener("load", resolve, { once: true });
                    image.addEventListener("error", resolve, { once: true });
                });
            })
        );

        await new Promise((resolve) =>
            requestAnimationFrame(() =>
                requestAnimationFrame(resolve)
            )
        );
    }

    _applyGalleryLayout(gallery) {
        if (!gallery) return;

        const figures = Array.from(
            gallery.querySelectorAll(".aurora-report-media-item, figure")
        );
        const images = figures
            .map((figure) => figure.querySelector("img"))
            .filter(Boolean);
        const count = figures.length || Number(gallery.dataset.mediaCount || 0);

        if (!count) return;

        const layout = this._mediaLayoutCountClass(count);
        gallery.classList.remove(
            "aurora-report-media--single",
            "aurora-report-media--duo",
            "aurora-report-media--trio",
            "aurora-report-media--quad",
            "aurora-report-media--many",
            "aurora-report-media--portrait",
            "aurora-report-media--landscape",
            "aurora-report-media--mixed",
            "aurora-report-media--all-portrait",
            "aurora-report-photos--all-portrait",
            "aurora-report-photos--single",
            "aurora-report-photos--multiple"
        );
        gallery.classList.add(
            `aurora-report-media--${layout}`,
            count === 1 ? "aurora-report-photos--single" : "aurora-report-photos--multiple"
        );
        gallery.dataset.mediaCount = String(count);

        const orientations = images.map((image) =>
            this._imageOrientation(image)
        );
        const known = orientations.filter((value) => value !== "unknown");
        const allPortrait =
            known.length > 0 &&
            known.every((value) => value === "portrait" || value === "square");
        const allLandscape =
            known.length > 0 &&
            known.every((value) => value === "landscape" || value === "square");
        const mixed =
            known.length > 0 && !allPortrait && !allLandscape;

        gallery.classList.toggle("aurora-report-media--portrait", allPortrait);
        gallery.classList.toggle("aurora-report-media--landscape", allLandscape);
        gallery.classList.toggle("aurora-report-media--mixed", mixed);

        figures.forEach((figure, index) => {
            const orientation =
                orientations[index] && orientations[index] !== "unknown"
                    ? orientations[index]
                    : allPortrait
                        ? "portrait"
                        : "landscape";

            figure.classList.remove(
                "aurora-report-media-item--portrait",
                "aurora-report-media-item--landscape",
                "aurora-report-media-item--square",
                "aurora-report-media-item--unknown"
            );
            figure.classList.add(
                `aurora-report-media-item--${orientation}`
            );
        });
    }

    _applyVehiclePhotoGridLayout(grid) {
        if (!grid) return;

        const photos = Array.from(
            grid.querySelectorAll(".aurora-vehicle-photo")
        );
        const orientations = photos.map((photo) => {
            const image = photo.querySelector("img");
            return image ? this._imageOrientation(image) : "unknown";
        });
        const known = orientations.filter((value) => value !== "unknown");
        const allPortrait =
            known.length > 0 &&
            known.every((value) => value === "portrait" || value === "square");
        const allLandscape =
            known.length > 0 &&
            known.every((value) => value === "landscape" || value === "square");
        const mixed =
            known.length > 0 && !allPortrait && !allLandscape;

        grid.classList.remove(
            "aurora-vehicle-photo-grid--all-portrait",
            "aurora-vehicle-photo-grid--all-landscape",
            "aurora-vehicle-photo-grid--mixed"
        );
        grid.classList.toggle(
            "aurora-vehicle-photo-grid--all-portrait",
            allPortrait
        );
        grid.classList.toggle(
            "aurora-vehicle-photo-grid--all-landscape",
            allLandscape
        );
        grid.classList.toggle(
            "aurora-vehicle-photo-grid--mixed",
            mixed
        );

        photos.forEach((photo, index) => {
            const orientation =
                orientations[index] && orientations[index] !== "unknown"
                    ? orientations[index]
                    : allPortrait
                        ? "portrait"
                        : "landscape";

            photo.classList.remove(
                "aurora-vehicle-photo--portrait",
                "aurora-vehicle-photo--landscape",
                "aurora-vehicle-photo--square",
                "aurora-vehicle-photo--unknown"
            );
            photo.classList.add(`aurora-vehicle-photo--${orientation}`);
        });
    }

    _applyReportMediaLayouts(root) {
        if (!root) return;

        root.querySelectorAll(".aurora-report-media, .aurora-report-photos").forEach(
            (gallery) => this._applyGalleryLayout(gallery)
        );

        root.querySelectorAll(".aurora-vehicle-photo-grid").forEach((grid) =>
            this._applyVehiclePhotoGridLayout(grid)
        );

        this._applyCoverPhotoLayouts(root);
    }

    async _syncPreviewMediaLayouts(documentNode) {
        if (!documentNode) return;
        await this._waitDocumentImages(documentNode);
        this._applyReportMediaLayouts(documentNode);
    }

    _coverPhotoLayoutScript() {
        return `(function(){function classify(r){return r>=1.85?"ultrawide":r>=1.15?"landscape":r>=0.85?"square":"portrait";}function applyFigure(fig){var img=fig.querySelector("img");if(!img)return;var sync=function(){var w=img.naturalWidth||Number(img.getAttribute("width"))||0,h=img.naturalHeight||Number(img.getAttribute("height"))||0;if(!(w>0&&h>0))return;var ratio=w/h;fig.style.setProperty("--aurora-cover-aspect-ratio",String(ratio));fig.dataset.coverOrientation=classify(ratio);};if(img.complete)sync();else img.addEventListener("load",sync,{once:true});}function apply(root){root.querySelectorAll(".aurora-report-cover__photo").forEach(applyFigure);}function boot(){apply(document.body);}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();})();`;
    }

    _mediaLayoutScript() {
        return `(function(){function orient(img){if(!img)return"landscape";var w=img.naturalWidth||img.width||0,h=img.naturalHeight||img.height||0;if(w>0&&h>0){if(h>w*1.05)return"portrait";if(w>h*1.05)return"landscape";return"square";}return"unknown";}function layoutCount(n){if(n<=1)return"single";if(n===2)return"duo";if(n===3)return"trio";if(n===4)return"quad";return"many";}function applyGallery(g){var figs=[].slice.call(g.querySelectorAll(".aurora-report-media-item, figure"));var imgs=figs.map(function(f){return f.querySelector("img");}).filter(Boolean);var count=figs.length||Number(g.dataset.mediaCount||0);if(!count)return;var layout=layoutCount(count);g.classList.remove("aurora-report-media--single","aurora-report-media--duo","aurora-report-media--trio","aurora-report-media--quad","aurora-report-media--many","aurora-report-media--portrait","aurora-report-media--landscape","aurora-report-media--mixed","aurora-report-media--all-portrait","aurora-report-photos--all-portrait","aurora-report-photos--single","aurora-report-photos--multiple");g.classList.add("aurora-report-media--"+layout,count===1?"aurora-report-photos--single":"aurora-report-photos--multiple");g.dataset.mediaCount=String(count);var o=imgs.map(orient),known=o.filter(function(v){return v!=="unknown";}),allP=known.length&&known.every(function(v){return v==="portrait"||v==="square";}),allL=known.length&&known.every(function(v){return v==="landscape"||v==="square";}),mixed=known.length&&!allP&&!allL;g.classList.toggle("aurora-report-media--portrait",allP);g.classList.toggle("aurora-report-media--landscape",allL);g.classList.toggle("aurora-report-media--mixed",mixed);figs.forEach(function(fig,i){var ori=o[i]&&o[i]!=="unknown"?o[i]:allP?"portrait":"landscape";fig.classList.remove("aurora-report-media-item--portrait","aurora-report-media-item--landscape","aurora-report-media-item--square","aurora-report-media-item--unknown");fig.classList.add("aurora-report-media-item--"+ori);});}function applyVehicle(grid){var photos=[].slice.call(grid.querySelectorAll(".aurora-vehicle-photo"));var o=photos.map(function(p){var img=p.querySelector("img");return img?orient(img):"unknown";});var known=o.filter(function(v){return v!=="unknown";}),allP=known.length&&known.every(function(v){return v==="portrait"||v==="square";}),allL=known.length&&known.every(function(v){return v==="landscape"||v==="square";}),mixed=known.length&&!allP&&!allL;grid.classList.remove("aurora-vehicle-photo-grid--all-portrait","aurora-vehicle-photo-grid--all-landscape","aurora-vehicle-photo-grid--mixed");grid.classList.toggle("aurora-vehicle-photo-grid--all-portrait",allP);grid.classList.toggle("aurora-vehicle-photo-grid--all-landscape",allL);grid.classList.toggle("aurora-vehicle-photo-grid--mixed",mixed);photos.forEach(function(photo,i){var ori=o[i]&&o[i]!=="unknown"?o[i]:allP?"portrait":"landscape";photo.classList.remove("aurora-vehicle-photo--portrait","aurora-vehicle-photo--landscape","aurora-vehicle-photo--square","aurora-vehicle-photo--unknown");photo.classList.add("aurora-vehicle-photo--"+ori);});}function apply(root){root.querySelectorAll(".aurora-report-media, .aurora-report-photos").forEach(applyGallery);root.querySelectorAll(".aurora-vehicle-photo-grid").forEach(applyVehicle);}function wait(root){var imgs=[].slice.call(root.querySelectorAll("img"));return Promise.all(imgs.map(function(img){return img.complete?Promise.resolve():new Promise(function(res){img.addEventListener("load",res,{once:true});img.addEventListener("error",res,{once:true});});})).then(function(){return new Promise(function(res){requestAnimationFrame(function(){requestAnimationFrame(res);});});}).then(function(){apply(root);});}function boot(){wait(document.body);}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();})();`;
    }

    _estimateRecordPrintProfile(record) {
        if (!record) {
            return "standard";
        }

        const photoCount = record.querySelectorAll(
            ".aurora-report-media-item, .aurora-report-photos figure, .aurora-report-media figure"
        ).length;
        const body = record.querySelector(
            ".aurora-report-record-card__body, .aurora-vehicle-record-card__content"
        );
        const textLength = body ? body.textContent.trim().length : 0;
        const hasRecommendation = Boolean(
            record.querySelector(".aurora-report-record-card__recommendation")
        );

        if (
            photoCount >= 3 ||
            (photoCount >= 2 && textLength > 260) ||
            (photoCount >= 1 && hasRecommendation && textLength > 160)
        ) {
            return "heavy";
        }

        if (
            photoCount === 0 &&
            textLength < 120 &&
            !hasRecommendation
        ) {
            return "compact";
        }

        if (photoCount <= 1 && textLength < 190 && !hasRecommendation) {
            return "compact";
        }

        return "standard";
    }

    _composeRecordPrintRows(records) {
        const rows = [];

        for (let index = 0; index < records.length; index += 1) {
            const current = records[index];
            const currentProfile = this._estimateRecordPrintProfile(current);
            const next = records[index + 1];
            const nextProfile = next
                ? this._estimateRecordPrintProfile(next)
                : null;

            if (
                currentProfile === "compact" &&
                next &&
                nextProfile === "compact"
            ) {
                rows.push([current, next]);
                index += 1;
                continue;
            }

            rows.push([current]);
        }

        return rows;
    }

    _buildVehicleAdditionalPrintUnits(node) {
        const heading = node.querySelector(
            ":scope > .aurora-vehicle-photo-section__header"
        );
        const records = Array.from(
            node.querySelectorAll(":scope > .aurora-report-occurrence")
        );
        const rows = this._composeRecordPrintRows(records);
        const isIssue = node.classList.contains("aurora-vehicle-found-issues");

        return rows.map((row, rowIndex) => {
            const unit = document.createElement("section");
            unit.className = [
                "aurora-print-record-sheet",
                isIssue
                    ? "aurora-print-record-sheet--issue"
                    : "aurora-print-record-sheet--complementary",
                "aurora-print-additional-record"
            ].join(" ");

            if (rowIndex === 0 && heading) {
                unit.appendChild(heading.cloneNode(true));
            }

            const rowElement = document.createElement("div");
            const density =
                row.length === 1
                    ? this._estimateRecordPrintProfile(row[0]) === "heavy"
                        ? "full"
                        : "single"
                    : "duo";

            rowElement.className = "aurora-print-record-row";
            rowElement.dataset.recordCount = String(row.length);
            rowElement.dataset.printDensity = density;

            row.forEach((record) => {
                rowElement.appendChild(record.cloneNode(true));
            });

            unit.appendChild(rowElement);
            return unit;
        });
    }

    _describePrintUnit(unit) {
        if (!unit) {
            return "(unidade ausente)";
        }

        if (unit.dataset.printAtomic === "section") {
            return "vehicle-records-atomic";
        }

        if (unit.classList.contains("aurora-print-vehicle-photos")) {
            const photos = unit.querySelectorAll(".aurora-vehicle-photo").length;
            return `vehicle-photos-row(${photos})`;
        }

        if (unit.classList.contains("aurora-print-checklist-row")) {
            return "checklist-row";
        }

        if (unit.classList.contains("aurora-print-checklist-meta")) {
            return "checklist-meta";
        }

        if (unit.classList.contains("aurora-print-diagnostic-part")) {
            return "diagnostic-part";
        }

        if (unit.classList.contains("aurora-report-section--vehicle-checklist")) {
            return "checklist-head+row";
        }

        if (unit.classList.contains("aurora-report-section--diagnostic")) {
            const articles = unit.querySelectorAll(".aurora-report-diagnostic article").length;
            return articles > 1 ? "diagnostic-block" : "diagnostic-summary";
        }

        if (unit.classList.contains("aurora-report-section--conclusion")) {
            return "finalization";
        }

        const sectionClass = Array.from(unit.classList || []).find((name) =>
            name.startsWith("aurora-report-section--")
        );

        return sectionClass || unit.className || unit.tagName;
    }

    _getPrintFooterTop(contentEl) {
        if (!contentEl) {
            return 0;
        }

        const page = contentEl.closest(".aurora-print-page");
        const footer = page
            ? page.querySelector(".aurora-print-page__footer")
            : null;

        return footer
            ? footer.getBoundingClientRect().top
            : contentEl.getBoundingClientRect().bottom;
    }

    _getPrintContentBottom(contentEl) {
        if (!contentEl) {
            return 0;
        }

        const contentRect = contentEl.getBoundingClientRect();
        const contentStyles = window.getComputedStyle(contentEl);
        const paddingTop = parseFloat(contentStyles.paddingTop) || 0;
        let contentBottom = contentRect.top + paddingTop;

        Array.from(contentEl.children).forEach((child) => {
            const childRect = child.getBoundingClientRect();
            const childStyles = window.getComputedStyle(child);
            const marginBottom = parseFloat(childStyles.marginBottom) || 0;

            contentBottom = Math.max(
                contentBottom,
                childRect.bottom + marginBottom
            );
        });

        return contentBottom;
    }

    _getPrintContentMetrics(contentEl) {
        if (!contentEl) {
            return {
                availableHeight: 0,
                usedHeight: 0,
                remainingHeight: 0
            };
        }

        const contentRect = contentEl.getBoundingClientRect();
        const contentStyles = window.getComputedStyle(contentEl);
        const paddingTop = parseFloat(contentStyles.paddingTop) || 0;
        const paddingBottom = parseFloat(contentStyles.paddingBottom) || 0;
        const footerTop = this._getPrintFooterTop(contentEl);
        const contentTop = contentRect.top + paddingTop;
        const availableHeight = Math.max(
            0,
            footerTop - (contentRect.top + paddingTop) - paddingBottom
        );
        const contentBottom = this._getPrintContentBottom(contentEl);
        const usedHeight = Math.max(0, contentBottom - contentTop);
        const rawRemainingHeight =
            footerTop - contentBottom - paddingBottom;
        const remainingHeight = Math.max(0, rawRemainingHeight);

        return {
            availableHeight: Number(availableHeight.toFixed(2)),
            usedHeight: Number(usedHeight.toFixed(2)),
            remainingHeight: Number(remainingHeight.toFixed(2)),
            rawRemainingHeight: Number(rawRemainingHeight.toFixed(2))
        };
    }

    _measurePrintUnitBox(unit) {
        if (!unit) {
            return {
                offsetHeight: 0,
                rectHeight: 0,
                scrollHeight: 0,
                marginTop: 0,
                marginBottom: 0
            };
        }

        const styles = window.getComputedStyle(unit);
        const rect = unit.getBoundingClientRect();

        return {
            offsetHeight: unit.offsetHeight,
            rectHeight: Number(rect.height.toFixed(2)),
            scrollHeight: unit.scrollHeight,
            marginTop: parseFloat(styles.marginTop) || 0,
            marginBottom: parseFloat(styles.marginBottom) || 0,
            display: styles.display,
            minHeight: styles.minHeight,
            height: styles.height
        };
    }

    _printContentOverflows(contentEl) {
        if (!contentEl || !contentEl.lastElementChild) {
            return false;
        }

        const metrics = this._getPrintContentMetrics(contentEl);
        return metrics.rawRemainingHeight < -1;
    }

    _printUnitFitsInContent(contentEl, unit, tolerance = 1) {
        if (
            !contentEl ||
            !unit ||
            !contentEl.isConnected ||
            !unit.isConnected
        ) {
            return true;
        }

        const footerTop = this._getPrintFooterTop(contentEl);
        const unitRect = unit.getBoundingClientRect();
        const unitStyles = window.getComputedStyle(unit);
        const marginBottom = parseFloat(unitStyles.marginBottom) || 0;
        const contentStyles = window.getComputedStyle(contentEl);
        const paddingBottom = parseFloat(contentStyles.paddingBottom) || 0;

        return unitRect.bottom + marginBottom <= footerTop - paddingBottom + tolerance;
    }

    _printUnitNeedsReflow(contentEl, unit) {
        if (
            !contentEl ||
            !unit
        ) {
            return false;
        }

        if (this._printContentOverflows(contentEl)) {
            return true;
        }

        if (unit.dataset.printKeepTogether === "1") {
            return !this._printUnitFitsInContent(
                contentEl,
                unit
            );
        }

        return false;
    }

    _logPrintAuditEntry(entry) {
        if (!Array.isArray(this._printAuditTrace)) {
            this._printAuditTrace = [];
        }

        const unit = entry.unitNode || null;
        const enriched = { ...entry };

        if (unit && unit.getBoundingClientRect) {
            const styles = window.getComputedStyle(unit);
            const parent = unit.parentElement;
            const parentStyles = parent ? window.getComputedStyle(parent) : null;

            enriched.offsetHeight = unit.offsetHeight;
            enriched.rectHeight = Number(unit.getBoundingClientRect().height.toFixed(2));
            enriched.scrollHeight = unit.scrollHeight;
            enriched.display = styles.display;
            enriched.minHeight = styles.minHeight;
            enriched.height = styles.height;
            enriched.marginTop = parseFloat(styles.marginTop) || 0;
            enriched.marginBottom = parseFloat(styles.marginBottom) || 0;
            enriched.breakBefore = styles.breakBefore;
            enriched.breakAfter = styles.breakAfter;
            enriched.parentContainer =
                parent && parent.className ? parent.className : parent ? parent.tagName : null;
            enriched.parentDisplay = parentStyles ? parentStyles.display : null;
            enriched.parentGrid = parentStyles ? parentStyles.gridTemplateRows : null;
            enriched.parentFlex = parentStyles ? parentStyles.flexDirection : null;
        }

        this._printAuditTrace.push(enriched);

        if (global.__AURORA_PRINT_DEBUG__ === true) {
            console.log("[AURORA PRINT AUDIT]", enriched);
        }
    }

    _logPrintPageBreak(contentEl, unit, reason, pageIndex, phase = "after-remove") {
        if (!Array.isArray(this._printPaginationLog)) {
            this._printPaginationLog = [];
        }

        const metrics = this._getPrintContentMetrics(contentEl);
        const unitRect = unit ? unit.getBoundingClientRect() : null;

        this._printPaginationLog.push({
            breakNumber: this._printPaginationLog.length + 1,
            pageIndex,
            unit: this._describePrintUnit(unit),
            unitHeight: unitRect ? Number(unitRect.height.toFixed(2)) : 0,
            usableHeight: metrics.availableHeight,
            usedHeight: metrics.usedHeight,
            remainingHeight: metrics.remainingHeight,
            breakReason: reason,
            keepTogether: unit && unit.dataset.printKeepTogether === "1",
            printAtomic: unit ? unit.dataset.printAtomic || null : null,
            phase
        });

        this._logPrintAuditEntry({
            event: "page-break",
            phase,
            pageIndex,
            unit: this._describePrintUnit(unit),
            unitNode: unit,
            breakReason: reason,
            moveReason: reason,
            remainingBefore: metrics.remainingHeight,
            usedHeight: metrics.usedHeight,
            usableHeight: metrics.availableHeight,
            unitBox: unit ? this._measurePrintUnitBox(unit) : null,
            keepTogether: unit && unit.dataset.printKeepTogether === "1",
            printAtomic: unit ? unit.dataset.printAtomic || null : null
        });
    }

    _debugLogPaginationMetrics(stage) {
        if (!stage) {
            console.warn("=== AURORA PAGINATION METRICS === stage ausente");
            return;
        }

        const pages = Array.from(stage.querySelectorAll(".aurora-print-page"));

        console.group("=== AURORA PAGINATION METRICS ===");
        console.log("Total de paginas:", pages.length);

        const exportedMetrics = [];
        const restoreActiveIndex =
            stage.querySelector(".aurora-print-page.aurora-pdf-page-active")
                ? Array.from(stage.querySelectorAll(".aurora-print-page")).findIndex((pageEl) =>
                      pageEl.classList.contains("aurora-pdf-page-active")
                  )
                : 0;

        pages.forEach((page, index) => {
            this._syncActivePrintPageVisibility(stage, index + 1);
            const content = page.querySelector(".aurora-print-page__content");
            const footer = page.querySelector(".aurora-print-page__footer");
            const metrics = this._getPrintContentMetrics(content);
            const contentRect = content ? content.getBoundingClientRect() : null;
            const footerRect = footer ? footer.getBoundingClientRect() : null;
            const lastChild = content && content.lastElementChild;
            const lastRect = lastChild ? lastChild.getBoundingClientRect() : null;
            const footerInvaded = Boolean(
                lastRect &&
                footerRect &&
                lastRect.bottom > footerRect.top + 2
            );
            const units = content
                ? Array.from(content.children).map((child) => this._describePrintUnit(child))
                : [];

            console.group(`PAGE ${index + 1}`);
            const occupancyPct = metrics.availableHeight
                ? Number(((metrics.usedHeight / metrics.availableHeight) * 100).toFixed(1))
                : 0;
            const emptyPct = metrics.availableHeight
                ? Number(((metrics.remainingHeight / metrics.availableHeight) * 100).toFixed(1))
                : 0;
            const isIntermediate = index < pages.length - 1;
            const warningLow = isIntermediate && emptyPct > 30;
            const failLow = isIntermediate && emptyPct > 40;

            console.log({
                usableHeight: metrics.availableHeight,
                usedHeight: metrics.usedHeight,
                remainingHeight: metrics.remainingHeight,
                occupancy: `${occupancyPct}%`,
                emptyPct: `${emptyPct}%`,
                units,
                footerInvadido: footerInvaded,
                warningLowOccupancy: warningLow,
                failLowOccupancy: failLow
            });

            exportedMetrics.push({
                page: index + 1,
                usableHeight: metrics.availableHeight,
                usedHeight: metrics.usedHeight,
                remainingHeight: metrics.remainingHeight,
                occupancyPct,
                emptyPct,
                warningLowOccupancy: warningLow,
                failLowOccupancy: failLow,
                footerInvaded,
                units
            });
            console.groupEnd();
        });

        this._syncActivePrintPageVisibility(
            stage,
            restoreActiveIndex >= 0 ? restoreActiveIndex + 1 : 1
        );

        global.__AURORA_PRINT_PAGE_METRICS__ = exportedMetrics;

        if (Array.isArray(this._printPaginationLog) && this._printPaginationLog.length) {
            console.group("PAGE BREAKS registrados");
            this._printPaginationLog.forEach((entry) => {
                console.log(
                    `PAGE BREAK ${entry.breakNumber} (page ${entry.pageIndex}):`,
                    {
                        unit: entry.unit,
                        remainingHeight: entry.remainingHeight,
                        unitHeight: entry.unitHeight,
                        usableHeight: entry.usableHeight,
                        breakReason: entry.breakReason,
                        keepTogether: entry.keepTogether,
                        printAtomic: entry.printAtomic
                    }
                );
            });
            console.groupEnd();
        } else {
            console.log("Nenhum page break forcado registrado.");
        }

        console.groupEnd();
    }

    _buildVehicleGuidedPhotoPrintUnits(sectionHeading, vehiclePhotoSection) {
        const units = [];
        const photoHeader = vehiclePhotoSection.querySelector(
            ".aurora-vehicle-photo-section__header"
        );
        const grid = vehiclePhotoSection.querySelector(".aurora-vehicle-photo-grid");
        const photos = grid ? Array.from(grid.children) : [];

        if (!photos.length) {
            const fallback = document.createElement("section");
            fallback.className =
                "aurora-report-section aurora-report-section--records aurora-print-vehicle-photos";

            if (sectionHeading) {
                fallback.appendChild(sectionHeading.cloneNode(true));
            }

            fallback.appendChild(vehiclePhotoSection.cloneNode(true));
            units.push(fallback);
            return units;
        }

        for (let index = 0; index < photos.length; index += 2) {
            const unit = document.createElement("section");
            unit.className =
                "aurora-report-section aurora-report-section--records aurora-print-vehicle-photos";

            if (index === 0 && sectionHeading) {
                unit.appendChild(sectionHeading.cloneNode(true));
            }

            const sectionShell = document.createElement("section");
            sectionShell.className = "aurora-vehicle-photo-section aurora-vehicle-photo-section--print-row";

            if (index === 0 && photoHeader) {
                sectionShell.appendChild(photoHeader.cloneNode(true));
            }

            const row = document.createElement("div");
            row.className = [
                grid.className,
                "aurora-vehicle-photo-grid--print-row"
            ].join(" ").trim();
            row.appendChild(photos[index].cloneNode(true));

            if (photos[index + 1]) {
                row.appendChild(photos[index + 1].cloneNode(true));
            }

            sectionShell.appendChild(row);
            unit.appendChild(sectionShell);
            units.push(unit);
        }

        return units;
    }

    _buildChecklistPrintUnits(section) {
        const units = [];
        const head = section.querySelector(".aurora-report-section__head, :scope > h2");
        const statusList = section.querySelector(".aurora-report-status-list");
        const rows = statusList
            ? Array.from(statusList.querySelectorAll(".aurora-report-status-row"))
            : [];
        const meta = section.querySelector(".aurora-report-status-list__meta");

        if (head && rows.length) {
            const firstUnit = document.createElement("section");
            firstUnit.className = section.className;

            const headClone = head.cloneNode(true);

            if (
                headClone.tagName === "H2" &&
                !headClone.closest(".aurora-report-section__head")
            ) {
                const headWrap = document.createElement("header");
                headWrap.className = "aurora-report-section__head";
                headWrap.appendChild(headClone);
                firstUnit.appendChild(headWrap);
            } else {
                firstUnit.appendChild(headClone);
            }

            const firstList = document.createElement("div");
            firstList.className = "aurora-report-status-list";
            firstList.appendChild(rows[0].cloneNode(true));
            firstUnit.appendChild(firstList);
            firstUnit.dataset.printKeepTogether = "1";
            firstUnit.dataset.printEditorialGroup = "checklist-head-row";
            units.push(firstUnit);

            for (let index = 1; index < rows.length; index += 1) {
                const rowUnit = document.createElement("section");
                rowUnit.className = [
                    section.className,
                    "aurora-print-checklist-row"
                ].join(" ");
                const rowList = document.createElement("div");
                rowList.className = "aurora-report-status-list";
                rowList.appendChild(rows[index].cloneNode(true));
                rowUnit.appendChild(rowList);
                units.push(rowUnit);
            }
        } else {
            units.push(section.cloneNode(true));
        }

        if (meta) {
            const metaUnit = document.createElement("section");
            metaUnit.className = [
                section.className,
                "aurora-print-checklist-meta"
            ].join(" ");
            const metaList = document.createElement("div");
            metaList.className = "aurora-report-status-list";
            metaList.appendChild(meta.cloneNode(true));
            metaUnit.appendChild(metaList);
            units.push(metaUnit);
        }

        return units;
    }

    _buildTupyMaterialsPrintUnits(section) {
        /*
         * Elétrica Tupy usa o mesmo HTML como autoridade visual do PDF.
         * No palco A4, uma tabela inteira como unidade atômica pode ser movida
         * para a página seguinte e deixar um vazio grande. Dividimos somente
         * entre linhas (nunca dentro de uma linha), mantendo o cabeçalho visual
         * uma única vez e preservando as larguras/estilo da tabela HTML.
         */
        const table = section.querySelector(".aurora-report-materials-table");
        const tbody = table ? table.querySelector("tbody") : null;
        const rows = tbody ? Array.from(tbody.children) : [];

        if (!table || !rows.length) {
            return [section.cloneNode(true)];
        }

        const sectionHead = this._cloneSectionHead(section);
        const tableHead = table.querySelector("thead");

        return rows.map((row, index) => {
            const unit = document.createElement("section");
            unit.className = [
                section.className,
                "aurora-print-tupy-table-row",
                index === 0 ? "aurora-print-tupy-table-row--first" : "aurora-print-tupy-table-row--continuation"
            ].join(" " ).trim();

            if (index === 0 && sectionHead) {
                unit.appendChild(sectionHead.cloneNode(true));
            }

            const shell = section.querySelector(".aurora-report-materials")
                ? section.querySelector(".aurora-report-materials").cloneNode(false)
                : document.createElement("div");
            shell.classList.add("aurora-report-materials");

            const rowTable = table.cloneNode(false);
            if (index === 0 && tableHead) {
                rowTable.appendChild(tableHead.cloneNode(true));
            }
            const rowBody = document.createElement("tbody");
            rowBody.appendChild(row.cloneNode(true));
            rowTable.appendChild(rowBody);
            shell.appendChild(rowTable);
            unit.appendChild(shell);
            unit.dataset.printKeepTogether = "1";
            unit.dataset.printSplit = "1";
            return unit;
        });
    }

    _buildIntakeSummaryPrintUnits(section) {
        const units = [];
        const head = this._cloneSectionHead(section);
        const blocks = Array.from(
            section.querySelectorAll(".aurora-report-intake-summary__block")
        );

        if (!blocks.length) {
            units.push(section.cloneNode(true));
            return units;
        }

        blocks.forEach((block, index) => {
            const unit = document.createElement("section");
            unit.className = [
                section.className,
                "aurora-print-intake-block"
            ].join(" ");

            if (index === 0 && head) {
                unit.appendChild(head);
            }

            const shell = document.createElement("div");
            shell.className = "aurora-report-intake-summary";
            shell.appendChild(block.cloneNode(true));
            unit.appendChild(shell);
            units.push(unit);
        });

        return units;
    }

    _copyStyleSheetsToMeasureFrame(targetDoc) {
        Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach((link) => {
            const clone = targetDoc.createElement("link");
            clone.rel = "stylesheet";
            clone.href = link.href;
            targetDoc.head.appendChild(clone);
        });
        Array.from(document.querySelectorAll("style")).forEach((style) => {
            targetDoc.head.appendChild(style.cloneNode(true));
        });
    }

    _waitPdfMeasureStyles(iframe) {
        const targetDoc = iframe.contentDocument;
        if (!targetDoc) {
            return Promise.resolve();
        }
        const links = Array.from(targetDoc.querySelectorAll('link[rel="stylesheet"]'));
        return Promise.all(
            links.map((link) => {
                if (link.sheet) {
                    return Promise.resolve();
                }
                return new Promise((resolve) => {
                    link.addEventListener("load", resolve, { once: true });
                    link.addEventListener("error", resolve, { once: true });
                });
            })
        );
    }

    async _ensurePdfMeasureHost() {
        /*
         * O palco A4 precisa de um viewport de folha, nao o da tela do
         * telefone. Media queries max-width do CSS aprovado (700px/760px)
         * colapsam grids se a medicao ocorrer no documento principal.
         * O iframe 210mm e o contexto de layout; a paginacao continua em
         * _buildPrintStage.
         */
        let iframe = document.getElementById("aurora-pdf-measure-frame");

        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.id = "aurora-pdf-measure-frame";
            iframe.setAttribute("data-aurora-pdf-measure-frame", "");
            iframe.setAttribute("title", "aurora-pdf-measure");
            iframe.setAttribute("aria-hidden", "true");
            iframe.style.cssText = [
                "position:fixed",
                "left:0",
                "top:0",
                "width:210mm",
                "height:297mm",
                "border:0",
                "opacity:0.01",
                "pointer-events:none",
                "z-index:-1",
                "background:#fff"
            ].join(";");
            document.body.appendChild(iframe);

            const idoc = iframe.contentDocument;
            idoc.open();
            idoc.write("<!DOCTYPE html><html><head></head><body></body></html>");
            idoc.close();
            idoc.documentElement.className = document.documentElement.className;
            idoc.body.className = document.body.className;
            this._copyStyleSheetsToMeasureFrame(idoc);

            const host = idoc.createElement("div");
            host.id = "aurora-pdf-measure-host";
            host.setAttribute("data-aurora-pdf-measure-host", "");
            idoc.body.appendChild(host);
            await this._waitPdfMeasureStyles(iframe);
            if (idoc.fonts && typeof idoc.fonts.ready !== "undefined") {
                try {
                    await idoc.fonts.ready;
                } catch (error) {
                    /* noop */
                }
            }
        }

        const idoc = iframe.contentDocument;
        let host = idoc.getElementById("aurora-pdf-measure-host");

        if (!host) {
            host = idoc.createElement("div");
            host.id = "aurora-pdf-measure-host";
            host.setAttribute("data-aurora-pdf-measure-host", "");
            idoc.body.appendChild(host);
        }

        return host;
    }

    _syncActivePrintPageVisibility(stage, activePageIndex) {
        if (!stage) {
            return;
        }

        const pages = Array.from(stage.querySelectorAll(".aurora-print-page"));

        pages.forEach((pageEl, index) => {
            pageEl.classList.toggle(
                "aurora-pdf-page-active",
                index === activePageIndex - 1
            );
        });
    }

    _cloneSectionHead(section) {
        const head = section.querySelector(".aurora-report-section__head, :scope > h2");

        if (!head) {
            return null;
        }

        const headClone = head.cloneNode(true);

        if (
            headClone.tagName === "H2" &&
            !headClone.closest(".aurora-report-section__head")
        ) {
            const headWrap = document.createElement("header");
            headWrap.className = "aurora-report-section__head";
            headWrap.appendChild(headClone);
            return headWrap;
        }

        return headClone;
    }

    _buildSheetRowPrintUnits(section, sheetSelector, rowSelector, unitSuffix) {
        const units = [];
        const head = this._cloneSectionHead(section);
        const sheet = section.querySelector(sheetSelector);
        const rows = sheet
            ? Array.from(sheet.querySelectorAll(rowSelector))
            : [];
        const trailing = sheet
            ? Array.from(sheet.children).filter((node) => !node.matches(rowSelector))
            : [];

        if (!rows.length) {
            units.push(section.cloneNode(true));
            return units;
        }

        rows.forEach((row, index) => {
            const unit = document.createElement("section");
            unit.className = [
                section.className,
                unitSuffix
            ].join(" ").trim();

            if (index === 0 && head) {
                unit.appendChild(head);
            }

            const sheetShell = document.createElement("div");
            sheetShell.className = sheet.className;
            sheetShell.appendChild(row.cloneNode(true));
            unit.appendChild(sheetShell);

            units.push(unit);
        });

        if (trailing.length) {
            const tailUnit = document.createElement("section");
            tailUnit.className = [
                section.className,
                `${unitSuffix}-tail`
            ].join(" ").trim();
            const sheetShell = document.createElement("div");
            sheetShell.className = sheet.className;
            trailing.forEach((node) => sheetShell.appendChild(node.cloneNode(true)));
            tailUnit.appendChild(sheetShell);
            units.push(tailUnit);
        }

        return units;
    }

    _buildTupyFinalWorkPhotoPrintUnits(section) {
        const units = [];
        const head = section.querySelector(
            ":scope > .aurora-report-section__head, :scope > h2"
        );
        const gallery = section.querySelector(
            ":scope > .aurora-report-media, :scope > .aurora-report-photos"
        );

        if (!gallery) {
            units.push(section.cloneNode(true));
            return units;
        }

        const figures = Array.from(
            gallery.querySelectorAll(":scope > .aurora-report-media-item, :scope > figure")
        );

        if (!figures.length) {
            units.push(section.cloneNode(true));
            return units;
        }

        for (let index = 0; index < figures.length; index += 2) {
            const rowCount = figures[index + 1] ? 2 : 1;
            const unit = document.createElement("section");

            unit.className = [
                section.className,
                "aurora-print-tupy-final-photo-row"
            ].join(" ").trim();

            if (index === 0 && head) {
                unit.appendChild(head.cloneNode(true));
            }

            const row = document.createElement("div");
            row.className = [
                gallery.className,
                "aurora-report-media--print-row",
                `aurora-report-media--${this._mediaLayoutCountClass(rowCount)}`
            ].join(" ").trim();

            row.dataset.mediaCount = String(rowCount);
            row.innerHTML = "";

            row.appendChild(figures[index].cloneNode(true));

            if (figures[index + 1]) {
                row.appendChild(figures[index + 1].cloneNode(true));
            }

            unit.appendChild(row);
            unit.dataset.printSplit = "1";
            units.push(unit);
        }

        return units;
    }
    _buildOccurrencePrintUnits(record) {
        const card = record.querySelector(
            ".aurora-report-record-card, .aurora-vehicle-record-card"
        );

        if (card) {
            const fragments = this._fragmentRecordCard(card);

            if (fragments.length <= 1) {
                return [record.cloneNode(true)];
            }

            return fragments.map((fragment) => {
                const unit = document.createElement("div");
                unit.className = "aurora-print-occurrence-unit";
                unit.appendChild(fragment);
                unit.dataset.printSplit = "1";
                return unit;
            });
        }

        const cloned = record.cloneNode(true);
        const gallery = cloned.querySelector(".aurora-report-photos, .aurora-report-media");

        if (!gallery) {
            return [cloned];
        }

        const figures = Array.from(
            gallery.querySelectorAll(".aurora-report-media-item, figure")
        );
        gallery.remove();

        const units = [cloned];

        for (let index = 0; index < figures.length; index += 2) {
            const rowCount = figures[index + 1] ? 2 : 1;
            const continuation = document.createElement("article");
            continuation.className = [
                "aurora-report-occurrence",
                "aurora-report-occurrence--photos",
                "aurora-print-occurrence-unit"
            ].join(" ");
            const row = document.createElement("div");
            row.className = [
                gallery.className,
                "aurora-report-photos--print-row",
                "aurora-report-media",
                `aurora-report-media--${this._mediaLayoutCountClass(rowCount)}`
            ].join(" ").trim();
            row.appendChild(figures[index].cloneNode(true));

            if (figures[index + 1]) {
                row.appendChild(figures[index + 1].cloneNode(true));
            }

            continuation.appendChild(row);
            continuation.dataset.printSplit = "1";
            units.push(continuation);
        }

        return units;
    }

    _buildDiagnosticPrintUnits(section) {
        const units = [];
        const head = section.querySelector(".aurora-report-section__head, :scope > h2");
        const articles = Array.from(
            section.querySelectorAll(".aurora-report-diagnostic article")
        );

        if (articles.length >= 2) {
            const summaryUnit = document.createElement("section");
            summaryUnit.className = section.className;

            if (head) {
                summaryUnit.appendChild(head.cloneNode(true));
            }

            const summaryGrid = document.createElement("div");
            summaryGrid.className = "aurora-report-diagnostic";
            summaryGrid.appendChild(articles[0].cloneNode(true));
            summaryUnit.appendChild(summaryGrid);
            summaryUnit.dataset.printKeepTogether = "1";
            units.push(summaryUnit);

            const recommendationUnit = document.createElement("section");
            recommendationUnit.className = [
                section.className,
                "aurora-print-diagnostic-part"
            ].join(" ");
            const recommendationGrid = document.createElement("div");
            recommendationGrid.className = "aurora-report-diagnostic";
            recommendationGrid.appendChild(articles[1].cloneNode(true));
            recommendationUnit.appendChild(recommendationGrid);
            units.push(recommendationUnit);
            return units;
        }

        units.push(section.cloneNode(true));
        return units;
    }

    _buildPrintTailBundle(diagnosticSection, conclusionSection) {
        const bundle = document.createElement("div");
        bundle.className = "aurora-print-tail-bundle";
        bundle.appendChild(diagnosticSection.cloneNode(true));
        bundle.appendChild(conclusionSection.cloneNode(true));
        return bundle;
    }

    _wrapPrintRecordSegment(record, sectionClasses, includeHeading, headingNode) {
        const unit = document.createElement("section");
        unit.className = sectionClasses;

        if (includeHeading && headingNode) {
            unit.appendChild(headingNode.cloneNode(true));
        }

        const rowElement = document.createElement("div");
        rowElement.className = "aurora-print-record-row";
        rowElement.dataset.recordCount = "1";
        rowElement.dataset.printDensity = "single";
        rowElement.appendChild(record);
        unit.appendChild(rowElement);
        return unit;
    }

    _fragmentRecordCard(record) {
        const header = record.querySelector(".aurora-report-record-card__header");
        const body = record.querySelector(".aurora-report-record-card__body, .aurora-vehicle-record-card__content");
        const gallery = record.querySelector(".aurora-report-media, .aurora-report-photos");
        const recommendation = record.querySelector(".aurora-report-record-card__recommendation");

        const fragments = [];
        let figures = gallery
            ? Array.from(
                gallery.querySelectorAll(".aurora-report-media-item, figure")
            )
            : [];
        const makePart = (parts, continued) => {
            const article = document.createElement("article");
            article.className = record.className;
            if (continued) {
                article.classList.add("aurora-report-record-card--continued");
            }
            parts.filter(Boolean).forEach((part) =>
                article.appendChild(part.cloneNode(true))
            );
            return article;
        };

        if (header || body) {
            const leadParts = [header, body];

            if (gallery && figures.length) {
                const rowCount = figures[1] ? 2 : 1;
                const rowGallery = gallery.cloneNode(false);
                rowGallery.classList.add(
                    "aurora-report-media--print-row",
                    `aurora-report-media--${this._mediaLayoutCountClass(rowCount)}`
                );
                rowGallery.appendChild(figures[0].cloneNode(true));

                if (figures[1]) {
                    rowGallery.appendChild(figures[1].cloneNode(true));
                }

                const shell = document.createElement("div");
                shell.appendChild(rowGallery);
                leadParts.push(shell);
                figures = figures.slice(rowCount);
            }

            fragments.push(makePart(leadParts, false));
        }

        if (gallery && figures.length) {
            for (let index = 0; index < figures.length; index += 2) {
                const rowCount = figures[index + 1] ? 2 : 1;
                const rowGallery = gallery.cloneNode(false);
                rowGallery.classList.add(
                    "aurora-report-media--print-row",
                    `aurora-report-media--${this._mediaLayoutCountClass(rowCount)}`
                );
                rowGallery.appendChild(figures[index].cloneNode(true));

                if (figures[index + 1]) {
                    rowGallery.appendChild(figures[index + 1].cloneNode(true));
                }

                fragments.push(
                    makePart([
                        (() => {
                            const shell = document.createElement("div");
                            shell.appendChild(rowGallery);
                            return shell;
                        })()
                    ], fragments.length > 0)
                );
            }
        }

        if (recommendation) {
            if (fragments.length) {
                fragments[fragments.length - 1].appendChild(
                    recommendation.cloneNode(true)
                );
            } else {
                fragments.push(makePart([recommendation], false));
            }
        }

        if (!fragments.length) {
            fragments.push(record.cloneNode(true));
        }

        if (fragments.length > 1) {
            fragments[0].dataset.printKeepTogether = "1";
            fragments[0].dataset.printEditorialGroup = "occurrence-lead";
            fragments.forEach((fragment, index) => {
                if (index === 0) {
                    fragment.classList.add("aurora-report-record-card--fragment-start");
                    return;
                }

                if (index === fragments.length - 1) {
                    fragment.classList.add("aurora-report-record-card--fragment-end");
                } else {
                    fragment.classList.add("aurora-report-record-card--fragment-middle");
                }
            });
        }

        return fragments;
    }

    _buildSheetHeadRowSplitUnits(unit, rowSelector) {
        if (!unit || unit.dataset.printSplit === "1") {
            return [unit];
        }

        const head = unit.querySelector(".aurora-report-section__head, :scope > h2");
        const row = unit.querySelector(rowSelector);

        if (!head || !row) {
            return [unit];
        }

        const headUnit = document.createElement("section");
        headUnit.className = [unit.className, "aurora-print-sheet-head"].join(" ");
        headUnit.appendChild(head.cloneNode(true));
        headUnit.dataset.printSplit = "1";

        const rowUnit = document.createElement("section");
        rowUnit.className = unit.className;
        const sheet = unit.querySelector(".aurora-report-fact-sheet, .aurora-report-spec-sheet");
        const sheetShell = document.createElement("div");
        sheetShell.className = sheet ? sheet.className : "aurora-report-fact-sheet";
        sheetShell.appendChild(row.cloneNode(true));
        rowUnit.appendChild(sheetShell);
        rowUnit.dataset.printSplit = "1";

        return [headUnit, rowUnit];
    }

    _trySplitPrintUnit(unit) {
        if (
            unit.dataset.printEditorialGroup === "checklist-head-row" ||
            unit.dataset.printEditorialGroup === "occurrence-lead"
        ) {
            return [unit];
        }

        if (unit.classList.contains("aurora-print-vehicle-photos")) {
            const row = unit.querySelector(".aurora-vehicle-photo-grid--print-row");
            const photos = row
                ? Array.from(row.querySelectorAll(":scope > .aurora-vehicle-photo"))
                : [];

            if (photos.length > 1) {
                return photos.map((photo, index) => {
                    const wrapped = document.createElement("section");
                    wrapped.className = unit.className;
                    wrapped.dataset.printSplit = "1";

                    if (index === 0) {
                        const heading = unit.querySelector(
                            ":scope > .aurora-report-section__head, :scope > h2"
                        );
                        const photoHeader = unit.querySelector(
                            ".aurora-vehicle-photo-section__header"
                        );

                        if (heading) {
                            wrapped.appendChild(heading.cloneNode(true));
                        }

                        if (photoHeader) {
                            const sectionShell = document.createElement("section");
                            sectionShell.className =
                                "aurora-vehicle-photo-section aurora-vehicle-photo-section--print-row";
                            sectionShell.appendChild(photoHeader.cloneNode(true));

                            const singleRow = document.createElement("div");
                            singleRow.className = row.className;
                            singleRow.appendChild(photo.cloneNode(true));
                            sectionShell.appendChild(singleRow);
                            wrapped.appendChild(sectionShell);
                            return wrapped;
                        }
                    }

                    const sectionShell = document.createElement("section");
                    sectionShell.className =
                        "aurora-vehicle-photo-section aurora-vehicle-photo-section--print-row";
                    const singleRow = document.createElement("div");
                    singleRow.className = row.className;
                    singleRow.appendChild(photo.cloneNode(true));
                    sectionShell.appendChild(singleRow);
                    wrapped.appendChild(sectionShell);
                    return wrapped;
                });
            }
        }

        const factSplit = this._buildSheetHeadRowSplitUnits(
            unit,
            ".aurora-report-fact-sheet__row"
        );

        if (factSplit.length > 1) {
            return factSplit;
        }

        const specSplit = this._buildSheetHeadRowSplitUnits(
            unit,
            ".aurora-report-spec-sheet__row"
        );

        if (specSplit.length > 1) {
            return specSplit;
        }

        if (
            unit.dataset.printAtomic === "section" ||
            unit.dataset.printKeepTogether === "1"
        ) {
            return [unit];
        }

        if (unit.classList.contains("aurora-print-tail-bundle")) {
            const parts = Array.from(unit.children);

            if (parts.length <= 1) {
                return [unit];
            }

            return parts.map((part) => {
                const wrapped = document.createElement("div");
                wrapped.className = "aurora-print-tail-part";

                if (
                    part.classList.contains("aurora-report-section--conclusion")
                ) {
                    wrapped.dataset.printKeepTogether = "1";
                }

                wrapped.appendChild(part.cloneNode(true));
                return wrapped;
            });
        }

        const recordRow = unit.querySelector(
            ":scope > .aurora-print-record-row[data-record-count=\"2\"]"
        );

        if (recordRow && unit.dataset.printSplit !== "1") {
            const cards = Array.from(
                recordRow.querySelectorAll(
                    ".aurora-report-record-card, .aurora-vehicle-record-card"
                )
            );

            if (cards.length > 1) {
                return cards.map((card, index) => {
                    const wrapped = this._wrapPrintRecordSegment(
                        card.cloneNode(true),
                        unit.className,
                        index === 0,
                        unit.querySelector(
                            ":scope > .aurora-vehicle-photo-section__header"
                        )
                    );
                    wrapped.dataset.printSplit = "1";
                    return wrapped;
                });
            }
        }

        const record = unit.querySelector(
            ".aurora-report-record-card, .aurora-vehicle-record-card"
        );

        if (!record || unit.dataset.printSplit === "1") {
            const photoRow = unit.querySelector(
                ".aurora-report-photos--print-row, .aurora-report-media--print-row"
            );

            if (photoRow) {
                const figures = Array.from(
                    photoRow.querySelectorAll(
                        ".aurora-report-media-item, figure, .aurora-vehicle-photo"
                    )
                );

                if (figures.length > 1) {
                    return figures.map((figure) => {
                        const wrapped = unit.cloneNode(false);
                        wrapped.className = unit.className;
                        wrapped.dataset.printSplit = "1";
                        const row = photoRow.cloneNode(false);
                        row.className = photoRow.className;
                        row.appendChild(figure.cloneNode(true));
                        wrapped.appendChild(row);
                        return wrapped;
                    });
                }
            }

            return [unit];
        }

        const heading = unit.querySelector(
            ":scope > .aurora-vehicle-photo-section__header"
        );
        const sectionClasses = unit.className;
        const fragments = this._fragmentRecordCard(record);

        if (fragments.length <= 1) {
            return [unit];
        }

        record.remove();

        return fragments.map((fragment, index) => {
            const wrapped = this._wrapPrintRecordSegment(
                fragment,
                sectionClasses,
                index === 0,
                heading
            );
            wrapped.dataset.printSplit = "1";
            return wrapped;
        });
    }

    mount() {
        if (this.modal) {
            return;
        }

        this.modal =
            document.createElement(
                "div"
            );

        this.modal.className =
            "aurora-report-preview";

        const isAndroid =
            global.__AURORA_ANDROID__ === true;
        const toolbarButtons = isAndroid
            ? [
                '<button type="button" data-report-edit>Editar atendimento</button>',
                '<button type="button" data-report-share-pdf>Compartilhar PDF</button>',
                '<button type="button" data-report-save-pdf>Salvar PDF</button>',
                '<button type="button" data-report-share-html>Compartilhar HTML</button>',
                '<button type="button" data-report-asset-qr>Etiqueta QR</button>'
            ]
            : [
                '<button type="button" data-report-edit>Editar atendimento</button>',
                '<button type="button" data-report-share-pdf>Compartilhar PDF</button>',
                '<button type="button" data-report-share-html>Compartilhar HTML</button>',
                '<button type="button" data-report-asset-qr>Etiqueta QR</button>'
            ];

        this.modal.innerHTML = [
            '<button type="button" class="aurora-report-preview__backdrop" data-report-close aria-label="Fechar relatório"></button>',
            '<section class="aurora-report-preview__sheet">',
            '<header class="aurora-report-preview__toolbar">',
            '<div>',
            '<strong>Prévia do relatório</strong>',
            '<span data-report-preview-code></span>',
            '<span data-report-preview-status style="display:none"></span>',
            '</div>',
            '<nav>',
            toolbarButtons.join(""),
            '<button type="button" data-report-close>×</button>',
            '</nav>',
            '</header>',
            '<div class="aurora-report-preview__viewport">',
            '<iframe class="aurora-report-preview__html-frame" data-report-html-frame title="Prévia fiel do relatório"></iframe>',
            '<article class="aurora-report-document aurora-report-preview__source" data-report-document></article>',
            '</div>',
            '</section>'
        ].join("");

        document.body.appendChild(
            this.modal
        );

        /*
         * AURORA V106 — Ctrl+P da prévia:
         * o relatório que o usuário vê é o documento HTML canônico dentro
         * do iframe. Encaminhamos o atalho diretamente para esse documento,
         * em vez de imprimir o container da PWA.
         */
        if (!this._canonicalPrintShortcutHandler) {
            this._canonicalPrintShortcutHandler = (event) => {
                const key = String(event.key || "").toLowerCase();
                const printShortcut =
                    key === "p" &&
                    (event.ctrlKey || event.metaKey);

                if (
                    !printShortcut ||
                    !this.modal ||
                    !this.modal.classList.contains("is-open")
                ) {
                    return;
                }

                const frame =
                    this.modal.querySelector("[data-report-html-frame]");

                if (
                    !frame ||
                    !frame.contentWindow
                ) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                try {
                    frame.contentWindow.focus();
                    frame.contentWindow.print();
                } catch (error) {
                    console.warn(
                        "Aurora Report: impressão nativa do HTML canônico indisponível.",
                        error
                    );
                }
            };

            global.addEventListener(
                "keydown",
                this._canonicalPrintShortcutHandler,
                true
            );
        }

        this.modal
            .querySelectorAll(
                "[data-report-close]"
            )
            .forEach(
                (button) => {
                    button.addEventListener(
                        "click",
                        () => {
                            this.closeAndReturnHome();
                        }
                    );
                }
            );

        const printButton =
            this.modal.querySelector("[data-report-print]");

        if (printButton) {
            printButton.addEventListener(
                "click",
                async () => {
                    await this._printCurrent();
                }
            );
        }

        const sharePdfButton =
            this.modal.querySelector("[data-report-share-pdf]");

        if (sharePdfButton) {
            sharePdfButton.addEventListener(
                "click",
                async () => {
                    if (sharePdfButton.disabled) {
                        return;
                    }

                    if (global.__AURORA_ANDROID__ === true) {
                        await this._sharePdfCurrent();
                        return;
                    }

                    const activationAtClick =
                        global.AuroraReportExport &&
                        typeof global.AuroraReportExport.captureUserActivation ===
                            "function"
                            ? global.AuroraReportExport.captureUserActivation(
                                "pdf-click"
                            )
                            : null;

                    await this._sharePdfPwaCurrent(activationAtClick);
                }
            );
        }

        const savePdfButton =
            this.modal.querySelector("[data-report-save-pdf]");

        if (savePdfButton) {
            savePdfButton.addEventListener(
                "click",
                async () => {
                    await this._savePdfCurrent();
                }
            );
        }

        const assetQrButton =
            this.modal.querySelector("[data-report-asset-qr]");

        if (assetQrButton) {
            assetQrButton.addEventListener(
                "click",
                async () => {
                    if (assetQrButton.disabled) return;
                    const report = this.engine.get(this.currentReportId);
                    if (!report) {
                        this.onNotify("Relatório não encontrado.");
                        return;
                    }
                    if (!global.AuroraAssetsPilot ||
                        typeof global.AuroraAssetsPilot.openForReport !== "function") {
                        this.onNotify("Etiqueta QR indisponível nesta versão.");
                        return;
                    }
                    assetQrButton.disabled = true;
                    try {
                        await global.AuroraAssetsPilot.openForReport(report);
                    } finally {
                        assetQrButton.disabled = false;
                    }
                }
            );
        }

        const shareHtmlButton =
            this.modal.querySelector("[data-report-share-html]");

        if (shareHtmlButton) {
            shareHtmlButton.addEventListener(
                "click",
                async () => {
                    if (shareHtmlButton.disabled) {
                        return;
                    }

                    const activationAtClick =
                        global.AuroraReportExport &&
                        typeof global.AuroraReportExport.captureUserActivation ===
                            "function"
                            ? global.AuroraReportExport.captureUserActivation(
                                "click"
                            )
                            : null;

                    await this._shareHtmlCurrent(activationAtClick);
                }
            );
        }

        const shareButton =
            this.modal.querySelector("[data-report-share]");

        if (shareButton) {
            shareButton.addEventListener(
                "click",
                () => {
                    this.shareCurrent();
                }
            );
        }

        this.modal
            .querySelector("[data-report-edit]")
            .addEventListener("click", () => {
                const report = this.engine.get(this.currentReportId);
                if (!report || !report.snapshot) {
                    this.onNotify("Este atendimento não possui dados editáveis.");
                    return;
                }
                const sid=String((report.service&&report.service.id)||(report.snapshot&&report.snapshot.service&&report.snapshot.service.id)||"").toLowerCase();
                global.dispatchEvent(new CustomEvent("aurora:edit-report", { detail: { report } }));
                this.close();
            });

        if (global.AuroraPdfExperimental && typeof global.AuroraPdfExperimental.attachDevButton === "function") {
            global.AuroraPdfExperimental.attachDevButton(this);
        }

        this._setHtmlShareBusy(true);
        if (global.__AURORA_ANDROID__ !== true) {
            this._setPdfShareBusy(true);
        }
    }

    async _generateOfficialPdf(postAction = "share", options = {}) {
        if (
            !global.AuroraPdfLocalTest ||
            typeof global.AuroraPdfLocalTest.generateFromPreview !== "function"
        ) {
            this.onNotify("Geração de PDF indisponível neste dispositivo.");
            return null;
        }

        await this.ensurePreviewReady();

        return global.AuroraPdfLocalTest.generateFromPreview(
            this,
            this.onNotify,
            Object.assign(
                { postAction },
                options
            )
        );
    }

    async _sharePdfCurrent() {
        await this._generateOfficialPdf("share");
    }

    async _sharePdfPwaCurrent(activationAtClick) {
        if (
            !global.AuroraReportPdfPwa ||
            typeof global.AuroraReportPdfPwa.sharePdfFromPreview !== "function"
        ) {
            this.onNotify("Compartilhar PDF indisponível nesta versão.");
            return;
        }

        try {
            await global.AuroraReportPdfPwa.sharePdfFromPreview(
                this,
                (message) => this._shareHtmlFeedback(message),
                { activationAtClick }
            );
        } catch (error) {
            if (error && error.name === "AbortError") {
                return;
            }
        }
    }

    async _savePdfCurrent(options = {}) {
        await this._generateOfficialPdf(
            "save",
            options
        );
    }

    notifyExportStatus(message) {
        if (!this.modal) {
            return;
        }

        const status = this.modal.querySelector(
            "[data-report-preview-status]"
        );

        if (!status) {
            return;
        }

        const text = String(message || "").trim();

        if (this._previewCycleStats) {
            this._previewCycleStats.status += 1;
        }

        status.textContent = text;
        status.style.display = text ? "block" : "none";
    }

    _shareHtmlFeedback(message) {
        this.notifyExportStatus(message);
        this.onNotify(message);
    }

    async _shareHtmlCurrent(activationAtClick) {
        if (
            !global.AuroraReportExport ||
            typeof global.AuroraReportExport.shareHtmlFromPreview !== "function"
        ) {
            const unavailable =
                "Compartilhar HTML indisponível nesta versão.";
            this._shareHtmlFeedback(unavailable);
            if (
                global.AuroraDialog &&
                typeof global.AuroraDialog.alert === "function"
            ) {
                await global.AuroraDialog.alert(unavailable, {
                    title: "Compartilhar HTML",
                    tone: "danger",
                    layout: "simple",
                    confirmLabel: "Entendi"
                });
            }
            return;
        }

        try {
            await global.AuroraReportExport.shareHtmlFromPreview(
                this,
                (message) => this._shareHtmlFeedback(message),
                { activationAtClick }
            );
        } catch (error) {
            if (error && error.name === "AbortError") {
                return;
            }
        }
    }

    async _saveHtmlCurrent() {
        if (
            !global.AuroraReportExport ||
            typeof global.AuroraReportExport.saveHtmlFromPreview !== "function"
        ) {
            this.onNotify("Salvar HTML indisponível nesta versão.");
            return;
        }

        await global.AuroraReportExport.saveHtmlFromPreview(
            this,
            this.onNotify
        );
    }

    async _waitDocumentImages(documentNode) {
        if (!documentNode) {
            return;
        }

        const images = Array.from(
            documentNode.querySelectorAll("img")
        );

        await Promise.all(
            images.map((image) => {
                if (image.complete) {
                    return Promise.resolve();
                }

                return new Promise((resolve) => {
                    image.addEventListener(
                        "load",
                        resolve,
                        { once: true }
                    );
                    image.addEventListener(
                        "error",
                        resolve,
                        { once: true }
                    );
                });
            })
        );
    }

    _syncCanonicalHtmlPreview(report, documentNode) {
        if (!this.modal || !documentNode) return;
        const frame = this.modal.querySelector("[data-report-html-frame]");
        if (!frame) return;
        try {
            frame.srcdoc = this._standaloneHTML(report, documentNode.outerHTML);
        } catch (error) {
            console.warn("Aurora Report: não foi possível sincronizar a prévia HTML canônica.", error);
        }
    }

    async _renderHydratedPreviewDocument(report) {
        const hydrated =
            await this._hydratePersistedPhotos(
                report
            );

        if (
            !hydrated ||
            String(this.currentReportId) !==
                String(report.id)
        ) {
            return report;
        }

        if (this.engine.runtimeReports) {
            this.engine.runtimeReports.set(
                String(report.id),
                hydrated
            );
        }

        const documentNode =
            this.modal.querySelector(
                "[data-report-document]"
            );

        documentNode.innerHTML =
            this.renderDocument(
                hydrated
            );

        await this._syncPreviewMediaLayouts(
            documentNode
        );
        await this._waitDocumentImages(
            documentNode
        );
        this._syncCanonicalHtmlPreview(hydrated, documentNode);

        return hydrated;
    }

    async ensurePreviewReady() {
        if (this._previewReadyPromise) {
            await this._previewReadyPromise;
        }

        const documentNode =
            this.modal &&
            this.modal.querySelector(
                "[data-report-document]"
            );

        if (documentNode) {
            await this._waitDocumentImages(
                documentNode
            );
        }
    }

    _invalidateHtmlShareCache() {
        this._htmlShareCache = null;
        this._htmlShareActivationLog = null;

        if (
            global.AuroraReportExport &&
            typeof global.AuroraReportExport.clearPreviewHtmlShareCache ===
                "function"
        ) {
            global.AuroraReportExport.clearPreviewHtmlShareCache(this);
        }
    }

    _invalidatePdfShareCache() {
        this._pdfShareCache = null;

        if (
            global.AuroraReportPdfPwa &&
            typeof global.AuroraReportPdfPwa.clearPreviewPdfShareCache ===
                "function"
        ) {
            global.AuroraReportPdfPwa.clearPreviewPdfShareCache(this);
        }
    }

    _setHtmlShareBusy(busy) {
        if (!this.modal) {
            return;
        }

        const shareHtmlButton = this.modal.querySelector(
            "[data-report-share-html]"
        );

        if (!shareHtmlButton) {
            return;
        }

        shareHtmlButton.disabled = Boolean(busy);
        shareHtmlButton.setAttribute(
            "aria-busy",
            busy ? "true" : "false"
        );
    }

    _setPdfShareBusy(busy) {
        if (!this.modal) {
            return;
        }

        const sharePdfButton = this.modal.querySelector(
            "[data-report-share-pdf]"
        );

        if (!sharePdfButton) {
            return;
        }

        sharePdfButton.disabled = Boolean(busy);
        sharePdfButton.setAttribute(
            "aria-busy",
            busy ? "true" : "false"
        );
    }

    _notePreviewCycle(key) {
        if (!this._previewCycleStats) {
            return;
        }

        this._previewCycleStats[key] =
            (this._previewCycleStats[key] || 0) + 1;
    }

    async _prepareHtmlShareAfterOpen(report, token) {
        const documentNode =
            this.modal &&
            this.modal.querySelector(
                "[data-report-document]"
            );

        try {
            let paintReport = report;

            try {
                paintReport = await this._ensurePublicValidation(paintReport);
            } catch (validationError) {
                console.warn("Aurora Report: validação pública ficou pendente.", validationError);
            }

            try {
                const hydrated =
                    await this._hydratePersistedPhotos(
                        paintReport
                    );

                if (
                    hydrated &&
                    String(this.currentReportId) ===
                        String(report.id)
                ) {
                    if (this.engine.runtimeReports) {
                        this.engine.runtimeReports.set(
                            String(report.id),
                            hydrated
                        );
                    }
                    paintReport = hydrated;
                }
            } catch (hydrateError) {
                console.warn(
                    "Aurora Report: não foi possível reidratar as fotos da prévia.",
                    hydrateError
                );
            }

            if (
                token !== this._htmlSharePrepareToken ||
                String(this.currentReportId) !== String(report.id)
            ) {
                return;
            }

            if (documentNode) {
                documentNode.innerHTML =
                    this.renderDocument(
                        paintReport
                    );
                this._notePreviewCycle("render");
                await this._syncPreviewMediaLayouts(
                    documentNode
                );
                await this._waitDocumentImages(documentNode);
                this._syncCanonicalHtmlPreview(paintReport, documentNode);
            }

            if (
                token !== this._htmlSharePrepareToken ||
                String(this.currentReportId) !== String(report.id)
            ) {
                return;
            }

            if (
                global.AuroraReportExport &&
                typeof global.AuroraReportExport.prepareHtmlShareForPreview ===
                    "function"
            ) {
                await global.AuroraReportExport.prepareHtmlShareForPreview(
                    this,
                    () => {}
                );
                this._notePreviewCycle("prepareHtml");
            }

            if (
                token !== this._htmlSharePrepareToken ||
                String(this.currentReportId) !== String(report.id)
            ) {
                return;
            }

            const cacheReady =
                global.AuroraReportExport &&
                typeof global.AuroraReportExport.isPreviewHtmlShareCacheValid ===
                    "function"
                    ? global.AuroraReportExport.isPreviewHtmlShareCacheValid(
                        this
                    )
                    : Boolean(this._htmlShareCache);

            if (!cacheReady) {
                this._setHtmlShareBusy(true);
                this.notifyExportStatus(
                    "Não foi possível preparar o relatório para compartilhar."
                );
            } else {
                this._setHtmlShareBusy(false);
                this.notifyExportStatus("");
            }

            if (global.__AURORA_ANDROID__ === true) {
                this._logPreviewCycleOnce();
                return;
            }

            this._setPdfShareBusy(true);

            if (cacheReady) {
                this.notifyExportStatus("Preparando PDF...");
            }

            if (
                global.AuroraReportPdfPwa &&
                typeof global.AuroraReportPdfPwa.preparePdfShareForPreview ===
                    "function"
            ) {
                await global.AuroraReportPdfPwa.preparePdfShareForPreview(
                    this
                );
                this._notePreviewCycle("preparePdf");
            }

            if (
                token !== this._htmlSharePrepareToken ||
                String(this.currentReportId) !== String(report.id)
            ) {
                return;
            }

            const pdfReady =
                global.AuroraReportPdfPwa &&
                typeof global.AuroraReportPdfPwa.isPreviewPdfShareCacheValid ===
                    "function"
                    ? global.AuroraReportPdfPwa.isPreviewPdfShareCacheValid(
                        this
                    )
                    : Boolean(this._pdfShareCache);

            if (!pdfReady) {
                this._setPdfShareBusy(true);
                if (cacheReady) {
                    this.notifyExportStatus(
                        "Não foi possível preparar o PDF para compartilhar."
                    );
                }
            } else {
                this._setPdfShareBusy(false);
                this.notifyExportStatus("");
            }

            this._logPreviewCycleOnce();
        } catch (error) {
            if (token !== this._htmlSharePrepareToken) {
                return;
            }

            this._setHtmlShareBusy(true);
            if (global.__AURORA_ANDROID__ !== true) {
                this._setPdfShareBusy(true);
            }
            this.notifyExportStatus(
                "Não foi possível preparar o relatório para compartilhar."
            );
            console.warn(
                "Aurora Report: falha ao pré-gerar exportação da prévia.",
                error
            );
        }
    }

    _logPreviewCycleOnce() {
        if (!this._previewCycleStats || this._previewCycleStats.logged) {
            return;
        }

        this._previewCycleStats.logged = true;
        console.info(
            "AURORA PREVIEW STABILIZE",
            {
                render: this._previewCycleStats.render || 0,
                prepareHtml: this._previewCycleStats.prepareHtml || 0,
                preparePdf: this._previewCycleStats.preparePdf || 0,
                status: this._previewCycleStats.status || 0
            }
        );
    }

    open(reportId) {
        this.mount();

        const report =
            this.engine.get(
                reportId
            );

        if (!report) {
            this.onNotify(
                "Relatório não encontrado."
            );
            return false;
        }

        this.currentReportId =
            report.id;

        this._invalidateHtmlShareCache();
        this._invalidatePdfShareCache();
        this._htmlSharePrepareToken += 1;
        const prepareToken = this._htmlSharePrepareToken;
        this._previewCycleStats = {
            render: 0,
            prepareHtml: 0,
            preparePdf: 0,
            status: 0,
            logged: false
        };
        this._setHtmlShareBusy(true);
        if (global.__AURORA_ANDROID__ !== true) {
            this._setPdfShareBusy(true);
        }
        this.notifyExportStatus("");

        this.modal
            .querySelector(
                "[data-report-preview-code]"
            )
            .textContent =
                this._publicReportId(
                    report
                );

        this.modal.classList.add(
            "is-open"
        );

        document.body.classList.add(
            "aurora-report-open"
        );

        this._previewReadyPromise =
            this._prepareHtmlShareAfterOpen(
                report,
                prepareToken
            )
                .finally(() => {
                    this._previewReadyPromise =
                        null;
                });

        return true;
    }

    async openAsync(reportId) {
        const opened =
            this.open(reportId);

        if (!opened) {
            return false;
        }

        await this.ensurePreviewReady();
        return true;
    }

    async _hydratePersistedPhotos(report) {
        const store = global.auroraEvidenceStore;
        const snapshot = report && report.snapshot ? report.snapshot : {};
        const references = Array.isArray(snapshot.evidence_groups)
            ? snapshot.evidence_groups
            : [];

        if (!store || typeof store.get !== "function" || !references.length) {
            return null;
        }

        const hydrated = JSON.parse(JSON.stringify(report));
        const groups = [];

        for (const reference of references) {
            if (!reference || !reference.id) continue;
            const stored = await store.get(reference.id);
            groups.push(stored ? { ...reference, ...stored } : reference);
        }

        hydrated.snapshot = hydrated.snapshot || {};
        hydrated.snapshot.evidence_groups = groups;

        /*
         * A foto de capa pode ter sido persistida apenas como referência
         * (source_photo_id) para não duplicar a imagem no relatório.
         * Ao reidratar as evidências, reconstruímos o src a partir da foto
         * original. Isso mantém a escolha "Usar como foto de capa"
         * funcional também após reabrir um relatório compacto.
         */
        const coverReference = hydrated.coverPhoto || hydrated.cover_photo ||
            (hydrated.snapshot && (hydrated.snapshot.coverPhoto || hydrated.snapshot.cover_photo)) || null;
        if (coverReference && typeof coverReference === "object") {
            const sourceId = String(coverReference.source_photo_id || "").trim();
            if (!String(coverReference.src || "").trim()) {
                let sourcePhoto = null;
                for (const group of groups) {
                    const photos = Array.isArray(group && group.photos) ? group.photos : [];
                    if (sourceId) sourcePhoto = photos.find((photo) => photo && String(photo.id || "") === sourceId) || null;
                    const isCoverGroup = String(group && group.linked_entity_type || "") === "report_cover" ||
                        String(group && group.record_kind || "") === "report_cover_photo";
                    if (!sourcePhoto && isCoverGroup && photos.length) sourcePhoto = photos[0];
                    if (sourcePhoto) break;
                }
                const sourceSrc = sourcePhoto ? String(sourcePhoto.edited_src || sourcePhoto.src || sourcePhoto.url || "").trim() : "";
                if (sourceSrc) {
                    hydrated.coverPhoto = {
                        ...coverReference,
                        src: sourceSrc,
                        alt: coverReference.alt || sourcePhoto.title || "Foto de capa do relatório",
                        source_photo_id: coverReference.source_photo_id || sourcePhoto.id || null
                    };
                    hydrated.snapshot = hydrated.snapshot || {};
                    hydrated.snapshot.coverPhoto = { ...hydrated.coverPhoto };
                }
            }
        }

        hydrated.occurrences = (Array.isArray(hydrated.occurrences) ? hydrated.occurrences : []).map((occurrence) => {
            const group = groups.find((item) => String(item.id) === String(occurrence.id));
            if (!group || !Array.isArray(group.photos)) return occurrence;
            return {
                ...occurrence,
                photos: group.photos.map((photo) => ({
                    ...photo,
                    occurrence_id: group.id,
                    src: photo.edited_src || photo.src || null
                }))
            };
        });
        hydrated.evidences = hydrated.occurrences.flatMap((occurrence) => occurrence.photos || []);

        return hydrated;
    }

    close() {
        this._htmlSharePrepareToken += 1;
        this._invalidateHtmlShareCache();
        this._invalidatePdfShareCache();
        this._setHtmlShareBusy(false);
        this._setPdfShareBusy(false);

        if (!this.modal) {
            return;
        }

        this.modal.classList.remove(
            "is-open"
        );

        document.body.classList.remove(
            "aurora-report-open"
        );
    }

    closeAndReturnHome() {
        if (this._htmlShareClickGuard || this._pdfShareClickGuard) {
            return;
        }

        this.close();

        try {
            global.dispatchEvent(new CustomEvent("aurora:completed-report-closed"));
        } catch (error) {
            console.warn("Aurora: não foi possível iniciar a sincronização automática do relatório.", error);
        }

        /* R24 — quando a prévia foi aberta sobre uma Home já montada, fechar o
         * overlay é suficiente. Não desmontar/remontar a Home; o auto-sync segue
         * em background e publicará aurora:completed-report-refresh ao terminar. */
        const mountedHome = document.querySelector(".aurora-home-layer");
        if (mountedHome && !mountedHome.hidden &&
            global.getComputedStyle(mountedHome).display !== "none") {
            return;
        }

        if (
            global.AuroraHomeReturnTrace &&
            typeof global.AuroraHomeReturnTrace.setNextHomeOrigin === "function"
        ) {
            global.AuroraHomeReturnTrace.setNextHomeOrigin(
                "REPORT_RETURN",
                "PREVIEW_CLOSE"
            );
        }

        const runtime = global.auroraRuntime;
        const shell = runtime && runtime.shell;

        if (shell && typeof shell.showHome === "function") {
            shell.showHome();
            return;
        }

        if (
            global.AuroraProfileNavigation &&
            typeof global.AuroraProfileNavigation.goHome === "function"
        ) {
            global.AuroraProfileNavigation.goHome();
            return;
        }

        const home = document.querySelector(
            "[data-footer-home],[data-topbar-home]"
        );

        if (home) {
            home.click();
        }
    }

    _debugLogPrintStageDiagnostic(stage) {
        if (!stage) {
            console.warn("=== AURORA PRINT DIAGNOSTIC === stage ausente");
            return;
        }

        const documentNode =
            this.modal &&
            this.modal.querySelector("[data-report-document]");

        const formatRect = (rect) => ({
            top: Number(rect.top.toFixed(2)),
            bottom: Number(rect.bottom.toFixed(2)),
            height: Number(rect.height.toFixed(2))
        });

        const formatBox = (element) => {
            if (!element) {
                return null;
            }

            const rect = element.getBoundingClientRect();
            const styles = window.getComputedStyle(element);

            return {
                ...formatRect(rect),
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
                offsetHeight: element.offsetHeight,
                overflow: styles.overflow,
                heightCss: styles.height,
                minHeight: styles.minHeight,
                maxHeight: styles.maxHeight
            };
        };

        const stageAccent =
            window.getComputedStyle(stage).getPropertyValue("--report-accent").trim();
        const documentAccent = documentNode
            ? window.getComputedStyle(documentNode).getPropertyValue("--report-accent").trim()
            : "";

        console.group("=== AURORA PRINT DIAGNOSTIC ===");
        console.log("Momento: palco montado e estabilizado, imediatamente antes de window.print()");
        console.log("Stage visibility:", window.getComputedStyle(stage).visibility);
        console.log("Total de paginas simuladas:", stage.querySelectorAll(".aurora-print-page").length);

        console.log("CSS:");
        console.log("  --report-accent print-stage:", stageAccent || "(vazio)");
        console.log("  --report-accent report-document:", documentAccent || "(vazio)");

        const pages = Array.from(stage.querySelectorAll(".aurora-print-page"));
        const checklistPages = pages.filter((page) =>
            page.querySelector(".aurora-report-section--vehicle-checklist")
        );

        if (!checklistPages.length) {
            console.warn("Nenhuma pagina simulada contem .aurora-report-section--vehicle-checklist");
        }

        checklistPages.forEach((page, index) => {
            const pageNumber =
                pages.indexOf(page) + 1;
            const content =
                page.querySelector(".aurora-print-page__content");
            const footer =
                page.querySelector(".aurora-print-page__footer");
            const checklist =
                page.querySelector(".aurora-report-section--vehicle-checklist");
            const rows =
                checklist
                    ? checklist.querySelectorAll(".aurora-report-status-row")
                    : [];
            const meta =
                checklist &&
                checklist.querySelector(".aurora-report-status-list__meta");
            const head =
                checklist &&
                checklist.querySelector(".aurora-report-section__head");
            const beforeStyles = head
                ? window.getComputedStyle(head, "::before")
                : null;

            const pageRect = page.getBoundingClientRect();
            const contentRect = content
                ? content.getBoundingClientRect()
                : null;
            const footerRect = footer
                ? footer.getBoundingClientRect()
                : null;
            const checklistRect = checklist
                ? checklist.getBoundingClientRect()
                : null;

            const fitsContentBottom = Boolean(
                checklistRect &&
                contentRect &&
                checklistRect.bottom <= contentRect.bottom + 2
            );
            const fitsFooterTop = Boolean(
                checklistRect &&
                footerRect &&
                checklistRect.bottom <= footerRect.top + 2
            );
            const scrollOverflow = Boolean(
                content &&
                content.scrollHeight > content.clientHeight + 2
            );
            const checklistBottomMinusFooterTop =
                checklistRect && footerRect
                    ? Number((checklistRect.bottom - footerRect.top).toFixed(2))
                    : null;

            console.group(`Pagina ${pageNumber} (checklist ${index + 1}/${checklistPages.length})`);

            console.log("PAGE:");
            console.log(formatRect(pageRect));

            console.log("CONTENT:");
            console.log(formatBox(content));

            console.log("FOOTER:");
            console.log(formatBox(footer));

            console.log("CHECKLIST:");
            console.log({
                ...formatRect(checklistRect || { top: 0, bottom: 0, height: 0 }),
                statusRows: rows.length,
                printKeepTogether: checklist
                    ? checklist.dataset.printKeepTogether || "(ausente)"
                    : "(sem checklist)",
                metaConsultorEntradaPresente: Boolean(meta)
            });

            console.log("RESULTADO:");
            console.log({
                fits_contentBottom: fitsContentBottom,
                fits_footerTop: fitsFooterTop,
                scrollOverflow: scrollOverflow,
                checklistBottom_minus_footerTop: checklistBottomMinusFooterTop
            });

            console.log("CSS ::before do titulo do checklist:");
            console.log(beforeStyles
                ? {
                    content: beforeStyles.content,
                    display: beforeStyles.display,
                    width: beforeStyles.width,
                    height: beforeStyles.height,
                    background: beforeStyles.background,
                    visibility: beforeStyles.visibility,
                    opacity: beforeStyles.opacity,
                    flexShrink: beforeStyles.flexShrink,
                    printColorAdjust: beforeStyles.printColorAdjust ||
                        beforeStyles.getPropertyValue("-webkit-print-color-adjust")
                }
                : "(head ausente)");

            console.groupEnd();
        });

        console.group("Resumo global de status rows por pagina");
        pages.forEach((page, index) => {
            console.log(`Pagina ${index + 1}:`, {
                statusRows: page.querySelectorAll(".aurora-report-status-row").length,
                hasChecklist: Boolean(
                    page.querySelector(".aurora-report-section--vehicle-checklist")
                ),
                hasMeta: Boolean(
                    page.querySelector(".aurora-report-status-list__meta")
                )
            });
        });
        console.groupEnd();

        console.groupEnd();
    }

    _debugLogPrintMediaDiagnostic(stage, captureLabel = "BEFOREPRINT") {
        if (!stage) {
            console.warn("=== AURORA PRINT MEDIA DIAGNOSTIC === stage ausente");
            return;
        }

        const documentNode =
            this.modal &&
            this.modal.querySelector("[data-report-document]");

        const printMediaActive =
            window.matchMedia("print").matches;

        const formatRect = (rect) => ({
            top: Number(rect.top.toFixed(2)),
            bottom: Number(rect.bottom.toFixed(2)),
            height: Number(rect.height.toFixed(2))
        });

        const stageAccent =
            window.getComputedStyle(stage).getPropertyValue("--report-accent").trim();
        const documentAccent = documentNode
            ? window.getComputedStyle(documentNode).getPropertyValue("--report-accent").trim()
            : "";

        const pages = Array.from(stage.querySelectorAll(".aurora-print-page"));
        const checklistPage = pages.find((page) =>
            page.querySelector(".aurora-report-section--vehicle-checklist")
        );

        console.group("=== AURORA PRINT MEDIA DIAGNOSTIC ===");
        console.log(
            printMediaActive
                ? "CAPTURA: PRINT MEDIA ACTIVE"
                : `CAPTURA: ${captureLabel}`
        );
        console.log("matchMedia('print').matches:", printMediaActive);
        console.log(
            "Nota: o Chrome aplica @media print no documento original no beforeprint; " +
            "nao e possivel inspecionar o DOM interno do preview nativo de impressao."
        );

        if (!checklistPage) {
            console.warn("Nenhuma pagina simulada contem checklist.");
            console.groupEnd();
            return;
        }

        const pageNumber = pages.indexOf(checklistPage) + 1;
        const page = checklistPage;
        const content = page.querySelector(".aurora-print-page__content");
        const footer = page.querySelector(".aurora-print-page__footer");
        const checklist = page.querySelector(".aurora-report-section--vehicle-checklist");
        const rows = checklist
            ? checklist.querySelectorAll(".aurora-report-status-row")
            : [];
        const meta = checklist &&
            checklist.querySelector(".aurora-report-status-list__meta");
        const head = checklist &&
            checklist.querySelector(".aurora-report-section__head");
        const checklistStyles = checklist
            ? window.getComputedStyle(checklist)
            : null;
        const pageStyles = page
            ? window.getComputedStyle(page)
            : null;
        const contentStyles = content
            ? window.getComputedStyle(content)
            : null;
        const beforeStyles = head
            ? window.getComputedStyle(head, "::before")
            : null;

        const checklistRect = checklist
            ? checklist.getBoundingClientRect()
            : null;
        const contentRect = content
            ? content.getBoundingClientRect()
            : null;
        const footerRect = footer
            ? footer.getBoundingClientRect()
            : null;

        const fitsFooterTop = Boolean(
            checklistRect &&
            footerRect &&
            checklistRect.bottom <= footerRect.top + 2
        );

        console.log(`Pagina simulada com checklist: ${pageNumber}`);

        console.log("CHECKLIST DOM:");
        console.log({
            statusRows: rows.length,
            metaConsultorEntradaPresente: Boolean(meta),
            printKeepTogether: checklist
                ? checklist.dataset.printKeepTogether || "(ausente)"
                : "(ausente)"
        });

        console.log("BREAK / OVERFLOW COMPUTADO:");
        console.log({
            checklist_breakInside: checklistStyles
                ? checklistStyles.breakInside
                : "(ausente)",
            checklist_pageBreakInside: checklistStyles
                ? checklistStyles.pageBreakInside
                : "(ausente)",
            page_overflow: pageStyles ? pageStyles.overflow : "(ausente)",
            content_overflow: contentStyles ? contentStyles.overflow : "(ausente)"
        });

        console.log("GEOMETRIA:");
        console.log("  CHECKLIST:", checklistRect ? formatRect(checklistRect) : "(ausente)");
        console.log("  CONTENT:", contentRect ? formatRect(contentRect) : "(ausente)");
        console.log("  FOOTER top:", footerRect ? footerRect.top.toFixed(2) : "(ausente)");
        console.log("  checklist.bottom <= footer.top:", fitsFooterTop);
        if (checklistRect && footerRect) {
            console.log(
                "  checklistBottom_minus_footerTop:",
                Number((checklistRect.bottom - footerRect.top).toFixed(2))
            );
        }

        console.log("CSS VARIABLES:");
        console.log("  --report-accent .aurora-print-stage:", stageAccent || "(vazio)");
        console.log("  --report-accent .aurora-report-document:", documentAccent || "(vazio)");

        console.log("CSS ::before do titulo do checklist:");
        console.log(beforeStyles
            ? {
                content: beforeStyles.content,
                width: beforeStyles.width,
                height: beforeStyles.height,
                background: beforeStyles.background,
                backgroundColor: beforeStyles.backgroundColor,
                backgroundImage: beforeStyles.backgroundImage,
                display: beforeStyles.display,
                printColorAdjust: beforeStyles.printColorAdjust ||
                    beforeStyles.getPropertyValue("-webkit-print-color-adjust")
            }
            : "(head ausente)");

        console.groupEnd();
    }

    _debugAttachPrintMediaDiagnostic(stage) {
        if (!stage) {
            return;
        }

        let capturedPrintMedia = false;

        const capture = (captureLabel) => {
            if (
                capturedPrintMedia &&
                captureLabel !== "PRINT MEDIA ACTIVE"
            ) {
                return;
            }

            if (captureLabel === "PRINT MEDIA ACTIVE") {
                capturedPrintMedia = true;
            }

            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    this._debugLogPrintMediaDiagnostic(stage, captureLabel);
                });
            });
        };

        const beforePrintHandler = () => {
            capture(
                window.matchMedia("print").matches
                    ? "PRINT MEDIA ACTIVE"
                    : "BEFOREPRINT"
            );
        };

        window.addEventListener("beforeprint", beforePrintHandler, { once: true });

        if (window.matchMedia) {
            const printQuery = window.matchMedia("print");
            const mediaChangeHandler = (event) => {
                if (!event.matches) {
                    return;
                }

                capture("PRINT MEDIA ACTIVE");

                if (typeof printQuery.removeEventListener === "function") {
                    printQuery.removeEventListener("change", mediaChangeHandler);
                } else if (typeof printQuery.removeListener === "function") {
                    printQuery.removeListener(mediaChangeHandler);
                }
            };

            if (typeof printQuery.addEventListener === "function") {
                printQuery.addEventListener("change", mediaChangeHandler);
            } else if (typeof printQuery.addListener === "function") {
                printQuery.addListener(mediaChangeHandler);
            }
        }
    }

    async _printCurrent() {
        if (!this.modal || !this.currentReportId) {
            return;
        }

        const report =
            this.engine.get(
                this.currentReportId
            );

        const documentNode =
            this.modal.querySelector(
                "[data-report-document]"
            );

        if (!report || !documentNode) {
            return;
        }

        const oldStage =
            this.modal.querySelector(
                "[data-report-print-stage]"
            );

        if (oldStage) {
            oldStage.remove();
        }

        const images =
            Array.from(
                documentNode.querySelectorAll("img")
            );

        await Promise.all(
            images.map((image) => {
                if (image.complete) {
                    return Promise.resolve();
                }

                return new Promise((resolve) => {
                    image.addEventListener("load", resolve, { once: true });
                    image.addEventListener("error", resolve, { once: true });
                });
            })
        );

        await this._syncPreviewMediaLayouts(documentNode);

        const stage =
            await this._buildPrintStage(
                documentNode,
                report
            );

        /*
         * Duas pinturas dão ao WebView tempo para aplicar as dimensões em mm
         * e calcular as alturas reais antes de a caixa de impressão abrir.
         */
        await new Promise((resolve) =>
            requestAnimationFrame(() =>
                requestAnimationFrame(resolve)
            )
        );

        this._debugLogPrintStageDiagnostic(stage);
        this._debugAttachPrintMediaDiagnostic(stage);

        window.print();

        /*
         * No Android, createPrintDocumentAdapter pode consumir o DOM depois
         * que window.print() retorna. Mantemos o palco oculto ate a proxima
         * impressao/abertura, quando ele e substituido com seguranca.
         */
    }

    async _buildPrintStage(documentNode, report) {
        const measureHost = await this._ensurePdfMeasureHost();
        measureHost.innerHTML = "";

        const stage = document.createElement("div");
        const isEletricaTupyPrint = this._isEletricaTupyReport(report);
        stage.className = [
            "aurora-print-stage",
            "aurora-print-stage--pdf-export",
            isEletricaTupyPrint ? "aurora-print-stage--eletrica-tupy" : ""
        ].filter(Boolean).join(" ");
        stage.setAttribute("data-report-print-stage", "");
        measureHost.appendChild(stage);
        this._printPaginationLog = [];
        this._printAuditTrace = [];

        const sourceCover =
            documentNode.querySelector(
                ".aurora-report-cover"
            );

        const sourceBody =
            documentNode.querySelector(
                ".aurora-report-body"
            );

        const units =
            this._printUnits(sourceBody);

        let page =
            this._createPrintPage(
                report,
                true,
                sourceCover
            );

        stage.appendChild(page.element);

        let pageIndex = 1;
        this._syncActivePrintPageVisibility(stage, pageIndex);

        for (const unit of units) {
            let queue = [{ node: unit, onFreshPage: false }];

            while (queue.length) {
                const { node, onFreshPage } = queue.shift();
                this._syncActivePrintPageVisibility(stage, pageIndex);
                const beforeMetrics = this._getPrintContentMetrics(page.content);

                page.content.appendChild(node);
                await this._settlePrintUnit(node);

                const afterMetrics = this._getPrintContentMetrics(page.content);
                const unitBox = this._measurePrintUnitBox(node);

                this._logPrintAuditEntry({
                    event: onFreshPage ? "append-fresh-page" : "append",
                    pageIndex,
                    unit: this._describePrintUnit(node),
                    unitNode: node,
                    remainingBefore: beforeMetrics.remainingHeight,
                    remainingAfter: afterMetrics.remainingHeight,
                    usableHeight: beforeMetrics.availableHeight,
                    unitBox,
                    keepTogether: node.dataset.printKeepTogether === "1",
                    printAtomic: node.dataset.printAtomic || null,
                    breakBefore: node.dataset.printBreakBefore === "1",
                    breakAfter: node.dataset.printBreakAfter === "1"
                });

                if (!this._printUnitNeedsReflow(page.content, node)) {
                    continue;
                }

                const overflow = this._printContentOverflows(page.content);
                const keepTogetherMiss =
                    node.dataset.printKeepTogether === "1" &&
                    !this._printUnitFitsInContent(page.content, node);
                const breakReason = overflow
                    ? "overflow"
                    : keepTogetherMiss
                        ? "keepTogether"
                        : "reflow";

                node.remove();

                /*
                 * Tupy: preserve primeiro a composição calculada pelo HTML.
                 * Só fragmentamos uma unidade se ela também não couber em uma
                 * página A4 vazia. Isso evita transformar uma linha de duas
                 * fotos em duas linhas apenas porque a página anterior terminou.
                 */
                if (isEletricaTupyPrint && !onFreshPage) {
                    this._logPrintPageBreak(
                        page.content,
                        node,
                        `${breakReason}_preserve_html`,
                        pageIndex
                    );

                    page = this._createPrintPage(report, false, null);
                    stage.appendChild(page.element);
                    pageIndex += 1;
                    this._syncActivePrintPageVisibility(stage, pageIndex);
                    queue.unshift({ node, onFreshPage: true });
                    continue;
                }

                const splitUnits = this._trySplitPrintUnit(node);

                if (splitUnits.length > 1) {
                    this._logPrintPageBreak(
                        page.content,
                        node,
                        `${breakReason}_split`,
                        pageIndex
                    );

                    splitUnits.reverse().forEach((splitUnit) => {
                        queue.unshift({ node: splitUnit, onFreshPage: false });
                    });
                    continue;
                }

                /*
                 * Prioridade editorial: mover a unidade inteira para a proxima
                 * pagina antes de fragmentar. Fragmentar so depois que a pagina
                 * nova ainda nao comporta o card completo.
                 */
                if (!onFreshPage) {
                    this._logPrintPageBreak(
                        page.content,
                        node,
                        breakReason,
                        pageIndex
                    );

                    page =
                        this._createPrintPage(
                            report,
                            false,
                            null
                        );

                    stage.appendChild(page.element);
                    pageIndex += 1;
                    this._syncActivePrintPageVisibility(stage, pageIndex);
                    queue.unshift({ node, onFreshPage: true });
                    continue;
                }

                if (node.dataset.printKeepTogether === "1") {
                    /*
                     * Unidade atomica maior que uma pagina A4: permanece inteira
                     * na pagina nova, sem fragmentar nem reintroduzir parcialmente
                     * na pagina anterior.
                     */
                    page.content.appendChild(node);
                    await this._settlePrintUnit(node);
                    continue;
                }

                page.content.appendChild(node);
                await this._settlePrintUnit(node);
            }
        }

        const pages =
            Array.from(
                stage.querySelectorAll(
                    ".aurora-print-page"
                )
            );

        pages.forEach((pageNode, index) => {
            pageNode.classList.toggle("aurora-print-page--last", index === pages.length - 1);
            const number =
                pageNode.querySelector(
                    "[data-print-page-number]"
                );

            if (number) {
                number.textContent =
                    `Pagina ${index + 1} de ${pages.length}`;
            }
        });

        this._syncActivePrintPageVisibility(stage, 1);

        this._debugLogPaginationMetrics(stage);
        this._renderPrintDebugOverlay(stage);

        if (Array.isArray(this._printAuditTrace) && this._printAuditTrace.length) {
            global.__AURORA_PRINT_AUDIT__ = this._printAuditTrace.slice();
        }

        if (this.modal) {
            const existingStage =
                this.modal.querySelector("[data-report-print-stage]");

            if (existingStage) {
                existingStage.remove();
            }

            this.modal.appendChild(stage);
        }

        measureHost.innerHTML = "";

        return stage;
    }

    _cleanupPrintExportArtifacts() {
        if (this.modal) {
            this.modal
                .querySelectorAll("[data-report-print-stage]")
                .forEach((node) => node.remove());
        }

        const measureHost = document.getElementById("aurora-pdf-measure-host");

        if (measureHost) {
            measureHost.innerHTML = "";
        }

        const frame = document.getElementById("aurora-pdf-measure-frame");

        if (frame && frame.contentDocument) {
            const frameHost = frame.contentDocument.getElementById("aurora-pdf-measure-host");

            if (frameHost) {
                frameHost.innerHTML = "";
            }
        }
    }

    _renderPrintDebugOverlay(stage) {
        if (!stage || global.__AURORA_PRINT_DEBUG__ !== true) {
            return;
        }

        stage.querySelectorAll(".aurora-print-debug-overlay, .aurora-print-debug-unit-tag").forEach((node) => {
            node.remove();
        });

        Array.from(stage.querySelectorAll(".aurora-print-page")).forEach((pageNode, pageIndex) => {
            const content = pageNode.querySelector(".aurora-print-page__content");

            if (!content) {
                return;
            }

            const metrics = this._getPrintContentMetrics(content);
            const overlay = document.createElement("div");
            overlay.className = "aurora-print-debug-overlay";
            overlay.textContent =
                `P${pageIndex + 1} usable ${metrics.availableHeight}px · used ${metrics.usedHeight}px · rest ${metrics.remainingHeight}px`;
            content.appendChild(overlay);

            Array.from(content.children).forEach((child, unitIndex) => {
                if (child.classList.contains("aurora-print-debug-overlay")) {
                    return;
                }

                const box = this._measurePrintUnitBox(child);
                const tag = document.createElement("div");
                tag.className = "aurora-print-debug-unit-tag";
                tag.textContent =
                    `#${unitIndex + 1} ${this._describePrintUnit(child)} · ${box.offsetHeight}px`;
                child.appendChild(tag);
            });
        });
    }

    async _settlePrintUnit(unit) {
        if (
            document.fonts &&
            typeof document.fonts.ready !== "undefined"
        ) {
            try {
                await document.fonts.ready;
            } catch (error) {
                /* noop */
            }
        }

        const images =
            Array.from(
                unit.querySelectorAll("img")
            );

        await Promise.all(
            images.map(async (image) => {
                if (image.complete) {
                    if (typeof image.decode === "function") {
                        try {
                            await image.decode();
                        } catch (error) {
                            /* noop */
                        }
                    }

                    return;
                }

                await new Promise((resolve) => {
                    image.addEventListener("load", resolve, { once: true });
                    image.addEventListener("error", resolve, { once: true });
                });

                if (typeof image.decode === "function") {
                    try {
                        await image.decode();
                    } catch (error) {
                        /* noop */
                    }
                }
            })
        );

        await new Promise((resolve) =>
            requestAnimationFrame(() =>
                requestAnimationFrame(resolve)
            )
        );
    }

    _printUnits(sourceBody) {
        if (!sourceBody) {
            return [];
        }

        const units = [];

        const bodyChildren = Array.from(sourceBody.children);

        for (let childIndex = 0; childIndex < bodyChildren.length; childIndex += 1) {
            const child = bodyChildren[childIndex];

            if (
                child.classList.contains(
                    "aurora-report-section--records"
                )
            ) {
                const heading = child.querySelector(
                    ":scope > .aurora-report-section__head, :scope > h2"
                );
                const vehiclePhotoSection = child.querySelector(
                    ":scope > .aurora-vehicle-photo-section"
                );

                /*
                 * Na vistoria veicular, o titulo e a grade principal formam
                 * uma unidade editorial. Mantê-los juntos evita uma pagina
                 * com apenas "Registros tecnicos" no rodape e garante que a
                 * grade 2 x 2 seja medida como um unico bloco A4.
                 */
                if (vehiclePhotoSection) {
                    this._buildVehicleGuidedPhotoPrintUnits(
                        heading,
                        vehiclePhotoSection
                    ).forEach((printUnit) => units.push(printUnit));

                    Array.from(child.children)
                        .filter((node) =>
                            node !== heading &&
                            node !== vehiclePhotoSection
                        )
                        .forEach((node) => {
                            if (!node.classList.contains("aurora-vehicle-additional-records")) {
                                units.push(node.cloneNode(true));
                                return;
                            }

                            this._buildVehicleAdditionalPrintUnits(node).forEach(
                                (printUnit) => units.push(printUnit)
                            );
                        });

                    continue;
                }

                if (heading) {
                    const headingUnit = document.createElement("section");
                    headingUnit.className = "aurora-report-section aurora-report-section--records aurora-print-records-title";
                    const headingClone = heading.cloneNode(true);
                    if (
                        headingClone.tagName === "H2" &&
                        !headingClone.closest(".aurora-report-section__head")
                    ) {
                        const head = document.createElement("header");
                        head.className = "aurora-report-section__head";
                        head.appendChild(headingClone);
                        headingUnit.appendChild(head);
                    } else {
                        headingUnit.appendChild(headingClone);
                    }
                    units.push(headingUnit);
                }

                const records =
                    Array.from(
                        child.children
                    ).filter((node) =>
                        node !== heading
                    );

                records.forEach((record) => {
                    this._buildOccurrencePrintUnits(record).forEach((printUnit) => {
                        units.push(printUnit);
                    });
                });

                continue;
            }

            if (child.querySelector(".aurora-report-fact-sheet__row")) {
                this._buildSheetRowPrintUnits(
                    child,
                    ".aurora-report-fact-sheet",
                    ".aurora-report-fact-sheet__row",
                    "aurora-print-fact-row"
                ).forEach((printUnit) => units.push(printUnit));
                continue;
            }

            if (child.querySelector(".aurora-report-spec-sheet__row")) {
                this._buildSheetRowPrintUnits(
                    child,
                    ".aurora-report-spec-sheet",
                    ".aurora-report-spec-sheet__row",
                    "aurora-print-spec-row"
                ).forEach((printUnit) => units.push(printUnit));
                continue;
            }

            if (child.classList.contains("aurora-report-section--vehicle-checklist")) {
                this._buildChecklistPrintUnits(child).forEach((printUnit) => {
                    units.push(printUnit);
                });
                continue;
            }

            if (
                child.classList.contains("aurora-report-section--tupy-materials") ||
                child.classList.contains("aurora-report-section--tupy-service-codes")
            ) {
                this._buildTupyMaterialsPrintUnits(child).forEach((printUnit) => {
                    units.push(printUnit);
                });
                continue;
            }

            if (child.classList.contains("aurora-report-section--tupy-final-photo")) {
                this._buildTupyFinalWorkPhotoPrintUnits(child).forEach((printUnit) => {
                    units.push(printUnit);
                });
                continue;
            }
            if (child.classList.contains("aurora-report-section--intake-summary")) {
                this._buildIntakeSummaryPrintUnits(child).forEach((printUnit) => {
                    units.push(printUnit);
                });
                continue;
            }

            if (child.classList.contains("aurora-report-section--diagnostic")) {
                const nextChild = bodyChildren[childIndex + 1];

                if (
                    nextChild &&
                    nextChild.classList.contains("aurora-report-section--conclusion")
                ) {
                    this._buildDiagnosticPrintUnits(child).forEach((printUnit) => {
                        units.push(printUnit);
                    });

                    const conclusionUnit = nextChild.cloneNode(true);
                    conclusionUnit.dataset.printKeepTogether = "1";
                    units.push(conclusionUnit);
                    childIndex += 1;
                    continue;
                }
            }

            const sectionUnit = child.cloneNode(true);

            if (sectionUnit.classList.contains("aurora-report-section--conclusion")) {
                sectionUnit.dataset.printKeepTogether = "1";
            }

            units.push(sectionUnit);
        }

        return units;
    }

    _createPrintPage(report, firstPage, sourceCover) {
        const page = document.createElement("section");
        page.className = `aurora-print-page${firstPage ? " aurora-print-page--first" : ""}`;

        if (firstPage && sourceCover) {
            const cover = sourceCover.cloneNode(true);
            cover.classList.add("aurora-print-page__cover");
            page.appendChild(cover);
        }

        const content = document.createElement("div");
        content.className = "aurora-print-page__content";
        page.appendChild(content);

        const company = report.company || {};
        const isTupy = this._isEletricaTupyReport(report);
        const activeServiceName = String((report.service && (report.service.title || report.service.name)) || report.service_name || "").trim();
        const footer = document.createElement("footer");
        footer.className = "aurora-print-page__footer";
        footer.innerHTML = [
            '<div class="aurora-print-footer__brand">',
            isTupy
                ? "<strong>Atividades Rotineiras Tupy</strong>"
                : `<strong>${this._escape(company.name || "AURORA")}</strong>`,
            isTupy
                ? '<span class="aurora-footer-generated">by Aurora</span>'
                : `<span class="aurora-footer-generated">${activeServiceName ? this._escape(activeServiceName) + " · " : ""}Gerado pela plataforma AURORA</span>`,
            '</div>',
            '<div class="aurora-print-footer__date" data-print-issued-date>',
            isTupy ? "<span>DATA DE EMISSÃO</span>" : "<span>EMITIDO EM</span>",
            `<b>${this._formatDate(new Date().toISOString())}</b>`,
            '</div>',
            '<div class="aurora-print-footer__code">',
            isTupy ? "<span>NÚMERO DO RELATÓRIO</span>" : "<span>RELATORIO</span>",
            `<b>${this._escape(this._publicReportId(report))}</b>`,
            '<small data-print-page-number></small>',
            '</div>'
        ].join("");
        page.appendChild(footer);

        return {
            element: page,
            content
        };
    }

    _validationStableValue(value) {
        if (Array.isArray(value)) return value.map((item) => this._validationStableValue(item));
        if (!value || typeof value !== "object") return value;
        const out = {};
        Object.keys(value).sort().forEach((key) => {
            if (["validation", "saved_at", "synced_at", "updated_at", "created_at", "storage_key", "sync_status"].includes(String(key).toLowerCase())) return;
            out[key] = this._validationStableValue(value[key]);
        });
        return out;
    }

    async _validationHash(report) {
        if (!global.crypto || !global.crypto.subtle || !global.TextEncoder) return "";
        const source = {
            report_number: this._publicReportId(report),
            profile_id: report.profile_id || (report.snapshot && report.snapshot.profile_id) || "",
            service: report.service || (report.snapshot && report.snapshot.service) || {},
            customer: report.customer || {}, asset: report.asset || {}, intake: report.intake || {},
            occurrences: report.occurrences || [], diagnostic: report.diagnostic || {}, approval: report.approval || {},
            budget: report.budget || (report.snapshot && report.snapshot.budget) || {},
            custom_values: report.custom_values || {}, company: this._resolveReportCompany(report)
        };
        const bytes = new TextEncoder().encode(JSON.stringify(this._validationStableValue(source)));
        const digest = await global.crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    async _ensurePublicValidation(report) {
        const serviceId = String((report.service && report.service.id) || (report.snapshot && report.snapshot.service && report.snapshot.service.id) || "").toLowerCase();
        const profileId = report.profile_id || (report.snapshot && report.snapshot.profile_id) || (report.service && report.service.profile) || "workshop";
        if (!this._isUniversalGenericReport(profileId, serviceId)) {
            return report;
        }
        if (report.validation && report.validation.public_token && report.validation.validation_code) {
            return report;
        }
        const cloud = global.AuroraCloudSync;
        const cfg = global.AURORA_CLOUD_CONFIG || {};
        let client = (cloud && cloud.client) || global.AURORA_SUPABASE_CLIENT || null;

        /* V3: o relatório pode abrir antes de AuroraCloudSync publicar o client global.
         * Nesse caso usamos o mesmo Supabase JS/configuração já carregados pela Aurora. */
        if ((!client || typeof client.rpc !== "function") &&
            global.supabase && typeof global.supabase.createClient === "function" &&
            cfg.url && cfg.anon_key) {
            client = global.supabase.createClient(cfg.url, cfg.anon_key, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
            });
        }

        if (!client || typeof client.rpc !== "function") {
            throw new Error("Cliente Supabase indisponível para registrar a validação.");
        }
        if (client.auth && typeof client.auth.getSession === "function") {
            const sessionResult = await client.auth.getSession();
            if (sessionResult && sessionResult.error) {
                throw sessionResult.error;
            }
            if (!sessionResult || !sessionResult.data || !sessionResult.data.session) {
                throw new Error("Sessão Aurora indisponível para registrar a validação.");
            }
        }

        const hash = await this._validationHash(report);
        if (!hash) {
            throw new Error("SHA-256 indisponível para registrar a validação.");
        }
        const company = this._resolveReportCompany(report);
        /* V2: a empresa é resolvida dentro do Supabase a partir da sessão autenticada.
         * O frontend não fornece company_id e não depende mais do timing do claim/cache. */
        const result = await client.rpc("aurora_report_validation_create_v2", {
            p_report_number: this._publicReportId(report),
            p_document_hash: hash,
            p_service_code: serviceId || null,
            p_service_name: (report.service && report.service.title) || null,
            p_issuer_company_name: company.name || null,
            p_issuer_display_name: company.professional || null
        });
        if (result.error) throw result.error;
        const row = Array.isArray(result.data) ? result.data[0] : result.data;
        if (!row || !row.public_token) {
            throw new Error("Supabase não retornou o token público da validação.");
        }
        report.validation = {
            public_token: row.public_token,
            validation_code: row.validation_code,
            revision: row.revision,
            issued_at: row.issued_at,
            document_hash: hash,
            url: global.location.origin.replace(/\/$/, "") + "/validar?token=" + encodeURIComponent(row.public_token)
        };
        this.engine.save(report);
        return report;
    }

    _validationQrSvg(url) {
        if (!url || !global.AuroraQRCode) return "";
        try {
            const qr = new global.AuroraQRCode(-1, 1);
            qr.addData(url); qr.make();
            const n = qr.getModuleCount(), quiet = 4, size = n + quiet * 2;
            let path = "";
            for (let r=0;r<n;r++) for (let c=0;c<n;c++) if (qr.isDark(r,c)) path += `M${c+quiet} ${r+quiet}h1v1h-1z`;
            return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR Code de validação"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#102d46"/></svg>`;
        } catch (_) { return ""; }
    }

    _commercialValueEnabled(profileId, serviceId) {
        const profile = String(profileId || "").toLowerCase();
        const service = String(serviceId || "").toLowerCase();
        return this._isUniversalGenericReport(profileId, serviceId) &&
            profile !== "condominiums" &&
            service !== "vehicle_inspection" &&
            service !== "eletrica_tupy";
    }

    _formatCommercialValue(value) {
        const raw = String(value == null ? "" : value).trim();
        if (!raw) return "";
        let normalized = raw.replace(/\s/g, "").replace(/^R\$/i, "");
        if (normalized.includes(",") && normalized.includes(".")) normalized = normalized.replace(/\./g, "").replace(",", ".");
        else if (normalized.includes(",")) normalized = normalized.replace(",", ".");
        normalized = normalized.replace(/[^\d.-]/g, "");
        const n = Number(normalized);
        if (!Number.isFinite(n)) return raw;
        try { return n.toLocaleString("pt-BR", {style:"currency",currency:"BRL"}); }
        catch (_) { return "R$ " + n.toFixed(2).replace(".", ","); }
    }

    _renderCommercialValueSection(report, approval, profileId, serviceId) {
        if (!this._commercialValueEnabled(profileId, serviceId)) return "";
        const budget = Object.assign({}, (report.snapshot && report.snapshot.budget) || {}, report.budget || {});
        const show = String(budget.show_on_report || approval.show_commercial_value || "").trim().toLowerCase();
        if (show !== "sim") return "";

        const items = Array.isArray(budget.items)
            ? budget.items.filter((item) => item && (String(item.description || "").trim() || String(item.value || "").trim()))
            : [];
        const legacyValue = approval.commercial_value;
        const totalValue = budget.total_value || legacyValue;
        const formattedTotal = this._formatCommercialValue(totalValue);
        if (!items.length && !formattedTotal) return "";

        const rows = items.map((item) => [
            '<div class="aurora-report-budget__row">',
            `<span>${this._escape(String(item.description || "Serviço").trim() || "Serviço")}</span>`,
            `<strong>${this._escape(this._formatCommercialValue(item.value))}</strong>`,
            '</div>'
        ].join("")).join("");

        const notes = String(budget.notes || approval.commercial_notes || "").trim();
        const legacyType = String(approval.commercial_value_type || "Orçamento").trim() || "Orçamento";

        return this._section(
            items.length ? "Orçamento / serviços" : "Valor / orçamento",
            [
                '<div class="aurora-report-commercial-value aurora-report-budget">',
                items.length ? rows : `<span class="aurora-report-commercial-value__type">${this._escape(legacyType)}</span>`,
                formattedTotal ? `<div class="aurora-report-budget__total"><span>Valor total</span><strong>${this._escape(formattedTotal)}</strong></div>` : "",
                notes ? `<p>${this._escape(notes)}</p>` : "",
                '</div>'
            ].join(""),
            "commercial-value"
        );
    }

    _renderBudgetSignatureSection(report, profileId, serviceId) {
        if (!this._commercialValueEnabled(profileId, serviceId)) return "";
        const budget = Object.assign({}, (report.snapshot && report.snapshot.budget) || {}, report.budget || {});
        const signature = String(budget.signature_data || "").trim();
        if (!budget.collect_signature || !signature || !/^data:image\/png;base64,/i.test(signature)) return "";
        return this._section(
            "Assinatura do cliente",
            [
                '<div class="aurora-report-signature">',
                `<img src="${this._escape(signature)}" alt="Assinatura do cliente">`,
                '<span>Assinatura coletada na finalização do orçamento / serviços.</span>',
                '</div>'
            ].join(""),
            "client-signature"
        );
    }

    _renderValidationSection(report, profileId, serviceId, forceSharedValidation) {
        if ((!forceSharedValidation && !this._isUniversalGenericReport(profileId, serviceId)) || !report.validation || !report.validation.public_token) return "";
        const v = report.validation, qr = this._validationQrSvg(v.url);
        return [
            '<section class="aurora-report-validation">',
            '<div class="aurora-report-validation__copy"><span>VALIDAÇÃO DO DOCUMENTO</span><strong>Documento registrado e verificável</strong><p>Escaneie o QR Code ou use o código para conferir este registro na plataforma Aurora.</p>',
            `<b>Código de validação: ${this._escape(v.validation_code || "")}</b></div>`,
            qr ? `<div class="aurora-report-validation__qr">${qr}</div>` : "",
            '</section>'
        ].join("");
    }

    _renderGroundingDocument(report) {
        const snap = (report && report.snapshot) || {};
        const g = snap.grounding || {};
        const ident = g.identification || {};
        const method = g.method || {};
        const customer = report.customer || snap.customer || {};
        const company = this._resolveReportCompany(report);
        const points = Array.isArray(g.points) ? g.points : [];
        const approval = Object.assign({}, snap.approval || {}, report.approval || {});
        const title = ident.title || approval.report_title || 'Relatório técnico de aterramento e equipotencialização';
        const coverPhoto = this._resolveCoverPhoto({...report,coverPhoto:report.coverPhoto||snap.coverPhoto||null});
        const esc = value => this._escape(String(value == null ? '' : value));
        const fact = (label,value) => value ? `<div class="aurora-report-fact"><strong class="aurora-report-fact__value">${esc(value)}</strong><span class="aurora-report-fact__label">${esc(label)}</span></div>` : '';
        const factSheet = items => {
            const clean = items.filter(Boolean);
            const rows=[];
            for(let i=0;i<clean.length;i+=2) rows.push(`<div class="aurora-report-fact-sheet__row">${clean[i]}${clean[i+1]||''}</div>`);
            return `<div class="aurora-report-fact-sheet">${rows.join('')}</div>`;
        };
        const text = value => {
            if (!value) return '';
            // Preserva a estrutura autoral: cada quebra de linha digitada vira um parágrafo real.
            // A Aurora não reescreve nem cria conteúdo; apenas aplica diagramação documental.
            const paragraphs = String(value).replace(/\r\n?/g,'\n').split(/\n+/).map(x=>x.trim()).filter(Boolean);
            return paragraphs.map(paragraph=>`<p class="aurora-grounding-copy">${esc(paragraph)}</p>`).join('');
        };
        const numberedSection = (number,title,content,key) => content ? this._section(`${number}. ${title}`,content,key) : '';
        const vals = points.map(p=>Number(String(p.value||'').replace(',','.'))).filter(Number.isFinite);
        const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(3).replace('.',',') : '';
        const max = vals.length ? Math.max(...vals).toFixed(3).replace('.',',') : '';
        const standardCatalog = {
            'NBR-5410:2004': {name:'ABNT NBR 5410:2004',description:'Instalações elétricas em baixa tensão'},
            'ABNT NBR 5410': {name:'ABNT NBR 5410:2004',description:'Instalações elétricas em baixa tensão'},
            'NBR-5419:2015': {name:'ABNT NBR 5419:2015',description:'Proteção de estruturas contra descargas atmosféricas'},
            'ABNT NBR 5419': {name:'ABNT NBR 5419:2015',description:'Proteção de estruturas contra descargas atmosféricas'},
            'NBR-15749:2009': {name:'ABNT NBR 15749:2009',description:'Medição de resistência e de potenciais na superfície do solo em sistemas de aterramento'},
            'ABNT NBR 15749': {name:'ABNT NBR 15749:2009',description:'Medição de resistência e de potenciais na superfície do solo em sistemas de aterramento'},
            'NR 10:2004': {name:'NR 10:2004',description:'Segurança em instalações e segurança em eletricidade'},
            'NR-10': {name:'NR 10:2004',description:'Segurança em instalações e segurança em eletricidade'}
        };
        const standards = String(method.applicable_standards || '').split(/[;•\n]+/).map(x=>x.trim()).filter(Boolean).map(item=>{
            const parts=item.split(/\s+[—-]\s+/);
            const name=(parts.shift()||item).trim();
            let description=parts.join(' — ').trim();
            if(!description){
                const normalized=name.toUpperCase().replace(/\s+/g,' ').trim();
                const hit=Object.keys(standardCatalog).find(k=>normalized===k.toUpperCase() || normalized.includes(k.toUpperCase()));
                if(hit){
                    const catalogItem=standardCatalog[hit];
                    description=catalogItem.description;
                    return {name:catalogItem.name,description};
                }
            }
            const normalized=name.toUpperCase().replace(/\s+/g,' ').trim();
            const hit=Object.keys(standardCatalog).find(k=>normalized===k.toUpperCase() || normalized.includes(k.toUpperCase()));
            if(hit){
                const catalogItem=standardCatalog[hit];
                return {name:catalogItem.name,description:description||catalogItem.description};
            }
            return {name,description};
        });
        const persistedPointsLayout = g.report_points_layout || report.report_points_layout || (report.grounding && report.grounding.report_points_layout) || approval.report_points_layout || '';
        const reportPointsLayout = persistedPointsLayout === 'table_b2' ? 'table_b2' : 'cards';
        const pointTable = points.length ? [
            '<div class="aurora-grounding-table-shell"><table class="aurora-grounding-table"><thead><tr><th>Reg.</th><th>Ponto / item inspecionado</th><th>Valor medido</th><th>Referência</th><th>Condição</th><th>Parecer</th></tr></thead><tbody>',
            points.map((p,i)=>`<tr><td class="aurora-grounding-table__reg">${String(i+1).padStart(2,'0')}</td><td class="aurora-grounding-table__point"><strong>${esc(p.category || p.description || 'Ponto de aferição')}</strong>${p.description && p.description !== p.category ? `<span>${esc(p.description)}</span>` : ''}</td><td class="aurora-grounding-table__measure">${esc(p.value ? `${p.value} Ω` : '')}</td><td class="aurora-grounding-table__measure aurora-grounding-table__reference">${esc((p.reference || g.reference_value) ? `${p.reference || g.reference_value} Ω` : '')}</td><td class="aurora-grounding-table__condition">${esc(p.condition || '')}</td><td class="aurora-grounding-table__status">${esc(p.opinion || '')}</td></tr>`).join(''),
            '</tbody></table></div>'
        ].join('') : '<div class="aurora-report-empty-section">Nenhum ponto de aferição registrado.</div>';
        const pointCards = points.length ? points.map((p,i)=>[
            '<article class="aurora-report-record-card aurora-grounding-point aurora-grounding-point--model-a" style="display:block;margin:0;overflow:hidden;border:1px solid #dce6ec;border-radius:12px;background:#fafcfd">',
            `<header class="aurora-grounding-point__header" style="display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:24px;align-items:center;padding:14px 16px 13px;border-bottom:1px solid #e8eef2;background:#fff"><div class="aurora-grounding-point__identity" style="display:grid;gap:8px;min-width:0"><span class="aurora-grounding-point__record" style="display:block;color:#66778b;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">REGISTRO ${String(i+1).padStart(2,'0')}</span><h3 style="margin:0;font-size:16px;line-height:1.3;color:#172235">${esc(p.description || p.category || 'Ponto de aferição')}</h3></div>${(p.condition||p.opinion)?`<div class="aurora-grounding-point__status" style="display:grid;gap:6px;justify-items:end;text-align:right;padding-left:18px;border-left:1px solid #e4eaee"><span style="display:block;color:#66778b;font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">CONDIÇÃO / PARECER</span><strong style="display:block;font-size:12px;line-height:1.35;color:#126f69">${esc([p.condition,p.opinion].filter(Boolean).join(' · '))}</strong></div>`:''}</header>`,
            `<div class="aurora-grounding-point__measurements" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;padding:14px 16px 12px">${fact('Valor medido',p.value ? `${p.value} Ω` : '')}${fact('Referência informada',(p.reference || g.reference_value) ? `${p.reference || g.reference_value} Ω` : '')}</div>`,
            `${(p.category||p.observation)?`<div class="aurora-grounding-point__details" style="display:grid;gap:8px;padding:0 16px 15px">${p.category?`<div class="aurora-grounding-point__detail" style="display:grid;gap:5px"><span style="display:block;color:#66778b;font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">LOCALIZAÇÃO / DESCRIÇÃO TÉCNICA</span><strong style="display:block;font-size:12px;line-height:1.45;color:#172235">${esc(p.category)}</strong></div>`:''}${p.observation?`<p style="margin:0;padding-top:8px;border-top:1px solid #eef2f5;color:#526579;font-size:11px;line-height:1.5">${esc(p.observation)}</p>`:''}</div>`:''}`,
            '</article>'
        ].join('')).join('') : '<div class="aurora-report-empty-section">Nenhum ponto de aferição registrado.</div>';
        const evidenceItems = points.flatMap((p,i)=>{
            const photos=Array.isArray(p.photos)?p.photos.filter(Boolean):[];
            return photos.map((src,j)=>{
                const recordLabel = `Registro ${String(i+1).padStart(2,'0')}`;
                const pointLabel = p.description || p.category || 'Ponto de aferição';
                const photoDescription = p.photo_descriptions&&p.photo_descriptions[j] ? p.photo_descriptions[j] : '';
                return `<figure class="aurora-grounding-evidence-card"><div class="aurora-grounding-evidence-card__frame"><img src="${this._escapeAttribute(src)}" alt="Evidência do registro ${i+1}"></div><figcaption><strong>${esc(recordLabel)} — ${esc(pointLabel)}</strong>${photoDescription?`<span>${esc(photoDescription)}</span>`:''}</figcaption></figure>`;
            });
        });
        const evidenceBlocks = evidenceItems.length ? `<div class="aurora-grounding-evidence-grid">${evidenceItems.join('')}</div>` : '';
        const footerId = this._publicReportId(report);
        const identification = factSheet([
            fact('Cliente',customer.name),fact('CNPJ',customer.document),fact('Endereço',customer.address),fact('Telefone',customer.phone),fact('E-mail',customer.email),
            fact('Unidade',ident.unit),fact('Setor / instalação',ident.sector),fact('Número do laudo',ident.report_number),
            fact('Número da ART',ident.art),fact('Data da vistoria',ident.date),fact('Responsável técnico',ident.technical_responsible),
            fact('Registro profissional',ident.professional_registration)
        ]);
        const systemData = factSheet([
            fact('Configuração do sistema',method.system_type),fact('Tipo de edificação',method.building_type),
            fact('Tipo de solo',method.soil_type),fact('Haste / eletrodo',method.rod_type),
            fact('Condutor / malha',method.conductor),fact('Tipo de conexão',method.connection_type),
            fact('Tipo de inspeção',method.inspection_type),fact('Valor de referência',g.reference_value ? `${g.reference_value} Ω` : ''),
            fact('Comprimento',method.building_length ? `${method.building_length} m` : ''),fact('Largura',method.building_width ? `${method.building_width} m` : ''),
            fact('Perímetro',method.building_perimeter ? `${method.building_perimeter} m` : ''),fact('Área de exposição',method.exposure_area ? `${method.exposure_area} m²` : '')
        ]);
        const instrumentData = factSheet([
            fact('Fabricante do instrumento',method.instrument_make),fact('Modelo',method.instrument_model),
            fact('Nº de série',method.instrument_serial),fact('Calibração / certificado',method.calibration)
        ]);
        const objectiveBlock = method.objective ? `<div class="aurora-grounding-text-block aurora-grounding-text-block--documental">${text(method.objective)}</div>` : '';
        const scopeBlock = method.generalities ? `<div class="aurora-grounding-text-block aurora-grounding-text-block--documental">${text(method.generalities)}</div>` : '';
        const standardsBlock = standards.length ? `<div class="aurora-grounding-standards aurora-grounding-standards--documental">${standards.map((item,index)=>`<div class="aurora-grounding-standard"><strong>${esc(item.name)}</strong>${item.description?`<span>${esc(item.description)}</span>`:''}</div>`).join('')}</div>` : '';
        const methodologyBlock = [instrumentData ? `<div class="aurora-grounding-instrument-block">${instrumentData}</div>` : '', method.methodology ? `<div class="aurora-grounding-text-block aurora-grounding-text-block--documental">${text(method.methodology)}</div>` : '', method.protection_level_notes ? `<div class="aurora-grounding-text-block aurora-grounding-text-block--documental"><span class="aurora-grounding-subhead">Nível de proteção / gerenciamento de risco</span>${text(method.protection_level_notes)}</div>` : ''].filter(Boolean).join('');
        const generalReference = Number(String(g.reference_value || '').replace(',','.'));
        const hasGeneralReference = Number.isFinite(generalReference);
        let withinReference = 0;
        let requiresAttention = 0;
        points.forEach(p => {
            const measured = Number(String(p.value || '').replace(',','.'));
            const localReference = Number(String(p.reference || g.reference_value || '').replace(',','.'));
            if (!Number.isFinite(measured) || !Number.isFinite(localReference)) return;
            if (measured <= localReference) withinReference += 1;
            else requiresAttention += 1;
        });
        const measurementSummary = factSheet([
            fact('Pontos aferidos',String(points.length)),
            fact('Pontos com fotos',String(points.filter(p=>Array.isArray(p.photos)&&p.photos.length).length)),
            fact('Valor médio',avg?`${avg} Ω`:''),
            fact('Maior valor medido',max?`${max} Ω`:''),
            fact('Referência geral',g.reference_value?`${g.reference_value} Ω`:''),
            fact('Dentro da referência',String(withinReference)),
            fact('Requer atenção / intervenção',String(requiresAttention))
        ]);
        return [
            this._renderReportCover(company,title,report.operation_type_label,coverPhoto,{technicalDescription:'Inspeção técnica em campo, aferições, evidências fotográficas, resumo técnico e finalização.'}),
            '<div class="aurora-report-body aurora-grounding-report">',
            numberedSection(1,'Identificação do contratante e da inspeção',identification,'identification'),
            numberedSection(2,'Objeto do laudo',objectiveBlock,'grounding-objective'),
            numberedSection(3,'Escopo da inspeção',scopeBlock,'grounding-scope'),
            numberedSection(4,'Referências normativas',standardsBlock,'grounding-standards'),
            numberedSection(5,'Caracterização do sistema',systemData,'technical'),
            numberedSection(6,'Instrumentação e metodologia',methodologyBlock,'instrument'),
            numberedSection(7,'Resultados das aferições',[measurementSummary, reportPointsLayout === 'table_b2' ? pointTable : `<div class="aurora-grounding-point-grid" style="display:grid;grid-template-columns:1fr;gap:14px">${pointCards}</div>`].join(''),'records'),
            evidenceBlocks ? numberedSection(8,'Registro fotográfico',evidenceBlocks,'grounding-evidence') : '',
            g.recommendations ? numberedSection(9,'Recomendações técnicas',`<div class="aurora-grounding-text-block aurora-grounding-text-block--documental">${text(g.recommendations)}</div>`,'grounding-recommendations') : '',
            g.conclusion ? numberedSection(10,'Conclusão técnica',`<div class="aurora-grounding-text-block aurora-grounding-text-block--documental">${text(g.conclusion)}</div>`,'conclusion') : '',
            `<div class="aurora-grounding-validation-numbered"><div class="aurora-grounding-validation-heading"><span>11.</span> RESPONSABILIDADE TÉCNICA E VALIDAÇÃO</div>${this._renderValidationSection(report, 'grounding_equipotentialization', 'grounding_equipotentialization', true)}</div>`,
            '</div>',
            '<footer class="aurora-report-document__footer"><div class="aurora-report-footer__brand"><strong>'+esc(company.name || 'AURORA')+'</strong><span class="aurora-footer-generated">by Aurora</span></div><div class="aurora-report-footer__date"><span>RELATÓRIO</span><b>'+esc(footerId)+'</b></div></footer>'
        ].join('');
    }

    renderDocument(report) {
        this._activeReport = report || {};

        const groundingServiceId = String((report.service && report.service.id) || (report.snapshot && report.snapshot.service && report.snapshot.service.id) || "").toLowerCase();
        if (["grounding", "grounding_equipotentialization"].includes(groundingServiceId)) {
            return this._renderGroundingDocument(report);
        }

        const customer =
            report.customer || {};

        const asset =
            report.asset || {};

        const intake =
            report.intake || {};

        const diagnostic =
            report.diagnostic || {};

        const approval = Object.assign(
            {},
            (report.snapshot &&
                report.snapshot.approval) ||
                {},
            report.approval || {}
        );

        const company =
            this._resolveReportCompany(report);

        const occurrences =
            Array.isArray(
                report.occurrences
            )
                ? report.occurrences
                : [];

        const serviceTitle =
            report.service &&
            report.service.title
                ? report.service.title
                : "Inspeção";

        /* O título do documento pertence ao usuário. O nome do serviço continua
           disponível nos dados técnicos, mas nunca substitui o título livre. */
        const reportTitle =
            this._resolveVehicleReportCoverTitle(
                report,
                approval,
                asset
            );

        const serviceId = String(
            (report.service && report.service.id) ||
            (report.snapshot && report.snapshot.service && report.snapshot.service.id) ||
            ""
        ).toLowerCase();

        const reportSectionTitle =
            report.record_section_title ||
            (report.snapshot && report.snapshot.record_section_title) ||
            "Registros técnicos";

        const flowTemplate =
            report.flow_template ||
            (report.service && report.service.flow_template) ||
            (report.snapshot && report.snapshot.flow_template) ||
            "technical";

        const isCustomService =
            Boolean(report.service && report.service.custom);

        const profileId =
            report.profile_id ||
            (report.snapshot && report.snapshot.profile_id) ||
            (report.service && report.service.profile) ||
            "workshop";

        const assetLabel = ({
            car_wash: "Veículo",
            upholstery_cleaning: "Item atendido",
            curtains_blinds: "Produto / ambiente",
            repairs_maintenance: "Local do serviço",
            workshop: "Veículo",
            electrical: "Ativo elétrico",
            industrial: "Equipamento",
            drone: "Local inspecionado"
        })[profileId] || "Ativo";

        const showInitialConditions =
            !isCustomService || flowTemplate === "technical";

        const showDiagnostic =
            !isCustomService || ["technical", "budget"].includes(flowTemplate);

        const occurrenceContent =
            serviceId === "vehicle_inspection"
                ? this._renderVehicleInspectionRecords(
                    occurrences
                )
                : occurrences.length
                    ? occurrences.map(
                        (occurrence, index) =>
                            this._renderTechnicalRecord(
                                occurrence,
                                index
                            )
                    ).join("")
                    : '<div class="aurora-report-empty-section">Nenhum registro adicionado.</div>';

        const companyMeta =
            [
                company.document,
                company.registration,
                company.phone,
                company.email,
                [company.city, company.state]
                    .filter(Boolean)
                    .join(" / ")
            ]
                .filter(Boolean)
                .join(" • ");

        const publicReportId =
            this._publicReportId(
                report
            );

        const coverPhoto =
            this._resolveCoverPhoto(report);
        const tupyState = this._isEletricaTupyReport(report)
            ? (this._resolveEletricaTupyState(report) || {})
            : {};
        const tupyOrders = Array.isArray(tupyState.admin_orders)
            ? tupyState.admin_orders.map((item) => String((item && item.numero) || item || "").trim()).filter(Boolean)
            : [];
        const tupyAdminReportNumber = String(tupyState.admin_report_number || "").trim();

        return [
            this._renderReportCover(
                company,
                reportTitle,
                report.operation_type_label,
                coverPhoto,
                {
                    isVehicleInspection: serviceId === "vehicle_inspection",
                    reportTitleSize: this._resolveReportTitleSize(approval),
                    reportTitleSizeClass: this._reportTitleSizeClass(
                        this._resolveReportTitleSize(approval)
                    ),
                    orderNumbers: tupyOrders,
                    adminReportNumber: tupyAdminReportNumber,
                    technicalDescription: this._isEletricaTupyReport(report)
                        ? "Registro técnico das atividades de infraestrutura elétrica executadas na Tupy, com evidências fotográficas, serviços realizados, materiais aplicados e conclusões."
                        : ""
                }
            ),

            '<div class="aurora-report-body">',

            serviceId === "vehicle_inspection"
                ? this._renderVehicleInspectionIdentification(
                    customer,
                    asset,
                    assetLabel,
                    company
                )
                : serviceId === "eletrica_tupy"
                    ? this._renderEletricaTupyIdentification(report, customer, asset)
                : this._renderReportIdentification(
                    customer,
                    company,
                    asset
                ),

            serviceId === "vehicle_inspection"
                ? this._renderVehicleInspectionSpec(asset)
                : serviceId === "eletrica_tupy"
                    ? ""
                : this._isUniversalGenericReport(profileId, serviceId)
                    ? this._renderUniversalDataSection(
                        serviceTitle || "Dados do serviço",
                        asset,
                        "asset",
                        { asset, intake, customer, company, serviceId, profileId }
                    )
                    : this._renderTechnicalDetailsSection({
                        asset,
                        intake,
                        customer,
                        company,
                        serviceId,
                        profileId
                    }),

            serviceId === "vehicle_inspection" && Object.keys(intake).length
                ? [
                    this._renderVehicleInspectionIntakeSummary(intake),
                    this._renderVehicleInspectionChecklist(
                        intake,
                        company,
                        report
                    )
                ].join("")
                : "",

            report.custom_values && Object.keys(report.custom_values).length
                ? this._section(
                    "Dados do serviço",
                    [
                        '<div class="aurora-report-info-grid">',
                        Object.entries(report.custom_values).map(([label, value]) =>
                            this._info(label, value || "Não informado")
                        ).join(""),
                        '</div>'
                    ].join(""),
                    "conditions"
                )
                : "",

            this._isUniversalGenericReport(profileId, serviceId) &&
            showInitialConditions && Object.keys(intake).length
                ? this._renderUniversalDataSection(
                    "Condições iniciais",
                    intake,
                    "intake",
                    { asset, intake, customer, company, serviceId, profileId }
                )
                : serviceId !== "vehicle_inspection" &&
                  serviceId !== "sofa_cleaning" &&
                  serviceId !== "eletrica_tupy" &&
                  showInitialConditions && Object.keys(intake).length &&
                  (intake.reason || intake.initial_condition || intake.notes)
                    ? this._section(
                        "Condições iniciais",
                        [
                            '<div class="aurora-report-summary">',
                            `<p>${this._escape(intake.reason || intake.initial_condition || intake.notes || "Condições iniciais registradas no atendimento.")}</p>`,
                            '</div>'
                        ].join("")
                    )
                    : "",

            serviceId === "eletrica_tupy"
                ? this._renderEletricaTupyActivitiesSection(report)
                : "",

            serviceId === "eletrica_tupy"
                ? this._renderEletricaTupyServiceCodesSection(report)
                : "",

            serviceId === "eletrica_tupy"
                ? this._renderEletricaTupyMaterialsSection(report)
                : "",

            ((serviceId === "eletrica_tupy" || this._isUniversalGenericReport(profileId, serviceId)) && !occurrences.length)
                ? ""
                : this._section(
                    reportSectionTitle,
                    occurrenceContent,
                    "records"
                ),

            (() => {
                const closingParts = [
                    (() => {
                        const workItems = Array.isArray(diagnostic.work_items) ? diagnostic.work_items.filter((item) => item && String(item.text || "").trim()) : [];
                        const enabled = this._isUniversalGenericReport(profileId, serviceId) &&
                            String(profileId || "").toLowerCase() !== "vehicle_inspection" &&
                            diagnostic.work_items_show_on_report !== false;
                        if (!enabled || !workItems.length) return "";
                        return this._section(
                            "Trabalhos a realizar",
                            ['<div class="aurora-report-work-plan">',
                             '<div class="aurora-report-work-plan__items">',
                             workItems.map((item) => `<div class="aurora-report-work-plan__item"><span>${item.done ? "☑" : "☐"}</span><strong>${this._escape(String(item.text || "").trim())}</strong></div>`).join(""),
                             '</div></div>'].join(""),
                            "work-plan"
                        );
                    })(),
                    showDiagnostic
                        ? this._section(
                            flowTemplate === "budget" ? "Resumo do orçamento" : "Diagnóstico e recomendação",
                            [
                                '<div class="aurora-report-diagnostic">',
                                '<article>',
                                '<span>Resumo técnico</span>',
                                `<p>${this._escape(
                                    serviceId === "eletrica_tupy" && diagnostic.conclusion
                                        ? diagnostic.conclusion
                                        : (diagnostic.summary || diagnostic.conclusion || "Nenhum resumo registrado.")
                                )}</p>`,
                                '</article>',
                                '<article>',
                                '<span>Recomendação</span>',
                                `<p>${this._escape(diagnostic.recommendation || this._allRecommendations(occurrences) || "Nenhuma recomendação registrada.")}</p>`,
                                '</article>',
                                '</div>'
                            ].join(""),
                            "diagnostic"
                        )
                        : "",
                    this._renderCommercialValueSection(report, approval, profileId, serviceId),
                    this._renderBudgetSignatureSection(report, profileId, serviceId),
                    this._section(
                        "Finalização",
                        [
                            '<div class="aurora-report-finalization aurora-report-finalization--documental">',
                            '<div class="aurora-report-finalization__status-line">',
                            '<span class="aurora-report-finalization__status-label">Status da inspeção</span>',
                            `<strong class="aurora-report-finalization__value aurora-report-finalization__value--complete">${this._escape(approval.status || report.status || "Concluído")}</strong>`,
                            '</div>',
                            '<div class="aurora-report-finalization__notes-block">',
                            '<span class="aurora-report-finalization__notes-label">Observação final</span>',
                            `<p>${this._escape(approval.notes || "Nenhuma observação adicional registrada.")}</p>`,
                            '</div>',
                            '</div>'
                        ].join(""),
                        "conclusion"
                    ),
                    approval.collect_signature && approval.signature_data
                        ? this._section(
                            "Assinatura do cliente",
                            `<div class="aurora-report-signature"><img src="${this._escape(approval.signature_data)}" alt="Assinatura do cliente"><span>Assinatura coletada na finalização do atendimento</span></div>`,
                            "signature"
                        )
                        : ""
                ].filter(Boolean);

                return closingParts.length
                    ? `<div class="aurora-report-closing-bundle">${closingParts.join("")}</div>`
                    : "";
            })(),
            this._renderValidationSection(report, profileId, serviceId),
            '</div>',

            '<footer class="aurora-report-document__footer">',
            '<div class="aurora-report-footer__brand">',
            serviceId === "eletrica_tupy"
                ? "<strong>Atividades Rotineiras Tupy</strong>"
                : `<strong>${this._escape(company.name || "AURORA")}</strong>`,
            serviceId === "eletrica_tupy"
                ? '<span class="aurora-footer-generated">by Aurora</span>'
                : '<span class="aurora-footer-generated">Gerado pela plataforma AURORA</span>',
            '</div>',
            '<div class="aurora-report-footer__date">',
            serviceId === "eletrica_tupy"
                ? "<span>DATA DE EMISSÃO</span>"
                : "<span>EMITIDO EM</span>",
            `<b>${this._formatDate(new Date().toISOString())}</b>`,
            '</div>',
            '<div class="aurora-report-footer__code">',
            serviceId === "eletrica_tupy"
                ? "<span>NÚMERO DO RELATÓRIO</span>"
                : "<span>RELATÓRIO</span>",
            `<b>${this._escape(publicReportId)}</b>`,
            '</div>',
            '</footer>'
        ].join("");
    }

    _renderMediaGallery(
        photos = [],
        options = {}
    ) {
        const items =
            this._filterReportEvidencePhotos(photos);

        if (!items.length) {
            return options.emptyHTML ||
                '<div class="aurora-report-empty-section">Nenhuma foto anexada a este registro.</div>';
        }

        const count = items.length;
        const layout = this._mediaLayoutCountClass(count);

        return [
            `<div class="aurora-report-media aurora-report-photos aurora-report-media--${layout} aurora-report-photos--${count === 1 ? "single" : "multiple"}" data-media-count="${count}">`,
            items.map((photo, photoIndex) => {
                const orientation = this._photoOrientation(photo);
                const alt =
                    photo.title ||
                    (options.altPrefix
                        ? `${options.altPrefix} - foto ${photoIndex + 1}`
                        : `Foto ${photoIndex + 1}`);

                return [
                    `<figure class="aurora-report-media-item${orientation !== "unknown" ? ` aurora-report-media-item--${this._escapeAttribute(orientation)}` : ""}">`,
                    '<div class="aurora-report-media-frame aurora-report-photo-frame">',
                    `<img src="${this._escapeAttribute(photo.src)}" alt="${this._escapeAttribute(alt)}"${this._photoDimensionAttrs(photo)}>`,
                    options.photoChip
                        ? `<span class="aurora-report-photo-card__chip">${this._escape(options.photoChip)}</span>`
                        : "",
                    '</div>',
                    options.caption
                        ? `<figcaption>${options.caption(photo, photoIndex)}</figcaption>`
                        : "",
                    '</figure>'
                ].join("");
            }).join(""),
            '</div>'
        ].join("");
    }

    _renderOccurrence(
        occurrence,
        index,
        options = {}
    ) {
        const photos =
            Array.isArray(
                occurrence.photos
            )
                ? occurrence.photos
                : [];

        const severity = String(occurrence.severity || "").trim();
        const showSeverity =
            this._activeReport ? this._activeReport.show_severity !== false : true;
        const showRecordLabels =
            this._activeReport ? this._activeReport.show_record_labels !== false : true;
        const normalizedSeverity = severity.toLowerCase();
        const hasSeverity =
            showSeverity && severity && !normalizedSeverity.startsWith("sem gravidade");

        const title = String(occurrence.title || "").trim();
        const isAutomaticTitle = /^(registro|ocorrência)\s+\d+$/i.test(title);
        const visibleTitle = title && (showRecordLabels || !isAutomaticTitle) ? title : "";

        const photoHTML =
            options.hidePhotos
                ? ""
                : this._renderDescriptionMediaGallery(photos, {
                    altPrefix: visibleTitle || title
                });
        const description = String(occurrence.description || "").trim();
        const recommendation = String(occurrence.recommendation || "").trim();
        const item = String(occurrence.item || "").trim();
        const headerHTML = showRecordLabels || hasSeverity
            ? [
                '<header class="aurora-report-occurrence__header">',
                showRecordLabels ? `<span>Registro ${index + 1}</span>` : '<span></span>',
                hasSeverity ? `<b data-severity="${this._escapeAttribute(severity.toLowerCase())}">${this._escape(severity)}</b>` : "",
                '</header>'
            ].join("")
            : "";
        const alertHTML = visibleTitle || item || description || recommendation
            ? [
                '<div class="aurora-report-alert">',
                visibleTitle ? `<h3>${this._escape(visibleTitle)}</h3>` : "",
                item ? `<small>${this._escape(item)}</small>` : "",
                description ? `<p>${this._escape(description)}</p>` : "",
                recommendation
                    ? `<div class="aurora-report-recommendation"><span>Recomendação</span><p>${this._escape(recommendation)}</p></div>`
                    : "",
                '</div>'
            ].join("")
            : "";

        return [
            '<article class="aurora-report-occurrence aurora-report-record-card aurora-report-record-card--issue">',
            headerHTML
                ? headerHTML.replace(
                    "aurora-report-occurrence__header",
                    "aurora-report-occurrence__header aurora-report-record-card__header"
                )
                : "",
            alertHTML
                ? `<div class="aurora-report-record-card__body">${alertHTML}</div>`
                : "",
            photoHTML,
            '</article>'
        ].join("");
    }

    _renderVehicleInspectionRecords(
        occurrences = []
    ) {
        const records =
            Array.isArray(occurrences)
                ? occurrences
                : [];

        const showRecordLabels =
            this._activeReport ? this._activeReport.show_record_labels !== false : true;

        const normalize = (value) =>
            String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();

        const isGuidedVehicleRecord = (record) =>
            Boolean(
                record &&
                record.record_kind === "vehicle_guided_photo" &&
                record.vehicle_photo_slot
            );

        const isCoverPhotoRecord = (record) =>
            Boolean(
                record &&
                record.record_kind === "report_cover_photo"
            );

        const isIssueLikeRecord = (record) => {
            if (
                !record ||
                isGuidedVehicleRecord(record) ||
                isCoverPhotoRecord(record)
            ) {
                return false;
            }

            const searchable = normalize([
                record.item,
                record.title,
                record.description
            ]
                .filter(Boolean)
                .join(" "));

            return /avaria|ocorren|dano|amassad|risco|arranh|trinc|quebrad|danific/.test(
                searchable
            );
        };

        const slots = [
            {
                key: "front",
                label: "Foto da frente",
                matches: (value) => /(^|\s)frente(\s|$)/.test(value)
            },
            {
                key: "right",
                label: "Foto da lateral direita",
                matches: (value) => /lateral direita|lado direito/.test(value)
            },
            {
                key: "rear",
                label: "Foto da traseira",
                matches: (value) => /(^|\s)traseira?(\s|$)|(^|\s)traseiro(\s|$)/.test(value)
            },
            {
                key: "left",
                label: "Foto da lateral esquerda",
                matches: (value) => /lateral esquerda|lado esquerdo/.test(value)
            }
        ];

        const selectedRecords = new Set();
        const selectedPhotoByRecord = new Map();

        const findRecordForSlot = (slot) => {
            const guidedIndex = records.findIndex((record, index) => {
                if (selectedRecords.has(index)) {
                    return false;
                }

                const photos = Array.isArray(record && record.photos)
                    ? record.photos
                    : [];

                return (
                    photos.length > 0 &&
                    isGuidedVehicleRecord(record) &&
                    record.vehicle_photo_slot === slot.key
                );
            });

            if (guidedIndex >= 0) {
                return guidedIndex;
            }

            return records.findIndex((record, index) => {
                if (selectedRecords.has(index)) {
                    return false;
                }

                if (isGuidedVehicleRecord(record) || isCoverPhotoRecord(record)) {
                    return false;
                }

                if (isIssueLikeRecord(record)) {
                    return false;
                }

                const photos = Array.isArray(record && record.photos)
                    ? record.photos
                    : [];
                const searchable = normalize([
                    record && record.title,
                    record && record.item
                ].filter(Boolean).join(" "));

                return photos.length > 0 && slot.matches(searchable);
            });
        };

        const chipLabels = {
            front: "Frente",
            right: "Lateral direita",
            rear: "Traseira",
            left: "Lateral esquerda"
        };

        const gallery = slots.map((slot, slotIndex) => {
            const recordIndex = findRecordForSlot(slot);
            const chipLabel = chipLabels[slot.key] || slot.label;

            if (recordIndex < 0) {
                return [
                    '<figure class="aurora-vehicle-photo is-missing">',
                    '<div class="aurora-vehicle-photo__placeholder aurora-report-media-frame">',
                    `<span class="aurora-vehicle-photo__chip">${this._escape(chipLabel)}</span>`,
                    'Foto não adicionada',
                    '</div>',
                    '<figcaption>',
                    showRecordLabels ? `<span>Registro ${slotIndex + 1}</span>` : "",
                    `<strong>${this._escape(slot.label)}</strong>`,
                    '</figcaption>',
                    '</figure>'
                ].join("");
            }

            selectedRecords.add(recordIndex);
            selectedPhotoByRecord.set(recordIndex, 0);
            const photo = records[recordIndex].photos[0];

            return [
                '<figure class="aurora-vehicle-photo">',
                '<div class="aurora-vehicle-photo__frame aurora-report-media-frame">',
                `<img src="${this._escapeAttribute(photo.src)}" alt="${this._escapeAttribute(slot.label)}"${this._photoDimensionAttrs(photo)}>`,
                `<span class="aurora-vehicle-photo__chip">${this._escape(chipLabel)}</span>`,
                '</div>',
                '<figcaption>',
                showRecordLabels ? `<span>Registro ${slotIndex + 1}</span>` : "",
                `<strong>${this._escape(slot.label)}</strong>`,
                '</figcaption>',
                '</figure>'
            ].join("");
        }).join("");

        const foundIssues = [];
        const complementary = [];
        let dashboardAdded = false;

        records.forEach((record, index) => {
            const photos = Array.isArray(record && record.photos) ? record.photos : [];
            const selectedPhotoIndex = selectedPhotoByRecord.get(index);
            const remainingPhotos = selectedPhotoIndex === undefined
                ? photos
                : photos.filter((photo, photoIndex) => photoIndex !== selectedPhotoIndex);

            if (selectedRecords.has(index)) {
                return;
            }

            if (isGuidedVehicleRecord(record) || isCoverPhotoRecord(record)) {
                /*
                 * Slots guiados e capa editorial nunca viram ocorrência/avaria.
                 * Painel/KM guiado entra no máximo uma vez em complementares.
                 */
                if (
                    record.vehicle_photo_slot === "dashboard" &&
                    remainingPhotos.length &&
                    !dashboardAdded
                ) {
                    dashboardAdded = true;
                    complementary.push({
                        ...record,
                        photos: remainingPhotos
                    });
                }

                return;
            }

            const searchable = normalize([
                record && record.title,
                record && record.item,
                record && record.description
            ].filter(Boolean).join(" "));
            /*
             * Painel/KM guiado usa record_kind + vehicle_photo_slot (branch acima).
             * Texto de ocorrência técnica ("Problema no painel", "KM incorreto")
             * descreve o defeito — não define categoria estrutural.
             */
            const isComplementary = /combust|document|chassi|placa|acessor|estepe|macaco|triangulo/.test(searchable);

            if (isComplementary) {
                complementary.push({
                    ...record,
                    photos: remainingPhotos
                });
                return;
            }

            foundIssues.push({
                ...record,
                photos: remainingPhotos
            });
        });

        const foundSection = foundIssues.length
            ? [
                `<section class="aurora-vehicle-additional-records aurora-vehicle-found-issues" data-record-count="${foundIssues.length}" data-orphan-card="${foundIssues.length % 2 === 1 && foundIssues.length > 1 ? "true" : "false"}">`,
                '<header class="aurora-vehicle-photo-section__header">',
                '<h3>Avarias encontradas</h3>',
                '<p>Ocorrências identificadas durante o recebimento do veículo.</p>',
                '</header>',
                foundIssues.map((record, index) =>
                    this._renderVehicleGroupedRecord(record, index, "issue")
                ).join(""),
                '</section>'
            ].join("")
            : "";

        const complementarySection = complementary.length
            ? [
                `<section class="aurora-vehicle-additional-records aurora-vehicle-complementary-records" data-record-count="${complementary.length}" data-orphan-card="${complementary.length % 2 === 1 && complementary.length > 1 ? "true" : "false"}">`,
                '<header class="aurora-vehicle-photo-section__header">',
                '<h3>Registros complementares</h3>',
                '<p>Painel, quilometragem e demais comprovações do recebimento.</p>',
                '</header>',
                complementary.map((record, index) =>
                    this._renderVehicleGroupedRecord(record, index, "complementary")
                ).join(""),
                '</section>'
            ].join("")
            : "";

        const additionalSections = foundIssues.length === 1 && complementary.length === 1
            ? `<div class="aurora-vehicle-record-pair">${foundSection}${complementarySection}</div>`
            : `${foundSection}${complementarySection}`;

        return [
            '<section class="aurora-vehicle-photo-section">',
            '<header class="aurora-vehicle-photo-section__header">',
            '<h3>Registro fotográfico do veículo</h3>',
            '<p>Sequência: frente, lateral direita, traseira e lateral esquerda.</p>',
            '</header>',
            `<div class="aurora-vehicle-photo-grid">${gallery}</div>`,
            '</section>',
            additionalSections
        ].join("");
    }

    _renderVehicleGroupedRecord(
        record,
        index,
        type = "issue"
    ) {
        const photos = Array.isArray(record && record.photos) ? record.photos : [];
        const title = String(record && record.title || "").trim() ||
            (type === "issue" ? "Avaria registrada" : "Registro complementar");
        const description = String(record && record.description || "").trim();
        const severity = String(record && record.severity || "").trim();
        const normalizedSeverity = severity.toLowerCase();
        const showSeverity = this._activeReport ? this._activeReport.show_severity !== false : true;
        const hasSeverity =
            showSeverity &&
            this._meaningfulSeverity(severity, type);
        const recommendation = String(record && record.recommendation || "").trim();
        const occurrenceNumber = String(index + 1).padStart(2, "0");
        const occurrenceLabel =
            type === "issue"
                ? `Ocorrência ${occurrenceNumber}`
                : `Registro ${occurrenceNumber}`;
        const isDashboardRecord = /painel|quilometr|odometr|hodometr|\bkm\b/i.test(title);
        const photosHTML = this._renderMediaGallery(photos, {
            emptyHTML: "",
            altPrefix: title,
            photoChip:
                type === "complementary" && isDashboardRecord
                    ? "Painel / KM"
                    : ""
        });

        return [
            `<article class="aurora-report-occurrence aurora-report-record-card aurora-report-record-card--${type} aurora-vehicle-record-card aurora-vehicle-record-card--${type}">`,
            '<header class="aurora-report-record-card__header aurora-report-occurrence__header">',
            `<span class="aurora-report-record-card__label">${this._escape(occurrenceLabel)}</span>`,
            hasSeverity
                ? `<b class="aurora-report-record-card__severity" data-severity="${this._escapeAttribute(normalizedSeverity)}">${this._escape(severity)}</b>`
                : "",
            '</header>',
            '<div class="aurora-report-record-card__body aurora-vehicle-record-card__content">',
            `<h3>${this._escape(title)}</h3>`,
            description ? `<p>${this._escape(description)}</p>` : "",
            '</div>',
            photosHTML,
            recommendation
                ? `<div class="aurora-report-record-card__recommendation aurora-report-recommendation"><span>Recomendação</span><p>${this._escape(recommendation)}</p></div>`
                : "",
            '</article>'
        ].join("");
    }

    _allRecommendations(
        occurrences
    ) {
        return occurrences
            .map(
                (occurrence) =>
                    occurrence.recommendation
            )
            .filter(Boolean)
            .join(" • ");
    }

    async shareCurrent() {
        if (global.__AURORA_ANDROID__ === true) {
            await this._sharePdfCurrent();
            return;
        }

        const report =
            this.engine.get(
                this.currentReportId
            );

        if (!report) {
            return;
        }

        const html =
            this._standaloneHTML(
                report
            );

        if (global.AuroraAndroid && typeof global.AuroraAndroid.shareReport === "function") {
            global.AuroraAndroid.shareReport(`${this._publicReportId(report)}.html`, html);
            return;
        }

        const file =
            new File(
                [html],
                `${this._publicReportId(report)}.html`,
                {
                    type:
                        "text/html"
                }
            );

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [file]
            })
        ) {
            try {
                await navigator.share({
                    title:
                        `Relatório ${this._publicReportId(report)}`,
                    text:
                        "Relatório técnico gerado pela AURORA.",
                    files:
                        [file]
                });

                return;
            } catch (error) {
                if (
                    error &&
                    error.name ===
                        "AbortError"
                ) {
                    return;
                }
            }
        }

        this._downloadFile(
            file
        );

        this.onNotify(
            "Relatório preparado para compartilhamento."
        );
    }

    async _buildStandaloneHtmlFromDocument(report, documentNode) {
        const clone = documentNode.cloneNode(true);

        if (
            global.AuroraPdfSerialize &&
            typeof global.AuroraPdfSerialize.inlineImagesForPdf === "function"
        ) {
            await global.AuroraPdfSerialize.inlineImagesForPdf(clone);
        }

        return this._standaloneHTML(report, clone.outerHTML);
    }

    _standaloneHTML(report, documentMarkup) {
        const company = this._resolveReportCompany(report);
        const footerCompany = this._isEletricaTupyReport(report)
            ? this._escapeCssContent("Atividades Rotineiras Tupy")
            : this._escapeCssContent(company.name || "AURORA");
        const footerUser = this._escapeCssContent(company.professional || "Usuário");
        const footerReport = this._escapeCssContent(this._publicReportId(report));
        const bodyMarkup = documentMarkup || this.renderDocument(report);

        return [
            '<!DOCTYPE html><html lang="pt-BR"><head>',
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width,initial-scale=1">',
            `<title>${this._escape(this._publicReportId(report))}</title>`,
            '<style>',
            'html{background:#fff;color-scheme:light}body{margin:0;background:#eef3f7!important;color:#172235!important;font-family:Arial,sans-serif}',
            'main{width:min(900px,100%);margin:auto;background:#fff!important;color:#172235!important}',
            '.aurora-report-cover{padding:42px;background:#102d46;color:#fff}',
            '.aurora-report-cover__header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}',
            '.aurora-report-cover--with-photo .aurora-report-cover__layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,75mm);gap:22px;align-items:start;margin-top:24px}',
            '.aurora-report-cover--with-photo{--aurora-cover-photo-max-width:calc(75mm * var(--aurora-cover-photo-scale,1));--aurora-cover-photo-max-height:calc(56mm * var(--aurora-cover-photo-scale,1))}',
            '.aurora-report-cover--with-photo .aurora-report-cover__content{margin-top:0;max-width:none}',
            '@media screen and (max-width:760px){.aurora-report-cover{padding:28px 22px}.aurora-report-cover--with-photo{--aurora-cover-photo-max-width:min(100%,260px);--aurora-cover-photo-max-height:180px}.aurora-report-cover--with-photo .aurora-report-cover__layout{grid-template-columns:1fr;gap:16px;margin-top:20px}.aurora-report-cover--with-photo .aurora-report-cover__content{min-width:0;max-width:100%}.aurora-report-cover--with-photo .aurora-report-cover__photo{justify-self:start;max-width:100%}.aurora-report-cover--with-photo .aurora-report-cover__photo img{max-width:100%;height:auto}.aurora-report-cover--refined h1{max-width:100%;overflow-wrap:anywhere}.aurora-report-cover__header{gap:10px}}',
            '.aurora-report-cover--with-photo h1{margin:8px 0 10px;font-size:34px;line-height:1.08}',
            '.aurora-report-cover--with-photo p{max-width:none;padding-right:0}',
            '.aurora-report-cover__logo-slot{margin:0;flex:0 0 auto}',
            '.aurora-report-cover__logo-slot .aurora-report-brand__logo{display:block;width:auto;height:auto;max-width:120px;max-height:48px;object-fit:contain}',
            '.aurora-report-cover__photo{margin:0;width:fit-content;max-width:var(--aurora-cover-photo-max-width,75mm);max-height:var(--aurora-cover-photo-max-height,56mm);padding:5px;border:1px solid rgba(100,240,229,.72);border-radius:10px;overflow:hidden;line-height:0;background:rgba(7,17,31,.34);box-sizing:border-box;box-shadow:0 8px 22px rgba(0,0,0,.16)}',
            '.aurora-report-cover__photo img{display:block;width:auto;height:auto;max-width:var(--aurora-cover-photo-max-width,75mm);max-height:var(--aurora-cover-photo-max-height,56mm);object-fit:contain;object-position:center center}',
            '.aurora-report-brand--cover{display:flex;align-items:center;gap:12px;min-width:0}.aurora-report-brand--cover .aurora-report-cover__logo-slot{margin:0;flex:0 0 auto}.aurora-report-brand--cover .aurora-report-cover__logo-slot .aurora-report-brand__logo{max-width:calc(48px * var(--aurora-report-logo-scale,1))!important;max-height:calc(48px * var(--aurora-report-logo-scale,1))!important;border-radius:10px;object-fit:contain}',
            '.aurora-report-cover__admin-meta{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 18px;margin-top:14px}.aurora-report-cover__orders,.aurora-report-cover__report-number{display:grid;gap:3px;min-width:0}.aurora-report-cover__orders{flex:1 1 260px}.aurora-report-cover__report-number{flex:0 1 auto}.aurora-report-cover__admin-meta span{color:#a9bcc8;font-size:9px;font-weight:800;letter-spacing:.10em;text-transform:uppercase}.aurora-report-cover__orders strong{color:#fff;font-size:13px;font-weight:750;line-height:1.35;overflow-wrap:anywhere}.aurora-report-cover__report-number strong{color:#d3e0e8;font-size:11px;font-weight:650;line-height:1.35;overflow-wrap:anywhere}',
            '.aurora-report-cover__content{margin-top:28px;max-width:700px}',
            '.aurora-report-brand{display:flex;gap:12px;align-items:center}.aurora-report-brand--text-only{gap:0}.aurora-report-brand__text{display:grid;gap:2px;min-width:0}',
            '.aurora-report-brand>span{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#64eee5;color:#07221f;font-weight:900}',
            '.aurora-report-brand__logo{display:block;width:auto!important;height:auto!important;max-width:150px!important;max-height:52px!important;object-fit:contain!important}',
            '.aurora-report-brand strong,.aurora-report-brand small{display:block}',
            '.aurora-report-brand strong{font-size:18px}',
            '.aurora-report-brand small,.aurora-report-brand__tagline{display:block;margin-top:3px;color:#a9c5d5;font-size:11px}',
            '.aurora-report-brand__name{display:block;font-size:18px}',
            '.aurora-report-brand--cover .aurora-report-brand__name{display:block;font-size:clamp(20px,3.2vw,24px);letter-spacing:-.02em}',
            '.aurora-report-cover--refined .aurora-report-brand__name{display:block}',
            '.aurora-report-brand--cover .aurora-report-brand__tagline{display:block;margin-top:4px;color:#b8d0de;font-size:clamp(10px,1.6vw,12px);letter-spacing:.04em}',
            '.aurora-report-cover--refined .aurora-report-cover__primary-title{display:block;margin:0;color:#dce8f0;font-size:18px;line-height:1.35;font-weight:650;letter-spacing:-.01em;word-wrap:break-word;overflow-wrap:anywhere;max-width:100%}',
            '.aurora-report-cover--refined .aurora-report-cover__title-size--small{font-size:14px;font-weight:600}',
            '.aurora-report-cover--refined .aurora-report-cover__title-size--normal{font-size:18px;font-weight:650}',
            '.aurora-report-cover--refined .aurora-report-cover__title-size--large{font-size:24px;font-weight:700}',
            '.aurora-report-cover--refined p:not(.aurora-report-cover__subtitle){display:none}',
            '.aurora-report-cover__kicker{color:#64f0e5;font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}',
            '.aurora-report-cover h1{font-size:42px;margin:70px 0 12px}',
            '.aurora-report-cover--refined h1{font-size:clamp(20px,3.6vw,28px);margin:0 0 12px;line-height:1.08}',
            '.aurora-report-body{padding:34px}',
            '.aurora-report-section{margin-bottom:30px}.aurora-report-section__head{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid #dde6ec}.aurora-report-section__head::before{content:"";width:3px;height:18px;border-radius:2px;background:#1d9189}.aurora-report-section__head h2,.aurora-report-section>h2{margin:0;border:0;padding:0;font-size:15px;font-weight:700}',
            '.aurora-report-section--tupy-materials{break-inside:auto;page-break-inside:auto}.aurora-report-section--tupy-materials>.aurora-report-section__head{break-after:avoid;page-break-after:avoid}.aurora-report-materials{width:100%;overflow:visible}.aurora-report-materials-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;line-height:1.35}.aurora-report-materials-table thead th{padding:8px 8px;border-bottom:1px solid #c9d6df;color:#66778b;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-align:left;background:#f4f8fa}.aurora-report-section--tupy-materials .aurora-report-materials-table th:nth-child(1),.aurora-report-section--tupy-materials .aurora-report-materials-table td:nth-child(1){width:16%}.aurora-report-section--tupy-materials .aurora-report-materials-table th:nth-child(2),.aurora-report-section--tupy-materials .aurora-report-materials-table td:nth-child(2){width:44%}.aurora-report-section--tupy-materials .aurora-report-materials-table th:nth-child(3),.aurora-report-section--tupy-materials .aurora-report-materials-table td:nth-child(3){width:22%;text-align:left}.aurora-report-section--tupy-materials .aurora-report-materials-table th:nth-child(4),.aurora-report-section--tupy-materials .aurora-report-materials-table td:nth-child(4){width:18%;text-align:right}.aurora-report-section--tupy-service-codes .aurora-report-materials-table th:nth-child(1),.aurora-report-section--tupy-service-codes .aurora-report-materials-table td:nth-child(1){width:15%}.aurora-report-section--tupy-service-codes .aurora-report-materials-table th:nth-child(2),.aurora-report-section--tupy-service-codes .aurora-report-materials-table td:nth-child(2){width:43%}.aurora-report-section--tupy-service-codes .aurora-report-materials-table th:nth-child(3),.aurora-report-section--tupy-service-codes .aurora-report-materials-table td:nth-child(3){width:16%}.aurora-report-section--tupy-service-codes .aurora-report-materials-table th:nth-child(4),.aurora-report-section--tupy-service-codes .aurora-report-materials-table td:nth-child(4){width:12%}.aurora-report-section--tupy-service-codes .aurora-report-materials-table th:nth-child(5),.aurora-report-section--tupy-service-codes .aurora-report-materials-table td:nth-child(5){width:14%;text-align:right}.aurora-report-materials-row{break-inside:avoid;page-break-inside:avoid}.aurora-report-materials-cell{padding:9px 8px;border-bottom:1px solid #e8eef2;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere}.aurora-report-materials-cell--sap{font-weight:700;font-variant-numeric:tabular-nums}.aurora-report-materials-cell--qty{font-variant-numeric:tabular-nums;white-space:nowrap}@media (max-width:720px){.aurora-report-body .aurora-report-materials{overflow-x:auto}.aurora-report-body .aurora-report-materials-table{min-width:420px}}',
            '.aurora-report-fact-sheet{display:grid;gap:18px}.aurora-report-fact-sheet__row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 28px;align-items:start}.aurora-report-fact{display:grid;gap:5px;align-content:start;align-self:start;min-width:0}.aurora-report-fact__value{font-size:15px;font-weight:650;letter-spacing:-.02em;line-height:1.3}.aurora-report-fact__label{color:#66778b;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.aurora-report-spec-sheet{display:grid;gap:16px}.aurora-report-spec-sheet__row{display:grid;gap:14px 20px;align-items:start}.aurora-report-spec-sheet__row--3{grid-template-columns:repeat(3,minmax(0,1fr));align-items:start}.aurora-report-spec-sheet__row--1{grid-template-columns:minmax(0,1fr);max-width:280px;align-items:start}.aurora-report-spec-cell{display:grid;gap:4px;align-content:start;align-self:start;min-width:0}.aurora-report-spec-cell__label{color:#66778b;font-size:9px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.aurora-report-spec-cell__value{font-size:13px;font-weight:600;line-height:1.35}.aurora-report-intake-summary{display:grid;gap:14px}.aurora-report-intake-summary__block{display:grid;gap:5px}.aurora-report-intake-summary__label{color:#66778b;font-size:9px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.aurora-report-intake-summary__value{margin:0;font-size:13px;line-height:1.5}.aurora-report-inline-sep{color:#9aabb8}.aurora-report-status-list{display:grid;border-top:1px solid #e8eef2}.aurora-report-status-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;padding:10px 0;border-bottom:1px solid #eef2f5}.aurora-report-status-row__label{font-size:12px;font-weight:500}.aurora-report-status-row__value{display:inline-flex;align-items:center;gap:7px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#66778b}.aurora-report-status-row__dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#c5d0da}.aurora-report-status-row__value[data-status="ok"]{color:#147259}.aurora-report-status-row__value[data-status="ok"] .aurora-report-status-row__dot{background:#1d9189;box-shadow:0 0 0 2px rgba(29,145,137,.14)}.aurora-report-status-row__value[data-status="attention"]{color:#8b5d00}.aurora-report-status-row__value[data-status="attention"] .aurora-report-status-row__dot{background:#d4a017}.aurora-report-status-row__value[data-status="repair"]{color:#a72038}.aurora-report-status-row__value[data-status="repair"] .aurora-report-status-row__dot{background:#d6455d}.aurora-report-status-list__meta{display:grid;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid #e8eef2}.aurora-report-status-list__meta p{display:grid;gap:3px;margin:0}.aurora-report-status-list__meta span{color:#66778b;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.aurora-report-status-list__meta strong{font-size:12px;font-weight:600}',
            '.aurora-report-info{display:inline-block;vertical-align:top;width:45%;margin:5px;padding:12px;background:#fff;border:0;border-radius:0}',
            '.aurora-report-info span,.aurora-report-info strong{display:block}',
            '.aurora-report-info span{font-size:12px;color:#718096}',
            '.aurora-report-occurrence__header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px}',
            '.aurora-report-occurrence__header>span{color:#718096;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}',
            '.aurora-report-occurrence__header b{padding:5px 9px;border-radius:999px;color:#8b5d00;background:#fff0bf;font-size:10px;font-weight:700;text-transform:uppercase}',
            '.aurora-report-occurrence__header b[data-severity*="alta"],.aurora-report-occurrence__header b[data-severity*="crítica"]{color:#a72038;background:#ffe0e6}',
            '.aurora-report-occurrence__header b[data-severity*="baixa"]{color:#147259;background:#dff8ef}',
            '.aurora-report-alert{padding:16px;border:0;border-left:4px solid #e24e63;background:#fff5f6;border-radius:10px}',
            '.aurora-report-alert h3{margin:0 0 6px;font-size:16px}',
            '.aurora-report-alert small{display:block;margin-bottom:10px;color:#718096}',
            '.aurora-report-alert>p,.aurora-report-recommendation p{margin:0;color:#465365;font-size:12px;line-height:1.55}',
            '.aurora-report-recommendation{margin-top:14px;padding-top:13px;border-top:1px solid #f0cdd4}',
            '.aurora-report-recommendation span{color:#1d9189;font-size:9px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}',
            '.aurora-report-recommendation p{margin-top:5px}',
            '.aurora-report-occurrence{margin-bottom:30px}',
            '.aurora-vehicle-photo-section__header{margin-bottom:12px}.aurora-vehicle-photo-section__header h3{margin:0 0 4px;font-size:15px}.aurora-vehicle-photo-section__header p{margin:0;color:#718096;font-size:11px}',
            '.aurora-vehicle-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:24px;align-items:start}.aurora-vehicle-photo-grid--all-portrait{grid-template-columns:repeat(2,minmax(120px,280px));justify-content:center;width:fit-content;max-width:100%;margin-inline:auto}.aurora-vehicle-photo-grid--all-portrait .aurora-vehicle-photo{width:100%;max-width:280px;justify-self:center}.aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame,.aurora-vehicle-photo--landscape .aurora-vehicle-photo__placeholder,.aurora-vehicle-photo--square .aurora-vehicle-photo__frame,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame{height:auto!important;min-height:0!important;max-height:none!important}.aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame img,.aurora-vehicle-photo--square .aurora-vehicle-photo__frame img,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame img{width:100%!important;height:auto!important;max-height:210px!important;object-fit:contain!important}.aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame,.aurora-vehicle-photo-grid--all-portrait .aurora-vehicle-photo__frame{height:auto!important;min-height:0!important;max-height:220px!important}.aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame img,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame img,.aurora-vehicle-photo-grid--all-portrait .aurora-vehicle-photo__frame img{width:auto!important;max-width:100%!important;height:auto!important;max-height:220px!important;margin-inline:auto!important;object-fit:contain!important}',
            '.aurora-vehicle-photo{display:grid;grid-template-rows:auto;align-content:start;margin:0;overflow:hidden;border:1px solid #dce6ec;border-radius:12px;background:#eef3f6;break-inside:avoid}',
            '.aurora-vehicle-photo__frame,.aurora-vehicle-photo__placeholder{position:relative;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;padding:8px;background:#eef3f6;overflow:hidden}',
            '.aurora-vehicle-photo__frame img{display:block;width:100%;height:auto;max-width:100%;object-fit:contain;object-position:center center}',
            '.aurora-vehicle-photo__chip,.aurora-report-photo-card__chip{position:absolute;left:8px;top:8px;z-index:1;padding:3px 8px;border-radius:6px;background:rgba(8,28,44,.78);color:#fff;font-size:9px;font-weight:700;letter-spacing:.02em;line-height:1.2;pointer-events:none}',
            '.aurora-vehicle-photo figcaption{display:none!important}',
            '.aurora-vehicle-photo__placeholder{display:grid;place-items:center;color:#8996a5;font-size:11px}.aurora-vehicle-photo.is-missing{border-style:dashed;background:#fafcfd}',
            '.aurora-vehicle-additional-records{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.aurora-vehicle-additional-records>.aurora-vehicle-photo-section__header{grid-column:1/-1;margin-bottom:0;padding-top:15px;border-top:1px solid #e2e8ed}',
            '.aurora-vehicle-record-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.aurora-vehicle-record-pair>.aurora-vehicle-additional-records{display:block;margin-top:0}.aurora-vehicle-record-pair>.aurora-vehicle-additional-records>.aurora-vehicle-photo-section__header{margin-bottom:10px}',
            '.aurora-vehicle-record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.aurora-vehicle-additional-records[data-record-count="1"]>.aurora-report-record-card,.aurora-vehicle-additional-records[data-orphan-card="true"]>.aurora-report-record-card:last-of-type{grid-column:1/-1;width:100%;max-width:100%;justify-self:stretch}.aurora-print-record-sheet,.aurora-print-additional-record{display:block}.aurora-print-record-row{display:grid;gap:12px;align-items:start}.aurora-print-record-row[data-record-count="1"],.aurora-print-record-row[data-print-density="full"],.aurora-print-record-row[data-print-density="single"]{grid-template-columns:minmax(0,1fr)}.aurora-print-record-row[data-record-count="2"],.aurora-print-record-row[data-print-density="duo"]{grid-template-columns:repeat(2,minmax(0,1fr))}.aurora-print-record-row .aurora-report-record-card{width:100%;max-width:100%;margin-bottom:0}.aurora-print-tail-bundle{display:grid;gap:14px}',
            '.aurora-report-record-card{display:grid;gap:0;margin:0 0 14px;overflow:hidden;border:1px solid #dde6ec;border-radius:12px;background:#fafcfd;break-inside:avoid}.aurora-report-record-card--issue{border-top:0;border-left:2px solid rgba(232,146,154,.88);background:linear-gradient(180deg,#fffcfc 0%,#fafcfd 100%)}.aurora-report-record-card--complementary{border-top:0;border-left:2px solid rgba(29,145,137,.88);background:linear-gradient(180deg,#f8fcfb 0%,#fafcfd 100%)}.aurora-report-record-card--fragment-start{margin-bottom:0;border-bottom:0;border-radius:12px 12px 0 0}.aurora-report-record-card--fragment-middle{margin-bottom:0;border-top:0;border-bottom:0;border-radius:0}.aurora-report-record-card--fragment-end{margin-bottom:14px;border-top:0;border-radius:0 0 12px 12px}.aurora-report-record-card__header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px 8px;border-bottom:1px solid #e8eef2;background:rgba(255,255,255,.58)}.aurora-report-record-card__label{color:#66778b;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.aurora-report-record-card__severity,.aurora-report-record-card__header b{padding:4px 9px;border-radius:999px;color:#8b5d00;background:#fff0bf;font-size:9px;font-weight:700;text-transform:uppercase}.aurora-report-record-card__body{padding:12px 14px}.aurora-report-record-card__body h3{margin:0 0 6px;font-size:15px}.aurora-report-record-card__body p{margin:0;color:#465365;font-size:12px;line-height:1.55}.aurora-report-record-card .aurora-report-media,.aurora-report-record-card .aurora-report-photos{margin:0;padding:0 14px 14px}.aurora-report-record-card__recommendation{padding:10px 14px 14px;border-top:1px solid #e8eef2;background:rgba(255,255,255,.45)}.aurora-report-record-card__recommendation span{color:#1d9189;font-size:9px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}.aurora-report-record-card__recommendation p{margin:6px 0 0;color:#465365;font-size:12px;line-height:1.55}',
            '.aurora-report-media,.aurora-report-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px;--report-media-h:210px;--report-media-h-landscape:210px;--report-media-h-portrait:220px;--report-media-max-single:420px;--report-media-max-portrait:280px}.aurora-report-media--single,.aurora-report-photos--single{grid-template-columns:1fr;justify-items:center}.aurora-report-media--single .aurora-report-media-item,.aurora-report-photos--single figure{width:min(72%,var(--report-media-max-single))}.aurora-report-media--single.aurora-report-media--portrait .aurora-report-media-item,.aurora-report-photos--single.aurora-report-media--portrait figure{width:min(58%,var(--report-media-max-portrait))}.aurora-report-media--duo,.aurora-report-media--quad,.aurora-report-media--many{grid-template-columns:repeat(2,minmax(0,1fr))}.aurora-report-media--trio{grid-template-columns:repeat(2,minmax(0,1fr))}.aurora-report-media--trio>.aurora-report-media-item:nth-child(3),.aurora-report-media--trio>figure:nth-child(3){grid-column:1/-1;width:min(58%,340px);justify-self:center}.aurora-report-media-item,.aurora-report-photos figure{margin:0;border:1px solid #dce6ec;border-radius:10px;overflow:hidden;background:#f8fafb;break-inside:avoid}.aurora-report-media-frame,.aurora-report-photo-frame{position:relative;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;height:var(--report-media-h-landscape);min-height:var(--report-media-h-landscape);max-height:var(--report-media-h-landscape);padding:8px;overflow:hidden;background:linear-gradient(180deg,#eef3f6,#e8eef2)}.aurora-report-media-item--portrait .aurora-report-media-frame,.aurora-report-media-item--portrait .aurora-report-photo-frame{height:var(--report-media-h-portrait)!important;min-height:var(--report-media-h-portrait)!important;max-height:var(--report-media-h-portrait)!important}.aurora-report-media--mixed .aurora-report-media-item--landscape .aurora-report-media-frame,.aurora-report-media--mixed .aurora-report-media-item--landscape .aurora-report-photo-frame{height:var(--report-media-h-landscape)!important;min-height:var(--report-media-h-landscape)!important;max-height:var(--report-media-h-landscape)!important}.aurora-report-media--mixed .aurora-report-media-item--portrait .aurora-report-media-frame,.aurora-report-media--mixed .aurora-report-media-item--portrait .aurora-report-photo-frame{height:var(--report-media-h-portrait)!important;min-height:var(--report-media-h-portrait)!important;max-height:var(--report-media-h-portrait)!important}.aurora-report-media-frame img,.aurora-report-photos img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}.aurora-report-media-badge,.aurora-report-photo-index{display:none!important}',
            '.aurora-report-photos figcaption{display:grid;gap:4px;padding:9px;font-size:12px}',
            '.aurora-report-media--editorial figcaption,.aurora-report-general-record-card figcaption{display:grid;gap:3px;padding:9px 11px;border-top:1px solid #e8eef2;background:rgba(255,255,255,.65)}.aurora-report-media--editorial figcaption span,.aurora-report-general-record-card figcaption span{color:#66778b;font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.aurora-report-media--editorial figcaption strong,.aurora-report-general-record-card figcaption strong{font-size:12px}',
            '.aurora-report-empty-section{padding:20px;border:0;border-radius:0;text-align:center;color:#718096}',
            '.aurora-report-document__footer{display:grid;grid-template-columns:1fr auto auto;gap:28px;align-items:center;justify-content:space-between;padding:16px 34px;background:#fff;border:0;font-size:11px;color:#718096}',
            '.aurora-report-validation{display:grid;grid-template-columns:minmax(0,1fr) 78px;gap:16px;align-items:center;margin:8px 0 4px;padding:16px 18px;border:1px solid #dce7e9;border-radius:12px;background:#f7fbfb;break-inside:avoid}.aurora-report-validation__copy{display:grid;gap:5px}.aurora-report-validation__copy>span{color:#1d9189;font-size:9px;font-weight:800;letter-spacing:.12em}.aurora-report-validation__copy>strong{font-size:14px}.aurora-report-validation__copy>p{margin:0;color:#526579;font-size:11px;line-height:1.45}.aurora-report-validation__copy>b{font-size:11px}.aurora-report-validation__qr{width:78px;height:78px}.aurora-report-validation__qr svg{display:block;width:100%;height:100%}@media print{.aurora-report-validation{grid-template-columns:minmax(0,1fr) 21mm!important;padding:3mm 4mm!important}.aurora-report-validation__qr{width:21mm!important;height:21mm!important}}',
            '.aurora-report-signature{display:grid;justify-items:center;gap:8px;padding:12px}.aurora-report-signature img{display:block;max-width:420px;width:100%;max-height:150px;object-fit:contain;border-bottom:1px solid #657785}.aurora-report-signature span{font-size:10px;color:#718096}',
            '.aurora-report-cover{position:relative;min-height:240px;padding:36px 42px;background:#12324b;color:#fff}.aurora-report-cover__content{margin-top:46px}.aurora-report-cover h1{margin:8px 0 10px}.aurora-report-cover p{max-width:620px;color:#d3e0e8;line-height:1.5}.aurora-report-cover__meta{position:absolute;right:42px;bottom:28px;display:grid;gap:4px;text-align:right;font-size:10px;color:#c4d6e1}.aurora-report-cover__meta span:first-child{color:#64f0e5;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}',
            '.aurora-report-cover--refined .aurora-report-brand__name{display:block}',
            '.aurora-report-cover--refined .aurora-report-cover__primary-title{display:block;margin:0;color:#dce8f0;font-size:18px;line-height:1.35;font-weight:650;word-wrap:break-word;overflow-wrap:anywhere;max-width:100%}',
            '.aurora-report-cover--refined .aurora-report-cover__title-size--small{font-size:14px;font-weight:600}',
            '.aurora-report-cover--refined .aurora-report-cover__title-size--normal{font-size:18px;font-weight:650}',
            '.aurora-report-cover--refined .aurora-report-cover__title-size--large{font-size:24px;font-weight:700}',
            '.aurora-report-cover--refined h1{font-size:clamp(20px,3.6vw,28px);margin:0 0 12px;line-height:1.08}',
            '.aurora-report-commercial-value{padding:16px 18px;border:1px solid #b9dfda;border-radius:12px;background:#f1faf8}.aurora-report-commercial-value__type{display:block;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#177f79}.aurora-report-commercial-value__amount{display:block;margin-top:5px;font-size:26px;line-height:1.1;color:#102d46}.aurora-report-commercial-value p{margin:8px 0 0;color:#526575;line-height:1.45}.aurora-report-budget__row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:10px 0;border-bottom:1px solid #d8e8e5}.aurora-report-budget__row span{color:#334b5e}.aurora-report-budget__row strong{white-space:nowrap;color:#102d46}.aurora-report-budget__total{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px}.aurora-report-budget__total span{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#177f79}.aurora-report-budget__total strong{font-size:26px;color:#102d46}.aurora-report-signature{padding:14px 18px;border:1px solid #d8e8e5;border-radius:12px;background:#f7fbfa}.aurora-report-signature img{display:block;max-width:360px;width:100%;height:105px;object-fit:contain;object-position:left center;background:#fff}.aurora-report-signature span{display:block;margin-top:8px;font-size:10px;color:#657785}.aurora-report-body{padding:30px 42px}.aurora-report-section{margin-bottom:22px}.aurora-report-section__head{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid #dde6ec}.aurora-report-section__head::before{content:"";width:3px;height:18px;border-radius:2px;background:#1d9189}.aurora-report-section__head h2,.aurora-report-section>h2{margin:0;font-size:15px;font-weight:700}.aurora-report-info-grid,.aurora-report-approval{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.aurora-report-info{display:block;width:auto;margin:0;padding:11px 13px;border:1px solid #dde6ec;border-radius:10px;background:linear-gradient(180deg,#fafcfd,#f5f8fa)}.aurora-report-info strong{margin-top:4px}.aurora-report-summary{padding:13px 15px 13px 18px;border:1px solid #dce9e7;border-radius:10px;background:#f3faf9;position:relative}.aurora-report-summary::before{content:"";position:absolute;top:10px;bottom:10px;left:0;width:3px;border-radius:0 3px 3px 0;background:#1d9189}.aurora-report-summary p{margin:0;line-height:1.55}',
            '.aurora-report-work-plan__items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px;row-gap:0;border-top:1px solid #e8eef2}.aurora-report-work-plan__item{display:grid;grid-template-columns:20px minmax(0,1fr);gap:10px;align-items:start;padding:9px 4px;border-bottom:1px solid #eef2f5;break-inside:avoid;page-break-inside:avoid}.aurora-report-work-plan__item span{display:block;width:20px;text-align:center;font-size:14px;line-height:1.35}.aurora-report-work-plan__item strong{display:block;min-width:0;font-size:12px;font-weight:600;line-height:1.45;overflow-wrap:anywhere}@media(max-width:700px){.aurora-report-work-plan__items{grid-template-columns:1fr}}',
            '.aurora-report-diagnostic{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.aurora-report-diagnostic article{position:relative;padding:14px 15px 14px 19px;border:1px solid #dce7e9;border-radius:11px;background:linear-gradient(180deg,#f7fbfb,#f2f7f8)}.aurora-report-diagnostic article::before{content:"";position:absolute;top:12px;bottom:12px;left:0;width:3px;border-radius:0 3px 3px 0;background:#1d9189}.aurora-report-diagnostic p{line-height:1.55}.aurora-report-section--conclusion{padding:0;border:0;background:transparent}.aurora-report-closing-bundle{display:grid;gap:14px}.aurora-report-closing-bundle .aurora-report-section{margin-bottom:0}.aurora-report-closing-bundle .aurora-report-section--signature{margin-bottom:0}.aurora-report-finalization--documental{display:grid;gap:14px;padding:16px 18px;border:1px solid #dce7e9;border-radius:12px;background:linear-gradient(180deg,#f9fcfc,#f4f8f9)}.aurora-report-finalization--documental .aurora-report-finalization__status-line,.aurora-report-finalization--documental .aurora-report-finalization__notes-block{display:grid;gap:6px}.aurora-report-finalization--documental .aurora-report-finalization__status-label,.aurora-report-finalization--documental .aurora-report-finalization__notes-label{color:#66778b;font-size:9px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.aurora-report-finalization--documental .aurora-report-finalization__value{display:inline-flex;align-items:center;gap:8px;margin-top:0;color:#126f69;font-size:14px;font-weight:650;text-transform:none}.aurora-report-finalization--documental .aurora-report-finalization__value--complete::before{content:"";width:8px;height:8px;border-radius:50%;background:#1d9189;box-shadow:0 0 0 3px rgba(29,145,137,.14)}.aurora-report-finalization--documental .aurora-report-finalization__notes-block p{margin:0;color:#3f5062;font-size:12px;line-height:1.55}.aurora-report-finalization{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:hidden;border:1px solid #cde5e2;border-radius:12px;background:linear-gradient(135deg,#edf8f6,#f5fbfb)}.aurora-report-finalization__status,.aurora-report-finalization__notes{padding:14px 16px}.aurora-report-finalization__status{border-right:1px solid rgba(205,229,226,.85)}.aurora-report-finalization__status span,.aurora-report-finalization__notes span{display:block;color:#66778b;font-size:9px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.aurora-report-finalization__value{display:inline-flex;align-items:center;gap:7px;margin-top:8px;color:#126f69;font-size:14px}.aurora-report-finalization__value--complete::before{content:"";width:8px;height:8px;border-radius:50%;background:#1d9189;box-shadow:0 0 0 3px rgba(29,145,137,.14)}.aurora-report-finalization__notes p{margin:8px 0 0;color:#3f5062;font-size:12px;line-height:1.55}.aurora-report-empty-section{padding:13px 16px;border:1px dashed #cbd7df;border-radius:10px;background:#fafcfd}.aurora-report-document__footer{align-items:center;border-top:1px solid #e4eaee}.aurora-report-footer__user,.aurora-report-footer__code{display:grid;gap:2px}.aurora-report-footer__user{text-align:left}.aurora-report-footer__code{text-align:right}.aurora-report-footer__user span,.aurora-report-footer__code span{font-size:8px;letter-spacing:.12em}.aurora-report-footer__user b,.aurora-report-footer__code b{color:#314458}',
            '@media screen and (max-width:520px){.aurora-report-cover--with-photo{--aurora-cover-photo-max-width:min(100%,calc(220px * var(--aurora-cover-photo-scale,1)));--aurora-cover-photo-max-height:calc(140px * var(--aurora-cover-photo-scale,1))}.aurora-report-cover--with-photo .aurora-report-cover__layout{grid-template-columns:1fr;gap:16px}.aurora-report-cover__photo{justify-self:start}.aurora-report-cover__logo-slot .aurora-report-brand__logo{max-width:calc(92px * var(--aurora-report-logo-scale,1));max-height:calc(36px * var(--aurora-report-logo-scale,1))}.aurora-report-cover p{padding-right:0}}',
            '@media screen and (min-width:521px) and (max-width:900px){.aurora-report-cover--with-photo{--aurora-cover-photo-max-width:min(42vw,calc(280px * var(--aurora-cover-photo-scale,1)));--aurora-cover-photo-max-height:calc(180px * var(--aurora-cover-photo-scale,1))}.aurora-report-cover--with-photo .aurora-report-cover__layout{grid-template-columns:minmax(0,1fr) minmax(0,var(--aurora-cover-photo-max-width))}.aurora-report-cover__logo-slot .aurora-report-brand__logo{max-width:calc(108px * var(--aurora-report-logo-scale,1));max-height:calc(42px * var(--aurora-report-logo-scale,1))}}',
            '@media screen and (min-width:901px){.aurora-report-cover--with-photo{--aurora-cover-photo-max-width:min(calc(320px * var(--aurora-cover-photo-scale,1)),48vw);--aurora-cover-photo-max-height:calc(220px * var(--aurora-cover-photo-scale,1))}.aurora-report-cover--with-photo .aurora-report-cover__layout{grid-template-columns:minmax(0,1fr) minmax(0,var(--aurora-cover-photo-max-width))}}',
            '.aurora-report-cover--photo-large .aurora-report-cover__layout{grid-template-columns:minmax(0,42%) minmax(0,58%);align-items:start}.aurora-report-cover--photo-large .aurora-report-cover__photo{width:100%;max-width:100%}.aurora-report-cover--photo-large .aurora-report-cover__photo img{width:100%;max-width:100%;height:auto}.aurora-report-cover--photo-large .aurora-report-cover__content h1{font-size:clamp(27px,2.35vw,31px);line-height:1.08;letter-spacing:-.02em}.aurora-report-cover--photo-large .aurora-report-cover__content{min-width:0}.aurora-report-cover--photo-large{min-height:300px}',
            '.aurora-grounding-report .aurora-grounding-evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px;align-items:start}.aurora-grounding-report .aurora-grounding-evidence-card{display:grid;grid-template-rows:auto auto;margin:0;overflow:hidden;border:1px solid #dce6ec;border-radius:10px;background:#f8fafb;break-inside:avoid;page-break-inside:avoid}.aurora-grounding-report .aurora-grounding-evidence-card__frame{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;height:210px;padding:7px;background:#eef3f6;overflow:hidden}.aurora-grounding-report .aurora-grounding-evidence-card__frame img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center}.aurora-grounding-report .aurora-grounding-evidence-card figcaption{display:grid;gap:3px;padding:8px 10px;border-top:1px solid #e4eaee;background:#fff}.aurora-grounding-report .aurora-grounding-evidence-card figcaption strong{font-size:10.5px;line-height:1.35;color:#172235}.aurora-grounding-report .aurora-grounding-evidence-card figcaption span{font-size:9.5px;line-height:1.35;color:#66778b}@media(max-width:520px){.aurora-grounding-report .aurora-grounding-evidence-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.aurora-grounding-report .aurora-grounding-evidence-card__frame{height:150px;padding:5px}.aurora-grounding-report .aurora-grounding-evidence-card figcaption{padding:7px}.aurora-grounding-report .aurora-grounding-evidence-card figcaption strong{font-size:9px}}@media print{.aurora-grounding-report .aurora-grounding-evidence-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:3mm 4mm!important}.aurora-grounding-report .aurora-grounding-evidence-card{break-inside:avoid!important;page-break-inside:avoid!important;border-radius:2mm!important}.aurora-grounding-report .aurora-grounding-evidence-card__frame{height:48mm!important;padding:1.5mm!important}.aurora-grounding-report .aurora-grounding-evidence-card figcaption{padding:1.8mm 2.2mm!important}.aurora-grounding-report .aurora-grounding-evidence-card figcaption strong{font-size:7.5pt!important;line-height:1.25!important}.aurora-grounding-report .aurora-grounding-evidence-card figcaption span{font-size:6.8pt!important;line-height:1.25!important}}',
            '.aurora-grounding-report .aurora-report-section__head h2{font-size:13px;letter-spacing:.025em;text-transform:uppercase}.aurora-grounding-report .aurora-grounding-instrument-block{margin-bottom:16px}.aurora-grounding-report .aurora-grounding-text-block--documental{display:grid;gap:0;max-width:100%;margin:0 0 18px}.aurora-grounding-report .aurora-grounding-copy{margin:0 0 10px!important;color:#2c3d4e!important;font-size:11px!important;line-height:1.62!important;text-align:justify!important;text-align-last:left!important;hyphens:auto;white-space:normal}.aurora-grounding-report .aurora-grounding-copy:last-child{margin-bottom:0!important}.aurora-grounding-report .aurora-grounding-subhead{display:block;margin:12px 0 7px;color:#66778b;font-size:8px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}.aurora-grounding-report .aurora-grounding-standards--documental{display:block;margin:0 0 18px}.aurora-grounding-report .aurora-grounding-standard{display:block;padding:9px 0;border-bottom:1px solid #e8eef2}.aurora-grounding-report .aurora-grounding-standard:first-child{padding-top:0}.aurora-grounding-report .aurora-grounding-standard:last-child{border-bottom:0}.aurora-grounding-report .aurora-grounding-standard strong{display:block;margin:0 0 3px;font-size:11px;line-height:1.35;color:#172235}.aurora-grounding-report .aurora-grounding-standard span{display:block;font-size:10.5px;line-height:1.5;color:#526579}.aurora-grounding-report .aurora-grounding-validation-heading{display:flex;gap:7px;align-items:baseline;margin:0 0 14px;padding:0 0 10px;border-bottom:1px solid #dde6ec;color:#172235;font-size:13px;font-weight:700;letter-spacing:.025em;text-transform:uppercase}.aurora-grounding-report .aurora-grounding-validation-heading span{color:#148f88;font-weight:800}.aurora-grounding-report .aurora-grounding-validation-numbered>.aurora-report-validation{margin-top:0}@media print{.aurora-grounding-report .aurora-grounding-copy{font-size:8.2pt!important;line-height:1.55!important;margin-bottom:2.2mm!important}.aurora-grounding-report .aurora-grounding-validation-heading{break-after:avoid!important;page-break-after:avoid!important}}',
            '.aurora-grounding-report .aurora-grounding-table-shell{margin-top:18px;overflow:hidden;border:1px solid #d9e4e9;border-radius:10px;background:#fff}.aurora-grounding-report .aurora-grounding-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px;color:#132337}.aurora-grounding-report .aurora-grounding-table thead{display:table-header-group}.aurora-grounding-report .aurora-grounding-table th{box-sizing:border-box;padding:9px 8px;background:#f2f7f8;border-bottom:1px solid #d9e4e9;text-align:left;color:#536a7d;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;line-height:1.25}.aurora-grounding-report .aurora-grounding-table th:nth-child(1){width:6%}.aurora-grounding-report .aurora-grounding-table th:nth-child(2){width:43%}.aurora-grounding-report .aurora-grounding-table th:nth-child(3){width:13%}.aurora-grounding-report .aurora-grounding-table th:nth-child(4){width:11%}.aurora-grounding-report .aurora-grounding-table th:nth-child(5){width:13%}.aurora-grounding-report .aurora-grounding-table th:nth-child(6){width:14%}.aurora-grounding-report .aurora-grounding-table tbody tr:nth-child(even){background:#fbfcfd}.aurora-grounding-report .aurora-grounding-table td{box-sizing:border-box;padding:8px;vertical-align:middle;border-bottom:1px solid #e5ecef;line-height:1.25;overflow-wrap:anywhere}.aurora-grounding-report .aurora-grounding-table tbody tr:last-child td{border-bottom:0}.aurora-grounding-report .aurora-grounding-table__reg{font-weight:800;color:#17344e}.aurora-grounding-report .aurora-grounding-table__point strong{display:block!important;margin:0!important;font-size:10.7px!important;font-weight:700!important;line-height:1.25!important;color:#132337!important}.aurora-grounding-report .aurora-grounding-table__point span{display:block!important;margin-top:3px!important;color:#63778a!important;font-size:9.3px!important;font-weight:400!important;line-height:1.3!important}.aurora-grounding-report .aurora-grounding-table__measure{font-weight:800;white-space:nowrap}.aurora-grounding-report .aurora-grounding-table__reference{font-weight:700}.aurora-grounding-report .aurora-grounding-table__condition{font-weight:400}.aurora-grounding-report .aurora-grounding-table__status{font-weight:700;color:#08746e}@media(max-width:760px){.aurora-grounding-report .aurora-grounding-table-shell{overflow:auto}.aurora-grounding-report .aurora-grounding-table{min-width:820px}}@media print{.aurora-grounding-report .aurora-grounding-table-shell{border-radius:0}.aurora-grounding-report .aurora-grounding-table thead{display:table-header-group}.aurora-grounding-report .aurora-grounding-table tr{break-inside:avoid;page-break-inside:avoid}}',
            '@media(max-width:700px){.aurora-report-document{box-sizing:border-box;width:100%!important;min-width:0!important;max-width:100%!important}.aurora-report-document img{max-width:100%!important}.aurora-report-cover{padding:26px 22px}.aurora-report-cover__meta{right:22px;bottom:22px}.aurora-report-body{padding:24px 20px}.aurora-report-info-grid,.aurora-report-approval,.aurora-report-diagnostic,.aurora-report-fact-sheet__row,.aurora-report-spec-sheet__row--3{grid-template-columns:1fr}.aurora-report-spec-sheet__row--1{max-width:none}.aurora-report-finalization{grid-template-columns:1fr}.aurora-report-finalization__status{border-right:0;border-bottom:1px solid rgba(205,229,226,.85)}.aurora-vehicle-additional-records,.aurora-vehicle-record-pair,.aurora-vehicle-record-grid{grid-template-columns:1fr!important}.aurora-vehicle-photo-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.aurora-vehicle-photo__frame,.aurora-vehicle-photo__placeholder{height:190px!important;min-height:190px!important;max-height:190px!important}.aurora-vehicle-photo__frame img,.aurora-report-media-frame img,.aurora-report-photo-frame img{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}.aurora-report-document__footer{grid-template-columns:1fr auto;gap:12px;padding:14px 20px}.aurora-report-footer__user{display:none}}',
            '@media print{.aurora-vehicle-photo-section{break-inside:auto!important;page-break-inside:auto!important}.aurora-vehicle-found-issues{break-before:auto!important;page-break-before:auto!important}.aurora-report-section--vehicle-checklist{break-inside:auto!important;page-break-inside:auto!important}.aurora-report-section--vehicle-checklist .aurora-report-section__head{break-after:avoid!important;page-break-after:avoid!important}.aurora-report-status-row{break-inside:avoid!important;page-break-inside:avoid!important}.aurora-vehicle-photo{break-inside:avoid!important;page-break-inside:avoid!important}.aurora-report-finalization--documental{gap:2mm!important;padding:2mm 2.5mm!important;border:.25mm solid #dce7e9!important;border-radius:2.5mm!important;background:linear-gradient(180deg,#f9fcfc,#f4f8f9)!important;break-inside:avoid!important}.aurora-vehicle-photo-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:2.5mm!important;margin-bottom:4mm!important;align-items:start!important;--report-media-h-landscape:46mm;--report-media-h-portrait:50mm}.aurora-vehicle-photo-grid--all-portrait{grid-template-columns:repeat(2,76mm)!important;justify-content:center!important;column-gap:5mm!important;row-gap:3mm!important;width:fit-content!important;max-width:100%!important;margin-inline:auto!important}.aurora-vehicle-photo-grid--all-portrait .aurora-vehicle-photo{width:76mm!important;max-width:100%!important;justify-self:center!important}.aurora-vehicle-photo{display:grid!important;grid-template-rows:auto auto!important;align-content:start!important;overflow:hidden!important}.aurora-vehicle-photo-grid--all-portrait .aurora-vehicle-photo{grid-template-rows:auto auto!important}.aurora-vehicle-photo__frame,.aurora-vehicle-photo__placeholder,.aurora-report-media-frame,.aurora-report-photo-frame{box-sizing:border-box!important;width:100%!important;height:var(--report-media-h-landscape)!important;min-height:var(--report-media-h-landscape)!important;max-height:var(--report-media-h-landscape)!important;overflow:hidden!important}.aurora-vehicle-photo-grid--all-portrait .aurora-vehicle-photo__frame,.aurora-vehicle-photo-grid--all-portrait .aurora-vehicle-photo__placeholder,.aurora-report-media-item--portrait .aurora-report-media-frame,.aurora-report-media-item--portrait .aurora-report-photo-frame,.aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame{height:var(--report-media-h-portrait)!important;min-height:var(--report-media-h-portrait)!important;max-height:var(--report-media-h-portrait)!important}.aurora-vehicle-photo__frame img,.aurora-report-media-frame img,.aurora-report-photo-frame img{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}.aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame,.aurora-vehicle-photo--square .aurora-vehicle-photo__frame,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame{height:auto!important;min-height:0!important;max-height:none!important}.aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame img,.aurora-vehicle-photo--square .aurora-vehicle-photo__frame img,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame img{height:auto!important;max-height:46mm!important}.aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame,.aurora-vehicle-photo-grid--all-portrait .aurora-vehicle-photo__frame,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame{height:auto!important;min-height:0!important;max-height:50mm!important}.aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame img,.aurora-vehicle-photo-grid--all-portrait .aurora-vehicle-photo__frame img,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame img{width:auto!important;height:auto!important;max-height:50mm!important;margin-inline:auto!important}.aurora-vehicle-photo figcaption{display:none!important}.aurora-vehicle-photo__chip,.aurora-report-photo-card__chip{background:rgba(8,28,44,.78)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.aurora-vehicle-found-issues .aurora-report-media-frame,.aurora-vehicle-found-issues .aurora-report-photo-frame{height:auto!important;min-height:38mm!important;max-height:48mm!important;padding:1.5mm!important}.aurora-vehicle-found-issues .aurora-report-media-frame img,.aurora-vehicle-found-issues .aurora-report-photo-frame img{height:auto!important;max-height:46mm!important;width:100%!important;object-fit:contain!important}.aurora-vehicle-complementary-records .aurora-report-media-frame,.aurora-vehicle-complementary-records .aurora-report-photo-frame{height:auto!important;min-height:42mm!important;max-height:52mm!important;padding:1.5mm!important}.aurora-vehicle-complementary-records .aurora-report-media-frame img,.aurora-vehicle-complementary-records .aurora-report-photo-frame img{height:auto!important;max-height:50mm!important;width:100%!important;object-fit:contain!important}.aurora-report-closing-bundle{gap:2mm!important;break-inside:auto!important;page-break-inside:auto!important}.aurora-report-closing-bundle .aurora-report-section--diagnostic,.aurora-report-closing-bundle .aurora-report-section--conclusion,.aurora-report-closing-bundle .aurora-report-section--signature{margin-bottom:0!important}.aurora-report-closing-bundle .aurora-report-section--diagnostic{break-inside:auto!important;page-break-inside:auto!important}.aurora-report-closing-bundle .aurora-report-section--diagnostic .aurora-report-diagnostic article{break-inside:avoid!important;page-break-inside:avoid!important}.aurora-report-closing-bundle .aurora-report-section--conclusion{break-before:auto!important;page-break-before:auto!important;break-inside:avoid!important;page-break-inside:avoid!important}.aurora-report-closing-bundle .aurora-report-section--signature{break-before:avoid!important;page-break-before:avoid!important;break-inside:avoid!important;page-break-inside:avoid!important}.aurora-report-closing-bundle .aurora-report-signature{padding:2mm 0!important}.aurora-report-closing-bundle .aurora-report-signature img{max-height:22mm!important}.aurora-vehicle-additional-records{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:3mm!important;margin-top:0!important}.aurora-vehicle-record-pair{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:3mm!important;margin-top:0!important;break-inside:auto!important;page-break-inside:auto!important}.aurora-vehicle-record-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:3mm!important}.aurora-print-record-sheet,.aurora-print-additional-record{display:block!important}.aurora-print-record-row{display:grid!important;gap:3mm!important;align-items:start!important}.aurora-print-record-row[data-record-count="1"],.aurora-print-record-row[data-print-density="full"],.aurora-print-record-row[data-print-density="single"]{grid-template-columns:minmax(0,1fr)!important}.aurora-print-record-row[data-record-count="2"],.aurora-print-record-row[data-print-density="duo"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}.aurora-print-record-row .aurora-report-record-card{width:100%!important;max-width:100%!important;margin-bottom:0!important}.aurora-print-tail-bundle{display:grid!important;gap:3.5mm!important}.aurora-report-record-card,.aurora-vehicle-record-card{margin:0!important;border-radius:2.3mm!important;break-inside:avoid!important;page-break-inside:avoid!important;overflow:hidden!important}.aurora-report-record-card__header,.aurora-report-record-card__body,.aurora-report-record-card__recommendation{padding:2mm 3mm!important}.aurora-report-record-card .aurora-report-media,.aurora-report-record-card .aurora-report-photos{padding:0 3mm 3mm!important;margin-top:0!important}.aurora-report-media--single.aurora-report-media--portrait .aurora-report-media-item,.aurora-report-photos--single.aurora-report-media--portrait figure{width:min(58%,74mm)!important}.aurora-report-media--trio>.aurora-report-media-item:nth-child(3){grid-column:1/-1!important;width:min(58%,72mm)!important;justify-self:center!important}.aurora-report-section--conclusion,.aurora-report-section--diagnostic{break-inside:auto!important;page-break-inside:auto!important}.aurora-report-diagnostic article{break-inside:avoid!important;page-break-inside:avoid!important}.aurora-print-tail-bundle{display:grid!important;gap:3.5mm!important}.aurora-print-tail-part[data-print-keep-together="1"]{break-inside:auto!important;page-break-inside:auto!important}.aurora-report-finalization{border:.25mm solid #cde5e2!important;border-radius:2.5mm!important;background:linear-gradient(135deg,#edf8f6,#f5fbfb)!important;break-inside:avoid!important}.aurora-report-finalization__status,.aurora-report-finalization__notes{padding:2.5mm 3.5mm!important}.aurora-report-signature{gap:2mm!important;padding:3mm!important}.aurora-report-signature img{width:auto!important;max-width:105mm!important;max-height:28mm!important}}',
            `@media print{@page{size:A4 portrait;margin:9mm 0 15mm;@bottom-left{content:"${footerCompany} · by Aurora";font:6pt Arial,sans-serif;color:#718096;border-top:.25mm solid #e4eaee;padding:2mm 0 0 13mm;vertical-align:top}@bottom-center{content:"Usuário: ${footerUser}";font:6pt Arial,sans-serif;color:#526579;border-top:.25mm solid #e4eaee;padding-top:2mm;vertical-align:top}@bottom-right{content:"${footerReport} · Página " counter(page) " de " counter(pages);font:6pt Arial,sans-serif;font-weight:700;color:#314458;border-top:.25mm solid #e4eaee;padding:2mm 13mm 0 0;vertical-align:top}}@page:first{margin-top:0}html,body{background:#fff!important}.aurora-print-page--first{grid-template-rows:72mm minmax(0,1fr) 14mm!important}.aurora-print-page__cover{height:72mm!important}.aurora-print-page__cover.aurora-report-cover--with-photo{--aurora-cover-photo-max-height:min(calc(36mm * var(--aurora-cover-photo-scale,1)),48mm);--aurora-cover-photo-max-width:min(calc(66mm * var(--aurora-cover-photo-scale,1)),92mm)}.aurora-print-page__cover.aurora-report-cover--with-photo .aurora-report-cover__layout{margin-top:3mm!important;align-items:start!important}.aurora-print-page__cover.aurora-report-cover--photo-large .aurora-report-cover__layout{grid-template-columns:minmax(0,42%) minmax(0,58%)!important}.aurora-print-page__cover.aurora-report-cover--photo-large .aurora-report-cover__content h1{font-size:18pt!important;line-height:1.05!important}.aurora-print-page__cover .aurora-report-brand--cover .aurora-report-cover__logo-slot .aurora-report-brand__logo{max-width:calc(11mm * var(--aurora-report-logo-scale,1))!important;max-height:calc(11mm * var(--aurora-report-logo-scale,1))!important}.aurora-print-page__cover .aurora-report-cover__admin-meta{gap:1.5mm 4mm!important;margin-top:2.5mm!important}main{width:210mm}.aurora-report-cover{background:#12324b!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.aurora-report-body{padding:5mm 13mm 3mm}.aurora-vehicle-additional-records .aurora-report-media,.aurora-vehicle-additional-records .aurora-report-photos{margin-top:1.5mm!important;gap:2mm!important}.aurora-vehicle-found-issues .aurora-report-media-frame,.aurora-vehicle-found-issues .aurora-report-photo-frame{height:auto!important;min-height:38mm!important;max-height:48mm!important;padding:1.5mm!important}.aurora-vehicle-found-issues .aurora-report-media-frame img,.aurora-vehicle-found-issues .aurora-report-photo-frame img{height:auto!important;max-height:46mm!important;width:100%!important;object-fit:contain!important}.aurora-vehicle-complementary-records .aurora-report-media-frame,.aurora-vehicle-complementary-records .aurora-report-photo-frame{height:auto!important;min-height:42mm!important;max-height:52mm!important;padding:1.5mm!important}.aurora-vehicle-complementary-records .aurora-report-media-frame img,.aurora-vehicle-complementary-records .aurora-report-photo-frame img{height:auto!important;max-height:50mm!important;width:100%!important;object-fit:contain!important}.aurora-vehicle-additional-records>.aurora-vehicle-photo-section__header{padding-top:2mm!important;margin-bottom:1.5mm!important}.aurora-report-section{margin-bottom:3mm!important}.aurora-report-info{padding:2mm 3mm!important;border:1px solid #dde6ec!important;background:#f6f8fa!important}.aurora-report-summary,.aurora-report-diagnostic article{border:1px solid #dce7e9!important;background:#f4f9f9!important}.aurora-report-diagnostic{gap:2mm!important}.aurora-report-diagnostic article{min-height:0!important;padding:2mm 2.5mm!important}.aurora-report-section--diagnostic{margin-bottom:2mm!important}.aurora-report-section--diagnostic>.aurora-report-section__head{margin-bottom:1.5mm!important}.aurora-report-section--conclusion{margin-bottom:0!important;padding:0!important;border:0!important;background:transparent!important}.aurora-report-section--conclusion>.aurora-report-section__head{margin-bottom:1.5mm!important}.aurora-report-finalization--documental{gap:2mm!important;padding:2mm 2.5mm!important;border:.25mm solid #dce7e9!important;border-radius:2.5mm!important;background:linear-gradient(180deg,#f9fcfc,#f4f8f9)!important;break-inside:avoid!important}.aurora-report-section--vehicle-checklist{break-inside:auto!important;page-break-inside:auto!important}.aurora-report-section--vehicle-checklist .aurora-report-section__head{break-after:avoid!important;page-break-after:avoid!important}.aurora-report-status-row{break-inside:avoid!important;page-break-inside:avoid!important}.aurora-vehicle-photo-section{break-inside:auto!important;page-break-inside:auto!important}.aurora-vehicle-photo{break-inside:avoid!important;page-break-inside:avoid!important}.aurora-vehicle-found-issues{break-before:auto!important;page-break-before:auto!important}.aurora-report-finalization{border:.25mm solid #cde5e2!important;border-radius:2.5mm!important;background:linear-gradient(135deg,#edf8f6,#f5fbfb)!important;break-inside:avoid!important}.aurora-report-finalization__status,.aurora-report-finalization__notes{padding:2.5mm 3.5mm!important}.aurora-report-section{break-inside:auto}.aurora-report-section--records,.aurora-report-occurrence:not(.aurora-report-record-card):not(.aurora-vehicle-record-card){break-inside:auto!important}.aurora-report-section--diagnostic,.aurora-report-section--conclusion{break-inside:auto!important;page-break-inside:auto!important}.aurora-report-diagnostic article{break-inside:avoid!important;page-break-inside:avoid!important}.aurora-report-section__head,.aurora-report-section__head h2,.aurora-report-section>h2,.aurora-vehicle-photo-section__header,.aurora-vehicle-photo-section__header h3,.aurora-vehicle-additional-records>.aurora-vehicle-photo-section__header,.aurora-report-occurrence__header,.aurora-report-record-card__header{break-after:avoid!important;page-break-after:avoid!important}.aurora-vehicle-additional-records>.aurora-vehicle-photo-section__header+*{break-before:avoid!important;page-break-before:avoid!important}.aurora-vehicle-additional-records>.aurora-report-record-card:first-of-type,.aurora-report-section--records>.aurora-report-occurrence:first-of-type{break-before:avoid!important;page-break-before:avoid!important}.aurora-report-alert,.aurora-report-photos figure,.aurora-report-media-item{break-inside:avoid}.aurora-report-photos img,.aurora-report-media-frame img{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}.aurora-report-photo-index,.aurora-report-media-badge{display:none!important}.aurora-vehicle-additional-records.aurora-vehicle-found-issues{break-inside:auto!important;page-break-inside:auto!important}.aurora-vehicle-additional-records>.aurora-report-record-card,.aurora-report-record-card.aurora-report-occurrence,.aurora-report-record-card.aurora-vehicle-record-card,.aurora-vehicle-record-card.aurora-report-occurrence{break-inside:avoid!important;page-break-inside:avoid!important}.aurora-vehicle-photo-grid{align-items:start!important}.aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame,.aurora-vehicle-photo--landscape .aurora-report-media-frame,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame{height:auto!important;min-height:0!important;max-height:none!important;display:block!important}.aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame img,.aurora-vehicle-photo--landscape .aurora-report-media-frame img,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--landscape .aurora-vehicle-photo__frame img{width:100%!important;height:auto!important;max-height:42mm!important;object-fit:contain!important}.aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame{height:auto!important;min-height:0!important;max-height:52mm!important}.aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame img,.aurora-vehicle-photo-grid--mixed .aurora-vehicle-photo--portrait .aurora-vehicle-photo__frame img{width:auto!important;height:auto!important;max-height:52mm!important;margin-inline:auto!important;object-fit:contain!important}.aurora-report-document__footer{display:none!important}}`,
            '.aurora-report-footer__brand{display:flex;align-items:baseline;gap:7px}.aurora-footer-generated{font-weight:400;color:#718096}.aurora-report-footer__date{display:grid;gap:2px}.aurora-report-footer__date span{font-size:8px;letter-spacing:.12em}.aurora-report-footer__date b{color:#314458}',
            '@media print{@page{@bottom-center{content:""}}}',
            '</style></head><body><main>',
            bodyMarkup,
            '</main><script>',
            this._mediaLayoutScript(),
            this._coverPhotoLayoutScript(),
            '</script></body></html>'
        ].join("");
    }

    _downloadFile(file) {
        const url =
            URL.createObjectURL(
                file
            );

        const link =
            document.createElement(
                "a"
            );

        link.href =
            url;
        link.download =
            file.name;

        document.body.appendChild(
            link
        );

        link.click();
        link.remove();

        window.setTimeout(
            () =>
                URL.revokeObjectURL(
                    url
                ),
            500
        );
    }

    _section(title, content, variant = "") {
        return [
            `<section class="aurora-report-section${variant ? ` aurora-report-section--${this._escapeAttribute(variant)}` : ""}">`,
            '<header class="aurora-report-section__head">',
            `<h2>${this._escape(title)}</h2>`,
            '</header>',
            content,
            '</section>'
        ].join("");
    }

    _resolveEletricaTupyState(report) {
        if (!report || typeof report !== "object") {
            return null;
        }

        if (report.eletrica_tupy && typeof report.eletrica_tupy === "object") {
            return report.eletrica_tupy;
        }

        if (
            report.snapshot &&
            report.snapshot.eletrica_tupy &&
            typeof report.snapshot.eletrica_tupy === "object"
        ) {
            return report.snapshot.eletrica_tupy;
        }

        return null;
    }

    _parseMaterialQuantity(value) {
        if (value == null || value === "") {
            return null;
        }

        const raw = String(value).trim().replace(",", ".");

        if (!raw || raw === "—" || raw === "-" || raw === "\u2014") {
            return null;
        }

        const num = Number(raw);

        if (!Number.isFinite(num)) {
            return null;
        }

        return num;
    }

    _hasValidReportMaterialQuantity(value) {
        const api = global.AuroraEletricaTupy;
        if (api && typeof api.hasValidReportMaterialQuantity === "function") {
            return api.hasValidReportMaterialQuantity(value);
        }
        return this._parseMaterialQuantity(value) != null;
    }

    _formatMaterialQuantity(value) {
        const num = this._parseMaterialQuantity(value);

        if (num == null) {
            return "—";
        }

        return Number.isInteger(num) ? String(num) : String(num);
    }

    _collectEletricaTupyMaterials(report) {
        const state = this._resolveEletricaTupyState(report);
        const bag = state && state.materiais && typeof state.materiais === "object"
            ? state.materiais
            : {};

        return Object.keys(bag)
            .map((key) => bag[key])
            .filter((item) => item && item.selected && String(item.sap || "").trim())
            .map((item) => {
                let quantity = item.quantity;
                if (quantity == null || quantity === "") quantity = item.quantidade;
                if (quantity == null || quantity === "") quantity = item.planned_quantity;
                if (quantity == null || quantity === "") quantity = item.used_quantity;
                if (quantity == null || quantity === "") quantity = item.utilizado;

                return {
                    sap: String(item.sap),
                    descricao: String(item.descricao || ""),
                    tipo: item.tipo,
                    quantity
                };
            })
            .filter((row) => this._hasValidReportMaterialQuantity(row.quantity))
            .sort((a, b) => String(a.sap).localeCompare(String(b.sap), "pt-BR"));
    }

    _renderEletricaTupyIdentification(report, customer = {}, asset = {}) {
        const state = this._resolveEletricaTupyState(report) || {};
        const servico = state.servico || {};
        const dayLabels = {
            weekday: "Dia de semana",
            saturday: "Sábado",
            sunday: "Domingo"
        };
        const days = ["iluminacao", "ventiladores", "escritorio"]
            .filter((id) => state.atividades && state.atividades[id])
            .map((id) => dayLabels[(state.detalhes && state.detalhes[id] && state.detalhes[id].day_type) || ""] || "")
            .filter(Boolean);
        const uniqueDays = Array.from(new Set(days));
        const cells = [
            this._fact(servico.cliente || customer.name || "Tupy S.A.", "Cliente"),
            this._fact(servico.titulo || "Não informado", "Título do trabalho"),
            this._fact(servico.solicitante || customer.responsible || "Não informado", "Responsável Tupy"),
            this._fact(servico.setor || asset.setor || customer.address || "Não informado", "Setor / Área"),
            this._fact(servico.local || asset.local_execucao || asset.identification || "Não informado", "Local da execução")
        ];
        const ponto = String(servico.ponto_referencia || asset.ponto_referencia || "").trim();
        if (ponto) {
            cells.push(this._fact(ponto, "Ponto de referência"));
        }
        cells.push(this._fact(uniqueDays.join(" · ") || "Não informado", "Tipo de dia"));
        if (servico.budget_number != null && String(servico.budget_number).trim() !== "") {
            cells.push(this._fact(String(servico.budget_number), "Nº do orçamento"));
        }
        cells.push(this._fact(servico.data_inicio || asset.entry_date || "Não informado", "Data"));
        const rows = [];
        for (let index = 0; index < cells.length; index += 2) {
            rows.push(
                `<div class="aurora-report-fact-sheet__row">${cells.slice(index, index + 2).join("")}</div>`
            );
        }
        return this._section(
            "Identificação",
            `<div class="aurora-report-fact-sheet aurora-report-fact-sheet--identity">${rows.join("")}</div>`,
            "identity"
        );
    }

    _renderEletricaTupyActivitiesSection(report) {
        const state = this._resolveEletricaTupyState(report);
        if (!state) return "";
        const labels = {
            iluminacao: "Iluminação",
            ventiladores: "Ventiladores",
            escritorio: "Escritório"
        };
        const ids = ["iluminacao", "ventiladores", "escritorio"].filter(
            (id) => state.atividades && state.atividades[id]
        );
        if (!ids.length) return "";
        const body = ids.map((id) => {
            const det = (state.detalhes && state.detalhes[id]) || {};
            const desc = String(det.descricao || "").trim();
            return [
                "<article class=\"aurora-report-summary\">",
                `<p><strong>${this._escape(labels[id])}</strong>`,
                desc ? ` — ${this._escape(desc)}` : "",
                det.quantidade ? ` · qtde ${this._escape(String(det.quantidade))}` : "",
                "</p></article>"
            ].join("");
        }).join("");
        return this._section("Atividades executadas", body, "tupy-activities");
    }

    _renderEletricaTupyServiceCodesSection(report) {
        const state = this._resolveEletricaTupyState(report);
        const rows = state && Array.isArray(state.service_codes)
            ? state.service_codes.filter((item) => item && String(item.service_code || "").trim())
            : [];

        if (!rows.length) return "";

        const dayLabels = {
            weekday: "Dias úteis",
            saturday: "Sábado",
            sunday: "Domingo"
        };
        const body = rows.map((row) => [
            '<tr class="aurora-report-materials-row">',
            `<td class="aurora-report-materials-cell aurora-report-materials-cell--sap">${this._escape(String(row.service_code || ""))}</td>`,
            `<td class="aurora-report-materials-cell aurora-report-materials-cell--desc">${this._escape(String(row.service_description || "—"))}</td>`,
            `<td class="aurora-report-materials-cell">${this._escape(String(row.day_label || dayLabels[row.day_type] || "—"))}</td>`,
            `<td class="aurora-report-materials-cell">${this._escape(String(row.service_unit || row.unit || "—"))}</td>`,
            `<td class="aurora-report-materials-cell aurora-report-materials-cell--qty">${this._escape(this._formatMaterialQuantity(row.quantity))}</td>`,
            "</tr>"
        ].join("")).join("");

        return this._section(
            "Códigos dos trabalhos",
            [
                '<div class="aurora-report-materials">',
                '<table class="aurora-report-materials-table">',
                "<thead><tr>",
                "<th>Código</th>",
                "<th>Serviço</th>",
                "<th>Tipo de dia</th>",
                "<th>Unidade</th>",
                "<th>Quantidade</th>",
                "</tr></thead>",
                `<tbody>${body}</tbody>`,
                "</table>",
                "</div>"
            ].join(""),
            "tupy-service-codes"
        );
    }

    _renderEletricaTupyMaterialsSection(report) {
        const rows = this._collectEletricaTupyMaterials(report);

        if (!rows.length) {
            return "";
        }

        const body = rows.map((row) => [
            '<tr class="aurora-report-materials-row">',
            `<td class="aurora-report-materials-cell aurora-report-materials-cell--sap">${this._escape(row.sap)}</td>`,
            `<td class="aurora-report-materials-cell aurora-report-materials-cell--desc">${this._escape(row.descricao || "—")}</td>`,
            `<td class="aurora-report-materials-cell">${this._escape(row.tipo == null || String(row.tipo).trim() === "" ? "—" : String(row.tipo))}</td>`,
            `<td class="aurora-report-materials-cell aurora-report-materials-cell--qty">${this._escape(this._formatMaterialQuantity(row.quantity))}</td>`,
            "</tr>"
        ].join("")).join("");

        return this._section(
            "Materiais utilizados",
            [
                '<div class="aurora-report-materials">',
                '<table class="aurora-report-materials-table">',
                "<thead>",
                "<tr>",
                "<th>Código SAP</th>",
                "<th>Descrição</th>",
                "<th>Tipo</th>",
                "<th>Quantidade</th>",
                "</tr>",
                "</thead>",
                `<tbody>${body}</tbody>`,
                "</table>",
                "</div>"
            ].join(""),
            "tupy-materials"
        );
    }

    _findEletricaTupyFinalWorkPhotos(report) {
        const groups = Array.isArray(report && report.evidence_groups)
            ? report.evidence_groups
            : Array.isArray(report && report.snapshot && report.snapshot.evidence_groups)
                ? report.snapshot.evidence_groups
                : [];
        const result = [];
        const seen = new Set();

        for (let i = 0; i < groups.length; i += 1) {
            const group = groups[i] || {};
            const title = String(group.title || group.item || "").trim().toLowerCase();
            const isFinal =
                group.record_kind === "tupy_final_work" ||
                group.tupy_photo_slot === "finalizado" ||
                title.indexOf("trabalho finalizado") !== -1;
            if (!isFinal) continue;

            const photos = Array.isArray(group.photos) ? group.photos : [];
            for (let p = 0; p < photos.length; p += 1) {
                const photo = photos[p] || {};
                const src = String(photo.edited_src || photo.src || photo.url || "").trim();
                if (!src) continue;
                const key = String(photo.id || src);
                if (seen.has(key)) continue;
                seen.add(key);
                result.push({
                    ...photo,
                    src,
                    title: photo.title || group.title || "Foto do trabalho finalizado"
                });
            }
        }

        return result;
    }

    _findEletricaTupyFinalWorkPhoto(report) {
        return this._findEletricaTupyFinalWorkPhotos(report)[0] || null;
    }

    _renderEletricaTupyFinalWorkPhotoSection(report) {
        const photos = this._findEletricaTupyFinalWorkPhotos(report);
        if (!photos.length) return "";
        return this._section(
            "Foto do trabalho finalizado",
            this._renderMediaGallery(photos, {
                altPrefix: "Foto do trabalho finalizado",
                caption: (photo) => this._escape(photo.title || "Foto do trabalho finalizado")
            }),
            "tupy-final-photo"
        );
    }

    _publicReportId(report) {
        if (
            report &&
            report.public_id
        ) {
            return String(
                report.public_id
            );
        }

        const created =
            new Date(
                report &&
                report.created_at
                    ? report.created_at
                    : Date.now()
            );

        const year =
            Number.isNaN(
                created.getTime()
            )
                ? new Date().getFullYear()
                : created.getFullYear();

        const yy = String(year).slice(-2);

        const source =
            String(
                (report && report.id) ||
                "AURORA"
            );

        let hash = 0;
        for (
            let index = 0;
            index < source.length;
            index += 1
        ) {
            hash =
                (hash * 31 +
                    source.charCodeAt(index)) %
                10000;
        }

        if (this._isEletricaTupyReport(report)) {
            return `ET-ETM-${yy}-${String(hash || 1).padStart(4, "0")}`;
        }

        return `AUR-${year}-${String(hash || 1).padStart(4, "0")}`;
    }

    _isEletricaTupyReport(report) {
        const sid = String(
            (report && report.service && report.service.id) ||
            (report && report.snapshot && report.snapshot.service && report.snapshot.service.id) ||
            ""
        ).toLowerCase();
        return sid === "eletrica_tupy";
    }

    _info(label, value) {
        return [
            '<div class="aurora-report-info">',
            `<span>${this._escape(label)}</span>`,
            `<strong>${this._escape(value || "Não informado")}</strong>`,
            '</div>'
        ].join("");
    }

    _formatDate(value) {
        if (!value) {
            return "";
        }

        try {
            return new Intl.DateTimeFormat(
                "pt-BR",
                {
                    dateStyle: "long",
                    timeStyle: "short"
                }
            ).format(
                new Date(value)
            );
        } catch (error) {
            return value;
        }
    }

    _escape(value) {
        return String(
            value ?? ""
        )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    _escapeAttribute(value) {
        return this._escape(value);
    }

    _escapeCssContent(value) {
        return String(value ?? "")
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/[\r\n]+/g, " ");
    }
}

global.ReportPreview =
    ReportPreview;

})(window);


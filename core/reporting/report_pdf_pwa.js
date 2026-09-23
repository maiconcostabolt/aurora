(function (global) {
"use strict";

/*
 * Motor PDF PWA da Aurora.
 * Gera bytes PDF reais (pdf-lib, local) a partir do mesmo snapshot
 * usado pela prévia e pelo HTML standalone.
 *
 * Não renderiza HTML/CSS. Não usa window.print, html2canvas nem html2pdf.
 * Fonte: Helvetica padrão PDF (WinAnsi). A UI da Aurora usa Arial.
 * Acentuação portuguesa (áàãâéêíóôõúç) cabe no WinAnsi.
 */

const PDF_SHARE_MIME = "application/pdf";
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 42;
const MARGIN_RIGHT = 42;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = 26;
const COLOR_NAVY = "#12324b";
const COLOR_TEAL = "#1d9189";
const COLOR_TEXT = "#172235";
const COLOR_MUTED = "#66778b";
const COLOR_LINE = "#dde6ec";
const COLOR_CARD = "#f7fafb";
const COLOR_WHITE = "#ffffff";

function hexRgb(hex) {
    const lib = getPdfLib();
    const value = String(hex || "").replace("#", "");
    const n = parseInt(value, 16);
    return lib.rgb(
        ((n >> 16) & 255) / 255,
        ((n >> 8) & 255) / 255,
        (n & 255) / 255
    );
}

function palette() {
    return {
        navy: hexRgb(COLOR_NAVY),
        teal: hexRgb(COLOR_TEAL),
        text: hexRgb(COLOR_TEXT),
        muted: hexRgb(COLOR_MUTED),
        line: hexRgb(COLOR_LINE),
        card: hexRgb(COLOR_CARD),
        cardIssue: hexRgb("#fffcfc"),
        cardComp: hexRgb("#f8fcfb"),
        white: hexRgb(COLOR_WHITE),
        subtitle: hexRgb("#dce8f0"),
        tagline: hexRgb("#b8d0de"),
        warn: hexRgb("#8b5d00"),
        issue: hexRgb("#d6455d"),
        media: hexRgb("#eef3f6")
    };
}

function getPdfLib() {
    const lib = global.PDFLib;

    if (!lib || typeof lib.PDFDocument !== "function") {
        throw new Error("pdf-lib local indisponível.");
    }

    return lib;
}

function toWinAnsi(value) {
    return String(value == null ? "" : value)
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, "\"")
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\u2026/g, "...")
        .replace(/[\u2022\u00B7]/g, "·")
        .replace(/\u00A0/g, " ")
        .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, "?");
}

function fallbackText(value, fallback) {
    const text = String(value || "").trim();
    return text || fallback || "Não informado";
}

function reportPreferenceOn(report, approval, key) {
    if (report && report[key] === false) {
        return false;
    }
    const raw = approval && approval[key];
    if (raw === false) {
        return false;
    }
    const text = String(raw == null ? "" : raw).trim();
    if (/^n[aã]o$/i.test(text)) {
        return false;
    }
    return true;
}

function isAutomaticRecordTitle(title) {
    return /^(registro|ocorr[eê]ncia)\s+\d+$/i.test(String(title || "").trim());
}

function isMeaningfulSeverity(severity, kind) {
    const normalized = String(severity || "").trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    if (/^(n[aã]o informada|nao informada|sem gravidade)/.test(normalized)) {
        return false;
    }
    if (kind === "complementary") {
        return false;
    }
    return true;
}

function photoSrc(photo) {
    if (!photo) {
        return "";
    }

    if (typeof photo === "string") {
        return photo.trim();
    }

    return String(
        photo.edited_src ||
        photo.editedSrc ||
        photo.src ||
        photo.url ||
        photo.href ||
        ""
    ).trim();
}

function isJpeg(bytes) {
    return bytes && bytes.length > 2 && bytes[0] === 0xFF && bytes[1] === 0xD8;
}

function isPng(bytes) {
    return (
        bytes &&
        bytes.length > 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4E &&
        bytes[3] === 0x47
    );
}

function decodeDataUrl(src) {
    const match = String(src || "").match(
        /^data:([^;,]+)?(;base64)?,(.*)$/i
    );

    if (!match) {
        return null;
    }

    const mime = String(match[1] || "").toLowerCase();
    const isBase64 = Boolean(match[2]);
    const payload = match[3] || "";

    if (!isBase64) {
        const bytes = new TextEncoder().encode(decodeURIComponent(payload));
        return { mime, bytes };
    }

    const binary = global.atob(payload);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return { mime, bytes };
}

async function fetchBytes(src) {
    if (!src) {
        return null;
    }

    const data = decodeDataUrl(src);

    if (data) {
        return data;
    }

    if (typeof global.fetch !== "function") {
        return null;
    }

    try {
        const response = await global.fetch(src);
        if (!response || !response.ok) {
            return null;
        }
        const buffer = await response.arrayBuffer();
        const mime = String(
            response.headers && response.headers.get
                ? response.headers.get("content-type") || ""
                : ""
        ).split(";")[0].trim().toLowerCase();
        return { mime, bytes: new Uint8Array(buffer) };
    } catch (error) {
        return null;
    }
}

async function convertToPngBytes(src) {
    if (
        typeof global.document === "undefined" ||
        typeof global.Image === "undefined"
    ) {
        return null;
    }

    return new Promise((resolve) => {
        const image = new global.Image();
        image.onload = () => {
            try {
                const canvas = global.document.createElement("canvas");
                canvas.width = image.naturalWidth || image.width || 1;
                canvas.height = image.naturalHeight || image.height || 1;
                const context = canvas.getContext("2d");
                context.drawImage(image, 0, 0);
                const dataUrl = canvas.toDataURL("image/png");
                const decoded = decodeDataUrl(dataUrl);
                resolve(decoded ? decoded.bytes : null);
            } catch (error) {
                resolve(null);
            }
        };
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

async function embedImage(pdfDoc, src, cache) {
    const key = String(src || "");

    if (!key) {
        return null;
    }

    if (cache.has(key)) {
        return cache.get(key);
    }

    let packed = await fetchBytes(key);
    let bytes = packed && packed.bytes ? packed.bytes : null;
    let mime = packed && packed.mime ? packed.mime : "";

    if (bytes && !isJpeg(bytes) && !isPng(bytes)) {
        bytes = await convertToPngBytes(key);
        mime = "image/png";
    }

    if (!bytes) {
        cache.set(key, null);
        return null;
    }

    let image = null;

    try {
        if (isJpeg(bytes) || mime.indexOf("jpeg") !== -1 || mime.indexOf("jpg") !== -1) {
            image = await pdfDoc.embedJpg(bytes);
        } else {
            image = await pdfDoc.embedPng(bytes);
        }
    } catch (error) {
        const converted = await convertToPngBytes(key);
        if (converted) {
            try {
                image = await pdfDoc.embedPng(converted);
            } catch (embedError) {
                image = null;
            }
        }
    }

    cache.set(key, image);
    return image;
}

function wrapLines(font, text, size, maxWidth) {
    const source = toWinAnsi(text).replace(/\s+/g, " ").trim();

    if (!source) {
        return [];
    }

    const words = source.split(" ");
    const lines = [];
    let current = "";

    const widthOf = (value) => font.widthOfTextAtSize(value, size);

    words.forEach((word) => {
        const next = current ? current + " " + word : word;

        if (widthOf(next) <= maxWidth) {
            current = next;
            return;
        }

        if (current) {
            lines.push(current);
        }

        if (widthOf(word) <= maxWidth) {
            current = word;
            return;
        }

        let chunk = "";
        Array.from(word).forEach((char) => {
            const trial = chunk + char;
            if (widthOf(trial) <= maxWidth) {
                chunk = trial;
                return;
            }
            if (chunk) {
                lines.push(chunk);
            }
            chunk = char;
        });
        current = chunk;
    });

    if (current) {
        lines.push(current);
    }

    return lines;
}

function inlineList(items, fallback) {
    if (Array.isArray(items)) {
        const values = items.map((item) => String(item || "").trim()).filter(Boolean);
        return values.length ? values.join(" · ") : fallback;
    }

    const raw = String(items || "").trim();
    return raw || fallback;
}

function normalizeSearch(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function collectVehicleSections(preview, occurrences) {
    const records = Array.isArray(occurrences) ? occurrences : [];
    const isGuided = (record) =>
        Boolean(
            record &&
            record.record_kind === "vehicle_guided_photo" &&
            record.vehicle_photo_slot
        );
    const isCover = (record) =>
        Boolean(record && record.record_kind === "report_cover_photo");
    const isIssueLike = (record) => {
        if (!record || isGuided(record) || isCover(record)) {
            return false;
        }
        return /avaria|ocorren|dano|amassad|risco|arranh|trinc|quebrad|danific/.test(
            normalizeSearch([record.item, record.title, record.description].filter(Boolean).join(" "))
        );
    };

    const slots = [
        { key: "front", label: "Foto da frente", chip: "Frente", matches: (value) => /(^|\s)frente(\s|$)/.test(value) },
        { key: "right", label: "Foto da lateral direita", chip: "Lateral direita", matches: (value) => /lateral direita|lado direito/.test(value) },
        { key: "rear", label: "Foto da traseira", chip: "Traseira", matches: (value) => /(^|\s)traseira?(\s|$)|(^|\s)traseiro(\s|$)/.test(value) },
        { key: "left", label: "Foto da lateral esquerda", chip: "Lateral esquerda", matches: (value) => /lateral esquerda|lado esquerdo/.test(value) }
    ];

    const selected = new Set();
    const filterPhotos = (photos) => {
        if (preview && typeof preview._filterReportEvidencePhotos === "function") {
            return preview._filterReportEvidencePhotos(photos).map(photoSrc).filter(Boolean);
        }
        return (Array.isArray(photos) ? photos : []).map(photoSrc).filter(Boolean);
    };

    const guidedPhotos = slots.map((slot) => {
        let index = records.findIndex((record, recordIndex) => {
            if (selected.has(recordIndex)) {
                return false;
            }
            const photos = Array.isArray(record && record.photos) ? record.photos : [];
            return photos.length > 0 && isGuided(record) && record.vehicle_photo_slot === slot.key;
        });

        if (index < 0) {
            index = records.findIndex((record, recordIndex) => {
                if (selected.has(recordIndex) || isGuided(record) || isCover(record) || isIssueLike(record)) {
                    return false;
                }
                const photos = Array.isArray(record && record.photos) ? record.photos : [];
                const searchable = normalizeSearch([record && record.title, record && record.item].filter(Boolean).join(" "));
                return photos.length > 0 && slot.matches(searchable);
            });
        }

        if (index < 0) {
            return { label: slot.label, chip: slot.chip, src: "" };
        }

        selected.add(index);
        const srcs = filterPhotos(records[index].photos);
        return { label: slot.label, chip: slot.chip, src: srcs[0] || photoSrc(records[index].photos[0]) };
    });

    const issues = [];
    const complementary = [];
    let dashboardAdded = false;

    records.forEach((record, index) => {
        if (selected.has(index)) {
            return;
        }

        const photos = filterPhotos(record && record.photos);

        if (isGuided(record) || isCover(record)) {
            if (record.vehicle_photo_slot === "dashboard" && photos.length && !dashboardAdded) {
                dashboardAdded = true;
                complementary.push({
                    title: record.title || "Painel / KM",
                    description: record.description || "",
                    severity: record.severity || "",
                    recommendation: record.recommendation || "",
                    photos,
                    kind: "complementary"
                });
            }
            return;
        }

        const searchable = normalizeSearch([
            record && record.title,
            record && record.item,
            record && record.description
        ].filter(Boolean).join(" "));
        /*
         * Painel/KM guiado usa record_kind + vehicle_photo_slot (branch acima).
         * Texto de ocorrência técnica não define categoria estrutural.
         */
        const isComplementary = /combust|document|chassi|placa|acessor|estepe|macaco|triangulo/.test(searchable);

        if (isComplementary) {
            complementary.push({
                title: record.title || "Registro complementar",
                description: record.description || "",
                severity: record.severity || "",
                recommendation: record.recommendation || "",
                photos,
                kind: "complementary"
            });
            return;
        }

        if (photos.length || record.title || record.description) {
            issues.push({
                title: record.title || "Avaria registrada",
                description: record.description || "",
                severity: record.severity || "",
                recommendation: record.recommendation || "",
                photos,
                kind: "issue"
            });
        }
    });

    return { guidedPhotos, issues, complementary };
}

function checklistItems(intake) {
    return [
        ["Iluminação externa", intake.internal_external],
        ["Palhetas e para-brisa", intake.windshield],
        ["Óleo, fluidos e níveis", intake.levels],
        ["Sistema de freios", intake.brakes],
        ["Pneus e rodas", intake.tires],
        ["Suspensão e direção", intake.suspension_steering],
        ["Bateria e sistema elétrico", intake.battery],
        ["Itens de segurança", intake.safety_items]
    ].map(([label, value]) => ({
        label,
        value: fallbackText(value, "Não verificado")
    }));
}

function buildPdfModelFromPreview(preview, report) {
    const current = report || {};
    const customer = current.customer || {};
    const asset = current.asset || {};
    const intake = current.intake || {};
    const diagnostic = current.diagnostic || {};
    const approval = Object.assign(
        {},
        (current.snapshot && current.snapshot.approval) || {},
        current.approval || {}
    );
    const company =
        preview && typeof preview._resolveReportCompany === "function"
            ? preview._resolveReportCompany(current)
            : (current.company || {});
    const cover =
        preview && typeof preview._resolveCoverPhoto === "function"
            ? preview._resolveCoverPhoto(current)
            : current.cover_photo || current.coverPhoto || null;
    const publicId =
        preview && typeof preview._publicReportId === "function"
            ? preview._publicReportId(current)
            : String(current.public_id || current.id || "AURORA");
    const createdAtLabel =
        preview && typeof preview._formatDate === "function"
            ? preview._formatDate(current.created_at)
            : String(current.created_at || "");
    const subtitle =
        preview && typeof preview._resolveVehicleReportCoverTitle === "function"
            ? preview._resolveVehicleReportCoverTitle(current, approval, asset)
            : fallbackText(current.report_title || current.title, "Relatório");
    const serviceId = String(
        (current.service && current.service.id) ||
        (current.snapshot && current.snapshot.service && current.snapshot.service.id) ||
        ""
    ).toLowerCase();
    const isVehicleInspection = serviceId === "vehicle_inspection";
    const color =
        preview && typeof preview._vehicleColorLabel === "function"
            ? preview._vehicleColorLabel(asset.color)
            : asset.color;
    const mileage =
        preview && typeof preview._formatVehicleMileage === "function"
            ? preview._formatVehicleMileage(asset.mileage)
            : asset.mileage;
    const responsible =
        preview && typeof preview._resolveVehicleInspectionResponsible === "function"
            ? preview._resolveVehicleInspectionResponsible(intake, company, current)
            : intake.responsible || company.professional || "";
    const vehicleSections = isVehicleInspection
        ? collectVehicleSections(preview, current.occurrences)
        : {
            guidedPhotos: [],
            issues: (Array.isArray(current.occurrences) ? current.occurrences : []).map((record) => ({
                title: record.title || "Registro",
                description: record.description || "",
                severity: record.severity || "",
                recommendation: record.recommendation || "",
                photos: (Array.isArray(record.photos) ? record.photos : []).map(photoSrc).filter(Boolean),
                kind: "issue"
            })),
            complementary: []
        };

    return {
        reportId: String(current.id || ""),
        publicId,
        createdAtLabel,
        company: {
            name: fallbackText(company.name, "AURORA"),
            tagline: String(company.tagline || "").trim(),
            logo: photoSrc(company.logo) || String(company.logo || "").trim(),
            professional: fallbackText(company.professional, "Não informado"),
            description: String(company.description || "").trim(),
            logoReportScale: Math.max(200, Math.min(300, Number(company.logo_report_scale) || 200)),
            coverPhotoReportScale: Math.max(150, Math.min(250, Number(company.cover_photo_report_scale) || 150))
        },
        isVehicleInspection,
        documentTitle: isVehicleInspection
            ? "RELATÓRIO DE VISTORIA VEICULAR"
            : fallbackText(current.service && current.service.title, "RELATÓRIO TÉCNICO"),
        subtitle,
        coverPhotoSrc: cover ? photoSrc(cover) : "",
        identity: (() => {
            const items = [
                {
                    label: "Cliente",
                    value: fallbackText(customer.name || customer.company_name, "Não informado")
                },
                {
                    label: "Veículo",
                    value: fallbackText(
                        asset.identification || asset.vehicle || asset.plate || asset.tag,
                        "Não informado"
                    )
                },
                {
                    label: "Tipo de cliente",
                    value: fallbackText(customer.person_type, "Não informado")
                },
                {
                    label: "Telefone",
                    value: fallbackText(customer.phone, "Não informado")
                }
            ];
            const customerEmail = String(customer.email || "").trim();

            if (customerEmail) {
                items.push({
                    label: "E-mail",
                    value: customerEmail
                });
            }

            items.push({
                label: "Responsável técnico",
                value: fallbackText(company.professional, "Não informado")
            });

            return items;
        })(),
        vehicleDetails: [
            { label: "Placa", value: fallbackText(asset.plate, "Não informado") },
            { label: "Ano / modelo", value: fallbackText(asset.year_model, "Não informado") },
            { label: "Cor", value: fallbackText(color, "Não informado") },
            { label: "Quilometragem", value: fallbackText(mileage, "Não informado") },
            { label: "Combustível", value: fallbackText(asset.fuel_level, "Não informado") },
            { label: "Estepe", value: fallbackText(asset.spare_tire, "Não verificado") },
            { label: "Nº da OS", value: fallbackText(asset.work_order, "Não informado") }
        ],
        vehicleNotes: String(asset.notes || "").trim(),
        intake: {
            services: inlineList(intake.requested_services, fallbackText(intake.reason, "Não informado")),
            items: inlineList(intake.received_items, "Não informado")
        },
        checklist: checklistItems(intake),
        checklistMeta: {
            responsible: String(responsible || "").trim(),
            entry: [intake.entry_date, intake.entry_time].filter(Boolean).join(" · "),
            notes: String(intake.initial_condition || "").trim()
        },
        guidedPhotos: vehicleSections.guidedPhotos,
        issues: vehicleSections.issues,
        complementary: vehicleSections.complementary,
        diagnostic: {
            summary: fallbackText(
                diagnostic.summary || diagnostic.conclusion,
                "Nenhum resumo registrado."
            ),
            recommendation: fallbackText(
                diagnostic.recommendation,
                "Nenhuma recomendação registrada."
            )
        },
        finalization: {
            status: fallbackText(approval.status || current.status, "Concluído"),
            notes: fallbackText(approval.notes, "Nenhuma observação adicional registrada.")
        },
        signatureSrc: approval.collect_signature ? String(approval.signature_data || "").trim() : "",
        showSeverity: reportPreferenceOn(current, approval, "show_severity"),
        showRecordLabels: reportPreferenceOn(current, approval, "show_record_labels"),
        footer: {
            company: fallbackText(company.name, "AURORA"),
            reportId: publicId,
            date: createdAtLabel
        }
    };
}

function createPager(pdfDoc, fonts, meta, colors) {
    const pages = [];
    let page = null;
    let y = 0;

    function addPage() {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pages.push(page);
        y = PAGE_HEIGHT - MARGIN_TOP;
        return page;
    }

    function remaining() {
        return y - MARGIN_BOTTOM;
    }

    function ensureSpace(height) {
        if (!page) {
            addPage();
        }
        if (remaining() < height) {
            addPage();
        }
        return page;
    }

    function keepTogether(height) {
        ensureSpace(Math.min(height, PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - 8));
    }

    function drawFooter() {
        pages.forEach((item, index) => {
            item.drawLine({
                start: { x: MARGIN_LEFT, y: 40 },
                end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: 40 },
                thickness: 0.6,
                color: colors.line
            });
            item.drawText(toWinAnsi(meta.company + " · Gerado pela plataforma AURORA"), {
                x: MARGIN_LEFT,
                y: FOOTER_Y,
                size: 8,
                font: fonts.regular,
                color: colors.muted
            });
            const pageLabel = toWinAnsi(
                meta.reportId + " · Página " + (index + 1) + " de " + pages.length
            );
            const width = fonts.bold.widthOfTextAtSize(pageLabel, 8);
            item.drawText(pageLabel, {
                x: PAGE_WIDTH - MARGIN_RIGHT - width,
                y: FOOTER_Y,
                size: 8,
                font: fonts.bold,
                color: colors.text
            });
        });
    }

    return {
        get page() {
            return page;
        },
        get y() {
            return y;
        },
        set y(value) {
            y = value;
        },
        get pages() {
            return pages;
        },
        colors,
        fonts,
        addPage,
        remaining,
        ensureSpace,
        keepTogether,
        drawFooter
    };
}

function drawTextLine(pager, fonts, text, options) {
    const size = options.size || 11;
    const font = options.bold ? fonts.bold : fonts.regular;
    const color = options.color || pager.colors.text;
    const gap = options.gap == null ? size + 4 : options.gap;
    const x = options.x == null ? MARGIN_LEFT : options.x;
    pager.ensureSpace(gap);
    pager.page.drawText(toWinAnsi(text), {
        x,
        y: pager.y - size,
        size,
        font,
        color
    });
    pager.y -= gap;
}

function drawParagraph(pager, fonts, text, options) {
    const size = (options && options.size) || 10;
    const font = options && options.bold ? fonts.bold : fonts.regular;
    const color = (options && options.color) || pager.colors.text;
    const width = (options && options.width) || CONTENT_WIDTH;
    const x = (options && options.x) != null ? options.x : MARGIN_LEFT;
    const lineGap = size + 3;
    const lines = wrapLines(font, text, size, width);

    if (!lines.length) {
        return;
    }

    lines.forEach((line) => {
        pager.ensureSpace(lineGap);
        pager.page.drawText(line, {
            x,
            y: pager.y - size,
            size,
            font,
            color
        });
        pager.y -= lineGap;
    });
}

function glyphBlockHeight(count, size, lineHeight) {
    if (!count) {
        return 0;
    }
    return (count - 1) * lineHeight + size;
}

function drawSectionTitle(pager, fonts, title, options) {
    const needed = 28;
    const skipKeep = options && options.skipKeepTogether;
    const followMin = options && options.followMin != null ? options.followMin : 36;
    if (!skipKeep) {
        pager.keepTogether(needed + followMin);
    }
    pager.page.drawRectangle({
        x: MARGIN_LEFT,
        y: pager.y - 14,
        width: 3,
        height: 14,
        color: pager.colors.teal
    });
    pager.page.drawText(toWinAnsi(title), {
        x: MARGIN_LEFT + 10,
        y: pager.y - 13,
        size: 12,
        font: fonts.bold,
        color: pager.colors.text
    });
    pager.y -= 20;
    pager.page.drawLine({
        start: { x: MARGIN_LEFT, y: pager.y },
        end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: pager.y },
        thickness: 0.7,
        color: pager.colors.line
    });
    pager.y -= 12;
}

function drawFactGrid(pager, fonts, items) {
    const colWidth = (CONTENT_WIDTH - 16) / 2;
    const rowHeight = 32;

    for (let index = 0; index < items.length; index += 2) {
        pager.keepTogether(rowHeight);
        const left = items[index];
        const right = items[index + 1];
        const yValue = pager.y - 11;
        const yLabel = pager.y - 22;

        pager.page.drawText(toWinAnsi(left.value), {
            x: MARGIN_LEFT,
            y: yValue,
            size: 11,
            font: fonts.bold,
            color: pager.colors.text
        });
        pager.page.drawText(toWinAnsi(String(left.label || "").toUpperCase()), {
            x: MARGIN_LEFT,
            y: yLabel,
            size: 7,
            font: fonts.regular,
            color: pager.colors.muted
        });

        if (right) {
            pager.page.drawText(toWinAnsi(right.value), {
                x: MARGIN_LEFT + colWidth + 16,
                y: yValue,
                size: 11,
                font: fonts.bold,
                color: pager.colors.text
            });
            pager.page.drawText(toWinAnsi(String(right.label || "").toUpperCase()), {
                x: MARGIN_LEFT + colWidth + 16,
                y: yLabel,
                size: 7,
                font: fonts.regular,
                color: pager.colors.muted
            });
        }

        pager.y -= rowHeight;
    }
}

function drawSpecGrid(pager, fonts, items) {
    const cols = 3;
    const gap = 12;
    const colWidth = (CONTENT_WIDTH - gap * (cols - 1)) / cols;
    const rowHeight = 30;

    for (let index = 0; index < items.length; index += cols) {
        pager.keepTogether(rowHeight);
        items.slice(index, index + cols).forEach((item, offset) => {
            const x = MARGIN_LEFT + offset * (colWidth + gap);
            pager.page.drawText(toWinAnsi(String(item.label || "").toUpperCase()), {
                x,
                y: pager.y - 8,
                size: 7,
                font: fonts.regular,
                color: pager.colors.muted
            });
            const valueLines = wrapLines(fonts.bold, item.value, 10, colWidth);
            pager.page.drawText(valueLines[0] || "", {
                x,
                y: pager.y - 21,
                size: 10,
                font: fonts.bold,
                color: pager.colors.text
            });
        });
        pager.y -= rowHeight;
    }
}

function drawChecklist(pager, fonts, rows) {
    rows.forEach((row) => {
        pager.keepTogether(18);
        pager.page.drawLine({
            start: { x: MARGIN_LEFT, y: pager.y },
            end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: pager.y },
            thickness: 0.4,
            color: pager.colors.line
        });
        pager.y -= 13;
        pager.page.drawText(toWinAnsi(row.label), {
            x: MARGIN_LEFT,
            y: pager.y,
            size: 10,
            font: fonts.regular,
            color: pager.colors.text
        });
        const value = toWinAnsi(row.value);
        const width = fonts.bold.widthOfTextAtSize(value, 9);
        pager.page.drawText(value, {
            x: PAGE_WIDTH - MARGIN_RIGHT - width,
            y: pager.y,
            size: 9,
            font: fonts.bold,
            color: pager.colors.muted
        });
        pager.y -= 8;
    });
}

function fittedImageSize(image, maxWidth, maxHeight) {
    const size = image.size();
    const ratio = Math.min(maxWidth / size.width, maxHeight / size.height);
    return {
        width: size.width * ratio,
        height: size.height * ratio
    };
}

function mediaFitSingle(image, innerWidth) {
    const size = image.size();
    const portrait = size.height > size.width * 1.05;
    const maxW = portrait
        ? Math.min(innerWidth * 0.58, mm(68))
        : Math.min(innerWidth * 0.72, mm(72));
    const maxH = portrait ? mm(52) : mm(42);
    return fittedImageSize(image, maxW, maxH);
}

async function drawEmbeddedImage(pager, image, maxWidth, maxHeight, x) {
    if (!image) {
        return 0;
    }

    const box = fittedImageSize(image, maxWidth, maxHeight);
    pager.keepTogether(box.height + 8);
    pager.page.drawImage(image, {
        x: x == null ? MARGIN_LEFT : x,
        y: pager.y - box.height,
        width: box.width,
        height: box.height
    });
    pager.y -= box.height + 8;
    return box.height;
}

function mm(value) {
    return value * (72 / 25.4);
}

function px(value) {
    return value * (72 / 96);
}

async function drawCover(pager, fonts, model, imageCache, pdfDoc) {
    const padTop = px(36);
    const padBottom = px(36);
    const innerLeft = MARGIN_LEFT;
    const innerRight = PAGE_WIDTH - MARGIN_RIGHT;
    const innerWidth = innerRight - innerLeft;
    const headerGap = px(16);
    const layoutGap = px(24);
    const colGap = px(22);
    const nameSize = 16;
    const nameLine = nameSize * 1.2;
    const tagSize = 9;
    const tagLine = tagSize * 1.35;
    const titleSize = model.isVehicleInspection ? 20 : 22;
    const titleLine = titleSize * 1.08;
    const subSize = 13.5;
    const subLine = subSize * 1.35;
    const logoScale = Math.max(0.70, Math.min(2.50, Number(model.company.logoReportScale || 100) / 100));
    const coverPhotoScale = Math.max(0.70, Math.min(1.80, Number(model.company.coverPhotoReportScale || 100) / 100));
    const logoMax = { width: mm(30) * logoScale, height: mm(16) * logoScale };
    const photoMax = { width: Math.min(mm(92), mm(75) * coverPhotoScale), height: Math.min(mm(48), mm(56) * coverPhotoScale) };

    const logoImage = model.company.logo
        ? await embedImage(pdfDoc, model.company.logo, imageCache)
        : null;
    const coverImage = model.coverPhotoSrc
        ? await embedImage(pdfDoc, model.coverPhotoSrc, imageCache)
        : null;
    const logoBox = logoImage
        ? fittedImageSize(logoImage, logoMax.width, logoMax.height)
        : null;
    const photoBox = coverImage
        ? fittedImageSize(coverImage, photoMax.width, photoMax.height)
        : null;

    const nameMaxWidth = logoBox
        ? Math.max(80, innerWidth - headerGap - logoBox.width)
        : innerWidth;
    const nameLines = wrapLines(
        fonts.bold,
        model.company.name,
        nameSize,
        nameMaxWidth
    );
    const tagLines = model.company.tagline
        ? wrapLines(
            fonts.regular,
            model.company.tagline,
            tagSize,
            nameMaxWidth
        )
        : [];
    const headerTextHeight =
        glyphBlockHeight(nameLines.length, nameSize, nameLine) +
        (tagLines.length ? px(4) + glyphBlockHeight(tagLines.length, tagSize, tagLine) : 0);
    const headerHeight = Math.max(
        headerTextHeight,
        logoBox ? logoBox.height : 0
    );

    const photoColWidth = photoBox ? photoBox.width : 0;
    const textColWidth = photoBox
        ? Math.max(120, innerWidth - colGap - photoColWidth)
        : innerWidth;
    const titleLines = wrapLines(
        fonts.bold,
        model.documentTitle,
        titleSize,
        textColWidth
    );
    const subtitleLines = String(model.subtitle || "").trim()
        ? wrapLines(fonts.regular, model.subtitle, subSize, textColWidth)
        : [];
    const textBlockHeight =
        glyphBlockHeight(titleLines.length, titleSize, titleLine) +
        (subtitleLines.length
            ? px(12) + glyphBlockHeight(subtitleLines.length, subSize, subLine)
            : 0);
    const layoutHeight = Math.max(
        textBlockHeight,
        photoBox ? photoBox.height : 0
    );
    const bandHeight =
        padTop + headerHeight + layoutGap + layoutHeight + padBottom;
    const top = PAGE_HEIGHT;

    pager.page.drawRectangle({
        x: 0,
        y: top - bandHeight,
        width: PAGE_WIDTH,
        height: bandHeight,
        color: pager.colors.navy
    });

    const headerTop = top - padTop;
    let textY = headerTop;
    nameLines.forEach((line, index) => {
        pager.page.drawText(line, {
            x: innerLeft,
            y: textY - nameSize,
            size: nameSize,
            font: fonts.bold,
            color: pager.colors.white
        });
        textY -= index === nameLines.length - 1 ? nameSize : nameLine;
    });
    if (tagLines.length) {
        textY -= px(4);
        tagLines.forEach((line, index) => {
            pager.page.drawText(line, {
                x: innerLeft,
                y: textY - tagSize,
                size: tagSize,
                font: fonts.regular,
                color: pager.colors.tagline
            });
            textY -= index === tagLines.length - 1 ? tagSize : tagLine;
        });
    }

    if (logoImage && logoBox) {
        pager.page.drawImage(logoImage, {
            x: innerRight - logoBox.width,
            y: headerTop - logoBox.height,
            width: logoBox.width,
            height: logoBox.height
        });
    }

    const layoutTop = headerTop - headerHeight - layoutGap;
    let layoutY = layoutTop;
    titleLines.forEach((line, index) => {
        pager.page.drawText(line, {
            x: innerLeft,
            y: layoutY - titleSize,
            size: titleSize,
            font: fonts.bold,
            color: pager.colors.white
        });
        layoutY -= index === titleLines.length - 1 ? titleSize : titleLine;
    });
    if (subtitleLines.length) {
        layoutY -= px(12);
        subtitleLines.forEach((line, index) => {
            pager.page.drawText(line, {
                x: innerLeft,
                y: layoutY - subSize,
                size: subSize,
                font: fonts.regular,
                color: pager.colors.subtitle
            });
            layoutY -= index === subtitleLines.length - 1 ? subSize : subLine;
        });
    }

    if (coverImage && photoBox) {
        const photoColX = innerLeft + textColWidth + colGap;
        pager.page.drawImage(coverImage, {
            x: photoColX,
            y: layoutTop - photoBox.height,
            width: photoBox.width,
            height: photoBox.height
        });
    }

    pager.y = top - bandHeight - 8;
}

async function drawPhotoPair(pager, fonts, pdfDoc, imageCache, photos) {
    const gap = 12;
    const cellWidth = (CONTENT_WIDTH - gap) / 2;
    const maxHeight = 148;

    for (let index = 0; index < photos.length; index += 2) {
        const left = photos[index];
        const right = photos[index + 1];
        const leftImage = left && left.src
            ? await embedImage(pdfDoc, left.src, imageCache)
            : null;
        const rightImage = right && right.src
            ? await embedImage(pdfDoc, right.src, imageCache)
            : null;
        const leftSize = leftImage ? fittedImageSize(leftImage, cellWidth, maxHeight) : { width: cellWidth, height: 72 };
        const rightSize = rightImage ? fittedImageSize(rightImage, cellWidth, maxHeight) : { width: cellWidth, height: 72 };
        const rowHeight = Math.max(leftSize.height, rightSize.height) + 22;
        pager.keepTogether(rowHeight);

        const drawCell = (item, image, size, x) => {
            if (!item) {
                return;
            }
            if (image) {
                pager.page.drawImage(image, {
                    x,
                    y: pager.y - size.height,
                    width: size.width,
                    height: size.height
                });
            } else {
                pager.page.drawRectangle({
                    x,
                    y: pager.y - 72,
                    width: cellWidth,
                    height: 72,
                    borderColor: pager.colors.line,
                    borderWidth: 0.8,
                    color: pager.colors.card
                });
                pager.page.drawText(toWinAnsi("Foto não adicionada"), {
                    x: x + 10,
                    y: pager.y - 40,
                    size: 9,
                    font: fonts.regular,
                    color: pager.colors.muted
                });
            }
            pager.page.drawText(toWinAnsi(item.chip || item.label || ""), {
                x,
                y: pager.y - Math.max(size.height, 72) - 12,
                size: 8,
                font: fonts.bold,
                color: pager.colors.muted
            });
        };

        drawCell(left, leftImage, leftSize, MARGIN_LEFT);
        if (right) {
            drawCell(right, rightImage, rightSize, MARGIN_LEFT + cellWidth + gap);
        }
        pager.y -= rowHeight;
    }
}

async function drawRecordCard(pager, fonts, pdfDoc, imageCache, record, index, kind, options) {
    const showSeverity = !(options && options.showSeverity === false);
    const showRecordLabels = !(options && options.showRecordLabels === false);
    const padX = 12;
    const padTop = 8;
    const padBottom = 8;
    const accentWidth = 2.2;
    const innerLeft = MARGIN_LEFT + accentWidth + padX;
    const innerWidth = CONTENT_WIDTH - accentWidth - padX * 2;
    const title = String(record.title || "").trim();
    const visibleTitle = title && !isAutomaticRecordTitle(title) ? title : "";
    const description = String(record.description || "").trim();
    const recommendation = String(record.recommendation || "").trim();
    const label = kind === "issue"
        ? "Ocorrência " + String(index + 1).padStart(2, "0")
        : "Registro " + String(index + 1).padStart(2, "0");
    const hasSeverity = showSeverity && isMeaningfulSeverity(record.severity, kind);
    const showHeader = showRecordLabels || hasSeverity;
    const titleSize = 11;
    const titleLine = titleSize + 3;
    const bodySize = 10;
    const bodyLine = bodySize + 3;
    const titleLines = visibleTitle
        ? wrapLines(fonts.bold, visibleTitle, titleSize, innerWidth)
        : [];
    const descriptionLines = description
        ? wrapLines(fonts.regular, description, bodySize, innerWidth)
        : [];
    const recoLines = recommendation
        ? wrapLines(fonts.regular, recommendation, bodySize, innerWidth)
        : [];
    const photos = Array.isArray(record.photos) ? record.photos : [];
    const embedded = [];

    for (let photoIndex = 0; photoIndex < photos.length; photoIndex += 1) {
        const image = await embedImage(pdfDoc, photos[photoIndex], imageCache);
        if (image) {
            embedded.push(image);
        }
    }

    const framePad = mm(1.5);
    const photoBoxes = embedded.map((image) => {
        if (embedded.length === 1) {
            return mediaFitSingle(image, innerWidth - framePad * 2);
        }
        return fittedImageSize(
            image,
            (innerWidth - 8 - framePad * 4) / 2,
            mm(30)
        );
    });

    let photosHeight = 0;
    if (photoBoxes.length === 1) {
        photosHeight = 8 + photoBoxes[0].height + framePad * 2;
    } else {
        for (let photoIndex = 0; photoIndex < photoBoxes.length; photoIndex += 2) {
            const leftBox = photoBoxes[photoIndex];
            const rightBox = photoBoxes[photoIndex + 1];
            photosHeight += 6 + Math.max(leftBox.height, rightBox ? rightBox.height : 0) + framePad * 2;
        }
    }

    const headerHeight = showHeader ? 18 : 0;
    const cardHeight =
        padTop +
        headerHeight +
        (showHeader ? 6 : 0) +
        titleLines.length * titleLine +
        descriptionLines.length * bodyLine +
        photosHeight +
        (recoLines.length ? 20 + recoLines.length * bodyLine : 0) +
        padBottom;

    const sectionTitle = options && options.sectionTitle
        ? String(options.sectionTitle).trim()
        : "";
    const sectionBlock = sectionTitle ? 32 : 0;
    pager.keepTogether(sectionBlock + Math.max(cardHeight, 48));
    if (sectionTitle) {
        drawSectionTitle(pager, fonts, sectionTitle, { skipKeepTogether: true });
    }
    const top = pager.y;
    const bottom = top - cardHeight;

    pager.page.drawRectangle({
        x: MARGIN_LEFT,
        y: bottom,
        width: CONTENT_WIDTH,
        height: cardHeight,
        color: kind === "issue" ? pager.colors.cardIssue : pager.colors.cardComp,
        borderColor: pager.colors.line,
        borderWidth: 0.8
    });
    pager.page.drawRectangle({
        x: MARGIN_LEFT,
        y: bottom,
        width: accentWidth,
        height: cardHeight,
        color: kind === "issue" ? pager.colors.issue : pager.colors.teal
    });

    let cursorY = top - padTop;
    if (showHeader) {
        if (showRecordLabels) {
            pager.page.drawText(toWinAnsi(label), {
                x: innerLeft,
                y: cursorY - 9,
                size: 8,
                font: fonts.bold,
                color: pager.colors.muted
            });
        }
        if (hasSeverity) {
            const severityText = toWinAnsi(String(record.severity || "").trim());
            const severityWidth = fonts.bold.widthOfTextAtSize(severityText, 8);
            pager.page.drawText(severityText, {
                x: MARGIN_LEFT + CONTENT_WIDTH - padX - severityWidth,
                y: cursorY - 9,
                size: 8,
                font: fonts.bold,
                color: pager.colors.warn
            });
        }
        cursorY -= headerHeight;
        pager.page.drawLine({
            start: { x: innerLeft, y: cursorY },
            end: { x: MARGIN_LEFT + CONTENT_WIDTH - padX, y: cursorY },
            thickness: 0.5,
            color: pager.colors.line
        });
        cursorY -= 6;
    }

    titleLines.forEach((line) => {
        pager.page.drawText(line, {
            x: innerLeft,
            y: cursorY - titleSize,
            size: titleSize,
            font: fonts.bold,
            color: pager.colors.text
        });
        cursorY -= titleLine;
    });
    descriptionLines.forEach((line) => {
        pager.page.drawText(line, {
            x: innerLeft,
            y: cursorY - bodySize,
            size: bodySize,
            font: fonts.regular,
            color: pager.colors.text
        });
        cursorY -= bodyLine;
    });

    if (embedded.length === 1) {
        const box = photoBoxes[0];
        const frameW = box.width + framePad * 2;
        const frameH = box.height + framePad * 2;
        cursorY -= 8;
        const frameX = innerLeft + (innerWidth - frameW) / 2;
        pager.page.drawRectangle({
            x: frameX,
            y: cursorY - frameH,
            width: frameW,
            height: frameH,
            color: pager.colors.media,
            borderColor: pager.colors.line,
            borderWidth: 0.6
        });
        pager.page.drawImage(embedded[0], {
            x: frameX + framePad,
            y: cursorY - framePad - box.height,
            width: box.width,
            height: box.height
        });
        cursorY -= frameH;
    } else {
        const colWidth = (innerWidth - 8) / 2;
        for (let photoIndex = 0; photoIndex < embedded.length; photoIndex += 2) {
            const leftBox = photoBoxes[photoIndex];
            const rightBox = photoBoxes[photoIndex + 1];
            const rowHeight = Math.max(
                leftBox.height + framePad * 2,
                rightBox ? rightBox.height + framePad * 2 : 0
            );
            cursorY -= 8;
            const drawFramed = (image, box, x) => {
                const frameH = box.height + framePad * 2;
                const frameW = Math.min(colWidth, box.width + framePad * 2);
                pager.page.drawRectangle({
                    x,
                    y: cursorY - frameH,
                    width: frameW,
                    height: frameH,
                    color: pager.colors.media,
                    borderColor: pager.colors.line,
                    borderWidth: 0.6
                });
                pager.page.drawImage(image, {
                    x: x + (frameW - box.width) / 2,
                    y: cursorY - framePad - box.height,
                    width: box.width,
                    height: box.height
                });
            };
            drawFramed(embedded[photoIndex], leftBox, innerLeft);
            if (embedded[photoIndex + 1] && rightBox) {
                drawFramed(embedded[photoIndex + 1], rightBox, innerLeft + colWidth + 8);
            }
            cursorY -= rowHeight;
        }
    }

    if (recoLines.length) {
        cursorY -= 8;
        pager.page.drawText(toWinAnsi("Recomendação"), {
            x: innerLeft,
            y: cursorY - 8,
            size: 8,
            font: fonts.bold,
            color: pager.colors.teal
        });
        cursorY -= 12;
        recoLines.forEach((line) => {
            pager.page.drawText(line, {
                x: innerLeft,
                y: cursorY - bodySize,
                size: bodySize,
                font: fonts.regular,
                color: pager.colors.text
            });
            cursorY -= bodyLine;
        });
    }

    pager.y = bottom - 10;
}

async function generatePdfBytesFromModel(model) {
    const lib = getPdfLib();
    const pdfDoc = await lib.PDFDocument.create();
    const fonts = {
        regular: await pdfDoc.embedFont(lib.StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(lib.StandardFonts.HelveticaBold)
    };
    const colors = palette();
    const pager = createPager(pdfDoc, fonts, {
        company: model.footer.company,
        reportId: model.footer.reportId
    }, colors);
    const imageCache = new Map();

    pager.addPage();
    await drawCover(pager, fonts, model, imageCache, pdfDoc);

    if (model.company.description) {
        drawSectionTitle(pager, fonts, "Sobre a empresa");
        drawParagraph(pager, fonts, model.company.description, { size: 10 });
        pager.y -= 8;
    }

    drawSectionTitle(pager, fonts, "Identificação");
    drawFactGrid(pager, fonts, model.identity);
    pager.y -= 4;

    drawSectionTitle(pager, fonts, "Detalhes do veículo");
    drawSpecGrid(pager, fonts, model.vehicleDetails);
    if (model.vehicleNotes) {
        drawTextLine(pager, fonts, "Observações", { size: 8, color: pager.colors.muted, gap: 12 });
        drawParagraph(pager, fonts, model.vehicleNotes, { size: 10 });
    }
    pager.y -= 6;

    if (model.isVehicleInspection) {
        drawSectionTitle(pager, fonts, "Serviços e itens recebidos");
        drawTextLine(pager, fonts, "Serviços solicitados", { size: 8, color: pager.colors.muted, gap: 12 });
        drawParagraph(pager, fonts, model.intake.services, { size: 10 });
        pager.y -= 4;
        drawTextLine(pager, fonts, "Itens recebidos", { size: 8, color: pager.colors.muted, gap: 12 });
        drawParagraph(pager, fonts, model.intake.items, { size: 10 });
        pager.y -= 8;

        drawSectionTitle(pager, fonts, "Checklist de recebimento");
        drawChecklist(pager, fonts, model.checklist);
        if (model.checklistMeta.responsible) {
            drawTextLine(pager, fonts, "Responsável pela vistoria", { size: 8, color: pager.colors.muted, gap: 12 });
            drawTextLine(pager, fonts, model.checklistMeta.responsible, { size: 11, bold: true, gap: 16 });
        }
        if (model.checklistMeta.entry) {
            drawTextLine(pager, fonts, "Entrada", { size: 8, color: pager.colors.muted, gap: 12 });
            drawTextLine(pager, fonts, model.checklistMeta.entry, { size: 11, bold: true, gap: 16 });
        }
        if (model.checklistMeta.notes) {
            drawTextLine(pager, fonts, "Observações do checklist", { size: 8, color: pager.colors.muted, gap: 12 });
            drawParagraph(pager, fonts, model.checklistMeta.notes, { size: 10 });
        }
        pager.y -= 8;

        drawSectionTitle(pager, fonts, "Fotos da vistoria");
        drawParagraph(
            pager,
            fonts,
            "Sequência: frente, lateral direita, traseira e lateral esquerda.",
            { size: 9, color: pager.colors.muted }
        );
        pager.y -= 6;
        await drawPhotoPair(pager, fonts, pdfDoc, imageCache, model.guidedPhotos);

        if (model.issues.length) {
            for (let index = 0; index < model.issues.length; index += 1) {
                await drawRecordCard(
                    pager,
                    fonts,
                    pdfDoc,
                    imageCache,
                    model.issues[index],
                    index,
                    "issue",
                    {
                        showSeverity: model.showSeverity,
                        showRecordLabels: model.showRecordLabels,
                        sectionTitle: index === 0 ? "Ocorrências / evidências" : ""
                    }
                );
            }
        }

        if (model.complementary.length) {
            for (let index = 0; index < model.complementary.length; index += 1) {
                await drawRecordCard(
                    pager,
                    fonts,
                    pdfDoc,
                    imageCache,
                    model.complementary[index],
                    index,
                    "complementary",
                    {
                        showSeverity: model.showSeverity,
                        showRecordLabels: model.showRecordLabels,
                        sectionTitle: index === 0 ? "Registros complementares" : ""
                    }
                );
            }
        }
    } else if (model.issues.length) {
        for (let index = 0; index < model.issues.length; index += 1) {
            await drawRecordCard(
                pager,
                fonts,
                pdfDoc,
                imageCache,
                model.issues[index],
                index,
                "issue",
                {
                    showSeverity: model.showSeverity,
                    showRecordLabels: model.showRecordLabels,
                    sectionTitle: index === 0 ? "Registros técnicos" : ""
                }
            );
        }
    }

    drawSectionTitle(pager, fonts, "Observações / diagnóstico");
    drawTextLine(pager, fonts, "Resumo técnico", { size: 8, color: pager.colors.muted, gap: 12 });
    drawParagraph(pager, fonts, model.diagnostic.summary, { size: 10 });
    pager.y -= 6;
    drawTextLine(pager, fonts, "Recomendação", { size: 8, color: pager.colors.muted, gap: 12 });
    drawParagraph(pager, fonts, model.diagnostic.recommendation, { size: 10 });
    pager.y -= 8;

    drawSectionTitle(pager, fonts, "Finalização");
    drawTextLine(pager, fonts, "Status da inspeção", { size: 8, color: pager.colors.muted, gap: 12 });
    drawTextLine(pager, fonts, model.finalization.status, { size: 12, bold: true, color: pager.colors.teal, gap: 18 });
    drawTextLine(pager, fonts, "Observação final", { size: 8, color: pager.colors.muted, gap: 12 });
    drawParagraph(pager, fonts, model.finalization.notes, { size: 10 });

    if (model.signatureSrc) {
        drawSectionTitle(pager, fonts, "Assinatura do cliente");
        const signature = await embedImage(pdfDoc, model.signatureSrc, imageCache);
        if (signature) {
            await drawEmbeddedImage(pager, signature, 260, 90);
        }
        drawTextLine(pager, fonts, "Assinatura coletada no recebimento do veículo", {
            size: 8,
            color: pager.colors.muted,
            gap: 12
        });
    }

    if (model.footer.date) {
        pager.y -= 6;
        drawTextLine(pager, fonts, "Emitido em " + model.footer.date, {
            size: 8,
            color: pager.colors.muted,
            gap: 12
        });
    }

    pager.drawFooter();
    return pdfDoc.save();
}

function currentReportFromPreview(preview) {
    if (
        preview &&
        preview.engine &&
        typeof preview.engine.get === "function" &&
        preview.currentReportId
    ) {
        return preview.engine.get(preview.currentReportId);
    }
    return null;
}

function computeSignature(report) {
    if (
        global.AuroraReportExport &&
        typeof global.AuroraReportExport.computeReportShareSignature === "function"
    ) {
        return global.AuroraReportExport.computeReportShareSignature(report);
    }
    return String((report && report.id) || "");
}

function createPdfShareFile(bytes, fileName) {
    return new File([bytes], fileName, { type: PDF_SHARE_MIME });
}

function buildPdfSharePayload(file, reportLabel) {
    return {
        title: "Relatório " + reportLabel,
        files: [file]
    };
}

function getPreviewPdfShareCache(preview) {
    return preview && preview._pdfShareCache ? preview._pdfShareCache : null;
}

function clearPreviewPdfShareCache(preview) {
    if (preview) {
        preview._pdfShareCache = null;
    }
}

function isPreviewPdfShareCacheValid(preview, report) {
    const cache = getPreviewPdfShareCache(preview);

    if (!cache || !cache.file || !cache.signature) {
        return false;
    }

    const current = report || currentReportFromPreview(preview);

    if (!current) {
        return false;
    }

    if (String(cache.reportId) !== String(current.id)) {
        return false;
    }

    if (preview && String(preview.currentReportId) !== String(current.id)) {
        return false;
    }

    return cache.signature === computeSignature(current);
}

async function generatePdfFromPreview(preview) {
    if (preview && preview._pdfShareClickGuard) {
        throw new Error(
            "generatePdfFromPreview não pode rodar durante o clique de Compartilhar PDF."
        );
    }

    const report = currentReportFromPreview(preview);

    if (!preview || !report) {
        throw new Error("Prévia do relatório não está aberta.");
    }

    const publicId =
        preview && typeof preview._publicReportId === "function"
            ? preview._publicReportId(report)
            : String(report.public_id || "relatorio_aurora");
    const fileName = publicId + ".pdf";

    /*
     * Rollback: window.__AURORA_PDF_USE_MANUAL_RENDERER__ = true
     * usa o renderer pdf-lib manual integrado neste arquivo.
     */
    if (global.__AURORA_PDF_USE_MANUAL_RENDERER__ === true) {
        const model = buildPdfModelFromPreview(preview, report);
        const bytes = await generatePdfBytesFromModel(model);
        return {
            bytes,
            fileName,
            reportLabel: publicId,
            reportId: String(report.id || ""),
            signature: computeSignature(report)
        };
    }

    if (
        !global.AuroraPdfFromLayout ||
        typeof global.AuroraPdfFromLayout.generateFromPreview !== "function"
    ) {
        throw new Error("Writer PDF a partir do layout HTML indisponível.");
    }

    const generated = await global.AuroraPdfFromLayout.generateFromPreview(preview);

    return {
        bytes: generated.bytes,
        fileName,
        reportLabel: publicId,
        reportId: String(report.id || ""),
        signature: computeSignature(report)
    };
}

async function preparePdfShareForPreview(preview) {
    const report = currentReportFromPreview(preview);

    if (!preview || !preview.modal || !preview.currentReportId || !report) {
        throw new Error("Prévia do relatório não está aberta.");
    }

    const signature = computeSignature(report);
    const generated = await generatePdfFromPreview(preview);
    const current = currentReportFromPreview(preview);

    if (
        !current ||
        String(preview.currentReportId) !== String(report.id) ||
        String(current.id) !== String(report.id) ||
        computeSignature(current) !== signature
    ) {
        return null;
    }

    const file = createPdfShareFile(generated.bytes, generated.fileName);
    const cache = {
        reportId: String(report.id),
        signature,
        fileName: generated.fileName,
        reportLabel: generated.reportLabel,
        file,
        size: file.size,
        preparedAt: Date.now()
    };

    preview._pdfShareCache = cache;
    return cache;
}

function triggerPdfDownload(file) {
    if (!file) {
        throw new Error("Arquivo PDF indisponível.");
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name || "relatorio_aurora.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    global.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function isPdfShareFallbackError(error) {
    if (!error) {
        return false;
    }

    const name = String(error.name || "");

    if (name === "NotAllowedError" || name === "SecurityError") {
        return true;
    }

    const message = String(error.message || "").toLowerCase();
    return message.indexOf("permission denied") !== -1;
}

async function fallbackPdfDownload(preview, notify, file) {
    const notifyFn = typeof notify === "function" ? notify : () => {};
    const fallbackMessage =
        "O navegador não permitiu abrir a folha de compartilhamento. O relatório PDF foi salvo no dispositivo para envio manual.";

    try {
        triggerPdfDownload(file);
    } catch (downloadError) {
        const message = downloadError && downloadError.message
            ? String(downloadError.message)
            : "Não foi possível compartilhar ou salvar o PDF";
        if (preview && typeof preview.notifyExportStatus === "function") {
            preview.notifyExportStatus(message);
        }
        notifyFn(message);
        throw downloadError;
    }

    if (preview && typeof preview.notifyExportStatus === "function") {
        preview.notifyExportStatus("Compartilhamento direto indisponível.");
    }
    notifyFn("Compartilhamento direto indisponível.");

    if (global.AuroraDialog && typeof global.AuroraDialog.alert === "function") {
        await global.AuroraDialog.alert(fallbackMessage, {
            title: "Compartilhamento direto indisponível",
            tone: "info",
            layout: "simple",
            confirmLabel: "Entendi"
        });
    }

    return { shared: false, file };
}

async function sharePdfFromPreview(preview, notify, options) {
    const notifyFn = typeof notify === "function" ? notify : () => {};

    if (
        global.AuroraReportExport &&
        typeof global.AuroraReportExport.captureUserActivation === "function"
    ) {
        global.AuroraReportExport.captureUserActivation(
            (options && options.activationAtClick && options.activationAtClick.phase) ||
            "pdf-click"
        );
    }

    if (preview) {
        preview._pdfShareClickGuard = true;
    }

    try {
        const report = currentReportFromPreview(preview);

        if (!isPreviewPdfShareCacheValid(preview, report)) {
            notifyFn("Preparando PDF...");
            return null;
        }

        const cache = preview._pdfShareCache;
        const pdfFile = cache.file;
        const shareExists = Boolean(
            global.navigator && typeof global.navigator.share === "function"
        );
        const canShareExists = Boolean(
            global.navigator && typeof global.navigator.canShare === "function"
        );
        let canShareFiles = false;

        try {
            canShareFiles = Boolean(
                shareExists &&
                canShareExists &&
                global.navigator.canShare({ files: [pdfFile] })
            );
        } catch (canShareError) {
            canShareFiles = false;
        }

        if (canShareFiles) {
            try {
                await global.navigator.share(
                    buildPdfSharePayload(pdfFile, cache.reportLabel)
                );
                notifyFn("PDF compartilhado.");
                return cache;
            } catch (shareError) {
                if (shareError && shareError.name === "AbortError") {
                    return null;
                }

                if (isPdfShareFallbackError(shareError)) {
                    return fallbackPdfDownload(preview, notifyFn, pdfFile);
                }

                throw shareError;
            }
        }

        return fallbackPdfDownload(preview, notifyFn, pdfFile);
    } catch (error) {
        if (error && error.name === "AbortError") {
            return null;
        }

        const message = error && error.message ? error.message : String(error);
        notifyFn(message);

        if (global.AuroraDialog && typeof global.AuroraDialog.alert === "function") {
            await global.AuroraDialog.alert(message, {
                title: "Não foi possível compartilhar o PDF",
                tone: "danger",
                layout: "simple",
                confirmLabel: "Entendi"
            });
        }

        throw error;
    } finally {
        if (preview) {
            preview._pdfShareClickGuard = false;
        }
    }
}

global.AuroraReportPdfPwa = {
    PDF_SHARE_MIME,
    buildPdfModelFromPreview,
    generatePdfBytesFromModel,
    generatePdfFromPreview,
    preparePdfShareForPreview,
    sharePdfFromPreview,
    isPreviewPdfShareCacheValid,
    getPreviewPdfShareCache,
    clearPreviewPdfShareCache,
    createPdfShareFile,
    buildPdfSharePayload
};

})(typeof window !== "undefined" ? window : globalThis);

(function (global) {
"use strict";

const utils = global.AuroraPremiumUtils || {};

const GUIDED_SLOTS = [
    { slot: "front", id: "frente", label: "Frente", index: "01" },
    { slot: "right", id: "lateral-direita", label: "Lateral direita", index: "02" },
    { slot: "rear", id: "traseira", label: "Traseira", index: "03" },
    { slot: "left", id: "lateral-esquerda", label: "Lateral esquerda", index: "04" },
    { slot: "dashboard", id: "painel-odometro", label: "Painel / Odômetro", index: "05" }
];

const CHECKLIST_FIELDS = [
    ["internal_external", "Iluminação externa"],
    ["windshield", "Palhetas e para-brisa"],
    ["levels", "Óleo, fluidos e níveis"],
    ["brakes", "Sistema de freios"],
    ["tires", "Pneus e rodas"],
    ["suspension_steering", "Suspensão e direção"],
    ["battery", "Bateria e sistema elétrico"],
    ["safety_items", "Itens de segurança"]
];

function isGuidedVehiclePhoto(occurrence) {
    if (!occurrence || typeof occurrence !== "object") {
        return false;
    }

    if (occurrence.record_kind === "vehicle_guided_photo") {
        return true;
    }

    return Boolean(occurrence.vehicle_photo_slot);
}

function resolveCompany(report, companyProvider) {
    const snapshot = (report && report.company) || {};
    const liveIdentity =
        typeof companyProvider === "function"
            ? companyProvider() || {}
            : {};

    if (
        global.AuroraReportCompanyIdentity &&
        typeof global.AuroraReportCompanyIdentity.mergeCompany === "function"
    ) {
        return global.AuroraReportCompanyIdentity.mergeCompany(
            liveIdentity,
            snapshot
        );
    }

    return Object.assign({}, snapshot, liveIdentity);
}

function resolveResponsible(intake, company, report) {
    if (
        global.AuroraReportCompanyIdentity &&
        typeof global.AuroraReportCompanyIdentity
            .resolveVehicleInspectionResponsible === "function"
    ) {
        return global.AuroraReportCompanyIdentity
            .resolveVehicleInspectionResponsible(
                intake,
                company,
                report
            );
    }

    return String(
        report.performed_by_name ||
        intake.responsible ||
        company.professional ||
        ""
    ).trim();
}

function resolveCoverPhoto(report) {
    const raw =
        report.coverPhoto ||
        report.cover_photo ||
        null;

    if (!raw || typeof raw !== "object") {
        return { url: "", alt: "" };
    }

    return {
        url: utils.normalizePhotoSrc(raw),
        alt: String(raw.alt || raw.description || "Foto de capa").trim()
    };
}

function buildGuidedPhotos(occurrences) {
    const slotMap = {};

    (occurrences || []).forEach((occurrence) => {
        if (!isGuidedVehiclePhoto(occurrence)) {
            return;
        }

        const slot = String(occurrence.vehicle_photo_slot || "").trim();
        const photo = Array.isArray(occurrence.photos)
            ? occurrence.photos[0]
            : null;
        const url = utils.normalizePhotoSrc(photo);

        if (!slot || !url || slotMap[slot]) {
            return;
        }

        slotMap[slot] = {
            url,
            alt: String(
                (photo && (photo.alt || photo.description)) ||
                occurrence.title ||
                occurrence.item ||
                slot
            ).trim()
        };
    });

    return GUIDED_SLOTS.map((meta) => {
        const found = slotMap[meta.slot] || { url: "", alt: meta.label };

        return {
            id: meta.id,
            label: meta.label,
            index: meta.index,
            url: found.url,
            alt: found.alt || meta.label
        };
    });
}

function buildOccurrences(occurrences) {
    const output = [];

    (occurrences || []).forEach((occurrence, index) => {
        if (isGuidedVehiclePhoto(occurrence)) {
            return;
        }

        const severity = utils.mapSeverityToPremium(occurrence.severity);
        if (!severity) {
            return;
        }

        const photo = Array.isArray(occurrence.photos)
            ? occurrence.photos[0]
            : null;
        const url = utils.normalizePhotoSrc(photo);

        output.push({
            id: String(occurrence.id || `occ-${index + 1}`),
            title: String(
                occurrence.title ||
                occurrence.item ||
                `Ocorrência ${index + 1}`
            ).trim(),
            severity,
            location: String(
                occurrence.item ||
                occurrence.component ||
                occurrence.location ||
                "Local não informado"
            ).trim(),
            finding: String(
                occurrence.description ||
                occurrence.condition ||
                "Sem constatação registrada."
            ).trim(),
            recommendation: String(
                occurrence.recommendation ||
                "Sem recomendação registrada."
            ).trim(),
            photo: {
                url,
                alt: String(
                    (photo && (photo.alt || photo.description)) ||
                    occurrence.title ||
                    "Evidência fotográfica"
                ).trim()
            }
        });
    });

    return output;
}

function buildChecklist(intake) {
    const source = intake || {};

    return CHECKLIST_FIELDS.map(([field, label], index) => ({
        id: `chk-${String(index + 1).padStart(2, "0")}`,
        label,
        status: utils.mapChecklistStatusToPremium(source[field])
    }));
}

function resolvePublicId(report) {
    return String(
        report.public_id ||
        report.id ||
        "AUR-0000-0000"
    ).trim();
}

function fromReport(report, options) {
    if (!report || typeof report !== "object") {
        throw new Error("Premium adapter requires a report object.");
    }

    const companyProvider =
        options && typeof options.companyProvider === "function"
            ? options.companyProvider
            : null;

    const company = resolveCompany(report, companyProvider);
    const intake = report.intake || {};
    const asset = report.asset || {};
    const approval = report.approval || {};
    const diagnostic = report.diagnostic || {};
    const createdAt = report.created_at || report.updated_at || new Date().toISOString();
    const entry = utils.formatIntakeDateTime(
        intake.entry_date,
        intake.entry_time
    );
    const exitSource =
        approval.finalized_at ||
        approval.signed_at ||
        report.updated_at ||
        createdAt;
    const vehicleNames = utils.splitYearModel(
        asset.year_model,
        approval.report_title || asset.description
    );

    return {
        company: {
            name: String(company.company || company.name || "Empresa").trim(),
            slogan: String(
                company.tagline ||
                company.slogan ||
                ""
            ).trim()
        },
        meta: {
            reportNumber: resolvePublicId(report),
            documentLabel: "DOCUMENTO TÉCNICO",
            date: utils.formatReportDate(createdAt),
            time: utils.formatReportTime(createdAt)
        },
        customer: {
            name: String(
                (report.customer && report.customer.name) ||
                "Cliente não informado"
            ).trim()
        },
        inspector: {
            name: resolveResponsible(intake, company, report) || "Responsável não informado"
        },
        vehicle: {
            make: vehicleNames.make,
            model: vehicleNames.model,
            plate: String(asset.plate || "—").trim(),
            yearModel: String(asset.year_model || "—").trim(),
            color: String(asset.color || "—").trim(),
            mileageKm: Number(asset.mileage || asset.km || 0) || 0,
            fuel: String(
                asset.fuel ||
                intake.fuel_level ||
                "—"
            ).trim()
        },
        entry,
        exit: {
            date: utils.formatReportDate(exitSource),
            time: utils.formatReportTime(exitSource)
        },
        coverPhoto: resolveCoverPhoto(report),
        photos: buildGuidedPhotos(report.occurrences),
        occurrences: buildOccurrences(report.occurrences),
        checklist: buildChecklist(intake),
        diagnosis: {
            summary: String(
                diagnostic.summary ||
                diagnostic.conclusion ||
                "Nenhum resumo registrado."
            ).trim(),
            recommendation: String(
                diagnostic.recommendation ||
                "Nenhuma recomendação registrada."
            ).trim()
        },
        finalization: {
            status: String(
                approval.status ||
                report.status ||
                "CONCLUÍDO"
            ).trim().toUpperCase(),
            note: String(
                approval.notes ||
                approval.final_notes ||
                approval.observation ||
                "Nenhuma observação adicional registrada."
            ).trim(),
            signedAt: {
                date: utils.formatReportDate(exitSource),
                time: utils.formatReportTime(exitSource)
            },
            signatureData: String(approval.signature_data || "").trim(),
            collectSignature: approval.collect_signature !== false &&
                Boolean(approval.signature_data)
        }
    };
}

global.AuroraPremiumVehicleAdapter = {
    fromReport,
    GUIDED_SLOTS,
    CHECKLIST_FIELDS,
    isGuidedVehiclePhoto
};
})(typeof window !== "undefined" ? window : globalThis);

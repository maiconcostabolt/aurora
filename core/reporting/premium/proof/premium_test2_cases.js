(function (global) {
"use strict";

const cloud = global.AURORA_CLOUD_EDIT_7_PHOTOS_MOCKS;
const base = global.AURORA_GLOBAL_REPORT_MOCKS;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function buildSignatureDataUrl(label) {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 220;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        return "";
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0b1524";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 130);
    ctx.bezierCurveTo(120, 40, 220, 180, 320, 90);
    ctx.bezierCurveTo(420, 30, 520, 160, 620, 80);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText(label || "Assinatura cliente", 40, 188);
    return canvas.toDataURL("image/png");
}

function svgPhoto(label, width, height, hue) {
    if (base && typeof base.svgPhoto === "function") {
        return {
            src: base.svgPhoto(label, hue || 200, width, height),
            width,
            height,
            alt: label
        };
    }

    return {
        src:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="hsl(${hue || 200},30%,35%)"/><text x="50%" y="50%" text-anchor="middle" fill="#fff" font-family="Arial" font-size="24">${label}</text></svg>`
            ),
        width,
        height,
        alt: label
    };
}

function applyVehicleCaseDefaults(caseData, options) {
    const next = clone(caseData);
    const opts = options || {};

    next.template = opts.template || "premium";
    next.service = Object.assign({}, next.service || {}, {
        id: "vehicle_inspection",
        title: "Vistoria Veicular"
    });
    next.performed_by_name = opts.inspector || "João Luiz";
    next.created_at = opts.createdAt || "2026-08-17T21:26:00-03:00";
    next.customer = Object.assign({}, next.customer || {}, {
        name: opts.customer || "Maike Costa"
    });
    next.asset = Object.assign({}, next.asset || {}, {
        plate: "HSB877",
        year_model: "2022",
        color: "Vermelho",
        mileage: 32596,
        fuel: "Flex"
    });
    next.intake = Object.assign({}, next.intake || {}, {
        responsible: next.performed_by_name,
        entry_date: "2026-08-17",
        entry_time: "21:26",
        internal_external: "OK",
        windshield: "OK",
        levels: "OK",
        brakes: "OK",
        tires: "Atenção",
        suspension_steering: "OK",
        battery: "OK",
        safety_items: "OK"
    });
    next.approval = Object.assign({}, next.approval || {}, {
        report_title: "Honda Civic",
        status: "Concluído",
        notes: opts.finalNote ||
            "Nenhuma observação adicional registrada pelo responsável técnico.",
        collect_signature: opts.collectSignature !== false,
        signature_data: opts.signatureData ||
            (opts.collectSignature === false ? "" : buildSignatureDataUrl("Assinatura cliente"))
    });
    next.diagnostic = Object.assign({}, next.diagnostic || {}, {
        summary: opts.diagnosticSummary ||
            "O veículo foi recebido para vistoria técnica completa. Durante a inspeção foram identificadas ocorrências que exigem atenção.",
        recommendation: opts.diagnosticRecommendation ||
            "Recomenda-se acompanhar as ocorrências registradas e manter a rotina preventiva indicada pelo fabricante."
    });

    if (opts.coverPhoto === null) {
        delete next.coverPhoto;
        delete next.cover_photo;
    } else if (opts.coverPhoto) {
        next.coverPhoto = opts.coverPhoto;
    }

    if (typeof opts.occurrenceCount === "number") {
        const guided = (next.evidence_groups || []).filter(
            (group) => group.record_kind === "vehicle_guided_photo"
        );
        let issues = (next.evidence_groups || []).filter(
            (group) => group.record_kind !== "vehicle_guided_photo"
        );

        while (issues.length < opts.occurrenceCount) {
            const index = issues.length + 1;
            const photo = svgPhoto("Avaria " + index, 20 + index * 15, 960);
            issues = issues.concat([{
                id: "issue-extra-" + index,
                case_id: next.id,
                title: "Avaria adicional " + index,
                item: "Avaria",
                severity: index % 2 === 0 ? "Alta" : "Média",
                description: "Avaria adicional " + index + " para teste de paginação.",
                recommendation: "Reparar item " + index + ".",
                saved_at: new Date().toISOString(),
                photos: [{
                    id: "photo-issue-" + index,
                    title: "Avaria " + index,
                    src: photo.src,
                    width: photo.width,
                    height: photo.height
                }]
            }]);
        }

        next.evidence_groups = guided.concat(
            issues.slice(0, Math.max(0, opts.occurrenceCount))
        );
    }

    if (opts.longText) {
        const longText =
            "Constatação extensa para validar quebra de linha e paginação dinâmica sem sobreposição de conteúdo no relatório premium. ".repeat(8);
        next.evidence_groups = (next.evidence_groups || []).map((group, index) => {
            if (group.record_kind === "vehicle_guided_photo") {
                return group;
            }

            return Object.assign({}, group, {
                description: longText,
                recommendation: longText.slice(0, 420)
            });
        });
        next.diagnostic.summary = longText;
        next.diagnostic.recommendation = longText.slice(0, 420);
    }

    return next;
}

function buildBaseVehicleCase(options) {
    const built = cloud.buildCloudEditSevenPhotosCase();
    return {
        caseData: applyVehicleCaseDefaults(built.caseData, options),
        identity: {
            company: "GABIVEL",
            tagline: "Seu ponto de partida",
            professional: "João Luiz"
        }
    };
}

function buildScenario(name, options) {
    const built = buildBaseVehicleCase(options || {});
    built.scenario = name;
    return built;
}

global.AURORA_PREMIUM_TEST2_CASES = {
    buildSignatureDataUrl,
    buildScenario,
    buildBaseVehicleCase,
    scenarios: {
        main: () => buildScenario("main", { template: "premium", occurrenceCount: 2 }),
        zeroOccurrences: () => buildScenario("zero_occurrences", {
            template: "premium",
            occurrenceCount: 0
        }),
        oneOccurrence: () => buildScenario("one_occurrence", {
            template: "premium",
            occurrenceCount: 1
        }),
        fiveOccurrences: () => buildScenario("five_occurrences", {
            template: "premium",
            occurrenceCount: 5
        }),
        longText: () => buildScenario("long_text", {
            template: "premium",
            occurrenceCount: 2,
            longText: true
        }),
        noCover: () => buildScenario("no_cover", {
            template: "premium",
            occurrenceCount: 2,
            coverPhoto: null
        }),
        noSignature: () => buildScenario("no_signature", {
            template: "premium",
            occurrenceCount: 2,
            collectSignature: false,
            signatureData: ""
        }),
        legacyControl: () => buildScenario("legacy_control", {
            template: "legacy",
            occurrenceCount: 2
        }),
        portraitLandscape: () => {
            const built = buildScenario("portrait_landscape", {
                template: "premium",
                occurrenceCount: 2
            });
            const portrait = svgPhoto("Portrait", 900, 1600, 280);
            const landscape = svgPhoto("Landscape", 1800, 900, 190);
            built.caseData.coverPhoto = {
                src: portrait.src,
                width: portrait.width,
                height: portrait.height,
                alt: "Capa portrait"
            };
            built.caseData.evidence_groups = (built.caseData.evidence_groups || []).map(
                (group) => {
                    if (group.vehicle_photo_slot === "front") {
                        return Object.assign({}, group, {
                            photos: [{
                                id: "photo-front-portrait",
                                title: "Frente portrait",
                                src: portrait.src,
                                width: portrait.width,
                                height: portrait.height
                            }]
                        });
                    }

                    if (group.vehicle_photo_slot === "rear") {
                        return Object.assign({}, group, {
                            photos: [{
                                id: "photo-rear-landscape",
                                title: "Traseira landscape",
                                src: landscape.src,
                                width: landscape.width,
                                height: landscape.height
                            }]
                        });
                    }

                    return group;
                }
            );
            return built;
        }
    }
};
})(typeof window !== "undefined" ? window : globalThis);

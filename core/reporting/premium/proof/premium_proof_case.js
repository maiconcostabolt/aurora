(function (global) {
"use strict";

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
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(48, 132);
    ctx.bezierCurveTo(96, 48, 144, 168, 192, 92);
    ctx.bezierCurveTo(240, 36, 288, 156, 336, 88);
    ctx.bezierCurveTo(384, 40, 432, 148, 480, 96);
    ctx.bezierCurveTo(528, 56, 576, 132, 624, 88);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(label || "Assinatura de teste", 48, 188);

    return canvas.toDataURL("image/png");
}

function enrichReportForPremiumProof(report) {
    const next = JSON.parse(JSON.stringify(report));
    next.approval = Object.assign({}, next.approval || {}, {
        collect_signature: true,
        signature_data: buildSignatureDataUrl("Assinatura cliente — prova Premium"),
        status: next.approval.status || "Concluído",
        notes:
            next.approval.notes ||
            "Nenhuma observação adicional registrada pelo responsável técnico."
    });

    if (!next.diagnostic || !next.diagnostic.summary) {
        next.diagnostic = Object.assign({}, next.diagnostic || {}, {
            summary:
                "O veículo foi recebido para vistoria técnica completa. Durante a inspeção foram identificadas ocorrências que exigem atenção. Os demais sistemas avaliados no checklist seguem dentro dos padrões esperados.",
            recommendation:
                "Recomenda-se acompanhar as ocorrências registradas e manter a rotina preventiva indicada pelo fabricante."
        });
    }

    return next;
}

function buildPremiumProofCase() {
    if (!global.AURORA_REPORT_REFINEMENT_MOCKS) {
        throw new Error("AURORA_REPORT_REFINEMENT_MOCKS is not loaded.");
    }

    const built = global.AURORA_REPORT_REFINEMENT_MOCKS.buildRefinementCase();
    const engine = new ReportEngine({
        companyProvider: () => built.identity,
        storageKey: "aurora_premium_report_proof"
    });

    const report = engine.createFromCase(built.caseData, {
        id: built.caseData.id,
        publicId: "AUR-2026-0016",
        createdAt: built.caseData.created_at
    });

    return {
        built,
        engine,
        report: enrichReportForPremiumProof(report)
    };
}

function auditRenderedImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    const audits = images.map((img) => {
        const style = window.getComputedStyle(img);
        const objectFit = style.objectFit || "";
        const naturalWidth = img.naturalWidth || Number(img.getAttribute("width")) || 0;
        const naturalHeight = img.naturalHeight || Number(img.getAttribute("height")) || 0;
        const clientWidth = img.clientWidth || 0;
        const clientHeight = img.clientHeight || 0;

        return {
            alt: img.alt || "",
            srcPrefix: String(img.currentSrc || img.src || "").slice(0, 48),
            objectFit,
            noCropRule: objectFit === "contain",
            naturalWidth,
            naturalHeight,
            clientWidth,
            clientHeight
        };
    });

    return {
        imageCount: audits.length,
        allContain: audits.every((item) => item.noCropRule),
        images: audits
    };
}

global.AURORA_PREMIUM_PROOF = {
    buildSignatureDataUrl,
    enrichReportForPremiumProof,
    buildPremiumProofCase,
    auditRenderedImages
};
})(typeof window !== "undefined" ? window : globalThis);

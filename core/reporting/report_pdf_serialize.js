(function (global) {
"use strict";

function getCssUrls(options) {
    if (options && Array.isArray(options.cssUrls)) {
        return options.cssUrls;
    }

    const localCfg = global.AURORA_PDF_LOCAL_TEST || {};
    const expCfg = global.AURORA_PDF_EXPERIMENTAL || {};

    if (Array.isArray(localCfg.cssUrls) && localCfg.cssUrls.length) {
        return localCfg.cssUrls;
    }

    if (Array.isArray(expCfg.cssUrls) && expCfg.cssUrls.length) {
        return expCfg.cssUrls;
    }

    return ["./css/rc8_10_report_premium.css?v=AURORA-GROUNDING-V14"];
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function waitImageComplete(image) {
    if (!image || image.complete) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
    });
}

function describeImage(image, index) {
    const alt = image && image.alt ? String(image.alt).trim() : "";
    const dataId =
        image && image.getAttribute
            ? image.getAttribute("data-photo-id") || image.getAttribute("data-evidence-id")
            : "";

    if (alt) {
        return alt;
    }

    if (dataId) {
        return dataId;
    }

    return `img#${index}`;
}

function srcPrefix(src) {
    if (!src || typeof src !== "string") {
        return "(vazio)";
    }

    if (src.startsWith("data:")) {
        return "data:…";
    }

    if (src.startsWith("blob:")) {
        return "blob:…";
    }

    if (src.length <= 48) {
        return src;
    }

    return `${src.slice(0, 45)}…`;
}

async function imageToDataUrl(image, index) {
    await waitImageComplete(image);

    const src = image.currentSrc || image.src || "";
    const label = describeImage(image, index);

    if (!src) {
        return {
            dataUrl: "",
            warning: "src vazio",
            label
        };
    }

    if (src.startsWith("data:")) {
        return {
            dataUrl: src,
            label,
            bytes: src.length
        };
    }

    try {
        const response = await fetch(src);

        if (!response.ok) {
            throw new Error(`fetch HTTP ${response.status}`);
        }

        const dataUrl = await blobToDataUrl(await response.blob());

        return {
            dataUrl,
            label,
            bytes: dataUrl.length
        };
    } catch (fetchError) {
        if (!image.naturalWidth || !image.naturalHeight) {
            return {
                dataUrl: src,
                warning: `não convertida (${fetchError.message})`,
                label,
                srcPrefix: srcPrefix(src)
            };
        }

        try {
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

            return {
                dataUrl,
                label,
                bytes: dataUrl.length
            };
        } catch (canvasError) {
            return {
                dataUrl: src,
                warning: `canvas falhou (${canvasError.message})`,
                label,
                srcPrefix: srcPrefix(src)
            };
        }
    }
}

async function inlineImagesForPdf(root) {
    const images = Array.from(root.querySelectorAll("img"));
    const failures = [];
    let inlinedBytes = 0;
    let largestBytes = 0;
    let largestLabel = "";

    for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        const result = await imageToDataUrl(image, index);

        if (result.dataUrl && result.dataUrl.startsWith("data:")) {
            image.setAttribute("src", result.dataUrl);
            image.removeAttribute("srcset");

            const bytes = result.bytes || result.dataUrl.length;
            inlinedBytes += bytes;

            if (bytes > largestBytes) {
                largestBytes = bytes;
                largestLabel = result.label;
            }
        } else if (result.warning) {
            failures.push({
                label: result.label,
                reason: result.warning,
                srcPrefix: result.srcPrefix || srcPrefix(image.src || "")
            });
            console.warn(
                "=== AURORA PDF SERIALIZE === imagem não convertida:",
                result.label,
                result.warning
            );
        }
    }

    return {
        imageCount: images.length,
        inlinedBytes,
        largestBytes,
        largestLabel,
        failures
    };
}

async function loadPrintStylesheets(cssUrls) {
    const chunks = [];

    for (const url of cssUrls) {
        const resolvedUrl = new URL(url, document.baseURI).href;
        const response = await fetch(resolvedUrl, { cache: "force-cache" });

        if (!response.ok) {
            throw new Error(`CSS indisponível: ${resolvedUrl} (${response.status})`);
        }

        chunks.push(`/* ${resolvedUrl} */\n${await response.text()}`);
    }

    return chunks.join("\n\n");
}

function pdfExportAuxiliaryCss() {
    return [
        "html,body{margin:0!important;padding:0!important;background:#fff!important;overflow:hidden!important;color-scheme:light}",
        ".aurora-print-stage--pdf-export{",
        "position:static!important;",
        "left:auto!important;",
        "top:auto!important;",
        "width:210mm!important;",
        "visibility:visible!important;",
        "pointer-events:none!important;",
        "}",
        ".aurora-print-stage--pdf-export .aurora-print-page{",
        "box-sizing:border-box!important;",
        "display:none!important;",
        "margin:0!important;",
        "-webkit-print-color-adjust:exact!important;",
        "print-color-adjust:exact!important;",
        "}",
        ".aurora-print-stage--pdf-export .aurora-print-page.aurora-pdf-page-active{",
        "display:grid!important;",
        "}",
        ".aurora-print-stage--pdf-export .aurora-print-page__cover .aurora-report-cover{",
        "color:#fff!important;",
        "background:radial-gradient(circle at 86% 18%,rgba(100,240,229,.20),transparent 31%),linear-gradient(142deg,#091827,#12324b 68%,#17465a)!important;",
        "-webkit-print-color-adjust:exact!important;",
        "print-color-adjust:exact!important;",
        "}",
        ".aurora-print-stage--pdf-export .aurora-print-page__cover .aurora-report-brand strong,",
        ".aurora-print-stage--pdf-export .aurora-print-page__cover .aurora-report-cover h1{",
        "color:#fff!important;",
        "-webkit-text-fill-color:#fff!important;",
        "}",
        ".aurora-print-stage--pdf-export .aurora-print-page__cover .aurora-report-cover__kicker{",
        "color:#64f0e5!important;",
        "-webkit-text-fill-color:#64f0e5!important;",
        "}",
        ".aurora-print-stage--pdf-export .aurora-print-page__cover .aurora-report-brand small{",
        "color:#bad0dd!important;",
        "-webkit-text-fill-color:#bad0dd!important;",
        "}",
        ".aurora-print-stage--pdf-export .aurora-print-page__cover .aurora-report-cover p{",
        "color:#d3e0e8!important;",
        "-webkit-text-fill-color:#d3e0e8!important;",
        "}",
        ".aurora-print-stage--pdf-export .aurora-print-page__cover .aurora-report-cover__meta span:first-child{",
        "color:#64f0e5!important;",
        "-webkit-text-fill-color:#64f0e5!important;",
        "}",
        ".aurora-print-stage--pdf-export .aurora-print-page__cover .aurora-report-cover__meta span:last-child{",
        "color:#c4d6e1!important;",
        "-webkit-text-fill-color:#c4d6e1!important;",
        "}"
    ].join("");
}

function buildSelfContainedHtml(stageMarkup, cssText, reportLabel) {
    const title = String(reportLabel || "AURORA").replace(/[<>]/g, "");

    return [
        "<!DOCTYPE html>",
        '<html lang="pt-BR">',
        "<head>",
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=794, initial-scale=1, maximum-scale=1, user-scalable=no">',
        `<title>${title}</title>`,
        "<style>",
        pdfExportAuxiliaryCss(),
        cssText,
        "</style>",
        "</head>",
        "<body>",
        stageMarkup,
        "</body>",
        "</html>"
    ].join("");
}

function resolveReportLabel(report, options) {
    if (options && options.reportLabel) {
        return String(options.reportLabel);
    }

    if (report && report.public_id) {
        return String(report.public_id);
    }

    return "AURORA";
}

async function serializePrintStageForPdf(stage, report, options) {
    if (!stage) {
        throw new Error("Print-stage ausente para serialização.");
    }

    const serializeStarted = performance.now();
    const cssUrls = getCssUrls(options || {});
    const cssText = await loadPrintStylesheets(cssUrls);
    const reportLabel = resolveReportLabel(report, options || {});

    const exportRoot = stage.cloneNode(true);
    exportRoot.classList.add("aurora-print-stage--pdf-export");
    exportRoot.removeAttribute("data-report-print-stage");

    const imageStats = await inlineImagesForPdf(exportRoot);
    const pageCount = exportRoot.querySelectorAll(".aurora-print-page").length;
    const stageMarkup = exportRoot.outerHTML;
    const html = buildSelfContainedHtml(stageMarkup, cssText, reportLabel);
    const htmlBytes = new TextEncoder().encode(html).length;

    return {
        html,
        stats: {
            reportId: reportLabel,
            pageCount,
            imageCount: imageStats.imageCount,
            htmlBytes,
            cssBytes: new TextEncoder().encode(cssText).length,
            imageInlineBytes: imageStats.inlinedBytes,
            largestImageBytes: imageStats.largestBytes,
            largestImageLabel: imageStats.largestLabel,
            imageFailures: imageStats.failures,
            serializeMs: Math.round(performance.now() - serializeStarted)
        }
    };
}

global.AuroraPdfSerialize = {
    serializePrintStageForPdf,
    inlineImagesForPdf,
    buildSelfContainedHtml
};

})(window);

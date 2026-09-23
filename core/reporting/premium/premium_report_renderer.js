(function (global) {
"use strict";

const OCCURRENCES_PER_PAGE = 2;

function chunkArray(items, size) {
    if (
        global.AuroraPremiumUtils &&
        typeof global.AuroraPremiumUtils.chunkArray === "function"
    ) {
        return global.AuroraPremiumUtils.chunkArray(items, size);
    }

    const output = [];
    const list = Array.isArray(items) ? items : [];

    for (let index = 0; index < list.length; index += size) {
        output.push(list.slice(index, index + size));
    }

    return output;
}

function buildPagePlan(data) {
    const occurrences = data.occurrences || [];
    const chunks = chunkArray(occurrences, OCCURRENCES_PER_PAGE);

    if (!chunks.length) {
        chunks.push([]);
    }

    const plan = [
        { type: "cover" },
        { type: "identification" }
    ];

    chunks.forEach((chunk, index) => {
        plan.push({
            type: "occurrences",
            chunk,
            startIndex: index * OCCURRENCES_PER_PAGE,
            showChecklist: index === chunks.length - 1
        });
    });

    plan.push({ type: "diagnosis" });
    return plan;
}

function renderPages(data) {
    const plan = buildPagePlan(data);
    const totalPages = plan.length;
    const pages = [];

    plan.forEach((entry, index) => {
        const pageNumber = index + 1;

        if (entry.type === "cover") {
            pages.push(
                global.AuroraPremiumCoverPage.renderCoverPage(
                    data,
                    pageNumber,
                    totalPages
                )
            );
            return;
        }

        if (entry.type === "identification") {
            pages.push(
                global.AuroraPremiumIdentificationPage.renderIdentificationPage(
                    data,
                    pageNumber,
                    totalPages
                )
            );
            return;
        }

        if (entry.type === "occurrences") {
            pages.push(
                global.AuroraPremiumOccurrencesPage.renderOccurrencesPage(
                    data,
                    {
                        pageNumber,
                        totalPages,
                        chunk: entry.chunk,
                        startIndex: entry.startIndex,
                        showChecklist: entry.showChecklist
                    }
                )
            );
            return;
        }

        if (entry.type === "diagnosis") {
            pages.push(
                global.AuroraPremiumDiagnosisPage.renderDiagnosisPage(
                    data,
                    pageNumber,
                    totalPages
                )
            );
        }
    });

    return {
        html: pages.join("\n"),
        pageCount: totalPages,
        plan
    };
}

function cssHref(options) {
    if (options && options.cssHref) {
        return String(options.cssHref);
    }

    return "../styles/premium_report.css";
}

function renderStandaloneDocument(report, options) {
    const adapter = global.AuroraPremiumVehicleAdapter;
    if (!adapter || typeof adapter.fromReport !== "function") {
        throw new Error("AuroraPremiumVehicleAdapter is not loaded.");
    }

    const data = adapter.fromReport(report, options || {});
    const rendered = renderPages(data);
    const title = [
        data.company.name,
        data.meta.reportNumber,
        "Vistoria Veicular Premium"
    ].filter(Boolean).join(" · ");
    const cssMarkup =
        options && options.inlineCss
            ? `<style>${String(options.inlineCss)}</style>`
            : `<link rel="stylesheet" href="${cssHref(options)}">`;
    const exportOnly = Boolean(options && options.inlineCss);
    const bodyMarkup = exportOnly
        ? `<div class="prm-print-root prm-print-root--export">${rendered.html}</div>`
        : [
            '<div class="prm-shell print-hidden" data-premium-scaler>',
            `<div class="a4-scaler" data-premium-pages>${rendered.html}</div>`,
            "</div>",
            '<div class="prm-print-root" data-premium-print>',
            rendered.html,
            "</div>",
            "<script>",
            "(function(){",
            "function fit(){",
            "var scaler=document.querySelector('[data-premium-scaler] .a4-scaler');",
            "if(!scaler||window.matchMedia('print').matches){return;}",
            "var page=scaler.querySelector('.a4-page');",
            "if(!page){return;}",
            "var width=page.offsetWidth||794;",
            "var available=Math.max(320,window.innerWidth-32);",
            "var scale=Math.min(1,available/width);",
            "scaler.style.transform='scale('+scale+')';",
            "scaler.style.transformOrigin='top center';",
            "scaler.parentElement.style.height=(page.offsetHeight*scale)+'px';",
            "}",
            "window.addEventListener('resize',fit);",
            "window.addEventListener('load',fit);",
            "})();",
            "</script>"
        ].join("\n");

    return [
        "<!DOCTYPE html>",
        '<html lang="pt-BR">',
        "<head>",
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `<title>${title}</title>`,
        cssMarkup,
        "</head>",
        `<body class="prm-body${exportOnly ? " prm-body--export" : ""}">`,
        bodyMarkup,
        "</body>",
        "</html>"
    ].join("\n");
}

function renderDocumentFragment(report, options) {
    const adapter = global.AuroraPremiumVehicleAdapter;
    const data = adapter.fromReport(report, options || {});
    return renderPages(data);
}

class PremiumReportRenderer {
    constructor(options) {
        this.options = options || {};
    }

    fromReport(report) {
        return global.AuroraPremiumVehicleAdapter.fromReport(
            report,
            this.options
        );
    }

    renderPages(data) {
        return renderPages(data);
    }

    renderStandaloneDocument(report) {
        return renderStandaloneDocument(report, this.options);
    }

    renderDocumentFragment(report) {
        return renderDocumentFragment(report, this.options);
    }
}

global.PremiumReportRenderer = PremiumReportRenderer;
global.AuroraPremiumReportRenderer = {
    OCCURRENCES_PER_PAGE,
    buildPagePlan,
    renderPages,
    renderStandaloneDocument,
    renderDocumentFragment
};
})(typeof window !== "undefined" ? window : globalThis);

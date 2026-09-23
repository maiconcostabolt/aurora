(function (global) {
"use strict";

/*
 * Writer PDF da Aurora a partir do layout Blink.
 *
 * HTML / _buildPrintStage é a autoridade visual.
 * Este módulo NÃO pagina, NÃO interpreta flags editoriais e NÃO redesenha cards.
 * Cada .aurora-print-page vira exatamente uma página PDF.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const FONT_REGULAR_NAME = "Arial.ttf";
const FONT_BOLD_NAME = "Arial-Bold.ttf";

function fontAssetUrl(fileName) {
    const base = String(global.AURORA_PDF_FONT_BASE || "./").replace(/\/?$/, "/");
    return base + "fonts/" + fileName;
}

const WRITER_CONTRACT = {
    hasOwnPager: false,
    hasEnsureSpace: false,
    hasKeepTogether: false,
    decidesShowSeverity: false,
    decidesShowRecordLabels: false,
    rasterizesFullPage: false,
    usesHtml2Canvas: false,
    usesPagedJs: false,
    textIsVector: true,
    imagesAreEmbedded: true
};

let fontBytesPromise = null;

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

function parseCssColor(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text || text === "transparent" || text === "none") {
        return null;
    }
    const rgba = text.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/);
    if (rgba) {
        const alpha = rgba[4] == null ? 1 : Number(rgba[4]);
        if (alpha <= 0.02) {
            return null;
        }
        return {
            r: Number(rgba[1]) / 255,
            g: Number(rgba[2]) / 255,
            b: Number(rgba[3]) / 255,
            a: alpha
        };
    }
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hex) {
        let raw = hex[1];
        if (raw.length === 3) {
            raw = raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2];
        }
        const n = parseInt(raw, 16);
        return {
            r: ((n >> 16) & 255) / 255,
            g: ((n >> 8) & 255) / 255,
            b: (n & 255) / 255,
            a: 1
        };
    }
    return null;
}

function parsePx(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

function ownerDoc(node) {
    return (node && node.ownerDocument) || document;
}

function ownerWin(node) {
    return ownerDoc(node).defaultView || window;
}

function cssOf(el, pseudo) {
    if (!el) {
        return null;
    }
    return ownerWin(el).getComputedStyle(el, pseudo);
}

function rangeOf(node) {
    return ownerDoc(node).createRange();
}

function waitAnimationFrames(node) {
    const win = ownerWin(node);
    return new Promise((resolve) => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
}

function getMeasureHost() {
    const frame = document.getElementById("aurora-pdf-measure-frame");
    const frameDoc = frame && frame.contentDocument;
    if (frameDoc && frameDoc.body) {
        let host = frameDoc.getElementById("aurora-pdf-measure-host");
        if (!host) {
            host = frameDoc.createElement("div");
            host.id = "aurora-pdf-measure-host";
            host.setAttribute("data-aurora-pdf-measure-host", "");
            frameDoc.body.appendChild(host);
        }
        return host;
    }
    let host = document.getElementById("aurora-pdf-measure-host");
    if (!host) {
        host = document.createElement("div");
        host.id = "aurora-pdf-measure-host";
        host.setAttribute("data-aurora-pdf-measure-host", "");
        document.body.appendChild(host);
    }
    return host;
}

function isHidden(style) {
    return style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0;
}

function applyTextTransform(text, transform) {
    const mode = String(transform || "none").toLowerCase();
    if (mode === "uppercase") {
        return text.toLocaleUpperCase("pt-BR");
    }
    if (mode === "lowercase") {
        return text.toLocaleLowerCase("pt-BR");
    }
    if (mode === "capitalize") {
        return text.replace(/\S+/g, (word) =>
            word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1)
        );
    }
    return text;
}

function isolateGradient(text, kind) {
    const needle = String(kind) + "(";
    const lower = String(text || "").toLowerCase();
    const start = lower.indexOf(needle);
    if (start < 0) {
        return "";
    }
    let depth = 0;
    for (let index = start; index < text.length; index += 1) {
        if (text[index] === "(") {
            depth += 1;
        } else if (text[index] === ")") {
            depth -= 1;
            if (depth === 0) {
                return text.slice(start, index + 1);
            }
        }
    }
    return "";
}

function extractGradientColors(backgroundImage) {
    const text = String(backgroundImage || "");
    if (!text || text === "none") {
        return [];
    }
    const colors = [];
    const re = /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)|#([0-9a-f]{3,8})/gi;
    let match;
    while ((match = re.exec(text))) {
        const color = match[5]
            ? parseCssColor("#" + match[5].slice(0, 6))
            : parseCssColor(`rgba(${match[1]},${match[2]},${match[3]},${match[4] == null ? 1 : match[4]})`);
        if (color) {
            colors.push(color);
        }
    }
    return colors;
}

function parseLinearGradient(backgroundImage) {
    const spec = isolateGradient(backgroundImage, "linear-gradient");
    if (!spec) {
        return null;
    }
    const angleMatch = spec.match(/linear-gradient\(\s*([+-]?[\d.]+)deg/i);
    return {
        angle: angleMatch ? Number(angleMatch[1]) : 180,
        colors: extractGradientColors(spec)
    };
}

function lerpColor(a, b, t) {
    return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t
    };
}

function snapshotComputed(el) {
    if (!el) {
        return null;
    }
    const style = cssOf(el);
    const rect = el.getBoundingClientRect();
    return {
        isConnected: el.isConnected,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        overflow: style.overflow,
        left: style.left,
        top: style.top,
        contentVisibility: style.contentVisibility || "",
        transform: style.transform,
        width: rect.width,
        height: rect.height,
        x: rect.left,
        y: rect.top
    };
}

function snapshotPageDom(pageEl) {
    const box = snapshotComputed(pageEl) || {};
    let textNodesFound = 0;
    const walker = ownerDoc(pageEl).createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
        if (String(node.nodeValue || "").replace(/\s+/g, "")) {
            textNodesFound += 1;
        }
        node = walker.nextNode();
    }
    return Object.assign(box, {
        innerTextLength: String(pageEl.innerText || "").length,
        innerTextSample: String(pageEl.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
        elementCount: pageEl.querySelectorAll("*").length,
        imageCount: pageEl.querySelectorAll("img").length,
        coverCount: pageEl.querySelectorAll(".aurora-report-cover").length,
        sectionCount: pageEl.querySelectorAll(".aurora-report-section").length,
        textNodesFound,
        isHiddenByWriter: isHidden(cssOf(pageEl))
    });
}

function probeFirstVisibleText(pageEl) {
    const walker = ownerDoc(pageEl).createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
        const raw = String(node.nodeValue || "").replace(/\s+/g, " ").trim();
        if (raw.length >= 3) {
            const parent = node.parentElement;
            const range = rangeOf(node);
            range.selectNodeContents(node);
            const box = range.getBoundingClientRect();
            const style = parent ? cssOf(parent) : null;
            return {
                text: raw.slice(0, 80),
                width: box.width,
                height: box.height,
                x: box.left,
                y: box.top,
                fontFamily: style ? style.fontFamily : "",
                fontSize: style ? style.fontSize : "",
                fontWeight: style ? style.fontWeight : "",
                color: style ? style.color : "",
                parentHidden: style ? isHidden(style) : true
            };
        }
        node = walker.nextNode();
    }
    return null;
}

function probeFirstImage(pageEl) {
    const img = pageEl.querySelector("img");
    if (!img) {
        return null;
    }
    const rect = img.getBoundingClientRect();
    return {
        srcExists: Boolean(img.getAttribute("src") || img.src),
        srcKind: String(img.src || "").slice(0, 48),
        naturalWidth: img.naturalWidth || 0,
        naturalHeight: img.naturalHeight || 0,
        complete: img.complete,
        width: rect.width,
        height: rect.height,
        x: rect.left,
        y: rect.top
    };
}

function captureStageDiagnostic(stage, label) {
    const pages = Array.from(stage.querySelectorAll(".aurora-print-page"));
    const firstPage = pages[0] || null;
    return {
        label,
        pagesFound: pages.length,
        pageCountSource: "stage.querySelectorAll('.aurora-print-page').length",
        stageParentId: stage.parentElement && stage.parentElement.id || "",
        stageParentClass: stage.parentElement && stage.parentElement.className || "",
        stage: snapshotComputed(stage),
        firstPage: firstPage ? snapshotPageDom(firstPage) : null,
        firstText: firstPage ? probeFirstVisibleText(firstPage) : null,
        firstImage: firstPage ? probeFirstImage(firstPage) : null,
        pages: pages.map(snapshotPageDom)
    };
}

function attachStageForMeasurement(stage) {
    const host = getMeasureHost();
    if (stage.parentNode !== host) {
        host.appendChild(stage);
    }
    void stage.offsetHeight;
    return host;
}

function publishLayoutDiagnostic(diag) {
    global.__AURORA_PDF_LAYOUT_LAST_DIAGNOSTIC__ = diag;
    const lines = [
        "AURORA PDF LAYOUT DIAGNOSTIC",
        "pages=" + diag.pagesFound,
        "pageCountSource=" + diag.pageCountSource,
        "stageConnected=" + (diag.after && diag.after.stage && diag.after.stage.isConnected),
        "stageParent=" + (diag.after && diag.after.stageParentId),
        "stageWH=" + ((diag.after && diag.after.stage && diag.after.stage.width) || 0) + "x" + ((diag.after && diag.after.stage && diag.after.stage.height) || 0),
        "page1WH=" + ((diag.after && diag.after.firstPage && diag.after.firstPage.width) || 0) + "x" + ((diag.after && diag.after.firstPage && diag.after.firstPage.height) || 0),
        "page1InnerText=" + ((diag.after && diag.after.firstPage && diag.after.firstPage.innerTextLength) || 0),
        "elements=" + diag.elementsVisited,
        "textNodes=" + diag.textNodesFound,
        "textRuns=" + diag.textRunsDrawn,
        "rectangles=" + diag.rectanglesDrawn,
        "imagesFound=" + diag.imagesFound,
        "imagesDrawn=" + diag.imagesDrawn,
        "clipsApplied=" + diag.clipsApplied,
        "clipsSkipped=" + diag.clipsSkipped,
        "minX=" + diag.minX,
        "maxX=" + diag.maxX,
        "minY=" + diag.minY,
        "maxY=" + diag.maxY,
        "beforeHidden=" + (diag.before && diag.before.firstPage && diag.before.firstPage.isHiddenByWriter),
        "afterHidden=" + (diag.after && diag.after.firstPage && diag.after.firstPage.isHiddenByWriter),
        "fontFamily=" + diag.fontFamily,
        "fontError=" + (diag.fontError || "")
    ];
    const text = lines.join("\n");
    if (typeof console !== "undefined" && console.log) {
        console.log(text, diag);
    }
    return text;
}

function createPageMapper(pageRect) {
    const scale = pageRect.width > 0 ? PAGE_WIDTH / pageRect.width : 1;
    return {
        scale,
        pageRect,
        toBox(rect) {
            const width = rect.width * scale;
            const height = rect.height * scale;
            const x = (rect.left - pageRect.left) * scale;
            const yTop = (rect.top - pageRect.top) * scale;
            return {
                x,
                y: PAGE_HEIGHT - yTop - height,
                width,
                height
            };
        }
    };
}

function containedImageRect(img) {
    const frame = img.getBoundingClientRect();
    const fit = String(cssOf(img).objectFit || "fill").toLowerCase();
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 0;
    if (!(nw > 0 && nh > 0) || !(frame.width > 0 && frame.height > 0)) {
        return { rect: frame, fit };
    }
    if (fit === "contain") {
        const ratio = Math.min(frame.width / nw, frame.height / nh);
        const width = nw * ratio;
        const height = nh * ratio;
        const left = frame.left + (frame.width - width) / 2;
        const top = frame.top + (frame.height - height) / 2;
        return {
            fit,
            rect: {
                left,
                top,
                width,
                height,
                right: left + width,
                bottom: top + height
            }
        };
    }
    return { rect: frame, fit };
}

function linesFromTextNode(textNode) {
    const raw = textNode.nodeValue || "";
    if (!raw || !raw.replace(/\s+/g, "")) {
        return [];
    }
    const lines = [];
    let index = 0;
    while (index < raw.length) {
        while (index < raw.length && raw[index] === "\n") {
            index += 1;
        }
        if (index >= raw.length) {
            break;
        }
        let low = index + 1;
        let high = raw.length;
        let fit = index + 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const range = rangeOf(textNode);
            range.setStart(textNode, index);
            range.setEnd(textNode, mid);
            const rects = range.getClientRects();
            if (rects.length <= 1) {
                fit = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        if (fit <= index) {
            fit = index + 1;
        }
        const range = rangeOf(textNode);
        range.setStart(textNode, index);
        range.setEnd(textNode, fit);
        const box = range.getBoundingClientRect();
        const text = raw.slice(index, fit).replace(/[ \t]+$/g, "");
        if (text && box.width > 0 && box.height > 0) {
            lines.push({ text, box });
        }
        index = fit;
        while (index < raw.length && raw[index] === " ") {
            index += 1;
        }
    }
    return lines;
}

function skipElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) {
        return true;
    }
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "LINK") {
        return true;
    }
    if (
        el.hasAttribute("data-print-debug") ||
        el.classList.contains("aurora-print-debug-overlay") ||
        el.classList.contains("aurora-print-debug-unit-tag")
    ) {
        return true;
    }
    return false;
}

function needsClip(el, style) {
    const overflow = String(style.overflow || "visible");
    if (overflow !== "hidden" && overflow !== "clip") {
        return false;
    }
    return el.classList.contains("aurora-print-page") ||
        el.classList.contains("aurora-report-record-card") ||
        el.classList.contains("aurora-vehicle-record-card") ||
        el.classList.contains("aurora-report-media-frame") ||
        el.classList.contains("aurora-vehicle-photo__frame") ||
        el.classList.contains("aurora-report-cover__photo") ||
        el.classList.contains("aurora-print-page__cover");
}

function parseRadius(style) {
    return Math.max(
        parsePx(style.borderTopLeftRadius),
        parsePx(style.borderTopRightRadius),
        parsePx(style.borderBottomRightRadius),
        parsePx(style.borderBottomLeftRadius)
    );
}

function roundedSvgPath(width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    if (r <= 0.4) {
        return "M 0 0 H " + width + " V " + height + " H 0 Z";
    }
    return [
        "M " + r + " 0",
        "H " + (width - r),
        "A " + r + " " + r + " 0 0 1 " + width + " " + r,
        "V " + (height - r),
        "A " + r + " " + r + " 0 0 1 " + (width - r) + " " + height,
        "H " + r,
        "A " + r + " " + r + " 0 0 1 0 " + (height - r),
        "V " + r,
        "A " + r + " " + r + " 0 0 1 " + r + " 0",
        "Z"
    ].join(" ");
}

function paintPseudo(ops, el, which) {
    const style = cssOf(el, which);
    if (!style || isHidden(style)) {
        return;
    }
    const content = String(style.content || "").trim();
    if (!content || content === "none" || content === "normal") {
        return;
    }
    const parent = el.getBoundingClientRect();
    const parentStyle = cssOf(el);
    const position = String(style.position || "static");
    let width = parsePx(style.width);
    let height = parsePx(style.height);
    if (position === "absolute" && !(height > 0) && style.top !== "auto" && style.bottom !== "auto") {
        height = Math.max(0, parent.height - parsePx(style.top) - parsePx(style.bottom));
    }
    if (!(width > 0 && height > 0)) {
        return;
    }
    let left = parent.left + parsePx(parentStyle.paddingLeft);
    let top = parent.top + parsePx(parentStyle.paddingTop) + parsePx(style.marginTop);
    if (position === "absolute") {
        left = parent.left + (style.left === "auto" ? 0 : parsePx(style.left));
        top = parent.top + (style.top === "auto" ? 0 : parsePx(style.top));
    }
    const box = { left, top, width, height, right: left + width, bottom: top + height };
    const linear = parseLinearGradient(style.backgroundImage);
    const solid = parseCssColor(style.backgroundColor);
    const radius = parseRadius(style);
    if (linear && linear.colors.length >= 2) {
        ops.push({
            type: "gradient",
            box,
            colors: linear.colors,
            angle: linear.angle,
            radius,
            note: "pseudo:" + which
        });
        return;
    }
    if (solid) {
        ops.push({
            type: "rect",
            box,
            color: solid,
            radius,
            note: "pseudo:" + which
        });
    }
}

function collectBorderOps(ops, rect, style) {
    ["Top", "Right", "Bottom", "Left"].forEach((key) => {
        const width = parsePx(style["border" + key + "Width"]);
        const kind = String(style["border" + key + "Style"] || "none");
        const color = parseCssColor(style["border" + key + "Color"]);
        if (!color || width <= 0 || kind === "none") {
            return;
        }
        const box = key === "Top"
            ? { left: rect.left, top: rect.top, width: rect.width, height: width }
            : key === "Bottom"
                ? { left: rect.left, top: rect.bottom - width, width: rect.width, height: width }
                : key === "Left"
                    ? { left: rect.left, top: rect.top, width, height: rect.height }
                    : { left: rect.right - width, top: rect.top, width, height: rect.height };
        ops.push({ type: "rect", box, color, note: "border-" + key.toLowerCase() });
    });
}

function collectOps(pageEl) {
    const ops = [];
    const pageRect = pageEl.getBoundingClientRect();
    const snapshot = {
        fontFamily: cssOf(pageEl).fontFamily,
        pageWidth: pageRect.width,
        pageHeight: pageRect.height,
        textLines: 0,
        images: 0,
        rects: 0,
        pseudos: 0,
        gradients: 0,
        clips: 0
    };

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement;
            if (!parent || skipElement(parent)) {
                return;
            }
            const style = cssOf(parent);
            if (isHidden(style)) {
                return;
            }
            const fillSource = style.webkitTextFillColor &&
                style.webkitTextFillColor !== "transparent"
                ? style.webkitTextFillColor
                : style.color;
            const color = parseCssColor(fillSource);
            linesFromTextNode(node).forEach((line) => {
                snapshot.textLines += 1;
                ops.push({
                    type: "text",
                    box: line.box,
                    text: applyTextTransform(line.text, style.textTransform),
                    color,
                    fontSize: parsePx(style.fontSize),
                    fontWeight: style.fontWeight,
                    fontFamily: style.fontFamily
                });
            });
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE || skipElement(node)) {
            return;
        }

        const el = node;
        const style = cssOf(el);
        if (isHidden(style)) {
            return;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return;
        }

        const clip = needsClip(el, style);
        if (clip) {
            snapshot.clips += 1;
            ops.push({
                type: "clipPush",
                box: rect,
                radius: parseRadius(style) * 1
            });
        }

        const linear = parseLinearGradient(style.backgroundImage);
        const background = parseCssColor(style.backgroundColor);
        const radius = parseRadius(style);
        const isImage = el.tagName === "IMG" && el.src;
        if (!isImage) {
            if (linear && linear.colors.length >= 2) {
                snapshot.gradients += 1;
                ops.push({
                    type: "gradient",
                    box: rect,
                    colors: linear.colors,
                    angle: linear.angle,
                    radius
                });
            } else if (background) {
                snapshot.rects += 1;
                ops.push({
                    type: "rect",
                    box: rect,
                    color: background,
                    radius,
                    element: el.tagName + "." + String(el.className || "").split(" ").slice(0, 3).join(".")
                });
            }
            collectBorderOps(ops, rect, style);
            paintPseudo(ops, el, "::before");
        }

        if (isImage) {
            const placed = containedImageRect(el);
            snapshot.images += 1;
            ops.push({
                type: "image",
                box: placed.rect,
                src: el.src,
                objectFit: placed.fit
            });
            paintPseudo(ops, el, "::after");
            if (clip) {
                ops.push({ type: "clipPop" });
            }
            return;
        }

        Array.from(el.childNodes).forEach(walk);
        paintPseudo(ops, el, "::after");
        if (clip) {
            ops.push({ type: "clipPop" });
        }
    }

    walk(pageEl);
    snapshot.pseudos = ops.filter((op) => String(op.note || "").indexOf("pseudo:") === 0).length;
    return { pageRect, ops, snapshot };
}

function decodeDataUrl(src) {
    const match = String(src || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
    if (!match) {
        return null;
    }
    const mime = String(match[1] || "").toLowerCase();
    const isBase64 = Boolean(match[2]);
    const payload = match[3] || "";
    if (!isBase64) {
        return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
    }
    const binary = global.atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return { mime, bytes };
}

function isJpeg(bytes) {
    return bytes && bytes.length > 2 && bytes[0] === 0xFF && bytes[1] === 0xD8;
}

function isPng(bytes) {
    return bytes && bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50;
}

async function fetchBytes(src) {
    const data = decodeDataUrl(src);
    if (data) {
        return data;
    }
    if (!src || typeof global.fetch !== "function") {
        return null;
    }
    try {
        const response = await global.fetch(src);
        if (!response || !response.ok) {
            return null;
        }
        const mime = String(response.headers && response.headers.get("content-type") || "").toLowerCase();
        const buffer = await response.arrayBuffer();
        return { mime, bytes: new Uint8Array(buffer) };
    } catch (error) {
        return null;
    }
}

async function embedImage(pdfDoc, src, cache) {
    const key = String(src || "");
    if (!key) {
        return null;
    }
    if (cache.has(key)) {
        return cache.get(key);
    }
    const packed = await fetchBytes(key);
    const bytes = packed && packed.bytes;
    if (!bytes) {
        cache.set(key, null);
        return null;
    }
    let image = null;
    try {
        if (isJpeg(bytes) || String(packed.mime || "").indexOf("jpeg") !== -1) {
            image = await pdfDoc.embedJpg(bytes);
        } else if (isPng(bytes) || String(packed.mime || "").indexOf("png") !== -1) {
            image = await pdfDoc.embedPng(bytes);
        } else {
            image = await pdfDoc.embedPng(bytes);
        }
    } catch (error) {
        image = null;
    }
    cache.set(key, image);
    return image;
}

async function loadFontBytes() {
    if (!fontBytesPromise) {
        fontBytesPromise = Promise.all([
            fetchBytes(fontAssetUrl(FONT_REGULAR_NAME)),
            fetchBytes(fontAssetUrl(FONT_BOLD_NAME))
        ]);
    }
    return fontBytesPromise;
}

function textBaselineY(font, size, box) {
    if (font && typeof font.descentAtSize === "function") {
        return box.y + Math.abs(font.descentAtSize(size));
    }
    return box.y + size * 0.18;
}

function drawRoundedFill(pdfPage, box, color, radius, rgb, PDFLib) {
    pdfPage.drawRectangle({
        x: box.x,
        y: box.y,
        width: Math.max(0.2, box.width),
        height: Math.max(0.2, box.height),
        color: rgb(color.r, color.g, color.b)
    });
}

function drawLinearGradient(pdfPage, box, spec, rgb) {
    const colors = spec.colors || [];
    if (!colors.length) {
        return;
    }
    if (colors.length === 1) {
        drawRoundedFill(pdfPage, box, colors[0], spec.radius || 0, rgb);
        return;
    }
    const angle = Number(spec.angle);
    const rad = (Number.isFinite(angle) ? angle : 180) * Math.PI / 180;
    const dirX = Math.sin(rad);
    const dirY = -Math.cos(rad);
    const steps = Math.max(18, Math.min(48, Math.round(Math.max(box.width, box.height) / 2.2)));
    for (let index = 0; index < steps; index += 1) {
        const y = box.y + (index / steps) * box.height;
        const sliceH = box.height / steps + 0.2;
        const midX = box.x + box.width / 2;
        const midY = y + sliceH / 2;
        const nx = (midX - (box.x + box.width / 2)) / Math.max(1, box.width);
        const ny = ((box.y + box.height - midY) - box.height / 2) / Math.max(1, box.height);
        const proj = nx * dirX + ny * dirY;
        const t = Math.max(0, Math.min(1, proj * 0.5 + 0.5));
        const scaled = t * (colors.length - 1);
        const colorIndex = Math.min(colors.length - 2, Math.floor(scaled));
        const color = lerpColor(colors[colorIndex], colors[colorIndex + 1], scaled - colorIndex);
        pdfPage.drawRectangle({
            x: box.x,
            y,
            width: box.width,
            height: sliceH,
            color: rgb(color.r, color.g, color.b)
        });
    }
}

function pushClip(pdfPage, box, radius, PDFLib) {
    if (typeof pdfPage.pushOperators !== "function") {
        return false;
    }
    const push = PDFLib.pushGraphicsState;
    const clip = PDFLib.clip;
    const endPath = PDFLib.endPath;
    const moveTo = PDFLib.moveTo;
    const lineTo = PDFLib.lineTo;
    const closePath = PDFLib.closePath;
    if (!push || !clip || !endPath || !moveTo || !lineTo || !closePath) {
        return false;
    }
    const x = box.x;
    const y = box.y;
    const w = box.width;
    const h = box.height;
    if (!(w > 1 && h > 1)) {
        return false;
    }
    pdfPage.pushOperators(
        push(),
        moveTo(x, y),
        lineTo(x + w, y),
        lineTo(x + w, y + h),
        lineTo(x, y + h),
        closePath(),
        clip(),
        endPath()
    );
    return true;
}

function popClip(pdfPage, PDFLib) {
    if (typeof pdfPage.pushOperators === "function" && PDFLib.popGraphicsState) {
        pdfPage.pushOperators(PDFLib.popGraphicsState());
    }
}

async function embedAuroraFonts(pdfDoc, PDFLib) {
    const diagnostic = {
        fontkitPresent: Boolean(global.fontkit),
        registerFontkitCalled: false,
        arialRegularBytes: 0,
        arialBoldBytes: 0,
        arialRegularLoaded: false,
        arialBoldLoaded: false,
        fontError: ""
    };
    const kit = global.fontkit;
    if (kit && typeof pdfDoc.registerFontkit === "function") {
        pdfDoc.registerFontkit(kit);
        diagnostic.registerFontkitCalled = true;
        try {
            const packed = await loadFontBytes();
            const regularBytes = packed[0] && packed[0].bytes;
            const boldBytes = packed[1] && packed[1].bytes;
            diagnostic.arialRegularBytes = regularBytes ? regularBytes.length : 0;
            diagnostic.arialBoldBytes = boldBytes ? boldBytes.length : 0;
            if (regularBytes && boldBytes) {
                const fonts = {
                    regular: await pdfDoc.embedFont(regularBytes, { subset: true }),
                    bold: await pdfDoc.embedFont(boldBytes, { subset: true }),
                    family: "Arial",
                    embedded: true,
                    unicode: true,
                    diagnostic
                };
                diagnostic.arialRegularLoaded = true;
                diagnostic.arialBoldLoaded = true;
                return fonts;
            }
            diagnostic.fontError = "Arial bytes ausentes (regular=" + diagnostic.arialRegularBytes + " bold=" + diagnostic.arialBoldBytes + ")";
        } catch (error) {
            diagnostic.fontError = String(error && error.message || error);
        }
    } else if (!kit) {
        diagnostic.fontError = "window.fontkit ausente";
    } else {
        diagnostic.fontError = "PDFDocument.registerFontkit ausente";
    }
    return {
        regular: await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold),
        family: "Helvetica",
        embedded: false,
        unicode: false,
        diagnostic
    };
}

async function writePdfFromPrintStage(stage, PDFLib, captureContext) {
    if (!stage) {
        throw new Error("Palco A4 ausente.");
    }
    const pageCountSource = "stage.querySelectorAll('.aurora-print-page').length";
    const pages = Array.from(stage.querySelectorAll(".aurora-print-page"));
    if (!pages.length) {
        throw new Error("Nenhuma .aurora-print-page no palco.");
    }

    attachStageForMeasurement(stage);
    pages.forEach((pageEl, pageIndex) => {
        pageEl.classList.toggle("aurora-pdf-page-active", pageIndex === 0);
    });
    await waitAnimationFrames(stage);
    const afterHost = captureStageDiagnostic(stage, "on-measure-host-page-0-active");

    const pdfDoc = await PDFLib.PDFDocument.create();
    const fonts = await embedAuroraFonts(pdfDoc, PDFLib);
    const imageCache = new Map();
    const rgb = PDFLib.rgb;
    const captures = [];
    const startedAt = (global.performance && performance.now()) || Date.now();
    let imageObjects = 0;
    let clipDepth = 0;
    let elementsVisited = 0;
    let textNodesFound = 0;
    let textRunsDrawn = 0;
    let rectanglesDrawn = 0;
    let imagesFound = 0;
    let imagesDrawn = 0;
    let clipsApplied = 0;
    let clipsSkipped = 0;
    let firstClipBox = null;
    let firstTextPdf = null;
    let firstImagePdf = null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    function trackBox(box) {
        if (!box) {
            return;
        }
        minX = Math.min(minX, box.x);
        maxX = Math.max(maxX, box.x + box.width);
        minY = Math.min(minY, box.y);
        maxY = Math.max(maxY, box.y + box.height);
    }

    for (let index = 0; index < pages.length; index += 1) {
        pages.forEach((pageEl, pageIndex) => {
            pageEl.classList.toggle("aurora-pdf-page-active", pageIndex === index);
        });
        await waitAnimationFrames(stage);

        const pageEl = pages[index];
        const pageSnap = snapshotPageDom(pageEl);
        elementsVisited += pageSnap.elementCount;
        textNodesFound += pageSnap.textNodesFound;
        imagesFound += pageSnap.imageCount;
        const captured = collectOps(pageEl);
        const mapper = createPageMapper(captured.pageRect);
        if (index === 0) {
            const probe = probeFirstVisibleText(pageEl);
            if (probe) {
                const mapped = mapper.toBox({
                    left: probe.x,
                    top: probe.y,
                    width: probe.width,
                    height: probe.height
                });
                firstTextPdf = {
                    text: probe.text,
                    x: mapped.x,
                    y: textBaselineY(fonts.regular, Math.max(5.5, 10 * mapper.scale), mapped),
                    fontSize: Math.max(5.5, parsePx(probe.fontSize) * mapper.scale),
                    fontFamily: probe.fontFamily,
                    fontWeight: probe.fontWeight,
                    color: probe.color,
                    domBox: probe
                };
            }
            const imgProbe = probeFirstImage(pageEl);
            if (imgProbe) {
                firstImagePdf = Object.assign({}, imgProbe, mapper.toBox({
                    left: imgProbe.x,
                    top: imgProbe.y,
                    width: imgProbe.width,
                    height: imgProbe.height
                }));
            }
        }
        captures.push({
            index,
            opCount: captured.ops.length,
            snapshot: captured.snapshot,
            scale: mapper.scale,
            pageRect: {
                width: captured.pageRect.width,
                height: captured.pageRect.height,
                left: captured.pageRect.left,
                top: captured.pageRect.top
            },
            pageSnap
        });

        const pdfPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pdfPage.drawRectangle({
            x: 0,
            y: 0,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            color: rgb(1, 1, 1)
        });

        for (let opIndex = 0; opIndex < captured.ops.length; opIndex += 1) {
            const op = captured.ops[opIndex];
            if (op.type === "clipPush") {
                const clipBox = mapper.toBox(op.box);
                if (!firstClipBox) {
                    firstClipBox = clipBox;
                }
                if (pushClip(pdfPage, clipBox, (op.radius || 0) * mapper.scale, PDFLib)) {
                    clipDepth += 1;
                    clipsApplied += 1;
                    trackBox(clipBox);
                } else {
                    clipsSkipped += 1;
                }
                continue;
            }
            if (op.type === "clipPop") {
                if (clipDepth > 0) {
                    popClip(pdfPage, PDFLib);
                    clipDepth -= 1;
                }
                continue;
            }
            const box = mapper.toBox(op.box);
            trackBox(box);
            if (op.type === "rect" && op.color) {
                rectanglesDrawn += 1;
                drawRoundedFill(
                    pdfPage,
                    box,
                    op.color,
                    (op.radius || 0) * mapper.scale,
                    rgb,
                    PDFLib
                );
            } else if (op.type === "gradient" && op.colors && op.colors.length) {
                rectanglesDrawn += 1;
                drawLinearGradient(pdfPage, box, {
                    colors: op.colors,
                    angle: op.angle,
                    radius: (op.radius || 0) * mapper.scale
                }, rgb);
            } else if (op.type === "text" && op.text) {
                const font = Number(op.fontWeight) >= 600 ? fonts.bold : fonts.regular;
                const size = Math.max(5.5, (op.fontSize || 10) * mapper.scale);
                const color = op.color || { r: 0.09, g: 0.13, b: 0.21 };
                const payload = fonts.unicode ? String(op.text) : toWinAnsi(op.text);
                textRunsDrawn += 1;
                pdfPage.drawText(payload, {
                    x: box.x,
                    y: textBaselineY(font, size, box),
                    size,
                    font,
                    color: rgb(color.r, color.g, color.b)
                });
            } else if (op.type === "image") {
                const image = await embedImage(pdfDoc, op.src, imageCache);
                if (image) {
                    imageObjects += 1;
                    imagesDrawn += 1;
                    pdfPage.drawImage(image, {
                        x: box.x,
                        y: box.y,
                        width: Math.max(0.2, box.width),
                        height: Math.max(0.2, box.height)
                    });
                }
            }
        }
        while (clipDepth > 0) {
            popClip(pdfPage, PDFLib);
            clipDepth -= 1;
        }
    }

    const bytes = await pdfDoc.save({ useObjectStreams: false });
    const endedAt = (global.performance && performance.now()) || Date.now();
    const diagnostic = {
        pagesFound: pages.length,
        pageCountSource,
        pageCountFunction: "writePdfFromPrintStage",
        elementsVisited,
        textNodesFound,
        textRunsDrawn,
        rectanglesDrawn,
        imagesFound,
        imagesDrawn,
        imageObjects,
        clipsApplied,
        clipsSkipped,
        firstClipBox,
        firstTextPdf,
        firstImagePdf,
        minX: Number.isFinite(minX) ? minX : null,
        maxX: Number.isFinite(maxX) ? maxX : null,
        minY: Number.isFinite(minY) ? minY : null,
        maxY: Number.isFinite(maxY) ? maxY : null,
        markerRemoved: true,
        fontFamily: fonts.family,
        fontEmbedded: fonts.embedded,
        fontError: fonts.diagnostic && fonts.diagnostic.fontError || "",
        fontkitPresent: fonts.diagnostic && fonts.diagnostic.fontkitPresent,
        arialRegularLoaded: fonts.diagnostic && fonts.diagnostic.arialRegularLoaded,
        arialBoldLoaded: fonts.diagnostic && fonts.diagnostic.arialBoldLoaded,
        arialRegularBytes: fonts.diagnostic && fonts.diagnostic.arialRegularBytes,
        arialBoldBytes: fonts.diagnostic && fonts.diagnostic.arialBoldBytes,
        registerFontkitCalled: fonts.diagnostic && fonts.diagnostic.registerFontkitCalled,
        before: captureContext && captureContext.before || null,
        after: afterHost,
        prematureCleanup: false
    };
    diagnostic.summary = publishLayoutDiagnostic(diagnostic);

    return {
        bytes,
        pageCount: pages.length,
        htmlPageCount: pages.length,
        captures,
        elapsedMs: endedAt - startedAt,
        byteLength: bytes.byteLength,
        header: String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]),
        imageObjects,
        font: fonts,
        writerContract: WRITER_CONTRACT,
        diagnostic
    };
}

async function generateFromPreview(preview) {
    if (!preview || !preview.modal || !preview.currentReportId) {
        throw new Error("Prévia do relatório não está aberta.");
    }
    if (!preview.engine || typeof preview.engine.get !== "function") {
        throw new Error("Engine da prévia indisponível.");
    }
    const report = preview.engine.get(preview.currentReportId);
    const documentNode = preview.modal.querySelector("[data-report-document]");
    if (!report || !documentNode) {
        throw new Error("Relatório ou documento não encontrado.");
    }
    const PDFLib = global.PDFLib;
    if (!PDFLib || typeof PDFLib.PDFDocument !== "function") {
        throw new Error("pdf-lib local indisponível.");
    }

    await preview._syncPreviewMediaLayouts(documentNode);
    if (
        global.AuroraPdfSerialize &&
        typeof global.AuroraPdfSerialize.inlineImagesForPdf === "function"
    ) {
        await global.AuroraPdfSerialize.inlineImagesForPdf(documentNode);
    }

    const oldStage = preview.modal.querySelector("[data-report-print-stage]");
    if (oldStage) {
        oldStage.remove();
    }

    const stage = await preview._buildPrintStage(documentNode, report);
    await waitAnimationFrames(stage);
    const before = captureStageDiagnostic(stage, "after-_buildPrintStage-in-preview-modal");
    attachStageForMeasurement(stage);
    await waitAnimationFrames(stage);

    try {
        return await writePdfFromPrintStage(stage, PDFLib, { before });
    } finally {
        if (typeof preview._cleanupPrintExportArtifacts === "function") {
            preview._cleanupPrintExportArtifacts();
        }
    }
}

global.AuroraPdfFromLayout = {
    PAGE_WIDTH,
    PAGE_HEIGHT,
    WRITER_CONTRACT,
    writePdfFromPrintStage,
    generateFromPreview,
    collectOps
};
})(typeof window !== "undefined" ? window : globalThis);

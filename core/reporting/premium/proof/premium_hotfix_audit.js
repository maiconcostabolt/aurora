(function (global) {
"use strict";

function classifySrcType(src) {
    const value = String(src || "").trim();

    if (!value) {
        return "empty";
    }

    if (value.startsWith("data:")) {
        return "data-url";
    }

    if (value.startsWith("blob:")) {
        return "blob-url";
    }

    if (/^https?:\/\//i.test(value)) {
        return "http-url";
    }

    return "relative-path";
}

function auditImageNode(img, slot) {
    const style = global.getComputedStyle(img);
    const objectFit = style.objectFit || "";
    const naturalWidth = img.naturalWidth || 0;
    const naturalHeight = img.naturalHeight || 0;
    const clientWidth = img.clientWidth || 0;
    const clientHeight = img.clientHeight || 0;
    const src = String(img.currentSrc || img.src || "").trim();
    const scale = Math.min(
        clientWidth / (naturalWidth || 1),
        clientHeight / (naturalHeight || 1)
    );
    const renderedWidth = naturalWidth * scale;
    const renderedHeight = naturalHeight * scale;
    const originalAspectRatio = naturalHeight
        ? naturalWidth / naturalHeight
        : 0;
    const renderedImageAspectRatio = renderedHeight
        ? renderedWidth / renderedHeight
        : 0;
    const loaded =
        naturalWidth > 0 &&
        naturalHeight > 0 &&
        !img.complete === false &&
        img.complete !== false;
    const pass =
        loaded &&
        objectFit === "contain" &&
        Math.abs(originalAspectRatio - renderedImageAspectRatio) < 0.02 &&
        renderedWidth <= clientWidth + 1 &&
        renderedHeight <= clientHeight + 1;

    return {
        slot,
        alt: img.alt || "",
        naturalWidth,
        naturalHeight,
        renderedWidth: Math.round(renderedWidth),
        renderedHeight: Math.round(renderedHeight),
        originalAspectRatio: Number(originalAspectRatio.toFixed(4)),
        renderedImageAspectRatio: Number(renderedImageAspectRatio.toFixed(4)),
        computedObjectFit: objectFit,
        srcType: classifySrcType(src),
        loaded: loaded && naturalWidth > 0,
        result: pass ? "PASS" : "FAIL"
    };
}

function inferSlot(img) {
    if (img.classList.contains("prm-cover__photo-img")) {
        return "coverPhoto";
    }

    const card = img.closest(".prm-photo-card");
    if (card) {
        const match = Array.from(card.classList).find(
            (name) => name.indexOf("prm-photo-card--") === 0
        );
        if (match) {
            return match.replace("prm-photo-card--", "");
        }
    }

    const occurrence = img.closest(".prm-occurrence-card");
    if (occurrence) {
        const title = occurrence.querySelector(".prm-occurrence-card__head h3");
        return title
            ? "avaria:" + title.textContent.trim()
            : "avaria";
    }

    if (img.classList.contains("prm-signature-block__img")) {
        return "signature";
    }

    return img.alt || "unknown";
}

function auditImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    const items = images.map((img) => auditImageNode(img, inferSlot(img)));
    const broken = items.filter(
        (item) => !item.loaded || item.result !== "PASS"
    );

    return {
        imageCount: items.length,
        brokenImages: broken.length,
        allPass: broken.length === 0,
        images: items
    };
}

function countExternalDependencies(root) {
    const html = root.innerHTML || "";
    const patterns = [
        /fonts\.googleapis\.com/i,
        /fonts\.gstatic\.com/i,
        /pexels\.com/i,
        /unsplash\.com/i,
        /cdnjs\.cloudflare\.com/i
    ];

    return patterns.reduce((count, pattern) => {
        return count + (pattern.test(html) ? 1 : 0);
    }, 0);
}

function premiumCssLoaded(root) {
    if (!root) {
        return false;
    }

    const page = root.querySelector(".a4-page");
    if (!page) {
        return false;
    }

    const style = global.getComputedStyle(page);
    return (
        style.getPropertyValue("width") !== "" &&
        style.getPropertyValue("box-sizing") === "border-box"
    );
}

global.AURORA_PREMIUM_HOTFIX_AUDIT = {
    classifySrcType,
    auditImageNode,
    auditImages,
    countExternalDependencies,
    premiumCssLoaded
};
})(typeof window !== "undefined" ? window : globalThis);

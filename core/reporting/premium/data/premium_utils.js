(function (global) {
"use strict";

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function pad2(value) {
    return String(value).padStart(2, "0");
}

function formatReportDate(isoValue) {
    const date = new Date(isoValue || Date.now());
    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    const months = [
        "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
        "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
    ];

    return `${pad2(date.getDate())} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatReportTime(isoValue) {
    const date = new Date(isoValue || Date.now());
    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatIntakeDateTime(dateValue, timeValue) {
    if (!dateValue && !timeValue) {
        return { date: "—", time: "—" };
    }

    const iso = dateValue && timeValue
        ? `${dateValue}T${timeValue}:00`
        : dateValue || timeValue;

    return {
        date: formatReportDate(iso),
        time: timeValue || formatReportTime(iso)
    };
}

function normalizePhotoSrc(photo) {
    if (!photo) {
        return "";
    }

    if (typeof photo === "string") {
        return photo.trim();
    }

    return String(
        photo.src ||
        photo.url ||
        photo.href ||
        ""
    ).trim();
}

function mapSeverityToPremium(severity) {
    const value = String(severity || "").trim().toLowerCase();

    if (!value || value.includes("sem gravidade")) {
        return null;
    }

    if (value.includes("crít") || value.includes("crit") || value.includes("alta")) {
        return "reparo";
    }

    if (value.includes("reparo")) {
        return "reparo";
    }

    return "atencao";
}

function mapChecklistStatusToPremium(status) {
    const value = String(status || "").trim().toLowerCase();

    if (value === "ok" || value.includes("conforme")) {
        return "ok";
    }

    if (value.includes("reparo") || value.includes("ausente")) {
        return "reparo";
    }

    if (value.includes("aten")) {
        return "atencao";
    }

    return "ok";
}

function splitYearModel(yearModel, reportTitle) {
    const raw = String(yearModel || "").trim();
    const title = String(reportTitle || "").trim();

    if (title) {
        const parts = title.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return {
                make: parts[0],
                model: parts.slice(1).join(" ")
            };
        }

        if (parts.length === 1) {
            return { make: parts[0], model: "" };
        }
    }

    return { make: raw, model: "" };
}

function chunkArray(items, size) {
    const output = [];
    const list = Array.isArray(items) ? items : [];

    for (let index = 0; index < list.length; index += size) {
        output.push(list.slice(index, index + size));
    }

    return output;
}

global.AuroraPremiumUtils = {
    escapeHtml,
    formatReportDate,
    formatReportTime,
    formatIntakeDateTime,
    normalizePhotoSrc,
    mapSeverityToPremium,
    mapChecklistStatusToPremium,
    splitYearModel,
    chunkArray
};
})(typeof window !== "undefined" ? window : globalThis);

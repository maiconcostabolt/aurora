(function (global) {
"use strict";

const STORAGE_KEY = "aurora_entitlements_v1";
const VALID_STATES = new Set(["included", "trial", "available", "locked"]);

function readAll() {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        return value && typeof value === "object" ? value : {};
    } catch (error) {
        return {};
    }
}

function writeAll(value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value || {}));
}

function key(profileId, serviceId) {
    return `${String(profileId || "default")}:${String(serviceId || "service")}`;
}

function get(profileId, serviceId) {
    const stored = readAll()[key(profileId, serviceId)];
    if (stored && VALID_STATES.has(stored.state)) {
        return { ...stored };
    }

    /* Compatibilidade RC8: tudo que já existia continua liberado. */
    return {
        state: "included",
        price: null,
        currency: "BRL"
    };
}

function set(profileId, serviceId, entitlement) {
    const next = entitlement && typeof entitlement === "object"
        ? { ...entitlement }
        : { state: String(entitlement || "included") };

    if (!VALID_STATES.has(next.state)) {
        throw new Error("Estado de licença inválido.");
    }

    const all = readAll();
    all[key(profileId, serviceId)] = {
        state: next.state,
        price: Number.isFinite(Number(next.price)) ? Number(next.price) : null,
        currency: next.currency || "BRL",
        updated_at: new Date().toISOString()
    };
    writeAll(all);
    return get(profileId, serviceId);
}

function canPreview(profileId, serviceId) {
    return Boolean(get(profileId, serviceId));
}

function canProduceReport(profileId, serviceId) {
    const state = get(profileId, serviceId).state;
    return state === "included" || state === "trial";
}

global.AuroraEntitlements = {
    STORAGE_KEY,
    states: ["included", "trial", "available", "locked"],
    get,
    set,
    canPreview,
    canProduceReport
};

})(window);

(function (global) {
"use strict";

const ACTIVE_KEY = "aurora_account_storage_active_v1";
const DATA_PREFIX = "aurora_account_storage_data_v1:";
const PRESERVE_ERROR =
    "Não foi possível preservar os dados locais da conta anterior. Libere espaço no navegador e tente novamente.";

function isManagerKey(key) { return key === ACTIVE_KEY || key.indexOf(DATA_PREFIX) === 0; }
function isAuthKey(key) {
    return /^sb-.+-auth-token(?:-code-verifier)?$/.test(key) || key.indexOf("supabase.auth.") === 0;
}
function isAuroraDataKey(key) {
    return !isManagerKey(key) && !isAuthKey(key) && (key.indexOf("aurora") === 0 || key.indexOf("AURORA") === 0);
}
function accountKey(userId) { return DATA_PREFIX + String(userId || "").trim(); }
function isQuotaError(error) {
    if (!error) return false;
    const name = String(error.name || "");
    const message = String(error.message || "").toLowerCase();
    return (
        name === "QuotaExceededError" ||
        name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        error.code === 22 ||
        error.code === 1014 ||
        message.indexOf("quota") !== -1
    );
}
function collectCurrentData() {
    const data = {};
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && isAuroraDataKey(key)) data[key] = localStorage.getItem(key);
    }
    return data;
}
function snapshotInfo(data, serialized) {
    const keys = Object.keys(data);
    const heaviest = keys
        .map((key) => ({ key: key, chars: String(data[key] || "").length }))
        .sort((left, right) => right.chars - left.chars)
        .slice(0, 5);
    return {
        keyCount: keys.length,
        serializedChars: serialized.length,
        heaviest: heaviest
    };
}
function logSnapshot(stage, target, info, error) {
    console.warn("AURORA_ACCOUNT_STORAGE", {
        stage: stage,
        target: target,
        keyCount: info.keyCount,
        serializedChars: info.serializedChars,
        heaviest: info.heaviest,
        error: error ? String(error.name || error.message || error) : null
    });
}
function restoreLiveKeys(data, keys) {
    keys.forEach((key) => {
        localStorage.setItem(key, data[key]);
    });
}
function persistSnapshot(userId, data) {
    const id = String(userId || "").trim();
    if (!id) return;
    const serialized = JSON.stringify(data);
    const info = snapshotInfo(data, serialized);
    const target = accountKey(id);
    const liveKeys = Object.keys(data).filter(isAuroraDataKey);

    try {
        localStorage.setItem(target, serialized);
        console.info("AURORA_ACCOUNT_STORAGE", {
            stage: "snapshot_saved",
            target: target,
            keyCount: info.keyCount,
            serializedChars: info.serializedChars,
            heaviest: info.heaviest,
            error: null
        });
    } catch (error) {
        if (!isQuotaError(error)) throw error;
        logSnapshot("quota_with_live_keys", target, info, error);
        liveKeys.forEach((key) => localStorage.removeItem(key));
        try {
            localStorage.setItem(target, serialized);
        } catch (retryError) {
            logSnapshot("quota_after_freeing_live_keys", target, info, retryError);
            try {
                restoreLiveKeys(data, liveKeys);
            } catch (restoreError) {
                logSnapshot("restore_live_keys_failed", target, info, restoreError);
            }
            throw new Error(PRESERVE_ERROR);
        }
        logSnapshot("snapshot_saved_after_freeing_live_keys", target, info, null);
    }

    if (localStorage.getItem(target) !== serialized) {
        logSnapshot("snapshot_validation_failed", target, info, null);
        try {
            localStorage.removeItem(target);
        } catch (removeError) {
            logSnapshot("invalid_snapshot_remove_failed", target, info, removeError);
        }
        try {
            restoreLiveKeys(data, liveKeys);
        } catch (restoreError) {
            logSnapshot("restore_live_keys_failed", target, info, restoreError);
        }
        throw new Error("A cópia local da conta não pôde ser validada. Tente novamente.");
    }
}
function clearCurrentData() {
    const hr = global.AuroraHomeReturnTrace;
    const beforeRepo = hr ? hr.repositoryCaseSnapshot() : null;
    const runtimeCase = hr ? hr.runtimeCaseSnapshot() : null;
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && isAuroraDataKey(key)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    if (hr) {
        hr.logHR7({
            operation: "ACCOUNT_CLEAR",
            caseIdBefore: beforeRepo && beforeRepo.id ? beforeRepo.id : runtimeCase.id,
            caseIdAfter: "",
            origin: "AccountStorage.clearCurrentData",
            currentIndex: runtimeCase.index,
            keysRemoved: keys.length
        });
    }
}
function saveCurrent(userId) {
    const id = String(userId || "").trim();
    if (id) persistSnapshot(id, collectCurrentData());
}
function restore(userId) {
    const id = String(userId || "").trim();
    const hr = global.AuroraHomeReturnTrace;
    const beforeRepo = hr ? hr.repositoryCaseSnapshot() : null;
    const runtimeCase = hr ? hr.runtimeCaseSnapshot() : null;
    clearCurrentData();
    if (!id) return;
    try {
        const saved = JSON.parse(localStorage.getItem(accountKey(id)) || "{}");
        Object.keys(saved || {}).forEach((key) => {
            if (isAuroraDataKey(key) && typeof saved[key] === "string") localStorage.setItem(key, saved[key]);
        });
    } catch (error) {
        console.error("Não foi possível restaurar os dados locais da conta.", error);
    }
    if (hr) {
        const afterRepo = hr.repositoryCaseSnapshot();
        hr.logHR7({
            operation: "ACCOUNT_RESTORE",
            caseIdBefore: beforeRepo && beforeRepo.id ? beforeRepo.id : runtimeCase.id,
            caseIdAfter: afterRepo && afterRepo.id ? afterRepo.id : "",
            origin: "AccountStorage.restore",
            currentIndex: runtimeCase.index,
            userId: id
        });
    }
}
function activate(userId) {
    const nextId = String(userId || "").trim();
    if (!nextId) return false;
    const currentId = localStorage.getItem(ACTIVE_KEY) || "";
    if (currentId === nextId) return false;
    const hr = global.AuroraHomeReturnTrace;
    const runtimeCase = hr ? hr.runtimeCaseSnapshot() : null;
    if (currentId) saveCurrent(currentId);
    restore(nextId);
    localStorage.setItem(ACTIVE_KEY, nextId);
    if (hr) {
        hr.logHR5({
            evento: "AccountStorage.activate",
            currentId: currentId,
            nextId: nextId,
            activateResult: "SIM",
            reloadRequested: "NAO",
            caseId: runtimeCase.id
        });
    }
    return true;
}
function initializeFresh(userId) {
    const nextId = String(userId || "").trim();
    if (!nextId) return false;
    const currentId = localStorage.getItem(ACTIVE_KEY) || "";
    const hr = global.AuroraHomeReturnTrace;
    const runtimeCase = hr ? hr.runtimeCaseSnapshot() : null;
    if (currentId && currentId !== nextId) saveCurrent(currentId);
    clearCurrentData();
    localStorage.removeItem(accountKey(nextId));
    localStorage.setItem(accountKey(nextId), "{}");
    localStorage.setItem(ACTIVE_KEY, nextId);
    if (hr) {
        hr.logHR5({
            evento: "AccountStorage.initializeFresh",
            currentId: currentId,
            nextId: nextId,
            activateResult: "SIM",
            reloadRequested: "NAO",
            caseId: runtimeCase.id
        });
        hr.logHR7({
            operation: "ACCOUNT_FRESH",
            caseIdBefore: runtimeCase.id,
            caseIdAfter: "",
            origin: "AccountStorage.initializeFresh",
            currentIndex: runtimeCase.index
        });
    }
    return true;
}
function suspend() {
    const currentId = localStorage.getItem(ACTIVE_KEY) || "";
    if (currentId) saveCurrent(currentId);
    clearCurrentData();
    localStorage.removeItem(ACTIVE_KEY);
}
global.AuroraAccountStorage = {
    activate,
    initializeFresh,
    suspend,
    activeUserId: () => localStorage.getItem(ACTIVE_KEY) || ""
};
})(window);

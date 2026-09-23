(function (global) {
"use strict";

const STORAGE_KEY = "aurora_user_profile_v1";

function readCache() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        return {};
    }
}

function writeCache(patch) {
    const next = Object.assign({}, readCache(), patch || {}, {
        updated_at: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
}

function getUserId() {
    return String(
        global.AURORA_ACCOUNT_USER_ID ||
        readCache().user_id ||
        ""
    ).trim();
}

function getUserFullName() {
    const cached = String(readCache().full_name || "").trim();
    if (cached) {
        return cached;
    }

    const email = String(
        global.AURORA_ACCOUNT_EMAIL ||
        readCache().email ||
        ""
    ).trim();

    if (email && email.includes("@")) {
        return email.split("@")[0];
    }

    return "";
}

function setFullName(fullName) {
    const name = String(fullName || "").trim();
    if (!name) {
        return readCache();
    }

    return writeCache({
        full_name: name,
        user_id: getUserId() || undefined
    });
}

function syncFromSession(session) {
    if (!session || !session.user) {
        return readCache();
    }

    const metadata = session.user.user_metadata || {};
    const name = String(
        metadata.full_name ||
        metadata.name ||
        ""
    ).trim();
    const patch = {
        user_id: session.user.id || "",
        email: session.user.email || ""
    };

    if (name) {
        patch.full_name = name;
    }

    return writeCache(patch);
}

function syncFromCloudProfile(cloudProfile) {
    if (!cloudProfile || typeof cloudProfile !== "object") {
        return readCache();
    }

    const name = String(
        cloudProfile.full_name ||
        cloudProfile.name ||
        ""
    ).trim();
    const patch = {};

    if (cloudProfile.email) {
        patch.email = String(cloudProfile.email).trim();
    }

    if (name) {
        patch.full_name = name;
    }

    return Object.keys(patch).length ? writeCache(patch) : readCache();
}

function bootstrapFromAuthReady() {
    if (!global.AuroraAuthReady) {
        return;
    }

    global.AuroraAuthReady
        .then((session) => {
            if (session) {
                syncFromSession(session);
            }
        })
        .catch(() => {});
}

global.AuroraUserProfile = {
    STORAGE_KEY,
    readCache,
    getUserId,
    getUserFullName,
    setFullName,
    syncFromSession,
    syncFromCloudProfile
};

global.addEventListener("aurora:account-session", (event) => {
    if (!event.detail || !event.detail.signedIn) {
        return;
    }

    bootstrapFromAuthReady();
});

bootstrapFromAuthReady();

})(window);

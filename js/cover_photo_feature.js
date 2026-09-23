(function (global) {
"use strict";

const store =
    global.auroraEvidenceStore ||
    new global.EvidenceStore();

let mountedHost = null;
let runtimeHooked = false;

function notify(message) {
    if (
        global.AuroraReportFeature &&
        global.auroraReportPreview &&
        typeof global.auroraReportPreview.onNotify === "function"
    ) {
        global.auroraReportPreview.onNotify(message);
        return;
    }

    const status = document.getElementById("app-status");
    if (!status) {
        console.log(message);
        return;
    }

    status.textContent = message;
    status.classList.add("is-visible");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
        status.classList.remove("is-visible");
    }, 2400);
}

function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}

function coverPhotoStorageId(caseId) {
    return `cover-photo-${String(caseId || "draft")}`;
}

function currentCase() {
    return global.auroraRuntime &&
        typeof global.auroraRuntime.getCase === "function"
        ? global.auroraRuntime.getCase()
        : null;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value || null));
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("read failed"));
        reader.readAsDataURL(file);
    });
}

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("image load failed"));
        image.src = source;
    });
}

async function fileToCompressedDataURL(file) {
    const source = await readFileAsDataURL(file);
    const image = await loadImage(source);
    const maxDimension = 1600;
    const scale = Math.min(
        1,
        maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
        src: canvas.toDataURL("image/jpeg", 0.82),
        width: canvas.width,
        height: canvas.height
    };
}

function normalizeCoverPhoto(raw) {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const src = String(raw.src || raw.edited_src || "").trim();
    if (!src) {
        return raw.id || raw.has_photo
            ? {
                id: raw.id || null,
                alt: String(raw.alt || "").trim(),
                has_photo: Boolean(raw.has_photo),
                created_at: raw.created_at || null,
                source_photo_id: raw.source_photo_id
                    ? String(raw.source_photo_id)
                    : null
            }
            : null;
    }

    const normalized = {
        id: raw.id || coverPhotoStorageId(raw.case_id),
        src,
        alt: String(raw.alt || "").trim(),
        has_photo: true,
        created_at: raw.created_at || new Date().toISOString()
    };

    if (raw.source_photo_id) {
        normalized.source_photo_id = String(raw.source_photo_id);
    }

    return normalized;
}

function resolveCoverPhotoSourceId(caseData) {
    const reference =
        caseData &&
        (caseData.coverPhoto || caseData.cover_photo);

    if (!reference || typeof reference !== "object") {
        return null;
    }

    const sourceId = reference.source_photo_id;
    return sourceId ? String(sourceId) : null;
}

function isCoverPhotoSource(caseData, photoId) {
    if (!photoId) {
        return false;
    }

    return resolveCoverPhotoSourceId(caseData) === String(photoId);
}

function emitCoverPhotoChanged() {
    if (typeof global.dispatchEvent === "function") {
        global.dispatchEvent(
            new CustomEvent("aurora:cover-photo-changed")
        );
    }
}

async function loadStoredCoverPhoto(caseData) {
    const caseId = caseData && caseData.id ? String(caseData.id) : "";
    if (!caseId) {
        return null;
    }

    const reference = normalizeCoverPhoto(
        caseData.coverPhoto || caseData.cover_photo
    );
    const storageId =
        (reference && reference.id) ||
        coverPhotoStorageId(caseId);

    try {
        const stored = await store.get(storageId);
        if (!stored) {
            return reference && reference.src ? reference : null;
        }

        return normalizeCoverPhoto({
            ...reference,
            ...stored,
            id: storageId,
            source_photo_id:
                reference.source_photo_id ||
                stored.source_photo_id ||
                null
        });
    } catch (error) {
        console.warn("Aurora Cover Photo: falha ao carregar foto de capa.", error);
        return reference && reference.src ? reference : null;
    }
}

async function hydrateCoverPhoto(caseData) {
    const hydrated = clone(caseData || {});
    const loaded = await loadStoredCoverPhoto(hydrated);
    if (loaded && loaded.src) {
        hydrated.coverPhoto = loaded;
    } else {
        delete hydrated.coverPhoto;
        delete hydrated.cover_photo;
    }
    return hydrated;
}

async function persistCoverPhoto(caseData, coverPhoto) {
    const caseId = caseData && caseData.id ? String(caseData.id) : "";
    if (!caseId) {
        throw new Error("Atendimento sem identificação.");
    }

    const runtime = global.auroraRuntime;
    const storageId = coverPhotoStorageId(caseId);

    if (!coverPhoto) {
        try {
            await store.remove(storageId);
        } catch (error) {
            console.warn("Aurora Cover Photo: falha ao remover foto persistida.", error);
        }

        if (runtime && runtime.caseBinder && typeof runtime.caseBinder.merge === "function") {
            runtime.caseBinder.merge(
                { coverPhoto: null, cover_photo: null },
                { source: "cover_photo", controller_id: "approval" }
            );
        }

        if (global.auroraRepository && typeof global.auroraRepository.save === "function") {
            global.auroraRepository.save(runtime.getCase());
        }

        return null;
    }

    const payload = {
        id: storageId,
        case_id: caseId,
        record_kind: "report_cover_photo",
        title: "Foto de capa do relatório",
        description: "",
        src: coverPhoto.src,
        edited_src: null,
        alt: String(coverPhoto.alt || "").trim(),
        created_at: coverPhoto.created_at || new Date().toISOString(),
        source_photo_id: coverPhoto.source_photo_id
            ? String(coverPhoto.source_photo_id)
            : null,
        photos: []
    };

    await store.save(payload);

    const reference = {
        id: storageId,
        alt: payload.alt,
        has_photo: true,
        created_at: payload.created_at,
        source_photo_id: payload.source_photo_id || null
    };

    if (runtime && runtime.caseBinder && typeof runtime.caseBinder.merge === "function") {
        runtime.caseBinder.merge(
            {
                coverPhoto: {
                    ...reference,
                    src: payload.src
                },
                cover_photo: null
            },
            { source: "cover_photo", controller_id: "evidence" }
        );
    }

    if (global.auroraRepository && typeof global.auroraRepository.save === "function") {
        global.auroraRepository.save(runtime.getCase());
    }

    return {
        ...reference,
        src: payload.src
    };
}

function panelHTML() {
    return [
        '<section class="avi-card aurora-cover-photo-panel" data-cover-photo-panel>',
        '<header class="aurora-cover-photo-panel__head">',
        "<h3>Foto de capa do relatório</h3>",
        "<p>Opcional. Aparece na capa do documento quando selecionada explicitamente.</p>",
        "</header>",
        '<div class="aurora-cover-photo-panel__preview" data-cover-photo-preview>',
        '<p class="aurora-cover-photo-panel__empty">Nenhuma foto de capa selecionada.</p>',
        "</div>",
        '<div class="aurora-cover-photo-panel__actions">',
        '<button type="button" class="aurora-cover-photo-add" data-cover-photo-add>',
        '<span class="aurora-cover-photo-add__icon" aria-hidden="true">📷</span>',
        '<span class="aurora-cover-photo-add__copy"><strong>Adicionar foto</strong><small>Tire uma foto ou escolha da galeria</small></span>',
        '<span class="aurora-cover-photo-add__chevron" aria-hidden="true">›</span>',
        "</button>",
        '<button type="button" class="aurora-cover-photo-manage" data-cover-photo-manage hidden>Opções da foto <span aria-hidden="true">›</span></button>',
        "</div>",
        '<input type="file" accept="image/*" capture="environment" data-cover-photo-camera-input class="aurora-cover-photo-panel__file">',
        '<input type="file" accept="image/*" data-cover-photo-gallery-input class="aurora-cover-photo-panel__file">',
        '<div class="aurora-cover-photo-chooser" data-cover-photo-sheet hidden>',
        '<div class="aurora-cover-photo-chooser__head"><strong data-cover-photo-sheet-title>Adicionar foto de capa</strong><button type="button" class="aurora-cover-photo-chooser__close" data-cover-photo-sheet-close aria-label="Fechar">×</button></div>',
        '<div class="aurora-cover-photo-chooser__options">',
        '<button type="button" class="aurora-cover-photo-sheet__option" data-cover-photo-camera>📷 <span>Tirar foto</span><b>›</b></button>',
        '<button type="button" class="aurora-cover-photo-sheet__option" data-cover-photo-gallery>🖼️ <span>Escolher da galeria</span><b>›</b></button>',
        '<button type="button" class="aurora-cover-photo-sheet__option is-danger" data-cover-photo-remove hidden>🗑️ <span>Remover foto</span><b>›</b></button>',
        "</div>",
        "</div>",
        "</section>"
    ].join("");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function renderPanel() {
    if (!mountedHost) {
        return;
    }

    const preview = mountedHost.querySelector("[data-cover-photo-preview]");
    const manageButton = mountedHost.querySelector("[data-cover-photo-manage]");
    const addButton = mountedHost.querySelector("[data-cover-photo-add]");
    const removeButton = mountedHost.querySelector("[data-cover-photo-remove]");
    if (!preview || !manageButton || !addButton || !removeButton) {
        return;
    }

    const caseData = currentCase() || {};
    const coverPhoto = await loadStoredCoverPhoto(caseData);

    if (coverPhoto && coverPhoto.src) {
        preview.innerHTML = [
            '<figure class="aurora-cover-photo-panel__frame">',
            `<img src="${escapeHTML(coverPhoto.src)}" alt="${escapeHTML(coverPhoto.alt || "Foto de capa do relatório")}">`,
            "</figure>"
        ].join("");
        addButton.hidden = true;
        manageButton.hidden = false;
        removeButton.hidden = false;
    } else {
        preview.innerHTML =
            '<p class="aurora-cover-photo-panel__empty">Nenhuma foto de capa selecionada.</p>';
        addButton.hidden = false;
        manageButton.hidden = true;
        removeButton.hidden = true;
    }
}

async function setCoverPhotoFromFile(file) {
    if (!file) {
        return;
    }

    const caseData = currentCase();
    if (!caseData || !caseData.id) {
        notify("Salve o atendimento antes de definir a foto de capa.");
        return;
    }

    notify("Processando foto de capa...");
    const compressed = await fileToCompressedDataURL(file);
    await persistCoverPhoto(caseData, {
        src: compressed.src,
        width: compressed.width,
        height: compressed.height,
        alt: "",
        created_at: new Date().toISOString()
    });
    emitCoverPhotoChanged();
    await renderPanel();
    notify("Foto de capa adicionada.");
}

async function setCoverPhotoFromEvidencePhoto(caseData, photo) {
    if (!photo || !photo.id) {
        return null;
    }

    const activeCase = caseData || currentCase();
    if (!activeCase || !activeCase.id) {
        notify("Salve o atendimento antes de definir a foto de capa.");
        return null;
    }

    const src = String(photo.edited_src || photo.src || "").trim();
    if (!src) {
        notify("Esta foto ainda não está disponível para a capa.");
        return null;
    }

    const alt = String(
        photo.description ||
        photo.title ||
        ""
    ).trim();

    const saved = await persistCoverPhoto(activeCase, {
        src,
        alt,
        source_photo_id: photo.id,
        created_at: photo.created_at || new Date().toISOString()
    });

    emitCoverPhotoChanged();
    await renderPanel();
    notify("Foto de capa definida.");
    return saved;
}

async function syncCoverPhotoFromEvidencePhoto(photo) {
    if (!photo || !photo.id) {
        return null;
    }

    const caseData = currentCase();
    if (!isCoverPhotoSource(caseData, photo.id)) {
        return null;
    }

    const src = String(photo.edited_src || photo.src || "").trim();
    if (!src) {
        return clearCoverPhotoIfSourceDeleted(caseData, photo.id);
    }

    return setCoverPhotoFromEvidencePhoto(caseData, photo);
}

async function clearCoverPhotoIfSourceDeleted(caseData, photoId) {
    if (!isCoverPhotoSource(caseData, photoId)) {
        return null;
    }

    const activeCase = caseData || currentCase();
    if (!activeCase || !activeCase.id) {
        return null;
    }

    await persistCoverPhoto(activeCase, null);
    emitCoverPhotoChanged();
    await renderPanel();
    return null;
}

async function removeCoverPhotoFromEvidence() {
    const caseData = currentCase();
    if (!caseData || !caseData.id) {
        return;
    }

    await persistCoverPhoto(caseData, null);
    emitCoverPhotoChanged();
    await renderPanel();
    notify("Foto removida da capa.");
}

async function removeCoverPhoto() {
    const caseData = currentCase();
    if (!caseData || !caseData.id) {
        return;
    }

    if (
        global.AuroraDialog &&
        typeof global.AuroraDialog.confirm === "function" &&
        !(await global.AuroraDialog.confirm(
            "A foto de capa será removida do relatório.",
            { title: "Remover foto de capa?", confirmLabel: "Remover", tone: "danger" }
        ))
    ) {
        return;
    }

    await persistCoverPhoto(caseData, null);
    emitCoverPhotoChanged();
    await renderPanel();
    notify("Foto de capa removida.");
}

function bindCoverPhotoFileInput(input) {
    if (!input) {
        return;
    }

    input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        input.value = "";
        setCoverPhotoFromFile(file).catch((error) => {
            console.error(error);
            notify("Não foi possível carregar a foto de capa.");
        });
    });
}

function setCoverPhotoSheetOpen(open, mode = "add") {
    if (!mountedHost) return;
    const sheet = mountedHost.querySelector("[data-cover-photo-sheet]");
    const title = mountedHost.querySelector("[data-cover-photo-sheet-title]");
    const removeButton = mountedHost.querySelector("[data-cover-photo-remove]");
    if (!sheet) return;
    if (title) title.textContent = mode === "manage" ? "Opções da foto de capa" : "Adicionar foto de capa";
    if (removeButton) removeButton.hidden = mode !== "manage";
    sheet.hidden = !open;
}

function bindPanelEvents() {
    if (!mountedHost) {
        return;
    }

    const addButton = mountedHost.querySelector("[data-cover-photo-add]");
    const manageButton = mountedHost.querySelector("[data-cover-photo-manage]");
    const removeButton = mountedHost.querySelector("[data-cover-photo-remove]");
    const cameraButton = mountedHost.querySelector("[data-cover-photo-camera]");
    const galleryButton = mountedHost.querySelector("[data-cover-photo-gallery]");
    const cameraInput = mountedHost.querySelector("[data-cover-photo-camera-input]");
    const galleryInput = mountedHost.querySelector("[data-cover-photo-gallery-input]");

    addButton && addButton.addEventListener("click", () => setCoverPhotoSheetOpen(true, "add"));
    manageButton && manageButton.addEventListener("click", () => setCoverPhotoSheetOpen(true, "manage"));
    mountedHost.querySelectorAll("[data-cover-photo-sheet-close]").forEach((node) => {
        node.addEventListener("click", () => setCoverPhotoSheetOpen(false));
    });
    cameraButton && cameraButton.addEventListener("click", () => {
        setCoverPhotoSheetOpen(false);
        cameraInput && cameraInput.click();
    });
    galleryButton && galleryButton.addEventListener("click", () => {
        setCoverPhotoSheetOpen(false);
        galleryInput && galleryInput.click();
    });
    removeButton && removeButton.addEventListener("click", () => {
        setCoverPhotoSheetOpen(false);
        removeCoverPhoto().catch(console.error);
    });

    bindCoverPhotoFileInput(cameraInput);
    bindCoverPhotoFileInput(galleryInput);
}

async function mountCoverPhotoPanel(host) {
    if (host.querySelector("[data-cover-photo-panel]")) {
        mountedHost = host;
        await renderPanel();
        return;
    }

    mountedHost = host;
    host.insertAdjacentHTML("afterbegin", panelHTML());
    bindPanelEvents();
    await renderPanel();
}

function findCoverPhotoHost() {
    const approvalHost = document.querySelector('[data-module="approval"]');
    if (approvalHost) {
        return approvalHost;
    }

    const caseData = currentCase();
    const serviceId =
        caseData &&
        caseData.service &&
        caseData.service.id
            ? String(caseData.service.id).toLowerCase()
            : "";

    if (serviceId === "vehicle_inspection") {
        return document.querySelector('[data-module="diagnostic"]');
    }

    return null;
}

async function hydrateRuntimeCoverPhoto() {
    const runtime = global.auroraRuntime;
    if (!runtime || typeof runtime.getCase !== "function") return;
    const activeCase = runtime.getCase() || {};
    if (!activeCase.id) return;

    const loaded = await loadStoredCoverPhoto(activeCase);
    if (!loaded || !loaded.src || !runtime.caseBinder ||
        typeof runtime.caseBinder.merge !== "function") return;

    const current = activeCase.coverPhoto || activeCase.cover_photo || null;
    const currentId = current && current.id ? String(current.id) : "";
    const loadedId = loaded.id ? String(loaded.id) : "";
    const currentSource = current && current.source_photo_id ? String(current.source_photo_id) : "";
    const loadedSource = loaded.source_photo_id ? String(loaded.source_photo_id) : "";
    if (currentId === loadedId && currentSource === loadedSource && current && current.has_photo) return;

    runtime.caseBinder.merge(
        { coverPhoto: { ...loaded, has_photo: true }, cover_photo: null },
        { source: "cover_photo_hydrate", controller_id: "evidence" }
    );
}

function hookRuntime() {
    if (runtimeHooked || !global.auroraRuntime) {
        return;
    }

    runtimeHooked = true;

    global.auroraRuntime.on("case_changed", () => {
        hydrateRuntimeCoverPhoto().then(() => renderPanel()).catch(console.error);
    });

    global.auroraRuntime.on("step_changed", () => {
        hydrateRuntimeCoverPhoto().catch(console.error);
        const host = findCoverPhotoHost();
        if (host) {
            mountCoverPhotoPanel(host).catch(console.error);
        }
    });
}

let lastHost = null;
const observer = new MutationObserver(() => {
    const host = findCoverPhotoHost();
    if (host && host !== lastHost) {
        lastHost = host;
        hookRuntime();
        mountCoverPhotoPanel(host).catch(console.error);
    } else if (!host && lastHost) {
        lastHost = null;
        mountedHost = null;
    }
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

setTimeout(() => {
    /*
     * A persistência da foto de capa não depende da existência do painel
     * visual de capa. Na revisão administrativa da Elétrica Tupy, a foto é
     * escolhida dentro do hub nativo de evidências e pode não existir um
     * [data-module="approval"] para disparar o hook.
     *
     * O hook precisa existir mesmo sem painel, para que case_changed/
     * step_changed hidrate a foto persistida quando o atendimento é
     * reaberto.
     */
    hookRuntime();

    const host = findCoverPhotoHost();
    if (host) {
        lastHost = host;
        mountCoverPhotoPanel(host).catch(console.error);
    }
}, 900);

global.AuroraCoverPhotoFeature = {
    coverPhotoStorageId,
    hydrateCoverPhoto,
    loadStoredCoverPhoto,
    persistCoverPhoto,
    removeCoverPhoto,
    removeCoverPhotoFromEvidence,
    setCoverPhotoFromEvidencePhoto,
    syncCoverPhotoFromEvidencePhoto,
    clearCoverPhotoIfSourceDeleted,
    resolveCoverPhotoSourceId,
    isCoverPhotoSource
};

console.log("AURORA COVER PHOTO FEATURE GLOBAL REPORT STANDARD");

})(window);

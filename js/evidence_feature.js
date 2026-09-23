(function (global) {
"use strict";

const store =
    new global.EvidenceStore();

let evidenceGroups = [];
let mountedHost = null;
let openGroupId = null;
let loadGroupsInFlight = null;
let evidencePersistInFlight = false;
const linkedPhotoOperations = new Map();

const AURORA_EVIDENCE_MOTION = {
    listExit: 120,
    savedHold: 620
};

function waitForEvidenceMotion(duration) {
    if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
        return Promise.resolve();
    }

    return new Promise(
        (resolve) => setTimeout(resolve, duration)
    );
}

async function transitionEvidenceView(action) {
    const hub = mountedHost?.querySelector(
        "[data-evidence-hub]"
    );

    if (hub) {
        hub.classList.add("is-view-leaving");
        await waitForEvidenceMotion(
            AURORA_EVIDENCE_MOTION.listExit
        );
    }

    action();
    renderGroups();

    const nextHub = mountedHost?.querySelector(
        "[data-evidence-hub]"
    );

    if (nextHub) {
        nextHub.classList.remove("is-view-leaving");
        nextHub.classList.add("is-view-entering");

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                nextHub.classList.remove("is-view-entering");
            });
        });
    }
}

function notify(message) {
    const status =
        document.getElementById(
            "app-status"
        );

    if (!status) return;

    status.textContent =
        message;
    status.classList.add(
        "is-visible"
    );

    clearTimeout(
        notify.timer
    );

    notify.timer =
        setTimeout(
            () => {
                status.classList.remove(
                    "is-visible"
                );
            },
            2200
        );
}

function currentCase() {
    return global.auroraRuntime
        ? global.auroraRuntime.getCase()
        : null;
}

function currentCaseId() {
    const caseData =
        currentCase();

    return (
        caseData &&
        caseData.id
            ? String(caseData.id)
            : "aurora-current-case"
    );
}

function uid(prefix) {
    return [
        prefix,
        Date.now(),
        Math.random()
            .toString(16)
            .slice(2)
    ].join("-");
}

function newEvidenceGroup() {
    return {
        id:
            uid("evidence-group"),
        record_type:
            "evidence_group",
        case_id:
            currentCaseId(),
        title:
            "",
        item:
            "",
        severity:
            "Média",
        description:
            "",
        recommendation:
            "",
        created_at:
            new Date().toISOString(),
        saved_at:
            null,
        photos:
            []
    };
}

function isGuidedVehiclePhoto(group) {
    return Boolean(
        group &&
        group.record_kind === "vehicle_guided_photo" &&
        group.vehicle_photo_slot
    );
}

function isLinkedPhotoOnlyGroup(group) {
    return Boolean(
        group &&
        group.presentation_mode === "photo_only" &&
        group.linked_entity_type &&
        group.linked_entity_id
    );
}

function isPhotoOnlyGroup(group) {
    return Boolean(
        isGuidedVehiclePhoto(group) ||
        isTupyVistoriaPhotoGroup(group) ||
        isLinkedPhotoOnlyGroup(group)
    );
}

function normalizeLinkedPhotoContract(options) {
    const contract = options && typeof options === "object" ? { ...options } : {};
    contract.presentation_mode = "photo_only";
    contract.linked_entity_type = String(contract.linked_entity_type || "").trim();
    contract.linked_entity_id = String(contract.linked_entity_id || "").trim();
    contract.linked_entity_key = String(contract.linked_entity_key || "").trim();

    if (!contract.linked_entity_type || !contract.linked_entity_id) {
        throw new Error("linked_entity_type e linked_entity_id obrigatorios.");
    }
    if (
        contract.linked_entity_key &&
        !/^[a-z][a-z0-9_]*$/i.test(contract.linked_entity_key)
    ) {
        throw new Error("linked_entity_key invalido.");
    }

    return contract;
}

function findLinkedPhotoOnlyGroup(options) {
    const contract = normalizeLinkedPhotoContract(options);
    return evidenceGroups.find((group) => {
        if (!group) return false;
        const canonicalMatch =
            isLinkedPhotoOnlyGroup(group) &&
            String(group.linked_entity_type || "") === contract.linked_entity_type &&
            String(group.linked_entity_id || "") === contract.linked_entity_id;
        const legacyMatch =
            contract.linked_entity_key &&
            Object.prototype.hasOwnProperty.call(group, contract.linked_entity_key) &&
            String(group[contract.linked_entity_key] || "") === contract.linked_entity_id;
        return canonicalMatch || legacyMatch;
    }) || null;
}

function notifyLinkedPhotoChanged(group, action) {
    if (!isLinkedPhotoOnlyGroup(group)) return;
    global.dispatchEvent(
        new CustomEvent("aurora:linked-photo-changed", {
            detail: {
                action: action || "changed",
                group_id: group.id,
                linked_entity_type: group.linked_entity_type,
                linked_entity_id: group.linked_entity_id,
                photo_count: Array.isArray(group.photos) ? group.photos.length : 0
            }
        })
    );
}

function isTupyManagedPhotoGroup(group) {
    if (!group) return false;
    if (group.record_kind === "tupy_phase_photo" || group.record_kind === "tupy_final_work") {
        return true;
    }
    const title = String(group.title || group.item || "").trim().toLowerCase();
    return title.indexOf("antes do serviço") !== -1 ||
        title.indexOf("antes do servico") !== -1 ||
        title.indexOf("durante o serviço") !== -1 ||
        title.indexOf("durante o servico") !== -1 ||
        title.indexOf("após o serviço") !== -1 ||
        title.indexOf("apos o servico") !== -1 ||
        title.indexOf("depois") !== -1 ||
        title.indexOf("trabalho finalizado") !== -1 ||
        title.indexOf("foto do trabalho finalizado") !== -1;
}

function isEletricaTupyService() {
    try {
        const rt = global.auroraRuntime;
        const caseData = rt && typeof rt.getCase === "function" ? rt.getCase() : null;
        return String(caseData && caseData.service && caseData.service.id || "").toLowerCase() === "eletrica_tupy";
    } catch (error) {
        return false;
    }
}

function isEletricaTupyAdminReview() {
    const caseData = currentCase();
    return Boolean(
        isEletricaTupyService() &&
        ((caseData && caseData.admin_review === true) ||
         global.__AURORA_TUPY_CANONICAL_EVIDENCE_UI__ === true)
    );
}

function shouldHideFromOccurrenceHub(group) {
    if (isLinkedPhotoOnlyGroup(group)) return true;
    if (!isEletricaTupyService()) return false;
    if (isEletricaTupyAdminReview()) return false;
    if (!isTupyManagedPhotoGroup(group)) return false;
    if (isTupyAntesPhotoGroup(group)) return false;
    return true;
}

function isTupyAntesPhotoGroup(group) {
    if (!group) return false;
    if (String(group.tupy_photo_slot || "").trim() === "antes") return true;
    const title = String(group.title || group.item || "").trim().toLowerCase();
    return title.indexOf("antes do serviço") !== -1 ||
        title.indexOf("antes do servico") !== -1 ||
        title === "antes";
}

function groupHasPersistedPhoto(group) {
    const photos = group && Array.isArray(group.photos) ? group.photos : [];
    if (!photos.length) return false;
    return photos.some(
        (photo) =>
            photo &&
            (photo.has_photo === true ||
                photo.src ||
                photo.edited_src ||
                photo.object_url ||
                photo.url ||
                photo.blob ||
                photo.id)
    );
}

function hasTupyAntesPhotoUnlocked() {
    if (!isEletricaTupyService()) return true;
    return evidenceGroups.some(
        (group) => isTupyAntesPhotoGroup(group) && groupHasPersistedPhoto(group)
    );
}

function isTupyManagedPhotoCreation(options) {
    if (!options || typeof options !== "object") return false;
    if (options.record_kind === "tupy_phase_photo" || options.record_kind === "tupy_final_work") {
        return true;
    }
    const slot = String(options.tupy_photo_slot || "").trim();
    return slot === "antes" || slot === "durante" || slot === "depois" || slot === "finalizado";
}

function isTupyVistoriaPhotoGroup(group) {
    return isEletricaTupyService() &&
        !isEletricaTupyAdminReview() &&
        isTupyAntesPhotoGroup(group);
}

function canCreateOccurrenceNow() {
    if (!isEletricaTupyService()) return true;
    if (isEletricaTupyAdminReview()) return true;
    if (global.AuroraEletricaTupy && typeof global.AuroraEletricaTupy.canCreateOccurrences === "function") {
        return global.AuroraEletricaTupy.canCreateOccurrences();
    }
    return hasTupyAntesPhotoUnlocked();
}

function notifyEvidenceGroupsChanged(detail) {
    global.dispatchEvent(
        new CustomEvent("aurora:evidence-groups-changed", {
            detail: detail || {}
        })
    );
    syncTupyUserVistoriaHubVisibility();
}

function isUserBoltVistoriaEvidenceMode() {
    var aet = global.AuroraEletricaTupy;
    var runtime = global.auroraRuntime;
    var caseObj =
        runtime && typeof runtime.getCase === "function"
            ? runtime.getCase()
            : null;
    return Boolean(
        aet &&
        typeof aet.isUserBoltVistoriaFlow === "function" &&
        aet.isUserBoltVistoriaFlow(caseObj)
    );
}

function syncTupyUserVistoriaHubVisibility() {
    var aet = global.AuroraEletricaTupy;
    if (!aet || typeof aet.updateTupyEvidenceHubVisibility !== "function") {
        return;
    }
    var root =
        mountedHost &&
        mountedHost.closest
            ? mountedHost.closest('[data-module="evidence"]')
            : null;
    aet.updateTupyEvidenceHubVisibility(root || mountedHost);
}

function groupHasRenderablePhoto(group) {
    return Boolean(
        group &&
        Array.isArray(group.photos) &&
        group.photos.some(
            (photo) =>
                photo &&
                (photo.src ||
                    photo.edited_src ||
                    photo.has_photo)
        )
    );
}

function findGuidedGroupBySlot(slot) {
    if (!slot) {
        return null;
    }

    const inMemory = evidenceGroups.find(
        (group) =>
            isGuidedVehiclePhoto(group) &&
            group.vehicle_photo_slot === slot
    );

    if (inMemory) {
        return inMemory;
    }

    const caseData = currentCase();
    const references = Array.isArray(caseData && caseData.evidence_groups)
        ? caseData.evidence_groups
        : [];

    return (
        references.find(
            (group) =>
                isGuidedVehiclePhoto(group) &&
                group.vehicle_photo_slot === slot
        ) || null
    );
}

function legacyOccurrencesFromGroups(groups) {
    if (
        global.AuroraCloudSync &&
        typeof global.AuroraCloudSync.legacyOccurrencesFromEvidenceGroups ===
            "function"
    ) {
        return global.AuroraCloudSync.legacyOccurrencesFromEvidenceGroups(
            groups
        );
    }

    return (Array.isArray(groups) ? groups : []).map(
        (group, index) => ({
            id: group.id,
            title: group.title || "",
            item: group.item || "",
            severity: group.severity || "",
            description: group.description || "",
            recommendation: group.recommendation || "",
            record_kind: group.record_kind || null,
            vehicle_photo_slot: group.vehicle_photo_slot || null,
            type:
                group.record_kind === "vehicle_guided_photo"
                    ? "vehicle_guided_photo"
                    : "occurrence",
            position: index
        })
    );
}

function preserveLinkedOwnerOccurrences(groups, occurrences) {
    const linkedEntityIds = new Set(
        (Array.isArray(groups) ? groups : [])
            .filter(isLinkedPhotoOnlyGroup)
            .map((group) => String(group.linked_entity_id || ""))
            .filter(Boolean)
    );
    const result = Array.isArray(occurrences) ? occurrences.slice() : [];
    const seen = new Set(result.map((occurrence) => String(occurrence && occurrence.id || "")));
    const caseData = currentCase();
    const owners = caseData && Array.isArray(caseData.occurrences)
        ? caseData.occurrences
        : [];

    owners.forEach((occurrence) => {
        const id = String(occurrence && occurrence.id || "");
        if (id && linkedEntityIds.has(id) && !seen.has(id)) {
            result.push(occurrence);
            seen.add(id);
        }
    });

    return result;
}

async function createEvidenceGroup(options) {
    const openGroup = openGroupId ? getGroup(openGroupId) : null;

    /*
     * Fotos guiadas e avarias são fluxos diferentes. Uma foto guiada pode
     * permanecer aberta para conferência/edição, mas nunca deve capturar o
     * próximo clique em "Avarias" (ou em outra vista do veículo).
     */
    if (isGuidedVehiclePhoto(openGroup)) {
        if (Array.isArray(openGroup.photos) && openGroup.photos.length) {
            openGroup.saved_at = openGroup.saved_at || new Date().toISOString();
            await saveGroup(openGroup);
        } else {
            await store.remove(openGroup.id);
            evidenceGroups = evidenceGroups.filter((group) => group.id !== openGroup.id);
            await persistToCase();
        }
        openGroupId = null;
    }

    if (
        isEletricaTupyService() &&
        !isTupyManagedPhotoCreation(options) &&
        !canCreateOccurrenceNow()
    ) {
        notify(
            "Adicione a primeira foto da vistoria para continuar."
        );
        renderGroups();
        return { group: null, created: false, blocked: true };
    }

    if (
        isEletricaTupyService() &&
        !isTupyManagedPhotoCreation(options)
    ) {
        return openOrCreateTupyAntesGroup();
    }

    const pendingTechnicalGroup = evidenceGroups.find(
        (group) =>
            !group.saved_at &&
            !isGuidedVehiclePhoto(group) &&
            !isLinkedPhotoOnlyGroup(group)
    );

    if (openGroupId || pendingTechnicalGroup) {
        openGroupId = openGroupId || pendingTechnicalGroup.id;
        renderGroups();
        return { group: pendingTechnicalGroup || getGroup(openGroupId), created: false };
    }

    const guidedSlot =
        options &&
        options.vehicle_photo_slot
            ? String(options.vehicle_photo_slot)
            : "";

    if (guidedSlot) {
        const existingGuided = findGuidedGroupBySlot(guidedSlot);

        if (existingGuided) {
            let liveGroup = getGroup(existingGuided.id);

            if (!liveGroup) {
                if (
                    !evidenceGroups.some(
                        (entry) =>
                            entry.id === existingGuided.id
                    )
                ) {
                    evidenceGroups.push(existingGuided);
                }
                liveGroup =
                    getGroup(existingGuided.id) ||
                    existingGuided;
            }

            Object.assign(liveGroup, options || {});
            await saveGroup(liveGroup);
            renderGroups();
            return { group: liveGroup, created: false };
        }
    }

    const group = Object.assign(newEvidenceGroup(), options || {});
    evidenceGroups.push(group);
    if (!isGuidedVehiclePhoto(group)) {
        openGroupId = group.id;
    }
    await saveGroup(group);
    renderGroups();
    return { group, created: true };
}

async function openEvidenceGroup(groupId, patch) {
    const group = getGroup(groupId);
    if (!group) return false;
    if (patch && typeof patch === "object") {
        Object.assign(group, patch);
        await saveGroup(group);
    }
    await transitionEvidenceView(() => {
        openGroupId = group.id;
    });
    return true;
}

async function openOrCreateTupyAntesGroup() {
    let existing = evidenceGroups.find((group) => isTupyAntesPhotoGroup(group));

    if (!existing) {
        const caseData = currentCase();
        const references = Array.isArray(caseData && caseData.evidence_groups)
            ? caseData.evidence_groups
            : [];
        existing = references.find((group) => isTupyAntesPhotoGroup(group));
    }

    if (existing) {
        let liveGroup = getGroup(existing.id);
        if (!liveGroup) {
            await loadGroups();
            liveGroup = getGroup(existing.id);
        }
        if (liveGroup) {
            await openEvidenceGroup(liveGroup.id);
            return { group: liveGroup, created: false };
        }
    }

    return createEvidenceGroup({
        title: "Antes do serviço",
        item: "Antes do serviço",
        description: "Registro fotográfico Elétrica Tupy (antes).",
        severity: "Sem gravidade",
        record_kind: "tupy_phase_photo",
        tupy_photo_slot: "antes"
    });
}

function panelHTML() {
    const isTupyUserFlow =
        isEletricaTupyService() &&
        !isEletricaTupyAdminReview();

    if (isTupyUserFlow) {
        return [
            '<section class="aurora-evidence-hub aet-vistoria-hub" data-evidence-hub>',
            '<div class="aurora-evidence-group-list" data-evidence-group-list></div>',
            "</section>"
        ].join("");
    }

    return [
        '<section class="aurora-evidence-hub" data-evidence-hub>',
        '<header class="aurora-evidence-hub__header">',
        '<div>',
        '<h2>Ocorrências</h2>',
        '<p>Registre cada ocorrência com fotos, observações, recomendações e marcações necessárias.</p>',
        '</div>',
        '<div class="aurora-evidence-hub__counter">',
        '<strong data-evidence-count>0</strong>',
        '<span>registros</span>',
        '</div>',
        '</header>',
        '<div class="aurora-evidence-group-list" data-evidence-group-list></div>',
        '<button type="button" class="aurora-add-evidence-group" data-add-evidence-group>＋ Novo registro</button>',
        '</section>'
    ].join("");
}

function hideLegacyEvidenceUI(host) {
    /*
     * Remove a interface antiga do módulo, incluindo o botão
     * "Adicionar evidência" que existia antes do Evidence Hub.
     */
    Array.from(
        host.querySelectorAll(
            "button,a,label"
        )
    ).forEach(
        (element) => {
            if (
                element.closest(
                    "[data-evidence-hub]"
                )
            ) {
                return;
            }

            const text =
                String(
                    element.textContent || ""
                )
                    .trim()
                    .toLowerCase();

            if (
                text ===
                    "adicionar evidência" ||
                text ===
                    "+ adicionar evidência"
            ) {
                element.classList.add(
                    "aurora-evidence-legacy-hidden"
                );

                element.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        }
    );

    Array.from(
        host.children
    ).forEach(
        (child) => {
            if (
                child.hasAttribute(
                    "data-evidence-hub"
                )
            ) {
                return;
            }

            const containsLegacyButton =
                Array.from(
                    child.querySelectorAll(
                        "button,a,label"
                    )
                ).some(
                    (element) => {
                        const text =
                            String(
                                element.textContent || ""
                            )
                                .trim()
                                .toLowerCase();

                        return (
                            text ===
                                "adicionar evidência" ||
                            text ===
                                "+ adicionar evidência"
                        );
                    }
                );

            if (
                containsLegacyButton
            ) {
                child.classList.add(
                    "aurora-evidence-legacy-hidden"
                );
            }
        }
    );
}

function dedupeEvidenceGroupsById(groups) {
    /*
     * Caminho VIVO (buildEvidencePatch / loadGroups / persistToCase):
     * deduplicar somente por id, preservando record_kind, slot, saved_at
     * e refs leves de foto.
     *
     * NÃO usar AuroraCloudSync.dedupeEvidenceGroupRefs / lightEvidenceRef
     * aqui: essa normalização de hidratação Cloud infere slot pelo texto
     * (ex.: item "Frente") e pode reclassificar ocorrência técnica como
     * vehicle_guided_photo ou descartá-la por slot duplicado.
     */
    const output = [];
    const idSeen = new Set();

    (Array.isArray(groups) ? groups : []).forEach((group) => {
        if (!group || !group.id || idSeen.has(group.id)) {
            return;
        }

        idSeen.add(group.id);
        output.push(group);
    });

    return output;
}

async function loadGroups() {
    if (loadGroupsInFlight) {
        return loadGroupsInFlight;
    }

    loadGroupsInFlight = (async () => {
        const caseData =
            currentCase();
        const previousGroups =
            evidenceGroups.slice();

        const referencedGroups =
            dedupeEvidenceGroupsById(
                caseData &&
                Array.isArray(
                    caseData.evidence_groups
                )
                    ? caseData.evidence_groups
                    : []
            );

        const loadedGroups = [];
        const idSeen = new Set();

        for (
            const reference of
            referencedGroups
        ) {
            if (
                !reference ||
                !reference.id ||
                idSeen.has(reference.id)
            ) {
                continue;
            }

            let storedGroup =
                null;
            const memoryGroup =
                previousGroups.find(
                    (group) =>
                        group &&
                        group.id === reference.id
                ) || null;

            try {
                storedGroup =
                    await store.get(
                        reference.id
                    );
            } catch (error) {
                console.warn(
                    "Não foi possível carregar a ocorrência salva.",
                    error
                );
            }

            let group =
                storedGroup ||
                memoryGroup ||
                reference;

            if (
                memoryGroup &&
                groupHasRenderablePhoto(memoryGroup) &&
                !groupHasRenderablePhoto(group)
            ) {
                group = memoryGroup;
            }

            if (
                String(
                    group.case_id ||
                    currentCaseId()
                ) !==
                String(
                    currentCaseId()
                )
            ) {
                continue;
            }

            idSeen.add(group.id);
            loadedGroups.push(
                group
            );
        }

        evidenceGroups = loadedGroups;

        const unfinished =
            evidenceGroups.find(
                (group) =>
                    !group.saved_at &&
                    !isGuidedVehiclePhoto(group) &&
                    !isLinkedPhotoOnlyGroup(group)
            );

        openGroupId =
            unfinished
                ? unfinished.id
                : null;
    })();

    try {
        return await loadGroupsInFlight;
    } finally {
        loadGroupsInFlight = null;
    }
}

async function reloadEvidenceForCurrentCase() {
    await loadGroups();
    renderGroups();
    global.dispatchEvent(
        new CustomEvent("aurora:guided-photos-changed")
    );
}

async function saveGroup(group) {
    await store.save(
        group
    );

    await persistToCase();
}

function captureBugARuntimeTrace(key, groups, options) {
    if (
        global.AuroraBugARuntimeTrace &&
        typeof global.AuroraBugARuntimeTrace.capture ===
            "function"
    ) {
        global.AuroraBugARuntimeTrace.capture(
            key,
            groups,
            options || {}
        );
    }
}

function captureFinalizeTrace(step, options) {
    if (
        global.AuroraBugARuntimeTrace &&
        typeof global.AuroraBugARuntimeTrace.captureFinalize ===
            "function"
    ) {
        global.AuroraBugARuntimeTrace.captureFinalize(
            step,
            options || {}
        );
    }
}

function buildEvidencePatch() {
    /*
     * O estado central do atendimento precisa apenas das referências das
     * evidências. As imagens completas já estão no EvidenceStore/IndexedDB.
     * Manter Base64 aqui fazia o CaseBinder clonar todas as fotos várias
     * vezes e podia reiniciar o WebView ao concluir as últimas evidências.
     */
    const groups = dedupeEvidenceGroupsById(
        evidenceGroups.map((group) => ({
            ...group,
            photos: Array.isArray(group.photos)
                ? group.photos.map((photo) => ({
                    id: photo.id || null,
                    title: photo.title || "",
                    description: photo.description || "",
                    category: photo.category || "general",
                    created_at: photo.created_at || null,
                    has_photo: Boolean(photo.src || photo.edited_src)
                }))
                : []
        }))
    );

    const evidences =
        groups.flatMap(
            (group) =>
                (group.photos || []).map(
                    (photo, index) => ({
                        id:
                            photo.id,
                        title:
                            photo.title ||
                            `${group.title || "Ocorrência"} — Foto ${index + 1}`,
                        description:
                            photo.description ||
                            group.description ||
                            "",
                        category:
                            photo.category ||
                            "general",
                        occurrence_id:
                            group.id,
                        occurrence_title:
                            group.title ||
                            "",
                        occurrence_item:
                            group.item ||
                            "",
                        occurrence_severity:
                            group.severity ||
                            "",
                        occurrence_recommendation:
                            group.recommendation ||
                            "",
                        created_at:
                            photo.created_at,
                        /* A imagem completa permanece no evidence_groups e
                         * no IndexedDB. Esta lista é somente um índice legado. */
                        src:
                            null
                    })
                )
        );

    const occurrenceGroups = groups.filter(
        (group) => !isLinkedPhotoOnlyGroup(group)
    );
    const occurrences = preserveLinkedOwnerOccurrences(
        groups,
        legacyOccurrencesFromGroups(occurrenceGroups)
    );

    const patch = {
        evidence_groups:
            groups,
        evidences,
        occurrences
    };

    captureBugARuntimeTrace(
        "B",
        patch.evidence_groups,
        {
            note: "buildEvidencePatch()"
        }
    );

    return patch;
}

async function persistToCase() {
    if (loadGroupsInFlight) {
        await loadGroupsInFlight;
    }

    const patch =
        buildEvidencePatch();

    const runtime =
        global.auroraRuntime;

    /*
     * CORREÇÃO RC2.2.1
     *
     * runtime.getCase() devolve uma cópia protegida. Alterar essa cópia
     * não modifica o CaseBinder. Por isso as ocorrências desapareciam ao
     * mudar de etapa.
     *
     * Agora o patch é gravado diretamente no estado oficial do Runtime.
     */
    let mergedIntoRuntime = false;

    if (
        runtime &&
        runtime.caseBinder &&
        typeof runtime.caseBinder.merge ===
            "function"
    ) {
        evidencePersistInFlight = true;

        try {
            runtime.caseBinder.merge(
                patch,
                {
                    source:
                        "evidence_feature",
                    controller_id:
                        "evidence"
                }
            );
            mergedIntoRuntime = true;

            captureBugARuntimeTrace(
                "C",
                runtime.getCase &&
                    typeof runtime.getCase === "function"
                    ? runtime.getCase().evidence_groups
                    : [],
                {
                    note:
                        "after caseBinder.merge in persistToCase"
                }
            );
        } finally {
            evidencePersistInFlight = false;
        }
    }

    if (
        !mergedIntoRuntime &&
        global.auroraRepository &&
        typeof global.auroraRepository.save ===
            "function"
    ) {
        const current =
            runtime &&
            typeof runtime.getCase === "function"
                ? runtime.getCase()
                : {
                    ...currentCase(),
                    ...patch
                };

        global.auroraRepository.save(
            current
        );
    }

    global.dispatchEvent(
        new CustomEvent("aurora:guided-photos-changed")
    );
    notifyEvidenceGroupsChanged({ source: "persistToCase" });

    return patch;
}

function getActiveCoverPhotoSourceId() {
    const feature = global.AuroraCoverPhotoFeature;
    const caseData = currentCase();

    if (
        feature &&
        typeof feature.resolveCoverPhotoSourceId === "function"
    ) {
        return feature.resolveCoverPhotoSourceId(caseData);
    }

    const reference =
        caseData &&
        caseData.coverPhoto;

    return reference &&
        reference.source_photo_id
        ? String(reference.source_photo_id)
        : null;
}

function renderPhotoCoverControl(groupId, photo, isCoverSource) {
    if (isCoverSource) {
        return [
            '<button type="button" class="is-subtle is-cover-active" ',
            `data-cover-photo-action="remove" data-cover-photo-group="${groupId}" data-photo-id="${photo.id}">`,
            "Remover da capa",
            "</button>"
        ].join("");
    }

    return [
        '<button type="button" class="is-subtle" ',
        `data-cover-photo-action="set" data-cover-photo-group="${groupId}" data-photo-id="${photo.id}">`,
        "Usar como foto de capa",
        "</button>"
    ].join("");
}

const editor =
    typeof global.PhotoEditor === "function"
        ? new global.PhotoEditor({
        onSave:
            async (updatedPhoto) => {
                for (
                    const group of
                    evidenceGroups
                ) {
                    const index =
                        group.photos.findIndex(
                            (photo) =>
                                photo.id ===
                                updatedPhoto.id
                        );

                    if (index >= 0) {
                        group.photos[index] =
                            updatedPhoto;

                        await saveGroup(
                            group
                        );

                        if (
                            global.AuroraCoverPhotoFeature &&
                            typeof global.AuroraCoverPhotoFeature.syncCoverPhotoFromEvidencePhoto ===
                                "function"
                        ) {
                            await global.AuroraCoverPhotoFeature.syncCoverPhotoFromEvidencePhoto(
                                updatedPhoto
                            );
                        }

                        renderGroups();

                        notify(
                            "Foto atualizada."
                        );

                        notifyLinkedPhotoChanged(
                            group,
                            "edited"
                        );

                        return;
                    }
                }
            }
        })
        : null;;

function renderGroups() {
    if (!mountedHost) return;

    const isEditing = Boolean(openGroupId);
    const hub =
        mountedHost.querySelector(
            "[data-evidence-hub]"
        );

    if (hub) {
        hub.classList.toggle(
            "is-editing",
            isEditing
        );
    }

    document.body.classList.toggle(
        "aurora-evidence-editing",
        isEditing
    );

    const openGroup = openGroupId ? getGroup(openGroupId) : null;
    const occurrenceGroups = evidenceGroups.filter(
        (group) => !isGuidedVehiclePhoto(group) && !shouldHideFromOccurrenceHub(group)
    );
    const visibleGroups = isPhotoOnlyGroup(openGroup)
        ? [openGroup]
        : occurrenceGroups;

    const evidenceCountEl = mountedHost.querySelector(
        "[data-evidence-count]"
    );
    if (evidenceCountEl) {
        evidenceCountEl.textContent = occurrenceGroups.length;
    }

    const createButton =
        mountedHost.querySelector(
            "[data-add-evidence-group]"
        );

    const tupyOccurrenceLocked =
        isEletricaTupyService() && !canCreateOccurrenceNow();

    if (createButton) {
        createButton.disabled =
            isEditing || tupyOccurrenceLocked;

        createButton.setAttribute(
            "aria-disabled",
            String(
                isEditing || tupyOccurrenceLocked
            )
        );

        createButton.setAttribute(
            "aria-hidden",
            String(isEditing)
        );

        createButton.title =
            tupyOccurrenceLocked
                ? "Adicione a primeira foto da vistoria para continuar."
                : openGroupId
                    ? "Finalize o registro atual antes de adicionar outra foto."
                    : "Novo registro";
    }

    const list =
        mountedHost.querySelector(
            "[data-evidence-group-list]"
        );

    if (!visibleGroups.length) {
        list.innerHTML = [
            '<div class="aurora-evidence-empty">',
            '<span>▧</span>',
            '<strong>Nenhuma ocorrência criada</strong>',
            '<p>Use o botão abaixo para registrar a primeira ocorrência.</p>',
            '</div>'
        ].join("");

        syncTupyUserVistoriaHubVisibility();
        return;
    }

    const coverPhotoSourceId =
        getActiveCoverPhotoSourceId();

    list.innerHTML =
        visibleGroups.map(
            (group, groupIndex) => {
                const isOpen =
                    openGroupId ===
                    group.id;

                /*
                 * Um registro aberto funciona como uma tela de trabalho
                 * focada. Os demais registros ficam temporariamente fora
                 * da interface ate a finalizacao do registro atual.
                 */
                if (
                    openGroupId &&
                    !isOpen
                ) {
                    return "";
                }

                if (!isOpen) {
                    const vistoriaSummary = isTupyVistoriaPhotoGroup(group);
                    const summaryTitle = vistoriaSummary ? "Foto da vistoria" : group.title;
                    const summaryItem = vistoriaSummary ? "Vistoria em campo" : (group.item || "Item não informado");
                    return [
                        '<article class="aurora-evidence-summary">',
                        '<button type="button" class="aurora-evidence-summary__main" data-open-evidence-group="',
                        group.id,
                        '">',
                        '<span class="aurora-evidence-summary__number">',
                        groupIndex + 1,
                        '</span>',
                        '<span class="aurora-evidence-summary__content">',
                        `<strong>${escapeHTML(summaryTitle)}</strong>`,
                        `<small>${escapeHTML(summaryItem)} · ${escapeHTML(group.severity)} · ${isGuidedVehiclePhoto(group) ? Math.min(group.photos.length, 1) : group.photos.length} foto(s)</small>`,
                        '</span>',
                        '<span class="aurora-evidence-summary__arrow">›</span>',
                        '</button>',
                        `<button type="button" class="aurora-evidence-summary__delete" data-delete-evidence-group="${group.id}" aria-label="Excluir" title="Excluir">×</button>`,
                        '</article>'
                    ].join("");
                }

                const guidedPhoto = isGuidedVehiclePhoto(group);
                const vistoriaPhoto = isTupyVistoriaPhotoGroup(group);
                const linkedPhotoOnly = isLinkedPhotoOnlyGroup(group);
                const photoOnlyGroup = isPhotoOnlyGroup(group);

                return [
                    '<article class="aurora-evidence-group is-open',
                    guidedPhoto ? ' is-guided-vehicle-photo' : '',
                    vistoriaPhoto ? ' is-tupy-vistoria-photo' : '',
                    '" data-evidence-group="',
                    group.id,
                    '">',
                    '<header class="aurora-evidence-group__header">',
                    '<div>',
                    `<span>${vistoriaPhoto ? "Vistoria" : "Evidência"} ${groupIndex + 1}</span>`,
                    `<h3>${escapeHTML(vistoriaPhoto ? "Fotos da vistoria" : group.title)}</h3>`,
                    `<span class="aurora-evidence-photo-count" aria-label="${photoOnlyGroup ? group.photos.length : group.photos.length} fotos">📷 ${group.photos.length}</span>`,
                    '</div>',
                    '</header>',

                    photoOnlyGroup ? '' : '<div class="aurora-evidence-group__form">',
                    photoOnlyGroup ? '' :
                    '<label><span>Título da ocorrência</span>',
                    photoOnlyGroup ? '' :
                    `<input type="text" value="${escapeAttribute(group.title)}" data-group-field="${group.id}" data-field-name="title"></label>`,

                    photoOnlyGroup ? '' :
                    '<label><span>Item inspecionado</span>',
                    photoOnlyGroup ? '' :
                    `<input type="text" value="${escapeAttribute(group.item || "")}" data-group-field="${group.id}" data-field-name="item"></label>`,

                    photoOnlyGroup ? '' :
                    '<label><span>Gravidade</span>',
                    photoOnlyGroup ? '' :
                    `<select data-group-field="${group.id}" data-field-name="severity">`,
                    photoOnlyGroup ? '' :
                    ["Sem gravidade — não exibir no relatório","Baixa","Média","Alta","Crítica"].map(
                        (value) =>
                            `<option value="${value}" ${group.severity === value ? "selected" : ""}>${value}</option>`
                    ).join(""),
                    photoOnlyGroup ? '' : '</select></label>',

                    photoOnlyGroup ? '' :
                    '<label class="is-wide"><span>Descrição</span>',
                    photoOnlyGroup ? '' :
                    `<textarea placeholder="Descreva a condição ou não conformidade encontrada." data-group-field="${group.id}" data-field-name="description">${escapeHTML(group.description || "")}</textarea></label>`,

                    photoOnlyGroup ? '' :
                    '<label class="is-wide"><span>Recomendação</span>',
                    photoOnlyGroup ? '' :
                    `<textarea placeholder="Informe a ação recomendada ou o acompanhamento necessário." data-group-field="${group.id}" data-field-name="recommendation">${escapeHTML(group.recommendation || "")}</textarea></label>`,
                    photoOnlyGroup ? '' : '</div>',

                    '<div class="aurora-evidence-group__photo-actions aurora-evidence-group__photo-actions--single">',
                    vistoriaPhoto ? '<label class="aurora-evidence-add-photo">' : '',
                    vistoriaPhoto ? `<input type="file" accept="image/*" data-group-add-photo="${group.id}">` : '',
                    vistoriaPhoto ? '<span>📷 Adicionar foto</span></label>' : '',
                    vistoriaPhoto ? '' : `<button type="button" class="aurora-evidence-add-photo" data-group-photo-chooser="${group.id}"><span>📷 Adicionar foto</span></button>`,
                    vistoriaPhoto ? '' : `<input type="file" accept="image/*" capture="environment" data-group-add-photo="${group.id}" data-photo-source="camera" hidden>`,
                    vistoriaPhoto ? '' : `<input type="file" accept="image/*" ${guidedPhoto ? '' : 'multiple '}data-group-add-photo="${group.id}" data-photo-source="gallery" hidden>`,
                    '</div>',

                    '<div class="aurora-evidence-photo-grid">',
                    group.photos.length
                        ? (guidedPhoto ? group.photos.slice(0, 1) : group.photos).map(
                            (photo, photoIndex) => {
                                const isCoverSource =
                                    coverPhotoSourceId ===
                                    String(photo.id);

                                return [
                                '<article class="aurora-evidence-photo',
                                isCoverSource
                                    ? " is-cover-photo"
                                    : "",
                                '">',
                                '<div class="aurora-evidence-photo__image">',
                                `<img src="${photo.edited_src || photo.src}" alt="${escapeAttribute(photo.title || `Foto ${photoIndex + 1}`)}">`,
                                `<span>${photoIndex + 1}</span>`,
                                isCoverSource
                                    ? '<span class="aurora-evidence-photo__cover-badge">Foto de capa</span>'
                                    : "",
                                '</div>',
                                '<div class="aurora-evidence-photo__body">',
                                `<strong class="aurora-evidence-photo__label">Evidência fotográfica ${photoIndex + 1}</strong>`,
                                guidedPhoto ? '' : `<textarea placeholder="Observação da foto (opcional)" data-photo-description="${group.id}" data-photo-id="${photo.id}">${escapeHTML(photo.description || "")}</textarea>`,
                                '<div>',
                                `<button type="button" data-edit-photo="${group.id}" data-photo-id="${photo.id}">✎ Editar</button>`,
                                `<button type="button" class="is-danger" data-delete-photo="${group.id}" data-photo-id="${photo.id}">Excluir foto</button>`,
                                '</div>',
                                renderPhotoCoverControl(
                                    group.id,
                                    photo,
                                    isCoverSource
                                ),
                                '</div>',
                                '</article>'
                            ].join("");
                            }
                        ).join("")
                        : '<div class="aurora-evidence-photo-empty">Nenhuma foto adicionada nesta evidência.</div>',
                    '</div>',

                    '<footer class="aurora-evidence-group__footer">',
                    linkedPhotoOnly ? '' : `<button type="button" class="is-danger is-subtle" data-delete-evidence-group="${group.id}">🗑 Excluir</button>`,
                    (function () {
                        if (linkedPhotoOnly) {
                            return `<button type="button" class="is-secondary" data-close-photo-only-group="${group.id}">Fechar</button>`;
                        }
                        try {
                            const rt = global.auroraRuntime;
                            const cse = rt && typeof rt.getCase === "function" ? rt.getCase() : null;
                            const sid = String((cse && cse.service && cse.service.id) || "").toLowerCase();
                            if (sid === "eletrica_tupy") {
                                return [
                                    `<button type="button" class="is-secondary" data-cancel-evidence-group="${group.id}">Fechar</button>`,
                                    `<button type="button" class="is-primary" data-save-evidence-group="${group.id}">${guidedPhoto ? "Concluir foto" : "Salvar"}</button>`
                                ].join("");
                            }
                        } catch (error) { /* ignore */ }
                        return [
                            `<button type="button" class="is-secondary" data-cancel-evidence-group="${group.id}">Fechar</button>`,
                            `<button type="button" class="is-primary" data-save-evidence-group="${group.id}">${guidedPhoto ? "Concluir foto" : "Finalizar ocorrência"}</button>`
                        ].join("");
                    })(),
                    '</footer>',
                    '</article>'
                ].join("");
            }
        ).join("");

    syncTupyUserVistoriaHubVisibility();
    bindActions();
}

function syncOpenGroupFromDOM() {
    if (
        !mountedHost ||
        !openGroupId
    ) {
        return null;
    }

    const group =
        getGroup(
            openGroupId
        );

    if (!group) {
        return null;
    }

    mountedHost
        .querySelectorAll(
            `[data-group-field="${openGroupId}"]`
        )
        .forEach(
            (field) => {
                group[
                    field.dataset.fieldName
                ] =
                    field.value;
            }
        );

    mountedHost
        .querySelectorAll(
            `[data-photo-title="${openGroupId}"],` +
            `[data-photo-category="${openGroupId}"],` +
            `[data-photo-description="${openGroupId}"]`
        )
        .forEach(
            (field) => {
                const photo =
                    group.photos.find(
                        (item) =>
                            item.id ===
                            field.dataset.photoId
                    );

                if (!photo) {
                    return;
                }

                if (
                    field.hasAttribute(
                        "data-photo-title"
                    )
                ) {
                    photo.title =
                        field.value.trim();
                }

                if (
                    field.hasAttribute(
                        "data-photo-category"
                    )
                ) {
                    photo.category =
                        field.value;
                }

                if (
                    field.hasAttribute(
                        "data-photo-description"
                    )
                ) {
                    photo.description =
                        field.value.trim();
                }
            }
        );

    return group;
}

async function finalizeTupyVistoriaForNavigation() {
    if (!isEletricaTupyService()) return;

    if (openGroupId) {
        const openGroup = getGroup(openGroupId);
        if (openGroup && isTupyVistoriaPhotoGroup(openGroup)) {
            syncOpenGroupFromDOM();
            if (groupHasPersistedPhoto(openGroup)) {
                openGroup.saved_at = openGroup.saved_at || new Date().toISOString();
            }
            await saveGroup(openGroup);
            openGroupId = null;
        }
    }

    for (const group of evidenceGroups) {
        if (!isTupyVistoriaPhotoGroup(group)) continue;
        if (group.saved_at) continue;
        if (!groupHasPersistedPhoto(group)) continue;
        group.saved_at = new Date().toISOString();
        await saveGroup(group);
    }

    await persistToCase();
    renderGroups();
    notifyEvidenceGroupsChanged({ source: "finalizeTupyVistoriaForNavigation" });
}

async function flushCurrentEvidence() {
    const group =
        syncOpenGroupFromDOM();

    if (group) {
        await saveGroup(
            group
        );
    } else {
        await persistToCase();
    }

    return true;
}

function bindActions() {
    mountedHost
        .querySelectorAll(
            "[data-close-photo-only-group]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        const group = getGroup(
                            button.dataset.closePhotoOnlyGroup
                        );

                        if (!group || !isLinkedPhotoOnlyGroup(group)) return;

                        if (groupHasPersistedPhoto(group)) {
                            group.saved_at = group.saved_at || new Date().toISOString();
                            await saveGroup(group);
                        } else {
                            await store.remove(group.id);
                            evidenceGroups = evidenceGroups.filter(
                                (entry) => entry && entry.id !== group.id
                            );
                            await persistToCase();
                        }

                        if (openGroupId === group.id) {
                            openGroupId = null;
                        }
                        renderGroups();
                        notifyEvidenceGroupsChanged({
                            source: "closeLinkedPhotoOnlyGroup",
                            groupId: group.id
                        });
                    }
                );
            }
        );

    mountedHost
        .querySelectorAll(
            "[data-open-evidence-group]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        button.disabled = true;

                        await transitionEvidenceView(
                            () => {
                                openGroupId =
                                    button.dataset.openEvidenceGroup;
                            }
                        );
                    }
                );
            }
        );

    mountedHost
        .querySelectorAll(
            "[data-group-field]"
        )
        .forEach(
            (field) => {
                const persistField =
                    () => {
                        const group =
                            getGroup(
                                field.dataset.groupField
                            );

                        if (!group) {
                            return;
                        }

                        group[
                            field.dataset.fieldName
                        ] =
                            field.value;

                        clearTimeout(
                            field._auroraSaveTimer
                        );

                        field._auroraSaveTimer =
                            setTimeout(
                                () => {
                                    saveGroup(
                                        group
                                    ).catch(
                                        console.error
                                    );
                                },
                                180
                            );
                    };

                field.addEventListener(
                    "input",
                    persistField
                );

                field.addEventListener(
                    "change",
                    persistField
                );
            }
        );

    mountedHost
        .querySelectorAll(
            "[data-save-evidence-group]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        captureFinalizeTrace(
                            "F0",
                            {
                                status: "PASS",
                                details: {
                                    saveEvidenceGroup:
                                        button.dataset.saveEvidenceGroup ||
                                        "null",
                                    buttonDisabled:
                                        String(button.disabled),
                                    openGroupId:
                                        openGroupId || "null"
                                }
                            }
                        );

                        const group =
                            getGroup(
                                button.dataset.saveEvidenceGroup
                            );

                        captureFinalizeTrace(
                            "F1",
                            {
                                status: group ? "PASS" : "ERROR",
                                details: {
                                    groupFound:
                                        group ? "SIM" : "NAO",
                                    id:
                                        (group && group.id) ||
                                        button.dataset.saveEvidenceGroup ||
                                        "null",
                                    title:
                                        (group && group.title) ||
                                        "null",
                                    item:
                                        (group && group.item) ||
                                        "null",
                                    saved_at_before:
                                        group && group.saved_at != null
                                            ? String(group.saved_at)
                                            : "null"
                                }
                            }
                        );

                        if (!group) {
                            captureFinalizeTrace(
                                "EARLY_RETURN",
                                {
                                    status: "ERROR",
                                    details: {
                                        reason: "GROUP_NOT_FOUND",
                                        saveEvidenceGroup:
                                            button.dataset.saveEvidenceGroup ||
                                            "null",
                                        buttonDisabled:
                                            String(button.disabled),
                                        openGroupId:
                                            openGroupId || "null"
                                    }
                                }
                            );
                            return;
                        }

                        if (button.disabled) {
                            captureFinalizeTrace(
                                "EARLY_RETURN",
                                {
                                    status: "ERROR",
                                    details: {
                                        reason: "BUTTON_DISABLED",
                                        saveEvidenceGroup:
                                            button.dataset.saveEvidenceGroup ||
                                            "null",
                                        buttonDisabled:
                                            String(button.disabled),
                                        openGroupId:
                                            openGroupId || "null"
                                    }
                                }
                            );
                            return;
                        }

                        const originalLabel =
                            button.textContent;

                        button.disabled = true;
                        button.classList.add("is-saving");
                        button.textContent = "Salvando…";
                        button.setAttribute("aria-busy", "true");

                        /*
                         * Captura o valor que ainda está no campo focado
                         * antes de marcar a ocorrência como finalizada.
                         */
                        syncOpenGroupFromDOM();

                        group.saved_at =
                            new Date().toISOString();

                        captureFinalizeTrace(
                            "F2",
                            {
                                status: "PASS",
                                details: {
                                    id: group.id || "null",
                                    saved_at:
                                        group.saved_at || "null",
                                    title: group.title || "null",
                                    item: group.item || "null"
                                }
                            }
                        );

                        try {
                            await saveGroup(
                                group
                            );

                            const runtime =
                                global.auroraRuntime;
                            const caseData =
                                runtime &&
                                typeof runtime.getCase === "function"
                                    ? runtime.getCase()
                                    : null;
                            const caseGroups =
                                caseData &&
                                Array.isArray(
                                    caseData.evidence_groups
                                )
                                    ? caseData.evidence_groups
                                    : [];
                            const caseGroup =
                                caseGroups.find(
                                    (entry) =>
                                        entry &&
                                        entry.id === group.id
                                ) || null;

                            captureFinalizeTrace(
                                "F3",
                                {
                                    status: "PASS",
                                    details: {
                                        saved_at_vivo:
                                            group.saved_at || "null",
                                        case_groups_total:
                                            String(caseGroups.length),
                                        case_group_id:
                                            (caseGroup && caseGroup.id) ||
                                            "null",
                                        case_group_saved_at:
                                            caseGroup &&
                                            caseGroup.saved_at != null
                                                ? String(caseGroup.saved_at)
                                                : "null"
                                    }
                                }
                            );

                            captureBugARuntimeTrace(
                                "A",
                                evidenceGroups.slice(),
                                {
                                    note:
                                        "after finalize/saveGroup — evidenceGroups vivo"
                                }
                            );

                            button.classList.remove("is-saving");
                            button.classList.add("is-saved");
                            button.textContent = "✓ Ocorrência salva";
                            button.setAttribute("aria-busy", "false");

                            await waitForEvidenceMotion(
                                AURORA_EVIDENCE_MOTION.savedHold
                            );

                            await transitionEvidenceView(
                                () => {
                                    openGroupId = null;
                                }
                            );

                            captureFinalizeTrace(
                                "FEND",
                                {
                                    status: "PASS",
                                    details: {
                                        openGroupId:
                                            openGroupId || "null",
                                        flow: "COMPLETE"
                                    }
                                }
                            );

                            notify(
                                "Registro finalizado."
                            );
                        } catch (error) {
                            captureFinalizeTrace(
                                "FERR",
                                {
                                    status: "ERROR",
                                    details: {
                                        errorName:
                                            (error && error.name) ||
                                            "Error",
                                        errorMessage:
                                            (error && error.message) ||
                                            String(error),
                                        errorStack:
                                            error &&
                                            error.stack
                                                ? String(error.stack).slice(
                                                    0,
                                                    400
                                                )
                                                : "null",
                                        groupId:
                                            (group && group.id) ||
                                            "null",
                                        groupSavedAt:
                                            group && group.saved_at != null
                                                ? String(group.saved_at)
                                                : "null",
                                        buttonDisabled:
                                            String(button.disabled),
                                        openGroupId:
                                            openGroupId || "null"
                                    }
                                }
                            );

                            button.disabled = false;
                            button.classList.remove("is-saving", "is-saved");
                            button.textContent = originalLabel;
                            button.setAttribute("aria-busy", "false");
                            notify(
                                "Não foi possível finalizar a ocorrência. Tente novamente."
                            );
                            console.error(error);
                        }
                    }
                );
            }
        );

    mountedHost
        .querySelectorAll(
            "[data-cancel-evidence-group]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        await flushCurrentEvidence();

                        openGroupId = null;
                        renderGroups();
                    }
                );
            }
        );

    mountedHost
        .querySelectorAll(
            "[data-delete-evidence-group]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        const id =
                            button.dataset.deleteEvidenceGroup;

                        if (
                            !await global.AuroraDialog.confirm(
                                "O registro e todas as fotos vinculadas serão excluídos.", { title: "Excluir registro?", confirmLabel: "Excluir", tone: "danger" }
                            )
                        ) {
                            return;
                        }

                        await store.remove(
                            id
                        );

                        evidenceGroups =
                            evidenceGroups.filter(
                                (group) =>
                                    group.id !== id
                            );

                        if (
                            openGroupId === id
                        ) {
                            openGroupId = null;
                        }

                        await persistToCase();
                        renderGroups();

                        notify(
                            "Registro excluído."
                        );
                    }
                );
            }
        );

    mountedHost
        .querySelectorAll("[data-group-photo-chooser]")
        .forEach((button) => {
            button.addEventListener("click", async () => {
                const groupId = button.dataset.groupPhotoChooser;
                const files = await requestEvidencePhotoFiles();
                await addPhotos(groupId, files);
            });
        });

    mountedHost
        .querySelectorAll(
            "[data-group-add-photo]"
        )
        .forEach(
            (input) => {
                input.addEventListener(
                    "change",
                    async () => {
                        const groupId =
                            input.dataset.groupAddPhoto;

                        await addPhotos(
                            groupId,
                            input.files
                        );

                        input.value = "";
                    }
                );
            }
        );

    mountedHost
        .querySelectorAll(
            "[data-photo-title],[data-photo-category],[data-photo-description]"
        )
        .forEach(
            (field) => {
                field.addEventListener(
                    "change",
                    async () => {
                        const group =
                            getGroup(
                                field.dataset.photoTitle ||
                                field.dataset.photoCategory ||
                                field.dataset.photoDescription
                            );

                        if (!group) return;

                        const photo =
                            group.photos.find(
                                (item) =>
                                    item.id ===
                                    field.dataset.photoId
                            );

                        if (!photo) return;

                        if (
                            field.hasAttribute(
                                "data-photo-title"
                            )
                        ) {
                            photo.title =
                                field.value.trim() ||
                                "Foto";
                        }

                        if (
                            field.hasAttribute(
                                "data-photo-category"
                            )
                        ) {
                            photo.category =
                                field.value;
                        }

                        if (
                            field.hasAttribute(
                                "data-photo-description"
                            )
                        ) {
                            photo.description =
                                field.value.trim();
                        }

                        await saveGroup(
                            group
                        );
                    }
                );
            }
        );

    mountedHost
        .querySelectorAll(
            "[data-edit-photo]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    () => {
                        const group =
                            getGroup(
                                button.dataset.editPhoto
                            );

                        const photo =
                            group &&
                            group.photos.find(
                                (item) =>
                                    item.id ===
                                    button.dataset.photoId
                            );

                        if (photo && editor) {
                            editor.open(photo);
                        }
                    }
                );
            }
        );

    mountedHost
        .querySelectorAll(
            "[data-delete-photo]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        const group =
                            getGroup(
                                button.dataset.deletePhoto
                            );

                        if (!group) return;

                        if (
                            !await global.AuroraDialog.confirm(
                                "A foto será removida deste registro.", { title: "Excluir foto?", confirmLabel: "Excluir", tone: "danger" }
                            )
                        ) {
                            return;
                        }

                        await removePhotoFromGroup(
                            group,
                            button.dataset.photoId
                        );

                        notify(
                            "Foto excluída."
                        );
                    }
                );
            }
        );

    mountedHost
        .querySelectorAll(
            "[data-cover-photo-action]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        const group =
                            getGroup(
                                button.dataset.coverPhotoGroup
                            );

                        const photo =
                            group &&
                            group.photos.find(
                                (item) =>
                                    item.id ===
                                    button.dataset.photoId
                            );

                        if (
                            !photo ||
                            !global.AuroraCoverPhotoFeature
                        ) {
                            return;
                        }

                        if (
                            button.dataset.coverPhotoAction ===
                            "remove"
                        ) {
                            await global.AuroraCoverPhotoFeature.removeCoverPhotoFromEvidence();
                        } else {
                            await global.AuroraCoverPhotoFeature.setCoverPhotoFromEvidencePhoto(
                                currentCase(),
                                photo
                            );
                        }

                        renderGroups();
                    }
                );
            }
        );
}

async function addPhotos(
    groupId,
    fileList
) {
    const group =
        getGroup(groupId);

    if (!group) return;

    const selectedFiles = Array.from(fileList || []);
    const files = isGuidedVehiclePhoto(group)
        ? selectedFiles.slice(0, 1)
        : selectedFiles;

    if (!files.length) return;

    notify(
        files.length === 1
            ? "Processando foto..."
            : `Processando ${files.length} fotos...`
    );

    if (isGuidedVehiclePhoto(group)) {
        group.photos = [];
    }

    let addedCount = 0;
    let failedCount = 0;

    for (
        const file of files
    ) {
        try {
            const compressed =
                await fileToCompressedDataURL(
                    file
                );

            group.photos.push({
                id:
                    uid("evidence-photo"),
                title:
                    `Evidência fotográfica ${group.photos.length + 1}`,
                description:
                    "",
                category:
                    "general",
                src:
                    compressed.src,
                width:
                    compressed.width,
                height:
                    compressed.height,
                /* A própria src é o original comprimido. Duplicá-la aqui
                 * dobrava a memória usada por cada fotografia no WebView. */
                original_src:
                    null,
                edited_src:
                    null,
                editor_objects:
                    [],
                created_at:
                    new Date().toISOString()
            });
            addedCount += 1;
        } catch (error) {
            console.error(error);
            failedCount += 1;
        }
    }

    if (addedCount > 0) {
        if (isPhotoOnlyGroup(group)) {
            group.saved_at = group.saved_at || new Date().toISOString();
        }
        await saveGroup(group);
        renderGroups();

        if (isGuidedVehiclePhoto(group)) {
            document.dispatchEvent(
                new CustomEvent(
                    "aurora:guided-photo-saved",
                    {
                        detail: {
                            slot:
                                group.vehicle_photo_slot ||
                                null,
                            groupId:
                                group.id
                        }
                    }
                )
            );
        }
    }

    if (addedCount === 0) {
        notify("Não foi possível carregar a foto. Baixe o arquivo para o computador ou escolha uma imagem JPEG/PNG disponível no dispositivo.");
    } else if (failedCount > 0) {
        notify(`${addedCount} foto(s) adicionada(s). ${failedCount} arquivo(s) não puderam ser processados.`);
    } else {
        notify(addedCount === 1 ? "Foto adicionada." : `${addedCount} fotos adicionadas.`);
    }
}

function requestEvidencePhotoFiles() {
    return (async () => {
        if (
            !global.AuroraDialog ||
            typeof global.AuroraDialog.confirm !== "function"
        ) {
            throw new Error("Dialogo oficial de fotos indisponivel.");
        }

        const useCamera = await global.AuroraDialog.confirm(
            "Escolha como deseja adicionar a imagem.",
            {
                title: "Adicionar foto",
                confirmLabel: "Tirar foto",
                cancelLabel: "Escolher da galeria",
                layout: "simple"
            }
        );
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.hidden = true;
        input.setAttribute("data-evidence-direct-photo-input", "");
        if (useCamera) {
            input.setAttribute("capture", "environment");
        } else {
            input.multiple = true;
        }
        document.body.appendChild(input);

        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                global.removeEventListener("focus", onWindowFocus);
                const files = Array.from(input.files || []);
                input.remove();
                resolve(files);
            };
            const onWindowFocus = () => {
                setTimeout(finish, 500);
            };

            input.addEventListener("change", finish, { once: true });
            input.addEventListener("cancel", finish, { once: true });
            global.addEventListener("focus", onWindowFocus, { once: true });
            input.click();
        });
    })();
}

async function ensureLinkedPhotoOnlyGroup(options) {
    const contract = normalizeLinkedPhotoContract(options);
    let group = findLinkedPhotoOnlyGroup(contract);

    if (group) {
        Object.assign(group, contract);
        await saveGroup(group);
        return { group, created: false };
    }

    group = Object.assign(newEvidenceGroup(), contract);
    evidenceGroups.push(group);
    await saveGroup(group);
    return { group, created: true };
}

async function addLinkedPhotos(options) {
    const contract = normalizeLinkedPhotoContract(options);
    const operationKey = `${contract.linked_entity_type}:${contract.linked_entity_id}`;
    if (linkedPhotoOperations.has(operationKey)) {
        return linkedPhotoOperations.get(operationKey);
    }

    const operation = (async () => {
        await loadGroups();
        const files = await requestEvidencePhotoFiles();
        if (!files.length) {
            return { status: "cancelled", group: findLinkedPhotoOnlyGroup(contract) };
        }

        const ensured = await ensureLinkedPhotoOnlyGroup(contract);
        await addPhotos(ensured.group.id, files);
        const group = getGroup(ensured.group.id);

        if (!groupHasPersistedPhoto(group)) {
            if (ensured.created && group) {
                await store.remove(group.id);
                evidenceGroups = evidenceGroups.filter(
                    (entry) => entry && entry.id !== group.id
                );
                await persistToCase();
            }
            return { status: "failed", group: null };
        }

        notifyLinkedPhotoChanged(group, "added");
        return {
            status: "added",
            group: JSON.parse(JSON.stringify(group))
        };
    })();

    linkedPhotoOperations.set(operationKey, operation);
    try {
        return await operation;
    } finally {
        linkedPhotoOperations.delete(operationKey);
    }
}

async function addLinkedCoverPhoto(options) {
    const contract = normalizeLinkedPhotoContract(options);
    const operationKey = `cover:${contract.linked_entity_type}:${contract.linked_entity_id}`;
    if (linkedPhotoOperations.has(operationKey)) {
        return linkedPhotoOperations.get(operationKey);
    }

    const operation = (async () => {
        await loadGroups();
        const files = await requestEvidencePhotoFiles();
        if (!files.length) {
            return { status: "cancelled", group: findLinkedPhotoOnlyGroup(contract) };
        }

        const ensured = await ensureLinkedPhotoOnlyGroup(contract);
        const previousIds = new Set((ensured.group.photos || []).map((photo) => String(photo.id || "")));
        await addPhotos(ensured.group.id, files.slice(0, 1));
        const group = getGroup(ensured.group.id);
        const photo = group && (group.photos || []).find((entry) => !previousIds.has(String(entry.id || "")));

        if (!photo) {
            if (ensured.created && group && !groupHasPersistedPhoto(group)) {
                await store.remove(group.id);
                evidenceGroups = evidenceGroups.filter((entry) => entry && entry.id !== group.id);
                await persistToCase();
            }
            return { status: "failed", group: null, photo: null };
        }

        if (!global.AuroraCoverPhotoFeature ||
            typeof global.AuroraCoverPhotoFeature.setCoverPhotoFromEvidencePhoto !== "function") {
            throw new Error("Motor oficial de foto de capa indisponivel.");
        }

        await global.AuroraCoverPhotoFeature.setCoverPhotoFromEvidencePhoto(currentCase(), photo);

        /* A capa é única. Mantemos no Evidence Engine somente a nova foto-fonte.
         * O Report Engine continua consumindo coverPhoto pelo motor oficial. */
        group.photos = [photo];
        await saveGroup(group);
        notifyLinkedPhotoChanged(group, "added");

        return {
            status: "added",
            group: JSON.parse(JSON.stringify(group)),
            photo: JSON.parse(JSON.stringify(photo))
        };
    })();

    linkedPhotoOperations.set(operationKey, operation);
    try {
        return await operation;
    } finally {
        linkedPhotoOperations.delete(operationKey);
    }
}

async function removePhotoFromGroup(group, photoId) {
    if (!group || !photoId) return false;

    if (
        global.AuroraCoverPhotoFeature &&
        typeof global.AuroraCoverPhotoFeature.clearCoverPhotoIfSourceDeleted ===
            "function"
    ) {
        await global.AuroraCoverPhotoFeature.clearCoverPhotoIfSourceDeleted(
            currentCase(),
            photoId
        );
    }

    group.photos = group.photos.filter(
        (photo) => photo.id !== photoId
    );

    if (group.photos.length === 0 && isLinkedPhotoOnlyGroup(group)) {
        await store.remove(group.id);
        evidenceGroups = evidenceGroups.filter(
            (entry) => entry && entry.id !== group.id
        );
        if (openGroupId === group.id) {
            openGroupId = null;
        }
        await persistToCase();
    } else {
        if (
            group.photos.length === 0 &&
            isTupyVistoriaPhotoGroup(group) &&
            openGroupId === group.id
        ) {
            openGroupId = null;
        }
        await saveGroup(group);
    }

    renderGroups();
    notifyLinkedPhotoChanged(group, "deleted");
    return true;
}

async function mountLinkedPhotos(host, options) {
    if (!host || !host.isConnected) return false;
    const contract = normalizeLinkedPhotoContract(options);
    await loadGroups();
    if (!host.isConnected) return false;

    const group = findLinkedPhotoOnlyGroup(contract);
    const photos = group && Array.isArray(group.photos) ? group.photos : [];
    host.innerHTML = photos.length
        ? [
            '<div class="aurora-evidence-photo-grid">',
            photos.map((photo, index) => [
                '<article class="aurora-evidence-photo">',
                '<div class="aurora-evidence-photo__image">',
                `<img src="${escapeAttribute(photo.edited_src || photo.src || "")}" alt="${escapeAttribute(photo.title || `Foto ${index + 1}`)}">`,
                `<span>${index + 1}</span>`,
                '</div>',
                '<div class="aurora-evidence-photo__body">',
                `<strong class="aurora-evidence-photo__label">${escapeHTML(contract.linked_entity_type === "report_cover" ? "Foto de capa do relatório" : `Evidência fotográfica ${index + 1}`)}</strong>`,
                '<div>',
                `<button type="button" data-linked-edit-photo="${photo.id}">✎ Editar</button>`,
                `<button type="button" class="is-danger" data-linked-delete-photo="${photo.id}">Excluir foto</button>`,
                '</div>',
                '</div>',
                '</article>'
            ].join("")).join(""),
            '</div>'
        ].join("")
        : "";

    host.querySelectorAll("[data-linked-edit-photo]").forEach((button) => {
        button.addEventListener("click", () => {
            const liveGroup = findLinkedPhotoOnlyGroup(contract);
            const photo = liveGroup && liveGroup.photos.find(
                (entry) => entry.id === button.dataset.linkedEditPhoto
            );
            if (photo && editor) editor.open(photo);
        });
    });

    host.querySelectorAll("[data-linked-delete-photo]").forEach((button) => {
        button.addEventListener("click", async () => {
            const confirmed = await global.AuroraDialog.confirm(
                "A foto será removida deste registro.",
                { title: "Excluir foto?", confirmLabel: "Excluir", tone: "danger" }
            );
            if (!confirmed) return;
            const liveGroup = findLinkedPhotoOnlyGroup(contract);
            if (!liveGroup) return;
            await removePhotoFromGroup(
                liveGroup,
                button.dataset.linkedDeletePhoto
            );
        });
    });

    return true;
}

function getGroup(id) {
    return (
        evidenceGroups.find(
            (group) =>
                group.id === id
        ) ||
        null
    );
}

async function saveGuidedSlotPhoto(
    slotOptions,
    fileList
) {
    const slot =
        String(
            (slotOptions &&
                (slotOptions.vehicle_photo_slot ||
                    slotOptions.slot)) ||
                ""
        ).trim();

    if (!slot) {
        throw new Error(
            "vehicle_photo_slot obrigatório."
        );
    }

    let group =
        findGuidedGroupBySlot(slot);

    if (!group) {
        const created =
            await createEvidenceGroup({
                record_kind:
                    "vehicle_guided_photo",
                vehicle_photo_slot:
                    slot,
                title:
                    slotOptions.title ||
                    "",
                item:
                    "",
                severity:
                    "Sem gravidade — não exibir no relatório",
                description:
                    "",
                recommendation:
                    ""
            });

        group =
            created &&
            created.group
                ? created.group
                : findGuidedGroupBySlot(
                      slot
                  );
    }

    if (!group) {
        throw new Error(
            "Não foi possível preparar o slot guiado."
        );
    }

    await addPhotos(
        group.id,
        fileList
    );

    const savedGroup =
        getGroup(group.id);

    if (
        savedGroup &&
        isGuidedVehiclePhoto(savedGroup)
    ) {
        openGroupId = null;
        renderGroups();
    }

    return savedGroup;
}

async function clearGuidedSlotPhoto(slot) {
    const normalizedSlot = String(slot || "").trim();
    if (!normalizedSlot) {
        throw new Error("vehicle_photo_slot obrigatorio.");
    }

    const group = findGuidedGroupBySlot(normalizedSlot);
    if (!group) {
        return false;
    }

    await store.remove(group.id);

    evidenceGroups = evidenceGroups.filter(
        (entry) => entry && entry.id !== group.id
    );

    if (openGroupId === group.id) {
        openGroupId = null;
    }

    await persistToCase();
    renderGroups();

    global.dispatchEvent(
        new CustomEvent("aurora:guided-photos-changed", {
            detail: {
                slot: normalizedSlot,
                deleted: true,
                groupId: group.id
            }
        })
    );

    return true;
}

async function removeLinkedGroups(link) {
    const options = link && typeof link === "object" ? link : {};
    const entityType = String(options.entity_type || "").trim();
    const entityId = String(options.entity_id || "").trim();
    const linkKey = String(options.link_key || "").trim();

    if (!entityType || !entityId) {
        throw new Error("entity_type e entity_id obrigatorios.");
    }
    if (linkKey && !/^[a-z][a-z0-9_]*$/i.test(linkKey)) {
        throw new Error("link_key invalido.");
    }

    const matches = evidenceGroups.filter((group) => {
        if (!group) return false;
        const canonicalMatch =
            isLinkedPhotoOnlyGroup(group) &&
            String(group.linked_entity_type || "") === entityType &&
            String(group.linked_entity_id || "") === entityId;
        const legacyMatch =
            linkKey &&
            Object.prototype.hasOwnProperty.call(group, linkKey) &&
            String(group[linkKey] || "") === entityId;
        return canonicalMatch || legacyMatch;
    });

    for (const group of matches) {
        await store.remove(group.id);
    }

    if (matches.length) {
        const ids = new Set(matches.map((group) => group.id));
        evidenceGroups = evidenceGroups.filter(
            (group) => group && !ids.has(group.id)
        );
        if (openGroupId && ids.has(openGroupId)) {
            openGroupId = null;
        }
        await persistToCase();
        renderGroups();
        notifyEvidenceGroupsChanged({
            source: "removeLinkedGroups",
            entityType,
            entityId,
            removed: matches.length
        });
    }

    return matches.length;
}

async function fileToCompressedDataURL(file) {
    const source =
        await readFileAsDataURL(
            file
        );

    const image =
        await loadImage(
            source
        );

    const maxDimension =
        1600;

    const scale =
        Math.min(
            1,
            maxDimension /
            Math.max(
                image.naturalWidth,
                image.naturalHeight
            )
        );

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        Math.round(
            image.naturalWidth *
            scale
        );

    canvas.height =
        Math.round(
            image.naturalHeight *
            scale
        );

    const context =
        canvas.getContext("2d");

    context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
    );

    return {
        src:
            canvas.toDataURL(
                "image/jpeg",
                .80
            ),
        width:
            canvas.width,
        height:
            canvas.height
    };
}

function readFileAsDataURL(file) {
    return new Promise(
        (resolve, reject) => {
            const reader =
                new FileReader();

            reader.onload =
                () => resolve(
                    reader.result
                );

            reader.onerror =
                reject;

            reader.readAsDataURL(
                file
            );
        }
    );
}

function loadImage(src) {
    return new Promise(
        (resolve, reject) => {
            const image =
                new Image();

            image.onload =
                () => resolve(image);

            image.onerror =
                reject;

            image.src =
                src;
        }
    );
}

function categoryLabel(value) {
    return {
        general:
            "Geral",
        before:
            "Antes",
        after:
            "Depois",
        detail:
            "Detalhe",
        identification:
            "Identificação"
    }[value] || value;
}

async function mountEvidenceHub(host) {
    mountedHost =
        host;

    if (
        host.querySelector(
            "[data-evidence-hub]"
        )
    ) {
        await reloadEvidenceForCurrentCase();
        return;
    }

    host.insertAdjacentHTML(
        "beforeend",
        panelHTML()
    );

    hideLegacyEvidenceUI(
        host
    );

    await loadGroups();

    renderGroups();

    syncTupyUserVistoriaHubVisibility();

    const sectionTitleSelect = host.querySelector("[data-record-section-title]");
    if (sectionTitleSelect) {
        const caseData = currentCase() || {};
        sectionTitleSelect.value = caseData.record_section_title || "Registros técnicos";
        sectionTitleSelect.addEventListener("change", async () => {
            const runtime = global.auroraRuntime;
            const patch = { record_section_title: sectionTitleSelect.value };
            if (runtime && runtime.caseBinder && typeof runtime.caseBinder.merge === "function") {
                runtime.caseBinder.merge(patch, {source:"record_title", controller_id:"evidence"});
            }
            if (global.auroraRepository && typeof global.auroraRepository.save === "function") {
                global.auroraRepository.save(runtime.getCase());
            }
            notify("Título do relatório atualizado.");
        });
    }

    const addEvidenceButton = host.querySelector("[data-add-evidence-group]");
    if (addEvidenceButton) {
        addEvidenceButton.addEventListener(
            "click",
            async () => {
                if (!canCreateOccurrenceNow()) {
                    notify(
                        isEletricaTupyService()
                            ? "Adicione a primeira foto da vistoria para continuar."
                            : "Registre ao menos uma foto em \"Antes do serviço\" antes de criar ocorrências."
                    );
                    return;
                }

                if (isEletricaTupyService() && global.__AURORA_TUPY_CANONICAL_EVIDENCE_UI__ !== true) {
                    await openOrCreateTupyAntesGroup();
                    notify("Registro fotográfico da vistoria aberto.");
                    return;
                }

                const unfinished =
                    evidenceGroups.find(
                        (group) =>
                            !group.saved_at
                    );

                if (
                    openGroupId ||
                    unfinished
                ) {
                    openGroupId =
                        openGroupId ||
                        unfinished.id;

                    renderGroups();

                    notify(
                        "Finalize o registro atual antes de criar um novo."
                    );

                    return;
                }

                await createEvidenceGroup();

                notify(
                    "Nova ocorrência aberta."
                );
            }
        );
    }
}

function findEvidenceHost() {
    const explicit =
        document.querySelector(
            '[data-module="evidence"]'
        );

    if (explicit) {
        return explicit;
    }

    const content =
        document.querySelector(
            "[data-shell-content]"
        );

    if (!content) {
        return null;
    }

    const heading =
        Array.from(
            content.querySelectorAll(
                "h1,h2,h3"
            )
        ).find(
            (item) =>
                /evid[eê]ncias/i.test(
                    item.textContent
                )
        );

    return heading
        ? heading.closest(
            "section,article,div"
        )
        : null;
}

let lastHost = null;

const observer =
    new MutationObserver(
        () => {
            const host =
                findEvidenceHost();

            if (
                host &&
                host !== lastHost
            ) {
                lastHost = host;

                mountEvidenceHub(
                    host
                ).catch(
                    console.error
                );
            } else if (
                !host &&
                lastHost
            ) {
                lastHost = null;
                mountedHost = null;

                document.body.classList.remove(
                    "aurora-evidence-editing"
                );
            }
        }
    );

observer.observe(
    document.documentElement,
    {
        childList: true,
        subtree: true
    }
);

setTimeout(
    () => {
        const host =
            findEvidenceHost();

        if (host) {
            lastHost = host;

            mountEvidenceHub(
                host
            ).catch(
                console.error
            );
        }
    },
    900
);

if (typeof global.addEventListener === "function") {
    global.addEventListener(
        "aurora:cover-photo-changed",
        () => {
            if (mountedHost) {
                renderGroups();
            }
        }
    );
}

if (
    global.auroraRuntime &&
    typeof global.auroraRuntime.on === "function"
) {
    global.auroraRuntime.on(
        "case_changed",
        () => {
            if (
                !mountedHost ||
                evidencePersistInFlight
            ) {
                return;
            }

            reloadEvidenceForCurrentCase().catch(
                console.error
            );
        }
    );

    global.auroraRuntime.on(
        "case_reset",
        () => {
            if (!mountedHost) {
                return;
            }

            reloadEvidenceForCurrentCase().catch(
                console.error
            );
        }
    );
}

function escapeHTML(value) {
    return String(
        value ?? ""
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHTML(value);
}

global.AuroraEvidenceFeature = {
    flush:
        flushCurrentEvidence,

    getGroups:
        () =>
            JSON.parse(
                JSON.stringify(
                    evidenceGroups
                )
            ),

    getPatch:
        () =>
            buildEvidencePatch(),

    persist:
        persistToCase,

    reload:
        reloadEvidenceForCurrentCase,

    createGroup:
        createEvidenceGroup,

    openGroup:
        openEvidenceGroup,

    saveGuidedSlotPhoto:
        saveGuidedSlotPhoto,

    clearGuidedSlotPhoto:
        clearGuidedSlotPhoto,

    removeLinkedGroups:
        removeLinkedGroups,

    addLinkedPhotos:
        addLinkedPhotos,

    addLinkedCoverPhoto:
        addLinkedCoverPhoto,

    mountLinkedPhotos:
        mountLinkedPhotos,

    openOrCreateTupyAntesGroup:
        openOrCreateTupyAntesGroup,

    finalizeTupyVistoriaForNavigation:
        finalizeTupyVistoriaForNavigation,

    canCreateOccurrence:
        canCreateOccurrenceNow,

    hasTupyAntesPhotoUnlocked:
        hasTupyAntesPhotoUnlocked
};

global.auroraEvidenceStore =
    store;

global.auroraPhotoEditor =
    editor;

console.log(
    "AURORA EVIDENCE FEATURE RC2.2.2 OCCURRENCE DEDUPE GUARD"
);

})(window);

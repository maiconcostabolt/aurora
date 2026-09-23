(function (global) {
"use strict";

/*
 * Pipeline oficial de exportação de relatórios Aurora (APK).
 * Um motor PDF compartilhado por Compartilhar PDF / Salvar PDF.
 * Um motor HTML standalone compartilhado por Compartilhar HTML (e saveHtmlFromPreview interno).
 */

const PDF_NATIVE_EVENT = "aurora:pdf-local-complete";
const HTML_NATIVE_EVENT = "aurora:html-local-complete";
const NATIVE_TIMEOUT_MS = 120000;
const HTML_BRIDGE_CHUNK_SIZE = 32768;

const PDF_SAVE_FOLDER = "Downloads/Aurora/Relatórios PDF";
const HTML_SAVE_FOLDER = "Downloads/Aurora/Relatórios HTML";
const HTML_SHARE_MIME = "text/html";

function hasNativeBridge() {
    const bridge = global.AuroraAndroid;

    if (!bridge) {
        return false;
    }

    return (
        ("exportPdfSnapshot" in bridge) ||
        ("saveHtmlSnapshot" in bridge)
    );
}

function showVisibleError(message, notify, prefix) {
    const label = prefix || "Falha ao gerar PDF";
    const text = String(message || `${label}.`);

    console.error("AURORA EXPORT ERRO", text);

    if (typeof notify === "function") {
        notify(`${label}: ${text}`);
    }

    if (
        global.AuroraAndroid &&
        typeof global.AuroraAndroid.notifyUser === "function"
    ) {
        global.AuroraAndroid.notifyUser(`${label}: ${text}`);
    }
}

function showVisibleProgress(message, notify) {
    const text = String(message || "");

    if (typeof notify === "function") {
        notify(text);
    }

    if (
        global.AuroraAndroid &&
        typeof global.AuroraAndroid.notifyUser === "function"
    ) {
        global.AuroraAndroid.notifyUser(text);
    }
}

async function waitImages(documentNode) {
    const images = Array.from(documentNode.querySelectorAll("img"));

    await Promise.all(
        images.map((image) => {
            if (image.complete) {
                return Promise.resolve();
            }

            return new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
            });
        })
    );
}

async function generateStandaloneReportHTML(preview, notify) {
    return generateStandaloneHtml(preview, notify);
}

function cleanupPreviewPrintArtifacts(preview) {
    if (
        preview &&
        typeof preview._cleanupPrintExportArtifacts === "function"
    ) {
        preview._cleanupPrintExportArtifacts();
    }
}

async function buildPrintStageFromPreview(preview) {
    if (!preview || !preview.modal || !preview.currentReportId) {
        throw new Error("Prévia do relatório não está aberta.");
    }

    const report = preview.engine.get(preview.currentReportId);
    const documentNode = preview.modal.querySelector("[data-report-document]");

    if (!report || !documentNode) {
        throw new Error("Relatório ou documento não encontrado.");
    }

    const oldStage = preview.modal.querySelector("[data-report-print-stage]");

    if (oldStage) {
        oldStage.remove();
    }

    await waitImages(documentNode);
    await preview._syncPreviewMediaLayouts(documentNode);

    if (
        global.AuroraPdfSerialize &&
        typeof global.AuroraPdfSerialize.inlineImagesForPdf === "function"
    ) {
        await global.AuroraPdfSerialize.inlineImagesForPdf(documentNode);
    }

    const stage = await preview._buildPrintStage(documentNode, report);

    await new Promise((resolve) =>
        requestAnimationFrame(() =>
            requestAnimationFrame(resolve)
        )
    );

    return { stage, report, documentNode };
}

function waitForNativePdfResult() {
    return waitForNativeEvent(PDF_NATIVE_EVENT);
}

function waitForNativeHtmlResult() {
    return waitForNativeEvent(HTML_NATIVE_EVENT);
}

function waitForNativeEvent(eventName) {
    return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new Error("Timeout aguardando resposta nativa."));
        }, NATIVE_TIMEOUT_MS);

        function cleanup() {
            window.clearTimeout(timeoutId);
            global.removeEventListener(eventName, handler);
        }

        function handler(event) {
            cleanup();

            const detail = event && event.detail ? event.detail : {};

            if (detail.ok) {
                resolve(detail);
                return;
            }

            reject(new Error(detail.error || "Falha na exportação nativa."));
        }

        global.addEventListener(eventName, handler);
    });
}

async function generateReportPdf(preview, notify, options) {
    const notifyFn = typeof notify === "function" ? notify : () => {};
    const postAction = String((options && options.postAction) || "share").toLowerCase();
    const fileNameOverride =
        options &&
        options.fileName
            ? String(options.fileName)
            : "";

    if (!global.__AURORA_ANDROID__) {
        const error = new Error("Geração de PDF disponível apenas no aplicativo Android.");
        showVisibleError(error.message, notifyFn);
        throw error;
    }

    if (!preview || !preview.modal || !preview.currentReportId) {
        const error = new Error("Prévia do relatório não está aberta.");
        showVisibleError(error.message, notifyFn);
        throw error;
    }

    if (!preview.modal.querySelector("[data-report-document]")) {
        const error = new Error("documentNode não encontrado.");
        showVisibleError(error.message, notifyFn);
        throw error;
    }

    if (
        !global.AuroraAndroid ||
        (
            typeof global.AuroraAndroid.exportPdfSnapshot !== "function" &&
            typeof global.AuroraAndroid.exportPdfFromStandaloneHtml !== "function"
        )
    ) {
        const error = new Error("Bridge Android de PDF indisponível.");
        showVisibleError(error.message, notifyFn);
        throw error;
    }

    showVisibleProgress("Gerando PDF...", notifyFn);

    try {
        if (
            preview &&
            typeof preview.ensurePreviewReady ===
                "function"
        ) {
            await preview.ensurePreviewReady();
        }

        const generated = await generateStandaloneReportHTML(preview, notifyFn);
        const fileName = fileNameOverride ||
            `${generated.reportId}.pdf`;
        // Pipeline oficial v42: HTML standalone → WebView isolado → PrintDocumentAdapter.
        // Fallback legado (compositor + exportPdfSnapshot) permanece abaixo para rollback/debug.
        const useStandalonePipeline =
            global.AURORA_PDF_STANDALONE_PIPELINE === true &&
            global.AuroraAndroid &&
            typeof global.AuroraAndroid.exportPdfFromStandaloneHtml === "function";

        if (useStandalonePipeline) {
            showVisibleProgress("Renderizando PDF...", notifyFn);
            const nativePromise = waitForNativePdfResult();
            global.AuroraAndroid.exportPdfFromStandaloneHtml(
                fileName,
                generated.html,
                postAction
            );
            const nativeResult = await nativePromise;
            const pdfBytes = Number(nativeResult && nativeResult.bytes) || 0;
            const savedName = nativeResult.fileName || fileName;

            if (postAction === "save") {
                showVisibleProgress(`PDF salvo em:\n${PDF_SAVE_FOLDER}`, notifyFn);
                showVisibleProgress(savedName, notifyFn);
            } else {
                showVisibleProgress(`PDF pronto (${(pdfBytes / 1024).toFixed(1)} KB)`, notifyFn);
            }

            return {
                reportId: generated.reportId,
                pageCount: nativeResult.pageCount || null,
                bytes: pdfBytes,
                fileName: savedName,
                folder: PDF_SAVE_FOLDER,
                postAction,
                pipeline: "standalone-html-print"
            };
        }

        const { stage, report } = await buildPrintStageFromPreview(preview);
        const reportLabel = preview._publicReportId(report);

        if (
            !global.AuroraPdfSerialize ||
            typeof global.AuroraPdfSerialize.serializePrintStageForPdf !== "function"
        ) {
            throw new Error("Serializador AuroraPdfSerialize indisponível.");
        }

        try {
            showVisibleProgress("Preparando imagens...", notifyFn);
            const serialized = await global.AuroraPdfSerialize.serializePrintStageForPdf(stage, report, {
                reportLabel
            });

            const legacyFileName = `${reportLabel}.pdf`;
            const nativePromise = waitForNativePdfResult();

            global.AuroraAndroid.exportPdfSnapshot(
                legacyFileName,
                serialized.html,
                postAction
            );

            const nativeResult = await nativePromise;
            const pdfBytes = Number(nativeResult && nativeResult.bytes) || 0;
            const savedName = nativeResult.fileName || legacyFileName;

            if (postAction === "save") {
                showVisibleProgress(`PDF salvo em:\n${PDF_SAVE_FOLDER}`, notifyFn);
                showVisibleProgress(savedName, notifyFn);
            } else {
                showVisibleProgress(`PDF pronto (${(pdfBytes / 1024).toFixed(1)} KB)`, notifyFn);
            }

            return {
                reportId: serialized.stats.reportId,
                pageCount: serialized.stats.pageCount,
                bytes: pdfBytes,
                fileName: savedName,
                folder: PDF_SAVE_FOLDER,
                postAction,
                pipeline: "legacy-compositor-snapshot"
            };
        } finally {
            cleanupPreviewPrintArtifacts(preview);
        }
    } catch (error) {
        cleanupPreviewPrintArtifacts(preview);
        const message = error && error.message ? error.message : String(error);
        showVisibleError(message, notifyFn);
        throw error;
    }
}

async function generateStandaloneHtml(preview, notify, options) {
    if (preview && preview._htmlShareClickGuard) {
        throw new Error(
            "generateStandaloneHtml não pode rodar durante o clique de Compartilhar HTML."
        );
    }

    const notifyFn = typeof notify === "function" ? notify : () => {};
    const silent = Boolean(options && options.silent);
    const skipLiveLayoutSync = Boolean(options && options.skipLiveLayoutSync);

    if (!preview || !preview.modal || !preview.currentReportId) {
        throw new Error("Prévia do relatório não está aberta.");
    }

    const report = preview.engine.get(preview.currentReportId);
    const documentNode = preview.modal.querySelector("[data-report-document]");

    if (!report || !documentNode) {
        throw new Error("Relatório ou documento não encontrado.");
    }

    if (!silent) {
        showVisibleProgress("Preparando HTML...", notifyFn);
    }

    await waitImages(documentNode);

    if (!skipLiveLayoutSync) {
        await preview._syncPreviewMediaLayouts(documentNode);
    }

    const html = await preview._buildStandaloneHtmlFromDocument(report, documentNode);
    const reportLabel = preview._publicReportId(report);
    const fileName = `${reportLabel}.html`;

    return {
        html,
        reportId: reportLabel,
        fileName,
        bytes: new TextEncoder().encode(html).length
    };
}

async function shareHtmlViaNativeBridge(fileName, html) {
    if (
        global.AuroraAndroid &&
        typeof global.AuroraAndroid.shareHtmlBegin === "function" &&
        typeof global.AuroraAndroid.shareHtmlAppend === "function" &&
        typeof global.AuroraAndroid.shareHtmlFinish === "function"
    ) {
        const chunks = [];

        for (let offset = 0; offset < html.length; offset += HTML_BRIDGE_CHUNK_SIZE) {
            chunks.push(html.slice(offset, offset + HTML_BRIDGE_CHUNK_SIZE));
        }

        console.log(
            "AURORA HTML SHARE BEGIN",
            {
                fileName,
                totalChars: html.length,
                chunkSize: HTML_BRIDGE_CHUNK_SIZE,
                chunkCount: chunks.length
            }
        );

        global.AuroraAndroid.shareHtmlBegin(fileName, chunks.length);

        for (let index = 0; index < chunks.length; index += 1) {
            const chunk = chunks[index];
            const accepted = global.AuroraAndroid.shareHtmlAppend(
                chunk,
                index,
                chunks.length
            );

            if (!accepted) {
                throw new Error(
                    `Falha ao enviar chunk HTML ${index + 1}/${chunks.length}.`
                );
            }
        }

        global.AuroraAndroid.shareHtmlFinish();
        return {
            ok: true,
            fileName,
            bytes: new TextEncoder().encode(html).length
        };
    }

    if (
        !global.AuroraAndroid ||
        typeof global.AuroraAndroid.shareReport !== "function"
    ) {
        throw new Error("Compartilhar HTML indisponível neste dispositivo.");
    }

    console.warn("AURORA HTML SHARE: fallback monolítico (bridge chunked indisponível)");
    global.AuroraAndroid.shareReport(fileName, html);
    return {
        ok: true,
        fileName,
        bytes: new TextEncoder().encode(html).length
    };
}

function hashShareText(text) {
    const value = String(text || "");
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableShareJson(value) {
    try {
        return JSON.stringify(value);
    } catch (error) {
        return String(value);
    }
}

function computeReportShareSignature(report) {
    if (!report || typeof report !== "object") {
        return "";
    }

    const payload = {
        id: report.id || "",
        updated_at: report.updated_at || "",
        created_at: report.created_at || "",
        report_title: report.report_title || report.title || "",
        status: report.status || "",
        company: report.company || null,
        snapshot: report.snapshot || null,
        occurrences: report.occurrences || null,
        cover_photo:
            report.cover_photo ||
            (report.snapshot && report.snapshot.cover_photo) ||
            null
    };

    return `${String(report.id || "")}::${hashShareText(stableShareJson(payload))}`;
}

function captureUserActivation(phase) {
    const activation =
        global.navigator && global.navigator.userActivation
            ? global.navigator.userActivation
            : null;
    const snapshot = {
        phase: String(phase || ""),
        supported: Boolean(activation),
        isActive: activation ? Boolean(activation.isActive) : null,
        hasBeenActive: activation ? Boolean(activation.hasBeenActive) : null
    };

    console.info("AURORA HTML SHARE ACTIVATION", snapshot);
    return snapshot;
}

function createHtmlShareFile(generated) {
    if (!generated || !generated.html) {
        throw new Error("HTML standalone indisponível.");
    }

    return new File(
        [generated.html],
        generated.fileName,
        { type: HTML_SHARE_MIME }
    );
}

function buildHtmlSharePayload(file, reportLabel) {
    return {
        title: `Relatório ${reportLabel}`,
        files: [file]
    };
}

function getPreviewHtmlShareCache(preview) {
    return preview && preview._htmlShareCache ? preview._htmlShareCache : null;
}

function clearPreviewHtmlShareCache(preview) {
    if (preview) {
        preview._htmlShareCache = null;
    }
}

function isPreviewHtmlShareCacheValid(preview, report) {
    const cache = getPreviewHtmlShareCache(preview);

    if (
        !cache ||
        !cache.file ||
        !cache.html ||
        !cache.signature
    ) {
        return false;
    }

    const current =
        report ||
        (
            preview &&
            preview.engine &&
            typeof preview.engine.get === "function"
                ? preview.engine.get(preview.currentReportId)
                : null
        );

    if (!current) {
        return false;
    }

    if (String(cache.reportId) !== String(current.id)) {
        return false;
    }

    if (
        preview &&
        String(preview.currentReportId) !== String(current.id)
    ) {
        return false;
    }

    return cache.signature === computeReportShareSignature(current);
}

async function prepareHtmlShareForPreview(preview, notify) {
    const notifyFn = typeof notify === "function" ? notify : () => {};
    const report =
        preview &&
        preview.engine &&
        typeof preview.engine.get === "function"
            ? preview.engine.get(preview.currentReportId)
            : null;

    if (!preview || !preview.modal || !preview.currentReportId || !report) {
        throw new Error("Prévia do relatório não está aberta.");
    }

    const signature = computeReportShareSignature(report);
    const generated = await generateStandaloneHtml(preview, notifyFn, {
        silent: true,
        skipLiveLayoutSync: true
    });
    const current =
        preview.engine.get(preview.currentReportId);

    if (
        !current ||
        String(preview.currentReportId) !== String(report.id) ||
        String(current.id) !== String(report.id) ||
        computeReportShareSignature(current) !== signature
    ) {
        return null;
    }

    const file = createHtmlShareFile(generated);
    const cache = {
        reportId: String(report.id),
        signature,
        html: generated.html,
        fileName: generated.fileName,
        reportLabel: generated.reportId,
        bytes: generated.bytes,
        file,
        generated
    };

    preview._htmlShareCache = cache;
    return cache;
}

function notifyExportVisible(preview, notify, message) {
    const text = String(message || "").trim();

    if (typeof notify === "function" && text) {
        notify(text);
    }

    if (
        preview &&
        typeof preview.notifyExportStatus === "function"
    ) {
        preview.notifyExportStatus(text);
    }
}

function alertExportVisible(title, message, tone) {
    if (
        !global.AuroraDialog ||
        typeof global.AuroraDialog.alert !== "function"
    ) {
        return Promise.resolve();
    }

    return global.AuroraDialog.alert(String(message || ""), {
        title: title || "Relatório HTML",
        tone: tone || "info",
        layout: "simple",
        confirmLabel: "Entendi"
    });
}

function triggerHtmlDownload(file) {
    if (!file) {
        throw new Error("Arquivo HTML indisponível.");
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name || "relatorio_aurora.html";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function isHtmlShareFallbackError(error) {
    if (!error) {
        return false;
    }

    const name = String(error.name || "");

    if (name === "NotAllowedError" || name === "SecurityError") {
        return true;
    }

    const message = String(error.message || "").toLowerCase();
    return message.indexOf("permission denied") !== -1;
}

async function fallbackHtmlDownload(preview, notify, generated, file) {
    const notifyFn = typeof notify === "function" ? notify : () => {};
    const fallbackMessage =
        "Este navegador não permitiu abrir a folha nativa de compartilhamento. O relatório HTML foi salvo no dispositivo para envio manual.";

    try {
        triggerHtmlDownload(file);
    } catch (downloadError) {
        const technical =
            downloadError && downloadError.message
                ? String(downloadError.message)
                : "";
        const errorMessage = technical
            ? `Não foi possível compartilhar ou salvar o HTML. ${technical}`
            : "Não foi possível compartilhar ou salvar o HTML";
        notifyExportVisible(preview, notifyFn, errorMessage);
        await alertExportVisible(
            "Não foi possível compartilhar ou salvar o HTML",
            errorMessage,
            "danger"
        );
        downloadError.auroraExportNotified = true;
        throw downloadError;
    }

    notifyExportVisible(preview, notifyFn, "Compartilhamento direto indisponível.");
    await alertExportVisible(
        "Compartilhamento direto indisponível",
        fallbackMessage,
        "info"
    );

    return {
        ...generated,
        folder: "download do navegador",
        shared: false
    };
}

async function shareHtmlFromPreview(preview, notify, options) {
    const notifyFn = typeof notify === "function" ? notify : () => {};
    const activationAtClick =
        options && options.activationAtClick
            ? options.activationAtClick
            : captureUserActivation("click");

    if (preview) {
        preview._htmlShareActivationLog = {
            click: activationAtClick,
            beforeShare: null
        };
    }

    try {
        if (global.__AURORA_ANDROID__) {
            let generated = null;

            if (isPreviewHtmlShareCacheValid(preview)) {
                generated = preview._htmlShareCache.generated;
            } else {
                notifyExportVisible(preview, notifyFn, "Preparando HTML...");
                generated = await generateStandaloneReportHTML(preview, notifyFn);
            }

            notifyExportVisible(preview, notifyFn, "Preparando HTML...");
            await shareHtmlViaNativeBridge(
                generated.fileName,
                generated.html
            );
            notifyExportVisible(preview, notifyFn, "Escolha onde compartilhar.");
            return generated;
        }

        if (preview) {
            preview._htmlShareClickGuard = true;
        }

        try {
            const report =
                preview &&
                preview.engine &&
                typeof preview.engine.get === "function"
                    ? preview.engine.get(preview.currentReportId)
                    : null;

            if (!isPreviewHtmlShareCacheValid(preview, report)) {
                notifyExportVisible(
                    preview,
                    notifyFn,
                    "Preparando relatório..."
                );
                return null;
            }

            const cache = preview._htmlShareCache;
            const htmlFile = cache.file;
            const generated = cache.generated;
            const shareExists = Boolean(
                global.navigator &&
                typeof global.navigator.share === "function"
            );
            const canShareExists = Boolean(
                global.navigator &&
                typeof global.navigator.canShare === "function"
            );
            let canShareFiles = false;

            try {
                canShareFiles = Boolean(
                    shareExists &&
                    canShareExists &&
                    global.navigator.canShare({ files: [htmlFile] })
                );
            } catch (canShareError) {
                canShareFiles = false;
            }

            if (canShareFiles) {
                try {
                    const activationBeforeShare =
                        captureUserActivation("before-share");

                    if (preview._htmlShareActivationLog) {
                        preview._htmlShareActivationLog.beforeShare =
                            activationBeforeShare;
                    }

                    await global.navigator.share(
                        buildHtmlSharePayload(htmlFile, cache.reportLabel)
                    );
                    notifyExportVisible(
                        preview,
                        notifyFn,
                        "HTML compartilhado."
                    );
                    return generated;
                } catch (shareError) {
                    if (shareError && shareError.name === "AbortError") {
                        return null;
                    }

                    if (isHtmlShareFallbackError(shareError)) {
                        return fallbackHtmlDownload(
                            preview,
                            notifyFn,
                            generated,
                            htmlFile
                        );
                    }

                    throw shareError;
                }
            }

            return fallbackHtmlDownload(
                preview,
                notifyFn,
                generated,
                htmlFile
            );
        } finally {
            if (preview) {
                preview._htmlShareClickGuard = false;
            }
        }
    } catch (error) {
        if (error && error.name === "AbortError") {
            notifyExportVisible(preview, notifyFn, "");
            return null;
        }

        if (error && error.auroraExportNotified) {
            throw error;
        }

        const message = error && error.message ? error.message : String(error);
        notifyExportVisible(preview, notifyFn, message);
        await alertExportVisible(
            "Não foi possível compartilhar o HTML",
            message,
            "danger"
        );
        throw error;
    }
}

async function saveHtmlViaNativeBridge(fileName, html) {
    if (
        !global.AuroraAndroid ||
        typeof global.AuroraAndroid.saveHtmlBegin !== "function" ||
        typeof global.AuroraAndroid.saveHtmlAppend !== "function" ||
        typeof global.AuroraAndroid.saveHtmlFinish !== "function"
    ) {
        if (
            !global.AuroraAndroid ||
            typeof global.AuroraAndroid.saveHtmlSnapshot !== "function"
        ) {
            throw new Error("AuroraAndroid.saveHtmlSnapshot indisponível.");
        }

        console.warn("AURORA HTML EXPORT: fallback monolítico (bridge chunked indisponível)");
        const nativePromise = waitForNativeHtmlResult();
        global.AuroraAndroid.saveHtmlSnapshot(fileName, html);
        return nativePromise;
    }

    const chunks = [];

    for (let offset = 0; offset < html.length; offset += HTML_BRIDGE_CHUNK_SIZE) {
        chunks.push(html.slice(offset, offset + HTML_BRIDGE_CHUNK_SIZE));
    }

    console.log(
        "AURORA HTML EXPORT BEGIN",
        {
            fileName,
            totalChars: html.length,
            chunkSize: HTML_BRIDGE_CHUNK_SIZE,
            chunkCount: chunks.length
        }
    );

    const nativePromise = waitForNativeHtmlResult();
    global.AuroraAndroid.saveHtmlBegin(fileName, chunks.length);

    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const accepted = global.AuroraAndroid.saveHtmlAppend(
            chunk,
            index,
            chunks.length
        );

        if (accepted === false) {
            throw new Error(`Falha ao enviar chunk HTML ${index + 1}/${chunks.length}.`);
        }

        console.log(
            "AURORA HTML EXPORT APPEND",
            {
                chunk: `${index + 1}/${chunks.length}`,
                chars: chunk.length
            }
        );
    }

    global.AuroraAndroid.saveHtmlFinish();
    return nativePromise;
}

async function saveHtmlFromPreview(preview, notify) {
    const notifyFn = typeof notify === "function" ? notify : () => {};

    try {
        const generated = await generateStandaloneReportHTML(preview, notifyFn);

        if (global.__AURORA_ANDROID__) {
            showVisibleProgress("Salvando HTML...", notifyFn);
            const nativeResult = await saveHtmlViaNativeBridge(
                generated.fileName,
                generated.html
            );
            const savedName = nativeResult.fileName || generated.fileName;
            const savedBytes = Number(nativeResult.bytes) || generated.bytes;

            if (!nativeResult.ok) {
                throw new Error(nativeResult.error || "Falha na gravação nativa do HTML.");
            }

            showVisibleProgress(`HTML salvo em:\n${HTML_SAVE_FOLDER}`, notifyFn);
            showVisibleProgress(savedName, notifyFn);

            return {
                ...generated,
                fileName: savedName,
                bytes: savedBytes,
                folder: HTML_SAVE_FOLDER
            };
        }

        const file = new File(
            [generated.html],
            generated.fileName,
            { type: "text/html;charset=utf-8" }
        );

        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = generated.fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 500);

        showVisibleProgress(`HTML salvo: ${generated.fileName}`, notifyFn);

        return {
            ...generated,
            folder: "download do navegador"
        };
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        showVisibleError(message, notifyFn, "Falha ao salvar HTML");
        throw error;
    }
}

function registerConsoleHelper(preview) {
    global.auroraGeneratePdf = async (postAction) =>
        generateReportPdf(preview, preview.onNotify, {
            postAction: postAction || "share"
        });

    global.auroraSaveHtml = async () =>
        saveHtmlFromPreview(preview, preview.onNotify);

    global.auroraShareHtml = async () =>
        shareHtmlFromPreview(preview, preview.onNotify);
}

global.AuroraReportExport = {
    generateReportPdf,
    generateStandaloneHtml,
    generateStandaloneReportHTML,
    saveHtmlFromPreview,
    shareHtmlFromPreview,
    prepareHtmlShareForPreview,
    captureUserActivation,
    computeReportShareSignature,
    isPreviewHtmlShareCacheValid,
    getPreviewHtmlShareCache,
    clearPreviewHtmlShareCache,
    createHtmlShareFile,
    buildHtmlSharePayload,
    HTML_SHARE_MIME,
    buildPrintStageFromPreview,
    cleanupPreviewPrintArtifacts,
    PDF_SAVE_FOLDER,
    HTML_SAVE_FOLDER
};

global.AuroraPdfLocalTest = {
    generateFromPreview: generateReportPdf,
    registerConsoleHelper,
    buildPrintStageFromPreview
};

})(window);

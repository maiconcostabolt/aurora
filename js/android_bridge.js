(function (global) {
"use strict";

function visible(element) {
    if (!element || element.hidden || element.style.display === "none") return false;
    const style = global.getComputedStyle ? global.getComputedStyle(element) : null;
    return !style || (style.display !== "none" && style.visibility !== "hidden");
}

function isFinalReportShareActive() {
    const preview = global.auroraReportPreview;
    return Boolean(
        preview &&
        (preview._htmlShareClickGuard || preview._pdfShareClickGuard)
    );
}

function closeFinalReportAndReturnHome() {
    const preview = global.auroraReportPreview;

    if (isFinalReportShareActive()) {
        return true;
    }

    if (
        preview &&
        typeof preview.closeAndReturnHome === "function"
    ) {
        preview.closeAndReturnHome();
        return true;
    }

    const report = document.querySelector(".aurora-report-preview.is-open");
    if (!report) {
        return false;
    }

    const close = report.querySelector("[data-report-close]");
    if (close) close.click();
    return true;
}

function closeTopOverlay() {
    if (isFinalReportShareActive()) return true;

    const report = document.querySelector(".aurora-report-preview.is-open");
    if (report) {
        return closeFinalReportAndReturnHome();
    }

    const companyModal = document.querySelector("[data-company-modal]:not([hidden])");
    if (companyModal) {
        if (
            global.AuroraProfileNavigation &&
            typeof global.AuroraProfileNavigation.isCompanyLogoPickerActive === "function" &&
            global.AuroraProfileNavigation.isCompanyLogoPickerActive()
        ) {
            return true;
        }
        const back = companyModal.querySelector("[data-company-back]");
        if (back) {
            back.click();
            return true;
        }
        const close = companyModal.querySelector("[data-company-close]");
        if (close) {
            close.click();
            return true;
        }
    }

    const selectors = [
        ".aurora-settings-modal.is-open",
        ".aurora-custom-service-modal.is-open",
        ".aurora-modal.is-open",
        ".aurora-dialog.is-open",
        "[role='dialog'].is-open"
    ];
    const modal = document.querySelector(selectors.join(","));
    if (modal) {
        const close = modal.querySelector("[data-settings-close],[data-custom-service-close],[data-close],[data-modal-close],[aria-label='Fechar']");
        if (close) close.click();
        else modal.classList.remove("is-open");
        return true;
    }
    return false;
}

function handleBack() {
    if (closeTopOverlay()) return true;

    if (
        global.AuroraAssetsPilot &&
        typeof global.AuroraAssetsPilot.closeIfOpen === "function" &&
        global.AuroraAssetsPilot.closeIfOpen()
    ) {
        return true;
    }

    const reports = document.querySelector(".aurora-reports-layer");
    if (visible(reports)) {
        const home = document.querySelector("[data-footer-home],[data-topbar-home]");
        if (home) home.click();
        return true;
    }

    const workflow = document.querySelector(".aurora-workflow-layer");
    if (visible(workflow)) {
        const runtime = global.auroraRuntime;
        if (runtime && Number.isFinite(runtime.currentIndex) && runtime.currentIndex > 0 && typeof runtime.previous === "function") {
            runtime.previous().catch(console.error);
            return true;
        }
        if (
            global.AuroraHomeReturnTrace &&
            typeof global.AuroraHomeReturnTrace.setNextHomeOrigin === "function"
        ) {
            global.AuroraHomeReturnTrace.setNextHomeOrigin(
                "ANDROID_BACK",
                runtime && runtime.currentIndex === 0
                    ? "WORKFLOW_INDEX_0"
                    : "WORKFLOW_HOME"
            );
        }
        const home = document.querySelector("[data-footer-home],[data-topbar-home]");
        if (home) { home.click(); return true; }
    }

    const homeLayer = document.querySelector(".aurora-home-layer");
    return !visible(homeLayer);
}

global.AuroraAndroidBack = { handle: handleBack };
})(window);

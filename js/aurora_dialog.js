(function (global) {
"use strict";

const queue = [];
let active = false;
let backCancelHandler = null;

function icon(type) {
    const paths = {
        danger: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
        success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>',
        input: '<path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-9h.01"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type] || paths.info}</svg>`;
}

function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function buildDialogMarkup(options) {
    const kind = options.kind || "confirm";
    const tone = options.tone || (kind === "confirm" ? "info" : kind);
    const layout = options.layout || "default";
    const title = options.title || "Mensagem da Aurora";
    const message = String(options.message || "");
    const hideBrand = options.hideBrand === true || layout === "simple";
    const showMessage = Boolean(message) && message !== title;
    const cancelLabel = escapeHtml(options.cancelLabel || "Cancelar");
    const confirmLabel = escapeHtml(
        options.confirmLabel || (kind === "alert" ? "Entendi" : "Confirmar")
    );
    const cancelButton =
        kind !== "alert"
            ? `<button type="button" class="is-secondary" data-aurora-dialog-cancel>${cancelLabel}</button>`
            : "";
    const promptField =
        kind === "prompt"
            ? (options.inputType === "password"
                ? `<label class="aurora-dialog__field"><span>${escapeHtml(options.fieldLabel || "Digite abaixo")}</span><input type="password" data-aurora-dialog-input autocomplete="current-password" maxlength="128"></label>`
                : `<label class="aurora-dialog__field"><span>${escapeHtml(options.fieldLabel || "Digite abaixo")}</span><textarea data-aurora-dialog-input rows="3" maxlength="500">${escapeHtml(options.value || "")}</textarea></label>`)
            : "";

    if (layout === "simple") {
        return [
            `<section class="aurora-dialog aurora-dialog--simple is-${tone}" role="dialog" aria-modal="true" aria-labelledby="aurora-dialog-title">`,
            `<div class="aurora-dialog__copy aurora-dialog__copy--simple">`,
            `<h2 id="aurora-dialog-title">${escapeHtml(title)}</h2>`,
            showMessage ? `<p>${escapeHtml(message)}</p>` : "",
            `</div>`,
            promptField,
            `<div class="aurora-dialog__actions aurora-dialog__actions--simple">${cancelButton}<button type="button" class="is-primary" data-aurora-dialog-confirm>${confirmLabel}</button></div>`,
            `</section>`
        ].join("");
    }

    const brandHtml = hideBrand ? "" : `<span>Aurora</span>`;
    return [
        `<section class="aurora-dialog is-${tone}" role="dialog" aria-modal="true" aria-labelledby="aurora-dialog-title">`,
        `<div class="aurora-dialog__icon">${icon(tone === "input" ? "input" : tone)}</div>`,
        `<div class="aurora-dialog__copy">${brandHtml}<h2 id="aurora-dialog-title">${escapeHtml(title)}</h2>`,
        showMessage ? `<p>${escapeHtml(message)}</p>` : `<p></p>`,
        `</div>`,
        promptField,
        `<div class="aurora-dialog__actions">${cancelButton}<button type="button" class="is-primary" data-aurora-dialog-confirm>${confirmLabel}</button></div>`,
        `</section>`
    ].join("");
}

function next() {
    if (active || !queue.length) return;
    active = true;
    const item = queue.shift();
    const options = item.options;
    const kind = options.kind || "confirm";
    const layout = options.layout || "default";
    const root = document.createElement("div");
    root.className = "aurora-dialog-backdrop";
    if (layout === "simple" || options.centered === true) {
        root.classList.add("aurora-dialog-backdrop--centered");
    }
    root.innerHTML = buildDialogMarkup(options);
    document.body.appendChild(root);
    document.documentElement.classList.add("aurora-dialog-open");

    const input = root.querySelector("[data-aurora-dialog-input]");
    const cancelButton = root.querySelector("[data-aurora-dialog-cancel]");

    const close = (value) => {
        if (options.interceptBack) {
            backCancelHandler = null;
        }
        root.classList.add("is-leaving");
        window.setTimeout(() => {
            root.remove();
            document.documentElement.classList.remove("aurora-dialog-open");
            active = false;
            item.resolve(value);
            next();
        }, 180);
    };

    const cancel = () => close(kind === "prompt" ? null : false);

    if (cancelButton) {
        cancelButton.addEventListener("click", cancel);
    }

    root.querySelector("[data-aurora-dialog-confirm]").addEventListener("click", () => {
        if (typeof options.onConfirmSync === "function") {
            try {
                options.onConfirmSync();
            } catch (error) {
                console.error(error);
            }
        }
        const promptValue = input ? String(input.value || "") : "";
        if (input && input.type === "password") {
            input.value = "";
        }
        close(kind === "prompt" ? promptValue : true);
    });

    root.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && cancelButton) {
            cancel();
        }
        if (event.key === "Enter" && !event.shiftKey && kind !== "prompt") {
            root.querySelector("[data-aurora-dialog-confirm]").click();
        }
        if (event.key === "Enter" && kind === "prompt" && input && input.type === "password") {
            event.preventDefault();
            root.querySelector("[data-aurora-dialog-confirm]").click();
        }
    });

    if (options.interceptBack) {
        backCancelHandler = cancel;
    }

    window.setTimeout(() => (input || root.querySelector("[data-aurora-dialog-confirm]")).focus(), 40);
}

function open(options) {
    return new Promise((resolve) => {
        queue.push({ options, resolve });
        next();
    });
}

function consumeBackPress() {
    if (typeof backCancelHandler === "function") {
        backCancelHandler();
        return true;
    }
    return false;
}

function isOpen() {
    return active || Boolean(backCancelHandler);
}

global.AuroraDialog = {
    alert(message, options = {}) {
        return open({ ...options, kind: "alert", message });
    },
    confirm(message, options = {}) {
        return open({ ...options, kind: "confirm", message });
    },
    prompt(message, value = "", options = {}) {
        return open({ ...options, kind: "prompt", tone: "input", message, value });
    },
    open,
    consumeBackPress,
    isOpen
};
})(window);

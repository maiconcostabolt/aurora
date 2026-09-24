(function (global) {
"use strict";

let deferredPrompt = null;
let registration = null;

function isAndroidWrapper() {
    return (
        global.__AURORA_ANDROID__ === true ||
        global.location.protocol === "file:"
    );
}

function isStandalone() {
    return (
        global.matchMedia("(display-mode: standalone)").matches ||
        global.navigator.standalone === true
    );
}

function isIOS() {
    return /iphone|ipad|ipod/i.test(
        global.navigator.userAgent || ""
    );
}

function isSecureForPWA() {
    return (
        global.isSecureContext ||
        ["localhost", "127.0.0.1"].includes(
            global.location.hostname
        )
    );
}

function createUI() {
    if (isAndroidWrapper()) {
        return;
    }

    if (
        document.querySelector(
            "[data-pwa-install-panel]"
        )
    ) {
        return;
    }

    const panel =
        document.createElement("section");

    panel.className =
        "aurora-pwa-install";

    panel.setAttribute(
        "data-pwa-install-panel",
        ""
    );

    panel.hidden = true;

    panel.innerHTML = [
        '<div class="aurora-pwa-install__icon">A</div>',
        '<div class="aurora-pwa-install__content">',
        '<strong data-pwa-title>Instalar Aurora</strong>',
        '<small data-pwa-message>Adicione a Aurora à tela inicial.</small>',
        '</div>',
        '<button type="button" data-pwa-action>Instalar</button>',
        '<button type="button" class="aurora-pwa-install__close" data-pwa-close aria-label="Fechar">×</button>'
    ].join("");

    document.body.appendChild(panel);

    panel.querySelector("[data-pwa-close]")
        .addEventListener("click", () => {
            panel.hidden = true;
            sessionStorage.setItem(
                "aurora_pwa_prompt_dismissed",
                "1"
            );
        });

    panel.querySelector("[data-pwa-action]")
        .addEventListener("click", async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();

                const choice =
                    await deferredPrompt.userChoice;

                deferredPrompt = null;

                panel.hidden = true;

                console.log(
                    "Aurora PWA install choice:",
                    choice.outcome
                );

                return;
            }

            if (isIOS()) {
                await global.AuroraDialog.alert("No iPhone, toque em Compartilhar e depois em “Adicionar à Tela de Início”.", { title: "Instalar a Aurora" });
                return;
            }

            await global.AuroraDialog.alert("Abra o menu do navegador e selecione “Instalar aplicativo” ou “Adicionar à tela inicial”.", { title: "Instalar a Aurora" });
        });

    updatePanel(panel);
}

function updatePanel(panel) {
    if (
        isStandalone() ||
        sessionStorage.getItem(
            "aurora_pwa_prompt_dismissed"
        ) === "1"
    ) {
        panel.hidden = true;
        return;
    }

    const title =
        panel.querySelector(
            "[data-pwa-title]"
        );

    const message =
        panel.querySelector(
            "[data-pwa-message]"
        );

    const action =
        panel.querySelector(
            "[data-pwa-action]"
        );

    if (!isSecureForPWA()) {
        title.textContent =
            "PWA requer HTTPS";

        message.textContent =
            "Publique a Aurora em HTTPS para instalar no celular.";

        action.textContent =
            "Como publicar";

        panel.hidden = false;
        return;
    }

    if (isIOS()) {
        title.textContent =
            "Instalar no iPhone";

        message.textContent =
            "Use Compartilhar → Adicionar à Tela de Início.";

        action.textContent =
            "Ver instrução";

        panel.hidden = false;
        return;
    }

    if (deferredPrompt) {
        title.textContent =
            "Instalar Aurora";

        message.textContent =
            "Abra em tela cheia como um aplicativo.";

        action.textContent =
            "Instalar";

        panel.hidden = false;
    }
}

async function registerServiceWorker() {
    if (isAndroidWrapper()) {
        return;
    }

    if (
        !("serviceWorker" in navigator) ||
        !isSecureForPWA()
    ) {
        return;
    }

    try {
        try { window.dispatchEvent(new CustomEvent("aurora:sw-trace", { detail: { phase: "REGISTER_START" } })); } catch (_) {}
        registration =
            await navigator.serviceWorker.register(
            "./service_worker.js?v=AURORA_V47_RC1_R60_COMMERCIAL_DIAG_UI_REMOVAL",
                {
                    scope: "./",
                    updateViaCache: "none"
                }
            );
        try { window.__AURORA_SW_REGISTRATION = registration; window.dispatchEvent(new CustomEvent("aurora:sw-trace", { detail: { phase: "REGISTER_OK" } })); } catch (_) {}

        // R33 diagnóstico: força a verificação, mas expõe o resultado na própria tela.
        try { await registration.update(); window.dispatchEvent(new CustomEvent("aurora:sw-trace", { detail: { phase: "UPDATE_OK" } })); }
        catch (error) { try { window.__AURORA_SW_TRACE_ERROR = String(error && (error.stack || error.message) || error); window.dispatchEvent(new CustomEvent("aurora:sw-trace", { detail: { phase: "UPDATE_ERROR", error: window.__AURORA_SW_TRACE_ERROR } })); } catch (_) {} }

        // A atualização do Service Worker não é mais forçada durante o boot.
        // O próprio ciclo do navegador verifica novas versões sem reiniciar a Aurora.

        registration.addEventListener(
            "updatefound",
            () => {
                const worker =
                    registration.installing;

                if (!worker) {
                    return;
                }

                worker.addEventListener(
                    "statechange",
                    () => {
                        if (
                            worker.state === "installed" &&
                            navigator.serviceWorker.controller
                        ) {
                            showUpdateReady();
                        }
                    }
                );
            }
        );

        navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
                const explicitUpdate = global.__AURORA_PWA_EXPLICIT_UPDATE === true;
                if (global.AuroraHomeReturnTrace) {
                    global.AuroraHomeReturnTrace.logSwControllerChange({
                        reloadRequested: explicitUpdate ? "SIM_USUARIO" : "NAO_BOOT_UNICO"
                    });
                }
                // Nunca recarrega a Aurora só porque um SW assumiu o controle.
                // Reload só ocorre quando o próprio usuário pediu "Atualizar".
                if (explicitUpdate) {
                    global.__AURORA_PWA_EXPLICIT_UPDATE = false;
                    global.location.reload();
                }
            }
        );

        console.log(
            "Aurora PWA registrada:",
            registration.scope
        );
    } catch (error) {
        console.warn(
            "Falha ao registrar PWA:",
            error
        );
    }
}

function showUpdateReady() {
    const panel =
        document.querySelector(
            "[data-pwa-install-panel]"
        );

    if (!panel) {
        return;
    }

    panel.querySelector(
        "[data-pwa-title]"
    ).textContent =
        "Nova versão disponível";

    panel.querySelector(
        "[data-pwa-message]"
    ).textContent =
        "Atualize para carregar as últimas correções.";

    const button =
        panel.querySelector(
            "[data-pwa-action]"
        );

    button.textContent =
        "Atualizar";

    button.onclick =
        () => {
            if (
                registration &&
                registration.waiting
            ) {
                global.__AURORA_PWA_EXPLICIT_UPDATE = true;
                registration.waiting.postMessage({
                    type: "SKIP_WAITING"
                });
            } else {
                global.location.reload();
            }
        };

    panel.hidden = false;
}

global.addEventListener(
    "beforeinstallprompt",
    (event) => {
        event.preventDefault();
        deferredPrompt = event;

        const panel =
            document.querySelector(
                "[data-pwa-install-panel]"
            );

        if (panel) {
            updatePanel(panel);
        }
    }
);

global.addEventListener(
    "appinstalled",
    () => {
        deferredPrompt = null;

        const panel =
            document.querySelector(
                "[data-pwa-install-panel]"
            );

        if (panel) {
            panel.hidden = true;
        }

        console.log(
            "Aurora instalada com sucesso."
        );
    }
);

global.addEventListener(
    "online",
    () => document.body.classList.remove(
        "aurora-is-offline"
    )
);

global.addEventListener(
    "offline",
    () => document.body.classList.add(
        "aurora-is-offline"
    )
);

document.addEventListener(
    "DOMContentLoaded",
    () => {
        createUI();
        registerServiceWorker();

        document.body.classList.toggle(
            "aurora-is-offline",
            !navigator.onLine
        );
    }
);

global.AuroraPWA = {
    install() {
        const panel =
            document.querySelector(
                "[data-pwa-install-panel]"
            );

        if (panel) {
            sessionStorage.removeItem(
                "aurora_pwa_prompt_dismissed"
            );

            panel.hidden = false;
            updatePanel(panel);
        }
    },
    isStandalone,
    registration() {
        return registration;
    }
};

})(window);

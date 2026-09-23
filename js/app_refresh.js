(function (global) {
    "use strict";
    if (global.AuroraRefreshGesture) return;

    let startY = null;
    let tracking = false;
    let running = false;
    let distance = 0;
    const threshold = 72;
    const limit = 108;

    const indicator = document.createElement("div");
    indicator.className = "aurora-pull-refresh";
    indicator.setAttribute("aria-hidden", "true");
    indicator.innerHTML = '<span>↻</span><small>Puxe para atualizar</small>';
    document.body.appendChild(indicator);

    function content() { return document.querySelector(".aurora-home-layer:not([hidden])"); }
    function paint(value) {
        distance = Math.max(0, Math.min(limit, value));
        const host = content();
        if (host) host.style.setProperty("--aurora-pull-distance", `${distance}px`);
        indicator.style.setProperty("--aurora-pull-distance", `${distance}px`);
        indicator.classList.toggle("is-visible", distance > 4);
        indicator.classList.toggle("is-ready", distance >= threshold);
        const label = indicator.querySelector("small");
        if (label) label.textContent = distance >= threshold ? "Solte para atualizar" : "Puxe para atualizar";
    }
    function reset() {
        paint(0);
        tracking = false;
        startY = null;
    }
    function notify(message) {
        const status = document.querySelector("[data-aurora-status], .aurora-toast, .aurora-status");
        if (!status) return;
        status.textContent = message;
        status.hidden = false;
        status.classList.add("is-visible");
        global.setTimeout(() => status.classList.remove("is-visible"), 3200);
    }

    function blockedTarget(target) {
        return Boolean(target && target.closest("input,textarea,select,[role='dialog'],.is-open"));
    }

    async function run() {
        if (running) return false;
        const ui = global.AuroraUi;
        if (!ui || typeof ui.refreshData !== "function") return false;
        running = true;
        document.documentElement.classList.add("aurora-refreshing");
        try {
            if (global.AuroraSupport && typeof global.AuroraSupport.ensureNativePermission === "function") {
                await global.AuroraSupport.ensureNativePermission();
            }
            await ui.refreshData();
            return true;
        }
        catch (error) {
            notify("Não foi possível atualizar agora.");
            throw error;
        }
        finally { running = false; document.documentElement.classList.remove("aurora-refreshing"); }
    }

    document.addEventListener("touchstart", (event) => {
        if (global.scrollY > 0 || event.touches.length !== 1 || blockedTarget(event.target)) return;
        startY = event.touches[0].clientY;
        tracking = true;
        paint(0);
    }, { passive: true });

    document.addEventListener("touchmove", (event) => {
        if (!tracking || startY == null || event.touches.length !== 1) return;
        const raw = event.touches[0].clientY - startY;
        if (raw <= 0) { reset(); return; }
        if (global.scrollY <= 0) {
            event.preventDefault();
            paint(raw * 0.58);
        }
    }, { passive: false });

    document.addEventListener("touchend", (event) => {
        if (!tracking || startY == null) return;
        const shouldRun = distance >= threshold && global.scrollY <= 0;
        reset();
        if (shouldRun) run().catch((error) => console.warn("Aurora: atualização pendente.", error));
    }, { passive: true });

    document.addEventListener("touchcancel", reset, { passive: true });

    global.AuroraRefreshGesture = { run };
})(window);

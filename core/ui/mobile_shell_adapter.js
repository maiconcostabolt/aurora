(function (global) {
"use strict";

class MobileShellAdapter {
    constructor(options = {}) {
        if (!options.shell) {
            throw new Error(
                "MobileShellAdapter requires an AppShell."
            );
        }

        this.shell =
            options.shell;

        this.container =
            this.shell.container;

        this.opened = false;
        this.bound = false;
    }

    mount() {
        if (this.bound) {
            return this.getState();
        }

        const topbar =
            this.container.querySelector(
                "[data-shell-part='topbar']"
            );

        const sidebar =
            this.container.querySelector(
                "[data-shell-part='sidebar']"
            );

        if (!topbar || !sidebar) {
            throw new Error(
                "Application Shell must be mounted first."
            );
        }

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";
        button.className =
            "aurora-mobile-menu-button";
        button.setAttribute(
            "data-mobile-menu-toggle",
            ""
        );
        button.setAttribute(
            "aria-label",
            "Abrir menu"
        );
        button.setAttribute(
            "aria-expanded",
            "false"
        );
        button.textContent = "☰";

        topbar.insertBefore(
            button,
            topbar.firstChild
        );

        const overlay =
            document.createElement(
                "button"
            );

        overlay.type = "button";
        overlay.className =
            "aurora-mobile-overlay";
        overlay.setAttribute(
            "data-mobile-overlay",
            ""
        );
        overlay.setAttribute(
            "aria-label",
            "Fechar menu"
        );

        this.container.appendChild(
            overlay
        );

        button.addEventListener(
            "click",
            () => {
                this.toggle();
            }
        );

        overlay.addEventListener(
            "click",
            () => {
                this.close();
            }
        );

        sidebar.addEventListener(
            "click",
            (event) => {
                if (
                    event.target.closest(
                        "[data-shell-nav]"
                    )
                ) {
                    this.close();
                }
            }
        );

        window.addEventListener(
            "resize",
            () => {
                if (
                    window.innerWidth >
                    760
                ) {
                    this.close();
                }
            }
        );

        this.bound = true;

        return this.getState();
    }

    open() {
        this.opened = true;

        this.container.classList.add(
            "aurora-mobile-menu-open"
        );

        const button =
            this.container.querySelector(
                "[data-mobile-menu-toggle]"
            );

        if (button) {
            button.setAttribute(
                "aria-expanded",
                "true"
            );
            button.setAttribute(
                "aria-label",
                "Fechar menu"
            );
        }

        return this.getState();
    }

    close() {
        this.opened = false;

        this.container.classList.remove(
            "aurora-mobile-menu-open"
        );

        const button =
            this.container.querySelector(
                "[data-mobile-menu-toggle]"
            );

        if (button) {
            button.setAttribute(
                "aria-expanded",
                "false"
            );
            button.setAttribute(
                "aria-label",
                "Abrir menu"
            );
        }

        return this.getState();
    }

    toggle() {
        return this.opened
            ? this.close()
            : this.open();
    }

    getState() {
        return {
            mounted:
                this.bound,
            opened:
                this.opened
        };
    }
}

global.MobileShellAdapter =
    MobileShellAdapter;

})(window);
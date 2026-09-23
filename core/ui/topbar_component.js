(function (global) {
"use strict";

class TopBarComponent {
    constructor(options = {}) {
        this.title =
            options.title ||
            "AURORA";

        this.subtitle =
            options.subtitle ||
            "Atendimento técnico";

        this.userName =
            options.userName ||
            "Usuário";

        this.onThemeToggle =
            typeof options.onThemeToggle === "function"
                ? options.onThemeToggle
                : null;

        this.onHome =
            typeof options.onHome === "function"
                ? options.onHome
                : null;

        this.onUserMenu =
            typeof options.onUserMenu === "function"
                ? options.onUserMenu
                : null;
    }

    render() {
        const initial =
            String(
                this.userName ||
                "U"
            )
                .trim()
                .charAt(0)
                .toUpperCase() ||
            "U";

        return [
            '<header class="aurora-topbar" data-shell-part="topbar">',

            '<button type="button"',
            ' class="aurora-topbar__brand"',
            ' data-topbar-home',
            ' aria-label="Voltar para a tela principal da Aurora">',
            `<h1>${this.escape(this.title)}</h1>`,
            `<p>${this.escape(this.subtitle)}</p>`,
            '</button>',

            '<div class="aurora-topbar__actions">',

            '<button type="button"',
            ' class="aurora-user-chip"',
            ' data-user-menu',
            ' aria-label="Abrir configurações">',
            `<span class="aurora-user-chip__avatar">${initial}</span>`,
            `<span data-topbar-user-name>${this.escape(this.userName)}</span>`,
            '<span class="aurora-user-chip__chevron">⌄</span>',
            '</button>',

            '</div>',
            '</header>'
        ].join("");
    }

    bind(container) {
        const themeButton =
            container.querySelector(
                "[data-theme-toggle]"
            );

        const homeButton =
            container.querySelector(
                "[data-topbar-home]"
            );

        const userButton =
            container.querySelector(
                "[data-user-menu]"
            );

        if (
            themeButton &&
            this.onThemeToggle
        ) {
            themeButton.addEventListener(
                "click",
                () => {
                    this.onThemeToggle();
                }
            );
        }

        if (
            homeButton &&
            this.onHome
        ) {
            homeButton.addEventListener(
                "click",
                () => {
                    this.onHome();
                }
            );
        }

        if (
            userButton &&
            this.onUserMenu
        ) {
            userButton.addEventListener(
                "click",
                () => {
                    this.onUserMenu();
                }
            );
        }
    }

    updateUser(
        container,
        userName
    ) {
        this.userName =
            userName ||
            "Usuário";

        const name =
            container.querySelector(
                "[data-topbar-user-name]"
            );

        const avatar =
            container.querySelector(
                ".aurora-user-chip__avatar"
            );

        if (name) {
            name.textContent =
                this.userName;
        }

        if (avatar) {
            avatar.textContent =
                this.userName
                    .trim()
                    .charAt(0)
                    .toUpperCase() ||
                "U";
        }
    }

    escape(value) {
        return String(
            value ?? ""
        )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

global.TopBarComponent =
    TopBarComponent;

})(window);

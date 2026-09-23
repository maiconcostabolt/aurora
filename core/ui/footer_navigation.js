(function (global) {
"use strict";

class FooterNavigation {
    constructor(options = {}) {
        this.onHome =
            typeof options.onHome === "function"
                ? options.onHome
                : null;

        this.onReports =
            typeof options.onReports === "function"
                ? options.onReports
                : null;

        /*
         * Compatibilidade com versões antigas.
         * Não são exibidos no rodapé principal, mas continuam
         * disponíveis para o Runtime caso algum código legado use.
         */
        this.onPrevious =
            typeof options.onPrevious === "function"
                ? options.onPrevious
                : null;

        this.onNext =
            typeof options.onNext === "function"
                ? options.onNext
                : null;

        this.activeId =
            options.activeId ||
            "home";

        this.bound =
            false;
    }

    render() {
        return [
            '<footer class="aurora-footer-nav aurora-footer-nav--main" data-shell-part="footer">',
            '<button type="button"',
            ' class="aurora-footer-nav__item is-active"',
            ' data-footer-home',
            ' aria-label="Abrir início">',
            '<span class="aurora-footer-nav__icon" aria-hidden="true">⌂</span>',
            '<span>Início</span>',
            '</button>',

            '<button type="button"',
            ' class="aurora-footer-nav__item"',
            ' data-footer-reports',
            ' aria-label="Abrir relatórios">',
            '<span class="aurora-footer-nav__icon" aria-hidden="true">▤</span>',
            '<span>Relatório</span>',
            '</button>',
            '</footer>'
        ].join("");
    }

    bind(container) {
        if (
            !container ||
            this.bound
        ) {
            return;
        }

        const home =
            container.querySelector(
                "[data-footer-home]"
            );

        const reports =
            container.querySelector(
                "[data-footer-reports]"
            );

        if (home) {
            home.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();

                    this.setActive(
                        container,
                        "home"
                    );

                    if (this.onHome) {
                        this.onHome();
                    }
                }
            );
        }

        if (reports) {
            reports.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();

                    this.setActive(
                        container,
                        "reports"
                    );

                    if (this.onReports) {
                        this.onReports();
                    }
                }
            );
        }

        this.bound =
            true;

        this.setActive(
            container,
            this.activeId
        );
    }

    setActive(
        container,
        id
    ) {
        this.activeId =
            id === "reports"
                ? "reports"
                : "home";

        const home =
            container.querySelector(
                "[data-footer-home]"
            );

        const reports =
            container.querySelector(
                "[data-footer-reports]"
            );

        if (home) {
            home.classList.toggle(
                "is-active",
                this.activeId === "home"
            );

            home.setAttribute(
                "aria-current",
                this.activeId === "home"
                    ? "page"
                    : "false"
            );
        }

        if (reports) {
            reports.classList.toggle(
                "is-active",
                this.activeId === "reports"
            );

            reports.setAttribute(
                "aria-current",
                this.activeId === "reports"
                    ? "page"
                    : "false"
            );
        }
    }

    /*
     * O Runtime ainda chama updateNavigationState durante o
     * workflow. O rodapé Home/Relatório não deve ser substituído
     * por Anterior/Próximo, então mantemos este método como
     * compatibilidade segura.
     */
    update(container, state = {}) {
        if (
            state.footer_active_id
        ) {
            this.setActive(
                container,
                state.footer_active_id
            );
        }
    }

    getState() {
        return {
            active_id:
                this.activeId,
            bound:
                this.bound
        };
    }
}

global.FooterNavigation =
    FooterNavigation;

})(window);

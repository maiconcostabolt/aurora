(function (global) {
"use strict";

class AppShell {
    constructor(options = {}) {
        if (
            !options.container ||
            typeof options.container.innerHTML !== "string"
        ) {
            throw new Error(
                "AppShell requires a valid container."
            );
        }

        this.container =
            options.container;

        this.themeManager =
            options.themeManager ||
            new global.ThemeManager();

        this.events =
            new Map();

        this.sidebar =
            new global.SidebarComponent({
                items:
                    options.navigationItems || [],
                activeId:
                    options.activeNavigationId || null,
                onSelect:
                    (id) => {
                        this.emit(
                            "navigation_selected",
                            {id}
                        );
                    }
            });

        this.topbar =
            new global.TopBarComponent({
                title:
                    options.title ||
                    "Aurora Inspector",
                subtitle:
                    options.subtitle ||
                    "Atendimento técnico",
                userName:
                    options.userName ||
                    "Usuário",

                onThemeToggle:
                    () => {
                        const theme =
                            this.themeManager.toggle();

                        this.emit(
                            "theme_changed",
                            {theme}
                        );
                    },

                onHome:
                    () => {
                        this.emit(
                            "home_requested",
                            {}
                        );
                    },

                onUserMenu:
                    () => {
                        this.emit(
                            "user_menu_requested",
                            {}
                        );
                    }
            });

        this.footer =
            new global.FooterNavigation({
                activeId:
                    "home",

                onHome:
                    () => {
                        this.emit(
                            "home_requested",
                            {}
                        );
                    },

                onReports:
                    () => {
                        this.showReports();
                    },

                onPrevious:
                    () => {
                        this.emit(
                            "previous_requested",
                            {}
                        );
                    },

                onNext:
                    () => {
                        this.emit(
                            "next_requested",
                            {}
                        );
                    }
            });

        this.mounted =
            false;
    }

    mount() {
        this.themeManager.apply();

        this.container.innerHTML = [
            '<div class="aurora-shell" data-app-shell>',
            this.sidebar.render(),

            '<div class="aurora-shell__main">',
            this.topbar.render(),

            '<main class="aurora-shell__content" data-shell-content>',
            '<section class="aurora-empty-state">',
            '<div class="aurora-empty-state__icon">✦</div>',
            '<h2>Aurora pronta</h2>',
            '<p>Preparando seu ambiente.</p>',
            '</section>',
            '</main>',

            this.footer.render(),
            '</div>',
            '</div>'
        ].join("");

        this.sidebar.bind(
            this.container
        );

        this.topbar.bind(
            this.container
        );

        this.footer.bind(
            this.container
        );

        this.mounted =
            true;

        this.emit(
            "mounted",
            this.getState()
        );

        return this.getState();
    }

    getContentHost() {
        return this.container.querySelector(
            "[data-shell-content]"
        );
    }

    setContent(html) {
        const host =
            this.getContentHost();

        if (!host) {
            throw new Error(
                "Shell content host not found."
            );
        }

        host.innerHTML =
            typeof html === "string"
                ? html
                : "";

        return host;
    }

    showHome() {
        this.emit(
            "home_requested",
            {}
        );
    }

    showReports() {
        this.emit(
            "reports_requested",
            {}
        );
    }

    showWorkflow() {
        this.emit(
            "workflow_requested",
            {}
        );
    }

    scrollContentTop() {
        const host =
            this.getContentHost();

        if (host) {
            host.scrollTo({
                top: 0,
                behavior: "auto"
            });
        }

        window.scrollTo({
            top: 0,
            behavior: "auto"
        });
    }

    setActiveNavigation(id) {
        this.sidebar.setActive(
            id,
            this.container
        );
    }

    setNavigationItems(items = [], activeId = null) {
        this.sidebar.items = Array.isArray(items) ? items : [];

        if (activeId) {
            this.sidebar.activeId = activeId;
        }

        if (this.mounted) {
            this.sidebar.refresh(this.container);
        }
    }

    setFooterActive(id) {
        this.footer.setActive(
            this.container,
            id
        );
    }

    updateUser(userName) {
        if (
            this.topbar &&
            typeof this.topbar.updateUser ===
            "function"
        ) {
            this.topbar.updateUser(
                this.container,
                userName
            );
        }
    }

    updateNavigationState(state = {}) {
        this.footer.update(
            this.container,
            state
        );

        this.emit(
            "workflow_navigation_changed",
            state
        );
    }

    on(eventName, listener) {
        if (
            typeof listener !==
            "function"
        ) {
            throw new Error(
                "Listener must be a function."
            );
        }

        if (
            !this.events.has(
                eventName
            )
        ) {
            this.events.set(
                eventName,
                new Set()
            );
        }

        this.events
            .get(eventName)
            .add(listener);

        return () => {
            const listeners =
                this.events.get(
                    eventName
                );

            if (listeners) {
                listeners.delete(
                    listener
                );
            }
        };
    }

    emit(eventName, payload) {
        const listeners =
            this.events.get(
                eventName
            );

        if (!listeners) {
            return;
        }

        listeners.forEach(
            (listener) => {
                try {
                    listener(payload);
                } catch (error) {
                    console.error(
                        `AppShell event error: ${eventName}`,
                        error
                    );
                }
            }
        );
    }

    getState() {
        return {
            mounted:
                this.mounted,
            theme:
                this.themeManager.getCurrent(),
            active_navigation_id:
                this.sidebar.activeId,
            footer_active_id:
                this.footer.activeId,
            has_content_host:
                Boolean(
                    this.getContentHost()
                )
        };
    }
}

global.AppShell =
    AppShell;

})(window);

(function (global) {
"use strict";

class SidebarComponent {
    constructor(options = {}) {
        this.items =
            Array.isArray(options.items)
                ? options.items
                : [];

        this.activeId =
            options.activeId ||
            null;

        this.onSelect =
            typeof options.onSelect === "function"
                ? options.onSelect
                : null;
    }

    render() {
        return [
            '<aside class="aurora-sidebar" data-shell-part="sidebar">',
            '<div class="aurora-sidebar__brand">',
            '<div class="aurora-sidebar__logo">A</div>',
            '<div>',
            '<strong>Aurora</strong>',
            '<span>Inspector</span>',
            '</div>',
            '</div>',
            '<nav class="aurora-sidebar__nav">',
            this.items.map((item) => {
                const active =
                    item.id === this.activeId
                        ? " is-active"
                        : "";

                return [
                    `<button type="button" class="aurora-sidebar__item${active}" data-shell-nav="${item.id}">`,
                    `<span class="aurora-sidebar__icon">${item.icon || "•"}</span>`,
                    `<span>${item.label || item.id}</span>`,
                    '</button>'
                ].join("");
            }).join(""),
            '</nav>',
            '</aside>'
        ].join("");
    }

    bind(container) {
        container.querySelectorAll(
            "[data-shell-nav]"
        ).forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        button.dataset.shellNav;

                    this.setActive(
                        id,
                        container
                    );

                    if (this.onSelect) {
                        this.onSelect(id);
                    }
                }
            );
        });
    }

    setActive(id, container) {
        this.activeId = id;

        container.querySelectorAll(
            "[data-shell-nav]"
        ).forEach((button) => {
            button.classList.toggle(
                "is-active",
                button.dataset.shellNav === id
            );
        });
    }

    refresh(container) {
        const nav = container.querySelector(
            ".aurora-sidebar__nav"
        );

        if (!nav) {
            return;
        }

        const activeId = this.activeId;

        nav.innerHTML = this.items.map((item) => {
            const active =
                item.id === activeId
                    ? " is-active"
                    : "";

            return [
                `<button type="button" class="aurora-sidebar__item${active}" data-shell-nav="${item.id}">`,
                `<span class="aurora-sidebar__icon">${item.icon || "•"}</span>`,
                `<span>${item.label || item.id}</span>`,
                '</button>'
            ].join("");
        }).join("");

        nav.querySelectorAll(
            "[data-shell-nav]"
        ).forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        button.dataset.shellNav;

                    this.setActive(
                        id,
                        container
                    );

                    if (this.onSelect) {
                        this.onSelect(id);
                    }
                }
            );
        });
    }
}

global.SidebarComponent =
    SidebarComponent;

})(window);
(function (global) {
"use strict";

class ThemeManager {
    constructor(options = {}) {
        this.storageKey =
            options.storageKey ||
            "aurora_theme";

        this.defaultTheme =
            options.defaultTheme ||
            "dark";

        this.currentTheme =
            this._loadStoredTheme() ||
            this.defaultTheme;
    }

    apply(theme = null) {
        const selected =
            theme ||
            this.currentTheme ||
            this.defaultTheme;

        document.documentElement.setAttribute(
            "data-theme",
            selected
        );

        this.currentTheme =
            selected;

        try {
            localStorage.setItem(
                this.storageKey,
                selected
            );
        } catch (error) {
            // Storage may be unavailable in some environments.
        }

        return selected;
    }

    toggle() {
        const nextTheme =
            this.currentTheme === "dark"
                ? "light"
                : "dark";

        return this.apply(
            nextTheme
        );
    }

    getCurrent() {
        return this.currentTheme;
    }

    _loadStoredTheme() {
        try {
            return localStorage.getItem(
                this.storageKey
            );
        } catch (error) {
            return null;
        }
    }
}

global.ThemeManager =
    ThemeManager;

})(window);
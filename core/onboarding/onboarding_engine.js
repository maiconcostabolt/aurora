(function (global) {
"use strict";

class OnboardingEngine {
    constructor(options = {}) {
        this.storageKey = options.storageKey || "aurora_company_identity";
        this.configUrl = options.configUrl || "./config/onboarding.json";
        this.config = null;
        this.ownerUserId = String(options.ownerUserId || "").trim();
    }

    async loadConfig() {
        if (this.config) return this.config;
        const response = await fetch(this.configUrl, {cache: "no-store"});
        if (!response.ok) throw new Error("Não foi possível carregar o onboarding.");
        this.config = await response.json();
        return this.config;
    }

    getProfile() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn("Perfil Aurora inválido.", error);
            return null;
        }
    }

    isComplete(profile = this.getProfile()) {
        const userName =
            global.AuroraUserProfile &&
            typeof global.AuroraUserProfile.getUserFullName === "function"
                ? String(global.AuroraUserProfile.getUserFullName() || "").trim()
                : "";
        const legacyName = String(profile && profile.professional || "").trim();

        return Boolean(
            profile &&
            profile.onboarding_complete === true &&
            profile.company &&
            (userName || legacyName) &&
            profile.phone &&
            profile.profile &&
            profile.preferred_service &&
            profile.owner_user_id === this.ownerUserId
        );
    }

    save(profile) {
        const incoming = profile && typeof profile === "object" ? profile : {};
        const existing = this.getProfile();
        const current = existing && typeof existing === "object" ? existing : {};
        const profileCode = String(incoming.profile || current.profile || "workshop");
        const selectedServices = Array.from(new Set(
            (Array.isArray(incoming.selected_services) ? incoming.selected_services : [incoming.preferred_service])
                .map((item) => String(item || "").trim())
                .filter(Boolean)
        ));
        const incomingSelections = incoming.selected_services_by_module &&
            typeof incoming.selected_services_by_module === "object" &&
            !Array.isArray(incoming.selected_services_by_module)
            ? incoming.selected_services_by_module
            : {};
        const currentSelections = current.selected_services_by_module &&
            typeof current.selected_services_by_module === "object" &&
            !Array.isArray(current.selected_services_by_module)
            ? current.selected_services_by_module
            : {};
        const selectionsByModule = {
            ...currentSelections,
            ...incomingSelections
        };
        if (selectedServices.length) selectionsByModule[profileCode] = selectedServices;
        const normalized = {
            ...current,
            company: String(incoming.company || current.company || "").trim(),
            account_mode: String(incoming.account_mode || current.account_mode || "individual") === "business" ? "business" : "individual",
            professional: String(incoming.professional || current.professional || "").trim() || "Usuário",
            phone: String(Object.prototype.hasOwnProperty.call(incoming, "phone") ? (incoming.phone ?? "") : (current.phone ?? "")).trim(),
            profile: profileCode,
            preferred_service: String(incoming.preferred_service || current.preferred_service || ""),
            preferred_service_title: String(incoming.preferred_service_title || current.preferred_service_title || ""),
            selected_services: selectedServices.length
                ? selectedServices
                : (Array.isArray(current.selected_services) ? current.selected_services : []),
            selected_services_by_module: selectionsByModule,
            owner_user_id: this.ownerUserId,
            onboarding_complete: true,
            updated_at: new Date().toISOString()
        };
        localStorage.setItem(this.storageKey, JSON.stringify(normalized));
        return normalized;
    }

    reset() {
        localStorage.removeItem(this.storageKey);
    }
}

global.OnboardingEngine = OnboardingEngine;
})(window);

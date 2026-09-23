(function (global) {
"use strict";

class OnboardingController {
    constructor(options = {}) {
        this.engine = options.engine;
        this.root = null;
        this.selectedSegment = null;
        this.selectedServices = new Map();
        this.usageMode = null;
    }

    async run() {
        const config = await this.engine.loadConfig();
        const existing = this.engine.getProfile();
        if (this.engine.isComplete(existing)) return existing;
        return this.showForm(config);
    }

    showOpening() {
        return new Promise((resolve) => {
            const opening = document.createElement("section");

            opening.className =
                "aurora-opening aurora-opening--rc4";

            opening.setAttribute(
                "aria-label",
                "Carregando AURORA"
            );

            opening.innerHTML = [
                '<div class="aurora-opening-rc4__background"></div>',
                '<div class="aurora-opening-rc4__veil"></div>',
                '<div class="aurora-opening-rc4__moon-pulse"></div>',
                '<div class="aurora-opening-rc4__brand">',
                    '<div class="aurora-opening-rc4__trails" aria-hidden="true"><span></span><span></span></div>',
                    '<div class="aurora-opening-rc4__logo" aria-hidden="true">',
                        '<div class="aurora-opening-rc4__logo-glow"></div>',
                        '<img src="./assets/icons/aurora-192.png" alt="">',
                    '</div>',
                    '<div class="aurora-opening-rc4__name" aria-label="Aurora">',
                        '<span>A</span><span>U</span><span>R</span><span>O</span><span>R</span><span>A</span>',
                    '</div>',
                    '<div class="aurora-opening-rc4__line is-first"></div>',
                    '<p class="aurora-opening-rc4__purpose"><span>Inspeções Inteligentes.</span><span>Decisões Confiáveis.</span></p>',
                    '<div class="aurora-opening-rc4__line is-second"></div>',
                    '<p class="aurora-opening-rc4__values">Organize. <i>|</i> Inspecione. <i>|</i> Evolua.</p>',
                '</div>',
                '<div class="aurora-opening-rc4__loader"><span></span><small>Carregando AURORA...</small></div>'
            ].join("");

            document.body.appendChild(opening);

            requestAnimationFrame(() => {
                opening.classList.add("is-running");
            });

            let finished = false;
            let leaveTimer = null;
            let removeTimer = null;

            const finishOpening = () => {
                if (finished) return;
                finished = true;
                window.clearTimeout(leaveTimer);
                window.clearTimeout(removeTimer);
                opening.classList.add("is-leaving");

                removeTimer = window.setTimeout(() => {
                    opening.remove();
                    resolve();
                }, 520);
            };

            opening.addEventListener("pointerdown", finishOpening, { once: true });
            opening.addEventListener("click", finishOpening, { once: true });

            leaveTimer = window.setTimeout(finishOpening, 6800);
        });
    }

    showForm(config) {
        return new Promise((resolve) => {
            this.root = document.createElement("section");
            this.root.className = "aurora-onboarding";
            this.root.innerHTML = this.renderUsageMode();
            document.body.appendChild(this.root);
            this.bindUsageMode(config, resolve);
        });
    }

    renderUsageMode() {
        return [
            '<div class="aurora-onboarding__shell">',
            '<header><span>Primeiro acesso</span><h1>Como você vai usar a Aurora?</h1>',
            '<p>Escolha o tipo de utilização. Você poderá selecionar seus módulos na próxima etapa.</p></header>',
            '<div class="aurora-onboarding__usage">',
            '<button type="button" data-onboarding-usage="individual"><b>👤</b><strong>Individual</strong><small>Para quem trabalha sozinho. Seus atendimentos ficam vinculados à sua conta.</small></button>',
            '<button type="button" data-onboarding-usage="business"><b>🏢</b><strong>Empresarial</strong><small>Para empresas com administrador e equipe. Você será o primeiro administrador.</small></button>',
            '</div>',
            '<button type="button" class="aurora-onboarding__continue" data-onboarding-usage-continue disabled>Continuar →</button>',
            '</div>'
        ].join("");
    }

    bindUsageMode(config, resolve) {
        const next = this.root.querySelector("[data-onboarding-usage-continue]");
        this.root.querySelectorAll("[data-onboarding-usage]").forEach((button) => {
            button.addEventListener("click", () => {
                this.usageMode = button.dataset.onboardingUsage;
                this.root.querySelectorAll("[data-onboarding-usage]").forEach((item) => item.classList.toggle("is-active", item === button));
                next.disabled = false;
            });
        });
        next.addEventListener("click", () => {
            if (!this.usageMode) return;
            this.root.querySelector(".aurora-onboarding__shell").outerHTML = this.renderIdentity(config);
            this.bindIdentity(config, resolve);
        });
    }

    renderIdentity(config) {
        return [
            '<div class="aurora-onboarding__shell">',
            '<header><span>Primeiro acesso</span><h1>Bem-vindo à Aurora</h1>',
            '<p>Conte para a Aurora como preparar seu ambiente de inspeção.</p></header>',
            '<div class="aurora-onboarding__mode-summary"><strong>', (this.usageMode === "business" ? "Empresarial" : "Individual"), '</strong><span>', (this.usageMode === "business" ? "Você será o administrador inicial da empresa." : "Uso pessoal, sem equipe."), '</span></div>',
            '<div class="aurora-onboarding__form">',
            '<label><span>', (this.usageMode === "business" ? "Nome da empresa" : "Empresa ou profissional"), '</span><input data-onboarding-company placeholder="Ex.: Mecânica Horizonte"></label>',
            '<label><span>Seu nome</span><input data-onboarding-professional placeholder="Responsável pelo atendimento"></label>',
            '<label><span>Telefone</span><input data-onboarding-phone type="tel" inputmode="tel" autocomplete="tel" placeholder="Ex.: (47) 99999-9999"></label>',
            '</div>',
            '<div class="aurora-onboarding__heading"><div><span>Seu segmento</span><h2>Com o que você trabalha?</h2></div></div>',
            '<div class="aurora-onboarding__segments">',
            config.segments.map((segment) => [
                '<button type="button" data-onboarding-segment="', segment.id, '">',
                '<b>', segment.icon, '</b><strong>', segment.title, '</strong><small>', segment.description, '</small>',
                '</button>'
            ].join("")).join(""),
            '</div>',
            '<div class="aurora-onboarding__actions"><button type="button" data-onboarding-usage-back>← Voltar</button>',
            '<button type="button" class="aurora-onboarding__continue" data-onboarding-continue disabled>Continuar →</button></div>',
            '</div>'
        ].join("");
    }

    bindIdentity(config, resolve) {
        const company = this.root.querySelector("[data-onboarding-company]");
        const professional = this.root.querySelector("[data-onboarding-professional]");
        const phone = this.root.querySelector("[data-onboarding-phone]");
        const next = this.root.querySelector("[data-onboarding-continue]");
        const refresh = () => {
            next.disabled = !(company.value.trim() && professional.value.trim() && phone.value.trim() && this.selectedSegment);
        };
        company.addEventListener("input", refresh);
        professional.addEventListener("input", refresh);
        phone.addEventListener("input", refresh);
        const usageBack = this.root.querySelector("[data-onboarding-usage-back]");
        if (usageBack) usageBack.addEventListener("click", () => {
            this.selectedSegment = null;
            this.root.querySelector(".aurora-onboarding__shell").outerHTML = this.renderUsageMode();
            this.bindUsageMode(config, resolve);
        });
        this.root.querySelectorAll("[data-onboarding-segment]").forEach((button) => {
            button.addEventListener("click", () => {
                this.selectedSegment = button.dataset.onboardingSegment;
                this.root.querySelectorAll("[data-onboarding-segment]").forEach((item) => item.classList.toggle("is-active", item === button));
                refresh();
            });
        });
        next.addEventListener("click", () => {
            const segment = config.segments.find((item) => item.id === this.selectedSegment);
            this.root.querySelector(".aurora-onboarding__shell").innerHTML = this.renderServices(segment);
            this.bindServices(segment, {
                company: company.value.trim(),
                professional: professional.value.trim(),
                phone: phone.value.trim(),
                account_mode: this.usageMode === "business" ? "business" : "individual"
            }, resolve);
        });
    }

    renderServices(segment) {
        return [
            '<header><span>', segment.icon, ' Aurora ', segment.title, '</span><h1>Qual serviço você oferece?</h1>',
            '<p>Selecione todos os serviços que você oferece. Somente os itens marcados serão exibidos no seu ambiente.</p></header>',
            '<div class="aurora-onboarding__services">',
            segment.services.map((service) => [
                '<button type="button" data-onboarding-service="', service.id, '" data-title="', service.title, '">',
                '<b>', service.icon, '</b><strong>', service.title, '</strong><span>Toque para selecionar</span>',
                '</button>'
            ].join("")).join(""),
            '</div>',
            '<div class="aurora-onboarding__actions">',
            '<button type="button" data-onboarding-back>← Voltar</button>',
            '<button type="button" data-onboarding-save disabled>Iniciar demonstração de 7 dias ✦</button>',
            '</div>'
        ].join("");
    }

    bindServices(segment, identity, resolve) {
        const save = this.root.querySelector("[data-onboarding-save]");
        this.root.querySelectorAll("[data-onboarding-service]").forEach((button) => {
            button.addEventListener("click", () => {
                const service = {id: button.dataset.onboardingService, title: button.dataset.title};
                if (this.selectedServices.has(service.id)) {
                    this.selectedServices.delete(service.id);
                    button.classList.remove("is-active");
                    button.querySelector("span").textContent = "Toque para selecionar";
                } else {
                    this.selectedServices.set(service.id, service);
                    button.classList.add("is-active");
                    button.querySelector("span").textContent = "Selecionado ✓";
                }
                save.disabled = this.selectedServices.size === 0;
            });
        });
        this.root.querySelector("[data-onboarding-back]").addEventListener("click", () => {
            this.selectedServices.clear();
            this.root.remove();
            this.showForm(this.engine.config).then(resolve);
        });
        save.addEventListener("click", async () => {
            const services = Array.from(this.selectedServices.values());
            const preferred = services[0];
            save.disabled = true;
            save.textContent = "Ativando demonstração…";
            try {
                if (!global.AuroraModulesApi) throw new Error("A conexão dos Módulos Aurora não está disponível.");
                await global.AuroraModulesApi.startModuleTrial(segment.id);
                if (identity.account_mode === "business") {
                    if (typeof global.AuroraModulesApi.provisionMyCompany !== "function") {
                        throw new Error("O cadastro empresarial da Aurora não está disponível.");
                    }
                    await global.AuroraModulesApi.provisionMyCompany(identity.company, segment.id);
                }
                const profile = this.engine.save({
                    ...identity,
                    profile: segment.id,
                    preferred_service: preferred.id,
                    preferred_service_title: preferred.title,
                    selected_services: services.map((service) => service.id),
                    selected_services_by_module: {
                        [segment.id]: services.map((service) => service.id)
                    }
                });
                if (
                    global.AuroraUserProfile &&
                    typeof global.AuroraUserProfile.setFullName === "function" &&
                    identity.professional
                ) {
                    global.AuroraUserProfile.setFullName(identity.professional);
                }
                this.root.classList.add("is-leaving");
                setTimeout(() => { this.root.remove(); resolve(profile); }, 500);
            } catch (error) {
                save.disabled = false;
                save.textContent = "Iniciar demonstração de 7 dias ✦";
                await global.AuroraDialog.alert(error.message || error, { title: "Não foi possível continuar", tone: "danger" });
            }
        });
    }
}

global.OnboardingController = OnboardingController;
global.AuroraOpening = () => new OnboardingController({}).showOpening();
})(window);

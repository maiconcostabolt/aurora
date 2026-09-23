"use strict";

const VERSION =
    "aurora-pwa-producao-vistoria-32";

/* Cache de produção MLC Aurora — Marco R9 validado em 03/09/2026.
 * VERSION (identidade do app) permanece vistoria-32. */
const CACHE_BUST = 'AURORA V47 RECONCILIATION RC1 R26 UNIVERSAL DRAFT RECOVERY';

const STATIC_CACHE =
    `${VERSION}-static-${CACHE_BUST}`;

const RUNTIME_CACHE =
    `${VERSION}-runtime-${CACHE_BUST}`;

const APP_SHELL = [
    "./",
    "./index.html",
    "./app.html",
    "./offline.html",
    "./manifest.webmanifest",
    "./css/app.css",
    "./css/theme.css",
    "./css/app_shell.css",
    "./css/aurora_runtime.css",
    "./css/mobile_shell.css",
    "./css/vehicle_inspection_flow.css",
    "./assets/vehicle/aurora-vehicle-perspectives-v1.png",
    "./css/onboarding.css",
    "./css/report_engine.css",
    "./css/rc8_10_report_premium.css",
    "./css/rc8_10_report_refinement.css",
    "./css/evidence_engine.css",
    "./css/module_access.css",
    "./css/support_messages.css",
    "./css/aurora_ai_customer.css",
    "./css/aurora_ai_asset.css",
    "./config/runtime_config.js",
    "./core/runtime/aurora_runtime.js",
  "./js/aurora_boot_diag_v78.js",
    "./js/bootstrap.js",
    "./js/app_refresh.js",
    "./js/vehicle_inspection_flow.js",
    "./core/shapes/eletrica_tupy/ui.css",
    "./core/shapes/eletrica_tupy/domain.js",
    "./core/shapes/eletrica_tupy/catalog_data.js",
    "./core/shapes/eletrica_tupy/services_catalog_data.js",
    "./core/shapes/eletrica_tupy/flow.js",
    "./js/account_storage.js",
    "./js/company_access.js",
    "./js/cloud_sync.js",
    "./js/module_access.js",
    "./js/support_messages.js",
    "./js/aurora_ai_listen_overlay.js",
    "./js/aurora_ai_floating.js",
    "./js/aurora_ai_registry.js",
    "./js/aurora_ai_engine.js",
    "./js/aurora_ai_dynamic.js",
    "./js/aurora_ai_customer.js",
    "./js/aurora_ai_home.js",
    "./js/aurora_ai_asset.js",
    "./js/aurora_ai_panel_voice.js",
    "./js/paged.min.js",
    "./js/pdf-lib.min.js",
    "./js/fontkit.umd.min.js",
    "./fonts/Arial.ttf",
    "./fonts/Arial-Bold.ttf",
    "./js/report_feature.js",
    "./core/reporting/report_preview.js",
    "./core/reporting/report_pdf_from_layout.js",
    "./core/reporting/report_pdf_pwa.js",
    "./js/evidence_feature.js",
    "./js/cover_photo_feature.js",
    "./css/aurora_dialog.css",
    "./js/aurora_dialog.js",
    "./config/build_profile.js",
    "./config/pdf_experimental_config.js",
    "./config/pdf_local_test_config.js",
    "./core/reporting/report_pdf_experimental.js",
    "./core/shapes/eletrica_tupy/materials_priority_data.js",
    "./js/eletrica_tupy_service_suggestions.js",
    "./js/eletrica_tupy_codes_grid.js",
    "./js/eletrica_tupy_pedidos.js",
    "./js/eletrica_tupy_report_number.js",
    "./js/home_return_trace.js",
    "./js/bug_a_runtime_trace.js",
    "./config/license_config.js",
    "./js/offline_license.js",
    "./js/aurora_clock_diagnostic.js",
    "./js/company_invite_accept.js",
    "./js/company_team.js",
    "./js/tupy_settings.js",
    "./js/admin_service_codes_cloud.js",
    "./js/aurora_assets_pilot.js",
    "./js/evidence_cloud_sync.js",
    "./js/evidence_cloud_reader.js",
    "./js/aurora_asset_public.js",
    "./js/module_commercial.js",
    "./js/aurora_ui_support_diagnostic.js"
];

const VERSIONED_APP_ALIASES = [
    "./css/app_shell.css?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./css/vehicle_inspection_flow.css?v=AURORA-GUIDED-UI-CLEAN-v58",
    "./core/shapes/eletrica_tupy/ui.css?v=AURORA-AI-TEAM-LAYOUT-FIX-20260909",
    "./css/report_engine.css?v=AURORA-PREVIA-ASSINATURA-1",
    "./css/evidence_engine.css?v=AURORA-1.0.8",
    "./css/onboarding.css?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./css/mobile_premium_patch.css?v=V66-TOPBAR-USUARIO",
    "./css/aurora_motion.css?v=RC8.13-MOTION2-LAYERFIX1",
    "./css/rc6_patch.css?v=AURORA-V38-ATIVOS-COMPARTILHADOS-20260913",
    "./css/rc7_2_print.css?v=RC8.0",
    "./css/rc8_10_report_premium.css?v=AURORA-R30-TUPY-COMPACT-EVIDENCE",
    "./css/rc8_10_report_refinement.css?v=BUG_A_FINALIZE_TRACE_2",
    "./css/cover_photo_feature.css?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./css/cloud_sync.css?v=AURORA-1.2.5-LOGOUT-ENTRADA",
    "./css/module_access.css?v=PWA-V5.7-TRIAL1",
    "./css/support_messages.css?v=AURORA-1.1.7",
    "./css/aurora_dialog.css?v=AURORA-1.2.5",
    "./css/aurora_ai_customer.css?v=AURORA-AI-CONTEXT-V31-20260913",
    "./css/aurora_ai_asset.css?v=AURORA-ESCOPO-MODULO-14",
    "./css/aurora_budget.css?v=AURORA-ASSINATURA-ORCAMENTO-1",
    "./js/aurora_dialog.js?v=AURORA-FASE-2F",
    "./config/runtime_config.js?v=38",
    "./js/account_storage.js?v=MLCAURORA_R9_PROD",
    "./js/aurora_user_profile.js?v=AURORA-USER-IDENTITY-v56",
    "./core/onboarding/onboarding_engine.js?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./modules/onboarding/onboarding_controller.js?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./core/ui/topbar_component.js?v=AURORA-1.1.8",
    "./core/ui/field_engine.js?v=AURORA-PRODUCAO-VISTORIA1.0.1",
    "./core/storage/local_case_repository.js?v=MLCAURORA_R9_PROD",
    "./core/storage/local_case_repository.js?v=AURORA-V166-CACHE-ATOMICO",
    "./modules/asset/asset_controller.js?v=AURORA-PRODUCAO-VISTORIA1.0.1",
    "./modules/budget/budget_controller.js?v=AURORA-ASSINATURA-ORCAMENTO-1",
    "./modules/approval/approval_controller.js?v=AURORA-ASSINATURA-ORCAMENTO-1",
    "./js/paged.min.js?v=0.4.3",
    "./config/pdf_experimental_config.js?v=RC8.18-PDF-EXP-0",
    "./config/pdf_local_test_config.js?v=RC8.18-PDF-LOCAL-0",
    "./config/report_technical_details.js?v=AURORA-TUPY1",
    "./core/reporting/premium/styles/premium_report.css?v=PREMIUM-TEST2",
    "./js/aurora_qrcode.js?v=AURORA-VALIDACAO-QR-1",
    "./core/reporting/report_engine.js?v=AURORA-V166-CACHE-ATOMICO",
    "./core/reporting/report_preview.js?v=AURORA-V36-HISTORICO-RELATORIO-20260913",
    "./core/reporting/premium/data/premium_utils.js?v=PREMIUM-TEST2",
    "./core/reporting/premium/data/vehicle_inspection_adapter.js?v=PREMIUM-TEST2",
    "./core/reporting/premium/components/premium_components.js?v=PREMIUM-TEST2",
    "./core/reporting/premium/pages/cover_page.js?v=PREMIUM-TEST2",
    "./core/reporting/premium/pages/identification_page.js?v=PREMIUM-TEST2",
    "./core/reporting/premium/pages/occurrences_page.js?v=PREMIUM-TEST2",
    "./core/reporting/premium/pages/diagnosis_page.js?v=PREMIUM-TEST2",
    "./core/reporting/premium/premium_report_renderer.js?v=PREMIUM-TEST2",
    "./core/reporting/report_pdf_serialize.js?v=RC8.18-PDF-SERIALIZE-0",
    "./core/reporting/report_pdf_experimental.js?v=RC8.18-PDF-EXP-0",
    "./js/pdf-lib.min.js?v=1.17.1",
    "./js/fontkit.umd.min.js?v=AURORA-PDF-LAYOUT-1",
    "./core/reporting/report_pdf_local_test.js?v=RC8.18-PDF-LOCAL-0",
    "./core/reporting/report_pdf_from_layout.js?v=AURORA-PDF-LAYOUT-1",
    "./core/reporting/report_pdf_pwa.js?v=PANEL_KM_REPORT_CLASSIFICATION_1",
    "./core/runtime/aurora_runtime.js?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./js/vehicle_inspection_flow.js?v=AURORA-GUIDED-UI-CLEAN-v58",
    "./core/shapes/eletrica_tupy/domain.js?v=AURORA-TUPY10",
    "./core/shapes/eletrica_tupy/catalog_data.js?v=AURORA-FEEDBACK-CLIENTE-GESTAO-DENSITY-1",
    "./core/shapes/eletrica_tupy/services_catalog_data.js?v=AURORA-FEEDBACK-CLIENTE-GESTAO-DENSITY-1",
    "./core/shapes/eletrica_tupy/materials_priority_data.js?v=AURORA-FEEDBACK-CLIENTE-GESTAO-DENSITY-1",
    "./js/eletrica_tupy_service_suggestions.js?v=AURORA-FEEDBACK-CLIENTE-REV1",
    "./js/eletrica_tupy_codes_grid.js?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./js/eletrica_tupy_pedidos.js?v=AURORA-FEEDBACK-CLIENTE-GESTAO-DENSITY-1",
    "./js/eletrica_tupy_report_number.js?v=AURORA-FEEDBACK-CLIENTE-GESTAO-DENSITY-1",
    "./core/shapes/eletrica_tupy/flow.js?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./js/home_return_trace.js?v=MLCAURORA_R9_PROD",
    "./js/bug_a_runtime_trace.js?v=MLCAURORA_R9_PROD",
    "./core/evidence/evidence_store.js?v=AURORA-V166-CACHE-ATOMICO",
    "./core/evidence/photo_editor.js?v=AURORA-V169-PHOTO-EDITOR-SAFE",
    "./js/evidence_feature.js?v=AURORA-V169-PHOTO-EDITOR-SAFE",
    "./js/cover_photo_feature.js?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./js/report_feature.js?v=AURORA-FASE-2F28-R6-NATIVE-EVIDENCE",
    "./js/android_bridge.js?v=AURORA-NAV-V31-20260913",
    "./config/cloud_config.js?v=AURORA-1.0.1",
    "./config/license_config.js?v=AURORA-OFFLINE-FASE4",
    "./js/offline_license.js?v=AURORA-OFFLINE-FASE4-REV",
    "./js/aurora_clock_diagnostic.js?v=AURORA-OFFLINE-FASE4-CLOCK-DIAG",
    "./js/supabase.min.js?v=2.55.0",
    "./js/company_access.js?v=AURORA-R9-EMPRESARIAL-CORRECOES-FUNCIONAIS-R11-22-TESTE",
    "./js/company_invite_accept.js?v=AURORA-FASE-2E6-3",
    "./js/company_team.js?v=AURORA-V42-AMBIENTES-PLANO-20260913",
    "./js/tupy_settings.js?v=AURORA-R30-FINAL-1",
    "./js/admin_service_codes_cloud.js?v=AURORA-ADMIN-REPORT-REVIEW-UI-1",
    "./js/aurora_i18n.js?v=AURORA-ASSETS-ELECTRICAL-QR-NAV-RESTORE-4",
    "./js/aurora_assets_pilot.js?v=43",
    "./js/evidence_cloud_sync.js?v=AURORA-ESCOPO-MODULO-14",
    "./js/evidence_cloud_reader.js?v=AURORA-ASSET-HISTORY-PHOTOS-V29-20260913",
    "./js/cloud_sync.js?v=AURORA-V170-AUTH-OFFLINE-CACHE",
    "./js/aurora_asset_public.js?v=41",
    "./js/support_messages.js?v=AURORA-ESCOPO-MODULO-14",
    "./js/app_refresh.js?v=AURORA-ESCOPO-MODULO-14",
    "./js/module_commercial.js?v=AURORA-COMPANY-ENTITLEMENT-GATE-R3",
    "./js/module_access.js?v=AURORA-V168-RUNTIME-OFFLINE",
    "./js/aurora_ai_listen_overlay.js?v=AURORA-ESCOPO-MODULO-14",
    "./js/aurora_ai_floating.js?v=AURORA-AI-CONTEXT-V31-20260913",
    "./js/aurora_ai_registry.js?v=AURORA-ESCOPO-MODULO-14",
    "./js/aurora_ai_engine.js?v=AURORA-AI-UX-MOVEL-1",
    "./js/aurora_ai_dynamic.js?v=AURORA-ESCOPO-MODULO-14",
    "./js/aurora_ai_customer.js?v=AURORA-ESCOPO-MODULO-14",
    "./js/aurora_ai_home.js?v=AURORA-AI-CONTEXT-V31-20260913",
    "./js/aurora_ai_asset.js?v=AURORA-ESCOPO-MODULO-14",
    "./js/aurora_ai_panel_voice.js?v=AURORA-ESCOPO-MODULO-14",
    "./js/entitlement_engine.js?v=RC8.0",
    "./js/bootstrap.js?v=AURORA-V51-20260914",
    "./js/aurora_ui_support_diagnostic.js?v=AURORA-SUPPORT-DIAG-v33-lite",
    "./config/report_title_suggestions.js?v=AURORA-TUPY1",
    "./js/rc6_patch.js?v=AURORA-PREVIA-ASSINATURA-1",
    "./js/rc7_commercial.js?v=RC8.1",
    "./js/pwa_installer.js?v=AURORA-STARTUP-BOOT-UNICO-9"
];

async function completeAppShell() {
    try {
        const response = await fetch("./pwa-assets.json", { cache: "no-store" });
        if (!response.ok) throw new Error("Lista de recursos indisponível");
        const resources = await response.json();
        return Array.from(new Set(APP_SHELL.concat(resources)));
    } catch (error) {
        console.warn("Aurora PWA: usando pacote offline essencial.", error);
        return APP_SHELL;
    }
}

self.addEventListener(
    "install",
    (event) => {
        event.waitUntil(
            caches.open(STATIC_CACHE)
                .then(async (cache) => {
                    const coreResources = [
                        "./app",
                        "./offline",
                        "./",
                        "./core/storage/local_case_repository.js",
                        "./core/evidence/evidence_store.js",
                        "./core/reporting/report_engine.js"
                    ];

                    const redirectedAliases = new Set([
                        "./app.html",
                        "./offline.html",
                        "./index.html"
                    ]);

                    for (const resource of coreResources) {
                        const response = await fetch(resource, { cache: "no-store" });
                        if (!response || !response.ok) {
                            throw new Error(`Aurora PWA: recurso CORE indisponível: ${resource}`);
                        }
                        await cache.put(resource, response.clone());
                    }

                    const resources = await completeAppShell();
                    const coreSet = new Set(coreResources);
                    const complementaryResources = resources.filter(
                        (resource) =>
                            !coreSet.has(resource) &&
                            !redirectedAliases.has(resource)
                    );

                    for (const resource of complementaryResources) {
                        try {
                            const response = await fetch(resource, { cache: "no-store" });
                            if (!response || !response.ok) {
                                throw new Error(`HTTP ${response ? response.status : "sem resposta"}`);
                            }
                            await cache.put(resource, response.clone());
                        } catch (error) {
                            console.warn(
                                "Aurora PWA: recurso complementar não armazenado.",
                                resource,
                                error
                            );
                        }
                    }

                    /*
                     * OFFLINE R04:
                     * app.html solicita dependências estáticas com ?v=...
                     * As chaves exatas versionadas são criadas a partir das
                     * Responses base já armazenadas, sem alterar os arquivos.
                     */
                    for (const alias of VERSIONED_APP_ALIASES) {
                        try {
                            const aliasUrl = new URL(alias, self.location.href);
                            const baseUrl = new URL(aliasUrl.toString());
                            baseUrl.search = "";
                            const baseResponse = await cache.match(baseUrl.toString());
                            if (baseResponse) {
                                await cache.put(aliasUrl.toString(), baseResponse.clone());
                            } else {
                                console.warn(
                                    "Aurora PWA: base ausente para alias versionado.",
                                    alias
                                );
                            }
                        } catch (error) {
                            console.warn(
                                "Aurora PWA: alias versionado não armazenado.",
                                alias,
                                error
                            );
                        }
                    }
                })
                // Em atualizações, deixa o novo worker em waiting.
                // A troca passa a ser explícita pelo botão "Atualizar", evitando
                // controllerchange no meio da abertura/autenticação da Aurora.
        );
    }
);

self.addEventListener(
    "activate",
    (event) => {
        event.waitUntil(
            caches
                .keys()
                .then(
                    (keys) =>
                        Promise.all(
                            keys
                                .filter(
                                    (key) =>
                                        key.startsWith(
                                            "aurora-"
                                        ) &&
                                        ![
                                            STATIC_CACHE,
                                            RUNTIME_CACHE
                                        ].includes(key)
                                )
                                .map(
                                    (key) =>
                                        caches.delete(
                                            key
                                        )
                                )
                        )
                )
                .then(
                    () =>
                        self.clients.claim()
                )
        );
    }
);

self.addEventListener(
    "fetch",
    (event) => {
        const request =
            event.request;

        if (
            request.method !== "GET"
        ) {
            return;
        }

        const url =
            new URL(
                request.url
            );

        if (
            url.origin !==
            self.location.origin
        ) {
            return;
        }

        /*
         * Rede primeiro: durante homologação nunca devemos manter um
         * JS antigo quando existe uma correção mais nova no servidor.
         */
        const matchCurrentGeneration = async (target) => {
            const staticCache = await caches.open(STATIC_CACHE);
            const staticHit = await staticCache.match(target);
            if (staticHit) return staticHit;
            const runtimeCache = await caches.open(RUNTIME_CACHE);
            return runtimeCache.match(target);
        };

        event.respondWith(
            fetch(request)
                .then(
                    (response) => {
                        if (
                            response &&
                            response.ok
                        ) {
                            const copy =
                                response.clone();

                            caches
                                .open(
                                    RUNTIME_CACHE
                                )
                                .then(
                                    (cache) =>
                                        cache.put(
                                            request,
                                            copy
                                        )
                                );
                        }

                        return response;
                    }
                )
                .catch(
                    async () => {
                        if (
                            request.mode ===
                                "navigate" &&
                            (
                                url.pathname.endsWith(
                                    "/app.html"
                                ) ||
                                url.pathname.endsWith(
                                    "/app"
                                )
                            )
                        ) {
                            const cachedApp =
                                await matchCurrentGeneration(
                                    "./app"
                                );

                            if (cachedApp) {
                                return cachedApp;
                            }
                        }

                        const cached =
                            await matchCurrentGeneration(
                                request
                            );

                        if (cached) {
                            return cached;
                        }

                        /*
                         * OFFLINE R03:
                         * app.html usa cache-busting (?v=...). O precache guarda
                         * a chave estática base. Em falha de rede, para recursos
                         * same-origin, tenta explicitamente a mesma URL sem query.
                         */
                        if (url.search) {
                            const baseUrl =
                                new URL(request.url);
                            baseUrl.search = "";

                            const cachedBase =
                                await matchCurrentGeneration(
                                    baseUrl.toString()
                                );

                            if (cachedBase) {
                                return cachedBase;
                            }
                        }

                        return (
                            request.mode ===
                                "navigate"
                                ? caches.match(
                                    "./offline"
                                )
                                : Response.error()
                        );
                    }
                )
        );
    }
);

self.addEventListener(
    "message",
    (event) => {
        if (
            event.data &&
            event.data.type ===
                "SKIP_WAITING"
        ) {
            self.skipWaiting();
        }
    }
);
self.addEventListener("push", (event) => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = { body: event.data ? event.data.text() : "Nova mensagem" }; }
    if (payload.sender_role && payload.sender_role !== "admin") return;
    const id = String(payload.id || payload.message_id || "new");
    event.waitUntil(self.registration.showNotification("Aurora Chat", {
        body: String(payload.body || "Você recebeu uma nova mensagem."),
        tag: `aurora-chat-${id}`,
        data: { url: payload.url || "./app.html?open=chat" }
    }));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = event.notification.data && event.notification.data.url || "./app.html?open=chat";
    event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
        const existing = windows[0];
        if (existing) { existing.navigate(target); return existing.focus(); }
        return clients.openWindow(target);
    }));
});

// AURORA-AI1-AUDIOFIX-1

# AUDITORIA AURORA R30 — OFFLINE SHELL / SERVICE WORKER TRACE

Candidata exclusivamente diagnóstica. Não altera persistência, EvidenceStore, ReportEngine, Cloud Sync ou Supabase.

## Objetivo
Distinguir no próprio cold start offline: (1) qual HTML/shell foi carregado; (2) qual Service Worker controla a página; (3) se o controlador responde com a identidade R30 e qual cache R30 usa.

## Instrumentação
- marcador inline `TRACE OFFLINE R30` inserido diretamente em `app.html` e `index.html`, sem depender de bootstrap.js;
- mostra HTML, ONLINE/OFFLINE e `navigator.serviceWorker.controller.scriptURL`;
- envia `AURORA_TRACE_SW_IDENTITY` ao controlador;
- SW R30 responde build + STATIC_CACHE;
- URL de registro do SW alterada para `service_worker.js?v=AURORA_V47_R30_SHELL_SW_TRACE`;
- bootstrap/aliases alinhados em R30 apenas para identidade da candidata.

## Regra do teste
Online: fotografar TRACE R30. Depois modo avião, fechar PWA, reabrir e fotografar novamente sem entrar em vistoria.

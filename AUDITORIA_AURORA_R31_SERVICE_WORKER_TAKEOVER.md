# AUDITORIA AURORA R31 — SERVICE WORKER TAKEOVER

Data: 2026-09-23

## Objetivo
Candidata diagnóstica para corrigir exclusivamente a atualização/assunção do Service Worker durante publicação de nova versão PWA. Não altera persistência de vistorias, EvidenceStore, Supabase, Cloud Sync ou regras das shapes.

## Evidência que motivou a rodada
Na R30 online, o HTML novo carregou, porém `navigator.serviceWorker.controller` permaneceu em `service_worker.js?v=AURORA_V133_DIAG_RECOLHIVEL_BOLT` e o worker não respondeu à identidade R30. No cold start offline, o trace R30 desapareceu e Perfil exibiu R29C. Isso demonstrou que um worker anterior continuava servindo shell/cache anterior.

## Alterações R31
- identidade do SW/cache: `AURORA V47 RC1 R31 SERVICE WORKER TAKEOVER`;
- registro: `service_worker.js?v=AURORA_V47_R31_SW_TAKEOVER`;
- `registration.update()` solicitado após o registro;
- novo worker executa `skipWaiting()` somente após concluir o precache da instalação;
- `clients.claim()` permanece no evento `activate`;
- trace HTML atualizado para R31 e observa `controllerchange`;
- bootstrap versionado como `AURORA-V47-R31-SW-TAKEOVER`.

## Segurança
A rodada não limpa localStorage, IndexedDB, EvidenceStore, login ou dados de vistoria. A limpeza do `activate` continua limitada aos caches Cache Storage Aurora anteriores, conforme mecanismo já existente.

## Critério humano
1. Online: TRACE R31 deve aparecer.
2. Após a atualização, controlador/resposta devem migrar para R31.
3. Fechar, ativar modo avião e abrir novamente.
4. Offline: TRACE R31 e Perfil R31 devem permanecer presentes.

# AUDITORIA AURORA R29C — OFFLINE CACHE ATOMIC DIAG

Data: 2026-09-23

## Objetivo
Corrigir exclusivamente a incoerência de identidade do `bootstrap.js` entre carregamento online e cold-start offline observada na R29B. Nenhuma regra de persistência, EvidenceStore, Cloud Sync, Supabase ou fluxo funcional da Elétrica foi alterada nesta rodada.

## Alterações
- `app.html`: `bootstrap.js` usa `?v=AURORA-V47-R29C-CACHE-ATOMIC`.
- `index.html`: mesma query exata `?v=AURORA-V47-R29C-CACHE-ATOMIC`.
- `service_worker.js`: `VERSIONED_APP_ALIASES` usa a mesma query exata.
- `service_worker.js`: `CACHE_BUST` atualizado para `AURORA V47 RC1 R29C OFFLINE CACHE ATOMIC DIAG`, criando nova geração de caches static/runtime.
- `config/runtime_config.js`: `build_id` atualizado para a mesma candidata R29C.
- `js/bootstrap.js`: somente identificação visual do diagnóstico atualizada de R29B para R29C; lógica diagnóstica preservada.
- `pwa-assets.json`: mantém `./js/bootstrap.js` base, necessário para a criação do alias versionado pelo Service Worker.

## Validação estática
- `app.html`, `index.html` e `VERSIONED_APP_ALIASES` apontam para a mesma revisão do bootstrap: PASS.
- `node --check js/bootstrap.js`: PASS.
- `node --check service_worker.js`: PASS.

## Teste humano obrigatório
1. Publicar a R29C na área PWA de teste.
2. Abrir online e confirmar `DIAGNÓSTICO OFFLINE R29C`.
3. Confirmar em Perfil e configurações: `AURORA V47 RC1 R29C OFFLINE CACHE ATOMIC DIAG`.
4. Colocar o aparelho em modo avião.
5. Fechar completamente a PWA.
6. Abrir novamente ainda offline.
7. Antes de abrir qualquer atendimento, confirmar que o painel `DIAGNÓSTICO OFFLINE R29C` continua visível e informa `REDE: OFFLINE`.

Somente após esse PASS deve ser retomado o diagnóstico de persistência de campo/foto.

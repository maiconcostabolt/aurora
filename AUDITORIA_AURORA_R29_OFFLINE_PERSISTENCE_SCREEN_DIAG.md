# AUDITORIA AURORA R29 — OFFLINE PERSISTENCE SCREEN DIAG

Base: R28A reprovada no teste humano offline.
Data: 2026-09-23.
Objetivo: diagnóstico visual temporário, sem correção funcional da persistência.

## Alterações
- Adicionado `js/aurora_offline_persistence_diag_r29.js`.
- Painel visível na própria tela informa rede, case id, mudança observada, resultado de `LocalCaseRepository.save`, releitura imediata, EvidenceStore/IndexedDB, referências de foto no case, rascunho persistente, uso aproximado de localStorage e último erro.
- Instrumentação envolve os motores oficiais existentes; não cria storage paralelo.
- `app.html` carrega o diagnóstico após bootstrap.
- `pwa-assets.json` inclui o diagnóstico para disponibilidade offline.
- `runtime_config.js` e `service_worker.js` identificados como `AURORA V47 RC1 R29 OFFLINE PERSISTENCE SCREEN DIAG`.

## Não alterado
- lógica de finalização;
- LocalCaseRepository original;
- ReportEngine original;
- EvidenceStore original;
- Cloud Sync/Supabase;
- shapes e regras de negócio.

## Teste humano mínimo
1. Confirmar build R29 em Perfil e configurações.
2. Abrir a PWA online uma vez para cachear a candidata.
3. Colocar em modo avião e reabrir a PWA.
4. Abrir o atendimento de reprodução.
5. Alterar um campo identificável.
6. Tirar print do painel.
7. Adicionar uma foto.
8. Tirar novo print do painel.
Não é necessário finalizar relatório nesta primeira rodada.

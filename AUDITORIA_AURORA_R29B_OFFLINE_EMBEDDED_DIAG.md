# AUDITORIA AURORA R29B — OFFLINE EMBEDDED DIAG

- Base: R29 diagnóstica.
- Objetivo único: fazer o painel diagnóstico carregar também no cold start offline.
- Alteração: o código diagnóstico R29 foi incorporado ao `js/bootstrap.js`, recurso oficial já pertencente ao shell offline.
- O `<script>` diagnóstico separado foi removido de `app.html` para evitar execução duplicada.
- Query do bootstrap atualizada para `AURORA-V47-R29B-DIAG`.
- `CACHE_BUST` e `build_id` atualizados para R29B.
- Nenhuma regra de persistência, EvidenceStore, cloud sync, Supabase ou shape foi alterada.
- Critério inicial: painel aparece ONLINE; após modo avião + fechar/reabrir, painel continua aparecendo OFFLINE.

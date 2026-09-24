# AUDITORIA AURORA R28A — DURABLE REVISION GUARD

Data: 2026-09-23
Base: AURORA V47 RECONCILIATION RC1 R27 OFFLINE DURABLE PERSISTENCE
Objetivo: impedir falso sucesso quando `getPersistent(report.id)` encontra uma revisão antiga do mesmo atendimento.

## Alteração cirúrgica

- `js/report_feature.js`: após `createFromCase()`, a confirmação durável agora exige igualdade entre a revisão recém-gerada e a revisão relida exclusivamente do armazenamento persistente.
- São comparados: `id`, `updated_at`, `snapshot.updated_at` e `status`.
- Se qualquer valor divergir, a finalização retorna `report_persistent_revision_mismatch`, preserva o atendimento aberto e NÃO alcança o `resetCase(blankCase)`.
- `config/runtime_config.js`: build_id atualizado para R28A.
- `service_worker.js`: CACHE_BUST atualizado para R28A.

## Não alterado

EvidenceStore/IndexedDB, Cloud Sync/Supabase, shapes, autenticação, navegação, compactação de relatório e LocalCaseRepository não foram redesenhados nesta rodada.

## Motivação

Na R27 a validação confirmava apenas a existência do mesmo `report.id`. Como Rascunho e revisão final reutilizam o mesmo ID, uma gravação nova malsucedida podia deixar a revisão antiga no `aurora_reports`; `getPersistent(id)` ainda a encontrava e a finalização aceitava falso sucesso. R28A exige a revisão exata.

## Validação estática

`node --check` PASS para `js/report_feature.js`, `config/runtime_config.js` e `service_worker.js`.

## Teste humano obrigatório

Usar PWA de teste. Confirmar em Perfil e configurações a identificação exata:
`AURORA V47 RECONCILIATION RC1 R28A DURABLE REVISION GUARD`.

Repetir o cenário offline que reprovou R27. Se a persistência durável falhar, a Aurora deve bloquear a conclusão/preservar o atendimento em vez de retornar silenciosamente à Home como se a revisão nova estivesse salva. Esta candidata ainda NÃO afirma resolver a causa da falha de armazenamento/quota.

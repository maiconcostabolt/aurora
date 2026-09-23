# AURORA V37 — Grounding reutiliza Recentes canônicos

## Motivo
V36 continuou mostrando o registro histórico `GND-RECOVER-AUR-2026-0004` como autoridade da Home. O DIAG confirmou `updated_at` antigo e customer antigo no objeto local recuperado.

## Regra aplicada
Não criar novo motor. Grounding passa a consumir a mesma infraestrutura empresarial já existente na Aurora e usada pelas Atividades Rotineiras: `AuroraCompanyAccess.listMyCompanyProjectSummaries()` + `AuroraCloudSync.restoreCompanyProjectForAdmin()`.

## Alteração
- `js/bootstrap.js`: em `syncHomeReports()`, para `grounding_equipotentialization`, a lista visual de Atendimentos recentes é reconciliada com `aurora_projects`.
- Ordenação por `row.updated_at || row.created_at` da fonte canônica cloud.
- Abrir/editar restaura o projeto canônico pela API Aurora existente antes de abrir prévia/edição.
- `GND-RECOVER` permanece somente como recuperação histórica local e deixa de ser fonte autoritativa da Home.
- Nenhuma alteração no renderer/layout do relatório.

## Validação estática
- node --check js/bootstrap.js: PASS
- node --check config/runtime_config.js: PASS

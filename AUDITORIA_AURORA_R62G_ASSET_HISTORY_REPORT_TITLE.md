# AURORA R62G — ASSET HISTORY REPORT TITLE

Base: R62F aprovada em teste até o ponto atual.

## Alteração única
- No histórico interno de cada ativo, o título do card passa a ser o título canônico do relatório (`full_case.approval.report_title`).
- Cliente/empresa deixa de ser o título principal desse card.
- Serviço, executor, data e status permanecem inalterados.
- Card do ativo (TAG/código + nome) permanece inalterado.
- Fallback legado permanece para projetos antigos sem `report_title`.
- Mudança feita no motor compartilhado `aurora_assets_pilot.js`, portanto vale para os módulos que usam este motor, respeitando as exceções já existentes.

## Banco
Migration aplicada: `aurora_r62g_asset_history_report_title`.
A RPC `aurora_asset_history_list` agora retorna `report_title` sem alterar autorização, ownership Individual/Empresarial ou vínculo canônico R62F.

## Evidência real verificada
Projeto mais recente de Painel elétrico: `title = Veolia`; título canônico do relatório em `workflow_state.full_case.approval.report_title = Reaperto de Parafusos`.
Logo o card deve exibir `Reaperto de Parafusos`, e não `Veolia`.

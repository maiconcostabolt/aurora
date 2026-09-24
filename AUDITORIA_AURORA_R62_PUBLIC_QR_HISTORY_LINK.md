# AURORA V47 RC1 R62 — PUBLIC QR HISTORY LINK

Base: R61 Individual QR Asset Ownership — PASS humano em 24/09/2026.

## Escopo cirúrgico
- Reutiliza o motor oficial de QR/ativo; nenhum QR paralelo.
- Adiciona RPC `aurora_asset_link_project(asset_id, legacy_case_id)` para retrovincular o atendimento concluído ao ativo permanente criado a partir do relatório.
- Funciona com ownership Empresarial (`company_id`) e Individual (`owner_user_id`).
- `aurora_asset_public_get_v2` passa a devolver também serviço executado, trabalho realizado, condição atual e próxima ação, além dos campos já existentes.
- `aurora_asset_public_work_items` passa a funcionar para Empresarial e Individual e somente usa atendimento concluído vinculado ao ativo.
- Tarefas só aparecem quando `diagnostic.work_items` existe e possui itens; seção vazia não é renderizada.
- O frontend chama o vínculo canônico imediatamente após `aurora_asset_upsert` ao abrir Etiqueta QR a partir de relatório.
- Cache-busters dos dois motores QR foram atualizados para R62.

## Não alterado
ReportEngine, evidências/fotos, assinatura, orçamento, shapes, Tupy, auth, CloudSync geral, navegação e mecanismo de token público.

## Teste humano obrigatório
1. Empresarial: relatório concluído -> Etiqueta QR -> abrir como visitante.
2. Confirmar histórico >= 1 e última inspeção preenchida.
3. Confirmar resumo técnico com dados existentes no relatório.
4. Serviço com tarefas: confirmar tarefas e estados no QR.
5. Serviço sem tarefas: confirmar ausência da seção.
6. Individual: repetir criação/abertura pública e confirmar histórico/resumo.
7. QR antigo: confirmar que continua abrindo.

Não congelar até PASS humano.

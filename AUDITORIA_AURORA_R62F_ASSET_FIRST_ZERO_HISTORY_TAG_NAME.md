# AURORA R62F — ASSET FIRST / ZERO HISTORY / TAG + NAME

Base: R62E.

## Correções
- Cadastro manual de ativo (`service_code = registry`) não herda atendimento por coincidência de TAG/código/nome.
- Histórico de ativo criado primeiro exige vínculo canônico `asset_registry_id`.
- Somente `Nova vistoria` cria o projeto/atendimento vinculado ao ativo.
- QR público e tarefas seguem a mesma regra, evitando histórico fantasma antes da primeira vistoria.
- Elétrica: título visual do card e detalhe usa `TAG/código · nome do ativo` (ex.: `A-3301 B · Evaporador B`).
- Cliente/unidade e setor permanecem como metadados secundários.
- Outros módulos preservam sua semântica contextual existente.
- Limpeza defensiva de origem pendente ao salvar um novo ativo; não cria projeto.

## Supabase
Migration aplicada: `aurora_r62f_asset_first_zero_history`.
RPCs ajustados: `aurora_asset_history_list`, `aurora_asset_history_project_get`, `aurora_asset_public_get_v2`, `aurora_asset_public_work_items`.

## Teste humano esperado
1. Elétrica > Cadastrar equipamento > salvar `A-3301 B / Evaporador B`.
2. Abrir ativo: `0 atendimentos`.
3. Confirmar título `A-3301 B · Evaporador B`.
4. Tocar `Nova vistoria`, escolher serviço e iniciar.
5. Só então histórico deve passar a `1 atendimento`.

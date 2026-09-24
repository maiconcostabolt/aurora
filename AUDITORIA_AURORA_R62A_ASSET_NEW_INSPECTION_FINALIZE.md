# AURORA V47 RC1 R62A — ASSET NEW INSPECTION FINALIZE

Base exata: R62 PUBLIC QR HISTORY LINK.

## Evidência humana
Conta Individual, fluxo Áreas e equipamentos > ativo > Nova vistoria: a inspeção foi preenchida até o fim, mas a geração retornou `report_persistent_revision_mismatch`. O atendimento permaneceu salvo/em andamento. No histórico do ativo, o título principal usava `p.title` (ex.: localização `Predio H`) em vez do mesmo nome semântico do card de Atendimentos recentes.

## Correções cirúrgicas
1. `ReportEngine.save()` mantém `aurora_reports` como autoridade única e o guard R28A fail-closed.
2. Após a gravação, confirma a revisão recém-gerada no próprio armazenamento. Se uma gravação concorrente tiver substituído a coleção nesse intervalo, reaplica UMA vez a revisão sobre a coleção mais recente e confirma novamente. Não aceita sucesso sem persistência real.
3. Histórico do ativo passa a usar `customer.name/company_name/company` como título principal, igual à semântica de Atendimentos recentes; `p.title` fica apenas como fallback.
4. `aurora_asset_history_list` passa a autorizar também ativo Individual pelo `owner_user_id`, sem remover as permissões empresariais. Para Individual, lista projetos do próprio usuário e não exige `company_id`.
5. O histórico deixa de filtrar somente concluídos para que a ficha do ativo represente também o atendimento atual em andamento; o status continua canônico e não é maquiado.

## Preservado
QR/public_token, tarefas, ReportEngine visual, fotos/EvidenceStore, Tupy, módulos, licenças, autenticação, propriedade empresarial e fluxo R62 de vínculo relatório→ativo.

## Teste humano
1. Entrar na conta Individual usada no teste.
2. Abrir Áreas e equipamentos > o mesmo ativo > Nova vistoria.
3. Preencher e finalizar.
4. PASS: relatório abre sem `report_persistent_revision_mismatch` e o atendimento passa a Concluído.
5. Voltar à ficha do ativo. PASS: título do card corresponde ao padrão de Atendimentos recentes, e não à localização/código interno.
6. Abrir Visualizar informações do QR Code e confirmar histórico/resumo/tarefas.

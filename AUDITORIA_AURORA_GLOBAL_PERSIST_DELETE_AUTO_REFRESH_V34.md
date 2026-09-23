# AUDITORIA — AURORA V34 — persistência de exclusão + refresh automático

## Base
V33 global de updated_at. Relatório visual V31 permanece congelado.

## Lei global 1 — campo apagado é alteração
- `CaseBinder` já preserva valores vazios no merge; não foi alterado.
- `CustomerModuleController.onSave()` já devolve todos os campos do formulário, inclusive string vazia; não foi alterado.
- Corrigido fallback legado do Onboarding para que `phone: ""` explícito não recupere o telefone anterior.
- Corrigida a ponte específica do Grounding que interceptava Cliente: agora AGUARDA `runtime.saveCurrent()` antes de reler o case. Antes havia race: a tela seguinte podia ler telefone/e-mail antigos antes de o formulário terminar de salvar.

## Lei global 2 — fechamento de relatório atualiza a Aurora sem F5 manual
- `aurora:completed-report-closed` agora sempre recompõe a aplicação com um único reload após a tentativa de auto-sync (exceto admin review).
- Se a shape já sincronizou antes de abrir a prévia e limpou `__auroraCompletedCaseForAutoSync`, o reload ainda ocorre.
- Se existe sync pendente, tenta sincronizar primeiro; em erro, preserva fila/comportamento existente e ainda recompõe o estado local.
- Objetivo: horário/ordenação de Atendimentos recentes e campos apagados aparecem imediatamente ao fechar a prévia.

## Escopo protegido
Nenhuma alteração em layout do relatório, capa, B2, registro fotográfico, QR, Evidence Store ou tipografia V31.

## Teste humano
1. Editar atendimento Grounding.
2. Apagar telefone e e-mail.
3. Avançar, gerar relatório: ambos devem estar ausentes.
4. Fechar prévia: Aurora deve atualizar automaticamente.
5. Atendimentos recentes deve mostrar horário da última alteração sem F5 manual.
6. Reabrir o mesmo relatório: telefone/e-mail devem continuar ausentes.
7. Repetir horário em um segundo serviço para validar regra global.

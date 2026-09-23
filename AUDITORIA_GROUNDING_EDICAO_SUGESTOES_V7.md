# AURORA — Auditoria Grounding V7

Build: `AURORA_GROUNDING_EDICAO_SUGESTOES_V7_PWA_TEST_20-09-2026`

Escopo cirúrgico desta rodada:

1. Preservado o fluxo independente já aprovado do módulo Aterramento e Equipotencialização.
2. Mantida a correção do Workflow Dock para permitir Cliente → Próximo novamente após regressão das etapas.
3. Corrigido conflito entre auto-installer legado de sugestões e os pickers explícitos do Grounding. Campos `data-ag-picker` dentro de `#aurora-grounding-shape` não recebem mais sugestões genéricas antes do picker oficial explícito.
4. `Generalidades / descrição técnica` passa a usar o AuroraSuggestionsPicker oficial com biblioteca própria de aterramento.
5. Todos os pickers explícitos do Grounding usam `profileId=grounding_equipotentialization` e `serviceId=grounding_equipotentialization`.
6. Edição pela prévia do relatório reconhece `grounding_equipotentialization` e chama `AuroraGroundingShape.openFromReport(report)`.
7. Edição pelo lápis em Atendimentos recentes também desvia diretamente para `AuroraGroundingShape.openFromReport(report)`.
8. `openFromReport` aceita tanto o ID legado `grounding` quanto o novo `grounding_equipotentialization`, preservando o snapshot/case existente em vez de iniciar atendimento vazio.
9. DIAG temporário atualizado para `DIAG V7`.
10. `config/runtime_config.js` atualizado para a identificação exata da V7, que alimenta a versão exibida em Perfil e configurações.

Arquivos alterados nesta rodada:
- `core/shapes/grounding/flow.js`
- `core/reporting/report_preview.js`
- `js/bootstrap.js`
- `js/rc6_patch.js`
- `config/runtime_config.js`
- `index.html`

Validação estática:
- `node --check core/shapes/grounding/flow.js` PASS
- `node --check core/reporting/report_preview.js` PASS
- `node --check js/bootstrap.js` PASS
- `node --check js/rc6_patch.js` PASS

Gate humano:
- Generalidades: não pode mostrar Folga mecânica/Desgaste/Vazamento.
- Ponto: Descrição técnica/localização e Observação devem mostrar apenas conteúdo de aterramento.
- Prévia → Editar atendimento deve reabrir o mesmo atendimento preenchido.
- Atendimentos recentes → lápis deve reabrir o mesmo atendimento preenchido.
- Clique no card recente continua abrindo apenas a visualização do relatório.

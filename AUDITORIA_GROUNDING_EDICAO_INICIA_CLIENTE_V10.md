# AUDITORIA — GROUNDING EDIÇÃO INICIA NO CLIENTE — V10

Build: `AURORA_GROUNDING_EDICAO_INICIA_CLIENTE_V10_PWA_TEST_20-09-2026`

## Escopo cirúrgico
Corrige somente a reabertura de atendimento existente da shape `grounding_equipotentialization`.

## Comportamento esperado
- Atendimentos recentes > Editar: carrega o atendimento existente e abre `Dados do cliente`.
- Prévia do relatório > Editar atendimento: carrega o mesmo atendimento e abre `Dados do cliente`.
- Cliente > Próximo: segue para `Identificação da vistoria` preservando todos os dados técnicos já salvos.
- Clique normal no card de atendimento continua abrindo a visualização do relatório.

## Correção
1. `openFromReport(report)` passa a hidratar o snapshot no Runtime e abrir explicitamente o step compartilhado `customer`, em vez de montar diretamente a primeira tela interna da shape.
2. `openAfterSharedCustomer()` reutiliza o draft do mesmo `case/id` quando a origem é edição. Isso impede que, ao clicar em Próximo na tela Cliente, os dados de aterramento do atendimento existente sejam substituídos por um `blank()`.
3. Fallback conservador: se o Runtime não conseguir abrir `customer`, mantém o comportamento anterior de montar a shape, sem impedir a edição.

## Arquivos alterados
- `core/shapes/grounding/flow.js`
- `config/runtime_config.js` (identificação exata da candidata em Perfil/Config)

## Fora do escopo / preservado
- Relatório específico V9 e layout aprovado
- mapeamento 1–26
- Suggestions Picker
- Evidence/fotos
- foto de capa
- Report Engine compartilhado
- Vistoria Veicular
- Atividades Rotineiras / Tupy
- demais shapes

## Validação estática
- `node --check core/shapes/grounding/flow.js`: PASS
- `node --check config/runtime_config.js`: PASS

## Teste humano mínimo
1. Abrir um atendimento de Aterramento existente pelo lápis em Atendimentos recentes.
2. Confirmar que abre em Dados do cliente com o cliente correto.
3. Clicar Próximo e confirmar Identificação da vistoria com os dados existentes.
4. Voltar e repetir por Prévia do relatório > Editar atendimento.
5. Confirmar em Perfil/Config: `AURORA_GROUNDING_EDICAO_INICIA_CLIENTE_V10_PWA_TEST_20-09-2026`.

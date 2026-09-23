# AURORA — V40 Grounding Workflow Canônico

## Base
DIAG V39 FORENSE R02.

## Causa confirmada pelo rastreio
O case estava corretamente identificado como `grounding_equipotentialization`, mas o AuroraRuntime mantinha os controllers genéricos `customer -> asset -> intake -> evidence -> diagnostic -> budget`. A shape Grounding já possui e controla suas próprias quatro etapas técnicas após a tela Cliente compartilhada.

## Alteração V40
No `_applyServiceWorkflowSteps()` compartilhado, quando o case/profile é `grounding_equipotentialization`, o Runtime mantém apenas o controller oficial `customer`. Após `saveCurrent()` do Cliente, `AuroraGroundingShape` assume o fluxo técnico já existente. Nenhum novo workflow, Report Engine, Evidence Engine ou persistência paralela foi criado.

## Preservado
- Report Engine e layout aprovado
- B2 / cards
- fotos e EvidenceStore
- capa e controles de escala
- QR
- horário/refresh canônico V37
- cloud/company access
- 26 pontos do atendimento recuperado

## Diagnóstico
O rastreio forense R02 permanece carregado para confirmar em teste humano que o Runtime não volta a expor `asset/intake/evidence/diagnostic/budget` no Grounding e para observar telefone/e-mail até a geração/reabertura.

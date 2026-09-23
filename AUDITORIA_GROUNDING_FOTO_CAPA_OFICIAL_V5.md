# AURORA — Grounding Foto de Capa Oficial V5 — PWA Test
Data: 2026-09-19

## Base
AURORA_GROUNDING_FOTO_CAPA_OFICIAL_V4_PWA_TEST.zip

## Escopo aprovado nesta rodada
1. Preservado integralmente o fluxo funcional V4 da foto de capa: Evidence Engine -> EvidenceStore -> AuroraCoverPhotoFeature -> CaseBinder -> Report Engine.
2. Nenhum novo motor, popup, storage, editor ou mecanismo de foto foi criado.
3. Após existir foto de capa, o card agora informa explicitamente "Foto de capa salva" e que a imagem já será usada na capa.
4. O botão Adicionar/Substituir passou a usar a classe visual oficial já existente `aurora-add-evidence-group`, removendo o botão cru fora do padrão.
5. Quando `body.aurora-report-open` está ativo, `.aurora-workflow-dock` e `.aurora-footer-nav` ficam ocultos. A prévia mantém somente sua toolbar própria.
6. Ao fechar a prévia, a classe `aurora-report-open` já é removida pelo ReportPreview oficial; portanto o dock volta sem criar lógica paralela.

## Arquivos alterados
- core/shapes/grounding/flow.js
- core/shapes/grounding/ui.css
- css/report_engine.css
- app.html (cache-bust dos arquivos alterados)

## Arquivos/motores preservados
- js/evidence_feature.js — sem alteração
- js/cover_photo_feature.js — sem alteração
- core/evidence/evidence_store.js — sem alteração
- core/evidence/photo_editor.js — sem alteração
- core/reporting/report_preview.js — sem alteração
- core/reporting/report_engine.js — sem alteração

## Build visual
AURORA_GROUNDING_FOTO_CAPA_OFICIAL_V5_PWA_TEST_19-09-2026

## Teste humano
- selecionar foto de capa;
- confirmar preview e mensagem Foto de capa salva;
- gerar relatório;
- confirmar foto na capa;
- confirmar ausência do dock inferior durante a prévia;
- fechar/Editar atendimento e confirmar retorno normal da navegação;
- reabrir atendimento e confirmar persistência da capa.

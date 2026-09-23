# AURORA — Grounding V13 — Layout profissional / Modelo A

Data: 20/09/2026
Build: `AURORA_GROUNDING_LAYOUT_PROFISSIONAL_MODELO_A_V13_PWA_TEST_20-09-2026`

## Causa confirmada da V12
O HTML gerado no teste carregou o markup/CSS anterior para partes do relatório. `app.html` ainda referenciava `report_preview.js` com query de V8 e o serializer buscava o CSS sem identificador V12. O Service Worker também mantinha um `CACHE_BUST` antigo. Por isso o deploy continha código V12, mas o navegador podia continuar executando/renderizando ativos anteriores.

## Correções V13
- Cache-bust único V13 em `report_preview.js`, `report_pdf_serialize.js`, `pdf_local_test_config.js` e `rc8_10_report_premium.css`.
- Novo cache do Service Worker: `AURORA_GROUNDING_V13_LAYOUT_PROFISSIONAL`.
- DIAG atualizado para `DIAG V13`, cabeçalho `AURORA V13 — GROUNDING PWA TEST + RASTREIO` e evento `PAINEL V13 CARREGADO`.
- Perfil/Config usa o build V13 exato.
- Normas antigas são normalizadas na renderização para nome/ano + descrição, uma abaixo da outra:
  - ABNT NBR 5410:2004 — Instalações elétricas em baixa tensão
  - ABNT NBR 5419:2015 — Proteção de estruturas contra descargas atmosféricas
  - ABNT NBR 15749:2009 — Medição de resistência e de potenciais na superfície do solo em sistemas de aterramento
  - NR 10:2004 — Segurança em instalações e segurança em eletricidade
- Card de aferição usa exclusivamente o Modelo A aprovado: cabeçalho em duas áreas, condição/parecer isolado à direita, medições em duas colunas e localização em bloco próprio.
- Mantidos sem alteração funcional: Evidence/fotos, QR/validação, persistência V11, edição e demais shapes.

## Validação técnica
- `node --check core/reporting/report_preview.js`: PASS
- `node --check core/reporting/report_pdf_serialize.js`: PASS
- `node --check service_worker.js`: PASS

# AUDITORIA — GROUNDING TECHNICAL REPORT V27

Base: V26 aprovada em teste humano.

Escopo exclusivo desta rodada:
- Aplicar ao relatório de Aterramento a arquitetura documental aprovada na prévia “Padrão Laudo Técnico Aurora / Engenharia”.
- Preservar integralmente o modelo fotográfico V26 com duas evidências por linha.
- Preservar Tabela B2 / Modelo A conforme preferência já persistida no atendimento.
- Melhorar tipografia narrativa: alinhamento à esquerda, entrelinha, espaçamento entre parágrafos e preservação de quebras de parágrafo digitadas pelo usuário.
- Organizar seções numeradas: identificação; objeto; escopo; referências normativas; caracterização; instrumentação/metodologia; resultados; registro fotográfico; recomendações; conclusão; responsabilidade/validação.

Proteção da capa:
- `_renderReportCover()` NÃO foi alterado.
- CSS de `.aurora-report-cover`, foto de capa, layout de capa e posicionamento de cabeçalho NÃO foi alterado nesta rodada.
- Persistência/hidratação da foto de capa da V25/V26 permanece intacta.

Arquivos funcionais alterados:
- core/reporting/report_preview.js — somente renderer/CSS específico de `.aurora-grounding-report`.
- config/runtime_config.js — identificação V27.
- index.html — identificação DIAG V27.

Não alterado:
- Evidence Engine / Evidence Store
- Cover Photo Feature
- cloud_sync.js
- report_feature.js
- Report PDF engine
- auth / Supabase / RLS
- QR / validação
- service worker / offline
- outros serviços/shapes

Validação estática:
- node --check core/reporting/report_preview.js: PASS
- node --check config/runtime_config.js: PASS

Pendente: teste humano PWA.

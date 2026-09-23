# AUDITORIA — GROUNDING V11 — RECUPERAÇÃO + PERSISTÊNCIA + RELATÓRIO

Build: `AURORA_GROUNDING_RECUPERACAO_PERSISTENCIA_RELATORIO_V11_PWA_TEST_20-09-2026`

## Achado crítico
O relatório AUR-2026-0004 foi localizado no HTML exportado pelo usuário. O arquivo contém 26 pontos de aferição e 26 fotografias embutidas. A validação Aurora/Supabase também confirma emissão do AUR-2026-0004 para `grounding_equipotentialization` em 20/09/2026.

A causa técnica do desaparecimento após F5 foi identificada: o Grounding mantinha imagens base64 em `grounding.points[].photos`. O `ReportEngine._compactCase()` não removia essas imagens, portanto um relatório com muitas fotos podia exceder a cota do localStorage. Além disso, o `finish()` específico do Grounding contornava a finalização canônica de `report_feature.js` e apenas enfileirava sync, sem aguardar `syncSelectedCase()`.

## Correções
1. Fotos de Grounding passam a persistir pelo EvidenceStore/Storage; localStorage recebe snapshot compacto sem base64.
2. `evidence_groups` leves são preservados no case.
3. Prévia e edição reidratam as fotos do EvidenceStore antes de abrir o relatório/atendimento.
4. Finalização do Grounding passa a tentar `syncSelectedCase()` imediatamente e só deixa pendente em caso de falha.
5. Antes de gerar o relatório, o cliente vivo do Runtime é mesclado no state, evitando reaproveitar nome antigo.
6. Tela Cliente do módulo Grounding ganhou CNPJ e Endereço.
7. Relatório exibe Cliente, CNPJ e Endereço.
8. Normas seguem o modelo do laudo-base: código + descrição, uma abaixo da outra.
9. Card de ponto: Condição/Parecer foi movido para o canto superior direito; conteúdo interno ganhou respiro lateral.
10. Recuperação única do AUR-2026-0004: somente para a empresa que emitiu o relatório, recria o atendimento em Atendimentos recentes e restaura as 26 fotos no EvidenceStore. Depois marca a recuperação como concluída.

## Normas usadas nas sugestões, conforme laudo-base fornecido
- NBR-5410:2004 — Instalações elétricas em baixa tensão
- NBR-5419:2015 — Proteção de estruturas contra descargas atmosféricas
- NBR-15749:2009 — Medição de resistência e de potenciais na superfície do solo em sistemas de aterramento
- NR 10:2004 — Segurança em instalações e segurança em eletricidade

## Arquivos principais alterados
- `core/shapes/grounding/flow.js`
- `core/reporting/report_engine.js`
- `core/reporting/report_preview.js`
- `core/runtime/aurora_runtime.js`
- `css/rc8_10_report_premium.css`
- `js/bootstrap.js`
- `js/grounding_recovery_v11.js` (recuperação única AUR-2026-0004)
- `config/runtime_config.js`
- `app.html`
- `index.html`

## Preservado
- Report Engine compartilhado (sem criar novo motor)
- Evidence Engine / EvidenceStore oficiais
- Suggestions Picker oficial
- validação/QR oficial Aurora
- demais shapes e fluxos não relacionados

## Teste humano
1. Fazer deploy PWA Test da V11 e entrar na mesma empresa que emitiu AUR-2026-0004.
2. Na primeira carga, aguardar a recuperação automática; a página recarrega uma única vez.
3. Confirmar AUR-2026-0004 em Atendimentos recentes.
4. Abrir o relatório e conferir os 26 registros e fotos.
5. Testar Editar pela prévia e pelo lápis: deve abrir Cliente com Tupy S.A e manter o mesmo atendimento.
6. Confirmar CNPJ/Endereço na tela Cliente e no relatório.
7. Confirmar normas em linhas individuais com descrições.
8. Confirmar Condição/Parecer no topo direito dos cards.
9. Atualizar a página (F5) e confirmar que o atendimento continua em Atendimentos recentes com fotos.
10. Confirmar Perfil/Config: `AURORA_GROUNDING_RECUPERACAO_PERSISTENCIA_RELATORIO_V11_PWA_TEST_20-09-2026`.

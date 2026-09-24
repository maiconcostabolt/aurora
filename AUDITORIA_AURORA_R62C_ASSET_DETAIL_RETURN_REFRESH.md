# AURORA V47 RC1 R62C — ASSET DETAIL RETURN REFRESH

Base: R62B testada pelo usuário em 24/09/2026.

## Escopo cirúrgico
1. Tela de detalhe do ativo: substitui o código técnico no título visual por `Cliente / unidade · Trabalhos realizados`. O código EQ permanece persistido e continua autoridade técnica/QR.
2. Condomínios: corrige o cabeçalho para `Atendimentos desta área ou equipamento`.
3. Origem de navegação: ao abrir/editar atendimento a partir do histórico do ativo, registra a origem e o Back nativo durante o workflow retorna à mesma ficha do ativo usando AuroraUi.showHome + AuroraAssetsPilot.showDetail; não cria editor paralelo.
4. Pós-finalização: `aurora:completed-report-refresh`, já emitido depois do auto-sync oficial, passa a recompor também o histórico da ficha atualmente aberta. Assim o card muda de Em andamento para Concluído sem F5.
5. A origem é limpa após o retorno/refresh para não interferir em workflows posteriores.

## Não alterado
- ReportEngine e revision guard.
- Persistência R59/R62A.
- RPCs/Supabase (nenhuma migration nova nesta candidata).
- QR/public_token.
- Shapes, evidências, fotos, assinatura e Tupy.

## Validações estáticas
- node --check js/aurora_assets_pilot.js: PASS
- node --check js/bootstrap.js: PASS
- build_id canônico: AURORA V47 RC1 R62G ASSET HISTORY REPORT TITLE
- cache bust: AURORA_V47_RC1_R62G_ASSET_HISTORY_REPORT_TITLE

## Teste humano obrigatório
1. Áreas e equipamentos -> Prédio H · Trabalhos realizados.
2. Confirmar título humano no detalhe e texto `Atendimentos desta área ou equipamento`.
3. Abrir um atendimento pelo histórico, pressionar Back nativo e confirmar retorno à mesma ficha.
4. Editar/finalizar atendimento, fechar relatório e confirmar atualização imediata para Concluído sem F5.
5. Abrir relatório concluído e pressionar Back nativo; confirmar retorno à mesma ficha.

# AUDITORIA — GROUNDING V30

Build: AURORA_GROUNDING_RESULTS_COVER_ADAPTIVE_V30_PWA_TEST_20-09-2026
Base: V29 aprovada como origem desta rodada.

## Escopo
- Resultados das aferições: Dentro da referência e Requer atenção/intervenção movidos para o resumo ANTES da Tabela B2.
- Removido qualquer resumo residual após a Tabela B2. Após a tabela, o fluxo segue diretamente para Registro fotográfico.
- Capa: quando a escala da foto é >= 140%, ativa layout adaptativo sem reduzir a foto escolhida pelo usuário.
- Layout adaptativo reserva 42% para texto e 58% para foto e reduz moderadamente o título para evitar quebras excessivas.
- Regra equivalente adicionada para impressão/PDF.
- Nenhuma alteração em Evidence, QR, cloud, persistência, B2, fotos 2-colunas ou mecanismo da foto de capa.
- DIAG atualizado para V30 e build_id atualizado.

## Validação estática
- node --check report_preview.js: PASS
- node --check runtime_config.js: PASS

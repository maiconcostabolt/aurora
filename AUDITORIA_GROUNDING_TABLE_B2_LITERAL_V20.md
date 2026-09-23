# AURORA — Grounding Table B2 Literal V20

Data: 20/09/2026
Base: V19
Escopo: correção visual cirúrgica da Tabela Técnica B2 do relatório de Aterramento.

## Causa confirmada
O CSS B2 existia na folha visual da PWA, mas NÃO fazia parte do CSS autônomo exportado pelo Report Preview para o HTML final. Por isso o relatório salvo/aberto perdia a hierarquia do protótipo B2 e exibia conteúdo comprimido/colado.

## Correções
- CSS B2 incluído também no HTML autônomo gerado pelo Report Preview.
- Estrutura da célula Ponto/Item alinhada ao protótipo: categoria/item em destaque; descrição/localização abaixo, em tipografia secundária.
- Larguras, padding, cabeçalho, zebra, divisórias e status seguem o protótipo B2 aprovado.
- Corrigido desequilíbrio de chaves no bloco CSS B2 da folha premium.
- Cards Modelo A não alterados.
- Nenhuma alteração em Evidence, QR, Supabase, auth, service worker ou demais shapes.

## Identificação
AURORA_GROUNDING_TABLE_B2_LITERAL_V20_PWA_TEST_20-09-2026
DIAG V20

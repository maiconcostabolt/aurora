# AURORA — Grounding V12 — Layout técnico Modelo A

Build: `AURORA_GROUNDING_LAYOUT_TECNICO_MODELO_A_V12_PWA_TEST_20-09-2026`

## Escopo aplicado
- Aplicado somente ao relatório específico de Aterramento e Equipotencialização.
- Card de ponto de aferição passa a usar o **Modelo A**, aprovado em HTML antes da aplicação.
- Um card por linha para preservar leitura técnica e evitar compressão lateral.
- Cabeçalho: Registro + título à esquerda; Condição/Parecer em área independente à direita.
- Corpo: Valor medido e Referência informada em duas colunas.
- Base: Localização/Descrição técnica com respiro próprio; observação separada quando existir.
- Normas aplicáveis exibidas verticalmente, uma por linha, com descrição abaixo.
- Compatibilidade: se um atendimento antigo tiver apenas o nome curto da norma, o relatório complementa a descrição conhecida no momento da renderização, sem alterar o dado original.
- Melhorada a hierarquia e o espaçamento entre Objetivo, Normas, Generalidades, Metodologia e Nível de proteção.

## Não alterado
- Persistência V11.
- Evidence/fotos.
- QR/validação oficial Aurora.
- Edição do atendimento.
- Fluxo das telas da shape.
- Outros relatórios/serviços.

## Arquivos alterados
- `core/reporting/report_preview.js`
- `css/rc8_10_report_premium.css`
- `core/shapes/grounding/flow.js` (somente identificação do build)
- `config/runtime_config.js` (build_id)
- `index.html` e `app.html` (cache-busting Grounding V12/CSS)

## Verificações automáticas
- `node --check core/reporting/report_preview.js`: PASS
- `node --check core/shapes/grounding/flow.js`: PASS

## Teste humano sugerido
1. Abrir o mesmo atendimento AUR-2026-0004.
2. Gerar/visualizar o relatório.
3. Conferir Normas: cada norma deve mostrar título e descrição, uma abaixo da outra.
4. Conferir espaçamento entre Normas e Generalidades.
5. Conferir pontos: card Modelo A em largura total, sem texto colado às bordas.
6. Conferir Perfil/Config: build V12.

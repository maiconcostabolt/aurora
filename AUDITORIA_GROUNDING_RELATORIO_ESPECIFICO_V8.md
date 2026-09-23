# AURORA — Aterramento e Equipotencialização — Relatório específico V8

Build: `AURORA_GROUNDING_RELATORIO_ESPECIFICO_V8_PWA_TEST_20-09-2026`

## Escopo desta rodada
- Mantida a shape `grounding_equipotentialization` e o fluxo aprovado até a finalização.
- O serviço deixa de cair no relatório universal e passa a ser despachado para `_renderGroundingDocument()`.
- Nenhum outro serviço teve seu roteamento de relatório alterado.
- DIAG temporário atualizado para `DIAG V8`.
- Build atualizado em `runtime_config.js` e na shape para permanecer visível em Perfil e Configurações pelo mecanismo atual da Aurora.

## Mapeamento de rastreabilidade do teste 1–26
1 Unidade -> Identificação da vistoria
2 Setor / instalação -> Identificação da vistoria
3 Número do laudo -> Identificação da vistoria
4 Número da ART -> Identificação da vistoria
5 Registro profissional -> Identificação da vistoria
6 Valor de referência -> Sistema + resumo das aferições
7 Comprimento -> Sistema
8 Largura -> Sistema
9 Área de exposição -> Sistema
10 Fabricante do instrumento -> Instrumento de medição
11 Modelo -> Instrumento de medição
12 Nº de série -> Instrumento de medição
13 Calibração / certificado -> Instrumento de medição
14 Objetivo do laudo -> Metodologia e referências técnicas
15 Normas aplicáveis -> Metodologia e referências técnicas
16 Generalidades / descrição técnica -> Metodologia e referências técnicas
17 Metodologia -> Metodologia e referências técnicas
18 Nível de proteção / gerenciamento de risco -> Metodologia e referências técnicas
19 Categoria / item inspecionado -> Ponto de aferição
20 Descrição técnica / localização -> Ponto de aferição
21 Valor medido -> Ponto de aferição
22 Condição -> Ponto de aferição
23 Parecer técnico -> Ponto de aferição
24 Observação -> Ponto de aferição
25 Recomendações -> Diagnóstico e recomendação
26 Conclusão -> Finalização

Observação: o perímetro informado no teste (30) também foi mapeado para a seção do sistema.

## Arquivos alterados
- `core/reporting/report_preview.js`
- `core/shapes/grounding/flow.js` (somente BUILD)
- `config/runtime_config.js` (somente build_id)
- `index.html` (somente DIAG V8)
- `app.html` (somente cache-bust do report_preview)

## Regra arquitetural
O relatório específico reutiliza o motor oficial de capa, identidade da empresa, seções, evidências, preview, compartilhamento e rodapé. A especialização é somente o template/mapeamento de Aterramento. Não foi criado um segundo motor de PDF.

## Teste humano esperado
1. Confirmar build V8 em Perfil e Configurações e DIAG V8.
2. Repetir o preenchimento numerado 1–26.
3. Gerar relatório.
4. Conferir se cada número aparece na seção indicada acima.
5. Não avaliar ainda acabamento visual/foto de capa; esta rodada valida separação e contrato de dados.

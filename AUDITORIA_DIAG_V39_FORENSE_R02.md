# AURORA — DIAG V39 FORENSE R02

Objetivo: rastreio amplo, não invasivo, sem correções funcionais.

## Diferença crítica para R01
O R01 embrulhava funções síncronas com `async`, o que podia transformar retornos Array em Promise. Isso poderia provocar artificialmente erros como `reports.map is not a function`.

O R02 preserva rigorosamente o tipo de retorno original: função síncrona continua síncrona; Promise continua Promise. O diagnóstico observa, mas não altera o contrato.

## Capturas
- Runtime: steps, currentIndex, active step, case e customer.
- Tela real e sidebar antes/depois de cliques.
- stack resumido de chamadas instrumentadas.
- save/open/next/previous do runtime quando disponíveis.
- Grounding shape quando disponível.
- FormRenderer quando disponível.
- Report Engine: list/save/create/get/open/render, incluindo tipo real do retorno, `Array.isArray`, Promise e storageKey.
- `window.error`, `unhandledrejection` e `alert`.
- gravações relevantes no local/session storage, preservando contrato.
- eventos de case/report/cloud/edit.
- telefone/e-mail com distinção entre vazio, missing, null e valor.

## Teste humano
1. Abrir Tupy pelo lápis.
2. Apagar telefone e e-mail.
3. Clicar Próximo.
4. Clicar nas etapas laterais que estiverem erradas.
5. Se possível, tentar chegar ao relatório e gerar/abrir.
6. Se ocorrer erro, apenas fechar o alerta e continuar até onde der.
7. Abrir `DIAG V39 FORENSE R02`.
8. Clicar `CHECKPOINT COMPLETO`.
9. Clicar `COPIAR DIAG COMPLETO` e enviar o conteúdo integral.

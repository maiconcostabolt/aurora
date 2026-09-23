# AURORA V35 — RASTREIO GLOBAL PERSISTÊNCIA + UPDATED_AT

## Objetivo
Diagnóstico somente. Não corrige por hipótese.

Rastrear duas falhas observadas na V34:
1. telefone/e-mail apagados aparecem corretamente na prévia nova, mas retornam ao reabrir;
2. Atendimentos recentes continua exibindo horário antigo no Aterramento.

## Pontos instrumentados
- saída da etapa Cliente: customer + updated_at após saveCurrent;
- reconstrução Grounding após Cliente: customer antes/depois do merge;
- início da finalização e customer vivo do Runtime;
- entrada canônica do Report Engine;
- relatório salvo: report.updated_at, snapshot.updated_at, customer do report e snapshot;
- fonte real consumida por Atendimentos recentes: updated_at/created_at/snapshot_updated_at e customer.

## DIAG
Todos os rótulos principais desta rodada usam V35:
- AURORA V35 — RASTREIO GLOBAL PERSISTÊNCIA + UPDATED_AT
- DIAG V35
- PAINEL V35 CARREGADO

## Teste humano solicitado
1. Abrir o atendimento Tupy S.A pelo lápis.
2. Apagar telefone e e-mail.
3. Avançar normalmente e gerar o relatório.
4. Fechar a prévia.
5. Reabrir o relatório e confirmar se os campos retornaram.
6. Abrir DIAG V35 e copiar/enviar o rastreio exibido.

Não alterar o layout aprovado do relatório nesta rodada.

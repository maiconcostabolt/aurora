# AURORA V47 RC1 R36 — TUPY FINALIZATION STATUS

Base: R35 aprovada no teste humano de persistência offline de campos e fotos.

## Falha isolada
O relatório era gerado e os dados/fotos permaneciam, porém o atendimento continuava
como Rascunho. Assim, tocar no corpo do card retomava a vistoria em vez de abrir o relatório.

## Causa encontrada
`buildReportEngineOptions()` usa `isUserVistoriaReportCase()` para decidir:
- USER Tupy enviado para revisão -> `Em andamento`;
- finalização normal -> `Concluído`.

A função anterior decidia apenas pelo flag persistido
`eletrica_tupy.vistoria_sent_for_review === true`.

Esse flag é histórico e pode sobreviver em um case retomado/editado. Portanto uma
finalização feita no fluxo ADMIN podia gerar a prévia, mas continuar persistindo o
relatório como `Em andamento`.

## Correção
Nenhum fluxo novo foi criado.

`isUserVistoriaReportCase()` passa a reutilizar a autoridade oficial já existente:
`AuroraEletricaTupy.isUserBoltVistoriaFlow(caseData)`.

Essa regra já distingue:
- USER Bolt -> permanece Em andamento para revisão;
- ADMIN Bolt -> finaliza;
- ADMIN review -> não é USER.

Fallback histórico foi preservado apenas caso a API oficial ainda não esteja carregada.

## Preservado
- correção de quota R35;
- persistência offline;
- EvidenceStore/fotos;
- ReportEngine;
- clique no card: Rascunho retoma / Concluído abre relatório;
- sync e fila offline;
- DIAG pequeno copiável/minimizável.

## Aceite humano
OFFLINE, no mesmo atendimento:
1. chegar ao relatório e confirmar a prévia;
2. fechar e voltar à Home;
3. card deve exibir `Concluído`;
4. tocar no corpo do card;
5. deve abrir o relatório, não retomar a edição;
6. dados e foto devem permanecer.

# AUDITORIA — AURORA V47 RC1 R26 — UNIVERSAL DRAFT RECOVERY
Data: 22/09/2026
Base: R25 aprovada por teste humano

## Objetivo
Impedir perda de atendimentos em andamento quando PWA/APK é fechado, reiniciado ou interrompido.

## Princípio preservado
Não foi criado motor paralelo de rascunhos. A R26 reutiliza:
- CaseEngine / AuroraRuntime;
- LocalCaseRepository (`aurora_v2_current_case`) como checkpoint corrente;
- ReportEngine / `aurora_reports` como coleção múltipla já usada por Atendimentos recentes;
- EvidenceStore para fotos completas;
- Cloud Sync / `syncSelectedCase()` para persistência canônica na nuvem.

## Alteração funcional
1. Case em andamento com dados significativos ganha representação compacta em `aurora_reports` com status `Rascunho`.
2. O `id` do rascunho é o próprio `case.id`.
3. Ao concluir, ReportEngine salva o relatório final com o mesmo id e substitui o rascunho; não cria atendimento duplicado.
4. Card Rascunho em Atendimentos recentes abre o fluxo de edição/continuação, não a prévia PDF.
5. A retomada tenta abrir `current_step`; se a etapa não existir, cai na primeira etapa válida.
6. O filtro existente `Em andamento` também inclui `Rascunho`.
7. Após mudança de etapa, a R26 tenta `AuroraCloudSync.syncSelectedCase()` sem bloquear a navegação.
8. Falha/rede ausente mantém o salvamento local e enfileira o case no mecanismo existente quando possível.
9. Fotos não são duplicadas em Base64 no rascunho; ReportEngine e LocalCaseRepository mantêm referências compactas e EvidenceStore continua autoridade dos blobs.

## Arquivos alterados
- `js/bootstrap.js`
- `config/runtime_config.js`
- `service_worker.js`
- `app.html`
- `index.html`

## NÃO alterado
- R23 / autoridade de seleção de serviços;
- refresh silencioso R25;
- auto-sync de concluídos V34;
- Evidence Engine / Evidence Store;
- Report Preview;
- regras específicas Tupy/Grounding;
- Supabase schema/RPC.

## Teste humano piloto obrigatório — Painel Elétrico
1. Confirmar rodapé: `AURORA V47 RECONCILIATION RC1 R26 UNIVERSAL DRAFT RECOVERY`.
2. Abrir Painel Elétrico e preencher Cliente.
3. Avançar para a próxima etapa e preencher dados.
4. Voltar à Home: deve existir card `Rascunho`.
5. Fechar completamente a PWA/app.
6. Abrir novamente e verificar o mesmo rascunho em Atendimentos recentes.
7. Tocar no card: deve continuar o MESMO atendimento, preferindo a última etapa salva.
8. Confirmar dados anteriores e fotos, se houver.
9. Concluir e gerar relatório.
10. Confirmar que existe apenas UM card para esse case, agora `Concluído`.
11. Confirmar Recentes/horário e fechamento do relatório sem regressão da R25.
12. Com internet, conferir em outro dispositivo se o checkpoint sincronizado aparece/é recuperável. Não aprovar nuvem multi-dispositivo se esse passo não passar.

## Status
CANDIDATA — aguarda teste humano. Não congelar antes do PASS.

# AURORA — Grounding Multidispositivo Canônico V23

## Diagnóstico
A Aurora já possuía o fluxo oficial necessário em `cloud_sync.js`:
- `syncSelectedCase()` para persistência do atendimento;
- `aurora:completed-report-closed` para auto-sync de relatório concluído;
- `hydrateOwnProjectsMissingLocally()` para trazer projetos do próprio usuário em outro dispositivo;
- evento `aurora:cloud-project-hydrated` para materializar o atendimento em `aurora_reports` / Atendimentos recentes.

A falha observada no segundo dispositivo era de ordem de inicialização: uma hidratação podia ocorrer antes de `bootstrap.js` registrar o listener `aurora:cloud-project-hydrated`. Assim a nuvem podia ser consultada sem o atendimento ser materializado na lista local da Home.

## Alteração V23
Nenhum fluxo novo de nuvem foi criado. Após registrar os listeners oficiais, o bootstrap chama uma vez o método oficial `AuroraCloudSync.hydrateOwnProjectsMissingLocally()` e então `syncHomeReports()`.

## Preservado
- auto-sync oficial ao fechar relatório;
- `aurora_projects` / `aurora_project_records`;
- Evidence Cloud Sync;
- Cover Photo Feature;
- Tabela B2 aprovada;
- Cards Modelo A;
- botão manual de nuvem continua apenas como recurso auxiliar, não requisito.

## Teste humano
1. PC e celular com a mesma conta.
2. No PC, concluir/fechar relatório e aguardar conexão online.
3. No celular, abrir/reabrir Aurora V23.
4. O atendimento deve aparecer automaticamente em Atendimentos recentes, sem clicar em Nuvem/Baixar.
5. Abrir o mesmo relatório e validar dados, B2/Cards e capa.

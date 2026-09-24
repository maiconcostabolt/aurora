# AUDITORIA AURORA R37 — DURABLE FINALIZATION STATE

Data: 2026-09-23
Base: AURORA V47 RC1 R36A TUPY FINALIZATION STATUS CLEAN

## Falha humana confirmada
Em modo offline, o atendimento Tupy podia persistir campos e fotos e gerar/reabrir o relatório, porém ao fechar a prévia e voltar à Home permanecia como `Rascunho`. O toque no corpo do card, corretamente, retomava a vistoria porque a autoridade canônica ainda indicava atendimento aberto.

## Causa localizada
`report_feature.js` criava o relatório final com status dependente de `isUserVistoriaReportCase()`, podendo gravar `Em andamento`. Além disso, o case canônico usado pela finalização não era promovido para `completed` após a confirmação durável da revisão do relatório. Assim, a geração do relatório e o estado do atendimento podiam divergir.

## Correção R37
Alteração limitada a `js/report_feature.js` e identificadores de build/cache:
1. A finalização efetiva gera o relatório com status `Concluído`.
2. O snapshot usado na geração recebe `status=completed`, `updated_at` e `completed_at`.
3. O runtime NÃO é promovido antes da confirmação durável do relatório.
4. Depois de `REPORT_DURABLE_REVISION_CHECK` passar, o mesmo case é promovido via `CaseBinder.merge()` para `status=completed`, reutilizando a persistência canônica já existente.
5. Nenhum storage paralelo foi criado; nenhuma lógica R35 de quota/persistência/fotos foi alterada.
6. Falha de rede não impede a conclusão local; cloud permanece best-effort/fila existente.

## Lei esperada
Rascunho → editar offline → fotos/dados persistem → gerar relatório durável → MESMO atendimento vira Concluído → Home mostra Concluído → toque no card abre relatório.

## Validações estáticas
- `node --check js/report_feature.js`: PASS
- `node --check js/bootstrap.js`: PASS
- `node --check service_worker.js`: PASS
- `node --check js/pwa_installer.js`: PASS
- fonte oficial de versão: `AURORA V47 RC1 R37 DURABLE FINALIZATION STATE`

## Teste humano obrigatório
Offline: abrir rascunho existente, alterar um campo, confirmar foto, chegar ao relatório, gerar, fechar, voltar à Home. O card deve aparecer `Concluído`; tocar no corpo do card deve abrir o relatório; reabrir PWA ainda offline e confirmar novamente dados/foto/status.

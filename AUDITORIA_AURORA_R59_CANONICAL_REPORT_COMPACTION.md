# AUDITORIA AURORA R59 — CANONICAL REPORT COMPACTION

Base exata: `AURORA_V47_RC1_R58_FORENSIC_REPORT_PERSISTENCE_PWA_TEST.zip`

## Evidência humana usada
A R58 registrou que a revisão recém-gerada e a revisão relida do armazenamento tinham o mesmo ID, porém timestamps diferentes: a nova revisão não substituiu a antiga no armazenamento persistente. O guard R28A permaneceu corretamente fail-closed.

## Correção R59
Alteração funcional concentrada no motor oficial `core/reporting/report_engine.js`.

1. `ReportEngine.save()` continua usando `aurora_reports`; nenhum storage paralelo foi criado.
2. Antes de substituir/inserir a revisão atual, TODOS os relatórios já presentes em `aurora_reports` passam pelo compactador oficial `_compactReport()`.
3. Isso remove resíduos legados pesados de snapshots antigos, inclusive duplicações já tratadas pelas leis R55/R56, sem excluir relatórios.
4. A segunda tentativa de persistência também usa `_compactReport()` integralmente, em vez de uma compactação parcial histórica.
5. O guard `report_persistent_revision_mismatch` NÃO foi removido nem relaxado.
6. Assinaturas canônicas top-level (`report.budget.signature_data` / `report.approval.signature_data`) são preservadas; apenas duplicações de snapshot continuam compactadas.
7. O cache-buster de `core/reporting/report_engine.js`, que ainda estava em `AURORA-V166-CACHE-ATOMICO`, foi alinhado para R59 para impedir que o navegador reutilize uma cópia histórica do motor.
8. Identidade de build avançada para `AURORA V47 RC1 R59 CANONICAL REPORT COMPACTION`.

## Áreas não alteradas
Tupy/Elétrica, módulos/licenças, Auth/UID, Supabase, EvidenceStore, fotos, shapes, navegação, regras de relatório visual, Cloud Sync e cadeia offline R52 permanecem fora do escopo.

## Teste humano
1. Deploy somente no PWA Teste.
2. Abrir online e confirmar em Perfil: `AURORA V47 RC1 R59 CANONICAL REPORT COMPACTION`.
3. Fechar e abrir novamente uma vez para garantir tomada do Service Worker R59.
4. Repetir o MESMO atendimento com assinatura.
5. Clicar em Finalizar inspeção.
6. PASS esperado: relatório abre e o atendimento é promovido para concluído, sem `report_persistent_revision_mismatch`.
7. Se ainda falhar, NÃO repetir alterações: copiar o DIAG imediatamente para capturar `lastSavePersistence`/erro real.

Esta versão é candidata; não considerar aprovada antes do teste humano.

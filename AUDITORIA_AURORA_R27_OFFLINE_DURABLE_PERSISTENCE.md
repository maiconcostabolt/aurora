# AUDITORIA — AURORA V47 RC1 R27 — OFFLINE DURABLE PERSISTENCE

Data: 2026-09-23
Base: AURORA_V47_RC1_R26_UNIVERSAL_DRAFT_RECOVERY_PWA_TEST
Escopo: correção cirúrgica da confirmação de persistência local. R26 original não foi alterada.

## Defeito confirmado

A R26 podia manter `LocalCaseRepository.save()` apenas em `memoryFallback` quando `localStorage.setItem()` falhava. `ReportEngine.save()` podia manter o relatório apenas em `runtimeReports` após duas falhas de persistência. A finalização validava com `engine.get()`, que consulta `runtimeReports` antes do storage persistente, permitindo falso sucesso e posterior `resetCase(blankCase)`.

## Alterações R27

1. `core/storage/local_case_repository.js`
   - `save()` passa a devolver `persistent` e `persistence` sem remover o fallback existente.
   - `load()` evita regressão para envelope persistido mais antigo quando existe `memoryFallback` mais recente na mesma sessão.
2. `core/reporting/report_engine.js`
   - adicionada `getPersistent(reportId)`, que consulta exclusivamente `aurora_reports` persistido.
   - `save()` registra `lastSavePersistence` e distingue persistência durável de sessão-only.
3. `js/bootstrap.js`
   - `aurora:draft-updated` só é disparado como atualização durável quando o draft pode ser relido pelo storage persistente.
4. `js/report_feature.js`
   - confirmação pós-save usa `getPersistent()`.
   - se o relatório não estiver persistido, finalização retorna falha antes de cloud sync, preview e `resetCase(blankCase)`; mensagem informa que o trabalho foi mantido aberto.
5. `config/runtime_config.js` e `service_worker.js`
   - identificação/cache bust atualizados para `AURORA V47 RECONCILIATION RC1 R27 OFFLINE DURABLE PERSISTENCE`.

## Não alterado

EvidenceStore/IndexedDB, Cloud Sync, shapes, autenticação, Supabase, SQL, relatório visual, Service Worker além do cache bust, estrutura de fotos e R26 congelada.

## Validação automática executada

`node --check` PASS nos seis arquivos JS alterados.

## Teste humano obrigatório

1. Abrir candidata online e confirmar a versão R27 em Perfil e configurações.
2. Iniciar atendimento e deixá-lo como Rascunho.
3. Ativar modo avião.
4. Reabrir o rascunho, alterar um campo e anexar uma foto.
5. Finalizar e gerar relatório.
6. Fechar o relatório e reabrir o mesmo atendimento ainda offline.
7. Confirmar campo, foto e estado concluído.
8. Fechar a PWA, reabrir ainda offline e repetir a confirmação.
9. Restaurar internet, sincronizar e reabrir novamente.

Se a quota local estiver realmente esgotada, a R27 pode bloquear a conclusão com mensagem de armazenamento em vez de declarar falso sucesso. Isso é comportamento seguro e identifica a próxima correção necessária sem perder silenciosamente o atendimento.

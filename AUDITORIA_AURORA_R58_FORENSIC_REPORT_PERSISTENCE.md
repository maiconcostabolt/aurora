# AURORA V47 RC1 R58 — FORENSIC REPORT PERSISTENCE

Base exata: R57 SIGNATURE COMPACT DURABLE PERSISTENCE.

## Objetivo
R58 é uma candidata exclusivamente diagnóstica para identificar a causa real de `report_persistent_revision_mismatch` após a R57 provar que reduzir a assinatura não eliminou a falha.

## Alteração funcional
Nenhuma regra de negócio ou persistência foi alterada. O guard durável R28A continua fail-closed. Não foi relaxado nem removido.

## Instrumentação adicionada
No ponto imediatamente após `REPORT_DURABLE_REVISION_CHECK`, o DIAG oficial recebe `R58_DURABLE_SAVE_FORENSIC` com:
- resultado do guard;
- updated_at gerado/persistido;
- snapshot.updated_at gerado/persistido;
- status gerado/persistido;
- `ReportEngine.lastSavePersistence.persistent`;
- nome/mensagem do erro real de persistência;
- tamanho de `aurora_reports`;
- tamanho das assinaturas gerada e relida.

Também foi avançado o cache-buster do `budget_controller.js` para a identidade R58, eliminando ambiguidade de asset antigo durante este diagnóstico.

## Áreas preservadas
Sem alterações em Tupy/Elétrica, módulos/licenças, autenticação, Supabase, EvidenceStore, fotos, relatórios visuais, navegação, offline boot, shapes ou fluxo de finalização.

## Teste humano
1. Publicar somente em PWA Teste.
2. Confirmar em Perfil: `AURORA V47 RC1 R58 FORENSIC REPORT PERSISTENCE`.
3. Repetir exatamente o cenário com assinatura.
4. Quando aparecer o erro, abrir DIAG imediatamente e usar COPIAR DIAGNÓSTICO.
5. Enviar o TXT ao ChatGPT.

Não considerar o problema corrigido nesta versão. R58 serve para provar qual lado diverge antes da correção.

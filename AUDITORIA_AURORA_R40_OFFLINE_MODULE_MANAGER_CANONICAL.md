# AUDITORIA AURORA R40 — OFFLINE MODULE MANAGER CANONICAL

Data: 2026-09-23
Base: AURORA V47 RC1 R39 OFFLINE MODULE AUTHORITY CLEAN
Candidata: AURORA V47 RC1 R40 OFFLINE MODULE MANAGER CANONICAL

## Sintoma humano confirmado na R39
Em modo offline, Perfil e configurações > Módulos Aurora listava Elétrica e BOLT SOLUÇÕES ELÉTRICAS, porém tocar em BOLT fazia a tela fechar/piscar e o aplicativo permanecia em Elétrica.

Também foi observada diferença entre o Perfil online e offline: o card "Editar serviços do segmento" aparecia online em Elétrica e desaparecia offline, indicando divergência entre o ambiente renderizado e `active_license_module_code` usado pelas regras de Perfil.

## Causa localizada
O caminho "Trocar segmento" já persistia a seleção manual pela UID autenticada com `activateForUser(...)` e `markExplicitSessionModuleForUser(...)` antes do reload.

O caminho "Módulos Aurora", apesar de salvar a identidade operacional, ainda terminava apenas com `AuroraModuleAccess.activate(moduleCode)` + reload. Assim, os dois seletores não utilizavam exatamente a mesma autoridade de seleção durante o reload offline.

## Alteração cirúrgica R40
Arquivo alterado: `js/bootstrap.js`.

No handler de `data-demo-info` / Módulos Aurora, após salvar `profile`, `active_license_module_code`, serviços e metadados, a seleção passa a ser persistida pelo mesmo mecanismo canônico já usado no switcher:
- `activateForUser(moduleCode, authenticatedUserId)` quando disponível;
- `markExplicitSessionModuleForUser(moduleCode, authenticatedUserId)`;
- somente depois ocorre `location.reload()`.

Não foi criado novo motor, storage, switcher ou mecanismo paralelo.

## Versão/cache
`config/runtime_config.js` e `service_worker.js` atualizados para:
`AURORA V47 RC1 R40 OFFLINE MODULE MANAGER CANONICAL`

## Preservado
- persistência offline de campos e fotos aprovada;
- finalização/relatório durável já aprovada;
- R39 e anteriores não alteradas;
- sem mudança em Supabase, SQL, autenticação, relatórios ou EvidenceStore;
- DIAG temporário permanece removido.

## Teste humano obrigatório
1. Carregar R40 online e confirmar a versão em Perfil.
2. Ainda online, confirmar Elétrica e o card "Editar serviços do segmento".
3. Ficar offline.
4. Perfil > Módulos Aurora > BOLT SOLUÇÕES ELÉTRICAS > Entrar.
5. Confirmar que a Home muda para Atividades Rotineiras e permanece após reload/reabertura offline.
6. No Perfil de Atividades Rotineiras, "Editar serviços do segmento" deve ficar oculto por regra do módulo Tupy.
7. Offline, voltar por Módulos Aurora para Elétrica.
8. Confirmar Home Elétrica e retorno de "Editar serviços do segmento".

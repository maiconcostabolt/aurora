# AUDITORIA AURORA R38 — OFFLINE MODULE SWITCH

## Escopo
Correção cirúrgica sobre a R37 aprovada no teste humano de retenção offline.

## Defeito reproduzido
Em modo offline, `Módulos Aurora` listava corretamente `Elétrica` e `BOLT SOLUÇÕES ELÉTRICAS`, porém selecionar o outro ambiente fechava o seletor e o reload retornava ao ambiente anterior.

## Causa localizada
O handler de `Módulos Aurora` persistia `profile` e `selected_services`, mas não persistia `active_license_module_code`. Isso é ambíguo para `electrical` e `eletrica_tupy`, pois ambos reutilizam o profile operacional `electrical`. Online a reconciliação cloud podia recompor a licença; offline não havia essa autoridade posterior.

## Alteração R38
Somente no caminho já existente de `Módulos Aurora`:
- mantém `resolveOperationalActivation()` oficial;
- persiste `active_license_module_code` do módulo selecionado;
- persiste `preferred_service` e metadados do módulo;
- mantém o mapa por `moduleCode` e por `profileCode`;
- mantém `AuroraModuleAccess.activate(moduleCode)` e o reload já existentes.

Nenhum motor paralelo de módulos foi criado. A persistência R37 de vistoria/fotos/finalização não foi alterada.

## Versão
`AURORA V47 RC1 R38 OFFLINE MODULE SWITCH`

## Teste humano esperado
1. Online, carregar a R38 e confirmar a versão em Perfil e configurações.
2. Entrar em Elétrica e ficar offline.
3. Módulos Aurora → BOLT SOLUÇÕES ELÉTRICAS.
4. Deve abrir Atividades Rotineiras e permanecer nela offline.
5. Ainda offline: Módulos Aurora → Elétrica.
6. Deve abrir Home Elétrica e permanecer nela.
7. Confirmar que o atendimento R37 continua persistindo dados/fotos/finalização.

# AUDITORIA AURORA R39 — OFFLINE MODULE AUTHORITY CLEAN

Data: 2026-09-23
Base: AURORA V47 RC1 R38 OFFLINE MODULE SWITCH
Candidata: AURORA V47 RC1 R39 OFFLINE MODULE AUTHORITY CLEAN

## Evidência humana de entrada
Em modo offline, o painel Módulos Aurora mostrava Elétrica e BOLT SOLUÇÕES ELÉTRICAS, porém selecionar BOLT fazia a tela piscar e o bootstrap retornava para Elétrica. O painel também expunha `company_authorized` e mantinha o launcher DIAG temporário.

## Causa localizada
A troca manual tinha duas autoridades com chave por usuário: licença ativa e marcador de troca explícita da sessão. O fluxo de Configurações persistia a identidade/licença, porém o marcador explícito usado pelo bootstrap era lido pela chave dependente de `AURORA_ACCOUNT_USER_ID`. A seleção/reload podia atravessar momentos diferentes de publicação desse global. No bootstrap, a ausência do marcador explícito permite que a regra de entrada empresarial escolha novamente o ambiente preferido, anulando visualmente a troca.

## Alteração cirúrgica
1. `js/module_access.js`
   - `explicitSessionKey(userId)` aceita UID explícita.
   - criada `markExplicitSessionModuleForUser(code, userId)`.
   - `readExplicitSessionModule(userId)` aceita UID explícita.
   - `company_authorized` passa a apresentar `Licença ativa` na UI.
2. `js/bootstrap.js`
   - bootstrap lê o marcador explícito pela `authenticatedUserId` canônica.
   - Configurações grava licença ativa pela `activateForUser(..., authenticatedUserId)` e grava o marcador explícito pela mesma UID antes do reload.
   - removido o bloco visual temporário R29/R36 que criava o botão `DIAG`; o diagnóstico cumpriu sua função e não faz parte da candidata limpa.
3. Build atualizado em `config/runtime_config.js` e `service_worker.js`.

## Preservado
- R35: recuperação de quota / persistência durável offline.
- R37: finalização durável do mesmo atendimento.
- Fotos/evidências e relatório.
- Snapshot offline de módulos autorizado.
- Arquitetura oficial `electrical + eletrica_tupy`; nenhum motor paralelo criado.

## Validação estática
- `node --check js/module_access.js`: PASS
- `node --check js/bootstrap.js`: PASS
- `node --check service_worker.js`: PASS
- launcher `aurora-r36-diag-launcher` no bootstrap: AUSENTE
- texto visual bruto `company_authorized`: mapeado para `Licença ativa`

## Teste humano obrigatório
1. Carregar a R39 online uma vez e confirmar a versão em Perfil e configurações.
2. Ficar offline.
3. Em Elétrica > Módulos Aurora > BOLT SOLUÇÕES ELÉTRICAS > Entrar.
4. Esperado: abrir e permanecer em Atividades Rotineiras.
5. Ainda offline, fazer o caminho inverso para Elétrica.
6. Esperado: abrir e permanecer em Elétrica.
7. Confirmar ausência do botão DIAG e exibição de `Licença ativa` em vez de `company_authorized`.

Não considerar aprovado antes do teste humano.

# AUDITORIA AURORA R54 — UNIFIED ONLINE/OFFLINE AUTHORITY

## Status
**CANDIDATA R54 PRONTA PARA TESTE HUMANO.** Não declarar correção aprovada antes do teste humano.

## Base exata
- ZIP base: `AURORA_V47_RC1_R53_OFFLINE_ATOMIC_VISUAL_SHELL_PWA_TEST.zip`
- SHA-256 base: `F67C387D182946725EF54223E9A371E7FF61BDC9E99C43114F8E5F897AE888F5`
- A R53 foi preservada; a R54 foi criada em cópia separada.

## Diagnóstico confirmado
A Aurora não possui dois aplicativos completos, mas a R53 ainda permitia divergência online/offline em duas fronteiras:
1. `rc6_patch.js` e `pwa_installer.js` estavam no pacote PWA, porém não faziam parte da cadeia CORE fail-closed do Service Worker. Em cold-start offline, a ausência de um complementar podia alterar a composição visual/navegação e ocultar o indicador oficial Offline.
2. Atividades Rotineiras Tupy usava uma autoridade híbrida: Home/Gestão lia lista empresarial/cache, enquanto Visualizar/Editar voltava diretamente ao Supabase. Uma atividade concluída localmente offline também não era mesclada imediatamente à lista empresarial cacheada.

## Lei aplicada
**UMA Aurora → UMA Home → UM workflow → UMA navegação → UM relatório.**
Conectividade pode escolher a fonte de dados, mas não pode escolher uma interface alternativa.

## Alterações funcionais
### 1. Shell visual atômico
`service_worker.js` promove para `coreResources`:
- `./js/rc6_patch.js`
- `./js/pwa_installer.js`
- `./core/shapes/eletrica_tupy/flow.js`

Assim, o worker R54 só ativa se esses componentes oficiais necessários ao mesmo comportamento online/offline estiverem disponíveis. Não foi criado footer, dock, indicador ou loader paralelo.

### 2. Navegação oficial única
`rc6_patch.js` continua sendo o mecanismo oficial existente que consolida:
`Anterior | Início | Relatório | Próximo`.
Não foi criado outro mecanismo. Apenas sua disponibilidade offline passou a ser obrigatória no pacote atômico.

### 3. Indicador Offline oficial
`pwa_installer.js` continua sendo o único mecanismo de conectividade, usando `body.aurora-is-offline`; `css/pwa_install.css` continua desenhando o badge `Offline`.
Nenhum segundo indicador foi criado. Sua disponibilidade no cold-start offline passou a ser CORE.

### 4. Autoridade unificada de Atividades Rotineiras Tupy
`core/shapes/eletrica_tupy/flow.js` recebeu três operações canônicas:
- `localEletricaTupyCompanyRows()` — materializa somente relatórios/snapshots Tupy já existentes em `aurora_reports` como rows compatíveis com a mesma UI.
- `mergeEletricaTupyActivityRows()` — mescla lista empresarial/cloud-cache com atendimentos locais, deduplicando por `id` e `legacy_case_id`.
- `resolveGestaoWorkingCase()` — usa snapshot local quando existente; online tenta cloud e possui fallback para row já carregado; offline nunca exige fetch para abrir o row disponível.

`loadHomeRecentActivitiesInto()` e `loadCompanyActivitiesInto()` agora usam a mesma coleção mesclada. Portanto, uma atividade criada offline pode aparecer imediatamente na mesma Home/Gestão sem esperar upload, e cloud/cache/local não geram UIs diferentes.

### 5. Visualizar/Editar sem fetch obrigatório offline
`openAdminFinalDocumentFromGestao()` e `startAdminReview()` deixaram de chamar diretamente `loadCompanyProjectForAdmin()` como única autoridade. Ambos usam `resolveGestaoWorkingCase()`.
Isso preserva o caminho cloud online, mas permite usar o snapshot já disponível local/cache offline, sem criar visualizador/editor alternativo.

## Cache-bust / identidade
Identidade candidata:
`AURORA V47 RC1 R54 UNIFIED ONLINE OFFLINE AUTHORITY`

Foram alinhadas as referências ativas R53→R54 nos entrypoints/runtime/SW e os query strings ativos de:
- `rc6_patch.js`
- `pwa_installer.js`
- `core/shapes/eletrica_tupy/flow.js`

A fonte oficial `config/runtime_config.js` também foi atualizada, preservando a regra de versão visível em Perfil e configurações.

## Arquivos-fonte alterados contra R53
1. `service_worker.js`
2. `app.html`
3. `index.html`
4. `config/runtime_config.js`
5. `js/bootstrap.js` — somente identidade R54
6. `js/pwa_installer.js` — somente identidade R54; mecanismo funcional oficial preservado
7. `js/aurora_r48_private_tupy_environment_trace.js` — somente identidade R54
8. `core/shapes/eletrica_tupy/flow.js` — autoridade unificada local/cloud/cache

Este MD é documentação da candidata e não conta como alteração funcional.

## Áreas não alteradas funcionalmente
- autenticação / UID
- offline ticket
- `company_access.js`
- `module_access.js`
- Supabase / SQL / RPC / RLS
- IDs `eletrica_tupy`
- evidências/fotos
- ReportEngine/PDF
- draft engine / persistência R37
- permissões Admin/User
- layouts das shapes
- componentes FooterNavigation/AppShell/AuroraRuntime

## Validações estáticas
- `node --check core/shapes/eletrica_tupy/flow.js` — PASS
- `node --check service_worker.js` — PASS
- `node --check js/bootstrap.js` — PASS
- `node --check js/pwa_installer.js` — PASS
- `pwa-assets.json` contém `rc6_patch.js`, `pwa_installer.js` e `core/shapes/eletrica_tupy/flow.js` — PASS
- os três arquivos existem fisicamente — PASS
- os três fazem parte da garantia CORE R54 — PASS
- referências ativas da identidade R53 nos entrypoints/build auditados — 0

## Teste humano — ordem obrigatória
1. Fazer deploy da R54 em PWA de teste.
2. ONLINE: abrir Perfil e configurações e confirmar exatamente `AURORA V47 RC1 R54 UNIFIED ONLINE OFFLINE AUTHORITY`.
3. ONLINE: entrar em Atividades Rotineiras Tupy e confirmar Home/navegação normal.
4. Fechar completamente o PWA.
5. Colocar o aparelho offline/modo avião.
6. Abrir em cold-start offline e confirmar primeiro: mesma Home e badge `Offline` visível.
7. Abrir uma vistoria e confirmar a mesma navegação `Anterior | Início | Relatório | Próximo`.
8. Em Atividades Rotineiras Tupy, testar olho e lápis em atividade já disponível offline.
9. Criar uma nova atividade offline, concluir/gerar relatório, voltar à Home e confirmar que aparece imediatamente em Últimas atividades.
10. Fechar e reabrir ainda offline e repetir visualização da atividade nova.

Não ampliar o teste para outras regressões até estes itens passarem.

## Critério de aprovação
Somente após o teste humano acima: congelar R54 como marco da **autoridade unificada online/offline**. Até lá, status é apenas candidata.

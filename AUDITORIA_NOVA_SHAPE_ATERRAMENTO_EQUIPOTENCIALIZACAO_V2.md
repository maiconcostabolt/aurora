# AUDITORIA — NOVA SHAPE ATERRAMENTO E EQUIPOTENCIALIZAÇÃO V2

Build: `AURORA_NOVA_SHAPE_ATERRAMENTO_EQUIPOTENCIALIZACAO_V2_PWA_TEST_20-09-2026`

## Objetivo desta rodada
Completar o esqueleto de módulo independente seguindo o padrão funcional já existente de Condomínios, sem construir telas internas do Aterramento.

## Correções
- `grounding_equipotentialization` registrado no catálogo central `public.aurora_modules` do Supabase, habilitado e com `sort_order=87`.
- Registro feito diretamente no projeto MLC AURORA e também documentado em SQL idempotente no pacote.
- `company_team.js`: adicionada identificação do novo módulo nos mesmos mapas usados por Condomínios em Minha Equipe.
- Mantido o profile/segmento e catálogo operacional criados na V1.
- `runtime_config.js`: build atualizada para a V2; esta é a fonte usada pelo rodapé de Perfil e configurações.
- `service_worker.js` e query strings dos arquivos alterados receberam cache-bust da V2 para reduzir risco de PWA antiga permanecer carregada.
- `AURORA_PADRAO_NOVA_SHAPE_V1.md` recebeu gate obrigatório de módulo independente.

## Preservado
- Nenhuma tela interna nova de Aterramento foi construída.
- Motores de Evidence, PhotoEditor, CoverPhoto, Report Engine, Suggestions Picker, AuroraDialog, Cloud e Auth não foram reconstruídos.
- Aterramento antigo permanece apenas como referência; não foi reintroduzido em Elétrica.

## Gate humano desta rodada
1. Admin Aurora: card `Aterramento e Equipotencialização` deve aparecer no catálogo para autorização/licença.
2. Conta autorizada: Perfil e configurações > Módulos Aurora deve mostrar o novo card.
3. Minha Equipe: quando a empresa tiver entitlement do módulo, deve aparecer `Aterramento e Equipotencialização` entre Ambientes permitidos.
4. COMPANY_USER só deve enxergar o módulo se o ADMIN o marcar.
5. Rodapé de Perfil e configurações deve mostrar exatamente `AURORA_NOVA_SHAPE_ATERRAMENTO_EQUIPOTENCIALIZACAO_V2_PWA_TEST_20-09-2026`.

Somente após este gate passar iniciar a reconstrução da Tela 1.

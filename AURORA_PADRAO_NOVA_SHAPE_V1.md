# AURORA — PADRÃO PARA NOVAS SHAPES V1

## Regra central
Não criar componente novo quando a Aurora já possuir motor/componente oficial.
A nova shape fornece identidade, textos, campos, listas técnicas, regras técnicas e configuração. Os motores Aurora executam o comportamento compartilhado.

## Fase 0 — Identidade
1. Definir `profile_id` independente.
2. Definir `service_id`.
3. Definir nome, ícone, descrição e catálogo.
4. Remover o serviço do segmento antigo somente no catálogo/seleção; preservar código legado como referência até a nova shape ser aprovada.
5. Validar entrada, home, módulo e troca de ambiente antes de criar telas.

## Fase 1 — Mapa de telas (uma por vez)
Para cada tela registrar:
- nome da tela;
- textos/títulos/subtítulos;
- campos específicos;
- listas/sugestões;
- dados obrigatórios/opcionais;
- motor Aurora responsável;
- chave/caminho de persistência;
- comportamento ao editar/reabrir;
- destino no relatório.

## Motores que devem ser procurados antes de programar
- AURORA.FORM.ENGINE
- AURORA.SUGGESTIONS.PICKER
- AURORA.DIALOG
- AURORA.EVIDENCE.ENGINE
- AURORA.EVIDENCE.STORE
- AURORA.EVIDENCE.PHOTO_EDITOR
- AURORA.EVIDENCE.COVER_PHOTO
- AURORA.OCCURRENCE.ENGINE
- AURORA.UI.FOOTER_NAVIGATION
- AURORA.UI.WORKFLOW_DOCK
- AURORA.REPORT.ENGINE
- AURORA.APP.SHELL
- Cloud / ADMIN-USUÁRIO / Aurora AI quando aplicável

## Regra para textos
Antes de alterar um texto, localizar e registrar o arquivo/chave de origem. O mapa da shape deve funcionar como índice de manutenção: `texto/tela → arquivo → chave/função → motor`.

## Validação por etapa
CÓDIGO REAL → PWA TEST → TESTE HUMANO → APROVAÇÃO → CONGELAR ETAPA.
Não avançar duas telas ao mesmo tempo.

## Proibição
Não copiar picker, modal, câmera/galeria, editor de foto, storage, rodapé, preview, relatório ou navegação para dentro da shape.


## GATE OBRIGATÓRIO — SHAPE INDEPENDENTE / MÓDULO
Antes de criar telas internas, validar a cadeia completa usando Condomínios como referência funcional:
1. Registro em `aurora_modules` (autoridade do catálogo/licenças).
2. Card visível no Admin Aurora para concessão/licenciamento.
3. Card visível em Perfil e configurações > Módulos Aurora.
4. Ambiente disponível em Minha Equipe quando a empresa possui entitlement ativo.
5. ADMIN pode marcar/desmarcar o ambiente por COMPANY_USER.
6. COMPANY_USER enxerga somente ambientes autorizados.
7. Trocar segmento e Home usam o mesmo `module_code`/profile operacional.
8. Identificação exata da build deve aparecer em Perfil e configurações via `config/runtime_config.js`.
9. Só depois desse gate aprovado iniciar Tela 1 da shape.

Referência funcional: `condominiums`. Não criar registries paralelos.

Build usada para consolidar esta regra: `AURORA_NOVA_SHAPE_ATERRAMENTO_EQUIPOTENCIALIZACAO_V2_PWA_TEST_20-09-2026`.

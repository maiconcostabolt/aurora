# AUDITORIA — NOVA SHAPE ATERRAMENTO E EQUIPOTENCIALIZAÇÃO V1
Data: 19/09/2026

## Escopo desta rodada
Somente identidade e separação de catálogo. Nenhuma tela interna nova foi criada.

## Nova identidade
- profile_id: `grounding_equipotentialization`
- service_id: `grounding_equipotentialization`
- nome: `Aterramento e Equipotencialização`

## Alterações
- `config/onboarding.json`: remove `grounding` de Elétrica e adiciona segmento independente.
- `config/profiles/grounding_equipotentialization.json`: novo perfil independente.
- `js/bootstrap.js`: apresentação e catálogo do novo módulo; remove card Grounding de Elétrica.
- `js/aurora_i18n.js`: rótulos PT-BR do novo profile/service.
- `AURORA_PADRAO_NOVA_SHAPE_V1.md`: padrão de construção/manutenção para próximas shapes.

## Preservado
O código legado `core/shapes/grounding/*` não foi apagado nesta fase. Ele fica somente como referência até a nova shape ser construída e aprovada tela por tela.
Nenhum motor Evidence/Report/Cloud/Admin/AI foi alterado nesta rodada.

## Validações estáticas
- `node --check js/bootstrap.js`: PASS
- `node --check js/aurora_i18n.js`: PASS
- JSON onboarding/profile: PASS

## Teste humano desta fase
1. Aterramento não deve aparecer mais dentro de Serviços Elétricos.
2. Deve existir `Aterramento e Equipotencialização` como ambiente/segmento independente.
3. Os demais serviços elétricos devem continuar presentes.
4. Não validar telas internas ainda.

# AURORA — Grounding Cover Canonical V24

## Escopo
Correção exclusiva da foto de capa do módulo Aterramento e Equipotencialização.

## Causa confirmada
O Grounding filtrava `state.evidence_groups` apenas para grupos dos pontos de aferição. A foto de capa era salva pelo Evidence/Cover Photo oficiais, porém o grupo `report_cover` não seguia no snapshot do relatório. Como o Report Engine compacta `coverPhoto.src`, ao reabrir o relatório o Report Preview não encontrava a foto-fonte pelo `source_photo_id` para reconstruir o `src`.

## Correção
1. `syncEvidence()` passa a preservar também a referência do grupo oficial de capa (`record_kind=report_cover_photo` / `linked_entity_type=report_cover`) no snapshot.
2. Antes de `createFromCase()`, o Grounding executa o mesmo pipeline já usado por shapes maduras: `AuroraReportFeature.hydrateCoverPhoto()` e `hydrateEvidenceGroups()`.
3. Nenhum novo storage, RPC ou engine foi criado.
4. Tabela B2, Cards Modelo A e fluxo multidispositivo V23 não foram redesenhados.

## Build
`AURORA_GROUNDING_COVER_CANONICAL_V24_PWA_TEST_20-09-2026`

## Teste humano
Selecionar B2, anexar capa, gerar, fechar e reabrir o mesmo relatório. A foto deve permanecer na capa. Repetir abertura em segundo dispositivo após sincronização automática.

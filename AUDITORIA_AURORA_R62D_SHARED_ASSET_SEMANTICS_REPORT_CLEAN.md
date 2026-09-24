# AURORA R62D — Shared Asset Semantics + Report Clean

Base: R62C aprovada parcialmente em teste humano.

## Escopo
1. Mantido um único motor `js/aurora_assets_pilot.js` para todos os perfis que usam cadastro permanente/QR/histórico.
2. O comportamento permanece compartilhado; a semântica visual passa a vir do catálogo oficial do próprio perfil (`assetCardLabel`).
3. Rótulos por perfil:
   - Oficina: Histórico do veículo
   - Elétrica: Serviços do equipamento
   - Industrial: Serviços do equipamento
   - Drone: Inspeções da estrutura
   - Lavação automotiva: Serviços do veículo
   - Higienização de estofados: Serviços do estofado
   - Cortinas/persianas: Serviços do item
   - Reparos/manutenção: Trabalhos realizados
   - Condomínios: Trabalhos realizados
4. O cliente/unidade continua compondo o título quando disponível.
5. Relatório universal: identificadores automáticos do motor de ativo não são impressos como informação técnica:
   - TAG automática `EQ-*` igual ao código interno é omitida;
   - placeholders genéricos como `ou equipamento` são omitidos.
   - TAG técnica real informada pelo usuário permanece.
6. Código interno, asset_registry_id e QR token continuam preservados no estado/banco para rastreabilidade e QR.

## Exceções auditadas
- `eletrica_tupy`: continua fora do motor genérico de ativos/QR desta rodada.
- `vehicle_inspection`: continua fora do `openForReport` genérico e preserva seu relatório premium próprio.
- Nenhuma implementação paralela foi criada.

## Arquivos funcionais alterados
- `js/aurora_assets_pilot.js`
- `core/reporting/report_preview.js`
- Identidade/cache da build atualizados de R62C para R62D nos arquivos oficiais já existentes.

## Validação estática
- `node --check js/aurora_assets_pilot.js`: PASS
- `node --check core/reporting/report_preview.js`: PASS
- `node --check js/bootstrap.js`: PASS
- `node --check service_worker.js`: PASS
- referências funcionais remanescentes a R62C: 0

## Estado
CANDIDATA PWA TESTE. Não congelar antes do teste humano.

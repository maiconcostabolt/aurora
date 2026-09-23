# AUDITORIA — AURORA GLOBAL RECENT UPDATED AT LAW V33

## Objetivo
Transformar em regra global da Aurora: **Atendimentos recentes sempre exibe a data/hora da última alteração efetiva do atendimento/relatório**, para qualquer serviço/shape.

## Causa rastreada
- O Report Engine gerava `report.updated_at`, mas o `caseData/snapshot` podia manter timestamp anterior.
- Shapes que sincronizavam o case logo após gerar o relatório podiam enviar à nuvem o timestamp antigo.
- A lista local filtrava por módulo, mas não impunha ordenação canônica por `updated_at`.

## Correção global
1. `core/reporting/report_engine.js`
   - `createFromCase()` define um único `updatedAt`.
   - aplica esse mesmo instante a `caseData.updated_at`;
   - em relatório concluído, aplica também a `caseData.completed_at`;
   - o snapshot criado em seguida herda o mesmo timestamp;
   - o relatório recebe o mesmo `updated_at`.
   - Como o `caseData` usado pelas shapes é atualizado antes do retorno, a sincronização imediatamente posterior envia o mesmo horário à nuvem.

2. `js/bootstrap.js`
   - `reportsForProfile()` agora ordena sempre por `updated_at || created_at`, decrescente.
   - Isso vale para qualquer módulo que use a lista canônica local de relatórios.

## Regra congelável
`última alteração -> case.updated_at == snapshot.updated_at == report.updated_at -> recent sorting/display`

`created_at` permanece sendo a criação original e não é sobrescrito.

## Escopo
Correção no motor compartilhado; não é patch exclusivo de Aterramento. Nenhum layout de relatório foi alterado.

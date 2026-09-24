# AUDITORIA AURORA R60 — COMMERCIAL DIAG UI REMOVAL

## Base
AURORA V47 RC1 R59 CANONICAL REPORT COMPACTION — marco aprovado online/offline.

## Escopo único
Remoção da interface visual temporária `DIAG R52` da UI comercial.

## Alteração funcional
- O trace interno R52 e a observação do Service Worker foram preservados.
- O botão/painel visual temporário não é mais montado no DOM.
- O fallback visual do mesmo diagnóstico foi neutralizado para não reintroduzir o card/botão.
- Nenhum motor offline R52 foi removido ou revertido.

## Identidade
A candidata passa a se identificar como:
`AURORA V47 RC1 R60 COMMERCIAL DIAG UI REMOVAL`

## Fora de escopo / não alterado deliberadamente
Relatórios, persistência, assinatura, fotos, EvidenceStore, Supabase, autenticação, módulos, Tupy, shapes, navegação e regras de negócio.

## Teste humano requerido
1. Deploy em PWA Teste.
2. Confirmar ausência de `DIAG R52` na Home.
3. Confirmar versão R60 em Perfil e configurações.
4. Smoke test online e offline antes de promover para produção/Git aprovado.

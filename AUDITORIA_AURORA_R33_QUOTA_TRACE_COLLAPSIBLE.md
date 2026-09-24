# AUDITORIA AURORA R33 — QUOTA TRACE COLLAPSIBLE

Base: R32 SW INSTALL STATE TRACE.

Objetivo único:
- manter o Service Worker R32/R33 já comprovado no cold start offline;
- tornar o diagnóstico de persistência recolhível;
- quando LocalCaseRepository.save cair em QuotaExceededError, exibir:
  - chave que tentou gravar;
  - tamanho anterior da chave;
  - tamanho aproximado da tentativa;
  - cinco maiores chaves atuais do localStorage;
- não limpar, mover ou alterar dados do usuário.

Não foram alterados:
- regra de persistência;
- EvidenceStore;
- Supabase/Cloud Sync;
- fluxo da vistoria;
- conclusão/relatório;
- dados existentes.

Critério do próximo teste:
offline -> alterar um único campo -> abrir diagnóstico -> fotografar QUOTA WRITE + TOP KEYS.
Não adicionar foto e não finalizar antes desse print.

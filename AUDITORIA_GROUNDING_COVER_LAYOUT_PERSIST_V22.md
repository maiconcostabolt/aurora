# AURORA Grounding V22 — persistência de capa e layout

Base: V21, preservando Tabela B2 aprovada na V20.

Correções cirúrgicas:
- `report_points_layout` passa a ser espelhado também em `approval.report_points_layout`, além de `grounding`, snapshot e report record.
- renderer Grounding aceita `approval.report_points_layout` como fallback persistente.
- renderer Grounding resolve foto de capa também por `snapshot.coverPhoto` quando o registro de relatório não mantiver a cópia top-level.
- `persist()` da shape passa a manter `coverPhoto` sincronizada no CaseBinder.
- sincronização de capa deixa de apagar destrutivamente `state.coverPhoto` quando a leitura assíncrona do EvidenceStore não retorna a imagem naquele instante.
- após anexar capa, a própria foto retornada pelo Evidence Engine é usada imediatamente como referência antes da hidratação oficial.

Não alterados: visual B2 aprovado, Cards Modelo A, auth, Supabase schema, QR, service worker, bootstrap.

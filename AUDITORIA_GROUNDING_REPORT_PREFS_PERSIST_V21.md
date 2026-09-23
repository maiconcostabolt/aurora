# AURORA — Grounding Report Preferences Persist V21

Base: V20 (Tabela B2 aprovada em teste humano).

Escopo cirúrgico:
- mantém Modelo A e Tabela B2 sem alteração visual;
- foto de capa passa a ser reidratada pelo ID exato do atendimento Grounding;
- ao finalizar, referência da foto de capa é preservada no relatório/snapshot;
- escolha `report_points_layout` é persistida de forma redundante no relatório e snapshot;
- Report Preview ao reabrir aceita a preferência persistida no snapshot ou no registro do relatório;
- nenhuma alteração em auth, Supabase, QR, Evidence Engine, service worker ou outras shapes.

Build: AURORA_GROUNDING_REPORT_PREFS_PERSIST_V21_PWA_TEST_20-09-2026
DIAG V21

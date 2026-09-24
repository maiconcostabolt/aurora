# AUDITORIA AURORA R32 — SW INSTALL STATE TRACE

Base: R31 Service Worker Takeover.

Objetivo exclusivo: diagnosticar na própria tela por que o Service Worker novo não substitui o controlador V133.

Alterações:
- trace inline no shell mostra CONTROLADOR, ACTIVE, WAITING, INSTALLING, FASE e ERRO;
- `pwa_installer.js` emite eventos diagnósticos para início/sucesso/erro de register e update;
- `app.html` e `index.html` usam a mesma revisão de `pwa_installer.js`;
- identidade de bootstrap/Service Worker atualizada para R32;
- nenhuma alteração em persistência, EvidenceStore, Supabase, Cloud Sync ou fluxos de vistoria.

Critério desta rodada: abrir ONLINE e fotografar o trace antes de qualquer teste offline.

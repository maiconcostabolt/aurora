# AUDITORIA AURORA R36A — VERSION + SHELL CLEAN

Correção cirúrgica sobre R36, sem alterar a lógica funcional de persistência/finalização.

- Removido texto residual literal `style="display:none!important"` após `</html>` de `app.html` e `index.html`.
- `config/runtime_config.js` atualizado na fonte oficial de identificação para `AURORA V47 RC1 R37 DURABLE FINALIZATION STATE`.
- Identidade/cache-bust da candidata alinhados em service worker, bootstrap, instalador PWA e referências HTML para R36A.
- Lógica R36 de finalização Tupy preservada.
- Diagnóstico recolhível/copiar preservado.
- `node --check` PASS em runtime_config.js, bootstrap.js, pwa_installer.js e service_worker.js.

Teste humano requerido: confirmar versão em Perfil, ausência do texto residual no boot e fluxo online antes do teste offline.

# AURORA V25 — última revisão + capa + horário + escala global da logo

Base: V24 aprovada parcialmente.

## Escopo
1. Reabertura de relatório compacto: Cover Photo é reidratada também a partir de `snapshot.coverPhoto` e, se necessário, do primeiro grupo oficial `report_cover`/`report_cover_photo`.
2. Auto-sync de relatório finalizado: força `updated_at` da revisão recém-gerada e leva `coverPhoto` no mesmo snapshot sincronizado, para o card/reabertura apontarem para a última revisão.
3. Horário: mantém ISO/UTC no dado e usa o formatador local já existente da Aurora (`Intl.DateTimeFormat`) na interface; a revisão agora atualiza o timestamp enviado à nuvem.
4. Minha empresa: novo controle global `Tamanho da logo na capa dos relatórios`, 70%–180%, padrão 100%.
5. O valor `logo_report_scale` integra a identidade corporativa e é consumido pelo Report Engine/Preview e PDF PWA. Relatórios existentes sem a propriedade permanecem em 100%.

## Preservado
- Tabela B2 aprovada.
- Cards Modelo A.
- Multidispositivo V23.
- Evidence/Cover Photo oficial.
- Sem novo storage, RPC ou motor paralelo.

## Teste humano
- Editar relatório existente, anexar capa, gerar, fechar e reabrir pelo card: capa deve permanecer.
- Card deve refletir horário da última revisão em hora local do dispositivo.
- Perfil e configurações > Minha empresa: alterar tamanho da logo, salvar, gerar relatório e validar capa/HTML/PDF.

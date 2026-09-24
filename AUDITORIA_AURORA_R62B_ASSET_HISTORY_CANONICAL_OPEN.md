# AURORA R62B — Asset History Canonical Open

Base: R62A.

Correções cirúrgicas:
- card de Áreas e equipamentos deixa o código técnico EQ-* fora do título principal e mostra `Cliente · Trabalhos realizados`;
- código EQ-* permanece como identificador técnico permanente do ativo/QR;
- histórico Individual pode reabrir o projeto canônico pela RPC oficial;
- atendimento Em andamento abre o mesmo case para continuar edição;
- botão Editar usa o mesmo evento `aurora:edit-report` já consumido pelo fluxo oficial;
- atendimento Concluído continua abrindo prévia;
- `aurora_assets_my_list` passa a listar também ativos pertencentes ao usuário Individual após cold start;
- regras empresariais existentes preservadas.

Não altera ReportEngine, shapes, evidências, Tupy ou mecanismo de QR.

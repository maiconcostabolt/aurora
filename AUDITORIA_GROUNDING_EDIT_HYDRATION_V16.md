# AURORA — Grounding Edit Hydration V16

## Sintoma
Ao abrir um relatório de Aterramento, clicar em **Editar atendimento** e avançar após **Cliente**, os dados das etapas específicas de Aterramento eram substituídos por um estado vazio.

## Causa confirmada
O fluxo canônico `aurora:edit-report` hidratava corretamente `runtime.getCase()` com o snapshot completo do relatório. Porém, ao sair da etapa compartilhada **Cliente**, a ponte `openAfterSharedCustomer()` da shape Grounding procurava apenas o draft local da shape. Como esse draft é removido após gerar o relatório, a função executava `blank()` e descartava `current.grounding` já restaurado pelo fluxo canônico.

## Correção cirúrgica
Arquivo funcional alterado: `core/shapes/grounding/flow.js`.

Regra nova da ponte Cliente → Grounding:
1. Se existir draft local do MESMO case, reutiliza o draft.
2. Senão, se o case canônico atual já contém `current.grounding`, clona o case hidratado completo.
3. Só usa `blank()` quando não existe nem draft válido nem Grounding hidratado.

Assim, editar um relatório existente preserva identificação, metodologia/instrumento, pontos, conclusão, preferência Cards/Tabela B2 e demais dados presentes no snapshot.

## Fora do escopo / preservado
Não alterados: `bootstrap.js`, auth, Supabase, cloud sync, service worker, Evidence Engine, QR, Report Engine compartilhado, Minha Equipe e demais shapes.

## Identificação
`AURORA_GROUNDING_EDIT_HYDRATION_V16_PWA_TEST_20-09-2026`

## Teste humano alvo
Relatório existente → Editar atendimento → Cliente preenchido → Próximo → confirmar dados anteriores → avançar por todas as etapas → confirmar pontos e finalização preservados.

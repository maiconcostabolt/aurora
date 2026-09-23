# AURORA V39 — RESTAURA FLUXO + CAMPOS VAZIOS

Base: V37 aprovada no horário/refresh.

## Escopo
- Preserva integralmente o fluxo de telas da V37.
- Corrige regressão introduzida na V38: `saveResult` agora permanece no escopo até a transição para a shape Grounding.
- O `customer` autoritativo é o `patch.customer` devolvido pelo `AuroraRuntime.saveCurrent()`; valores `""` são preservados como exclusão válida.
- Não altera Report Engine visual, B2, capa, fotos, QR, Evidence ou mecanismo de horário aprovado na V37.

## Regressão V38 identificada
A V38 declarou o retorno de `saveCurrent()` dentro do bloco `try` e tentou lê-lo fora desse escopo. Isso interrompia a transição após Cliente e deixava visível o workflow-base (Veículo/Dados iniciais/Ocorrências), que não pertence ao Aterramento.

## Teste
1. Abrir relatório Grounding pelo lápis.
2. Apagar telefone e e-mail.
3. Próximo deve abrir a tela própria do Aterramento, não Veículo.
4. Concluir e gerar relatório.
5. Fechar e reabrir.
6. Telefone/e-mail devem permanecer vazios.
7. Horário deve continuar atualizando automaticamente como na V37.

# AURORA V47 RC1 R35 — ACTIVE SNAPSHOT RECLAIM

Base exata: R34.

## Evidência que motivou a correção
Teste humano offline R34:
- `SALVAR CASE: FALHOU FALLBACK:QuotaExceededError`
- `aurora_v2_current_case old=3110ch tentativa=24195ch`
- localStorage ~9.98 MB
- maiores consumidores: múltiplos `aurora_account_storage_data_v1:<uuid>`.

## Correção cirúrgica
O mecanismo de isolamento por conta foi preservado.

Quando uma conta está ATIVA, seus dados já estão materializados nas chaves live do Aurora.
O snapshot `aurora_account_storage_data_v1:<id-da-conta-ativa>` é, nesse momento,
uma segunda cópia redundante. A R35 remove somente esse snapshot redundante.

Antes de trocar de conta ou suspender/logout, o fluxo oficial `saveCurrent()` continua
recriando o snapshot da conta atual e só depois limpa as chaves live. Ao restaurar uma
nova conta, o snapshot é lido normalmente; somente após a restauração ele é liberado.

Não há limpeza global de snapshots de outras contas.
Não há exclusão de relatórios/current-case das regras de snapshot.
Não há alteração de EvidenceStore, ReportEngine, Supabase ou modelo da vistoria.

## Diagnóstico visual
O TRACE amarelo grande foi removido dos shells.
Permanece somente o botão pequeno `DIAG`, com:
- abrir;
- COPIAR DIAGNÓSTICO;
- MINIMIZAR.

## Teste humano pedido
1. Confirmar em Perfil/configurações:
   `AURORA V47 RC1 R35 ACTIVE SNAPSHOT RECLAIM`
2. Ficar offline.
3. Abrir a mesma vistoria em rascunho.
4. Alterar um texto e tocar Próximo.
5. Abrir DIAG > COPIAR DIAGNÓSTICO.
6. Colar o texto no ChatGPT.
7. Se `SALVAR CASE: PASS`, continuar depois para foto/relatório/reabertura.

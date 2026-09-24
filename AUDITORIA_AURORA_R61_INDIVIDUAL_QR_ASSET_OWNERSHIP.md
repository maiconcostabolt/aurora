# AURORA R61 — Individual QR Asset Ownership

Base: R60 congelada e aprovada em produção.

Escopo único desta candidata:
- permitir que conta Individual autenticada crie/atualize seu próprio ativo permanente para QR;
- preservar integralmente a autoridade empresarial existente;
- permitir leitura pública do QR de ativo individual pelo mesmo `aurora_asset_public_get_v2` oficial;
- não criar motor paralelo de QR.

Modelo de propriedade:
- Empresarial: `company_id` preenchido, `owner_user_id` nulo.
- Individual: `company_id` nulo, `owner_user_id = auth.uid()`.

Segurança:
- `aurora_asset_upsert` continua exigindo autenticação;
- usuário Individual só localiza/atualiza ativo cujo `owner_user_id` seja o próprio `auth.uid()`;
- QR público continua somente leitura e acessível apenas pelo token público aleatório já existente;
- permissões empresariais não foram relaxadas.

Não alterado:
- ReportEngine;
- assinatura;
- persistência local de relatórios;
- EvidenceStore/fotos;
- Tupy;
- shapes;
- navegação;
- regras empresariais de permissão.

Teste humano obrigatório antes de congelar:
1. conta Individual gera relatório;
2. `Etiqueta QR` cria o cadastro sem `AURORA_COMPANY_REQUIRED`;
3. QR abre publicamente;
4. conta Empresarial continua gerando QR normalmente.

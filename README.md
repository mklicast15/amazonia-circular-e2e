# Amazônia Circular — E2E (Cypress)

Suíte de testes end-to-end para os fluxos críticos da Amazônia Circular:
cadastro, login e recuperação de senha, publicação e gestão de anúncios,
envio de proposta/negociação (incluindo o lado do vendedor no painel),
conta/perfil/LGPD, e controle de acesso por papel (comprador, vendedor,
administrador).

## Pré-requisitos

Este repositório só testa a aplicação de fora (via browser + chamadas HTTP
diretas para setup/limpeza) — não importa nenhum código do app. Para rodar,
você precisa do repo `amazoniacircular` rodando localmente:

- Frontend em `http://localhost:3000`
- Backend em `http://localhost:4000`

**Importante:** o backend local aponta para o banco de dados de **produção**
(Neon). Por isso toda automação usa contas descartáveis: registra via API,
age, e apaga a conta ao final (`DELETE /me/account`, que cascade-deleta
anúncios/propostas/equipe). Nenhum teste deve fugir desse padrão.

### Duas mudanças necessárias no repo do app

Para a suíte rodar sem esbarrar em proteções que só fazem sentido em
produção, aplique estas duas mudanças no repo `amazoniacircular` antes de
rodar os testes (elas ficam guardadas na branch `test/cypress-e2e` desse
repo, sem merge em `main`):

1. **`server/src/middleware/rateLimit.ts`** — o rate limit de registro/login
   (10 requisições / 15 min) é pensado para produção e a suíte facilmente
   ultrapassa isso numa única rodada. Relaxar esse limite fora de
   `NODE_ENV=production` (deixando produção intacta).
2. **`server/src/scripts/testApproveListing.ts`** (novo arquivo) — como não
   há credenciais de admin disponíveis para automação, esse script
   test-only aprova um anúncio diretamente no banco (bypassa a moderação
   real). Usado só pela suíte, via `cy.exec`, para alcançar o fluxo de
   proposta/negociação.

### Testes de papel ADMIN

Não existe cadastro público com papel ADMIN (o `registerSchema` só aceita
`SELLER`/`BUYER`). Os casos de `cypress/e2e/permissoes/papeis.cy.ts` que
precisam de uma conta administradora registram uma conta descartável normal
e a promovem via `cy.exec`, reaproveitando o próprio script de provisionamento
do app (`server/src/scripts/createAdmin.ts`, comando `promoteToAdmin` em
`cypress/support/commands.ts`) — esse script já existe independente da branch
`test/cypress-e2e`. Como ele faz `upsert` por e-mail, promove a conta já
registrada em vez de criar uma nova, então ela continua descartável
normalmente (`DELETE /me/account`) ao final do teste.

### Caminho do repo do app

O comando `approveListingForTest` roda o script acima via `cy.exec`,
apontando para a pasta `server/` do repo do app através da env var
`appServerPath` (default: `../ac-tester-automation/server`, assumindo os
dois repos lado a lado). Se o seu clone estiver em outro lugar, ajuste em
`cypress.config.ts` ou rode com:

```bash
CYPRESS_appServerPath=/caminho/para/amazoniacircular/server npm run cy:run
```

## Rodando

```bash
npm install
npm run cy:open   # modo interativo
npm run cy:run    # modo headless
```

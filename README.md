# Amazônia Circular — E2E (Cypress)

## Sobre o projeto

A Amazônia Circular é um marketplace que conecta a indústria geradora de
resíduos plásticos do Polo Industrial de Manaus (PIM) a recicladoras,
transformadoras e compradores de matéria-prima: o PIM gera um grande volume
de aparas e retalhos pós-industriais (PET, PEAD, PP, ABS e outros polímeros)
que muitas vezes vira passivo ambiental por falta de canal de venda — a
plataforma dá visibilidade a esse material e aproxima quem vende de quem
compra, mantendo o plástico em circulação na economia.

**Produção:** https://www.amazoniacircular.com.br/

Este repositório contém só a suíte de testes E2E — o código da aplicação
(frontend/backend) vive em um repositório separado, de propósito, para não
misturar automação de teste com o código de produção.

## Escopo da suíte

Cobre os fluxos críticos: cadastro, login e recuperação de senha, publicação
e gestão de anúncios, envio de proposta/negociação (incluindo o lado do
vendedor no painel), conta/perfil/LGPD, e controle de acesso por papel
(comprador, vendedor, administrador).

A lista completa de casos, com o resultado esperado de cada um, está em
[`cypress/CASOS_DE_TESTE.md`](cypress/CASOS_DE_TESTE.md).

## Pré-requisitos

Este repositório só testa a aplicação de fora (via browser + chamadas HTTP
diretas para setup/limpeza) — não importa nenhum código do app. Para rodar,
você precisa do repo `amazoniacircular` rodando localmente:

- Frontend em `http://localhost:3000`
- Backend em `http://localhost:4000`

**Importante:** Toda automação usa contas descartáveis: registra via API,
age, e apaga a conta ao final (`DELETE /me/account`, que cascade-deleta
anúncios/propostas/equipe). Nenhum teste deve fugir desse padrão.

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

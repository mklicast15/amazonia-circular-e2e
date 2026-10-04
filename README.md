# Amazônia Circular — E2E (Playwright)

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
[`tests/CASOS_DE_TESTE.md`](tests/CASOS_DE_TESTE.md).

## Pré-requisitos

Este repositório só testa a aplicação de fora (via browser + chamadas HTTP
diretas para setup/limpeza) — não importa nenhum código do app. Para rodar,
você precisa do repo `amazoniacircular` rodando localmente:

- Frontend em `http://localhost:3000`
- Backend em `http://localhost:4000`

### Banco de dados: use um banco local

Rode a API do app apontando para um **Postgres local** com as migrações
aplicadas, e nunca para o banco de produção do `server/.env`:

```bash
# no repo do app (amazoniacircular/server)
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/amazonia
npx prisma migrate deploy
RESEND_API_KEY= SMTP_HOST= npx tsx src/index.ts   # sem envio de e-mail real
```

A suíte precisa saber qual é esse banco, porque os scripts do app que ela
executa (ver "Contas ADMIN") rodam fora da API:

```bash
APP_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/amazonia npm test
```

Sem `APP_DATABASE_URL` os testes de admin falham de propósito, e um banco que
não seja `localhost` só é aceito com `E2E_ALLOW_REMOTE_DB=1`. Essa trava existe
porque o script, sem o banco explícito, usava o `server/.env` do app
(produção) e chegou a criar contas ADMIN lá.

Mesmo no banco local, toda automação usa contas descartáveis: registra via
API, age e apaga a conta ao final (`DELETE /me/account`, que apaga em cascata
anúncios, propostas e equipe). Cada conta tem senha aleatória. Use as
fixtures abaixo em vez de registrar contas na mão.

## Estrutura

```
playwright.config.ts
tests/
  support/
    env.ts        # URLs e caminho do repo do app (env vars)
    api.ts        # helpers HTTP: registrar/apagar conta, criar/aprovar anúncio, promover admin
    fixtures.ts   # fixtures do Playwright + gotoReady/row/pickOption
  auth/ listings/ painel/ permissoes/   # specs (*.spec.ts)
  fixtures/cover.png
  CASOS_DE_TESTE.md
```

### Fixtures (`tests/support/fixtures.ts`)

| Fixture | O que faz |
|---|---|
| `account` | Registra uma conta descartável no navegador padrão (`page` já começa logada) e apaga no teardown |
| `accountOverrides` | Opção para mudar a conta da fixture acima — ex.: `test.use({ accountOverrides: { role: 'BUYER' } })` |
| `newActor()` | Cria outro usuário em um navegador isolado (`{ account, context, page, api }`) — para fluxos vendedor × comprador ou admin × alvo. Todos são apagados no teardown |
| `moderator` | Sessão de API de uma conta promovida a ADMIN (uma por worker), usada para aprovar anúncios no setup |

O cleanup usa um snapshot da sessão tirado no registro, então funciona mesmo
se o teste deslogar, limpar cookies ou excluir a própria conta. Testes que
não pedem `account` rodam deslogados.

### Contas ADMIN

Não existe cadastro público com papel ADMIN (o `registerSchema` só aceita
`SELLER`/`BUYER`). `loginAsAdmin` (em `tests/support/api.ts`) promove uma
conta descartável rodando o script de provisionamento do app
(`server/src/scripts/createAdmin.ts`, com `DATABASE_URL=APP_DATABASE_URL`) e
faz o login de admin completo: senha, configuração do MFA e código TOTP,
calculado na própria suíte. O `/admin` só aceita sessões que passaram pelo
MFA, então a sessão aberta no cadastro não serve.

### Caminho do repo do app

`promoteToAdmin` roda o script acima na pasta `server/` do repo do app,
apontada pela env var `APP_SERVER_PATH` (default:
`../amazoniacircular/server`, assumindo os dois repos lado a lado). Se o seu
clone estiver em outro lugar:

```bash
APP_SERVER_PATH=/caminho/para/amazoniacircular/server APP_DATABASE_URL=... npm test
```

Também dá para sobrescrever `BASE_URL` (frontend) e `API_URL` (backend).

## Rodando

```bash
npm install
npx playwright install chromium   # só na primeira vez

npm test                 # headless
npm run test:ui          # modo interativo (UI mode)
npm run test:headed      # headless=false, para ver o navegador
npm run report           # abre o relatório HTML da última execução
npm run typecheck

npx playwright test tests/auth/login.spec.ts   # um arquivo
npx playwright test -g "TC-PERM-0"              # por ID
```

Em falha, o relatório HTML traz screenshot; em retry (CI), também o trace
(`npx playwright show-trace <arquivo.zip>`).

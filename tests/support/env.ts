import path from 'node:path'

// API usada direto pelo setup/cleanup dos testes (registrar e apagar contas
// descartáveis) — nunca pela UI, para os testes ficarem rápidos e
// independentes de bugs do frontend que não têm nada a ver com isso.
export const API_URL = process.env.API_URL ?? 'http://localhost:4000'

// Caminho para a pasta server/ do repo do app (este repo é intencionalmente
// separado do repo do app). Default assume os dois repos lado a lado;
// sobrescrever com APP_SERVER_PATH=/caminho/para/amazoniacircular/server.
export const APP_SERVER_PATH = path.resolve(
  process.env.APP_SERVER_PATH ?? path.join(__dirname, '../../../amazoniacircular/server'),
)

// Banco que os scripts do app (ex.: createAdmin.ts) usam. Precisa ser O MESMO da
// API sob teste e é passado explicitamente ao script — sem isso ele cairia no
// server/.env do app, que aponta para produção. Ver promoteToAdmin.
export const APP_DATABASE_URL = process.env.APP_DATABASE_URL ?? ''

// Liberação explícita para rodar contra um banco que não é local.
export const ALLOW_REMOTE_DB = process.env.E2E_ALLOW_REMOTE_DB === '1'

// Admin já existente no ambiente sob teste (ex.: staging), com o segredo TOTP do MFA.
// Com ele, a suíte não precisa de acesso ao banco para criar admin (ver adminLogin).
export const E2E_ADMIN = process.env.E2E_ADMIN_EMAIL
  ? {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD ?? '',
      totpSecret: process.env.E2E_ADMIN_TOTP_SECRET ?? '',
    }
  : null

// Autenticação HTTP básica do site de staging (STAGING_AUTH do app). Só o frontend pede.
export const SITE_HTTP_CREDENTIALS = process.env.SITE_HTTP_USER
  ? { username: process.env.SITE_HTTP_USER, password: process.env.SITE_HTTP_PASSWORD ?? '' }
  : undefined

// Ambiente remoto (staging): o limite de login/cadastro vale de verdade e tudo é mais lento.
export const REMOTE = !!process.env.BASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.BASE_URL)

// Regressão que preserva os dados: contas e anúncios criados pelos testes NÃO são apagados
// no fim. As contas ficam registradas (com senha) em kept-accounts.local.json, fora do git.
export const KEEP_DATA = process.env.E2E_KEEP_DATA === '1'

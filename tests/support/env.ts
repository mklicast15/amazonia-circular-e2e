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

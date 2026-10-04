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

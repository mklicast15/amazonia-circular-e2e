import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    setupNodeEvents(_on, config) {
      return config;
    },
  },

  env: {
    // API usada direto pelo setup/cleanup dos testes (registrar e apagar
    // contas descartáveis) — nunca pela UI, para os testes ficarem rápidos e
    // independentes de bugs do frontend que não têm nada a ver com isso.
    apiUrl: "http://localhost:4000",
    // Caminho para a pasta server/ do repo do app (este repo é intencionalmente
    // separado do repo do app). Sobrescrever com:
    //   CYPRESS_appServerPath=/caminho/para/amazoniacircular/server npm run cy:run
    appServerPath: "../ac-tester-automation/server",
  },

  defaultCommandTimeout: 8000,
  video: false,
  // O SSR do modo dev do app ocasionalmente sofre um hydration mismatch e
  // remonta a página no cliente (ver cypress/support/e2e.ts); numa visita a
  // uma rota "fria" isso raramente pode cair no meio do remount e deixar um
  // campo temporariamente inutilizável. Um retry absorve esse flake conhecido
  // sem mascarar falhas reais.
  retries: { runMode: 1 },
});

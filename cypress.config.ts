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
    // API used directly by test setup/cleanup (register + delete throwaway
    // accounts) — never through the UI, to keep tests fast and independent
    // of unrelated frontend bugs.
    apiUrl: "http://localhost:4000",
    // Path to the app repo's server/ folder (this repo is intentionally
    // separate from the app repo). Override with:
    //   CYPRESS_appServerPath=/path/to/amazoniacircular/server npm run cy:run
    appServerPath: "../ac-tester-automation/server",
  },

  defaultCommandTimeout: 8000,
  video: false,
  // The app's dev-mode SSR occasionally hits a hydration mismatch and remounts
  // the page client-side (see cypress/support/e2e.ts); on a cold route visit
  // this can rarely land mid-remount and make an input transiently unusable.
  // One retry absorbs that known flake without masking real failures.
  retries: { runMode: 1 },
});

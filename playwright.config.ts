import { defineConfig, devices } from '@playwright/test'
import { SITE_HTTP_CREDENTIALS } from './tests/support/env'

// Ambiente remoto (staging): a API e o banco respondem bem mais devagar que localmente
// (hash de senha, banco que "acorda" depois de parado), então os prazos crescem.
const remote = !!process.env.BASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.BASE_URL)

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  // Os testes dividem o mesmo backend (e o mesmo banco) — paralelizar entre
  // arquivos é seguro porque cada teste usa contas descartáveis próprias,
  // mas mantemos poucos workers para não martelar a API local.
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  forbidOnly: !!process.env.CI,
  // O SSR do modo dev do app ocasionalmente sofre um hydration mismatch e
  // remonta a página no cliente (ver gotoReady em tests/support/fixtures.ts);
  // um retry absorve esse flake conhecido sem mascarar falhas reais.
  retries: process.env.CI ? 1 : 0,
  timeout: remote ? 180_000 : 60_000,
  expect: { timeout: remote ? 20_000 : 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    // Staging: o site inteiro pede usuário e senha (STAGING_AUTH do app).
    httpCredentials: SITE_HTTP_CREDENTIALS,
    // Vale também para as chamadas diretas à API (APIRequestContext).
    actionTimeout: remote ? 30_000 : 8_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

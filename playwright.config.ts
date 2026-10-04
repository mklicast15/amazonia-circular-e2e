import { defineConfig, devices } from '@playwright/test'

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
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    actionTimeout: 8_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

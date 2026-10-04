import type { Page } from '@playwright/test'
import { acceptCookieConsent, expect, gotoReady, test } from '../support/fixtures'

async function attemptLogin(page: Page, email: string, password: string) {
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test.describe('Login', () => {
  // A fixture `account` deixa o navegador autenticado (o registro já cria a
  // sessão). Limpa os cookies para cada teste partir da tela de login
  // deslogado — o cleanup da fixture usa o snapshot da sessão, não o
  // navegador, então continua funcionando.
  test.beforeEach(async ({ account: _account, context, baseURL }) => {
    await context.clearCookies()
    await acceptCookieConsent(context, baseURL!)
  })

  test('TC-LOG-01: autentica com credenciais corretas e leva ao marketplace', async ({ page, account }) => {
    await gotoReady(page, '/login')
    await attemptLogin(page, account.email, account.password)

    await expect(page).toHaveURL((url) => url.pathname === '/')
    await expect(page.locator('.user-menu-trigger-name')).toContainText(account.name)
  })

  test('TC-LOG-02: mostra erro e permanece na tela com senha incorreta', async ({ page, account }) => {
    await gotoReady(page, '/login')
    await attemptLogin(page, account.email, 'SenhaErrada999')

    await expect(page.locator('.form-error', { hasText: 'E-mail ou senha incorretos' })).toBeVisible()
    await expect(page).toHaveURL((url) => url.pathname === '/login')
  })

  test('TC-LOG-03: bloqueia a conta após 5 tentativas de senha errada', async ({ page, account }) => {
    await gotoReady(page, '/login')
    // Tentativas 1-5: senha errada normal — a 5ª é a que ativa o bloqueio.
    for (let i = 0; i < 5; i++) {
      await attemptLogin(page, account.email, 'SenhaErrada999')
      await expect(page.locator('.form-error', { hasText: 'E-mail ou senha incorretos' })).toBeVisible()
    }
    // 6ª tentativa (mesmo com a senha certa) cai no bloqueio, não na checagem de senha.
    await attemptLogin(page, account.email, account.password)
    await expect(page.locator('.form-error', { hasText: 'Muitas tentativas de login' })).toBeVisible()
  })

  test('TC-LOG-04: bloqueia o envio com campos vazios', async ({ page }) => {
    await gotoReady(page, '/login')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    await expect(page).toHaveURL((url) => url.pathname === '/login')
    await expect(page.locator('.user-menu-trigger-name')).toHaveCount(0)
  })
})

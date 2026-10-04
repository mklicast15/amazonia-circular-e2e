import { expect, gotoReady, test } from '../support/fixtures'

test.describe('Recuperação de senha', () => {
  test('TC-REC-01: solicitar o link mostra a mensagem genérica de confirmação', async ({ page, account }) => {
    await gotoReady(page, '/recuperar-senha')
    await page.locator('#rec-email').fill(account.email)
    await page.getByRole('button', { name: 'Enviar link' }).click()

    await expect(page.getByText('Se existir uma conta com esse e-mail, enviamos um link')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar ao login' })).toBeVisible()
  })

  test('TC-REC-02: bloqueia o envio sem informar e-mail', async ({ page }) => {
    await gotoReady(page, '/recuperar-senha')
    await page.getByRole('button', { name: 'Enviar link' }).click()

    await expect(page.locator('.field-error')).toBeVisible()
    await expect(page.getByText('Se existir uma conta com esse e-mail')).toHaveCount(0)
  })

  test('TC-RS-01: acessar a tela de redefinição sem token mostra link inválido', async ({ page }) => {
    await gotoReady(page, '/redefinir-senha')

    await expect(page.getByText('Link inválido. Solicite um novo link de redefinição.')).toBeVisible()
    await expect(page.locator('#rs-password')).toHaveCount(0)
  })
})

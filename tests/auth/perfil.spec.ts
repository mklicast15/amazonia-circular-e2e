import type { Page } from '@playwright/test'
import { expect, gotoReady, test } from '../support/fixtures'

async function openProfile(page: Page) {
  await page.locator('.user-menu-trigger').click()
  await page.locator('.user-menu-dropdown-item', { hasText: 'Editar perfil' }).click()
}

test.describe('Conta e perfil', () => {
  test('TC-PERF-01: edita os dados do perfil com sucesso', async ({ page, account: _account }) => {
    await gotoReady(page, '/')
    await openProfile(page)
    await page.getByRole('button', { name: 'Editar informações' }).click()

    // #um-name remove qualquer caractere que não seja letra/espaço/'/- (onlyLetters),
    // então a tag "E2E" usada em outros dados de teste não sobrevive aqui — "Beatriz
    // Teste" ainda é claramente sintético no contexto (conta descartável e2e-).
    await page.locator('#um-name').fill('Beatriz Teste')
    await page.locator('#um-phone').fill('(92) 90000-1111')
    await page.locator('#um-bairro').fill('Compensa')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    // O modal não exibe o nome (só empresa/contato/endereço) — o nome
    // atualizado aparece no gatilho do menu do usuário.
    await expect(page.locator('.user-info-value', { hasText: '(92) 90000-1111' })).toBeVisible()
    await expect(page.locator('.user-info-value', { hasText: 'Compensa' })).toBeVisible()
    await expect(page.locator('.user-menu-trigger-name')).toContainText('Beatriz Teste')
  })

  test('TC-PERF-02: bloqueia salvar o perfil com telefone vazio', async ({ page, account: _account }) => {
    await gotoReady(page, '/')
    await openProfile(page)
    await page.getByRole('button', { name: 'Editar informações' }).click()

    await page.locator('#um-phone').clear()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    await expect(page.locator('.form-error', { hasText: 'Informe o telefone.' })).toBeVisible()
    await expect(page.locator('#um-phone')).toBeVisible()
  })

  // O logout limpa os cookies do navegador, mas o cleanup da fixture usa o
  // snapshot da sessão tirado no registro, então a conta ainda é apagada.
  test('TC-PERF-03: encerra a sessão ao clicar em Sair', async ({ page, account: _account }) => {
    await gotoReady(page, '/')
    await page.locator('.user-menu-trigger').click()
    // O logout do app é fire-and-forget (limpa o usuário na tela antes do
    // POST /auth/logout responder); navegar antes da resposta abortaria o
    // request e a sessão continuaria viva — então espera a resposta.
    const loggedOut = page.waitForResponse((r) => r.url().endsWith('/auth/logout') && r.ok())
    await page.locator('.user-menu-dropdown-item', { hasText: 'Sair' }).click()
    await loggedOut

    await expect(page.locator('.user-menu-trigger')).toHaveCount(0)
    await gotoReady(page, '/painel')
    await expect(page.getByText('Faça login para acessar seu painel.')).toBeVisible()
  })

  // A exclusão de conta (LGPD) fica no modal "Editar perfil". O cleanup da
  // fixture tolera o 401/403 de apagar uma conta que já não existe.
  test('TC-PERF-04: exclui a própria conta pela área de privacidade (LGPD)', async ({ page, account: _account }) => {
    await gotoReady(page, '/')
    await openProfile(page)
    await page.getByRole('button', { name: 'Excluir minha conta' }).click()

    const dialog = page.locator('.confirm-dialog')
    await expect(dialog).toContainText('Excluir minha conta')
    await dialog.getByRole('button', { name: 'Excluir definitivamente' }).click()

    await expect(page).toHaveURL((url) => url.pathname === '/')
    await expect(page.locator('.user-menu-trigger')).toHaveCount(0)
  })
})

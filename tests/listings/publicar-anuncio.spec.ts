import { expect, gotoReady, pickOption, test } from '../support/fixtures'

test.describe('Publicar anúncio (wizard completo)', () => {
  test('TC-PUB-01: completa as 5 etapas do wizard e envia para aprovação', async ({ page, account: _account }) => {
    await gotoReady(page, '/anuncie')

    await page.locator('#w-titulo').fill('Aparas de PET Transparente Pós-Industrial (Playwright)')
    await pickOption(page, page.locator('#w-tipo'), 'PET')
    await pickOption(page, page.locator('#w-forma'), 'Fardos prensados')
    await page.locator('.choice-chip', { hasText: /^Limpo$/ }).click()
    await page.locator('#w-resumo').fill('Aparas limpas, geração constante, pronta para retirada.')
    await page.locator('#w-desc').fill('Material de teste gerado pela suíte Playwright para validar o wizard de publicação.')
    await page.locator('#w-capa').setInputFiles('tests/fixtures/cover.png')
    await expect(page.locator('.image-upload-preview')).toBeVisible()
    await page.getByRole('button', { name: 'Próximo' }).click()

    await page.locator('#w-qtd').fill('5000')
    await page.locator('.choice-row button', { hasText: 'Imediata' }).click()
    await page.getByRole('button', { name: 'Próximo' }).click()

    // Etapa opcional: avança sem preencher nada.
    await expect(page.getByRole('heading', { name: 'Características do material' })).toBeVisible()
    await page.getByRole('button', { name: 'Próximo' }).click()

    await page.locator('#w-local').fill('Distrito Industrial, Manaus - AM')
    await page.getByRole('button', { name: 'Próximo' }).click()

    await expect(page.getByRole('heading', { name: 'Revisão' })).toBeVisible()
    await page.getByRole('button', { name: 'Enviar para aprovação' }).click()

    await expect(page.getByRole('heading', { name: 'Anúncio enviado para análise!' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ir para o painel' })).toHaveAttribute('href', '/painel')
  })

  test('TC-PUB-02: bloqueia o avanço da etapa 1 sem os campos obrigatórios', async ({ page, account: _account }) => {
    await gotoReady(page, '/anuncie')
    await page.getByRole('button', { name: 'Próximo' }).click()

    await expect(page.locator('.field-error').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sobre o material' })).toBeVisible()
  })

  test('TC-PUB-03: exige login para acessar o formulário de publicação', async ({ page }) => {
    await gotoReady(page, '/anuncie')

    // Sem sessão, /anuncie não redireciona: renderiza o fallback "Entre para
    // publicar" com o link para o login, e o wizard não é montado.
    await expect(page.getByRole('heading', { name: 'Entre para publicar' })).toBeVisible()
    await expect(page.locator('main').getByRole('link', { name: 'Entrar', exact: true })).toHaveAttribute('href', '/login')
    await expect(page.locator('#w-titulo')).toHaveCount(0)
  })
})

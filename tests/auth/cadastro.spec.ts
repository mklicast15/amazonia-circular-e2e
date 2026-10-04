import type { Page } from '@playwright/test'
import { apiDeleteAccount, randomCnpj, uniqueStamp } from '../support/api'
import { expect, gotoReady, test } from '../support/fixtures'

// /cadastro tem dois formulários (convite de equipe e cadastro de empresa),
// cada um com seu próprio checkbox de consentimento — tudo é buscado dentro
// do formulário de empresa para não pegar o do convite.
function companyForm(page: Page) {
  return page.locator('form').filter({ has: page.locator('#c-empresa') })
}

async function fillCompanyForm(page: Page, data: { company: string; cnpj: string; email: string }) {
  await page.locator('#c-empresa').fill(data.company)
  await page.locator('#c-cnpj').fill(data.cnpj)
  await page.locator('#c-responsavel').fill('Ana Teste E2E')
  await page.locator('#c-email').fill(data.email)
  await page.locator('#c-telefone').fill('92991234567')
  await page.locator('#c-senha').fill('TesteSenha123')
  await page.locator('#c-endereco').fill('Rua de Teste, 100')
  await page.locator('#c-bairro').fill('Distrito Industrial')
}

test.describe('Cadastro de empresa', () => {
  // Esta é a única spec que cria conta pela UI, então o cleanup apaga o que
  // estiver na sessão do navegador. Seguro também quando o teste falhou na
  // validação (nenhuma conta criada): DELETE sem sessão só retorna 401.
  test.afterEach(async ({ context }) => {
    await apiDeleteAccount(await context.storageState())
  })

  test('TC-CAD-01: cria uma conta nova com dados válidos e autentica automaticamente', async ({ page }) => {
    const stamp = uniqueStamp()
    await gotoReady(page, '/cadastro')
    await fillCompanyForm(page, {
      company: `Playwright E2E Materiais ${stamp}`,
      cnpj: randomCnpj(),
      email: `e2e-cad-${stamp}@example.com`,
    })
    await companyForm(page).locator('.consent-label input[type="checkbox"]').check()
    await page.getByRole('button', { name: 'Finalizar Cadastro' }).click()

    await expect(page.getByText('Cadastro realizado com sucesso!')).toBeVisible()
  })

  test('TC-CAD-02: bloqueia o envio quando o CNPJ está incompleto', async ({ page }) => {
    await gotoReady(page, '/cadastro')
    await fillCompanyForm(page, {
      company: 'Playwright E2E CNPJ Incompleto',
      cnpj: '11222333', // menos de 14 dígitos
      email: `e2e-cnpj-${uniqueStamp()}@example.com`,
    })
    await companyForm(page).locator('.consent-label input[type="checkbox"]').check()
    await page.getByRole('button', { name: 'Finalizar Cadastro' }).click()

    await expect(page.locator('.field-error', { hasText: 'CNPJ incompleto' })).toBeVisible()
    await expect(page.getByText('Cadastro realizado com sucesso!')).toHaveCount(0)
  })

  test('TC-CAD-03: bloqueia o envio sem aceitar a Política de Privacidade', async ({ page }) => {
    const stamp = uniqueStamp()
    await gotoReady(page, '/cadastro')
    await fillCompanyForm(page, {
      company: `Playwright E2E Sem Consentimento ${stamp}`,
      cnpj: randomCnpj(),
      email: `e2e-consent-${stamp}@example.com`,
    })
    // Checkbox de consentimento propositalmente deixado desmarcado.
    await page.getByRole('button', { name: 'Finalizar Cadastro' }).click()

    await expect(page.locator('.field-error', { hasText: 'Política de Privacidade' })).toBeVisible()
    await expect(page.getByText('Cadastro realizado com sucesso!')).toHaveCount(0)
  })

  test('TC-CAD-04: bloqueia o envio quando o CNPJ tem dígito verificador inválido', async ({ page }) => {
    const stamp = uniqueStamp()
    await gotoReady(page, '/cadastro')
    await fillCompanyForm(page, {
      company: `Playwright E2E CNPJ Inválido ${stamp}`,
      cnpj: '11222333000182', // DV correto seria 81
      email: `e2e-cnpj-dv-${stamp}@example.com`,
    })
    await companyForm(page).locator('.consent-label input[type="checkbox"]').check()
    await page.getByRole('button', { name: 'Finalizar Cadastro' }).click()

    await expect(page.locator('.field-error', { hasText: 'CNPJ inválido' })).toBeVisible()
    await expect(page.getByText('Cadastro realizado com sucesso!')).toHaveCount(0)
  })
})

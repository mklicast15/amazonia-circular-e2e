import type { Page } from '@playwright/test'
import { apiCreateListing, promoteToAdmin, uniqueStamp } from '../support/api'
import { expect, gotoReady, pickOption, row, test, type Actor } from '../support/fixtures'

async function expectBlockedFromAdmin(page: Page) {
  await gotoReady(page, '/admin')

  await expect(page).toHaveURL((url) => url.pathname === '/')
  await expect(page.locator('.toast-error', { hasText: 'Você não tem acesso a esta área.' })).toBeVisible()
}

test.describe('Permissões por papel', () => {
  test.describe('Comprador (BUYER)', () => {
    test.use({ accountOverrides: { role: 'BUYER' } })

    test('TC-PERM-01: compradores conseguem publicar anúncio (papéis não são segregados para isso)', async ({
      page,
      account: _account,
    }) => {
      await gotoReady(page, '/anuncie')

      await page.locator('#w-titulo').fill('Fardos de PP — conta compradora (Playwright)')
      await pickOption(page, page.locator('#w-tipo'), 'PET')
      await pickOption(page, page.locator('#w-forma'), 'Fardos prensados')
      await page.locator('.choice-chip', { hasText: /^Limpo$/ }).click()
      await page.locator('#w-resumo').fill('Anúncio de teste criado por uma conta com papel BUYER.')
      await page.locator('#w-desc').fill('Confere que o backend não restringe a criação de anúncios por papel.')
      await page.locator('#w-capa').setInputFiles('tests/fixtures/cover.png')
      await page.getByRole('button', { name: 'Próximo' }).click()

      await page.locator('#w-qtd').fill('1000')
      await page.locator('.choice-row button', { hasText: 'Imediata' }).click()
      await page.getByRole('button', { name: 'Próximo' }).click()
      await page.getByRole('button', { name: 'Próximo' }).click() // Etapa 3 (Características, opcional)
      await page.getByRole('button', { name: 'Próximo' }).click() // Etapa 4 (Local, opcional — endereço já vem do cadastro)

      await page.getByRole('button', { name: 'Enviar para aprovação' }).click()
      await expect(page.getByRole('heading', { name: 'Anúncio enviado para análise!' })).toBeVisible()
    })

    test('TC-PERM-02: compradores são bloqueados na área administrativa', async ({ page, account: _account }) => {
      await expectBlockedFromAdmin(page)
    })
  })

  test.describe('Vendedor (SELLER)', () => {
    test('TC-PERM-03: vendedores também são bloqueados na área administrativa', async ({ page, account: _account }) => {
      await expectBlockedFromAdmin(page)
    })
  })

  test.describe('Administrador (ADMIN)', () => {
    let listingTitle: string

    // Registra como SELLER normal (registerSchema não aceita ADMIN direto),
    // cria um anúncio pendente para moderar, e então promove a mesma conta via
    // o próprio script de provisionamento de admin do app — ver promoteToAdmin em support/api.ts.
    test.beforeEach(async ({ context, account }) => {
      listingTitle = `Fardos de PVC para moderação (Playwright) ${uniqueStamp()}`
      await apiCreateListing(context.request, { title: listingTitle })
      promoteToAdmin(account.email, account.password)
    })

    test('TC-PERM-04: administradores acessam a área administrativa e veem a fila de moderação', async ({ page }) => {
      await gotoReady(page, '/admin')

      await expect(page).toHaveURL((url) => url.pathname === '/admin/moderation')
      await expect(page.locator('.shell-nav-item', { hasText: 'Moderação' })).toHaveClass(/\bactive\b/)
      await expect(row(page, listingTitle)).toBeVisible()
    })

    test('TC-PERM-05: administrador aprova um anúncio pendente', async ({ page }) => {
      await gotoReady(page, '/admin')
      await row(page, listingTitle).getByRole('button', { name: 'Aprovar' }).click()

      // Aprovar tira o anúncio do filtro padrão "Em análise" (pendente).
      await expect(row(page, listingTitle)).toHaveCount(0)
    })

    test('TC-PERM-06: administrador recusa um anúncio pendente informando o motivo', async ({ page }) => {
      await gotoReady(page, '/admin')
      const listing = row(page, listingTitle)
      await listing.getByRole('button', { name: 'Recusar' }).click()

      await listing.locator('.admin-reject-input').fill('a')
      await listing.getByRole('button', { name: 'Confirmar recusa' }).click()
      await expect(listing.locator('.field-error')).toBeVisible()

      await listing.locator('.admin-reject-input').fill('Fotos insuficientes para avaliar o material.')
      await listing.getByRole('button', { name: 'Confirmar recusa' }).click()

      await expect(listing).toHaveCount(0)
    })

    test('TC-PERM-07: administrador exclui um anúncio informando o motivo', async ({ page }) => {
      await gotoReady(page, '/admin')
      const listing = row(page, listingTitle)
      await listing.getByRole('button', { name: 'Excluir', exact: true }).click()

      await listing.locator('.admin-reject-input').fill('a')
      await listing.getByRole('button', { name: 'Confirmar exclusão' }).click()
      await expect(listing.locator('.field-error')).toBeVisible()

      await listing.locator('.admin-reject-input').fill('Anúncio duplicado, removido pela moderação.')
      await listing.getByRole('button', { name: 'Confirmar exclusão' }).click()

      const dialog = page.locator('.confirm-dialog')
      await expect(dialog).toContainText('Excluir anúncio')
      await dialog.getByRole('button', { name: 'Excluir', exact: true }).click()

      await expect(page.getByText(listingTitle)).toHaveCount(0)
    })
  })

  test.describe('Administrador (ADMIN) — gestão de empresas e usuários', () => {
    let target: Actor

    // Alvo: uma conta descartável em navegador próprio, sobre a qual o admin
    // (fixture `account`, promovida) age. Se um teste deixasse o alvo suspenso,
    // o DELETE /me/account do cleanup daria 403 (requireActiveUser) — todo
    // teste abaixo precisa deixá-lo reativado antes de terminar.
    test.beforeEach(async ({ account: admin, newActor }) => {
      target = await newActor()
      promoteToAdmin(admin.email, admin.password)
    })

    test('TC-PERM-08: administrador concede e depois remove o selo de verificação de uma empresa', async ({ page }) => {
      await gotoReady(page, '/admin/users')
      const company = row(page, target.account.company)

      await company.getByRole('button', { name: 'Verificar', exact: true }).click()
      await expect(company.getByRole('button', { name: 'Remover selo' })).toBeVisible()

      await company.getByRole('button', { name: 'Remover selo' }).click()
      await expect(company.getByRole('button', { name: 'Verificar', exact: true })).toBeVisible()
    })

    test('TC-PERM-09: administrador suspende e depois reativa uma conta', async ({ page }) => {
      await gotoReady(page, '/admin/users')
      const company = row(page, target.account.company)

      await company.getByRole('button', { name: 'Suspender' }).click()
      const dialog = page.locator('.confirm-dialog')
      await expect(dialog).toContainText('Suspender conta')
      await dialog.getByRole('button', { name: 'Suspender', exact: true }).click()

      await expect(company).toHaveClass(/\brow-suspended\b/)
      await expect(company.getByRole('button', { name: 'Reativar' })).toBeVisible()

      // Reativa antes do teste terminar — ver nota do beforeEach acima.
      await company.getByRole('button', { name: 'Reativar' }).click()
      await expect(company).not.toHaveClass(/\brow-suspended\b/)
    })
  })
})

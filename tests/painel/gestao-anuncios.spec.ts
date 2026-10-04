import { apiApproveListing, apiCreateListing, uniqueStamp } from '../support/api'
import { expect, gotoReady, row, test } from '../support/fixtures'

test.describe('Painel — gestão de anúncios', () => {
  let title: string

  test.beforeEach(async ({ context, account: _account, moderator }) => {
    title = `Fardos de PP para gestão (Playwright) ${uniqueStamp()}`
    const listing = await apiCreateListing(context.request, { title })
    await apiApproveListing(moderator, listing.id)
  })

  test('TC-PAI-01: pausa e reativa um anúncio publicado', async ({ page }) => {
    await gotoReady(page, '/painel/listings')
    const listing = row(page, title)

    await expect(listing.locator('.status-pill')).toContainText('Publicado')
    await listing.getByRole('button', { name: 'Pausar' }).click()
    await expect(listing.locator('.status-pill')).toContainText('Pausado')

    await listing.getByRole('button', { name: 'Reativar' }).click()
    await expect(listing.locator('.status-pill')).toContainText('Publicado')
  })

  test('TC-PAI-02: marca um anúncio como vendido', async ({ page }) => {
    await gotoReady(page, '/painel/listings')
    const listing = row(page, title)
    await listing.getByRole('button', { name: 'Marcar vendido' }).click()

    const dialog = page.locator('.confirm-dialog')
    await expect(dialog).toContainText('Marcar como vendido')
    await dialog.getByRole('button', { name: 'Marcar vendido' }).click()

    await expect(listing.locator('.status-pill')).toContainText('Vendido')
    await expect(listing.getByRole('button', { name: 'Pausar' })).toHaveCount(0)
    await expect(listing.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  })

  test('TC-PAI-03: exclui um anúncio informando o motivo', async ({ page }) => {
    await gotoReady(page, '/painel/listings')
    const listing = row(page, title)
    await listing.getByRole('button', { name: 'Excluir', exact: true }).click()

    // Confirmar com um motivo menor que 3 caracteres é bloqueado no front-end.
    await listing.locator('.admin-reject-input').fill('a')
    await listing.getByRole('button', { name: 'Confirmar exclusão' }).click()
    await expect(listing.locator('.field-error')).toBeVisible()

    await listing.locator('.admin-reject-input').fill('Anúncio de teste, não é mais necessário.')
    await listing.getByRole('button', { name: 'Confirmar exclusão' }).click()

    const dialog = page.locator('.confirm-dialog')
    await expect(dialog).toContainText('Excluir anúncio')
    await dialog.getByRole('button', { name: 'Excluir', exact: true }).click()

    await expect(page.getByText(title)).toHaveCount(0)
  })
})

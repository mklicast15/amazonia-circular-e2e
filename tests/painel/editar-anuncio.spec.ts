import { apiApproveListing, apiCreateListing, uniqueStamp } from '../support/api'
import { expect, gotoReady, row, test } from '../support/fixtures'

test.describe('Painel — editar anúncio', () => {
  test('TC-PAI-04: editar um anúncio publicado salva e o devolve para análise', async ({ context, page, account: _account, moderator }) => {
    const stamp = uniqueStamp()
    const listing = await apiCreateListing(context.request, { title: `Fardos de PS antes da edição (Playwright) ${stamp}` })
    await apiApproveListing(moderator, listing.id)
    const newTitle = `Fardos de PS editados (Playwright) ${stamp}`

    await gotoReady(page, `/editar-anuncio/${listing.id}`)
    await expect(page.locator('#w-titulo')).toHaveValue(`Fardos de PS antes da edição (Playwright) ${stamp}`)
    await page.locator('#w-titulo').fill(newTitle)
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByRole('heading', { name: 'Alterações salvas!' })).toBeVisible()

    await gotoReady(page, '/painel/listings')
    await expect(row(page, newTitle).locator('.status-pill')).toContainText('Em análise')
  })
})

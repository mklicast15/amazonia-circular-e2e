import { apiApproveListing, apiCreateListing, uniqueStamp } from '../support/api'
import { expect, gotoReady, pickOption, row, test, type Actor } from '../support/fixtures'

test.describe('Painel — propostas recebidas', () => {
  let seller: Actor
  let listingTitle: string

  // Vendedor num navegador próprio publica um anúncio; o comprador (fixture
  // `account`, navegador padrão) envia a proposta pela UI. Cada teste então
  // age como vendedor em `seller.page` — sem trocar cookies entre sessões.
  test.beforeEach(async ({ page, account: buyer, newActor, moderator }) => {
    listingTitle = `Fardos de PEAD para propostas (Playwright) ${uniqueStamp()}`
    seller = await newActor()
    const listing = await apiCreateListing(seller.api, { title: listingTitle, quantityKg: 3000 })
    await apiApproveListing(moderator, listing.id)

    await gotoReady(page, `/products/${listing.id}`)
    await page.getByRole('button', { name: 'Solicitar cotação / Negociar' }).click()
    await page.locator('#contact-email').fill(buyer.email)
    await page.locator('#contact-phone').fill('92991234567')
    await page.locator('#contact-quantity').fill('1500')
    await page.locator('#contact-message').fill('Interesse no lote, aguardando retorno.')
    await page.getByRole('button', { name: 'Enviar proposta' }).click()
    await expect(page.getByRole('heading', { name: 'Proposta enviada!' })).toBeVisible()
  })

  test('TC-PROPR-01: atualiza o status de uma proposta recebida', async ({ account: buyer }) => {
    const sellerPage = seller.page
    await gotoReady(sellerPage, '/painel/received')
    const status = row(sellerPage, buyer.name).getByRole('button', { name: 'Status da proposta' })

    await expect(status).toHaveText('Nova')
    await pickOption(sellerPage, status, 'Lida')
    await expect(status).toHaveText('Lida')
  })

  test('TC-PROPR-02: registra a venda a partir de uma proposta recebida', async ({ account: buyer }) => {
    const sellerPage = seller.page
    await gotoReady(sellerPage, '/painel/received')
    const proposal = row(sellerPage, buyer.name)

    await proposal.getByRole('button', { name: 'Registrar venda' }).click()
    // O campo já vem preenchido com a quantidade total do anúncio (3000 kg) —
    // confirmar assim vende o lote inteiro e vira o anúncio para "Vendido".
    await expect(proposal.getByPlaceholder('kg vendidos')).toHaveValue('3000')
    await proposal.getByRole('button', { name: 'Confirmar', exact: true }).click()

    const dialog = sellerPage.locator('.confirm-dialog')
    await expect(dialog).toContainText('Registrar venda')
    await dialog.getByRole('button', { name: 'Registrar', exact: true }).click()

    await expect(proposal).toContainText('Anúncio vendido')
    await gotoReady(sellerPage, '/painel/listings')
    await expect(row(sellerPage, listingTitle).locator('.status-pill')).toContainText('Vendido')
  })
})

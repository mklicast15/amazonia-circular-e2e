import { apiApproveListing, apiCreateListing } from '../support/api'
import { expect, gotoReady, test } from '../support/fixtures'

test.describe('Enviar proposta / negociação', () => {
  let listingId: number

  // Vendedor num navegador próprio: cria o anúncio e ele é aprovado pela
  // sessão de moderação (mesma rota da UI de admin), sem script no banco.
  // O comprador, quando o teste precisa de um, é a fixture `account` no
  // navegador padrão (`page`).
  test.beforeEach(async ({ newActor, moderator }) => {
    const seller = await newActor()
    const listing = await apiCreateListing(seller.api, {
      title: 'Fardos de PEAD para negociação (Playwright)',
    })
    listingId = listing.id
    await apiApproveListing(moderator, listingId)
  })

  test('TC-PROP-01: envia uma proposta para um anúncio publicado', async ({ page, account: buyer }) => {
    await gotoReady(page, `/products/${listingId}`)
    await page.getByRole('button', { name: 'Solicitar cotação / Negociar' }).click()

    await page.locator('#contact-email').fill(buyer.email)
    await page.locator('#contact-phone').fill('92991234567')
    await page.locator('#contact-quantity').fill('2000')
    await page.locator('#contact-message').fill('Olá, tenho interesse neste lote. Podemos negociar quantidade e prazo de coleta?')
    await page.getByRole('button', { name: 'Enviar proposta' }).click()

    await expect(page.getByRole('heading', { name: 'Proposta enviada!' })).toBeVisible()
  })

  test('TC-PROP-02: exige campos obrigatórios antes de enviar a proposta', async ({ page, account: _buyer }) => {
    await gotoReady(page, `/products/${listingId}`)
    await page.getByRole('button', { name: 'Solicitar cotação / Negociar' }).click()

    await page.locator('#contact-name').clear()
    await page.locator('#contact-email').clear()
    await page.getByRole('button', { name: 'Enviar proposta' }).click()

    await expect(page.locator('.field-error').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Proposta enviada!' })).toHaveCount(0)
  })

  test('TC-PROP-03: exige login antes de permitir o envio de uma proposta', async ({ page }) => {
    await gotoReady(page, `/products/${listingId}`)
    await page.getByRole('button', { name: 'Solicitar cotação / Negociar' }).click()

    await expect(page.getByText('Para enviar uma proposta você precisa estar logado')).toBeVisible()
    await expect(page.locator('#contact-message')).toHaveCount(0)
  })

  // Contatos do vendedor só para e-mail confirmado (JardelS-Lima/amazoniacircular#197).
  test('TC-PROP-04: conta sem e-mail confirmado não vê os contatos do vendedor', async ({ page, account: _buyer }) => {
    await gotoReady(page, `/products/${listingId}`)

    await expect(page.getByText('Confirme seu e-mail para ver os contatos do vendedor')).toBeVisible()
    await expect(page.locator('.sp-contact-item')).toHaveCount(0)
  })
})

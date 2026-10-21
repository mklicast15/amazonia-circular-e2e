import { API_URL } from '../support/env'
import { apiApproveListing, apiCreateListing, markEmailVerified } from '../support/api'
import { expect, gotoReady, row, test, type Actor } from '../support/fixtures'

// Avaliação do vendedor a partir de "Minhas propostas". Só avalia quem confirmou o e-mail e
// depois que o vendedor respondeu uma proposta sua. O ambiente de teste não envia e-mail,
// então a confirmação é marcada direto no banco (markEmailVerified, mesmo banco do
// APP_DATABASE_URL).
test.describe('Avaliar o vendedor', () => {
  let seller: Actor
  let listing: { id: number }
  const title = 'Retalhos de ABS para avaliação (Playwright)'

  test.beforeEach(async ({ context, account: buyer, newActor, moderator }) => {
    seller = await newActor({ name: 'Vendedora Avaliada E2E' })
    listing = await apiCreateListing(seller.api, { title })
    await apiApproveListing(moderator, listing.id)
    const proposal = await context.request.post(`${API_URL}/proposals`, {
      data: { listingId: listing.id, name: buyer.name, email: buyer.email, quantity: '500 kg', message: 'Tenho interesse neste lote de ABS.' },
    })
    expect(proposal.status()).toBe(201)
  })

  // O vendedor marca a proposta recebida como respondida, pela mesma rota do painel.
  async function sellerAnswers() {
    const received = (await (await seller.api.get(`${API_URL}/me/proposals-received`)).json()).proposals as Array<{ id: string }>
    const res = await seller.api.patch(`${API_URL}/me/proposals-received/${received[0].id}/status`, { data: { status: 'answered' } })
    expect(res.ok()).toBe(true)
  }

  test('TC-AVA-01: comprador com e-mail confirmado avalia o vendedor e a nota aparece no anúncio', async ({ page, account: buyer }) => {
    markEmailVerified(buyer.email)
    await sellerAnswers()
    await gotoReady(page, '/painel/sent')
    await row(page, title).getByRole('button', { name: 'Avaliar' }).click()

    const modal = page.locator('.confirm-panel', { hasText: `Avaliar ${seller.account.company}` })
    await modal.getByRole('radio', { name: '4 estrelas' }).click()
    await modal.locator('#rate-comment').fill('Negociação rápida e material conforme o anúncio.')
    await modal.getByRole('button', { name: 'Enviar avaliação' }).click()
    await expect(page.locator('.verify-notice')).toHaveText('Avaliação enviada. Obrigado!')

    await gotoReady(page, `/products/${listing.id}`)
    await expect(page.locator('.seller-panel .sp-stat', { hasText: 'avaliações' }).locator('.sp-val')).toHaveText('1')
  })

  test('TC-AVA-02: comprador sem e-mail confirmado não consegue avaliar', async ({ page }) => {
    await sellerAnswers()
    await gotoReady(page, '/painel/sent')
    await row(page, title).getByRole('button', { name: 'Avaliar' }).click()
    const modal = page.locator('.confirm-panel', { hasText: 'Avaliar' })
    await modal.getByRole('radio', { name: '5 estrelas' }).click()
    await modal.getByRole('button', { name: 'Enviar avaliação' }).click()
    await expect(modal.locator('.form-error')).toHaveText('Confirme seu e-mail para avaliar empresas.')
  })

  test('TC-AVA-03: sem resposta do vendedor, a avaliação é recusada', async ({ page, account: buyer }) => {
    markEmailVerified(buyer.email)
    await gotoReady(page, '/painel/sent')
    await row(page, title).getByRole('button', { name: 'Avaliar' }).click()
    const modal = page.locator('.confirm-panel', { hasText: 'Avaliar' })
    await modal.getByRole('radio', { name: '3 estrelas' }).click()
    await modal.getByRole('button', { name: 'Enviar avaliação' }).click()
    await expect(modal.locator('.form-error')).toHaveText('Você só pode avaliar após o vendedor responder a uma proposta sua.')
  })
})

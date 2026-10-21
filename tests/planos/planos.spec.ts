import type { APIRequestContext, BrowserContext, Page } from '@playwright/test'
import { API_URL, SITE_HTTP_CREDENTIALS } from '../support/env'
import {
  apiApproveListing,
  apiCreateListing,
  apiDeleteAccount,
  apiRegister,
  buildAccount,
  clientIpHeaders,
  uniqueStamp,
  type SessionState,
  type TestAccount,
} from '../support/api'
import { acceptCookieConsent, adminLogin, expect, gotoReady, pickOption, row, test } from '../support/fixtures'

// Planos pagos (Fase 1): um fluxo só, em série, com duas empresas e um admin. Em série
// de propósito: no staging o login/cadastro é limitado a 10 por IP a cada 15 min, e
// esta ordem gasta 2 cadastros + o login do admin, contando a história real — empresa
// no Semente bate no limite, o admin ativa o Raiz, ela ganha prioridade e o selo, outra
// empresa ganha e perde um teste grátis, e a primeira cai de volta para o Semente.
test.describe.serial('Planos pagos', () => {
  interface Company { account: TestAccount; session: SessionState; context: BrowserContext; page: Page; api: APIRequestContext }

  const stamp = uniqueStamp()
  const promoName = `Teste grátis E2E ${stamp}`
  let admin: { context: BrowserContext; page: Page; api: APIRequestContext; cleanup: () => Promise<void> }
  let seller: Company // começa no Semente, vira Raiz e volta ao Semente
  let other: Company // fica no Semente; recebe e perde o teste grátis
  const sellerListings: number[] = []

  async function newCompany(browser: import('@playwright/test').Browser, baseURL: string, name: string): Promise<Company> {
    const context = await browser.newContext({ baseURL, httpCredentials: SITE_HTTP_CREDENTIALS, extraHTTPHeaders: clientIpHeaders() })
    await acceptCookieConsent(context, baseURL)
    const account = buildAccount({ name })
    const session = await apiRegister(context.request, account)
    return { account, session, context, page: await context.newPage(), api: context.request }
  }

  test.beforeAll(async ({ browser, baseURL }) => {
    seller = await newCompany(browser, baseURL!, 'Vendedora Planos E2E')
    other = await newCompany(browser, baseURL!, 'Outra Empresa Planos E2E')
    admin = await adminLogin(browser, baseURL!)
  })

  test.afterAll(async () => {
    for (const c of [seller, other]) {
      if (!c) continue
      await apiDeleteAccount(c.session)
      await c.context.close()
    }
    await admin?.cleanup()
  })

  test('TC-PLN-01: a página de planos mostra os três planos, os preços e o que vem "em breve"', async ({ page }) => {
    await gotoReady(page, '/planos')
    const cards = page.locator('.plan-card')
    await expect(cards).toHaveCount(3)
    await expect(cards.nth(0)).toContainText('Semente')
    await expect(cards.nth(0)).toContainText('Grátis')
    await expect(cards.nth(1)).toContainText('R$ 99')
    await expect(cards.nth(2)).toContainText('R$ 199')
    await expect(page.locator('.plan-soon')).toHaveCount(3)

    // Celular: nada rola na horizontal (a tabela de comparação cabe na tela).
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0)
  })

  test('TC-PLN-02: empresa nova está no Semente e vê os limites em "Meu plano"', async () => {
    await gotoReady(seller.page, '/painel/plan')
    await expect(seller.page.locator('.plan-summary-name')).toHaveText('Semente')
    await expect(seller.page.locator('.usage-meter', { hasText: 'Anúncios ativos' })).toContainText('0 de 5')
    await expect(seller.page.locator('.usage-meter', { hasText: 'Membros da equipe' })).toContainText('1 de 2')
    await expect(seller.page.locator('.usage-meter', { hasText: 'Fotos por anúncio' })).toContainText('Capa + 3')
    await expect(seller.page.locator('.partner-badge')).toHaveCount(0)
  })

  test('TC-PLN-03: no limite de anúncios ativos, enviar mais um abre a janela de planos', async () => {
    for (let i = 1; i <= 5; i++) {
      sellerListings.push((await apiCreateListing(seller.api, { title: `Anúncio plano ${i} (E2E ${stamp})` })).id)
    }
    const draft = await apiCreateListing(seller.api, { title: `Rascunho extra (E2E ${stamp})`, saveAsDraft: true })
    sellerListings.push(draft.id)

    await gotoReady(seller.page, '/painel/listings')
    await expect(seller.page.locator('.plan-usage-line')).toContainText('5 de 5 anúncios ativos no plano Semente')
    await row(seller.page, `Rascunho extra (E2E ${stamp})`).getByRole('button', { name: 'Enviar p/ aprovação' }).click()

    const dialog = seller.page.getByRole('dialog', { name: 'Limite do plano Semente' })
    await expect(dialog).toContainText('permite até 5 anúncios ativos')
    await expect(dialog.locator('.plan-limit-options li')).toHaveCount(2) // Raiz e Floresta
    // "Ver planos" abre outra aba: o que estava na tela não se perde.
    await expect(dialog.getByRole('link', { name: 'Ver planos' })).toHaveAttribute('target', '_blank')
    await dialog.getByRole('button', { name: 'Agora não' }).click()
    await expect(row(seller.page, `Rascunho extra (E2E ${stamp})`)).toContainText('Rascunho')
  })

  test('TC-PLN-04: no limite da equipe, gerar outro convite abre a janela de planos', async () => {
    await gotoReady(seller.page, '/painel/team')
    await seller.page.getByRole('button', { name: 'Gerar código de convite' }).click()
    await expect(seller.page.locator('.invite-code-box')).toBeVisible()
    await seller.page.getByRole('button', { name: 'Gerar código de convite' }).click()
    await expect(seller.page.getByRole('dialog', { name: 'Limite do plano Semente' })).toContainText('membros na equipe')
  })

  test('TC-PLN-05: o admin ativa o Raiz à mão e a empresa passa a ver o plano e o selo Parceiro', async () => {
    await gotoReady(admin.page, '/admin/users')
    await row(admin.page, seller.account.company).getByRole('button', { name: 'Detalhes' }).click()
    const details = admin.page.locator('.details-panel')
    await expect(details).toContainText('Plano atual')
    await pickOption(admin.page, details.getByRole('button', { name: 'Plano' }), 'Raiz')
    await details.getByRole('button', { name: 'Aplicar' }).click()
    await admin.page.locator('.confirm-dialog').getByRole('button', { name: 'Confirmar' }).click()
    await expect(details.locator('.verify-notice')).toContainText('Plano Raiz até')
    await details.getByRole('button', { name: 'Fechar' }).click()

    await gotoReady(seller.page, '/painel/plan')
    await expect(seller.page.locator('.plan-summary-name')).toHaveText('Raiz')
    await expect(seller.page.locator('.plan-summary-source')).toContainText('Assinatura do Raiz válida até')
    await expect(seller.page.locator('.plan-summary .partner-badge')).toBeVisible()
    await expect(seller.page.locator('.usage-meter', { hasText: 'Anúncios ativos' })).toContainText('5 de 20')
  })

  test('TC-PLN-06: moderação prioritária — o anúncio do parceiro vem antes na fila, mesmo sendo mais antigo', async () => {
    const otherTitle = `Anúncio grátis mais novo (E2E ${stamp})`
    await apiCreateListing(other.api, { title: otherTitle })

    await gotoReady(admin.page, '/admin/moderation')
    // allInnerTexts não espera: só lê a ordem depois que as duas linhas chegaram.
    await expect(row(admin.page, otherTitle)).toBeVisible()
    await expect(row(admin.page, `Anúncio plano 5 (E2E ${stamp})`)).toBeVisible()
    const titles = await admin.page.locator('.admin-table tbody tr td:first-child').allInnerTexts()
    const partnerIdx = titles.findIndex((t) => t.includes(`Anúncio plano 5 (E2E ${stamp})`))
    const freeIdx = titles.findIndex((t) => t.includes(otherTitle))
    expect(partnerIdx).toBeGreaterThanOrEqual(0)
    expect(freeIdx).toBeGreaterThan(partnerIdx)
    await expect(row(admin.page, `Anúncio plano 5 (E2E ${stamp})`).locator('.partner-badge')).toBeVisible()
  })

  test('TC-PLN-07: o comprador vê o selo Parceiro no anúncio publicado', async ({ page }) => {
    for (const id of sellerListings.slice(0, 5)) await apiApproveListing(admin.api, id)
    await gotoReady(page, `/products/${sellerListings[0]}`)
    await expect(page.locator('.seller-panel .partner-badge')).toBeVisible()
  })

  test('TC-PLN-08: promoção de teste grátis para uma empresa escolhida — ela vê o teste e pode assinar o plano', async () => {
    await gotoReady(admin.page, '/admin/promotions')
    await admin.page.getByRole('button', { name: 'Nova promoção' }).click()
    const form = admin.page.locator('.promotion-form')
    await form.locator('#promo-name').fill(promoName)
    await form.locator('#promo-company-filter').fill(other.account.company)
    await form.locator('.company-picker label', { hasText: other.account.company }).locator('input').check()
    await form.getByRole('button', { name: 'Criar promoção' }).click()
    await expect(admin.page.locator('.verify-notice')).toContainText(`"${promoName}" começou.`)
    await expect(row(admin.page, promoName)).toContainText('30 dias de Floresta grátis')

    await gotoReady(other.page, '/painel/plan')
    await expect(other.page.locator('.plan-summary-name')).toHaveText('Floresta')
    await expect(other.page.locator('.plan-summary-source')).toContainText(`Teste grátis do Floresta até`)
    await expect(other.page.locator('.plan-summary-source')).toContainText(promoName)

    await gotoReady(other.page, '/planos')
    const floresta = other.page.locator('.plan-card', { hasText: 'Floresta' })
    await expect(floresta.locator('.plan-card-ribbon')).toHaveText('Em teste grátis')
    await expect(floresta.getByRole('link', { name: 'Quero o Floresta' })).toBeVisible()
  })

  test('TC-PLN-09: encerrar e revogar a promoção devolve a empresa ao Semente', async () => {
    await gotoReady(admin.page, '/admin/promotions')
    await row(admin.page, promoName).getByRole('button', { name: 'Ver empresas' }).click()
    const detail = admin.page.locator('.details-panel')
    await expect(detail).toContainText('Empresas com o benefício (1)')
    await detail.getByRole('button', { name: 'Encerrar e revogar' }).click()
    await admin.page.locator('.confirm-dialog').getByRole('button', { name: 'Encerrar e revogar' }).click()
    await expect(detail).toContainText('revogado em')
    await expect(detail).toContainText('Encerrada')

    await gotoReady(other.page, '/painel/plan')
    await expect(other.page.locator('.plan-summary-name')).toHaveText('Semente')
  })

  test('TC-PLN-10: ao voltar para o Semente, o anúncio publicado mais recente é pausado e o resto continua', async () => {
    // 6 publicados no Raiz: o rascunho extra agora cabe e é aprovado.
    expect((await seller.api.post(`${API_URL}/listings/${sellerListings[5]}/submit`)).status()).toBe(200)
    await apiApproveListing(admin.api, sellerListings[5])

    await gotoReady(admin.page, '/admin/users')
    await row(admin.page, seller.account.company).getByRole('button', { name: 'Detalhes' }).click()
    const details = admin.page.locator('.details-panel')
    await pickOption(admin.page, details.getByRole('button', { name: 'Plano' }), 'Semente')
    await details.getByRole('button', { name: 'Voltar ao Semente' }).click()
    await admin.page.locator('.confirm-dialog').getByRole('button', { name: 'Confirmar' }).click()
    await expect(details.locator('.verify-notice')).toContainText('A empresa voltou ao Semente.')

    await gotoReady(seller.page, '/painel/listings')
    // "Mais recente" é pela data do anúncio (postedAt = criação): o extra, criado por
    // último, sai; os 5 primeiros ficam.
    await expect(row(seller.page, `Rascunho extra (E2E ${stamp})`)).toContainText('Pausado')
    for (let i = 1; i <= 5; i++) await expect(row(seller.page, `Anúncio plano ${i} (E2E ${stamp})`)).toContainText('Publicado')
    await expect(seller.page.locator('.plan-usage-line')).toContainText('5 de 5 anúncios ativos no plano Semente')

    // A rotina registra a queda como "Sistema" na auditoria.
    await gotoReady(admin.page, '/admin/audit')
    await expect(row(admin.page, 'Plano rebaixado').first()).toContainText('Sistema')
  })
})

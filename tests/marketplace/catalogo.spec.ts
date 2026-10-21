import type { Page } from '@playwright/test'
import { CATALOG_TOKEN, ensureCatalog, type CatalogListing } from '../support/catalog'
import { expect, gotoReady, pickOption, test } from '../support/fixtures'

// Marketplace (página inicial): busca, filtros, ordenação, paginação (10 por página, feita
// pela API) e navegação até o anúncio. Tudo em cima do catálogo de QA (support/catalog.ts),
// isolado pela busca do marcador; as contagens esperadas saem dos dados reais da API.
test.describe('Marketplace — catálogo', () => {
  let catalog: CatalogListing[]

  test.beforeAll(async ({ moderator }) => {
    catalog = await ensureCatalog(moderator)
  })

  const count = (page: Page) => page.locator('.results-count-text')
  const cards = (page: Page) => page.locator('.listing-card')
  const paginatorCount = (page: Page) => page.locator('.table-paginator .paginator-count')

  async function searchCatalog(page: Page) {
    await gotoReady(page, '/')
    await page.locator('.search-input').fill(CATALOG_TOKEN)
    await expect(count(page)).toHaveText(`${catalog.length} anúncios encontrados`)
  }

  test('TC-CAT-01: pagina o catálogo de 10 em 10 e navega por primeira, anterior, próxima e última', async ({ page }) => {
    await searchCatalog(page)
    const n = catalog.length
    const lastStart = Math.floor((n - 1) / 10) * 10

    await expect(cards(page)).toHaveCount(10)
    await expect(paginatorCount(page)).toHaveText(`1–10 de ${n}`)
    await expect(page.getByRole('button', { name: 'Primeira página' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    const firstPageTitles = await page.locator('.listing-card-title').allInnerTexts()

    await page.getByRole('button', { name: 'Próxima página' }).click()
    await expect(paginatorCount(page)).toHaveText(`11–${Math.min(20, n)} de ${n}`)
    await expect(cards(page)).toHaveCount(Math.min(10, n - 10))
    const secondPageTitles = await page.locator('.listing-card-title').allInnerTexts()
    expect(secondPageTitles.filter((t) => firstPageTitles.includes(t))).toEqual([]) // nada repetido

    await page.getByRole('button', { name: 'Última página' }).click()
    await expect(paginatorCount(page)).toHaveText(`${lastStart + 1}–${n} de ${n}`)
    await expect(cards(page)).toHaveCount(n - lastStart)
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Última página' })).toBeDisabled()

    await page.getByRole('button', { name: 'Página anterior' }).click()
    await expect(paginatorCount(page)).toHaveText(`${lastStart - 9}–${lastStart} de ${n}`)

    await page.getByRole('button', { name: 'Primeira página' }).click()
    await expect(paginatorCount(page)).toHaveText(`1–10 de ${n}`)
    await expect(page.locator('.listing-card-title')).toHaveText(firstPageTitles)
  })

  test('TC-CAT-02: busca sem resultado mostra o estado vazio, e "limpar todos" volta ao catálogo', async ({ page }) => {
    await gotoReady(page, '/')
    const total = await count(page).innerText()
    await page.locator('.search-input').fill(`${CATALOG_TOKEN}-nada-com-isso`)
    await expect(page.getByRole('heading', { name: 'Nenhum anúncio encontrado' })).toBeVisible()
    await expect(count(page)).toHaveText('0 anúncios encontrados')
    await page.getByRole('button', { name: 'limpar todos' }).click()
    await expect(count(page)).toHaveText(total)
  })

  test('TC-CAT-03: filtro por tipo de plástico mostra só aquele tipo e volta para a 1ª página', async ({ page }) => {
    await searchCatalog(page)
    await page.getByRole('button', { name: 'Próxima página' }).click()
    await expect(paginatorCount(page)).toContainText('11–')

    const expected = catalog.filter((l) => l.plasticType === 'PEAD').length
    await page.locator('.filter-chip', { hasText: /^PEAD$/ }).click()
    await expect(count(page)).toHaveText(`${expected} anúncio${expected !== 1 ? 's' : ''} encontrado${expected !== 1 ? 's' : ''}`)
    await expect(page.locator('.listing-type-badge')).toHaveText(Array(expected).fill('PEAD'))
    await expect(page.locator('.active-filter-chip', { hasText: 'PEAD' })).toBeVisible()

    // Tirar o filtro pelo chip devolve o catálogo inteiro.
    await page.locator('.active-filter-chip', { hasText: 'PEAD' }).click()
    await expect(count(page)).toHaveText(`${catalog.length} anúncios encontrados`)
  })

  test('TC-CAT-04: filtro por condição mostra só aquela condição', async ({ page }) => {
    await searchCatalog(page)
    const expected = catalog.filter((l) => l.condition === 'contaminado').length
    await page.locator('.condition-check', { hasText: 'Contaminado' }).locator('input').check()
    await expect(count(page)).toHaveText(`${expected} anúncios encontrados`)
    await expect(page.locator('.condition-tag')).toHaveCount(Math.min(10, expected))
    for (const tag of await page.locator('.condition-tag').all()) await expect(tag).toHaveClass(/condition-contaminado/)
  })

  test('TC-CAT-05: quantidade mínima esconde os anúncios com menos kg', async ({ page }) => {
    await searchCatalog(page)
    const sorted = catalog.map((l) => l.quantityKg).sort((a, b) => a - b)
    const threshold = sorted[Math.floor(sorted.length / 2)]
    const expected = catalog.filter((l) => l.quantityKg >= threshold).length
    await page.locator('.filter-number-input').fill(String(threshold))
    await expect(count(page)).toHaveText(`${expected} anúncios encontrados`)
    await expect(page.locator('.active-filter-chip', { hasText: `mín. ${threshold} kg` })).toBeVisible()
  })

  test('TC-CAT-06: ordenar por maior quantidade traz o maior lote primeiro, em ordem decrescente', async ({ page }) => {
    await searchCatalog(page)
    await pickOption(page, page.getByRole('button', { name: 'Ordenar anúncios' }), 'Maior quantidade')
    const top = [...catalog].sort((a, b) => b.quantityKg - a.quantityKg).slice(0, 10)
    await expect(page.locator('.listing-card-title')).toHaveText(top.map((l) => l.title))
    const kgs = (await page.locator('.listing-qty').allInnerTexts()).map((t) => Number(t.replace(/\D/g, '')))
    expect(kgs).toEqual([...kgs].sort((a, b) => b - a))
  })

  test('TC-CAT-07: alterna entre grade e lista', async ({ page }) => {
    await searchCatalog(page)
    await page.getByRole('button', { name: 'Visualização em lista' }).click()
    await expect(page.locator('.listings-grid')).toHaveClass(/listings-grid-list/)
    await page.getByRole('button', { name: 'Visualização em grade' }).click()
    await expect(page.locator('.listings-grid')).not.toHaveClass(/listings-grid-list/)
  })

  test('TC-CAT-08: aba Vendedores lista a empresa do catálogo com o selo Parceiro', async ({ page }) => {
    await gotoReady(page, '/')
    await page.locator('.tab-btn', { hasText: 'Vendedores' }).click()
    const card = page.locator('.seller-card', { hasText: 'Catálogo QA' }).first()
    await expect(card).toBeVisible()
    await expect(card.locator('.partner-badge')).toBeVisible()
  })

  test('TC-CAT-09: clicar no card abre a página do anúncio', async ({ page }) => {
    await searchCatalog(page)
    const first = page.locator('.listing-card').first()
    const title = await first.locator('.listing-card-title').innerText()
    await first.locator('.listing-card-link').click()
    await expect(page).toHaveURL(/\/products\/\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.locator('.seller-panel')).toContainText('Catálogo QA')
  })
})

import type { Page } from '@playwright/test'
import { API_URL } from '../support/env'
import { ensureCatalog } from '../support/catalog'
import { adminLogin, expect, gotoReady, pickOption, test } from '../support/fixtures'

// Paginação das tabelas do /admin (feita no navegador, 25 ou 50 por página) e da
// auditoria (páginas de 100 eventos pela API, "Carregar eventos mais antigos").
// O catálogo de QA garante mais de 25 anúncios publicados para a moderação.
test.describe.serial('Admin — paginação das tabelas', () => {
  let admin: Awaited<ReturnType<typeof adminLogin>>

  test.beforeAll(async ({ browser, baseURL, moderator }) => {
    await ensureCatalog(moderator)
    admin = await adminLogin(browser, baseURL!)
  })

  test.afterAll(async () => {
    await admin?.cleanup()
  })

  const paginator = (page: Page) => page.locator('.table-paginator').first()
  const range = (page: Page) => paginator(page).locator('.paginator-count')

  // "1–25 de 37" → { from, to, total }
  async function readRange(page: Page) {
    const [, from, to, total] = (await range(page).innerText()).match(/(\d+)–(\d+) de (\d+)/)!.map(Number)
    return { from, to, total }
  }

  test('TC-ADM-01: moderação pagina os anúncios publicados (25 por página) e troca para 50', async () => {
    const page = admin.page
    await gotoReady(page, '/admin/moderation')
    await pickOption(page, page.getByRole('button', { name: 'Status' }), 'Publicado')
    await expect(range(page)).toContainText('1–25 de ')
    const { total } = await readRange(page)
    expect(total).toBeGreaterThan(25)
    await expect(page.locator('.admin-table tbody tr')).toHaveCount(25)

    await paginator(page).getByRole('button', { name: 'Próxima página' }).click()
    await expect(range(page)).toHaveText(`26–${Math.min(50, total)} de ${total}`)
    await expect(page.locator('.admin-table tbody tr')).toHaveCount(Math.min(25, total - 25))
    await paginator(page).getByRole('button', { name: 'Primeira página' }).click()
    await expect(range(page)).toHaveText(`1–25 de ${total}`)

    await pickOption(page, paginator(page).getByRole('button', { name: 'Itens por página' }), '50')
    await expect(range(page)).toHaveText(`1–${Math.min(50, total)} de ${total}`)
    await expect(page.locator('.admin-table tbody tr')).toHaveCount(Math.min(50, total))
  })

  test('TC-ADM-02: auditoria pagina os eventos e filtra por tipo', async () => {
    const page = admin.page
    await gotoReady(page, '/admin/audit')
    await expect(range(page)).toContainText(' de ')
    const { total } = await readRange(page)
    test.skip(total <= 25, `só ${total} eventos de auditoria — a paginação precisa de mais de 25`)
    await paginator(page).getByRole('button', { name: 'Última página' }).click()
    const last = await readRange(page)
    expect(last.to).toBe(total)
    expect(last.from).toBe(Math.floor((total - 1) / 25) * 25 + 1)

    // "Logins e cadastros" só mostra essas duas ações.
    await pickOption(page, page.getByRole('button', { name: 'Tipo de evento' }), 'Logins e cadastros')
    // O filtro vai ao servidor: as linhas antigas ficam na tela até a resposta chegar.
    const actions = page.locator('.admin-table tbody tr td:nth-child(3)')
    await expect(actions.filter({ hasNotText: /^(Login realizado|Cadastro realizado)$/ })).toHaveCount(0)
    await expect(actions.first()).toBeVisible()
  })

  test('TC-ADM-03: auditoria busca os eventos mais antigos além dos 100 primeiros', async () => {
    const page = admin.page
    const firstPage = await (await admin.api.get(`${API_URL}/admin/audit?limit=100`)).json()
    test.skip(!firstPage.nextCursor, 'ainda não há mais de 100 eventos de auditoria no ambiente')

    await gotoReady(page, '/admin/audit')
    await expect(range(page)).toContainText(' de 100')
    await page.getByRole('button', { name: 'Carregar eventos mais antigos' }).click()
    await expect(range(page)).not.toContainText(' de 100')
    const { total } = await readRange(page)
    expect(total).toBeGreaterThan(100)
  })

  test('TC-ADM-04: usuários paginam quando passam de 25', async () => {
    const page = admin.page
    const users = (await (await admin.api.get(`${API_URL}/admin/users`)).json()).users.length
    test.skip(users <= 25, `só ${users} usuários no ambiente — a paginação precisa de mais de 25`)

    await gotoReady(page, '/admin/users')
    await expect(range(page)).toHaveText(`1–25 de ${users}`)
    await paginator(page).getByRole('button', { name: 'Próxima página' }).click()
    await expect(range(page)).toHaveText(`26–${Math.min(50, users)} de ${users}`)
  })
})

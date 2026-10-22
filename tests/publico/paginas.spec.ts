import { expect, gotoReady, test } from '../support/fixtures'

// Páginas públicas: cada uma abre com o título certo e sem erro de JavaScript. O 401 do
// /auth/me de quem não está logado é esperado e não conta como erro.
const PAGES: Array<[string, string | RegExp]> = [
  ['/sobre', 'Sobre o Projeto'],
  ['/solucoes', 'Soluções'],
  ['/materiais', 'Materiais'],
  ['/blog', 'Blog'],
  ['/contato', 'Contato'],
  ['/privacidade', 'Na Amazônia Circular, nós respeitamos a sua privacidade.'],
  ['/planos', 'Planos'],
]

test.describe('Páginas públicas', () => {
  for (const [path, heading] of PAGES) {
    test(`TC-PUBL-01 ${path}: abre com o título e sem erro de JavaScript`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error' && !m.text().includes('401')) errors.push(m.text())
      })
      await gotoReady(page, path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
      expect(errors).toEqual([])
    })
  }

  test('TC-PUBL-02: rota que não existe mostra "Página não encontrada"', async ({ page }) => {
    await gotoReady(page, '/rota-que-nao-existe-e2e')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('TC-PUBL-03: o menu do topo leva a cada página', async ({ page }) => {
    await gotoReady(page, '/')
    for (const [label, path] of [['Sobre nós', '/sobre'], ['Contato', '/contato']] as const) {
      await page.locator('header').getByRole('link', { name: label, exact: true }).click()
      await expect(page).toHaveURL((url) => url.pathname === path)
    }
    // Planos saiu do menu por enquanto: a página é aberta pelo botão da página inicial.
    await expect(page.locator('header').getByRole('link', { name: 'Planos', exact: true })).toHaveCount(0)
    await gotoReady(page, '/')
    await page.getByRole('link', { name: 'Conheça nossos planos' }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/planos')
  })

  test('TC-PUBL-04: o contato oferece o e-mail da equipe', async ({ page }) => {
    await gotoReady(page, '/contato')
    await expect(page.locator('.contato-email')).toHaveAttribute('href', /^mailto:contato@amazoniacircular\.com\.br/)
  })
})

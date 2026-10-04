import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'
import {
  apiDeleteAccount,
  apiRegister,
  buildAccount,
  promoteToAdmin,
  type SessionState,
  type TestAccount,
} from './api'

// Um usuário com navegador próprio (BrowserContext isolado: cookies,
// storage e sessão separados). Usado nos fluxos com mais de um ator
// (vendedor + comprador, admin + alvo).
export interface Actor {
  account: TestAccount
  context: BrowserContext
  page: Page
  api: APIRequestContext
}

type TestFixtures = {
  // Overrides aplicados à conta da fixture `account` — ex.:
  //   test.use({ accountOverrides: { role: 'BUYER' } })
  accountOverrides: Partial<TestAccount>
  // Conta descartável registrada via API no contexto padrão: `page` já
  // começa autenticada. Apagada automaticamente no teardown.
  account: TestAccount
  // Cria atores extras, cada um em um BrowserContext próprio e já
  // autenticado. Todos são apagados no teardown.
  newActor: (overrides?: Partial<TestAccount>) => Promise<Actor>
}

type WorkerFixtures = {
  // Sessão de API de uma conta descartável promovida a ADMIN, compartilhada
  // pelo worker. Usada só para montar estado (ex.: aprovar anúncio sem passar
  // pela UI de moderação) — os testes de moderação em si usam a UI.
  moderator: APIRequestContext
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  accountOverrides: [{}, { option: true }],

  account: async ({ context, accountOverrides }, use) => {
    const account = buildAccount(accountOverrides)
    const session = await apiRegister(context.request, account)
    await use(account)
    await apiDeleteAccount(session)
  },

  newActor: async ({ browser }, use) => {
    const created: { actor: Actor; session: SessionState }[] = []
    await use(async (overrides = {}) => {
      const context = await browser.newContext()
      const account = buildAccount(overrides)
      const session = await apiRegister(context.request, account)
      const actor = { account, context, page: await context.newPage(), api: context.request }
      created.push({ actor, session })
      return actor
    })
    for (const { actor, session } of created) {
      await apiDeleteAccount(session)
      await actor.context.close()
    }
  },

  moderator: [
    async ({ playwright }, use) => {
      const api = await playwright.request.newContext()
      const account = buildAccount({ name: 'Moderador Teste E2E' })
      const session = await apiRegister(api, account)
      promoteToAdmin(account.email, account.password)
      await use(api)
      await apiDeleteAccount(session)
      await api.dispose()
    },
    { scope: 'worker' },
  ],
})

export { expect }

// O SSR de dev do TanStack Start às vezes sofre um hydration mismatch logo
// após o load (uma tag <style> difere entre servidor e cliente), o que faz o
// React descartar e remontar a árvore no cliente — qualquer campo preenchido
// durante essa janela curta é resetado silenciosamente. O app não expõe um
// marcador de "hidratado", então esperamos o load e uma pausa curta antes de
// interagir.
export async function gotoReady(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(800)
}

// Uma linha de tabela (<tr>) que contém o texto — equivalente ao
// cy.contains('tr', texto) usado nas telas de painel/admin.
export function row(page: Page, text: string) {
  return page.locator('tr').filter({ hasText: text })
}

// O app usa um dropdown próprio (components/Select.tsx: botão + listbox) no
// lugar do <select> nativo, então não dá para usar selectOption — abre o
// gatilho e clica na opção pelo rótulo.
export async function pickOption(page: Page, trigger: Locator, label: string): Promise<void> {
  await trigger.click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

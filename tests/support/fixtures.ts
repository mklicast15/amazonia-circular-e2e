import {
  test as base,
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'
import {
  apiDeleteAccount,
  apiRegister,
  buildAccount,
  clientIpHeaders,
  loginAsAdmin,
  totp,
  type SessionState,
  type TestAccount,
} from './api'
import { API_URL, E2E_ADMIN, SITE_HTTP_CREDENTIALS } from './env'

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
  // Sessão de API (com MFA) de uma conta descartável promovida a ADMIN, compartilhada
  // pelo worker. Usada só para montar estado (ex.: aprovar anúncio sem passar
  // pela UI de moderação) — os testes de moderação em si usam a UI.
  moderator: APIRequestContext
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // IP de cliente próprio por teste — ver clientIpHeaders em support/api.ts.
  extraHTTPHeaders: async ({}, use) => {
    await use(clientIpHeaders())
  },

  context: async ({ context, baseURL }, use) => {
    await acceptCookieConsent(context, baseURL!)
    await use(context)
  },

  accountOverrides: [{}, { option: true }],

  account: async ({ context, accountOverrides }, use) => {
    const account = buildAccount(accountOverrides)
    const session = await apiRegister(context.request, account)
    await use(account)
    await apiDeleteAccount(session)
  },

  newActor: async ({ browser, baseURL }, use) => {
    const created: { actor: Actor; session: SessionState }[] = []
    await use(async (overrides = {}) => {
      const context = await browser.newContext({ baseURL, httpCredentials: SITE_HTTP_CREDENTIALS, extraHTTPHeaders: clientIpHeaders() })
      await acceptCookieConsent(context, baseURL!)
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
      const api = await playwright.request.newContext({ extraHTTPHeaders: clientIpHeaders() })
      const account = buildAccount({ name: 'Moderador Teste E2E' })
      const session = await apiRegister(api, account)
      await loginAsAdmin(api, account)
      await use(api)
      await apiDeleteAccount(session)
      await api.dispose()
    },
    { scope: 'worker' },
  ],
})

export { expect }

// Sessão de admin (com MFA) num navegador próprio, para fluxos de UI do /admin.
// - Com E2E_ADMIN_EMAIL/PASSWORD/TOTP_SECRET (ex.: staging): entra com esse admin
//   existente — não precisa de acesso ao banco. A conta não é apagada no fim.
// - Sem eles (local): promove uma conta descartável pelo script do app (loginAsAdmin,
//   exige APP_DATABASE_URL) e a apaga no fim.
export async function adminLogin(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ baseURL, httpCredentials: SITE_HTTP_CREDENTIALS, extraHTTPHeaders: clientIpHeaders() })
  await acceptCookieConsent(context, baseURL)
  const api = context.request
  let cleanup = async () => { await context.close() }
  if (E2E_ADMIN) {
    const login = await api.post(`${API_URL}/auth/login`, { data: { email: E2E_ADMIN.email, password: E2E_ADMIN.password } })
    const body = await login.json()
    if (!body.mfaRequired) throw new Error(`login do admin E2E sem desafio MFA (${login.status()}): ${JSON.stringify(body)}`)
    const verify = await api.post(`${API_URL}/auth/mfa/verify`, { data: { mfaToken: body.mfaToken, code: totp(E2E_ADMIN.totpSecret) } })
    if (!verify.ok()) throw new Error(`código do MFA do admin E2E recusado (${verify.status()}): ${await verify.text()}`)
  } else {
    const account = buildAccount({ name: 'Admin Teste E2E' })
    const session = await apiRegister(api, account)
    await loginAsAdmin(api, account)
    cleanup = async () => {
      await apiDeleteAccount(session)
      await context.close()
    }
  }
  return { context, page: await context.newPage(), api, cleanup }
}

// O login fica desabilitado até o visitante responder o aviso de cookies
// (src/lib/cookieConsent.ts no app), guardado no cookie ac_cookie_consent.
// Todo contexto já começa com o aviso aceito; testes que limpam cookies
// precisam chamar de novo.
export async function acceptCookieConsent(context: BrowserContext, baseURL: string): Promise<void> {
  await context.addCookies([{ name: 'ac_cookie_consent', value: '1', url: baseURL }])
}

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

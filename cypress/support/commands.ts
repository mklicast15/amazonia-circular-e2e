/// <reference types="cypress" />

export interface TestAccount {
  email: string
  password: string
  name: string
  company: string
  cnpj: string
  phone: string
  location: string
  neighborhood: string
  // Not sent to the API unless explicitly overridden — registerSchema defaults to SELLER.
  role?: 'SELLER' | 'BUYER'
}

function randomDigits(len: number): string {
  let out = ''
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10)
  return out
}

// Registers a brand-new throwaway account directly against the API (not through
// the UI) and stores the resulting session cookie in the browser, so tests that
// aren't specifically about signup/login can start already authenticated.
// The backend's registerSchema only checks CNPJ length/format, not the real
// checksum, so a random 14-digit string is fine for tests.
Cypress.Commands.add('apiRegister', (overrides: Partial<TestAccount> = {}) => {
  const stamp = Date.now()
  const account: TestAccount = {
    email: `cy-${stamp}@example.com`,
    password: 'TesteSenha123',
    name: 'Ana Teste E2E',
    company: `Cypress E2E Materiais ${stamp}`,
    cnpj: randomDigits(14),
    phone: '92991234567',
    location: 'Manaus - AM',
    neighborhood: 'Centro',
    ...overrides,
  }
  return cy
    .request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/auth/register`,
      body: account,
    })
    .then(() => account)
})

// Deletes the account tied to whatever session cookie is currently set (LGPD
// self-delete endpoint). Cascades to the account's listings/proposals/team, so
// a single call cleans up everything a test created. Call this in an
// `afterEach` for every spec that registers a throwaway account.
Cypress.Commands.add('apiDeleteAccount', () => {
  cy.request({
    method: 'DELETE',
    url: `${Cypress.env('apiUrl')}/me/account`,
    failOnStatusCode: false,
  })
})

// Creates a listing directly via the API for the currently-authenticated
// session (used to set up state for specs that aren't about the creation
// wizard itself, e.g. the proposal/negotiation flow).
Cypress.Commands.add('apiCreateListing', (overrides: Record<string, unknown> = {}) => {
  const body = {
    title: 'Aparas de PEBD prensadas (Cypress)',
    plasticType: 'PEBD',
    condition: 'limpo',
    quantityKg: 5000,
    image: 'https://picsum.photos/seed/cypress/800/600',
    shortDescription: 'Material de teste gerado pela suíte Cypress.',
    description: 'Anúncio de teste criado via API pela automação Cypress.',
    saveAsDraft: false,
    ...overrides,
  }
  return cy
    .request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/listings`,
      body,
    })
    .then((res) => res.body.listing as { id: number })
})

// Test-only: flips a listing straight to "published" by running a small script
// against the database directly, bypassing admin moderation. The script
// (server/src/scripts/testApproveListing.ts) lives in the app repo, not here —
// see cypress.config.ts's `appServerPath` env var. Used only so the E2E suite
// can reach the negotiation flow without needing real admin credentials.
Cypress.Commands.add('approveListingForTest', (id: number) => {
  const appServerPath = Cypress.env('appServerPath') as string
  cy.exec(`cd ${appServerPath} && npx tsx src/scripts/testApproveListing.ts ${id}`)
})

// Test-only: promotes an already-registered disposable account to ADMIN by
// running the app repo's own admin-provisioning script (server/src/scripts/
// createAdmin.ts) against it. The script upserts by email — since the account
// already exists, it only flips role/status, leaving the password (and so the
// existing session cookie's account) intact. The account is still deletable
// afterwards via DELETE /me/account regardless of role.
Cypress.Commands.add('promoteToAdmin', (email: string, password: string) => {
  const appServerPath = Cypress.env('appServerPath') as string
  cy.exec(`cd ${appServerPath} && npx tsx src/scripts/createAdmin.ts ${email} ${password}`)
})

// TanStack Start's dev SSR sometimes hits a hydration mismatch right after
// load, which makes React discard and remount the tree client-side — any
// input typed during that short window gets silently reset once the remount
// lands. Visiting and pausing briefly before interacting dodges that window.
Cypress.Commands.add('visitReady', (url: string) => {
  cy.visit(url)
  cy.wait(800)
})

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      apiRegister(overrides?: Partial<TestAccount>): Chainable<TestAccount>
      apiDeleteAccount(): Chainable<Cypress.Response<unknown>>
      apiCreateListing(overrides?: Record<string, unknown>): Chainable<{ id: number }>
      approveListingForTest(id: number): Chainable<null>
      promoteToAdmin(email: string, password: string): Chainable<null>
      visitReady(url: string): Chainable<null>
    }
  }
}

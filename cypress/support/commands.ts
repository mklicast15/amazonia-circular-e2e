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
  // Não é enviado à API a menos que seja explicitamente sobrescrito — registerSchema usa SELLER por padrão.
  role?: 'SELLER' | 'BUYER'
}

function randomDigits(len: number): string {
  let out = ''
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10)
  return out
}

// Registra uma conta descartável direto na API (não pela UI) e guarda o
// cookie de sessão resultante no navegador, para testes que não são
// especificamente sobre cadastro/login já começarem autenticados.
// O registerSchema do backend só valida formato/tamanho do CNPJ, não o
// dígito verificador real, então uma string aleatória de 14 dígitos serve.
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

// Apaga a conta ligada ao cookie de sessão atual (endpoint de autoexclusão
// LGPD). Apaga em cascata anúncios/propostas/equipe da conta, então uma
// única chamada limpa tudo que um teste criou. Chamar num `afterEach` em
// todo spec que registra uma conta descartável.
Cypress.Commands.add('apiDeleteAccount', () => {
  cy.request({
    method: 'DELETE',
    url: `${Cypress.env('apiUrl')}/me/account`,
    failOnStatusCode: false,
  })
})

// Cria um anúncio direto pela API na sessão autenticada atual (usado para
// montar o estado em specs que não são sobre o wizard de criação em si,
// ex.: o fluxo de proposta/negociação).
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

// Só para teste: vira um anúncio direto para "publicado" rodando um script
// pequeno contra o banco, pulando a moderação do admin. O script
// (server/src/scripts/testApproveListing.ts) vive no repo do app, não aqui —
// ver a env var `appServerPath` no cypress.config.ts. Usado só para a suíte
// E2E alcançar o fluxo de negociação sem precisar de credenciais de admin reais.
Cypress.Commands.add('approveListingForTest', (id: number) => {
  const appServerPath = Cypress.env('appServerPath') as string
  cy.exec(`cd ${appServerPath} && npx tsx src/scripts/testApproveListing.ts ${id}`)
})

// Só para teste: promove a ADMIN uma conta descartável já registrada,
// rodando o próprio script de provisionamento de admin do repo do app
// (server/src/scripts/createAdmin.ts). O script faz upsert por e-mail —
// como a conta já existe, ele só troca papel/status, mantendo a senha (e
// portanto a conta do cookie de sessão atual) intacta. A conta continua
// deletável depois via DELETE /me/account independente do papel.
Cypress.Commands.add('promoteToAdmin', (email: string, password: string) => {
  const appServerPath = Cypress.env('appServerPath') as string
  cy.exec(`cd ${appServerPath} && npx tsx src/scripts/createAdmin.ts ${email} ${password}`)
})

// O SSR de dev do TanStack Start às vezes sofre um hydration mismatch logo
// após o load, o que faz o React descartar e remontar a árvore no cliente —
// qualquer campo digitado durante essa janela curta é silenciosamente
// resetado quando o remount acontece. Visitar e pausar brevemente antes de
// interagir evita essa janela.
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

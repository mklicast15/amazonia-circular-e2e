import type { TestAccount } from '../../support/commands'

function attemptLogin(email: string, password: string) {
  cy.get('#login-email').clear().type(email)
  cy.get('#login-password').clear().type(password)
  cy.contains('button', 'Entrar').click()
}

describe('Login', () => {
  let account: TestAccount
  let savedCookies: Cypress.Cookie[] = []

  beforeEach(() => {
    cy.apiRegister().then((acc) => {
      account = acc
    })
    // apiRegister leaves the browser authenticated (register() sets the session
    // cookie). Save it and clear the jar so each test exercises the real login
    // form starting logged out; cleanup below restores it regardless of what
    // the test itself did to the session (e.g. locking the account out).
    cy.getCookies().then((cookies) => {
      savedCookies = cookies
    })
    cy.clearCookies()
  })

  afterEach(() => {
    cy.clearCookies()
    savedCookies.forEach((c) => {
      cy.setCookie(c.name, c.value, { domain: c.domain, path: c.path })
    })
    cy.apiDeleteAccount()
  })

  it('TC-LOG-01: autentica com credenciais corretas e leva ao marketplace', () => {
    cy.visitReady('/login')
    attemptLogin(account.email, account.password)

    cy.location('pathname').should('eq', '/')
    cy.get('.user-menu-trigger-name').should('contain.text', account.name)
  })

  it('TC-LOG-02: mostra erro e permanece na tela com senha incorreta', () => {
    cy.visitReady('/login')
    attemptLogin(account.email, 'SenhaErrada999')

    cy.contains('.form-error', 'E-mail ou senha incorretos').should('be.visible')
    cy.location('pathname').should('eq', '/login')
  })

  it('TC-LOG-03: bloqueia a conta após 5 tentativas de senha errada', () => {
    cy.visitReady('/login')
    // Attempts 1-5: normal "wrong password" — the 5th is the one that flips the lock.
    for (let i = 0; i < 5; i++) {
      attemptLogin(account.email, 'SenhaErrada999')
      cy.contains('.form-error', 'E-mail ou senha incorretos').should('be.visible')
    }
    // 6th attempt (even with the correct password) hits the lock, not a password check.
    attemptLogin(account.email, account.password)
    cy.contains('.form-error', 'Muitas tentativas de login').should('be.visible')
  })

  it('TC-LOG-04: bloqueia o envio com campos vazios', () => {
    cy.visitReady('/login')
    cy.contains('button', 'Entrar').click()

    cy.location('pathname').should('eq', '/login')
    cy.get('.user-menu-trigger-name').should('not.exist')
  })
})

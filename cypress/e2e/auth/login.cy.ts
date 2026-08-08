import type { TestAccount } from '../../support/commands'

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
    cy.get('#login-email').type(account.email)
    cy.get('#login-password').type(account.password)
    cy.contains('button', 'Entrar').click()

    cy.location('pathname').should('eq', '/')
    cy.get('.user-menu-trigger-name').should('contain.text', account.name)
  })

  it('TC-LOG-02: mostra erro e permanece na tela com senha incorreta', () => {
    cy.visitReady('/login')
    cy.get('#login-email').type(account.email)
    cy.get('#login-password').type('SenhaErrada999')
    cy.contains('button', 'Entrar').click()

    cy.contains('.form-error', 'E-mail ou senha incorretos').should('be.visible')
    cy.location('pathname').should('eq', '/login')
  })

  it('TC-LOG-03: bloqueia a conta após 5 tentativas de senha errada', () => {
    cy.visitReady('/login')
    // Attempts 1-5: normal "wrong password" — the 5th is the one that flips the lock.
    for (let i = 0; i < 5; i++) {
      cy.get('#login-email').clear().type(account.email)
      cy.get('#login-password').clear().type('SenhaErrada999')
      cy.contains('button', 'Entrar').click()
      cy.contains('.form-error', 'E-mail ou senha incorretos').should('be.visible')
    }
    // 6th attempt (even with the correct password) hits the lock, not a password check.
    cy.get('#login-email').clear().type(account.email)
    cy.get('#login-password').clear().type(account.password)
    cy.contains('button', 'Entrar').click()
    cy.contains('.form-error', 'Muitas tentativas de login').should('be.visible')
  })
})

import type { TestAccount } from '../../support/commands'

describe('Conta e perfil', () => {
  let account: TestAccount
  // Only set when a test itself logs the session out (TC-PERF-03) — cleanup
  // needs a cookie to call DELETE /me/account with, since logout clears it.
  let savedCookies: Cypress.Cookie[] = []

  beforeEach(() => {
    savedCookies = []
    cy.apiRegister().then((acc) => {
      account = acc
    })
  })

  afterEach(() => {
    if (savedCookies.length) {
      cy.clearCookies()
      savedCookies.forEach((c) => {
        cy.setCookie(c.name, c.value, { domain: c.domain, path: c.path })
      })
    }
    cy.apiDeleteAccount()
  })

  it('TC-PERF-01: edita os dados do perfil com sucesso', () => {
    cy.visitReady('/')
    cy.get('.user-menu-trigger').click()
    cy.contains('.user-menu-dropdown-item', 'Editar perfil').click()
    cy.contains('button', 'Editar informações').click()

    // #um-name strips anything that isn't a letter/space/'/- (onlyLetters), so
    // the "E2E" tag used elsewhere in test data can't survive here — "Beatriz
    // Teste" is still clearly synthetic in context (disposable cy- account).
    cy.get('#um-name').clear().type('Beatriz Teste')
    cy.get('#um-phone').clear().type('(92) 90000-1111')
    cy.get('#um-bairro').clear().type('Compensa')
    cy.contains('button', 'Salvar').click()

    cy.contains('.user-info-value', 'Beatriz Teste').should('be.visible')
    cy.get('.user-menu-trigger-name').should('contain.text', 'Beatriz Teste')
  })

  it('TC-PERF-02: bloqueia salvar o perfil com telefone vazio', () => {
    cy.visitReady('/')
    cy.get('.user-menu-trigger').click()
    cy.contains('.user-menu-dropdown-item', 'Editar perfil').click()
    cy.contains('button', 'Editar informações').click()

    cy.get('#um-phone').clear()
    cy.contains('button', 'Salvar').click()

    cy.contains('.form-error', 'Informe o telefone.').should('be.visible')
    cy.get('#um-phone').should('be.visible')
  })

  it('TC-PERF-03: encerra a sessão ao clicar em Sair', () => {
    cy.getCookies().then((cookies) => {
      savedCookies = cookies
    })
    cy.visitReady('/')
    cy.get('.user-menu-trigger').click()
    cy.contains('.user-menu-dropdown-item', 'Sair').click()

    cy.get('.user-menu-trigger').should('not.exist')
    cy.visitReady('/painel')
    cy.contains('Faça login para acessar seu painel.').should('be.visible')
  })

  it('TC-PERF-04: exclui a própria conta pela área de privacidade (LGPD)', () => {
    cy.visitReady('/painel')
    cy.contains('button', 'Excluir minha conta').click()

    cy.get('.confirm-dialog').should('contain.text', 'Excluir minha conta')
    cy.get('.confirm-dialog').contains('button', 'Excluir definitivamente').click()

    cy.location('pathname').should('eq', '/')
    cy.get('.user-menu-trigger').should('not.exist')
  })
})

import type { TestAccount } from '../../support/commands'

describe('Recuperação de senha', () => {
  describe('e-mail de uma conta existente', () => {
    let account: TestAccount

    beforeEach(() => {
      // apiRegister leaves the browser authenticated with this account's session
      // cookie; it stays valid for the whole test (visiting a public page doesn't
      // invalidate it), so afterEach can clean up with it as usual.
      cy.apiRegister().then((acc) => {
        account = acc
      })
    })

    afterEach(() => {
      cy.apiDeleteAccount()
    })

    it('TC-REC-01: solicitar o link mostra a mensagem genérica de confirmação', () => {
      cy.visitReady('/recuperar-senha')
      cy.get('#rec-email').type(account.email)
      cy.contains('button', 'Enviar link').click()

      cy.contains('Se existir uma conta com esse e-mail, enviamos um link').should('be.visible')
      cy.contains('a', 'Voltar ao login').should('be.visible')
    })
  })

  it('TC-REC-02: bloqueia o envio sem informar e-mail', () => {
    cy.visitReady('/recuperar-senha')
    cy.contains('button', 'Enviar link').click()

    cy.get('.field-error').should('be.visible')
    cy.contains('Se existir uma conta com esse e-mail').should('not.exist')
  })

  it('TC-RS-01: acessar a tela de redefinição sem token mostra link inválido', () => {
    cy.visitReady('/redefinir-senha')

    cy.contains('Link inválido. Solicite um novo link de redefinição.').should('be.visible')
    cy.get('#rs-password').should('not.exist')
  })
})

import type { TestAccount } from '../../support/commands'

describe('Painel — gestão de anúncios', () => {
  let account: TestAccount
  let listingId: number
  const title = `Fardos de PP para gestão (Cypress) ${Date.now()}`

  beforeEach(() => {
    cy.apiRegister().then((acc) => {
      account = acc
    })
    cy.apiCreateListing({ title }).then((listing) => {
      listingId = listing.id
      cy.approveListingForTest(listingId)
    })
  })

  afterEach(() => {
    cy.apiDeleteAccount()
  })

  it('TC-PAI-01: pausa e reativa um anúncio publicado', () => {
    cy.visitReady('/painel?tab=listings')

    cy.contains('tr', title).find('.status-pill').should('contain.text', 'Publicado')
    cy.contains('tr', title).contains('button', 'Pausar').click()
    cy.contains('tr', title).find('.status-pill').should('contain.text', 'Pausado')

    cy.contains('tr', title).contains('button', 'Reativar').click()
    cy.contains('tr', title).find('.status-pill').should('contain.text', 'Publicado')
  })

  it('TC-PAI-02: marca um anúncio como vendido', () => {
    cy.visitReady('/painel?tab=listings')
    cy.contains('tr', title).contains('button', 'Marcar vendido').click()

    cy.get('.confirm-dialog').should('contain.text', 'Marcar como vendido')
    cy.get('.confirm-dialog').contains('button', 'Marcar vendido').click()

    cy.contains('tr', title).find('.status-pill').should('contain.text', 'Vendido')
    cy.contains('tr', title).contains('button', 'Pausar').should('not.exist')
    cy.contains('tr', title).contains('button', 'Editar').should('not.exist')
  })

  it('TC-PAI-03: exclui um anúncio informando o motivo', () => {
    cy.visitReady('/painel?tab=listings')
    cy.contains('tr', title).contains('button', 'Excluir').click()

    // Confirming with a reason shorter than 3 chars is blocked client-side.
    cy.contains('tr', title).find('.admin-reject-input').type('a')
    cy.contains('tr', title).contains('button', 'Confirmar exclusão').click()
    cy.contains('tr', title).find('.field-error').should('be.visible')

    cy.contains('tr', title).find('.admin-reject-input').clear().type('Anúncio de teste, não é mais necessário.')
    cy.contains('tr', title).contains('button', 'Confirmar exclusão').click()

    cy.get('.confirm-dialog').should('contain.text', 'Excluir anúncio')
    cy.get('.confirm-dialog').contains('button', 'Excluir').click()

    cy.contains(title).should('not.exist')
  })
})

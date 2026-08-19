import type { TestAccount } from '../../support/commands'

describe('Enviar proposta / negociação', () => {
  let buyer: TestAccount
  let listingId: number
  let sellerCookies: Cypress.Cookie[] = []

  beforeEach(() => {
    // Vendedor: registra, cria um anúncio e aprova para teste (pulando a
    // moderação real). O cookie de sessão é salvo (não só descartado) para o
    // cleanup poder restaurá-lo depois sem um novo round-trip de /auth/login —
    // essa requisição extra já foi fonte ocasional de contas órfãs quando falhava.
    cy.apiRegister()
    cy.apiCreateListing({ title: 'Fardos de PEAD para negociação (Cypress)' }).then((listing) => {
      listingId = listing.id
      cy.approveListingForTest(listingId)
    })
    cy.getCookies().then((cookies) => {
      sellerCookies = cookies
    })
    cy.clearCookies()

    cy.apiRegister().then((acc) => {
      buyer = acc
    })
  })

  afterEach(() => {
    cy.apiDeleteAccount()
    cy.clearCookies()
    sellerCookies.forEach((c) => {
      cy.setCookie(c.name, c.value, { domain: c.domain, path: c.path })
    })
    cy.apiDeleteAccount()
  })

  it('TC-PROP-01: envia uma proposta para um anúncio publicado', () => {
    cy.visitReady(`/products/${listingId}`)
    cy.contains('button', 'Solicitar cotação / Negociar').click()

    cy.get('#contact-email').clear().type(buyer.email)
    cy.get('#contact-phone').type('92991234567')
    cy.get('#contact-quantity').type('2000')
    cy.get('#contact-message').type('Olá, tenho interesse neste lote. Podemos negociar quantidade e prazo de coleta?')
    cy.contains('button', 'Enviar proposta').click()

    cy.contains('h3', 'Proposta enviada!').should('be.visible')
  })

  it('TC-PROP-02: exige campos obrigatórios antes de enviar a proposta', () => {
    cy.visitReady(`/products/${listingId}`)
    cy.contains('button', 'Solicitar cotação / Negociar').click()

    cy.get('#contact-name').clear()
    cy.get('#contact-email').clear()
    cy.contains('button', 'Enviar proposta').click()

    cy.get('.field-error').should('have.length.greaterThan', 0)
    cy.contains('h3', 'Proposta enviada!').should('not.exist')
  })

  it('TC-PROP-03: exige login antes de permitir o envio de uma proposta', () => {
    cy.clearCookies()
    cy.visitReady(`/products/${listingId}`)
    cy.contains('button', 'Solicitar cotação / Negociar').click()

    cy.contains('Para enviar uma proposta você precisa estar logado').should('be.visible')
    cy.get('#contact-message').should('not.exist')
  })
})

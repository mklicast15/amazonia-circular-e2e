import type { TestAccount } from '../../support/commands'

describe('Painel — propostas recebidas', () => {
  let buyer: TestAccount
  let listingId: number
  let sellerCookies: Cypress.Cookie[] = []
  const listingTitle = `Fardos de PEAD para propostas (Cypress) ${Date.now()}`

  function asSeller() {
    cy.clearCookies()
    sellerCookies.forEach((c) => {
      cy.setCookie(c.name, c.value, { domain: c.domain, path: c.path })
    })
  }

  beforeEach(() => {
    // Vendedor: publica um anúncio e guarda o cookie à parte (ver proposta.cy.ts
    // para o motivo: restaurá-lo depois evita um round-trip extra de /auth/login no cleanup).
    cy.apiRegister()
    cy.apiCreateListing({ title: listingTitle, quantityKg: 3000 }).then((listing) => {
      listingId = listing.id
      cy.approveListingForTest(listingId)
    })
    cy.getCookies().then((cookies) => {
      sellerCookies = cookies
    })
    cy.clearCookies()

    // Comprador: conta separada que envia a proposta sobre a qual o vendedor vai agir.
    // O preenchimento do formulário precisa ficar dentro deste .then — `buyer`
    // (a variável externa) só é atribuída quando esse callback de fato roda,
    // depois que a fila de comandos executa; referenciar `buyer.email` direto
    // no corpo do beforeEach leria o valor antes dessa atribuição acontecer.
    cy.apiRegister().then((acc) => {
      buyer = acc
      cy.visitReady(`/products/${listingId}`)
      cy.contains('button', 'Solicitar cotação / Negociar').click()
      cy.get('#contact-email').clear().type(acc.email)
      cy.get('#contact-phone').type('92991234567')
      cy.get('#contact-quantity').type('1500')
      cy.get('#contact-message').type('Interesse no lote, aguardando retorno.')
      cy.contains('button', 'Enviar proposta').click()
      cy.contains('h3', 'Proposta enviada!').should('be.visible')
    })
  })

  afterEach(() => {
    cy.apiDeleteAccount()
    asSeller()
    cy.apiDeleteAccount()
  })

  it('TC-PROPR-01: atualiza o status de uma proposta recebida', () => {
    asSeller()
    cy.visitReady('/painel?tab=received')

    cy.contains('tr', buyer.name)
      .find('.admin-role-select')
      .should('have.value', 'new')
      .select('Lida')
    cy.contains('tr', buyer.name).find('.admin-role-select').should('have.value', 'read')
  })

  it('TC-PROPR-02: registra a venda a partir de uma proposta recebida', () => {
    asSeller()
    cy.visitReady('/painel?tab=received')

    cy.contains('tr', buyer.name).contains('button', 'Registrar venda').click()
    // O campo já vem preenchido com a quantidade total do anúncio (3000 kg) —
    // confirmar assim vende o lote inteiro e vira o anúncio para "Vendido".
    cy.contains('tr', buyer.name).find('input[placeholder="kg vendidos"]').should('have.value', '3000')
    cy.contains('tr', buyer.name).contains('button', 'Confirmar').click()

    cy.get('.confirm-dialog').should('contain.text', 'Registrar venda')
    cy.get('.confirm-dialog').contains('button', 'Registrar').click()

    cy.contains('tr', buyer.name).should('contain.text', 'Anúncio vendido')
    cy.contains('tr', listingTitle).find('.status-pill').should('contain.text', 'Vendido')
  })
})

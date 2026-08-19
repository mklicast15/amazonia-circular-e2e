import type { TestAccount } from '../../support/commands'

describe('Publicar anúncio (wizard completo)', () => {
  let account: TestAccount

  beforeEach(() => {
    cy.apiRegister().then((acc) => {
      account = acc
    })
  })

  afterEach(() => {
    cy.apiDeleteAccount()
  })

  it('TC-PUB-01: completa as 5 etapas do wizard e envia para aprovação', () => {
    cy.visitReady('/anuncie')

    cy.get('#w-titulo').type('Aparas de PET Transparente Pós-Industrial (Cypress)')
    cy.get('#w-tipo').select('PET')
    cy.get('#w-forma').select('Fardos prensados')
    cy.contains('.choice-chip', 'Limpo').click()
    cy.get('#w-resumo').type('Aparas limpas, geração constante, pronta para retirada.')
    cy.get('#w-desc').type('Material de teste gerado pela suíte Cypress para validar o wizard de publicação.')
    cy.get('#w-capa').selectFile('cypress/fixtures/cover.png', { force: true })
    cy.get('.image-upload-preview').should('be.visible')
    cy.contains('button', 'Próximo').click()

    cy.get('#w-qtd').type('5000')
    cy.contains('.choice-row button', 'Imediata').click()
    cy.contains('button', 'Próximo').click()

    // Etapa opcional: avança sem preencher nada.
    cy.contains('h2', 'Características do material').should('be.visible')
    cy.contains('button', 'Próximo').click()

    cy.get('#w-local').type('Distrito Industrial, Manaus - AM')
    cy.contains('button', 'Próximo').click()

    cy.contains('h2', 'Revisão').should('be.visible')
    cy.contains('button', 'Enviar para aprovação').click()

    cy.contains('h2', 'Anúncio enviado para análise!').should('be.visible')
    cy.contains('a', 'Ir para o painel').should('have.attr', 'href', '/painel')
  })

  it('TC-PUB-02: bloqueia o avanço da etapa 1 sem os campos obrigatórios', () => {
    cy.visitReady('/anuncie')
    cy.contains('button', 'Próximo').click()

    cy.get('.field-error').should('have.length.greaterThan', 0)
    cy.contains('h2', 'Sobre o material').should('be.visible')
  })

  it('TC-PUB-03: exige login para acessar o formulário de publicação', () => {
    cy.apiDeleteAccount()
    cy.clearCookies()
    cy.visitReady('/anuncie')

    // /anuncie é uma rota protegida: uma visita sem sessão é redirecionada
    // direto para /login (com aviso de sessão expirada), em vez de renderizar
    // o fallback "Entre para publicar" que o próprio wizard tem.
    cy.location('pathname').should('eq', '/login')
    cy.get('#w-titulo').should('not.exist')
  })
})

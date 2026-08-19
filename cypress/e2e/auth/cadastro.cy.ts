describe('Cadastro de empresa', () => {
  afterEach(() => {
    // Seguro tanto se o teste deu certo (cookie de sessão criado) quanto se
    // falhou na validação (nenhuma conta criada): DELETE numa sessão não
    // autenticada só retorna 401 (failOnStatusCode: false dentro do comando).
    cy.apiDeleteAccount()
  })

  it('TC-CAD-01: cria uma conta nova com dados válidos e autentica automaticamente', () => {
    const stamp = Date.now()
    const email = `cy-cad-${stamp}@example.com`

    cy.visitReady('/cadastro')
    cy.get('#c-empresa').type(`Cypress E2E Materiais ${stamp}`)
    cy.get('#c-cnpj').type('11222333000181')
    cy.get('#c-responsavel').type('Ana Teste E2E')
    cy.get('#c-email').type(email)
    cy.get('#c-telefone').type('92991234567')
    cy.get('#c-senha').type('TesteSenha123')
    cy.get('#c-endereco').type('Rua de Teste, 100')
    cy.get('#c-bairro').type('Distrito Industrial')
    cy.get('.consent-label input[type="checkbox"]').check({ force: true })
    cy.contains('button', 'Finalizar Cadastro').click()

    cy.contains('Cadastro realizado com sucesso!').should('be.visible')
  })

  it('TC-CAD-02: bloqueia o envio quando o CNPJ está incompleto', () => {
    cy.visitReady('/cadastro')
    cy.get('#c-empresa').type('Cypress E2E CNPJ Incompleto')
    cy.get('#c-cnpj').type('11222333') // menos de 14 dígitos
    cy.get('#c-responsavel').type('Ana Teste E2E')
    cy.get('#c-email').type(`cy-cnpj-${Date.now()}@example.com`)
    cy.get('#c-telefone').type('92991234567')
    cy.get('#c-senha').type('TesteSenha123')
    cy.get('#c-endereco').type('Rua de Teste, 100')
    cy.get('#c-bairro').type('Distrito Industrial')
    cy.get('.consent-label input[type="checkbox"]').check({ force: true })
    cy.contains('button', 'Finalizar Cadastro').click()

    cy.contains('.field-error', 'CNPJ incompleto').should('be.visible')
    cy.contains('Cadastro realizado com sucesso!').should('not.exist')
  })

  it('TC-CAD-03: bloqueia o envio sem aceitar a Política de Privacidade', () => {
    const stamp = Date.now()
    cy.visitReady('/cadastro')
    cy.get('#c-empresa').type(`Cypress E2E Sem Consentimento ${stamp}`)
    cy.get('#c-cnpj').type('99887766000155')
    cy.get('#c-responsavel').type('Ana Teste E2E')
    cy.get('#c-email').type(`cy-consent-${stamp}@example.com`)
    cy.get('#c-telefone').type('92991234567')
    cy.get('#c-senha').type('TesteSenha123')
    cy.get('#c-endereco').type('Rua de Teste, 100')
    cy.get('#c-bairro').type('Distrito Industrial')
    // Checkbox de consentimento propositalmente deixado desmarcado.
    cy.contains('button', 'Finalizar Cadastro').click()

    cy.contains('.field-error', 'Política de Privacidade').should('be.visible')
    cy.contains('Cadastro realizado com sucesso!').should('not.exist')
  })
})

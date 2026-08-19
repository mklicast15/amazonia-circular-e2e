import type { TestAccount } from '../../support/commands'

describe('Permissões por papel', () => {
  describe('Comprador (BUYER)', () => {
    let account: TestAccount

    beforeEach(() => {
      cy.apiRegister({ role: 'BUYER' }).then((acc) => {
        account = acc
      })
    })

    afterEach(() => {
      cy.apiDeleteAccount()
    })

    it('TC-PERM-01: compradores conseguem publicar anúncio (papéis não são segregados para isso)', () => {
      cy.visitReady('/anuncie')

      cy.get('#w-titulo').type('Fardos de PP — conta compradora (Cypress)')
      cy.get('#w-tipo').select('PET')
      cy.get('#w-forma').select('Fardos prensados')
      cy.contains('.choice-chip', 'Limpo').click()
      cy.get('#w-resumo').type('Anúncio de teste criado por uma conta com papel BUYER.')
      cy.get('#w-desc').type('Confere que o backend não restringe a criação de anúncios por papel.')
      cy.get('#w-capa').selectFile('cypress/fixtures/cover.png', { force: true })
      cy.contains('button', 'Próximo').click()

      cy.get('#w-qtd').type('1000')
      cy.contains('.choice-row button', 'Imediata').click()
      cy.contains('button', 'Próximo').click()
      cy.contains('button', 'Próximo').click() // Etapa 3 (Características, opcional)
      cy.contains('button', 'Próximo').click() // Etapa 4 (Local, opcional — endereço já vem do cadastro)

      cy.contains('button', 'Enviar para aprovação').click()
      cy.contains('h2', 'Anúncio enviado para análise!').should('be.visible')
    })

    it('TC-PERM-02: compradores são bloqueados na área administrativa', () => {
      cy.visitReady('/admin')

      cy.location('pathname').should('eq', '/')
      cy.contains('.toast-error', 'Você não tem acesso a esta área.').should('be.visible')
    })
  })

  describe('Vendedor (SELLER)', () => {
    beforeEach(() => {
      cy.apiRegister()
    })

    afterEach(() => {
      cy.apiDeleteAccount()
    })

    it('TC-PERM-03: vendedores também são bloqueados na área administrativa', () => {
      cy.visitReady('/admin')

      cy.location('pathname').should('eq', '/')
      cy.contains('.toast-error', 'Você não tem acesso a esta área.').should('be.visible')
    })
  })

  describe('Administrador (ADMIN)', () => {
    let account: TestAccount
    const listingTitle = `Fardos de PVC para moderação (Cypress) ${Date.now()}`

    beforeEach(() => {
      // Registra como SELLER normal (registerSchema não aceita ADMIN direto),
      // cria um anúncio pendente para moderar, e então promove a mesma conta via
      // o próprio script de provisionamento de admin do app — ver promoteToAdmin em commands.ts.
      cy.apiRegister().then((acc) => {
        account = acc
        cy.promoteToAdmin(acc.email, acc.password)
      })
      cy.apiCreateListing({ title: listingTitle })
    })

    afterEach(() => {
      cy.apiDeleteAccount()
    })

    it('TC-PERM-04: administradores acessam a área administrativa e veem a fila de moderação', () => {
      cy.visitReady('/admin')

      cy.location('pathname').should('eq', '/admin')
      cy.contains('.tab-btn', 'Moderação').should('have.class', 'active')
      cy.contains('tr', listingTitle).should('be.visible')
    })

    it('TC-PERM-05: administrador aprova um anúncio pendente', () => {
      cy.visitReady('/admin')
      cy.contains('tr', listingTitle).contains('button', 'Aprovar').click()

      // Aprovar tira o anúncio do filtro padrão "Em análise" (pendente).
      cy.contains('tr', listingTitle).should('not.exist')
    })

    it('TC-PERM-06: administrador recusa um anúncio pendente informando o motivo', () => {
      cy.visitReady('/admin')
      cy.contains('tr', listingTitle).contains('button', 'Recusar').click()

      cy.contains('tr', listingTitle).find('.admin-reject-input').type('a')
      cy.contains('tr', listingTitle).contains('button', 'Confirmar recusa').click()
      cy.contains('tr', listingTitle).find('.field-error').should('be.visible')

      cy.contains('tr', listingTitle)
        .find('.admin-reject-input')
        .clear()
        .type('Fotos insuficientes para avaliar o material.')
      cy.contains('tr', listingTitle).contains('button', 'Confirmar recusa').click()

      cy.contains('tr', listingTitle).should('not.exist')
    })

    it('TC-PERM-07: administrador exclui um anúncio informando o motivo', () => {
      cy.visitReady('/admin')
      cy.contains('tr', listingTitle).contains('button', 'Excluir').click()

      cy.contains('tr', listingTitle).find('.admin-reject-input').type('a')
      cy.contains('tr', listingTitle).contains('button', 'Confirmar exclusão').click()
      cy.contains('tr', listingTitle).find('.field-error').should('be.visible')

      cy.contains('tr', listingTitle)
        .find('.admin-reject-input')
        .clear()
        .type('Anúncio duplicado, removido pela moderação.')
      cy.contains('tr', listingTitle).contains('button', 'Confirmar exclusão').click()

      cy.get('.confirm-dialog').should('contain.text', 'Excluir anúncio')
      cy.get('.confirm-dialog').contains('button', 'Excluir').click()

      cy.contains(listingTitle).should('not.exist')
    })
  })

  describe('Administrador (ADMIN) — gestão de empresas e usuários', () => {
    let admin: TestAccount
    let target: TestAccount
    let targetCookies: Cypress.Cookie[] = []

    beforeEach(() => {
      // Alvo: uma conta descartável separada sobre a qual o admin vai agir. Os
      // cookies são salvos (não só descartados) para o cleanup poder restaurar
      // essa sessão depois — a sessão do admin assume o navegador a seguir.
      cy.apiRegister().then((acc) => {
        target = acc
      })
      cy.getCookies().then((cookies) => {
        targetCookies = cookies
      })
      cy.clearCookies()

      cy.apiRegister().then((acc) => {
        admin = acc
        cy.promoteToAdmin(acc.email, acc.password)
      })
    })

    afterEach(() => {
      // A sessão do admin está ativa; apaga ela, depois troca pelos cookies do
      // alvo para apagar essa conta também. Se um teste deixasse o alvo
      // suspenso, DELETE /me/account daria 403 (requireActiveUser) — todo
      // teste abaixo precisa deixá-lo reativado antes de terminar.
      cy.apiDeleteAccount()
      cy.clearCookies()
      targetCookies.forEach((c) => {
        cy.setCookie(c.name, c.value, { domain: c.domain, path: c.path })
      })
      cy.apiDeleteAccount()
    })

    it('TC-PERM-08: administrador concede e depois remove o selo de verificação de uma empresa', () => {
      cy.visitReady('/admin')
      cy.contains('.tab-btn', 'Usuários').click()

      cy.contains('tr', target.company).contains('button', 'Verificar').click()
      cy.contains('tr', target.company).contains('button', 'Remover selo').should('be.visible')

      cy.contains('tr', target.company).contains('button', 'Remover selo').click()
      cy.contains('tr', target.company).contains('button', 'Verificar').should('be.visible')
    })

    it('TC-PERM-09: administrador suspende e depois reativa uma conta', () => {
      cy.visitReady('/admin')
      cy.contains('.tab-btn', 'Usuários').click()

      cy.contains('tr', target.company).contains('button', 'Suspender').click()
      cy.get('.confirm-dialog').should('contain.text', 'Suspender conta')
      cy.get('.confirm-dialog').contains('button', 'Suspender').click()

      cy.contains('tr', target.company).should('have.class', 'row-suspended')
      cy.contains('tr', target.company).contains('button', 'Reativar').should('be.visible')

      // Reativa antes do teste terminar — ver nota do afterEach acima.
      cy.contains('tr', target.company).contains('button', 'Reativar').click()
      cy.contains('tr', target.company).should('not.have.class', 'row-suspended')
    })
  })
})

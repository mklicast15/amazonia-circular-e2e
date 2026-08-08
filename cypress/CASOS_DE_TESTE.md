# Casos de teste — Fluxos críticos

Escopo: cadastro → login → publicar anúncio (wizard completo) → enviar proposta/negociar.
Cada caso abaixo tem uma automação Cypress correspondente em `cypress/e2e/`.

Todas as automações usam contas descartáveis, criadas e apagadas via API
(`DELETE /me/account`, que apaga em cascata anúncios/propostas/equipe), para
não deixar dados de teste na base de produção.

## Cadastro (`cypress/e2e/auth/cadastro.cy.ts`)

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-CAD-01 | Preencher todos os campos obrigatórios com dados válidos e aceitar a Política de Privacidade | Conta criada, sessão autenticada automaticamente, mensagem "Cadastro realizado com sucesso!" |
| TC-CAD-02 | Informar um CNPJ com menos de 14 dígitos | Formulário não é enviado; erro de campo "CNPJ incompleto" |
| TC-CAD-03 | Não marcar o checkbox de consentimento com a Política de Privacidade | Formulário não é enviado; erro pedindo aceite da Política de Privacidade |

## Login (`cypress/e2e/auth/login.cy.ts`)

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-LOG-01 | E-mail e senha corretos | Login efetuado, redirecionamento para `/`, nome da conta visível no menu do usuário |
| TC-LOG-02 | Senha incorreta | Mensagem "E-mail ou senha incorretos.", permanece em `/login` |
| TC-LOG-03 | 5 tentativas seguidas de senha incorreta | Na 6ª tentativa (mesmo com senha certa), conta bloqueada por tempo, mensagem "Muitas tentativas de login..." |

## Publicar anúncio (`cypress/e2e/listings/publicar-anuncio.cy.ts`)

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PUB-01 | Completar as 5 etapas do wizard (Material, Quantidade, Características, Local e coleta, Revisão) com dados válidos e clicar em "Enviar para aprovação" | Mensagem "Anúncio enviado para análise!", link para "Ir para o painel" |
| TC-PUB-02 | Tentar avançar da etapa "Material" sem preencher os campos obrigatórios | Avanço bloqueado, erros de campo exibidos, permanece na etapa 1 |
| TC-PUB-03 | Acessar `/anuncie` sem estar autenticado | Tela de "Entre para publicar" exibida no lugar do formulário |

Observação: como não há credenciais de admin disponíveis para automação, a
aprovação de anúncios usados no teste de proposta é feita por um script
interno de teste (`server/src/scripts/testApproveListing.ts`), que só existe
para uso da suíte — não deve ser usado fora dela.

## Enviar proposta / negociar (`cypress/e2e/listings/proposta.cy.ts`)

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PROP-01 | Comprador autenticado abre um anúncio publicado, preenche o formulário de contato e envia | Mensagem "Proposta enviada!" |
| TC-PROP-02 | Enviar o formulário de contato sem nome/e-mail preenchidos | Envio bloqueado, erros de campo exibidos |
| TC-PROP-03 | Tentar enviar proposta sem estar autenticado | Modal exibe aviso pedindo login em vez do formulário |

## Limitações conhecidas

- A suíte roda com 1 retry automático (`cypress.config.ts`) para absorver um
  flake conhecido do dev server (hydration mismatch do React logo após o
  carregamento da página — ver comentário em `cypress/support/e2e.ts`). Se um
  teste de `proposta.cy.ts` precisar desse retry, a conta descartável do
  vendedor da tentativa que falhou pode não ser limpa (o estado do vendedor é
  compartilhado a nível de `describe` e é sobrescrito a cada `beforeEach`).
  É raro na prática; se acontecer, a conta órfã pode ser identificada pelo
  prefixo de e-mail `cy-` e removida manualmente.

## Rodando a suíte

```bash
npm run cy:open   # modo interativo
npm run cy:run    # modo headless (usa o Chrome instalado: npx cypress run --browser chrome)
```

Pré-requisitos: frontend em `http://localhost:3000` e backend em
`http://localhost:4000` já rodando. O backend aponta para o banco de
produção (Neon) — por isso o padrão de conta descartável é obrigatório em
qualquer novo teste adicionado a esta suíte.

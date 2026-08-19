# Catálogo de casos de teste

Este documento lista todos os casos de teste automatizados na suíte E2E da
Amazônia Circular, organizados por fluxo de negócio. Cada caso tem uma
automação Cypress correspondente em `cypress/e2e/`, referenciada no
cabeçalho de cada seção.

Para instruções de execução da suíte, ver o [`README.md`](../README.md) na
raiz do repositório.

## Convenções

- **ID**: prefixo de 3-4 letras por fluxo (`CAD`, `LOG`, `PUB`, `PROP`,
  `PAI`, `PROPR`, `PERF`, `REC`/`RS`, `PERM`) seguido de um número
  sequencial de dois dígitos. O prefixo identifica o fluxo mesmo fora de
  contexto (ex.: em relatório de execução ou mensagem de commit).
- **Cenário**: a ação/entrada testada, em linguagem de negócio.
- **Resultado esperado**: o comportamento observável que a automação
  verifica (mensagem, redirecionamento, estado de UI).
- Todas as automações usam **contas descartáveis**: criadas via API
  (`POST /auth/register`) e apagadas ao final (`DELETE /me/account`, que
  apaga em cascata anúncios, propostas e equipe). Isso é obrigatório porque
  o backend local aponta para o banco de **produção** — nenhum teste deve
  fugir desse padrão. Ver seção "Pré-requisitos" do `README.md`.

## Índice

| # | Fluxo | Spec | Casos |
|---|---|---|---|
| 1 | [Cadastro](#1-cadastro) | `auth/cadastro.cy.ts` | TC-CAD-01 a 03 |
| 2 | [Login](#2-login) | `auth/login.cy.ts` | TC-LOG-01 a 04 |
| 3 | [Recuperação de senha](#3-recuperação-de-senha) | `auth/recuperar-senha.cy.ts` | TC-REC-01/02, TC-RS-01 |
| 4 | [Publicar anúncio](#4-publicar-anúncio) | `listings/publicar-anuncio.cy.ts` | TC-PUB-01 a 03 |
| 5 | [Enviar proposta / negociar](#5-enviar-proposta--negociar) | `listings/proposta.cy.ts` | TC-PROP-01 a 03 |
| 6 | [Painel — gestão de anúncios](#6-painel--gestão-de-anúncios) | `painel/gestao-anuncios.cy.ts` | TC-PAI-01 a 03 |
| 7 | [Painel — propostas recebidas](#7-painel--propostas-recebidas) | `painel/propostas-recebidas.cy.ts` | TC-PROPR-01/02 |
| 8 | [Conta e perfil](#8-conta-e-perfil) | `auth/perfil.cy.ts` | TC-PERF-01 a 04 |
| 9 | [Permissões por papel](#9-permissões-por-papel) | `permissoes/papeis.cy.ts` | TC-PERM-01 a 09 |

Total: **28 casos** cobrindo 9 fluxos.

---

## 1. Cadastro

`cypress/e2e/auth/cadastro.cy.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-CAD-01 | Preencher todos os campos obrigatórios com dados válidos e aceitar a Política de Privacidade | Conta criada, sessão autenticada automaticamente, mensagem "Cadastro realizado com sucesso!" |
| TC-CAD-02 | Informar um CNPJ com menos de 14 dígitos | Formulário não é enviado; erro de campo "CNPJ incompleto" |
| TC-CAD-03 | Não marcar o checkbox de consentimento com a Política de Privacidade | Formulário não é enviado; erro pedindo aceite da Política de Privacidade |

## 2. Login

`cypress/e2e/auth/login.cy.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-LOG-01 | E-mail e senha corretos | Login efetuado, redirecionamento para `/`, nome da conta visível no menu do usuário |
| TC-LOG-02 | Senha incorreta | Mensagem "E-mail ou senha incorretos.", permanece em `/login` |
| TC-LOG-03 | 5 tentativas seguidas de senha incorreta | Na 6ª tentativa (mesmo com senha certa), conta bloqueada por tempo, mensagem "Muitas tentativas de login..." |
| TC-LOG-04 | Envio do formulário com e-mail e senha vazios | Formulário não é enviado; permanece em `/login`, sem sessão autenticada |

## 3. Recuperação de senha

`cypress/e2e/auth/recuperar-senha.cy.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-REC-01 | Solicitar link de redefinição para o e-mail de uma conta existente | Mensagem genérica de confirmação (não revela se a conta existe) |
| TC-REC-02 | Solicitar link sem informar e-mail | Bloqueado com erro de campo |
| TC-RS-01 | Acessar `/redefinir-senha` sem `token` na URL | Mensagem "Link inválido. Solicite um novo link de redefinição.", formulário de nova senha não é exibido |

> **Limitação conhecida:** a troca de senha em si (`/redefinir-senha?token=...`
> → nova senha → login com a senha nova) **não é automatizada**. O token de
> redefinição só é persistido como hash (`issueVerificationToken`/
> `consumeVerificationToken` no backend) — o valor em texto puro nunca fica
> recuperável para o teste, nem direto no banco. Automatizar o fluxo
> completo exigiria um hook test-only no repo do app (mesmo padrão do
> `testApproveListing.ts`) que devolvesse o token em texto puro fora de
> produção.

## 4. Publicar anúncio

`cypress/e2e/listings/publicar-anuncio.cy.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PUB-01 | Completar as 5 etapas do wizard (Material, Quantidade, Características, Local e coleta, Revisão) com dados válidos e clicar em "Enviar para aprovação" | Mensagem "Anúncio enviado para análise!", link para "Ir para o painel" |
| TC-PUB-02 | Tentar avançar da etapa "Material" sem preencher os campos obrigatórios | Avanço bloqueado, erros de campo exibidos, permanece na etapa 1 |
| TC-PUB-03 | Acessar `/anuncie` sem estar autenticado | Redirecionado para `/login`, formulário do wizard não é renderizado |

> **Nota:** como não há credenciais de admin disponíveis para automação, a
> aprovação de anúncios usados no teste de proposta é feita por um script
> interno de teste (`server/src/scripts/testApproveListing.ts`), que só
> existe para uso da suíte — não deve ser usado fora dela.

## 5. Enviar proposta / negociar

`cypress/e2e/listings/proposta.cy.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PROP-01 | Comprador autenticado abre um anúncio publicado, preenche o formulário de contato e envia | Mensagem "Proposta enviada!" |
| TC-PROP-02 | Enviar o formulário de contato sem nome/e-mail preenchidos | Envio bloqueado, erros de campo exibidos |
| TC-PROP-03 | Tentar enviar proposta sem estar autenticado | Modal exibe aviso pedindo login em vez do formulário |

## 6. Painel — gestão de anúncios

`cypress/e2e/painel/gestao-anuncios.cy.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PAI-01 | Pausar um anúncio publicado e depois reativá-lo | Status muda para "Pausado" e depois de volta para "Publicado" |
| TC-PAI-02 | Marcar um anúncio publicado como vendido (confirmando no diálogo) | Status muda para "Vendido"; ações de Pausar/Editar somem da linha |
| TC-PAI-03 | Excluir um anúncio informando o motivo (confirmando no diálogo) | Anúncio some da lista; motivo com menos de 3 caracteres é bloqueado antes disso |

## 7. Painel — propostas recebidas

`cypress/e2e/painel/propostas-recebidas.cy.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PROPR-01 | Vendedor altera o status de uma proposta recebida (Nova → Lida) | Select reflete o novo status |
| TC-PROPR-02 | Vendedor registra a venda a partir de uma proposta (confirmando no diálogo) | Anúncio é marcado como vendido; linha da proposta mostra "Anúncio vendido" |

## 8. Conta e perfil

`cypress/e2e/auth/perfil.cy.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PERF-01 | Editar nome, telefone e bairro pelo menu "Editar perfil" | Dados atualizados exibidos na visão de detalhes e no nome do menu do usuário |
| TC-PERF-02 | Salvar o perfil com o telefone vazio | Bloqueado com erro "Informe o telefone." |
| TC-PERF-03 | Clicar em "Sair" no menu do usuário | Sessão encerrada; `/painel` passa a exigir login |
| TC-PERF-04 | Excluir a própria conta pela seção de Privacidade e dados (LGPD) | Conta e sessão removidas, redirecionamento para `/` |

> **Nota:** a exclusão de conta pela UI usa o mesmo endpoint
> (`DELETE /me/account`) que a limpeza automática da suíte
> (`cy.apiDeleteAccount()`), então já é autolimpante — não deixa conta órfã.

## 9. Permissões por papel

`cypress/e2e/permissoes/papeis.cy.ts`

Papéis existentes: `SELLER`, `BUYER`, `ADMIN`.

- No backend, criação/edição de anúncios e envio de propostas **não são
  restritos por papel** — qualquer conta ativa pode publicar ou propor
  (comentário no código-fonte: *"Any active account can post a listing
  (buyers and sellers are unified)"*). Comprador e vendedor são, na prática,
  o mesmo papel efetivo hoje.
- `ADMIN` não pode ser escolhido no cadastro público; só existe via
  promoção. Os casos abaixo usam o próprio script de provisionamento do app
  (`admin:create`) para promover uma conta descartável, análogo ao padrão
  já usado pelo `testApproveListing.ts`.

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PERM-01 | Conta com papel BUYER completa o wizard de publicação | Anúncio enviado para análise com sucesso (confirma que não há segregação por papel) |
| TC-PERM-02 | Conta BUYER acessa `/admin` diretamente | Redirecionada para `/`, toast "Você não tem acesso a esta área." |
| TC-PERM-03 | Conta SELLER acessa `/admin` diretamente | Mesmo bloqueio do TC-PERM-02 |
| TC-PERM-04 | Conta ADMIN acessa `/admin` | Área carrega, aba "Moderação" ativa, anúncio pendente da conta aparece na fila |
| TC-PERM-05 | ADMIN aprova um anúncio pendente | Anúncio sai da listagem filtrada por "Em análise" |
| TC-PERM-06 | ADMIN recusa um anúncio pendente informando o motivo | Motivo com menos de 3 caracteres é bloqueado; ao confirmar, anúncio sai da fila de pendentes |
| TC-PERM-07 | ADMIN exclui um anúncio pela aba de Moderação, informando o motivo | Motivo com menos de 3 caracteres é bloqueado; ao confirmar (com diálogo), anúncio deixa de existir |
| TC-PERM-08 | ADMIN concede e depois remove o selo de verificação de uma empresa (aba Usuários) | Botão alterna entre "Verificar" e "Remover selo" |
| TC-PERM-09 | ADMIN suspende e depois reativa a conta de outro usuário (aba Usuários) | Suspender exige confirmação no diálogo; linha ganha destaque de suspensa; reativar não exige confirmação |

---

## Limitações conhecidas

- A suíte roda com 1 retry automático (`cypress.config.ts`) para absorver um
  flake conhecido do dev server (hydration mismatch do React logo após o
  carregamento da página — ver comentário em `cypress/support/e2e.ts`). Se um
  teste de `proposta.cy.ts` precisar desse retry, a conta descartável do
  vendedor da tentativa que falhou pode não ser limpa (o estado do vendedor é
  compartilhado a nível de `describe` e é sobrescrito a cada `beforeEach`).
  É raro na prática; se acontecer, a conta órfã pode ser identificada pelo
  prefixo de e-mail `cy-` e removida manualmente.
- Ver seção "Recuperação de senha" (item 3) para a limitação do fluxo de
  troca de senha.

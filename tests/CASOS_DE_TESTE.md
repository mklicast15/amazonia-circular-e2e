# Catálogo de casos de teste

Este documento lista todos os casos de teste automatizados na suíte E2E da
Amazônia Circular, organizados por fluxo de negócio. Cada caso tem uma
automação Playwright correspondente em `tests/`, referenciada no
cabeçalho de cada seção.

Para instruções de execução da suíte, ver o [`README.md`](../README.md) na
raiz do repositório.

## Convenções

- **ID**: prefixo de 3-4 letras por fluxo (`CAD`, `LOG`, `PUB`, `PROP`,
  `PAI`, `PROPR`, `PERF`, `REC`/`RS`, `PERM`, `EQP`, `PLN`, `CAT`, `ADM`, `AVA`, `PUBL`) seguido de um número
  sequencial de dois dígitos. O prefixo identifica o fluxo mesmo fora de
  contexto (ex.: em relatório de execução ou mensagem de commit).
- **Cenário**: a ação/entrada testada, em linguagem de negócio.
- **Resultado esperado**: o comportamento observável que a automação
  verifica (mensagem, redirecionamento, estado de UI).
- Todas as automações usam **contas descartáveis**: criadas via API
  (`POST /auth/register`) e apagadas ao final (`DELETE /me/account`, que
  apaga em cascata anúncios, propostas e equipe), cada uma com senha
  aleatória. A suíte roda contra um **banco local** — ver "Pré-requisitos" do
  `README.md`.

## Índice

| # | Fluxo | Spec | Casos |
|---|---|---|---|
| 1 | [Cadastro](#1-cadastro) | `auth/cadastro.spec.ts` | TC-CAD-01 a 04 |
| 2 | [Login](#2-login) | `auth/login.spec.ts` | TC-LOG-01 a 05 |
| 3 | [Recuperação de senha](#3-recuperação-de-senha) | `auth/recuperar-senha.spec.ts` | TC-REC-01/02, TC-RS-01 |
| 4 | [Publicar anúncio](#4-publicar-anúncio) | `listings/publicar-anuncio.spec.ts` | TC-PUB-01 a 03 |
| 5 | [Enviar proposta / negociar](#5-enviar-proposta--negociar) | `listings/proposta.spec.ts` | TC-PROP-01 a 04 |
| 6 | [Painel — gestão de anúncios](#6-painel--gestão-de-anúncios) | `painel/gestao-anuncios.spec.ts` | TC-PAI-01 a 03 |
| 7 | [Painel — propostas recebidas](#7-painel--propostas-recebidas) | `painel/propostas-recebidas.spec.ts` | TC-PROPR-01/02 |
| 8 | [Conta e perfil](#8-conta-e-perfil) | `auth/perfil.spec.ts` | TC-PERF-01 a 04 |
| 9 | [Permissões por papel](#9-permissões-por-papel) | `permissoes/papeis.spec.ts` | TC-PERM-01 a 10 |
| 10 | [Painel — equipe](#10-painel--equipe) | `painel/equipe.spec.ts` | TC-EQP-01 a 03 |
| 11 | [Planos pagos](#11-planos-pagos) | `planos/planos.spec.ts` | TC-PLN-01 a 10 |
| 12 | [Marketplace — catálogo](#12-marketplace--catálogo) | `marketplace/catalogo.spec.ts` | TC-CAT-01 a 09 |
| 13 | [Admin — paginação](#13-admin--paginação) | `admin/paginacao.spec.ts` | TC-ADM-01 a 04 |
| 14 | [Avaliar o vendedor](#14-avaliar-o-vendedor) | `listings/avaliacao.spec.ts` | TC-AVA-01 a 03 |
| 15 | [Páginas públicas](#15-páginas-públicas) | `publico/paginas.spec.ts` | TC-PUBL-01 a 04 |
| — | Editar anúncio (painel) | `painel/editar-anuncio.spec.ts` | TC-PAI-04 |

Total: **41 casos** cobrindo 10 fluxos.

---

## 1. Cadastro

`tests/auth/cadastro.spec.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-CAD-01 | Preencher todos os campos obrigatórios com dados válidos e aceitar a Política de Privacidade | Conta criada, sessão autenticada automaticamente, mensagem "Cadastro realizado com sucesso!" |
| TC-CAD-02 | Informar um CNPJ com menos de 14 dígitos | Formulário não é enviado; erro de campo "CNPJ incompleto" |
| TC-CAD-03 | Não marcar o checkbox de consentimento com a Política de Privacidade | Formulário não é enviado; erro pedindo aceite da Política de Privacidade |
| TC-CAD-04 | Informar um CNPJ com dígito verificador inválido | Formulário não é enviado; erro de campo "CNPJ inválido" |

## 2. Login

`tests/auth/login.spec.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-LOG-01 | E-mail e senha corretos | Login efetuado, redirecionamento para `/`, nome da conta visível no menu do usuário |
| TC-LOG-02 | Senha incorreta | Mensagem "E-mail ou senha incorretos.", permanece em `/login` |
| TC-LOG-03 | 5 tentativas seguidas de senha incorreta | Na 6ª tentativa (mesmo com senha certa), conta bloqueada por tempo, mensagem "Muitas tentativas de login..." |
| TC-LOG-04 | Envio do formulário com e-mail e senha vazios | Formulário não é enviado; permanece em `/login`, sem sessão autenticada |
| TC-LOG-05 | Outra origem (outro IP) erra a senha da conta 6 vezes | Só essa origem fica bloqueada (429); o dono da conta entra normalmente |

## 3. Recuperação de senha

`tests/auth/recuperar-senha.spec.ts`

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
> completo exigiria um hook test-only no repo do app que devolvesse o token
> em texto puro fora de produção.

## 4. Publicar anúncio

`tests/listings/publicar-anuncio.spec.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PUB-01 | Completar as 5 etapas do wizard (Material, Quantidade, Características, Local e coleta, Revisão) com dados válidos e clicar em "Enviar para aprovação" | Mensagem "Anúncio enviado para análise!", link para "Ir para o painel" |
| TC-PUB-02 | Tentar avançar da etapa "Material" sem preencher os campos obrigatórios | Avanço bloqueado, erros de campo exibidos, permanece na etapa 1 |
| TC-PUB-03 | Acessar `/anuncie` sem estar autenticado | Exibe "Entre para publicar" com link para `/login`; formulário do wizard não é renderizado |

> **Nota:** os anúncios usados nos testes de proposta e de painel são
> aprovados pela mesma rota da UI de moderação
> (`PATCH /admin/listings/:id/moderate`), usando uma conta descartável
> promovida a ADMIN uma vez por worker (fixture `moderator` em
> `tests/support/fixtures.ts`). Não depende de nenhum script test-only no
> repo do app.

## 5. Enviar proposta / negociar

`tests/listings/proposta.spec.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PROP-01 | Comprador autenticado abre um anúncio publicado, preenche o formulário de contato e envia | Mensagem "Proposta enviada!" |
| TC-PROP-02 | Enviar o formulário de contato sem nome/e-mail preenchidos | Envio bloqueado, erros de campo exibidos |
| TC-PROP-03 | Tentar enviar proposta sem estar autenticado | Modal exibe aviso pedindo login em vez do formulário |
| TC-PROP-04 | Conta logada sem e-mail confirmado abre um anúncio | Contatos do vendedor ocultos, com aviso "Confirme seu e-mail para ver os contatos do vendedor" |

## 6. Painel — gestão de anúncios

`tests/painel/gestao-anuncios.spec.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PAI-01 | Pausar um anúncio publicado e depois reativá-lo | Status muda para "Pausado" e depois de volta para "Publicado" |
| TC-PAI-02 | Marcar um anúncio publicado como vendido (confirmando no diálogo) | Status muda para "Vendido"; ações de Pausar/Editar somem da linha |
| TC-PAI-03 | Excluir um anúncio informando o motivo (confirmando no diálogo) | Anúncio some da lista; motivo com menos de 3 caracteres é bloqueado antes disso |

## 7. Painel — propostas recebidas

`tests/painel/propostas-recebidas.spec.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PROPR-01 | Vendedor altera o status de uma proposta recebida (Nova → Lida) | Dropdown de status reflete o novo valor |
| TC-PROPR-02 | Vendedor registra a venda a partir de uma proposta (confirmando no diálogo) | Anúncio é marcado como vendido; linha da proposta mostra "Anúncio vendido" |

## 8. Conta e perfil

`tests/auth/perfil.spec.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PERF-01 | Editar nome, telefone e bairro pelo menu "Editar perfil" | Dados atualizados exibidos na visão de detalhes e no nome do menu do usuário |
| TC-PERF-02 | Salvar o perfil com o telefone vazio | Bloqueado com erro "Informe o telefone." |
| TC-PERF-03 | Clicar em "Sair" no menu do usuário | Sessão encerrada; `/painel` passa a exigir login |
| TC-PERF-04 | Excluir a própria conta pela seção de Privacidade e dados (LGPD) do modal "Editar perfil" | Conta e sessão removidas, redirecionamento para `/` |

> **Nota:** a exclusão de conta pela UI usa o mesmo endpoint
> (`DELETE /me/account`) que a limpeza automática da suíte
> (`apiDeleteAccount` em `tests/support/api.ts`), então já é autolimpante — não deixa conta órfã.

## 9. Permissões por papel

`tests/permissoes/papeis.spec.ts`

Papéis existentes: `SELLER`, `BUYER`, `ADMIN`.

- No backend, criação/edição de anúncios e envio de propostas **não são
  restritos por papel** — qualquer conta ativa pode publicar ou propor
  (comentário no código-fonte: *"Any active account can post a listing
  (buyers and sellers are unified)"*). Comprador e vendedor são, na prática,
  o mesmo papel efetivo hoje.
- `ADMIN` não pode ser escolhido no cadastro público; só existe via
  promoção. Os casos abaixo promovem uma conta descartável com o script de
  provisionamento do app (`server/src/scripts/createAdmin.ts`) e fazem o
  login de admin completo, com MFA (`loginAsAdmin`).

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
| TC-PERM-10 | Conta promovida a ADMIN acessa `/admin` com a sessão aberta antes da promoção | Redirecionada para `/login` com aviso para entrar de novo (o `/admin` exige sessão com MFA) |

## 10. Painel — equipe

`tests/painel/equipe.spec.ts`

O responsável pela empresa é quem a criou. Só ele gera convites e remove
membros.

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-EQP-01 | Responsável remove um membro pela aba Equipe (confirmando no diálogo) | Selo "Responsável" na linha do dono; membro some da lista |
| TC-EQP-02 | Membro que não é o responsável abre a aba Equipe | Aviso de que só o responsável convida/remove; sem botões de convite/remoção; API recusa gerar convite (403) |
| TC-EQP-03 | Membro removido entra no painel | Aviso bloqueante "Você foi removido da empresa"; API responde 403 `REMOVED_FROM_COMPANY`, mas libera exportar os dados; excluir a conta pelo aviso funciona |

## 11. Planos pagos

`tests/planos/planos.spec.ts`

Fase 1 dos planos (Semente R$ 0 / Raiz R$ 99 / Floresta R$ 199), limites conferidos no
servidor, promoções e queda de plano. Os casos rodam **em série**, como uma história só,
com duas empresas e um admin: no staging o login/cadastro é limitado a 10 por IP a cada
15 min, e essa ordem gasta poucas chamadas de autenticação. Se um caso falha, os
seguintes não rodam.

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PLN-01 | Visitante abre /planos (desktop e 390 px) | 3 cards (Grátis, R$ 99, R$ 199), 3 recursos "Em breve"; sem rolagem horizontal no celular |
| TC-PLN-02 | Empresa nova abre "Meu plano" | Semente; 0 de 5 anúncios, 1 de 2 membros, capa + 3 fotos; sem selo Parceiro |
| TC-PLN-03 | Com 5 anúncios ativos, envia um rascunho para aprovação | Janela "Limite do plano Semente" com Raiz e Floresta; "Ver planos" abre em nova aba; rascunho continua rascunho |
| TC-PLN-04 | Com 1 membro e 1 convite aberto, gera outro convite | Janela de planos sobre "membros na equipe" |
| TC-PLN-05 | Admin ativa o Raiz pelo detalhe da empresa | Empresa vê Raiz, "Assinatura do Raiz válida até…", selo Parceiro e 5 de 20 anúncios |
| TC-PLN-06 | Empresa grátis envia um anúncio mais novo que o do parceiro | Na fila de moderação, o anúncio do parceiro (com selo) vem antes |
| TC-PLN-07 | Comprador abre um anúncio publicado do parceiro | Selo Parceiro no painel do vendedor |
| TC-PLN-08 | Admin cria teste grátis do Floresta para a outra empresa (empresas escolhidas) | Promoção ativa; empresa vê "Teste grátis do Floresta até…"; em /planos o card Floresta diz "Em teste grátis" e mostra o botão "Quero o Floresta" (sem ação por enquanto) |
| TC-PLN-09 | Admin encerra e revoga a promoção | Detalhe mostra "revogado em" e "Encerrada"; empresa volta ao Semente |
| TC-PLN-10 | Empresa no Raiz com 6 publicados volta ao Semente | O anúncio mais recente fica pausado, os 5 mais antigos seguem publicados, painel mostra 5 de 5; auditoria registra "Plano rebaixado" pelo "Sistema" |

## 12. Marketplace — catálogo

`tests/marketplace/catalogo.spec.ts`

Sobre um catálogo fixo de QA (`support/catalog.ts`): 22 anúncios publicados de uma empresa no
Floresta, com o marcador `CatalogoQA` no título. É criado na primeira rodada e reaproveitado
nas seguintes. As contagens esperadas saem dos dados reais da API.

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-CAT-01 | Busca o catálogo e navega pelo paginador (10 por página) | 1–10, 11–20, última página com o resto; nada repetido entre páginas; botões de início/fim desabilitados nas pontas |
| TC-CAT-02 | Busca um termo sem resultado | "Nenhum anúncio encontrado"; "limpar todos" volta ao total anterior |
| TC-CAT-03 | Na página 2, filtra por tipo PEAD | Volta à 1ª página; só cards PEAD; chip do filtro ativo remove o filtro |
| TC-CAT-04 | Filtra por condição "Contaminado" | Só cards contaminados, na quantidade certa |
| TC-CAT-05 | Informa quantidade mínima | Só anúncios com kg ≥ mínimo; chip "mín. X kg" |
| TC-CAT-06 | Ordena por "Maior quantidade" | Os 10 maiores lotes, em ordem decrescente |
| TC-CAT-07 | Alterna grade/lista | Classe de lista aplicada e removida |
| TC-CAT-08 | Abre a aba Vendedores | Empresa do catálogo com o selo Parceiro |
| TC-CAT-09 | Clica num card | Abre /products/:id com o mesmo título e o vendedor |

## 13. Admin — paginação

`tests/admin/paginacao.spec.ts`

Tabelas do /admin paginam no navegador (25 ou 50 por página); a auditoria busca a API de 100 em
100. Os casos que dependem do volume de dados do ambiente pulam com o motivo quando não há dados
suficientes (no staging, rodam por último — ver `scripts/regressao-staging.sh`).

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-ADM-01 | Moderação, filtro "Publicado" | 1–25 de N; próxima página 26–…; volta; com 50 por página mostra até 50 |
| TC-ADM-02 | Auditoria, última página e filtro "Logins e cadastros" | Faixa final correta; só logins/cadastros no filtro |
| TC-ADM-03 | Auditoria com mais de 100 eventos | "Carregar eventos mais antigos" traz além dos 100 |
| TC-ADM-04 | Usuários com mais de 25 | 1–25 de N e página seguinte |

## 14. Avaliar o vendedor

`tests/listings/avaliacao.spec.ts`

Só avalia quem confirmou o e-mail e depois que o vendedor respondeu uma proposta sua. A confirmação
de e-mail é marcada direto no banco (o ambiente de teste não envia e-mail).

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-AVA-01 | Comprador confirmado, proposta respondida, avalia com 4 estrelas | "Avaliação enviada. Obrigado!"; o anúncio mostra 1 avaliação do vendedor |
| TC-AVA-02 | Comprador sem e-mail confirmado tenta avaliar | "Confirme seu e-mail para avaliar empresas." |
| TC-AVA-03 | Comprador confirmado, proposta ainda sem resposta | "Você só pode avaliar após o vendedor responder a uma proposta sua." |

## 15. Páginas públicas

`tests/publico/paginas.spec.ts`

| ID | Cenário | Resultado esperado |
|---|---|---|
| TC-PUBL-01 | Abre /sobre, /solucoes, /materiais, /blog, /contato, /privacidade, /planos | Título certo; nenhum erro de JavaScript (o 401 do visitante no /auth/me não conta) |
| TC-PUBL-02 | Abre uma rota que não existe | "Página não encontrada" |
| TC-PUBL-03 | Usa o menu do topo | Sobre nós, Planos e Contato levam às páginas certas |
| TC-PUBL-04 | Abre /contato | Link mailto para o e-mail da equipe |

Também no painel: **TC-PAI-04** (`painel/editar-anuncio.spec.ts`) — editar um anúncio publicado
pelo assistente salva e o devolve para "Em análise".

---

## Limitações conhecidas

- Em CI a suíte roda com 1 retry automático (`playwright.config.ts`) para
  absorver um flake conhecido do dev server (hydration mismatch do React
  logo após o carregamento da página — ver `gotoReady` em
  `tests/support/fixtures.ts`). Cada tentativa cria e apaga as próprias
  contas via fixtures, então um retry não deixa conta órfã. Se mesmo assim
  sobrar alguma (ex.: processo morto no meio do teste), ela pode ser
  identificada pelo prefixo de e-mail `e2e-` (ou `cy-`, da suíte Cypress
  antiga) e removida manualmente.
- Ver seção "Recuperação de senha" (item 3) para a limitação do fluxo de
  troca de senha.
- Upload de imagens (TC-PUB-01, TC-PERM-01) precisa do Cloudinary configurado na
  API: sem ele o `/uploads` responde 503 e esses dois casos falham. Localmente, rode a
  API com as variáveis `CLOUDINARY_*` de desenvolvimento; no staging já existem.
- No staging o limite de login/cadastro (10 por IP a cada 15 min) vale de verdade — o
  IP falso do `X-Forwarded-For` só funciona localmente. Rode lá só o necessário
  (ex.: `tests/planos`) e espere 15 min entre rodadas.

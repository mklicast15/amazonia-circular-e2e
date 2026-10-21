// Cria contas PERMANENTES de QA, uma por situação de plano, para validar os planos à mão
// no ambiente sob teste (ex.: staging). Diferente da suíte, NÃO apaga nada no fim.
//
//   API_URL=https://api-staging.amazoniacircular.com.br \
//   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... E2E_ADMIN_TOTP_SECRET=... \
//   QA_EMAIL='seu.email+{slug}@gmail.com' \
//   npx tsx scripts/contas-qa.ts
//
// QA_EMAIL usa {slug} no lugar do tipo de conta (semente, raiz, floresta, teste-gratis).
// Sem ele, os e-mails são qa-{slug}-<data>@example.com (não recebem e-mail).
// As credenciais vão para qa-accounts.local.json (fora do git) e para o terminal.
// Gasta 6 chamadas de login/cadastro (4 cadastros + login do admin com MFA): no staging
// o limite é 10 por IP a cada 15 min.
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { request, type APIRequestContext } from '@playwright/test'
import { apiCreateListing, buildAccount, totp } from '../tests/support/api'
import { API_URL, E2E_ADMIN } from '../tests/support/env'

type Slug = 'semente' | 'raiz' | 'floresta' | 'teste-gratis'
const ACCOUNTS: { slug: Slug; company: string; plan?: 'RAIZ' | 'FLORESTA' }[] = [
  { slug: 'semente', company: 'QA Semente' },
  { slug: 'raiz', company: 'QA Raiz', plan: 'RAIZ' },
  { slug: 'floresta', company: 'QA Floresta', plan: 'FLORESTA' },
  { slug: 'teste-gratis', company: 'QA Teste Grátis' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- respostas da API, lidas campo a campo
async function ok(res: Awaited<ReturnType<APIRequestContext['get']>>, what: string): Promise<any> {
  if (!res.ok()) throw new Error(`${what} falhou (${res.status()}): ${await res.text()}`)
  return res.json()
}

async function main() {
  if (!E2E_ADMIN) throw new Error('Defina E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD e E2E_ADMIN_TOTP_SECRET (ver README).')
  const date = new Date().toISOString().slice(0, 10)
  const emailFor = (slug: string) =>
    process.env.QA_EMAIL ? process.env.QA_EMAIL.replace('{slug}', slug) : `qa-${slug}-${date}@example.com`

  const admin = await request.newContext()
  const login = await ok(await admin.post(`${API_URL}/auth/login`, { data: { email: E2E_ADMIN.email, password: E2E_ADMIN.password } }), 'login do admin')
  await ok(await admin.post(`${API_URL}/auth/mfa/verify`, { data: { mfaToken: login.mfaToken, code: totp(E2E_ADMIN.totpSecret) } }), 'MFA do admin')

  const created: { conta: string; email: string; senha: string; empresa: string; plano: string }[] = []
  const companyIds: Partial<Record<Slug, string>> = {}

  for (const a of ACCOUNTS) {
    const account = buildAccount({
      email: emailFor(a.slug),
      password: `Qa-${randomBytes(9).toString('base64url')}`,
      name: `${a.company} (responsável)`,
      company: `${a.company} ${date}`,
    })
    const api = await request.newContext()
    await ok(await api.post(`${API_URL}/auth/register`, { data: account }), `cadastro de ${account.email}`)
    // Um anúncio por empresa, aprovado pelo admin: o selo Parceiro aparece nele.
    const listing = await apiCreateListing(api, { title: `Aparas de PP (${a.company})` })
    const queue = await ok(await admin.get(`${API_URL}/admin/listings?status=pending`), 'fila de moderação')
    const pending = queue.listings.find((l: { id: number }) => l.id === listing.id)
    await ok(await admin.patch(`${API_URL}/admin/listings/${listing.id}/moderate`, { data: { status: 'published', reviewedUpdatedAt: pending.updatedAt } }), 'aprovar anúncio')
    await api.dispose()

    const users = await ok(await admin.get(`${API_URL}/admin/users`), 'lista de usuários')
    const companyId = users.users.find((u: { email: string }) => u.email === account.email.toLowerCase())?.companyId
    companyIds[a.slug] = companyId
    if (a.plan) {
      await ok(await admin.patch(`${API_URL}/admin/companies/${companyId}/plan`, { data: { plan: a.plan, months: 1 } }), `ativar ${a.plan}`)
    }
    created.push({ conta: a.slug, email: account.email, senha: account.password, empresa: account.company, plano: a.plan ?? 'SEMENTE' })
  }

  // Teste grátis do Floresta por promoção (empresas escolhidas), como o admin faria.
  await ok(await admin.post(`${API_URL}/admin/promotions`, {
    data: {
      name: `QA teste grátis Floresta ${date}`,
      benefitType: 'TRIAL',
      trialPlan: 'FLORESTA',
      trialDays: 30,
      audience: 'CHOSEN',
      companyIds: [companyIds['teste-gratis']],
    },
  }), 'criar promoção')
  created.find((c) => c.conta === 'teste-gratis')!.plano = 'FLORESTA (teste grátis, 30 dias)'

  writeFileSync('qa-accounts.local.json', JSON.stringify({ api: API_URL, criadasEm: new Date().toISOString(), contas: created }, null, 2))
  console.table(created)
  console.log('Credenciais salvas em qa-accounts.local.json (fora do git).')
  await admin.dispose()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

import { createHmac, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { request, type APIRequestContext } from '@playwright/test'
import { ALLOW_REMOTE_DB, API_URL, APP_DATABASE_URL, APP_SERVER_PATH } from './env'

export interface TestAccount {
  email: string
  password: string
  name: string
  company: string
  cnpj: string
  phone: string
  location: string
  neighborhood: string
  // Não é enviado à API a menos que seja explicitamente sobrescrito — registerSchema usa SELLER por padrão.
  role?: 'SELLER' | 'BUYER'
  // Com convite, a conta entra numa empresa existente (company/cnpj são ignorados).
  inviteCode?: string
}

// Snapshot dos cookies de sessão logo após o registro. O cleanup usa esse
// snapshot (não o navegador) para apagar a conta, então funciona mesmo se o
// teste deslogou, limpou cookies ou trocou de usuário no meio do caminho.
export type SessionState = Awaited<ReturnType<APIRequestContext['storageState']>>

function randomDigits(len: number): string {
  let out = ''
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10)
  return out
}

// CNPJ aleatório com dígitos verificadores corretos — o cadastro valida o DV.
export function randomCnpj(): string {
  const base = randomDigits(8) + '0001'
  const digit = (b: string) => {
    const weights = b.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const rest = [...b].reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0) % 11
    return rest < 2 ? 0 : 11 - rest
  }
  const first = digit(base)
  return `${base}${first}${digit(base + first)}`
}

let seq = 0
export function uniqueStamp(): string {
  return `${Date.now()}${process.pid}${seq++}`
}

// O backend limita /auth/register e /auth/login a 10 requisições por IP a
// cada 15 min (authLimiter), e a suíte registra dezenas de contas. Localmente
// não há proxy na frente da API e ela roda com `trust proxy 1`, então o IP
// do cliente vem do X-Forwarded-For — cada teste/ator usa um IP falso
// próprio para não esbarrar no limite. Em produção (atrás do proxy do Render)
// isso não tem efeito, porque o proxy acrescenta o IP real no fim do header.
export function fakeClientIp(): string {
  const n = () => Math.floor(Math.random() * 254) + 1
  return `10.${n()}.${n()}.${n()}`
}

export function clientIpHeaders(): Record<string, string> {
  return { 'X-Forwarded-For': fakeClientIp() }
}

export function buildAccount(overrides: Partial<TestAccount> = {}): TestAccount {
  const stamp = uniqueStamp()
  return {
    email: `e2e-${stamp}@example.com`,
    // Senha aleatória por conta: se alguma ficar órfã, ninguém conhece a senha dela.
    password: `Teste-${randomBytes(9).toString('base64url')}`,
    name: 'Ana Teste E2E',
    company: `Playwright E2E Materiais ${stamp}`,
    cnpj: randomCnpj(),
    phone: '92991234567',
    location: 'Manaus - AM',
    neighborhood: 'Centro',
    ...overrides,
  }
}

// Registra a conta direto na API. O registro já cria a sessão, então o
// contexto `api` passado fica autenticado — se for o `context.request` de um
// BrowserContext, o navegador também fica.
export async function apiRegister(api: APIRequestContext, account: TestAccount): Promise<SessionState> {
  const res = await api.post(`${API_URL}/auth/register`, { data: account })
  if (!res.ok()) {
    throw new Error(`POST /auth/register falhou (${res.status()}): ${await res.text()}`)
  }
  return api.storageState()
}

// Apaga a conta da sessão salva (endpoint de autoexclusão LGPD). Apaga em
// cascata anúncios/propostas/equipe da conta. 401/403 são tolerados: o
// próprio teste pode já ter excluído a conta (TC-PERF-04).
export async function apiDeleteAccount(session: SessionState): Promise<void> {
  const ctx = await request.newContext({ storageState: session, extraHTTPHeaders: clientIpHeaders() })
  try {
    const res = await ctx.delete(`${API_URL}/me/account`)
    if (!res.ok() && ![401, 403].includes(res.status())) {
      console.warn(`DELETE /me/account retornou ${res.status()} — possível conta órfã`)
    }
  } finally {
    await ctx.dispose()
  }
}

// Cria um anúncio direto pela API na sessão autenticada de `api` (usado para
// montar o estado em specs que não são sobre o wizard de criação em si).
export async function apiCreateListing(
  api: APIRequestContext,
  overrides: Record<string, unknown> = {},
): Promise<{ id: number }> {
  const res = await api.post(`${API_URL}/listings`, {
    data: {
      title: 'Aparas de PEBD prensadas (Playwright)',
      plasticType: 'PEBD',
      condition: 'limpo',
      quantityKg: 5000,
      // O backend só aceita imagens da própria plataforma (upload ou caminho do site).
      image: '/logo-amazonia-icon.webp',
      shortDescription: 'Material de teste gerado pela suíte Playwright.',
      description: 'Anúncio de teste criado via API pela automação Playwright.',
      saveAsDraft: false,
      ...overrides,
    },
  })
  if (!res.ok()) {
    throw new Error(`POST /listings falhou (${res.status()}): ${await res.text()}`)
  }
  return (await res.json()).listing
}

// Só para teste: promove a ADMIN uma conta descartável já registrada, rodando
// o próprio script de provisionamento de admin do repo do app
// (server/src/scripts/createAdmin.ts). O script faz upsert por e-mail — como a
// conta já existe, ele só troca papel/status, mantendo a senha e a sessão
// atual intactas. O backend relê o papel do banco a cada requisição
// (requireRole), então a sessão já aberta passa a valer como admin sem
// precisar de novo login (que exigiria MFA).
export function promoteToAdmin(email: string, password: string): void {
  execFileSync('npx', ['tsx', 'src/scripts/createAdmin.ts', email, password], {
    cwd: APP_SERVER_PATH,
    stdio: 'pipe',
    // DATABASE_URL explícito: o dotenv do app não sobrescreve variáveis já definidas.
    env: { ...process.env, DATABASE_URL: appDatabaseUrl() },
  })
}

// O script roda fora da API, então precisa receber o mesmo banco dela. Sem
// APP_DATABASE_URL ele usaria o server/.env do app (produção) e criaria contas
// ADMIN lá — já aconteceu. Bancos que não são locais exigem E2E_ALLOW_REMOTE_DB=1.
function appDatabaseUrl(): string {
  if (!APP_DATABASE_URL) {
    throw new Error('Defina APP_DATABASE_URL com o mesmo banco da API sob teste (ver README).')
  }
  const host = new URL(APP_DATABASE_URL).hostname
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (!local && !ALLOW_REMOTE_DB) {
    throw new Error(`APP_DATABASE_URL aponta para ${host}, que não é local. Para rodar mesmo assim, defina E2E_ALLOW_REMOTE_DB=1.`)
  }
  return APP_DATABASE_URL
}

// TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) a partir do segredo base32 que o
// /auth/mfa/setup devolve — o mesmo que um app autenticador calcularia.
export function totp(secretBase32: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of secretBase32.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)))
  const hmac = createHmac('sha1', key).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(code).padStart(6, '0')
}

// Promove a conta e faz o login de admin completo (senha → configuração do MFA →
// código TOTP) no contexto `api`. O /admin só aceita sessões que passaram pelo MFA,
// então a sessão aberta no cadastro não serve. Devolve o novo snapshot da sessão.
export async function loginAsAdmin(api: APIRequestContext, account: TestAccount): Promise<SessionState> {
  promoteToAdmin(account.email, account.password)
  const login = await api.post(`${API_URL}/auth/login`, { data: { email: account.email, password: account.password } })
  const { mfaToken } = await login.json()
  if (!mfaToken) throw new Error(`login de admin sem desafio MFA (${login.status()}): ${await login.text()}`)
  const setup = await api.post(`${API_URL}/auth/mfa/setup`, { data: { mfaToken } })
  const { secret } = await setup.json()
  const confirm = await api.post(`${API_URL}/auth/mfa/confirm`, { data: { mfaToken, code: totp(secret) } })
  if (!confirm.ok()) throw new Error(`confirmação do MFA falhou (${confirm.status()}): ${await confirm.text()}`)
  return api.storageState()
}

// Gera um código de convite da empresa da sessão `api` (só o dono pode).
export async function apiCreateInvite(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${API_URL}/me/invites`)
  if (!res.ok()) throw new Error(`POST /me/invites falhou (${res.status()}): ${await res.text()}`)
  return (await res.json()).invite.code
}

// Aprova um anúncio pendente pela mesma rota que a UI de moderação usa.
// `admin` precisa ser uma sessão de admin com MFA (ver fixture `moderator`).
export async function apiApproveListing(admin: APIRequestContext, id: number): Promise<void> {
  const res = await admin.patch(`${API_URL}/admin/listings/${id}/moderate`, {
    data: { status: 'published' },
  })
  if (!res.ok()) {
    throw new Error(`PATCH /admin/listings/${id}/moderate falhou (${res.status()}): ${await res.text()}`)
  }
}

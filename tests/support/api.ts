import { execFileSync } from 'node:child_process'
import { request, type APIRequestContext } from '@playwright/test'
import { API_URL, APP_SERVER_PATH } from './env'

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

let seq = 0
export function uniqueStamp(): string {
  return `${Date.now()}${process.pid}${seq++}`
}

// O registerSchema do backend só valida formato/tamanho do CNPJ, não o
// dígito verificador real, então uma string aleatória de 14 dígitos serve.
export function buildAccount(overrides: Partial<TestAccount> = {}): TestAccount {
  const stamp = uniqueStamp()
  return {
    email: `e2e-${stamp}@example.com`,
    password: 'TesteSenha123',
    name: 'Ana Teste E2E',
    company: `Playwright E2E Materiais ${stamp}`,
    cnpj: randomDigits(14),
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
  const ctx = await request.newContext({ storageState: session })
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
      image: 'https://picsum.photos/seed/playwright/800/600',
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
  })
}

// Aprova um anúncio pendente pela mesma rota que a UI de moderação usa.
// `admin` precisa ser uma sessão de conta promovida (ver fixture `moderator`).
export async function apiApproveListing(admin: APIRequestContext, id: number): Promise<void> {
  const res = await admin.patch(`${API_URL}/admin/listings/${id}/moderate`, {
    data: { status: 'published' },
  })
  if (!res.ok()) {
    throw new Error(`PATCH /admin/listings/${id}/moderate falhou (${res.status()}): ${await res.text()}`)
  }
}

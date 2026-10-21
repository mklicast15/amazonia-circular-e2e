import type { APIResponse, Response } from '@playwright/test'
import { REMOTE } from './env'

// Orçamento do limite de login/cadastro da API (authLimiter: 10 por IP a cada 15 min).
// Localmente cada teste usa um IP falso (X-Forwarded-For) e o limite não incomoda; no
// staging todas as chamadas saem do mesmo IP. Cada resposta de /auth/* traz os cabeçalhos
// RateLimit-Remaining/RateLimit-Reset; guardamos o último valor e, antes de gastar
// chamadas, esperamos a janela zerar se não houver saldo. A suíte roda com 1 worker no
// staging, então um estado por processo basta.
let remaining: number | null = null
let resetAt = 0

type Headers = Record<string, string>

export function noteAuthHeaders(headers: Headers): void {
  const left = headers['ratelimit-remaining']
  const reset = headers['ratelimit-reset']
  if (left === undefined || reset === undefined) return
  remaining = Number(left)
  resetAt = Date.now() + Number(reset) * 1000
}

export async function noteAuthResponse(res: APIResponse | Response): Promise<void> {
  // Response (navegador) tem allHeaders(), que inclui os cabeçalhos não expostos ao JS da página.
  noteAuthHeaders('allHeaders' in res ? await res.allHeaders() : res.headers())
}

// Garante saldo para `n` chamadas de autenticação, esperando a janela zerar se preciso.
export async function reserveAuth(n: number, label = ''): Promise<void> {
  if (!REMOTE || remaining === null) return
  if (Date.now() >= resetAt) {
    remaining = null // janela nova: o saldo volta a ser o máximo
    return
  }
  if (remaining >= n) {
    remaining -= n
    return
  }
  const wait = resetAt - Date.now() + 2_000
  console.log(`[limite de login] saldo ${remaining}, preciso de ${n}${label ? ` (${label})` : ''}: esperando ${Math.ceil(wait / 1000)}s`)
  await new Promise((r) => setTimeout(r, wait))
  remaining = null
}

// Espera em caso de 429 do limite (ex.: saldo desconhecido no início da rodada).
export async function waitForRateLimit(res: APIResponse): Promise<boolean> {
  if (res.status() !== 429) return false
  const retry = Number(res.headers()['retry-after'] ?? 900)
  console.log(`[limite de login] 429: esperando ${retry}s`)
  await new Promise((r) => setTimeout(r, (retry + 2) * 1000))
  remaining = null
  return true
}

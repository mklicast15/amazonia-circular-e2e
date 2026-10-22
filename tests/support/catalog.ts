import { request, type APIRequestContext } from '@playwright/test'
import { apiApproveListing, apiCreateListing, apiRegister, buildAccount, clientIpHeaders } from './api'
import { API_URL } from './env'

// Catálogo fixo para os testes de marketplace e de paginação: 22 anúncios publicados de
// uma empresa no Floresta (sem limite de anúncios), com o marcador CATALOG_TOKEN no título —
// a busca por ele isola o catálogo de qualquer outro anúncio do ambiente. Fica de uma
// rodada para a outra: só cria o que faltar.
export const CATALOG_TOKEN = 'CatalogoQA'
export const CATALOG_SIZE = 22
const TYPES = ['PET', 'PEAD', 'PP', 'PEBD', 'PVC', 'PS', 'ABS', 'NYLON', 'ACRILICO'] as const
const CONDITIONS = ['limpo', 'contaminado', 'misto'] as const

export interface CatalogListing {
  id: number
  title: string
  plasticType: string
  condition: string
  quantityKg: number
}

// O catálogo como a API pública o devolve (até 100 por página — cabe numa chamada).
export async function fetchCatalog(): Promise<CatalogListing[]> {
  const api = await request.newContext()
  try {
    const res = await api.get(`${API_URL}/listings?search=${CATALOG_TOKEN}&page=1&pageSize=100`)
    return (await res.json()).listings
  } finally {
    await api.dispose()
  }
}

// `admin`: sessão de admin com MFA (aprova os anúncios e ativa o Floresta da empresa).
export async function ensureCatalog(admin: APIRequestContext): Promise<CatalogListing[]> {
  const existing = await fetchCatalog()
  if (existing.length >= CATALOG_SIZE) return existing

  const seller = await request.newContext({ extraHTTPHeaders: clientIpHeaders() })
  try {
    const account = buildAccount({ name: 'Catálogo QA (responsável)', company: `Catálogo QA ${new Date().toISOString().slice(0, 10)}` })
    await apiRegister(seller, account)
    const users = (await (await admin.get(`${API_URL}/admin/users`)).json()).users as Array<{ email: string; companyId: string }>
    const companyId = users.find((u) => u.email === account.email.toLowerCase())!.companyId
    const plan = await admin.patch(`${API_URL}/admin/companies/${companyId}/plan`, { data: { plan: 'FLORESTA', months: 12 } })
    if (!plan.ok()) throw new Error(`ativar Floresta do catálogo falhou (${plan.status()}): ${await plan.text()}`)

    for (let i = existing.length; i < CATALOG_SIZE; i++) {
      const type = TYPES[i % TYPES.length]
      const condition = CONDITIONS[i % CONDITIONS.length]
      const { id } = await apiCreateListing(seller, {
        title: `${CATALOG_TOKEN} ${String(i + 1).padStart(2, '0')} · ${type} ${condition}`,
        plasticType: type,
        condition,
        // Quantidades distintas e fora de ordem de criação: a ordenação por quantidade
        // tem que reordenar de verdade.
        quantityKg: 1000 + ((i * 7919) % 23) * 450,
        shortDescription: `Material do catálogo de QA (${type}, ${condition}).`,
      })
      await apiApproveListing(admin, id)
    }
  } finally {
    await seller.dispose()
  }
  return fetchCatalog()
}

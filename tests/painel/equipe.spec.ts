import { API_URL } from '../support/env'
import { apiCreateInvite } from '../support/api'
import { expect, gotoReady, row, test, type Actor } from '../support/fixtures'

test.describe('Painel — equipe', () => {
  let member: Actor

  // Dono = fixture `account` (criou a empresa, navegador padrão). Membro =
  // conta que entrou na mesma empresa com um convite do dono, em navegador próprio.
  test.beforeEach(async ({ context, account: _owner, newActor }) => {
    const inviteCode = await apiCreateInvite(context.request)
    member = await newActor({ name: 'Membro Teste E2E', inviteCode })
  })

  test('TC-EQP-01: o responsável remove um membro da equipe', async ({ page, account: owner }) => {
    await gotoReady(page, '/painel/team')
    await expect(row(page, owner.email).locator('.team-owner-badge')).toHaveText('Responsável')

    await row(page, member.account.email).getByRole('button', { name: 'Remover' }).click()
    const dialog = page.locator('.confirm-dialog')
    await expect(dialog).toContainText('Remover membro')
    await dialog.getByRole('button', { name: 'Remover', exact: true }).click()

    await expect(row(page, member.account.email)).toHaveCount(0)
  })

  test('TC-EQP-02: membro que não é o responsável não convida nem remove', async () => {
    await gotoReady(member.page, '/painel/team')

    await expect(member.page.getByText('Somente o responsável pela empresa pode convidar ou remover membros.')).toBeVisible()
    await expect(member.page.getByRole('button', { name: 'Gerar código de convite' })).toHaveCount(0)
    await expect(member.page.getByRole('button', { name: 'Remover' })).toHaveCount(0)
    expect((await member.api.post(`${API_URL}/me/invites`)).status()).toBe(403)
  })

  test('TC-EQP-03: membro removido vê o aviso e só pode baixar os dados ou excluir a conta', async ({ context, account: _owner }) => {
    const removed = await context.request.delete(`${API_URL}/me/team/${await memberId()}`)
    expect(removed.status()).toBe(204)

    await gotoReady(member.page, '/painel/listings')
    const notice = member.page.getByRole('alertdialog', { name: 'Você foi removido da empresa' })
    await expect(notice).toBeVisible()
    await expect(notice.getByRole('button', { name: 'Baixar meus dados' })).toBeVisible()

    // A API bloqueia o resto, mas ainda deixa exportar os dados (LGPD).
    const blocked = await member.api.get(`${API_URL}/me/listings`)
    expect(blocked.status()).toBe(403)
    expect((await blocked.json()).code).toBe('REMOVED_FROM_COMPANY')
    expect((await member.api.get(`${API_URL}/me/export`)).status()).toBe(200)

    await notice.getByRole('button', { name: 'Excluir minha conta' }).click()
    await member.page.locator('.confirm-dialog').last().getByRole('button', { name: 'Excluir definitivamente' }).click()
    await expect(notice).toHaveCount(0)
    await expect(member.page).toHaveURL((url) => url.pathname === '/')
  })

  async function memberId(): Promise<string> {
    return (await (await member.api.get(`${API_URL}/auth/me`)).json()).user.id
  }
})

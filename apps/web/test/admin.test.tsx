import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminApi, type AdminApi } from '../src/api/admin'
import { Admin } from '../src/pages/Admin'

const TOKEN = 'test-admin-token-0123456789abcdef-32'
const PLAYER = {
  player: { id: '11111111-2222-4333-8444-555555555555', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', level: 3, trophies: 120, earningUnlocked: true, bannedAt: null, banReason: null, referrerId: null, createdAtMs: 0 },
  balance: { tokenWei: '5000000000000000000', depositedWei: '0', withdrawnWei: '0', spentWei: '0', earnedWei: '2000000000000000000' },
  sp: { total: 12, today: 12 },
}

function fakeAdmin(over: Partial<AdminApi> = {}): AdminApi {
  return {
    player: vi.fn(async () => PLAYER),
    playerByAddress: vi.fn(async () => PLAYER),
    ban: vi.fn(async () => ({ ok: true as const })),
    unban: vi.fn(async () => ({ ok: true as const })),
    seasonSummary: vi.fn(async () => ({ season: { id: 1, startsAtMs: 0, endsAtMs: 1, commitHash: '0x', revealedSecret: null }, closedAt: null, inflows: { totalWei: '10', bySource: { spend: '10' } }, poolWei: '3', standingsCount: 1, prizesPaidWei: '0' })),
    closeSeason: vi.fn(async () => ({ closed: [1] })),
    revealSeason: vi.fn(async () => ({ seasonId: 1, secret: '0x' })),
    recordInflow: vi.fn(async () => ({ ok: true as const, seasonId: 1 })),
    setPrice: vi.fn(async () => ({ ok: true as const, microUsdPerToken: '50000' })),
    runJob: vi.fn(async () => ({ job: 'seasonClose', result: { closed: [], busy: false } })),
    stats: vi.fn(async () => ({ players: 1, earningUnlocked: 1, banned: 0, actions24h: 0, openVouchers: 0 })),
    ...over,
  } as unknown as AdminApi
}

beforeEach(() => sessionStorage.clear())

describe('Admin page', () => {
  it('asks for the token first and keeps it in sessionStorage only', async () => {
    render(<Admin makeApi={() => fakeAdmin()} />)
    expect(screen.getByLabelText(/admin token/i)).toBeInTheDocument()
    expect(screen.queryByRole('tab')).toBeNull()
    await userEvent.type(screen.getByLabelText(/admin token/i), TOKEN)
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(await screen.findAllByRole('tab')).not.toHaveLength(0)
    expect(sessionStorage.getItem('dris.admin')).toBe(TOKEN)
    expect(localStorage.getItem('dris.admin')).toBeNull()
  })

  it('looks a player up and bans with a reason', async () => {
    sessionStorage.setItem('dris.admin', TOKEN)
    const api = fakeAdmin()
    render(<Admin makeApi={() => api} />)
    await userEvent.type(await screen.findByLabelText(/player id or address/i), PLAYER.player.address)
    await userEvent.click(screen.getByRole('button', { name: /look up/i }))
    expect(api.playerByAddress).toHaveBeenCalledWith(PLAYER.player.address)
    expect((await screen.findByText('Earned')).closest('dt')!.nextElementSibling).toHaveTextContent('2 DRIS')
    const ban = screen.getByRole('button', { name: /^ban$/i })
    expect(ban).toBeDisabled() // no reason yet
    await userEvent.type(screen.getByLabelText(/reason/i), 'multi-accounting')
    await userEvent.click(ban)
    expect(api.ban).toHaveBeenCalledWith(PLAYER.player.id, 'multi-accounting')
    await waitFor(() => expect(api.player).toHaveBeenCalledWith(PLAYER.player.id)) // reloaded after the ban
    expect(await screen.findByRole('status')).toHaveTextContent('"ok": true')
  })

  it('closes a season only after confirming', async () => {
    sessionStorage.setItem('dris.admin', TOKEN)
    const api = fakeAdmin()
    render(<Admin makeApi={() => api} />)
    await userEvent.click(await screen.findByRole('tab', { name: /season/i }))
    await userEvent.type(screen.getByLabelText(/season id/i), '1')
    await userEvent.click(screen.getByRole('button', { name: /load/i }))
    await screen.findByText(/pool/i)
    await userEvent.click(screen.getByRole('button', { name: /close now/i }))
    expect(api.closeSeason).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /yes, close/i }))
    await waitFor(() => expect(api.closeSeason).toHaveBeenCalledWith(1))
    expect(await screen.findByRole('status')).toHaveTextContent('"closed"') // reply stays under the buttons
    await waitFor(() => expect(api.seasonSummary).toHaveBeenCalledTimes(2)) // summary refreshed
  })

  it('createAdminApi sends the token header to the admin routes', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }))
    const api = createAdminApi('/api', TOKEN, fetchImpl as unknown as typeof fetch)
    await api.stats()
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/admin/stats')
    expect((init.headers as Headers).get('x-admin-token')).toBe(TOKEN)
  })
})

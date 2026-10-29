import { newPlayer } from '@wyrmhaven/game-core'
import type { LeaderboardResponse, ReferralMeResponse } from '@wyrmhaven/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { ApiError, createApi, type Api } from '../src/api/client'
import { deviceId } from '../src/api/device'
import { sessionStore } from '../src/api/session'
import { ReferralPanel } from '../src/panels/ReferralPanel'
import { SeasonPanel } from '../src/panels/SeasonPanel'
import { ME_KEY } from '../src/state/me'
import { ToastProvider } from '../src/ui/Toast'

const E18 = 10n ** 18n
const ME = '11111111-2222-4333-8444-555555555555'
const season = { id: 2, startsAtMs: 0, endsAtMs: 14 * 86_400_000, commitHash: `0x${'ab'.repeat(32)}` as const, revealedSecret: null }

function harness(api: Record<string, unknown>, seasonId = 2) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(ME_KEY, { playerId: ME, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', state: newPlayer(0), balanceWei: 0n, earningUnlocked: true, banned: false, season: { ...season, id: seasonId } })
  sessionStore.set({ token: 't', playerId: ME, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' })
  const wrap = (ui: ReactNode) => render(<QueryClientProvider client={qc}><ApiProvider api={api as unknown as Api}><ToastProvider>{ui}</ToastProvider></ApiProvider></QueryClientProvider>)
  return { wrap }
}

describe('SeasonPanel leaderboard and prizes', () => {
  it('renders the top rows, the caller rank, the pool and last season’s prize', async () => {
    const board: LeaderboardResponse = {
      seasonId: 2, poolWei: (300n * E18).toString(), closed: false,
      top: [
        { rank: 1, playerId: 'other', address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', sp: 900 },
        { rank: 2, playerId: ME, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', sp: 400 },
      ],
      me: { rank: 2, sp: 400, prizeWei: null },
    }
    const api = {
      sp: vi.fn(async () => ({ seasonId: 2, total: 400, today: 20, cap: 150 })),
      leaderboard: vi.fn(async () => board),
      prizeMe: vi.fn(async (id: number) => (id === 1 ? { prize: { wei: (7n * E18).toString(), tier: 1, rank: 5 } } : { prize: null })),
    }
    harness(api).wrap(<SeasonPanel nowMs={0} />)
    const list = await screen.findByRole('list', { name: /leaderboard/i })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent(/#1/)
    expect(rows[0]).toHaveTextContent(/900/)
    expect(rows[1]).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText(/your rank: #2/i)).toBeInTheDocument()
    expect(screen.getByText(/prize pool so far/i)).toHaveTextContent(/300/)
    await waitFor(() => expect(screen.getByText(/last season/i)).toHaveTextContent(/you won 7/i))
    expect(api.prizeMe).toHaveBeenCalledWith(1)
  })

  it('says Unranked without a rank and skips the prize lookup in season 1', async () => {
    const api = {
      sp: vi.fn(async () => ({ seasonId: 1, total: 0, today: 0, cap: 150 })),
      leaderboard: vi.fn(async () => ({ seasonId: 1, poolWei: '0', closed: false, top: [], me: { rank: null, sp: 0, prizeWei: null } })),
      prizeMe: vi.fn(),
    }
    harness(api, 1).wrap(<SeasonPanel nowMs={0} />)
    await screen.findByText(/unranked/i)
    expect(api.prizeMe).not.toHaveBeenCalled()
  })
})

describe('ReferralPanel', () => {
  it('shows the code and counts, claims a code, and disables claiming once referred', async () => {
    let me: ReferralMeResponse = { code: '11111111', referredCount: 2, earnedWei: (3n * E18).toString(), referrer: false }
    const api = {
      referralMe: vi.fn(async () => me),
      claimReferral: vi.fn(async (code: string) => { me = { ...me, referrer: true }; return { ok: true, code } }),
    }
    harness(api).wrap(<ReferralPanel />)
    expect(await screen.findByText('11111111')).toBeInTheDocument()
    expect(screen.getByText(/2 referred/i)).toHaveTextContent(/earned 3/i)
    await userEvent.type(screen.getByLabelText(/referral code/i), 'abcdef12')
    await userEvent.click(screen.getByRole('button', { name: /claim code/i }))
    expect(api.claimReferral).toHaveBeenCalledWith('abcdef12')
    await waitFor(() => expect(screen.getByRole('button', { name: /claim code/i })).toBeDisabled())
  })

  it('maps claim errors to plain copy', async () => {
    const api = {
      referralMe: vi.fn(async () => ({ code: '11111111', referredCount: 0, earnedWei: '0', referrer: false })),
      claimReferral: vi.fn(async () => { throw new ApiError(409, 'REFERRAL_AFTER_SPEND') }),
    }
    harness(api).wrap(<ReferralPanel />)
    await screen.findByText('11111111')
    await userEvent.type(screen.getByLabelText(/referral code/i), 'abcdef12')
    await userEvent.click(screen.getByRole('button', { name: /claim code/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/before your first purchase/i)
  })
})

describe('device id', () => {
  it('is stable and sent on every request', async () => {
    const a = deviceId()
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(deviceId()).toBe(a)
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
    const api = createApi({ baseUrl: '', getToken: () => null, onUnauthorized: () => {}, fetchImpl: fetchImpl as unknown as typeof fetch })
    await api.season()
    const headers = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers
    expect(headers.get('x-device-id')).toBe(a)
  })
})

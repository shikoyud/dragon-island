// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntrantState } from '../src/server/entrants'

const wallet = vi.hoisted(() => ({
  account: { address: undefined as `0x${string}` | undefined, isConnected: false },
  signMessageAsync: vi.fn(async () => '0xabcdef'),
}))

vi.mock('wagmi', () => ({
  useAccount: () => wallet.account,
  useSignMessage: () => ({ signMessageAsync: wallet.signMessageAsync }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}))
vi.mock('../src/wallet/config', () => ({ walletConfigured: true, openWalletModal: vi.fn() }))

import { WaitlistPanel, type WaitlistPanelProps } from '../src/components/waitlist/WaitlistPanel'

const NOW = new Date('2026-10-29T12:00:00Z')
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString()
const none = { openedAt: null, confirmedAt: null }
const done = { openedAt: iso(60_000), confirmedAt: iso(30_000) }

function entrant(over: Partial<EntrantState> = {}): EntrantState {
  return {
    handle: 'drake',
    name: 'Drake',
    avatarUrl: '',
    element: 'fire',
    refCode: 'abc123',
    inviteCount: 2,
    tasks: { follow: none, like: none, repost: none, comment: none },
    wallet: null,
    position: null,
    ...over,
  }
}

const allDone = { follow: done, like: done, repost: done, comment: done }

type Me = EntrantState | null
type Extra = Record<string, unknown | ((init?: RequestInit) => Response)>

/** Route fetch by path; `/api/me` returns `me` (null gives 401). Extra values are JSON or a Response factory. */
function mockFetch(me: Me | (() => Me), extra: Extra = {}) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path === '/api/me') {
      const current = typeof me === 'function' ? me() : me
      return current ? Response.json(current) : Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
    if (path in extra) {
      const v = extra[path]
      return typeof v === 'function' ? (v as (i?: RequestInit) => Response)(init) : Response.json(v)
    }
    if (path.endsWith('/open')) return Response.json({ openedAt: new Date().toISOString() })
    return Response.json({})
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const props: WaitlistPanelProps = {
  xHandle: 'wyrmhaven',
  postId: '1850000000000000000',
  siteUrl: 'https://wyrmhaven.test',
  minAccountAgeDays: 30,
}

beforeEach(() => {
  wallet.account = { address: undefined, isConnected: false }
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('WaitlistPanel', () => {
  it('shows the X step with a Connect X link carrying the ref code when signed out', async () => {
    mockFetch(null)
    render(<WaitlistPanel {...props} refCode="friend42" />)
    const link = await screen.findByRole('link', { name: /connect x/i })
    expect(link.getAttribute('href')).toBe('/api/auth/x?ref=friend42')
  })

  it('links Connect X without a ref when none is given', async () => {
    mockFetch(null)
    render(<WaitlistPanel {...props} />)
    const link = await screen.findByRole('link', { name: /connect x/i })
    expect(link.getAttribute('href')).toBe('/api/auth/x')
  })

  it('shows the too-new message for ?x=too_new', async () => {
    mockFetch(null)
    render(<WaitlistPanel {...props} xStatus="too_new" />)
    expect(await screen.findByText(/at least 30 days old/i)).toBeTruthy()
  })

  it('shows 2 done tasks and keeps Confirm disabled until 15 s after Open', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
    const fetchFn = mockFetch(entrant({ tasks: { follow: done, like: done, repost: none, comment: none } }))
    render(<WaitlistPanel {...props} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getAllByText(/^done$/i)).toHaveLength(2)
    expect(screen.getByText('Follow @wyrmhaven')).toBeTruthy()

    const row = screen.getByTestId('task-repost')
    const open = row.querySelector('a')!
    expect(open.getAttribute('href')).toBe('https://x.com/intent/retweet?tweet_id=1850000000000000000')
    const confirm = () => row.querySelector('button')!
    expect(confirm().disabled).toBe(true)

    await act(async () => {
      fireEvent.click(open)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetchFn).toHaveBeenCalledWith('/api/tasks/repost/open', expect.objectContaining({ method: 'POST' }))
    expect(confirm().disabled).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000)
    })
    expect(confirm().disabled).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500)
    })
    expect(confirm().disabled).toBe(false)
  })

  it('moves to the wallet step once all tasks are confirmed', async () => {
    mockFetch(entrant({ tasks: allDone }))
    render(<WaitlistPanel {...props} />)
    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeTruthy()
  })

  it('enables Join once a wallet is bound', async () => {
    mockFetch(entrant({ tasks: allDone, wallet: '0x1111111111111111111111111111111111111111' }))
    render(<WaitlistPanel {...props} />)
    const join = await screen.findByRole('button', { name: /join the waitlist/i })
    expect((join as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows the card and an X intent pointing at /c/<code> after joining', async () => {
    mockFetch(entrant({ tasks: allDone, wallet: '0x1111111111111111111111111111111111111111', position: 7 }))
    render(<WaitlistPanel {...props} />)
    const img = (await screen.findByRole('img', { name: /card/i })) as HTMLImageElement
    expect(img.getAttribute('src')).toMatch(/^\/api\/card\/abc123/)
    const post = screen.getByRole('link', { name: /post on x/i })
    const href = post.getAttribute('href')!
    expect(href.startsWith('https://x.com/intent/post?')).toBe(true)
    expect(href).toContain(encodeURIComponent('https://wyrmhaven.test/c/abc123'))
    expect(screen.getByText(/#7/)).toBeTruthy()
  })

  it('signs the checksummed message with the server nonce and posts address, signature and nonce', async () => {
    // wagmi may hand back a lowercase address; the message must carry the checksummed form.
    wallet.account = { address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed', isConnected: true }
    const fetchFn = mockFetch(entrant({ tasks: allDone }), { '/api/wallet/nonce': { nonce: 'n0nce' } })
    render(<WaitlistPanel {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: /sign message/i }))
    await waitFor(() =>
      expect(fetchFn).toHaveBeenCalledWith('/api/wallet', expect.objectContaining({ method: 'POST' })),
    )
    expect(wallet.signMessageAsync).toHaveBeenCalledWith({
      message: 'Wyrmhaven waitlist\nX: @drake\nAddress: 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed\nNonce: n0nce',
    })
    const call = fetchFn.mock.calls.find(([p]) => p === '/api/wallet')!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
      signature: '0xabcdef',
      nonce: 'n0nce',
    })
  })

  it('returns to the X step when the session expired at the nonce call', async () => {
    wallet.account = { address: '0x1111111111111111111111111111111111111111', isConnected: true }
    let me: Me = entrant({ tasks: allDone })
    mockFetch(() => me, {
      '/api/wallet/nonce': () => {
        me = null
        return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
      },
    })
    render(<WaitlistPanel {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: /sign message/i }))
    expect(await screen.findByRole('link', { name: /connect x/i })).toBeTruthy()
    expect(screen.getByText(/session expired/i)).toBeTruthy()
  })

  it('re-resolves the step when POST /api/wallet answers BAD_REQUEST (already joined elsewhere)', async () => {
    wallet.account = { address: '0x1111111111111111111111111111111111111111', isConnected: true }
    const joined = entrant({ tasks: allDone, wallet: '0x2222222222222222222222222222222222222222', position: 3 })
    let me: Me = entrant({ tasks: allDone })
    mockFetch(() => me, {
      '/api/wallet/nonce': { nonce: 'n0nce' },
      '/api/wallet': () => {
        me = joined
        return Response.json({ error: 'BAD_REQUEST' }, { status: 400 })
      },
    })
    render(<WaitlistPanel {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: /sign message/i }))
    expect(await screen.findByRole('img', { name: /card/i })).toBeTruthy()
  })

  it('rolls back the countdown and warns when opening a task fails', async () => {
    mockFetch(entrant(), {
      '/api/tasks/follow/open': () => Response.json({ error: 'RATE_LIMITED' }, { status: 429 }),
    })
    render(<WaitlistPanel {...props} />)
    const row = await screen.findByTestId('task-follow')
    fireEvent.click(row.querySelector('a')!)
    expect(await screen.findByText(/could not record/i)).toBeTruthy()
    expect(row.querySelector('button')!.textContent).toBe('Confirm')
  })
})

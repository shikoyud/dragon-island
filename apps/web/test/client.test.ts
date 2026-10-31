import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApi } from '../src/api/client'
import { messageFor } from '../src/api/errors'

type Call = { url: string; init: RequestInit }

function fakeFetch(responder: (call: Call) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>) {
  const calls: Call[] = []
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init }
    calls.push(call)
    const { status, body } = await responder(call)
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { impl, calls }
}

describe('createApi', () => {
  it('posts actions with the bearer token and idempotency key', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { state: { gold: 1 }, effects: [] } }))
    const api = createApi({ baseUrl: '/api', getToken: () => 'tok', onUnauthorized: () => {}, fetchImpl: f.impl })
    const r = await api.action({ type: 'collectGold', habitatId: 'h1' }, 'key-1')
    expect(r.effects).toEqual([])
    expect(f.calls[0]!.url).toBe('/api/actions')
    expect(f.calls[0]!.init.method).toBe('POST')
    expect(new Headers(f.calls[0]!.init.headers).get('authorization')).toBe('Bearer tok')
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual({ action: { type: 'collectGold', habitatId: 'h1' }, idempotencyKey: 'key-1' })
  })

  it('parses bigint fields at the boundary', async () => {
    const f = fakeFetch(() => ({
      status: 200,
      body: { playerId: 'p', address: '0xabc', state: {}, balanceWei: '123456789012345678901234567890', earningUnlocked: false, banned: false },
    }))
    const api = createApi({ baseUrl: '/api', getToken: () => 'tok', onUnauthorized: () => {}, fetchImpl: f.impl })
    const me = await api.me()
    expect(me.balanceWei).toBe(123456789012345678901234567890n)
  })

  it('throws ApiError with the server code', async () => {
    const f = fakeFetch(() => ({ status: 422, body: { error: 'PLOT_BUSY' } }))
    const api = createApi({ baseUrl: '/api', getToken: () => 'tok', onUnauthorized: () => {}, fetchImpl: f.impl })
    await expect(api.action({ type: 'harvest', plot: 0 }, 'k')).rejects.toMatchObject({ status: 422, code: 'PLOT_BUSY' })
    await expect(api.action({ type: 'harvest', plot: 0 }, 'k')).rejects.toBeInstanceOf(ApiError)
  })

  it('reports a 401 once for concurrent failures and rethrows', async () => {
    const onUnauthorized = vi.fn()
    const f = fakeFetch(() => ({ status: 401, body: { error: 'UNAUTHORIZED' } }))
    const api = createApi({ baseUrl: '/api', getToken: () => 'tok', onUnauthorized, fetchImpl: f.impl })
    const results = await Promise.allSettled([api.me(), api.offers(), api.pendingWithdraw()])
    expect(results.every(r => r.status === 'rejected')).toBe(true)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('sends withdrawals as decimal strings', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { voucherId: 'v', cumulativeWei: '5', grossWei: '5', deadlineMs: 1, signature: '0x00' } }))
    const api = createApi({ baseUrl: '/api', getToken: () => 'tok', onUnauthorized: () => {}, fetchImpl: f.impl })
    const v = await api.withdraw(5n)
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual({ grossWei: '5' })
    expect(v.grossWei).toBe(5n)
  })
})

describe('messageFor', () => {
  it('maps known codes to sentences and echoes unknown ones', () => {
    expect(messageFor('INSUFFICIENT_GOLD')).toMatch(/gold/i)
    expect(messageFor('INSUFFICIENT_GOLD')).not.toBe('INSUFFICIENT_GOLD')
    expect(messageFor('WHATEVER')).toBe('WHATEVER')
  })

  it('covers every game-core and server error code', () => {
    const codes = [
      'INVALID_ACTION', 'NOT_FOUND', 'INVALID_AMOUNT', 'INSUFFICIENT_GOLD', 'INSUFFICIENT_FOOD', 'MAX_LEVEL', 'LEVEL_CAP', 'LEVEL_TOO_LOW',
      'INVALID_PARENTS', 'OPPOSITE_BASICS', 'NO_FREE_BREEDER', 'BREEDER_EMPTY', 'NOT_READY', 'HATCHERY_FULL', 'NO_HABITAT_SLOT',
      'ELEMENT_MISMATCH', 'MAX_PLOTS', 'PLOT_BUSY', 'PLOT_EMPTY', 'LAST_DRAGONS', 'NOT_SELLABLE',
      'NOTHING_TO_SKIP', 'NO_TOKEN', 'INVALID_TEAM', 'NO_DEFENCE_TEAM', 'DAILY_CAP_REACHED', 'STAGE_LOCKED',
      'UNAUTHORIZED', 'INSUFFICIENT_TOKENS', 'BANNED', 'BETA_CLOSED', 'FORBIDDEN', 'OFFER_NOT_FOUND', 'OFFER_EXPIRED', 'VOUCHER_PENDING',
      'WITHDRAW_LIMIT', 'RATE_LIMITED', 'PRICE_UNAVAILABLE', 'WITHDRAWALS_DISABLED',
    ]
    for (const c of codes) expect(messageFor(c), c).not.toBe(c)
    expect(messageFor('OPPOSITE_BASICS')).toBe("Opposite Basics can't breed. Use a hybrid that carries one of them.")
    expect(messageFor('BETA_CLOSED')).toBe('Dragon Island is in a closed beta right now. Join the waitlist to get an invite.')
  })
})

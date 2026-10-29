import type {
  ActionLogEntry, ActionRequest, ActionResponse, ClientAction, MeResponse, NonceResponse, OffersResponse,
  LeaderboardResponse, PendingWithdrawResponse, PrizeResponse, ReferralClaimRequest, ReferralMeResponse, SeasonInfo, SpResponse, VerifyResponse, WithdrawResponse,
} from '@wyrmhaven/shared'
import { deviceId } from './device'

/** A server `{ error }` reply, mapped straight from the HTTP status and code (spec §19). */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code)
  }
}

export interface ApiOptions {
  baseUrl: string
  getToken: () => string | null
  /** Called once per burst of 401s; the caller clears the session and shows sign-in. */
  onUnauthorized: () => void
  fetchImpl?: typeof fetch
}

/** Wire types with bigint strings replaced by bigint. */
export type Me = Omit<MeResponse, 'balanceWei'> & { balanceWei: bigint }
export type Voucher = Omit<WithdrawResponse, 'cumulativeWei' | 'grossWei'> & { cumulativeWei: bigint; grossWei: bigint }

const toVoucher = (v: WithdrawResponse): Voucher => ({ ...v, cumulativeWei: BigInt(v.cumulativeWei), grossWei: BigInt(v.grossWei) })

export function createApi(opts: ApiOptions) {
  const fetchImpl = opts.fetchImpl ?? fetch
  let unauthorizedPending = false

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers = new Headers({ accept: 'application/json' })
    if (body !== undefined) headers.set('content-type', 'application/json')
    const token = opts.getToken()
    if (token) headers.set('authorization', `Bearer ${token}`)
    headers.set('x-device-id', deviceId())
    const res = await fetchImpl(`${opts.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    if (res.status === 204) return undefined as T
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const code = typeof json['error'] === 'string' ? json['error'] : `HTTP_${res.status}`
      if (res.status === 401 && !unauthorizedPending) {
        unauthorizedPending = true
        try {
          opts.onUnauthorized()
        } finally {
          queueMicrotask(() => { unauthorizedPending = false })
        }
      }
      throw new ApiError(res.status, code)
    }
    return json as T
  }

  return {
    nonce: () => call<NonceResponse>('GET', '/auth/nonce'),
    verify: (message: string, signature: `0x${string}`) => call<VerifyResponse>('POST', '/auth/verify', { message, signature }),
    logout: () => call<void>('POST', '/auth/logout'),
    me: async (): Promise<Me> => {
      const m = await call<MeResponse>('GET', '/me')
      return { ...m, balanceWei: BigInt(m.balanceWei) }
    },
    action: (action: ClientAction, idempotencyKey: string) =>
      call<ActionResponse>('POST', '/actions', { action, idempotencyKey } satisfies ActionRequest),
    sp: () => call<SpResponse>('GET', '/sp'),
    offers: () => call<OffersResponse>('GET', '/pvp/offers'),
    withdraw: async (grossWei: bigint) => toVoucher(await call<WithdrawResponse>('POST', '/withdraw', { grossWei: grossWei.toString() })),
    pendingWithdraw: async (): Promise<{ voucher: Voucher | null }> => {
      const p = await call<PendingWithdrawResponse>('GET', '/withdraw/pending')
      return { voucher: p.voucher ? toVoucher(p.voucher) : null }
    },
    season: () => call<SeasonInfo>('GET', '/season'),
    seasonById: (id: number) => call<SeasonInfo>('GET', `/season/${id}`),
    seasonActions: (id: number, playerId: string) =>
      call<{ actions: ActionLogEntry[] }>('GET', `/season/${id}/actions?playerId=${encodeURIComponent(playerId)}`),
    leaderboard: (id: number) => call<LeaderboardResponse>('GET', `/season/${id}/leaderboard`),
    prizeMe: (id: number) => call<PrizeResponse>('GET', `/season/${id}/prizes/me`),
    referralMe: () => call<ReferralMeResponse>('GET', '/referral/me'),
    claimReferral: (code: string) => call<{ ok: true }>('POST', '/referral/claim', { code } satisfies ReferralClaimRequest),
  }
}

export type Api = ReturnType<typeof createApi>

import type {
  ActionRequest, ActionResponse, ClientAction, MeResponse, NonceResponse, OffersResponse,
  PendingWithdrawResponse, VerifyResponse, WithdrawResponse,
} from '@wyrmhaven/shared'

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
  /** Called on a 428 TERMS_REQUIRED reply; the caller refreshes /me so the terms prompt shows. */
  onTermsRequired?: () => void
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
      if (res.status === 428 && code === 'TERMS_REQUIRED') opts.onTermsRequired?.()
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
    acceptTerms: (version: string) => call<{ ok: true }>('POST', '/me/terms', { version }),
    action: (action: ClientAction, idempotencyKey: string) =>
      call<ActionResponse>('POST', '/actions', { action, idempotencyKey } satisfies ActionRequest),
    offers: () => call<OffersResponse>('GET', '/pvp/offers'),
    withdraw: async (grossWei: bigint) => toVoucher(await call<WithdrawResponse>('POST', '/withdraw', { grossWei: grossWei.toString() })),
    pendingWithdraw: async (): Promise<{ voucher: Voucher | null }> => {
      const p = await call<PendingWithdrawResponse>('GET', '/withdraw/pending')
      return { voucher: p.voucher ? toVoucher(p.voucher) : null }
    },
  }
}

export type Api = ReturnType<typeof createApi>

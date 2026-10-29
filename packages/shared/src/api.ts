import type { BattleReport, Effect, OpponentSnapshot, PlayerState } from '@wyrmhaven/game-core'
import type { ClientAction } from './actions'

/** Bigints (wei, micro-USD) cross the wire as decimal strings. */
export type BigString = string

export interface ErrorResponse { error: string }

export interface NonceResponse { nonce: string }
export interface VerifyRequest { message: string; signature: `0x${string}` }
export interface VerifyResponse { token: string; playerId: string; address: `0x${string}` }

export interface SeasonInfo {
  id: number
  startsAtMs: number
  endsAtMs: number
  commitHash: `0x${string}`
  revealedSecret: `0x${string}` | null
}

export interface MeResponse {
  playerId: string
  address: `0x${string}`
  state: PlayerState
  balanceWei: BigString
  earningUnlocked: boolean
  banned: boolean
  season: SeasonInfo
}

export interface ActionRequest { action: ClientAction; idempotencyKey: string }
export interface ActionResponse {
  state: PlayerState
  effects: Effect[]
  battle?: BattleReport
  sp?: { awarded: number; today: number }
}

export interface SpResponse { seasonId: number; total: number; today: number; cap: number }

export interface LeaderboardRow { rank: number; playerId: string; address: `0x${string}`; sp: number }
export interface LeaderboardResponse {
  seasonId: number
  /** 30% of the season's vault inflows so far (final once `closed`). */
  poolWei: BigString
  closed: boolean
  top: LeaderboardRow[]
  /** Present when the request carried a session. `prizeWei` is set once the season has closed. */
  me?: { rank: number | null; sp: number; prizeWei: BigString | null }
}
export interface PrizeInfo { wei: BigString; tier: number | null; rank: number | null }
export interface PrizeResponse { prize: PrizeInfo | null }

export interface Offer { offerId: string; opponent: OpponentSnapshot; seedHex: `0x${string}` }
export interface OffersResponse { offers: Offer[] }

export interface WithdrawRequest { grossWei: BigString }
export interface WithdrawResponse {
  voucherId: string
  cumulativeWei: BigString
  grossWei: BigString
  deadlineMs: number
  signature: `0x${string}`
}
export interface PendingWithdrawResponse { voucher: WithdrawResponse | null }

export interface ActionLogEntry {
  nonce: BigString
  seedHex: `0x${string}`
  /** What the seed was derived from: `<player>:<nonce>` or `battle:<id>`; verify with HMAC-SHA256(S, label). */
  seedLabel: string
  action: unknown
  status: number
  createdAtMs: number
}

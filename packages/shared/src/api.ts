import type { BattleReport, Effect, OpponentSnapshot, Phase, PlayerState, PresetId } from '@wyrmhaven/game-core'
import type { ClientAction } from './actions'

/** Bigints (wei, micro-USD) cross the wire as decimal strings. */
export type BigString = string

export interface ErrorResponse { error: string }

export interface NonceResponse { nonce: string }
export interface VerifyRequest { message: string; signature: `0x${string}` }
export interface VerifyResponse { token: string; playerId: string; address: `0x${string}` }

/** GET /game (§1.5, A12). `revealedSecret` stays null until the game reveals it. */
export interface GameInfo {
  launchAtMs: number
  preset: PresetId
  day: number
  phase: Phase
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
  /** Terms version the player must accept before playing (POST /me/terms); null when nothing is due. */
  termsRequired: string | null
  game: GameInfo
}

export interface ActionRequest { action: ClientAction; idempotencyKey: string }
export interface ActionResponse {
  state: PlayerState
  effects: Effect[]
  battle?: BattleReport
}

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

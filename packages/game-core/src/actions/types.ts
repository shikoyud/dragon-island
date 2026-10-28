import type { BattleOutcome, PlayerMove } from '../battle/sim'
import type { Catalog } from '../catalog'
import type { Element } from '../elements'
import type { OpponentSnapshot } from '../matchmaking'
import type { Rng } from '../rng'
import type { CropId, PlayerState } from '../state'
import type { StoreItem } from '../store'

export type TeamIds = [string, string, string]

export type Action =
  | { type: 'collectGold'; habitatId: string }
  | { type: 'buildHabitat'; element: Element }
  | { type: 'upgradeHabitat'; habitatId: string }
  | { type: 'moveDragon'; dragonId: string; habitatId: string }
  | { type: 'feed'; dragonId: string }
  | { type: 'sellDragon'; dragonId: string }
  | { type: 'buyFarmPlot' }
  | { type: 'plant'; plot: number; crop: CropId }
  | { type: 'harvest'; plot: number }
  | { type: 'startBreed'; parentA: string; parentB: string }
  | { type: 'collectEgg'; nest: number }
  | { type: 'hatch'; slot: number }
  | { type: 'sellGold'; gold: number }
  | { type: 'buy'; item: StoreItem }
  | { type: 'setDefenceTeam'; dragonIds: TeamIds }
  /** `opponent` is built by the server from the other player's saved state, never taken from the client. */
  | { type: 'pvpBattle'; team: TeamIds; opponent: OpponentSnapshot; moves: PlayerMove[] }
  | { type: 'pveBattle'; stage: number; team: TeamIds; moves: PlayerMove[] }

export type ActionError = 'INVALID_ACTION' | 'NOT_FOUND' | 'INVALID_AMOUNT' | 'INSUFFICIENT_GOLD' | 'INSUFFICIENT_FOOD' | 'MAX_LEVEL'
  | 'LEVEL_TOO_LOW' | 'INVALID_PARENTS' | 'NO_FREE_NEST' | 'NEST_EMPTY' | 'NOT_READY' | 'HATCHERY_FULL'
  | 'NO_HABITAT_SLOT' | 'HABITAT_LIMIT' | 'ELEMENT_MISMATCH' | 'MAX_PLOTS' | 'PLOT_BUSY' | 'PLOT_EMPTY'
  | 'MAX_NESTS' | 'LAST_DRAGONS' | 'EARNING_LOCKED' | 'NO_HOARD' | 'SELL_LIMIT_REACHED' | 'NOTHING_TO_SKIP'
  | 'INVALID_TEAM' | 'ILLEGAL_MOVE' | 'MISSING_MOVES' | 'DAILY_CAP_REACHED' | 'STAGE_LOCKED'

/** Side effects the server settles after persisting the new state. */
export type Effect =
  | { type: 'charge'; microUsd: number }
  | { type: 'payout'; microUsd: number }
  /** Apply `trophyDelta` to the defending player (spec §11 defence win/loss). */
  | { type: 'defenceResult'; playerId: string; trophyDelta: number }

export type BattleReport = Extract<BattleOutcome, { ok: true }>

export type ActionResult =
  | { ok: true; state: PlayerState; effects: Effect[]; battle?: BattleReport }
  | { ok: false; error: ActionError }

export interface ActionCtx { nowMs: number; rng: Rng; catalog: Catalog }

export type Handler<T extends Action['type']> =
  (s: PlayerState, a: Extract<Action, { type: T }>, ctx: ActionCtx) => ActionResult

export const success = (state: PlayerState, effects: Effect[] = [], battle?: BattleReport): ActionResult =>
  battle ? { ok: true, state, effects, battle } : { ok: true, state, effects }
export const failure = (error: ActionError): ActionResult => ({ ok: false, error })

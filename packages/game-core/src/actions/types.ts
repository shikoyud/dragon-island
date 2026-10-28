import type { Catalog } from '../catalog'
import type { Element } from '../elements'
import type { Rng } from '../rng'
import type { CropId, PlayerState } from '../state'
import type { StoreItem } from '../store'

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

export type ActionError = 'NOT_FOUND' | 'INVALID_AMOUNT' | 'INSUFFICIENT_GOLD' | 'INSUFFICIENT_FOOD' | 'MAX_LEVEL'
  | 'LEVEL_TOO_LOW' | 'INVALID_PARENTS' | 'NO_FREE_NEST' | 'NEST_EMPTY' | 'NOT_READY' | 'HATCHERY_FULL'
  | 'NO_HABITAT_SLOT' | 'HABITAT_LIMIT' | 'ELEMENT_MISMATCH' | 'MAX_PLOTS' | 'PLOT_BUSY' | 'PLOT_EMPTY'
  | 'MAX_NESTS' | 'LAST_DRAGONS' | 'EARNING_LOCKED' | 'NO_HOARD' | 'SELL_LIMIT_REACHED' | 'NOTHING_TO_SKIP'

/** Token settlement the server performs after persisting the new state. */
export type Effect = { type: 'charge'; microUsd: number } | { type: 'payout'; microUsd: number }

export type ActionResult = { ok: true; state: PlayerState; effects: Effect[] } | { ok: false; error: ActionError }

export interface ActionCtx { nowMs: number; rng: Rng; catalog: Catalog }

export type Handler<T extends Action['type']> =
  (s: PlayerState, a: Extract<Action, { type: T }>, ctx: ActionCtx) => ActionResult

export const success = (state: PlayerState, effects: Effect[] = []): ActionResult => ({ ok: true, state, effects })
export const failure = (error: ActionError): ActionResult => ({ ok: false, error })

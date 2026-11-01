import type { BattleOutcome, PlayerMove } from '../battle/machine'
import type { Catalog } from '../catalog'
import type { Preset } from '../data/presets'
import type { Element } from '../elements'
import type { OpponentSnapshot } from '../matchmaking'
import type { Rarity } from '../rarity'
import type { Rng } from '../rng'
import type { BuildingRef, CropId, DecorationId, IslandId, Placement, PlayerState } from '../state'
import type { SkipTarget, StoreItem } from '../store'
import type { SpeedUpToken } from '../data/speedups'

export type TeamIds = [string, string, string]

export type Placeable =
  | { kind: 'habitat'; element: Element } | { kind: 'farm' } | { kind: 'grove' } | { kind: 'roost' } | { kind: 'decoration'; decoration: DecorationId }
export type MovableRef = BuildingRef | { type: 'decoration'; id: string }

export type Action =
  | { type: 'collectGold'; habitatId: string }
  | { type: 'claimGoal' }
  | { type: 'placeBuilding'; building: Placeable; placement: Placement }
  | { type: 'moveBuilding'; target: MovableRef; placement: Placement }
  | { type: 'removeDecoration'; id: string }
  | { type: 'startUpgrade'; building: BuildingRef }
  | { type: 'finishConstruction'; index: number }
  | { type: 'buyPlot'; island: IslandId; plot: number }
  | { type: 'buyBridge'; island: Exclude<IslandId, 'home'> }
  | { type: 'clearObstacle'; obstacleId: string }
  | { type: 'moveDragon'; dragonId: string; habitatId: string }
  | { type: 'feed'; dragonId: string }
  | { type: 'sellDragon'; dragonId: string }
  | { type: 'plant'; plot: number; crop: CropId }
  | { type: 'harvest'; plot: number }
  | { type: 'startBreed'; parentA: string; parentB: string }
  | { type: 'collectEgg'; breeder: number }
  | { type: 'hatch'; slot: number }
  | { type: 'buyBasic'; element: Element }
  | { type: 'buy'; item: StoreItem }
  /** R55: takes the token's real hours off a running timer; no $DRIS involved. */
  | { type: 'useSpeedUp'; token: SpeedUpToken; target: SkipTarget; index: number }
  | { type: 'setDefenceTeam'; dragonIds: TeamIds }
  /**
   * `opponent` is built by the server from a stored matchmaking offer, never taken
   * from the client body (a client-chosen snapshot could pick a trivial bot or aim
   * `defenceResult` at any player). The server must overwrite it before `applyAction`.
   */
  | { type: 'pvpBattle'; team: TeamIds; opponent: OpponentSnapshot; moves: PlayerMove[] }
  | { type: 'startTrial'; chapter: number; node: number; team: TeamIds }
  /** `index` is the `active.index` the caller believes it settles; another is NO_ACTIVE_TRIAL, so a stale tab can't forfeit the next Trial. */
  | { type: 'finishTrial'; moves: PlayerMove[]; index?: number }
  | { type: 'abandonTrial'; index?: number }

export type ActionError = 'INVALID_ACTION' | 'NOT_FOUND' | 'INVALID_AMOUNT' | 'INSUFFICIENT_GOLD' | 'INSUFFICIENT_FOOD' | 'MAX_LEVEL' | 'LEVEL_CAP'
  | 'LEVEL_TOO_LOW' | 'INVALID_PARENTS' | 'OPPOSITE_BASICS' | 'NO_FREE_BREEDER' | 'BREEDER_EMPTY' | 'NOT_READY' | 'HATCHERY_FULL'
  | 'NO_HABITAT_SLOT' | 'ELEMENT_MISMATCH' | 'MAX_PLOTS' | 'PLOT_BUSY' | 'PLOT_EMPTY'
  | 'LAST_DRAGONS' | 'NOT_SELLABLE' | 'NOTHING_TO_SKIP' | 'NO_TOKEN'
  | 'INVALID_TEAM' | 'NO_DEFENCE_TEAM' | 'DAILY_CAP_REACHED' | 'STAGE_LOCKED'
  | 'OUT_OF_BOUNDS' | 'OVERLAP' | 'BUILDERS_BUSY' | 'ISLAND_LOCKED' | 'NOT_OWNED' | 'PLOT_OWNED' | 'PLOT_NOT_ADJACENT' | 'WRONG_ISLAND' | 'UNDER_CONSTRUCTION' | 'CLEARS_BUSY'
  | 'AERIE_EXISTS' | 'GOAL_NOT_DONE' | 'NO_GOAL'
  | 'DRAGON_TIRED' | 'TRIAL_ACTIVE' | 'NO_ACTIVE_TRIAL' | 'IN_TRIAL' | 'NOTHING_TO_HEAL'

/** Side effects the server settles after persisting the new state. */
export type Effect =
  | { type: 'charge'; microUsd: number }
  /** Apply to the defending player with `applyTrophies` (floor 0); spec §11 defence win/loss. */
  | { type: 'defenceResult'; playerId: string; trophyDelta: number }

export type BattleReport = Extract<BattleOutcome, { ok: true }>

/**
 * What a settled Trial paid: `stars` are this battle's, `xp` is after the preset's `xpMult`. A loss or forfeit pays zeros.
 * The Boss drops are present only on the settle that paid them. `egg` names no species: R20 hides it until it hatches.
 */
export interface TrialResult {
  won: boolean; stars: 0 | 1 | 2 | 3; gold: number; food: number; xp: number; first: boolean
  tokens?: { token: SpeedUpToken; count: number }
  egg?: { rarity: Rarity; element: Element }
  champion?: true
  chestPull?: true
}

export type ActionResult =
  /** `battle` is absent when a battle was forfeited (short or illegal move list). `trial` is finishTrial's. */
  | { ok: true; state: PlayerState; effects: Effect[]; battle?: BattleReport; trial?: TrialResult }
  | { ok: false; error: ActionError }

export interface ActionCtx { nowMs: number; rng: Rng; catalog: Catalog; preset: Preset; /** Game day (§1.5); 1 is launch day. */ day: number }

export type Handler<T extends Action['type']> =
  (s: PlayerState, a: Extract<Action, { type: T }>, ctx: ActionCtx) => ActionResult

export const success = (state: PlayerState, effects: Effect[] = [], battle?: BattleReport, trial?: TrialResult): ActionResult =>
  ({ ok: true, state, effects, ...(battle ? { battle } : {}), ...(trial ? { trial } : {}) })
export const failure = (error: ActionError): ActionResult => ({ ok: false, error })

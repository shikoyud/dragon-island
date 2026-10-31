import type { BattleOutcome, PlayerMove } from '../battle/sim'
import type { Catalog } from '../catalog'
import type { Preset } from '../data/presets'
import type { Element } from '../elements'
import type { OpponentSnapshot } from '../matchmaking'
import type { Rng } from '../rng'
import type { BuildingRef, CropId, DecorationId, Placement, PlayerState } from '../state'
import type { StoreItem } from '../store'

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
  | { type: 'expandIsland' }
  | { type: 'unlockIsland' }
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
  | { type: 'setDefenceTeam'; dragonIds: TeamIds }
  /**
   * `opponent` is built by the server from a stored matchmaking offer, never taken
   * from the client body (a client-chosen snapshot could pick a trivial bot or aim
   * `defenceResult` at any player). The server must overwrite it before `applyAction`.
   */
  | { type: 'pvpBattle'; team: TeamIds; opponent: OpponentSnapshot; moves: PlayerMove[] }
  | { type: 'pveBattle'; stage: number; team: TeamIds; moves: PlayerMove[] }

export type ActionError = 'INVALID_ACTION' | 'NOT_FOUND' | 'INVALID_AMOUNT' | 'INSUFFICIENT_GOLD' | 'INSUFFICIENT_FOOD' | 'MAX_LEVEL' | 'LEVEL_CAP'
  | 'LEVEL_TOO_LOW' | 'INVALID_PARENTS' | 'OPPOSITE_BASICS' | 'NO_FREE_BREEDER' | 'BREEDER_EMPTY' | 'NOT_READY' | 'HATCHERY_FULL'
  | 'NO_HABITAT_SLOT' | 'ELEMENT_MISMATCH' | 'MAX_PLOTS' | 'PLOT_BUSY' | 'PLOT_EMPTY'
  | 'LAST_DRAGONS' | 'NOT_SELLABLE' | 'NOTHING_TO_SKIP'
  | 'INVALID_TEAM' | 'NO_DEFENCE_TEAM' | 'DAILY_CAP_REACHED' | 'STAGE_LOCKED'
  | 'OUT_OF_BOUNDS' | 'OVERLAP' | 'BUILDERS_BUSY' | 'ISLAND_LOCKED' | 'MAX_ISLAND' | 'WRONG_ISLAND' | 'UNDER_CONSTRUCTION'
  | 'NO_LEGENDARY' | 'MAX_EXPANSION' | 'AERIE_EXISTS' | 'GOAL_NOT_DONE' | 'NO_GOAL'

/** Side effects the server settles after persisting the new state. */
export type Effect =
  | { type: 'charge'; microUsd: number }
  /** Apply to the defending player with `applyTrophies` (floor 0); spec §11 defence win/loss. */
  | { type: 'defenceResult'; playerId: string; trophyDelta: number }

export type BattleReport = Extract<BattleOutcome, { ok: true }>

export type ActionResult =
  /** `battle` is absent when a battle was forfeited (short or illegal move list). */
  | { ok: true; state: PlayerState; effects: Effect[]; battle?: BattleReport }
  | { ok: false; error: ActionError }

export interface ActionCtx { nowMs: number; rng: Rng; catalog: Catalog; preset: Preset; /** Game day (§1.5); 1 is launch day. */ day: number }

export type Handler<T extends Action['type']> =
  (s: PlayerState, a: Extract<Action, { type: T }>, ctx: ActionCtx) => ActionResult

export const success = (state: PlayerState, effects: Effect[] = [], battle?: BattleReport): ActionResult =>
  battle ? { ok: true, state, effects, battle } : { ok: true, state, effects }
export const failure = (error: ActionError): ActionResult => ({ ok: false, error })

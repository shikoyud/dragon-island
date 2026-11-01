import type { TeamIds } from './actions/types'
import type { BattleDragonSpec } from './battle/stats'
import { HOME_OBSTACLES, HOME_START } from './data/island-start'
import type { SpeedUpToken } from './data/speedups'
import type { NodeKey } from './data/trials'
import type { Element } from './elements'
import { STARTING_PLOTS } from './plots'
import { utcDay, type DayCounter } from './time'

export type CropId = 'dragonBush' | 'emberWheat' | 'seaMelon' | 'thunderPumpkin' | 'frostBerries' | 'warlordPepper'

/** `xpFree`: bred from Commons alone, hatches for no XP (Q1 a). */
export interface Egg { speciesId: string; readyAtMs: number; xpFree?: boolean }
/**
 * `habitatId: null` = hatched and waiting in the hatchery.
 * `fatigue`: HP left when it was last written, regen counted from `atMs` (§6.3, R68). Absent = full.
 */
export interface Dragon { id: string; speciesId: string; level: number; /** Feeds toward the next level, 0..3 (§4.1). */ feeds: number; habitatId: string | null; fatigue?: { hp: number; atMs: number } }

/** A Trial as it stood when it started (R69): the battle runs from this, whatever the dragons do later. `index` names its seed. */
export interface ActiveTrial { chapter: number; node: number; team: TeamIds; specs: BattleDragonSpec[]; index: number; startedAtMs: number; replay: boolean }

export type IslandId = 'home' | 'isle2' | 'isle3' | 'isle4' | 'isle5' | 'isle6'
export type Facing = 0 | 1 | 2 | 3
export interface Placement { island: IslandId; col: number; row: number; facing: Facing }
export type HabitatElement = Element | 'aerie' // 'aerie' = the Golden Aerie (any element, §5.2)
export interface Habitat { id: string; element: HabitatElement; level: number; lastCollectedMs: number; placement: Placement }
export type BreederKind = 'mountain' | 'grove'
/** `hatchMs` is the unreduced time the egg takes once it reaches the Hatchery (§5.4). `xpFree`: see Egg. */
export interface BreederEgg { speciesId: string; readyAtMs: number; hatchMs: number; xpFree: boolean }
export interface Breeder { kind: BreederKind; egg: BreederEgg | null; level: number; placement: Placement }
export interface FarmPlot { crop: CropId | null; readyAtMs: number; level: number; placement: Placement }
export type DecorationId = 'stonePath' | 'picketFence' | 'flowerPatch' | 'emberLantern' | 'driftwoodBench' | 'hayCart' | 'shellFountain' | 'crystalCluster' | 'eggTotem' | 'moonwell' | 'boneArch' | 'skyShrine' | 'dawnObelisk' | 'starPool' | 'dragonColossus'
export interface Decoration { id: string; kind: DecorationId; placement: Placement }
export type ObstacleKind = 'ancientTree' | 'boulder' | 'largeRock' | 'tree' | 'smallRock' | 'bush'
export interface Obstacle { id: string; kind: ObstacleKind; island: IslandId; col: number; row: number }
export type BuildingRef = { type: 'habitat'; id: string } | { type: 'farm'; index: number } | { type: 'breeder'; index: number } | { type: 'hatchery' } | { type: 'roost' }
export type Construction =
  | { kind: 'build' | 'upgrade'; building: BuildingRef; readyAtMs: number }
  | { kind: 'clear'; obstacleId: string; readyAtMs: number }

/** Bumped when the saved shape changes; there is no save migration (R2). */
export const STATE_VERSION = 11

/** Counters the Goals read (§1.4, R37); each rises only when its action succeeds. */
export interface GoalStats { collects: number; harvests: number; feeds: number; breeds: number; hatches: number }

export interface PlayerState {
  version: number
  gold: number
  food: number
  xp: number
  level: number
  /** Roost tier 0..5; sets the dragon level cap (§4.2). */
  roostTier: number
  /** Where the Dragon Roost stands; null until it is built (§4.2). Its tier rises when the build finishes (R33). */
  roostPlacement: Placement | null
  dragons: Dragon[]
  habitats: Habitat[]
  breeders: Breeder[]
  hatchery: Egg[]
  hatcheryLevel: number
  /** The extra Hatchery slot bought from the store (§5.4, Q5 a). */
  hatcheryFifthSlot: boolean
  hatcheryPlacement: Placement
  decorations: Decoration[]
  /** `plots`: owned plot indices per island (§5.5), absent until the island opens. */
  islands: { unlocked: IslandId[]; plots: Partial<Record<IslandId, number[]>>; obstacles: Obstacle[] }
  constructions: Construction[]
  /** Speed-up tokens a clear dropped (§5.6), by size; Task 4 spends them. */
  speedUps: Record<SpeedUpToken, number>
  farms: FarmPlot[]
  /** Index of the Goal waiting to be claimed; the Goals' count means all are done (R36). */
  goalIndex: number
  goalStats: GoalStats
  /** True once the scripted first hybrid has been bred (§3.5). */
  firstHybridDone: boolean
  /** Dragon Book: species ids hatched or bought, starters first (§1.4, R22). */
  discovered: string[]
  nextId: number
  /** Saved 3-dragon team other players attack; cleared if a member is sold. */
  defenceTeam: [string, string, string] | null
  trophies: number
  /** PvP attacks today. */
  pvp: DayCounter
  /** Elemental Trials (§6.3). */
  pve: {
    /** Best stars per node; a node with stars is cleared (R71, R74). */
    stars: Record<NodeKey, 1 | 2 | 3>
    /** Replays started on game day `day`, per node (R73). */
    replays: { day: number; counts: Record<NodeKey, number> }
    active: ActiveTrial | null
    /** Trials settled so far; names the next seed. */
    battles: number
    chestPulls: number
    starredChapters: number[]
  }
}

const home = (cell: { col: number; row: number }): Placement => ({ island: 'home', col: cell.col, row: cell.row, facing: 0 })

export function newPlayer(nowMs: number): PlayerState {
  return {
    version: STATE_VERSION,
    gold: 1000, food: 50, xp: 0, level: 1, roostTier: 0, roostPlacement: null,
    dragons: [
      { id: 'd1', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' },
      { id: 'd2', speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h2' },
    ],
    habitats: [
      { id: 'h1', element: 'terra', level: 1, lastCollectedMs: nowMs, placement: home(HOME_START.terra) },
      { id: 'h2', element: 'flame', level: 1, lastCollectedMs: nowMs, placement: home(HOME_START.flame) },
    ],
    breeders: [{ kind: 'mountain', egg: null, level: 1, placement: home(HOME_START.mountain) }],
    hatchery: [],
    hatcheryLevel: 1,
    hatcheryFifthSlot: false,
    hatcheryPlacement: home(HOME_START.hatchery),
    decorations: [],
    islands: { unlocked: ['home'], plots: { home: [...STARTING_PLOTS] }, obstacles: HOME_OBSTACLES.map(o => ({ ...o })) },
    constructions: [],
    speedUps: { '15m': 0, '1h': 0, '3h': 0 },
    farms: [{ crop: null, readyAtMs: 0, level: 1, placement: home(HOME_START.farm) }],
    goalIndex: 0,
    goalStats: { collects: 0, harvests: 0, feeds: 0, breeds: 0, hatches: 0 },
    firstHybridDone: false,
    discovered: ['terra', 'flame'],
    nextId: 3,
    defenceTeam: null,
    trophies: 0,
    pvp: { day: utcDay(nowMs), count: 0 },
    pve: { stars: {}, replays: { day: 0, counts: {} }, active: null, battles: 0, chestPulls: 0, starredChapters: [] },
  }
}

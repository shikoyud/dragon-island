import type { Element } from './elements'
import { utcDay, type DayCounter } from './time'

export type CropId = 'dragonBush' | 'emberWheat' | 'seaMelon' | 'thunderPumpkin' | 'frostBerries' | 'warlordPepper'

export interface Egg { speciesId: string; readyAtMs: number }
/** `habitatId: null` = hatched and waiting in the hatchery. */
export interface Dragon { id: string; speciesId: string; level: number; /** Feeds toward the next level, 0..3 (§4.1). */ feeds: number; habitatId: string | null }

export type IslandId = 'home' | 'isle2' | 'isle3' | 'isle4' | 'isle5' | 'dawnspire'
export type Facing = 0 | 1 | 2 | 3
export interface Placement { island: IslandId; col: number; row: number; facing: Facing }
export type HabitatElement = Element | 'aerie' // 'aerie' = the Golden Aerie (any element, §5.2)
export interface Habitat { id: string; element: HabitatElement; level: number; lastCollectedMs: number; placement: Placement }
export interface Nest { egg: Egg | null; level: number; placement: Placement }
export interface FarmPlot { crop: CropId | null; readyAtMs: number; level: number; placement: Placement }
export type DecorationId = 'stonePath' | 'picketFence' | 'flowerPatch' | 'emberLantern' | 'driftwoodBench' | 'hayCart' | 'shellFountain' | 'crystalCluster' | 'eggTotem' | 'moonwell' | 'boneArch' | 'skyShrine' | 'dawnObelisk' | 'starPool' | 'dragonColossus'
export interface Decoration { id: string; kind: DecorationId; placement: Placement }
export type ObstacleKind = 'bush' | 'rock' | 'tree' | 'boulder' | 'ruin'
export interface Obstacle { id: string; kind: ObstacleKind; island: IslandId; col: number; row: number }
export type BuildingRef = { type: 'habitat'; id: string } | { type: 'farm'; index: number } | { type: 'nest'; index: number } | { type: 'hatchery' }
export type Construction =
  | { kind: 'build' | 'upgrade'; building: BuildingRef; readyAtMs: number }
  | { kind: 'clear'; obstacleId: string; readyAtMs: number }

/** Bumped when the saved shape changes; there is no save migration (R2). */
export const STATE_VERSION = 2

export interface PlayerState {
  version: number
  gold: number
  food: number
  xp: number
  level: number
  /** Roost tier 0..5; sets the dragon level cap (§4.2). */
  roostTier: number
  dragons: Dragon[]
  habitats: Habitat[]
  nests: Nest[]
  hatchery: Egg[]
  hatcheryLevel: number
  hatcheryPlacement: Placement
  decorations: Decoration[]
  islands: { homeStep: number; unlocked: IslandId[]; obstacles: Obstacle[] }
  constructions: Construction[]
  farms: FarmPlot[]
  /** Consecutive common results per element pair key. */
  pity: Record<string, number>
  tutorial: { breedDone: boolean; hatchDone: boolean }
  nextId: number
  /** Saved 3-dragon team other players attack; cleared if a member is sold. */
  defenceTeam: [string, string, string] | null
  trophies: number
  /** PvP attacks today. */
  pvp: DayCounter
  pve: { cleared: number; replays: DayCounter }
}

/** @deprecated Use hatcherySlots(s.hatcheryLevel); kept only until the web client migrates (Task 12). */
export const HATCHERY_SLOTS = 3

const home = (col: number, row: number): Placement => ({ island: 'home', col, row, facing: 0 })

export function newPlayer(nowMs: number): PlayerState {
  return {
    version: STATE_VERSION,
    gold: 1000, food: 50, xp: 0, level: 1, roostTier: 0,
    dragons: [
      { id: 'd1', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' },
      { id: 'd2', speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h2' },
    ],
    habitats: [
      { id: 'h1', element: 'terra', level: 1, lastCollectedMs: nowMs, placement: home(0, 0) },
      { id: 'h2', element: 'flame', level: 1, lastCollectedMs: nowMs, placement: home(5, 0) },
    ],
    nests: [{ egg: null, level: 1, placement: home(4, 8) }],
    hatchery: [],
    hatcheryLevel: 1,
    hatcheryPlacement: home(0, 8),
    decorations: [],
    islands: { homeStep: 0, unlocked: ['home'], obstacles: [] },
    constructions: [],
    farms: [{ crop: null, readyAtMs: 0, level: 1, placement: home(10, 0) }],
    pity: {},
    tutorial: { breedDone: false, hatchDone: false },
    nextId: 3,
    defenceTeam: null,
    trophies: 0,
    pvp: { day: utcDay(nowMs), count: 0 },
    pve: { cleared: 0, replays: { day: utcDay(nowMs), count: 0 } },
  }
}

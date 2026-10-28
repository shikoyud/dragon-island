import type { Element } from './elements'
import { utcDay, type DayCounter } from './time'

export type CropId = 'sprout' | 'bushel' | 'harvest' | 'bounty'

export interface Egg { speciesId: string; readyAtMs: number }
/** `habitatId: null` = hatched and waiting in the hatchery. */
export interface Dragon { id: string; speciesId: string; level: number; habitatId: string | null }
export interface Habitat { id: string; element: Element; level: number; lastCollectedMs: number }
export interface FarmPlot { crop: CropId | null; readyAtMs: number }

export interface PlayerState {
  gold: number
  /** Part of `gold` earned from habitats and battles; only this can be sold back. */
  eligibleGold: number
  food: number
  xp: number
  level: number
  dragons: Dragon[]
  habitats: Habitat[]
  nests: (Egg | null)[]
  hatchery: Egg[]
  farms: FarmPlot[]
  /** Consecutive common results per element pair key. */
  pity: Record<string, number>
  oddsBoosts: number
  hoardLevel: number
  earningUnlocked: boolean
  sell: { day: number; soldTodayMicroUsd: number }
  ledger: { depositedMicroUsd: number; withdrawnMicroUsd: number; soldMicroUsd: number }
  tutorial: { breedDone: boolean; hatchDone: boolean }
  nextId: number
  /** Saved 3-dragon team other players attack; cleared if a member is sold. */
  defenceTeam: [string, string, string] | null
  trophies: number
  /** PvP attacks today. */
  pvp: DayCounter
  pve: { cleared: number; replays: DayCounter }
}

export const HATCHERY_SLOTS = 3

export function newPlayer(nowMs: number): PlayerState {
  return {
    gold: 1000, eligibleGold: 0, food: 100, xp: 0, level: 1,
    dragons: [
      { id: 'd1', speciesId: 'fire', level: 1, habitatId: 'h1' },
      { id: 'd2', speciesId: 'water', level: 1, habitatId: 'h2' },
    ],
    habitats: [
      { id: 'h1', element: 'fire', level: 1, lastCollectedMs: nowMs },
      { id: 'h2', element: 'water', level: 1, lastCollectedMs: nowMs },
    ],
    nests: [null],
    hatchery: [],
    farms: [{ crop: null, readyAtMs: 0 }, { crop: null, readyAtMs: 0 }],
    pity: {}, oddsBoosts: 0, hoardLevel: 0, earningUnlocked: false,
    sell: { day: utcDay(nowMs), soldTodayMicroUsd: 0 },
    ledger: { depositedMicroUsd: 0, withdrawnMicroUsd: 0, soldMicroUsd: 0 },
    tutorial: { breedDone: false, hatchDone: false },
    nextId: 3,
    defenceTeam: null,
    trophies: 0,
    pvp: { day: utcDay(nowMs), count: 0 },
    pve: { cleared: 0, replays: { day: utcDay(nowMs), count: 0 } },
  }
}

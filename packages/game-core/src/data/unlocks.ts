// GDD §4.4 (unlock schedule), §5.2 (habitats), §5.3 (crops, farms), §5.4 (Hatchery, Mountain, Grove), §5.5 (islands).
// R32: PvE moves to PL 4, Islands 3-6 to PL 18, 25, 32, 40; Home expansions keep today's PLs until M4.
// PvP (pve.ts) and decorations keep their own gates until M6 and M7. This file is the only place a gate is a number.
import type { Element } from '../elements'
import type { CropId, IslandId } from '../state'

export type UnlockKey =
  | `habitat:${Element}` | `basic:${Element}` | `crop:${CropId}` | `farm:${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`
  | `mountain:${1 | 2 | 3}` | `grove:${1 | 2 | 3}` | `hatchery:${1 | 2 | 3 | 4}` | 'hatcheryFifthSlot'
  | `roost:${1 | 2 | 3 | 4 | 5}` | 'pve' | 'wings' | `home:${number}` | `island:${Exclude<IslandId, 'home'>}`

/** The level every player starts at; a gate with nothing to wait for reads this. */
export const START_PL = 1

/** §5.2 Unlock PL, shared by the habitat and by its Basic dragon (§4.4). */
const ELEMENT_PL: Readonly<Record<Element, number>> = {
  terra: 1, flame: 1, sea: 3, nature: 3, electric: 6, ice: 8, metal: 10, dark: 14, light: 16, war: 18,
}
/** §5.3, tier order. */
const CROP_PL: Readonly<Record<CropId, number>> = {
  dragonBush: 1, emberWheat: 3, seaMelon: 5, thunderPumpkin: 8, frostBerries: 12, warlordPepper: 15,
}
/** §5.3: PL 1, 3, 4 and 7, then one every 5 PL, up to 8. Index = farm number - 1. */
const FARM_PL: readonly number[] = [1, 3, 4, 7, 10, 15, 20, 25]
/** §5.4. Index = level - 1. */
const MOUNTAIN_PL: readonly number[] = [2, 10, 20]
const GROVE_PL: readonly number[] = [12, 20, 25]
const HATCHERY_PL: readonly number[] = [1, 4, 13, 21]
/** §4.4: Roost Tiers 1-5. */
const ROOST_PL: readonly number[] = [5, 10, 15, 22, 30]
/** Today's Home expansion gates, kept until M4 (R32). Index = homeStep before the purchase. */
const HOME_PL: readonly number[] = [2, 4, 7, 10, 14, 18, 22, 27, 32, 37, 42, 47]

const entries: [string, number][] = []
for (const [e, pl] of Object.entries(ELEMENT_PL)) entries.push([`habitat:${e}`, pl], [`basic:${e}`, pl])
for (const [c, pl] of Object.entries(CROP_PL)) entries.push([`crop:${c}`, pl])
FARM_PL.forEach((pl, i) => entries.push([`farm:${i + 1}`, pl]))
MOUNTAIN_PL.forEach((pl, i) => entries.push([`mountain:${i + 1}`, pl]))
GROVE_PL.forEach((pl, i) => entries.push([`grove:${i + 1}`, pl]))
HATCHERY_PL.forEach((pl, i) => entries.push([`hatchery:${i + 1}`, pl]))
entries.push(['hatcheryFifthSlot', 15]) // §5.4 "15+"
ROOST_PL.forEach((pl, i) => entries.push([`roost:${i + 1}`, pl]))
entries.push(['pve', 4], ['wings', 8])
HOME_PL.forEach((pl, i) => entries.push([`home:${i}`, pl]))
entries.push(['island:isle2', 12], ['island:isle3', 18], ['island:isle4', 25], ['island:isle5', 32], ['island:dawnspire', 40])

export const UNLOCKS: Readonly<Record<UnlockKey, number>> = Object.freeze(Object.fromEntries(entries)) as Record<UnlockKey, number>

const KEYS = Object.keys(UNLOCKS) as UnlockKey[]

/** The Player Level that opens `key`. */
export function unlockPl(key: UnlockKey): number {
  return UNLOCKS[key]!
}

export function isUnlocked(key: UnlockKey, level: number): boolean {
  return level >= UNLOCKS[key]!
}

/** Every key that opens at exactly `level`, in table order: for the level-up screen. */
export function unlocksAt(level: number): readonly UnlockKey[] {
  return KEYS.filter(k => UNLOCKS[k] === level)
}

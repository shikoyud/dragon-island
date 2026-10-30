import { CROPS, FARM_LEVELS, FIRST_FARM_GOLD } from './data/farms'
import type { Preset } from './data/presets'
import type { CropId } from './state'

export * from './data/farms'

/** Gold for farm `n` (1-based): 1,000 x 3^(n - 1). */
export function farmBuildGold(n: number): number {
  return FIRST_FARM_GOLD * 3 ** (n - 1)
}

/** Grow time under `preset` (classic / cropTimerDiv, floored: R10). */
export function cropGrowMs(crop: CropId, preset: Preset): number {
  return Math.floor(CROPS[crop].growClassicMs / preset.cropTimerDiv)
}

/** Food of one harvest: floor(food x cropYieldMult x farm yield percent / 100). */
export function cropFood(crop: CropId, farmLevel: number, preset: Preset): number {
  return Math.floor(CROPS[crop].food * preset.cropYieldMult * FARM_LEVELS[farmLevel - 1]!.yieldPct / 100)
}

export function cropUnlocked(crop: CropId, playerLevel: number): boolean {
  return playerLevel >= CROPS[crop].unlockPl
}

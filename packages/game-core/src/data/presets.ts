// GDD §7.2 (Flash soft economy) and §1.5 (Lifetime phases). Every number here comes from those tables.

export type PresetId = 'flash14' | 'flash28'

export interface Preset {
  id: PresetId
  /** Playable days (the finals end on this day). */
  days: number
  /** Dragon Gold/min and habitat caps. */
  goldMult: number
  cropYieldMult: number
  cropTimerDiv: number
  /** Breed, hatch and build timers. */
  timerDiv: number
  xpMult: number
  healPctPerMin: number
  arenaEnergyRegenMs: number
  /** Inclusive day ranges (§1.5). */
  phases: {
    rush: [number, number]
    endgame: [number, number]
    finals: [number, number]
    settlement: [number, number]
  }
}

export const FLASH_14: Preset = {
  id: 'flash14',
  days: 14,
  goldMult: 10,
  cropYieldMult: 12,
  cropTimerDiv: 2,
  timerDiv: 6,
  xpMult: 12,
  healPctPerMin: 6,
  arenaEnergyRegenMs: 3_600_000,
  phases: { rush: [1, 4], endgame: [5, 12], finals: [13, 14], settlement: [15, 21] },
}

export const FLASH_28: Preset = {
  id: 'flash28',
  days: 28,
  goldMult: 6,
  cropYieldMult: 8,
  cropTimerDiv: 1.5,
  timerDiv: 4,
  xpMult: 8,
  healPctPerMin: 4,
  arenaEnergyRegenMs: 5_400_000,
  phases: { rush: [1, 7], endgame: [8, 25], finals: [26, 28], settlement: [29, 35] },
}

export const PRESETS: Record<PresetId, Preset> = { flash14: FLASH_14, flash28: FLASH_28 }

/** Flash-14 is the default preset; Flash-28 is data, never a code path (§7.2). */
export const DEFAULT_PRESET: Preset = FLASH_14

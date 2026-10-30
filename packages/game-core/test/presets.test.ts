import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESET, FLASH_14, FLASH_28, PRESETS } from '../src/data/presets'

describe('presets (GDD 7.2, 1.5)', () => {
  it('FLASH_14 is the 7.2 Flash-14 column', () => {
    expect(FLASH_14).toEqual({
      id: 'flash14', days: 14, goldMult: 10, cropYieldMult: 12, cropTimerDiv: 2, timerDiv: 6,
      xpMult: 12, healPctPerMin: 6, arenaEnergyRegenMs: 3_600_000,
      phases: { rush: [1, 4], endgame: [5, 12], finals: [13, 14], settlement: [15, 21] },
    })
  })
  it('FLASH_28 is the 7.2 Flash-28 column', () => {
    expect(FLASH_28).toEqual({
      id: 'flash28', days: 28, goldMult: 6, cropYieldMult: 8, cropTimerDiv: 1.5, timerDiv: 4,
      xpMult: 8, healPctPerMin: 4, arenaEnergyRegenMs: 5_400_000,
      phases: { rush: [1, 7], endgame: [8, 25], finals: [26, 28], settlement: [29, 35] },
    })
  })
  it('registers both presets and defaults to Flash-14', () => {
    expect(PRESETS).toEqual({ flash14: FLASH_14, flash28: FLASH_28 })
    expect(DEFAULT_PRESET).toBe(FLASH_14)
  })
})

import { describe, expect, it } from 'vitest'
import { breedTimerMs } from '../src/data/breeding-timers'
import { FLASH_14, FLASH_28 } from '../src/data/presets'

describe('§3.5 breeding timers', () => {
  it('matches the Flash-14 table', () => {
    expect(breedTimerMs('common', ['terra'], FLASH_14)).toBe(5_000)
    expect(breedTimerMs('common', ['dark'], FLASH_14)).toBe(600_000)
    expect(breedTimerMs('uncommon', ['terra', 'ice'], FLASH_14)).toBe(600_000)
    expect(breedTimerMs('rare', ['war'], FLASH_14)).toBe(4_800_000)
    expect(breedTimerMs('epic', ['electric'], FLASH_14)).toBe(10_800_000)
    expect(breedTimerMs('legendary', ['terra'], FLASH_14)).toBe(28_800_000)
  })

  it('uses the highest tier of the offspring', () => {
    expect(breedTimerMs('rare', ['terra', 'war'], FLASH_14)).toBe(4_800_000)
    expect(breedTimerMs('rare', ['terra', 'flame'], FLASH_14)).toBe(2_400_000)
  })

  it('divides by the preset timer divisor (Flash-28 is classic / 4)', () => {
    expect(breedTimerMs('epic', ['electric'], FLASH_28)).toBe(16_200_000)
  })
})

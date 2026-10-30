import { describe, expect, it } from 'vitest'
import { FLASH_14, FLASH_28 } from '../src/data/presets'
import { cropFood, cropGrowMs, cropUnlocked, farmBuildGold } from '../src/farm'

describe('farm rules', () => {
  it('divides the grow time by the preset and floors (R10)', () => {
    expect(cropGrowMs('dragonBush', FLASH_14)).toBe(15_000)
    expect(cropGrowMs('emberWheat', FLASH_28)).toBe(200_000)
    expect(cropGrowMs('dragonBush', FLASH_28)).toBe(20_000)
    expect(cropGrowMs('warlordPepper', FLASH_28)).toBe(57_600_000)
  })

  it('multiplies food by the preset and the farm level, floored', () => {
    expect(cropFood('seaMelon', 1, FLASH_14)).toBe(1440)
    expect(cropFood('seaMelon', 5, FLASH_14)).toBe(2880)
    expect(cropFood('seaMelon', 2, FLASH_28)).toBe(1200)
    expect(cropFood('dragonBush', 2, FLASH_14)).toBe(75)
    expect(cropFood('dragonBush', 4, FLASH_28)).toBe(70)
  })

  it('triples the farm price per farm from 1,000', () => {
    expect([1, 2, 3, 4, 8].map(farmBuildGold)).toEqual([1_000, 3_000, 9_000, 27_000, 2_187_000])
  })

  it('unlocks crops by player level', () => {
    expect(cropUnlocked('dragonBush', 1)).toBe(true)
    expect(cropUnlocked('emberWheat', 2)).toBe(false)
    expect(cropUnlocked('emberWheat', 3)).toBe(true)
    expect(cropUnlocked('warlordPepper', 14)).toBe(false)
    expect(cropUnlocked('warlordPepper', 15)).toBe(true)
  })
})

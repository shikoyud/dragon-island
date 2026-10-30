import { describe, expect, it } from 'vitest'
import { goldPerMinuteX20 } from '../src/dragon'
import { ELEMENTS } from '../src/elements'
import {
  GOLDEN_AERIE, HABITAT_BUILD_CLASSIC_MS, HABITAT_CAPACITY, HABITAT_L5_USD_MICRO, HABITAT_UPGRADE_CLASSIC_MS, HABITATS,
  habitatBuildMs, habitatCap, habitatCapClassic, habitatUpgradeGold, habitatUpgradeMs,
} from '../src/data/habitats'
import { FLASH_14, FLASH_28 } from '../src/data/presets'

describe('§5.2 habitat table (classic values)', () => {
  it('pins the Terra and War rows', () => {
    expect(HABITATS.terra).toEqual({ archetype: 'sprinter', base: 18, inc: 12, capL1: 8_000, capL2: 28_000, buildGold: 500, upgradeL2Gold: 10_000 })
    expect(HABITATS.war).toEqual({ archetype: 'vault', base: 7, inc: 4, capL1: 33_000, capL2: 115_000, buildGold: 250_000, upgradeL2Gold: 750_000 })
  })

  it('pins every row: base, inc, caps, build gold, upgrade gold', () => {
    const rows = ELEMENTS.map(e => [e, HABITATS[e].base, HABITATS[e].inc, HABITATS[e].capL1, HABITATS[e].capL2, HABITATS[e].buildGold, HABITATS[e].upgradeL2Gold])
    expect(rows).toEqual([
      ['terra', 18, 12, 8_000, 28_000, 500, 10_000],
      ['flame', 7, 5, 10_000, 35_000, 2_000, 20_000],
      ['sea', 10, 7, 14_000, 49_000, 5_000, 40_000],
      ['nature', 9, 7, 18_000, 64_000, 10_000, 60_000],
      ['electric', 15, 10, 10_000, 35_000, 25_000, 100_000],
      ['ice', 8, 6, 23_000, 83_000, 40_000, 150_000],
      ['metal', 9, 6, 24_000, 84_000, 60_000, 200_000],
      ['dark', 6, 4, 32_000, 112_000, 150_000, 500_000],
      ['light', 8, 5, 27_000, 94_000, 200_000, 600_000],
      ['war', 7, 4, 33_000, 115_000, 250_000, 750_000],
    ])
    expect(ELEMENTS.map(e => HABITATS[e].archetype)).toEqual(
      ['sprinter', 'standard', 'standard', 'standard', 'sprinter', 'steady', 'steady', 'vault', 'steady', 'vault'])
  })

  it('has capacities 2..6 and the L5 prices per tier', () => {
    expect(HABITAT_CAPACITY).toEqual([2, 3, 4, 5, 6])
    expect(HABITAT_L5_USD_MICRO).toEqual({ A: 1_500_000, B: 2_500_000, C: 4_000_000 })
    expect(GOLDEN_AERIE).toEqual({ usdMicro: 5_000_000, capacity: 6, capMult: 3, capOf: 'war' })
  })

  it('has the A5 timers', () => {
    expect(HABITAT_BUILD_CLASSIC_MS).toEqual({ A: 600_000, B: 3_600_000, C: 14_400_000 })
    expect(HABITAT_UPGRADE_CLASSIC_MS).toEqual([3_600_000, 14_400_000, 43_200_000, 0])
  })
})

describe('caps (R3, R4)', () => {
  it('uses the literal L1/L2 values and the GDD multipliers with floor above', () => {
    expect([1, 2, 3, 4, 5].map(l => habitatCapClassic('terra', l))).toEqual([8_000, 28_000, 98_000, 343_200, 1_200_000])
    expect(habitatCapClassic('electric', 3)).toBe(122_500)
    expect(habitatCapClassic('sea', 3)).toBe(171_500)
    expect(habitatCapClassic('sea', 4)).toBe(600_600)
    expect(habitatCapClassic('ice', 4)).toBe(986_700)
  })
  it('scales by the preset', () => {
    expect(habitatCap('terra', 1, FLASH_14)).toBe(80_000)
    expect(habitatCap('terra', 1, FLASH_28)).toBe(48_000)
  })
  it('the Golden Aerie caps at 3 x War L1 at any level (R3)', () => {
    expect(habitatCapClassic('aerie', 5)).toBe(99_000)
    expect(habitatCap('aerie', 5, FLASH_14)).toBe(990_000)
  })
})

describe('upgrade costs and timers', () => {
  it('L3 = L2 x 4, L4 = L2 x 16', () => {
    expect([2, 3, 4].map(l => habitatUpgradeGold('terra', l as 2 | 3 | 4))).toEqual([10_000, 40_000, 160_000])
    expect(habitatUpgradeGold('war', 4)).toBe(12_000_000)
  })
  it('build and upgrade timers divide by the preset (A5)', () => {
    expect(habitatBuildMs('dark', FLASH_14)).toBe(2_400_000)
    expect(habitatBuildMs('terra', FLASH_14)).toBe(100_000)
    expect(habitatBuildMs('electric', FLASH_28)).toBe(900_000)
    expect([2, 3, 4, 5].map(l => habitatUpgradeMs(l, FLASH_14))).toEqual([600_000, 2_400_000, 7_200_000, 0])
    expect(habitatUpgradeMs(2, FLASH_28)).toBe(900_000)
  })
})

describe('§5.1 income in twentieths (R7)', () => {
  it('Terra Common at Lv 1, 5 and 15 in Flash-14', () => {
    expect(goldPerMinuteX20('terra', 'common', 1, FLASH_14)).toBe(3_600)
    expect(goldPerMinuteX20('terra', 'common', 5, FLASH_14)).toBe(13_200)
    expect(goldPerMinuteX20('terra', 'common', 15, FLASH_14)).toBe(31_200)
  })
  it('a Flame Legendary at Lv 40 in Flash-28', () => {
    expect(goldPerMinuteX20('flame', 'legendary', 40, FLASH_28)).toBe(38_100)
  })
  it('applies the rarity multipliers exactly', () => {
    const at = (r: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary') => goldPerMinuteX20('war', r, 1, FLASH_14)
    expect([at('common'), at('uncommon'), at('rare'), at('epic'), at('legendary')]).toEqual([1_400, 1_680, 2_100, 2_800, 3_500])
  })
  it('keeps the half Inc after Lv 10 exact', () => {
    expect(goldPerMinuteX20('flame', 'common', 11, FLASH_14)).toBe(10 * (14 + 90 + 5) * 10)
  })
})

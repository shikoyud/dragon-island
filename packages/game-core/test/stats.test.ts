import { describe, expect, it } from 'vitest'
import { ATK_AT_40, GPM_RARITY_MULT_TENTHS, HP_AT_40 } from '../src/data/stats'
import { HATCH_XP } from '../src/data/xp'
import { SELL_GOLD } from '../src/data/sell'
import { atkAt, hpAt, statAt } from '../src/rarity'
import { RARITIES } from '../src/rarity'

describe('§2.4 stat curve', () => {
  it('has five rarities in order', () => {
    expect(RARITIES).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary'])
  })

  it('reproduces the HP table', () => {
    expect(hpAt('legendary', 1)).toBe(2800)
    expect(hpAt('legendary', 20)).toBe(8256)
    expect(hpAt('common', 10)).toBe(3077)
    expect(hpAt('rare', 40)).toBe(10000)
    expect(hpAt('epic', 30)).toBe(9538)
    expect(hpAt('uncommon', 20)).toBe(5308)
  })

  it('reproduces the ATK table (R6)', () => {
    expect(atkAt('legendary', 20)).toBe(3303)
    expect(atkAt('common', 40)).toBe(3200)
    expect(atkAt('uncommon', 1)).toBe(720)
    expect(atkAt('epic', 20)).toBe(2831)
    expect(atkAt('rare', 20)).toBe(2359)
  })

  it('derives ATK at 40 as 0.40 x HP and stays integral', () => {
    for (const r of RARITIES) expect(ATK_AT_40[r] * 5).toBe(HP_AT_40[r] * 2)
    expect(statAt(8000, 1)).toBe(1600)
    expect(statAt(8000, 40)).toBe(8000)
  })

  it('holds the other §2.4, §4.3, §5.1 and A9 tables', () => {
    expect(RARITIES.map(r => HP_AT_40[r])).toEqual([8000, 9000, 10000, 12000, 14000])
    expect(RARITIES.map(r => GPM_RARITY_MULT_TENTHS[r])).toEqual([10, 12, 15, 20, 25])
    expect(RARITIES.map(r => HATCH_XP[r])).toEqual([10, 30, 80, 200, 500])
    expect(RARITIES.map(r => SELL_GOLD[r])).toEqual([100, 500, 2500, 10000, null])
  })
})

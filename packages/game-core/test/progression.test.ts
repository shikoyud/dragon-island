import { describe, expect, it } from 'vitest'
import { addXp, cumulativeXp, MAX_PLAYER_LEVEL, settleLevels, xpToNext } from '../src/progression'
import { XP_TO_NEXT } from '../src/data/xp'
import { FLASH_14 } from '../src/data/presets'
import { newPlayer } from '../src/state'

describe('player xp', () => {
  const s = newPlayer(0)
const x1 = { ...FLASH_14, xpMult: 1 }

  it('follows the §4.3 curve ceil(50 x PL^1.8)', () => {
    expect(MAX_PLAYER_LEVEL).toBe(50)
    expect(xpToNext(1)).toBe(50)
    expect(xpToNext(2)).toBe(175)
    expect(xpToNext(10)).toBe(3155)
    expect(xpToNext(50)).toBe(Infinity)
    expect(XP_TO_NEXT).toHaveLength(49)
    XP_TO_NEXT.forEach((v, i) => expect(v).toBe(Math.ceil(50 * (i + 1) ** 1.8)))
  })

  it('cumulativeXp matches the §4.3 table within 0.1 %', () => {
    expect(cumulativeXp(1)).toBe(0)
    expect(cumulativeXp(5)).toBe(1194)
    expect(cumulativeXp(10)).toBe(9741)
    expect(cumulativeXp(15)).toBe(31864)
    expect(cumulativeXp(20)).toBe(73067)
    expect(cumulativeXp(30)).toBe(232934)
    for (const [l, v] of [[10, 9742], [15, 31862], [20, 73062], [30, 232892]] as const) {
      expect(Math.abs(cumulativeXp(l) - v) / v).toBeLessThan(0.001)
    }
  })

  it('several level-ups from one award keep the remainder', () => {
    expect(addXp(s, 50 + 175 + 362 + 7, x1, 1)).toMatchObject({ level: 4, xp: 7 })
    expect(settleLevels({ ...s, xp: 225 }, x1, 1)).toMatchObject({ level: 3, xp: 0 })
  })

  it('levels up, carrying remainder', () => {
    expect(addXp(s, 60, x1, 1)).toMatchObject({ level: 2, xp: 10 })
    expect(addXp(s, 225, x1, 1)).toMatchObject({ level: 3, xp: 0 })
  })

  it('stops at max level and keeps accumulating', () => {
    expect(addXp({ ...s, level: 50, xp: 0 }, 999_999, x1, 1)).toMatchObject({ level: 50, xp: 999_999 })
  })

  it('does not mutate input', () => {
    addXp(s, 1000, x1, 1)
    expect(s).toEqual(newPlayer(0))
  })
})

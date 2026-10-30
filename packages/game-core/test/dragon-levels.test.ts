import { describe, expect, it } from 'vitest'
import { feedXp, foodForLevel, foodPerFeed, levelCap, stageOf, totalFoodTo } from '../src/dragon'

describe('dragon levels', () => {
  it('computes food per feed exactly (R5)', () => {
    const rows: Array<[number, number]> = [[1, 5], [3, 8], [6, 13], [9, 22], [14, 54], [19, 134], [24, 332], [29, 825], [39, 5104]]
    for (const [l, f] of rows) expect(foodPerFeed(l)).toBe(f)
    expect(foodForLevel(39)).toBe(20416)
  })

  it('totals 122,460 Food to Lv 40, within 0.1% of the GDD approximation', () => {
    expect(totalFoodTo(40)).toBe(122460)
    expect(Math.abs(totalFoodTo(40) - 122382) / 122382).toBeLessThan(0.001)
  })

  it('maps levels to stages and Roost tiers to caps', () => {
    expect([3, 4, 6, 7].map(stageOf)).toEqual(['baby', 'juvenile', 'juvenile', 'adult'])
    expect([levelCap(0), levelCap(5)]).toEqual([7, 40])
  })

  it('awards at least 1 XP per feed', () => {
    expect([feedXp(5), feedXp(9), feedXp(10), feedXp(5104)]).toEqual([1, 1, 1, 510])
  })
})

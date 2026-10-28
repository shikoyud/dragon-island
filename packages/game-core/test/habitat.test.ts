import { describe, expect, it } from 'vitest'
import { getSpecies } from '../src/catalog'
import { canLiveIn, HABITAT_LEVELS, habitatBuildCost, maxHabitats, residents, storedGold } from '../src/habitat'
import { newPlayer } from '../src/state'
import { FIXTURE_CATALOG as C } from './fixtures'

describe('habitat rules', () => {
  const s = newPlayer(0)
  const h1 = s.habitats[0]!

  it('accrues whole minutes of gold up to the cap', () => {
    const r = residents(s, 'h1')
    expect(r.map(d => d.id)).toEqual(['d1'])
    expect(storedGold(h1, r, C, 600_000)).toBe(20)
    expect(storedGold(h1, r, C, 300 * 60_000)).toBe(500)
    expect(storedGold(h1, r, C, 90_000)).toBe(2)
  })

  it('yields nothing when the clock is behind the last collection', () => {
    expect(storedGold({ ...h1, lastCollectedMs: 600_000 }, residents(s, 'h1'), C, 300_000)).toBe(0)
  })

  it('lets a dragon live where any element matches', () => {
    const water = s.habitats[1]!
    expect(canLiveIn(getSpecies(C, 'fw-common'), water)).toBe(true)
    expect(canLiveIn(getSpecies(C, 'fire'), water)).toBe(false)
  })

  it('doubles build cost per owned habitat of that element', () => {
    expect(habitatBuildCost(s, 'earth')).toBe(500)
    expect(habitatBuildCost(s, 'fire')).toBe(1000)
  })

  it('limits habitats by player level', () => {
    expect([1, 4, 5, 50].map(maxHabitats)).toEqual([2, 2, 3, 12])
  })

  it('has the level table', () => {
    expect(HABITAT_LEVELS).toHaveLength(5)
    expect(HABITAT_LEVELS[0]).toEqual({ cap: 500, slots: 3, upgradeCost: 1_000 })
    expect(HABITAT_LEVELS[4]).toEqual({ cap: 120_000, slots: 7, upgradeCost: null })
  })
})

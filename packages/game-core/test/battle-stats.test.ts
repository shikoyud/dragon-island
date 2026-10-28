import { describe, expect, it } from 'vitest'
import { combatStats, damage, movesFor } from '../src/battle/stats'
import { getSpecies } from '../src/catalog'
import { createRng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

describe('combatStats', () => {
  it('applies the rarity multiplier with floor', () => {
    expect(combatStats({ speciesId: 'fire', level: 10 }, C)).toEqual({ hp: 300, atk: 40, spd: 60 })
    expect(combatStats({ speciesId: 'fw-legend', level: 30 }, C)).toEqual({ hp: 1400, atk: 200, spd: 80 })
    expect(combatStats({ speciesId: 'fw-rare', level: 1 }, C)).toEqual({ hp: 144, atk: 15, spd: 51 })
  })
})

describe('movesFor', () => {
  it('gives pure dragons their element plus Strike', () => {
    expect(movesFor(getSpecies(C, 'fire'))).toEqual([
      { name: 'fire', element: 'fire', powerPct: 100 },
      { name: 'Strike', element: 'neutral', powerPct: 80 },
    ])
  })

  it('gives dual dragons one move per element', () => {
    expect(movesFor(getSpecies(C, 'fw-rare')).map(m => m.name)).toEqual(['fire', 'water'])
  })
})

describe('damage', () => {
  const nature = getSpecies(C, 'nature')
  const fireMove = movesFor(getSpecies(C, 'fire'))[0]!
  const strike = movesFor(getSpecies(C, 'fire'))[1]!

  it('rolls within ±10% of ATK × power × multiplier', () => {
    const rng = createRng(3)
    for (let i = 0; i < 1_000; i++) {
      const d = damage(40, fireMove, nature, rng)
      expect(d.multiplier).toBe(2)
      expect(d.amount).toBeGreaterThanOrEqual(72)
      expect(d.amount).toBeLessThanOrEqual(88)
      const s = damage(40, strike, nature, rng)
      expect(s.multiplier).toBe(1)
      expect(s.amount).toBeGreaterThanOrEqual(28)
      expect(s.amount).toBeLessThanOrEqual(35)
    }
  })

  it('never deals less than 1 and is deterministic', () => {
    expect(damage(1, strike, nature, createRng(1)).amount).toBe(1)
    expect(damage(40, fireMove, nature, createRng(5))).toEqual(damage(40, fireMove, nature, createRng(5)))
  })
})

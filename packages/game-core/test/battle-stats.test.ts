import { describe, expect, it } from 'vitest'
import { combatStats, damage, movesFor } from '../src/battle/stats'
import { getSpecies } from '../src/catalog'
import { createRng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

describe('combatStats', () => {
  it('applies the rarity multiplier with floor', () => {
    expect(combatStats({ speciesId: 'flame', level: 10 }, C)).toEqual({ hp: 300, atk: 40, spd: 60 })
    expect(combatStats({ speciesId: 'fw-legend', level: 30 }, C)).toEqual({ hp: 1400, atk: 200, spd: 80 })
    expect(combatStats({ speciesId: 'fw-rare', level: 1 }, C)).toEqual({ hp: 144, atk: 15, spd: 51 })
  })
})

describe('movesFor', () => {
  it('gives pure dragons their element plus Strike', () => {
    expect(movesFor(getSpecies(C, 'flame'))).toEqual([
      { name: 'flame', element: 'flame', powerPct: 100 },
      { name: 'Strike', element: 'physical', powerPct: 80 },
    ])
  })

  it('gives dual dragons one move per element', () => {
    expect(movesFor(getSpecies(C, 'fw-rare')).map(m => m.name)).toEqual(['flame', 'sea'])
  })
})

describe('damage', () => {
  const nature = getSpecies(C, 'nature')
  const flameMove = movesFor(getSpecies(C, 'flame'))[0]!
  const strike = movesFor(getSpecies(C, 'flame'))[1]!

  it('rolls within ±10% of ATK × power × multiplier', () => {
    const rng = createRng(3)
    for (let i = 0; i < 1_000; i++) {
      const d = damage(40, flameMove, nature, rng)
      expect(d.multiplier).toBe(2)
      expect(d.amount).toBeGreaterThanOrEqual(72)
      expect(d.amount).toBeLessThanOrEqual(88)
      const s = damage(40, strike, nature, rng)
      expect(s.multiplier).toBe(1)
      expect(s.amount).toBeGreaterThanOrEqual(28)
      expect(s.amount).toBeLessThanOrEqual(35)
    }
  })

  it('never deals less than 1 on a hit that can hurt, and is deterministic', () => {
    expect(damage(1, strike, nature, createRng(1)).amount).toBe(1)
    expect(damage(40, flameMove, nature, createRng(5))).toEqual(damage(40, flameMove, nature, createRng(5)))
  })

  it('deals 0 at 0x and still uses one roll (§2.1 immunity)', () => {
    const rng = createRng(5), control = createRng(5)
    expect(damage(1_000, flameMove, getSpecies(C, 'flame'), rng)).toEqual({ amount: 0, multiplier: 0 })
    control.next()
    expect(rng.next()).toBe(control.next())
  })

  it('reaches a same-element defender with Strike', () => {
    const d = damage(40, strike, getSpecies(C, 'flame'), createRng(5))
    expect(d.multiplier).toBe(1)
    expect(d.amount).toBeGreaterThan(0)
  })
})

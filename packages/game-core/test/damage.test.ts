import { describe, expect, it } from 'vitest'
import { getSpecies } from '../src/catalog'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { CRIT_PERCENT, TEAM_SIZE, TURN_LIMIT, VARIANCE_MAX, VARIANCE_MIN } from '../src/data/battle'
import { movesFor, type BattleMove } from '../src/battle/moves'
import { baseDamage, rollDamage } from '../src/battle/damage'
import { atkAt, hpAt } from '../src/rarity'
import { createRng, type Rng } from '../src/rng'

const terraKit = movesFor(getSpecies(LAUNCH_CATALOG, 'terra'))
const [PHYS, T1, T2, T3] = terraKit as [BattleMove, BattleMove, BattleMove, BattleMove]
// Terra is 2x against Flame and Electric, 0.5x against Metal and War, 0x against Terra, 1x elsewhere.
const ATK = 3200

describe('battle constants', () => {
  it('values', () => {
    expect([TEAM_SIZE, TURN_LIMIT, CRIT_PERCENT, VARIANCE_MIN, VARIANCE_MAX]).toEqual([3, 30, 10, 900, 1100])
  })
})

describe('§6.2 table at ATK 3,200, no crit, variance 1000', () => {
  it.each([
    ['T3 2x', T3, 'flame', 10368],
    ['T3 1x', T3, 'sea', 5184],
    ['T2 2x', T2, 'flame', 6400],
    ['T2 1x', T2, 'sea', 3200],
    ['Physical', PHYS, 'sea', 1664],
    ['T2 0.5x', T2, 'metal', 1600],
    ['T3 0x', T3, 'terra', 0],
    ['T1 0x', T1, 'terra', 0],
  ] as const)('%s', (_n, m, def, want) => {
    expect(baseDamage(ATK, m, def, false, 1000)).toBe(want)
  })

  it('crit is 1.5x: T2 1x is 4,800', () => {
    expect(baseDamage(ATK, T2, 'sea', true, 1000)).toBe(4800)
  })

  it('variance 900 and 1100: T2 1x is 2,880 and 3,520', () => {
    expect(baseDamage(ATK, T2, 'sea', false, 900)).toBe(2880)
    expect(baseDamage(ATK, T2, 'sea', false, 1100)).toBe(3520)
  })

  it('immune with crit and variance 1100 is 0 and flagged immune', () => {
    expect(baseDamage(ATK, T3, 'terra', true, 1100)).toBe(0)
    const r = rollDamage(ATK, T3, 'terra', createRng(1))
    expect(r.amount).toBe(0)
    expect(r.immune).toBe(true)
    expect(r.multiplier).toBe(0)
  })

  it('minimum 1: ATK 1, T1, 0.5x', () => {
    expect(baseDamage(1, T1, 'metal', false, 900)).toBe(1)
  })

  it('Physical against the same primary is 1x', () => {
    expect(baseDamage(ATK, PHYS, 'terra', false, 1000)).toBe(1664)
  })

  it('flame attacking terra with Physical is 1x at any level', () => {
    const flame = movesFor(getSpecies(LAUNCH_CATALOG, 'flame'))[0]!
    for (const lv of [1, 10, 20, 40]) {
      const atk = atkAt(getSpecies(LAUNCH_CATALOG, 'flame').rarity, lv)
      expect(rollDamage(atk, flame, 'terra', createRng(lv)).multiplier).toBe(1)
    }
  })
})

describe('§2.4 hits to kill', () => {
  const hits = (hp: number, avg: number) => Math.ceil(hp / avg)
  it('Common Lv 40 2x T2 on a Legendary (14,000 HP): average 6,400, 3 hits', () => {
    const atk = atkAt('common', 40)
    expect(atk).toBe(3200)
    const avg = baseDamage(atk, T2, 'flame', false, 1000)
    expect(avg).toBe(6400)
    expect(hpAt('legendary', 40)).toBe(14000)
    expect(14000 / avg).toBeCloseTo(2.19, 2)
    expect(hits(14000, avg)).toBe(3)
  })
  it('Legendary 0.5x T2 on a Common (8,000 HP) averages 2,800: 3 hits', () => {
    const atk = atkAt('legendary', 40)
    const avg = baseDamage(atk, T2, 'metal', false, 1000)
    expect(avg).toBe(2800)
    expect(hpAt('common', 40) / avg).toBeCloseTo(2.86, 2)
    expect(hits(8000, avg)).toBe(3)
  })
})

describe('rollDamage', () => {
  function counting(inner: Rng): Rng & { calls: number[] } {
    const calls: number[] = []
    return {
      calls,
      next: () => inner.next(),
      int: (n: number) => { calls.push(n); return inner.int(n) },
    }
  }

  it('draws exactly twice, crit (100) then variance (201), even when immune', () => {
    const a = counting(createRng(7))
    rollDamage(ATK, T2, 'sea', a)
    expect(a.calls).toEqual([100, 201])
    const b = counting(createRng(7))
    rollDamage(ATK, T3, 'terra', b)
    expect(b.calls).toEqual([100, 201])
  })

  it('maps draws to crit and variance', () => {
    const fixed = (crit: number, v: number): Rng => {
      const q = [crit, v]
      return { next: () => 0, int: () => q.shift()! }
    }
    expect(rollDamage(ATK, T2, 'sea', fixed(9, 100)).crit).toBe(true)
    expect(rollDamage(ATK, T2, 'sea', fixed(10, 100)).crit).toBe(false)
    expect(rollDamage(ATK, T2, 'sea', fixed(10, 0)).amount).toBe(2880)
    expect(rollDamage(ATK, T2, 'sea', fixed(10, 200)).amount).toBe(3520)
    expect(rollDamage(ATK, T2, 'sea', fixed(0, 100)).amount).toBe(4800)
  })

  it('§6.2 about +5 % on average over 100,000 seeded rolls', () => {
    const rng = createRng(12345)
    const base = baseDamage(ATK, T2, 'sea', false, 1000)
    let sum = 0, crits = 0
    const n = 100_000
    for (let i = 0; i < n; i++) {
      const r = rollDamage(ATK, T2, 'sea', rng)
      sum += r.amount
      if (r.crit) crits++
      expect(r.amount).toBeGreaterThanOrEqual(Math.floor(base * 0.9))
      expect(r.amount).toBeLessThanOrEqual(Math.floor(base * 1.1 * 1.5))
    }
    expect(Math.abs(sum / n - base * 1.05) / (base * 1.05)).toBeLessThan(0.01)
    expect(Math.abs(crits / n - 0.1)).toBeLessThan(0.005)
  })

  it('variance stays within 900..1100', () => {
    const rng = createRng(99)
    const lo = baseDamage(ATK, T2, 'sea', false, VARIANCE_MIN)
    const hi = baseDamage(ATK, T2, 'sea', false, VARIANCE_MAX)
    for (let i = 0; i < 20_000; i++) {
      const r = rollDamage(ATK, T2, 'sea', rng)
      if (!r.crit) { expect(r.amount).toBeGreaterThanOrEqual(lo); expect(r.amount).toBeLessThanOrEqual(hi) }
    }
  })
})

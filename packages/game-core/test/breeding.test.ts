import { describe, expect, it } from 'vitest'
import { breedingOdds, rollOffspring, tierWeights, type BreedContext, type Parent } from '../src/breeding'
import { createRng } from '../src/rng'
import { FIXTURE_CATALOG as C } from './fixtures'

const p = (id: string, level = 4): Parent => ({ speciesId: id, level })
const none: BreedContext = { pity: {} }

function expectOdds(actual: Record<string, number>, expected: Record<string, number>) {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort())
  for (const [k, v] of Object.entries(expected)) expect(actual[k]).toBeCloseTo(v, 6)
  expect(Math.abs(Object.values(actual).reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9)
}

describe('tierWeights', () => {
  it('scales with score', () => {
    expect(tierWeights(0)).toEqual({ common: 70, rare: 25, epic: 5, legendary: 1 })
    expect(tierWeights(3)).toEqual({ common: 70, rare: 40, epic: 11, legendary: 1 })
  })
})

describe('breedingOdds', () => {
  it('uses the hybrid pool for two pure parents', () => {
    expectOdds(breedingOdds(p('fire'), p('water'), none, C), { 'fw-common': 0.7, 'fw-rare': 0.25, 'fw-epic': 0.05 })
  })

  it('applies pity by dropping commons', () => {
    expectOdds(breedingOdds(p('fire'), p('water'), { pity: { 'fire+water': 10 } }, C),
      { 'fw-rare': 25 / 30, 'fw-epic': 5 / 30 })
  })

  it('falls back to the parent species when no species matches', () => {
    expectOdds(breedingOdds(p('fire'), p('ice'), none, C), { fire: 0.5, ice: 0.5 })
    expectOdds(breedingOdds(p('fire'), p('fire'), none, C), { fire: 1 })
  })

  it('rolls the legendary recipe first at level 15', () => {
    expectOdds(breedingOdds(p('fw-rare', 15), p('fw-epic', 15), none, C), {
      'fw-legend': 0.03,
      fire: 0.2425,
      water: 0.2425,
      'fw-common': 0.97 * 0.5 * 70 / 121,
      'fw-rare': 0.97 * 0.5 * 40 / 121,
      'fw-epic': 0.97 * 0.5 * 11 / 121,
    })
  })

  it('skips the recipe below level 15', () => {
    expect(breedingOdds(p('fw-rare', 14), p('fw-epic', 15), none, C)).not.toHaveProperty('fw-legend')
  })
})

describe('rollOffspring', () => {
  it('matches the epic share over many rolls', () => {
    const rng = createRng(1)
    let epic = 0
    for (let i = 0; i < 20_000; i++) if (rollOffspring(p('fire'), p('water'), none, C, rng).speciesId === 'fw-epic') epic++
    expect(epic / 20_000).toBeGreaterThanOrEqual(0.04)
    expect(epic / 20_000).toBeLessThanOrEqual(0.06)
  })

  it('is deterministic for a seed', () => {
    expect(rollOffspring(p('fire'), p('water'), none, C, createRng(9)))
      .toEqual(rollOffspring(p('fire'), p('water'), none, C, createRng(9)))
  })

  it('never returns a common under pity', () => {
    const rng = createRng(3)
    const ctx = { pity: { 'fire+water': 10 } }
    for (let i = 0; i < 1_000; i++) {
      const r = rollOffspring(p('fire'), p('water'), ctx, C, rng)
      expect(r.speciesId).not.toBe('fw-common')
      expect(r.pairKey).toBe('fire+water')
      expect(r.rarePlus).toBe(true)
    }
  })

  it('reports the picked element pair and rarity', () => {
    expect(rollOffspring(p('fire'), p('ice'), none, C, createRng(5))).toMatchObject({ pairKey: 'fire+ice', rarePlus: false })
  })
})

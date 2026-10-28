import { describe, expect, it } from 'vitest'
import { ELEMENTS, STRENGTHS, elementMultiplier, pairKey } from '../src/elements'

describe('elements', () => {
  it('has nine elements', () => {
    expect(ELEMENTS).toHaveLength(9)
  })

  it('computes matchup multipliers', () => {
    expect(elementMultiplier('fire', 'nature')).toBe(2)
    expect(elementMultiplier('nature', 'fire')).toBe(0.5)
    expect(elementMultiplier('fire', 'water')).toBe(0.5)
    expect(elementMultiplier('fire', 'earth')).toBe(0.5)
    expect(elementMultiplier('fire', 'electric')).toBe(1)
    expect(elementMultiplier('dark', 'light')).toBe(2)
    expect(elementMultiplier('light', 'dark')).toBe(2)
    expect(elementMultiplier('dark', 'fire')).toBe(1)
    expect(elementMultiplier('neutral', 'water')).toBe(1)
  })

  it('builds alphabetical pair keys', () => {
    expect(pairKey('water', 'fire')).toBe('fire+water')
    expect(pairKey('ice', 'ice')).toBe('ice+ice')
  })

  it('gives each base element two strengths, two weaknesses and no mutual pairs', () => {
    const base = ELEMENTS.slice(0, 7)
    for (const e of base) {
      expect(STRENGTHS[e]).toHaveLength(2)
      expect(base.filter(a => STRENGTHS[a].includes(e))).toHaveLength(2)
      for (const t of STRENGTHS[e]) expect(STRENGTHS[t]).not.toContain(e)
    }
  })
})

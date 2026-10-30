import { describe, expect, it } from 'vitest'
import { pairKey } from '../src/elements'

// Multipliers, strengths, opposites and tiers are pinned against the GDD in elements-matrix.test.ts.
describe('pairKey', () => {
  it('builds alphabetical pair keys', () => {
    expect(pairKey('sea', 'flame')).toBe('flame+sea')
    expect(pairKey('terra', 'flame')).toBe('flame+terra')
    expect(pairKey('ice', 'ice')).toBe('ice+ice')
  })
})

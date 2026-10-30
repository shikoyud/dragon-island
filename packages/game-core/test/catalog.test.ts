import { describe, expect, it } from 'vitest'
import { getSpecies, isBasic } from '../src/catalog'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'

describe('catalog', () => {
  it('throws on unknown species', () => {
    expect(() => getSpecies(LAUNCH_CATALOG, 'nope')).toThrow('UNKNOWN_SPECIES')
  })

  it('keeps the ten Basics, named and ordered as before', () => {
    const basics = [...LAUNCH_CATALOG.species.values()].filter(isBasic)
    expect(basics.map(s => s.id)).toEqual(['terra', 'flame', 'sea', 'nature', 'electric', 'ice', 'metal', 'dark', 'light', 'war'])
    expect(basics.map(s => s.name)).toEqual(['Terra', 'Flame', 'Sea', 'Nature', 'Electric', 'Ice', 'Metal', 'Dark', 'Light', 'War'].map(n => `${n} Basic`))
    expect(getSpecies(LAUNCH_CATALOG, 'flame')).toMatchObject({ elements: ['flame'], rarity: 'common' })
  })

  it('tells Basics from hybrids', () => {
    expect(isBasic(getSpecies(LAUNCH_CATALOG, 'terra'))).toBe(true)
    expect(isBasic(getSpecies(LAUNCH_CATALOG, 'terra-flame'))).toBe(false)
    expect(isBasic(getSpecies(LAUNCH_CATALOG, 'flame-ice-sea'))).toBe(false)
  })
})

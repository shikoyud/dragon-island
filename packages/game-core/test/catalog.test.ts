import { describe, expect, it } from 'vitest'
import type { Element } from '../src/elements'
import { RARITY, type Rarity } from '../src/rarity'
import { getSpecies, makeCatalog, validateCatalog, type Species } from '../src/catalog'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'

const base = [...LAUNCH_CATALOG.species.values()]
const sp = (id: string, elements: Element[], rarity: Rarity, recipeOnly = false): Species =>
  ({ id, name: id, elements, rarity, baseSpeed: 50, recipeOnly })

describe('rarity', () => {
  it('has spec timings', () => {
    expect(RARITY.rare.breedMs).toBe(1_800_000)
    expect(RARITY.legendary).toEqual({
      breedMs: 43_200_000, hatchMs: 43_200_000, baseGold: 30, statPct: 200, score: 3, sellGold: 10_000, xp: 300,
    })
  })
})

describe('catalog', () => {
  it('throws on unknown species', () => {
    expect(() => getSpecies(LAUNCH_CATALOG, 'nope')).toThrow('UNKNOWN_SPECIES')
  })

  it('ships a valid launch catalog of ten pure commons', () => {
    expect(validateCatalog(LAUNCH_CATALOG)).toEqual([])
    expect(base).toHaveLength(10)
    expect(base.map(s => s.id)).toEqual(['terra', 'flame', 'sea', 'nature', 'electric', 'ice', 'metal', 'dark', 'light', 'war'])
    expect(base.map(s => s.name)).toEqual(['Terra', 'Flame', 'Sea', 'Nature', 'Electric', 'Ice', 'Metal', 'Dark', 'Light', 'War'].map(n => `${n} Basic`))
    expect(getSpecies(LAUNCH_CATALOG, 'flame')).toMatchObject({ elements: ['flame'], rarity: 'common', recipeOnly: false })
  })

  it('flags two species of one rarity in the same element pool', () => {
    expect(validateCatalog(makeCatalog([...base, sp('a', ['flame', 'sea'], 'common'), sp('b', ['sea', 'flame'], 'common')])))
      .toContain('DUPLICATE_TIER:flame+sea:common')
  })

  it('flags legendaries that are not recipe-only', () => {
    expect(validateCatalog(makeCatalog([...base, sp('L', ['flame', 'ice'], 'legendary')]))).toContain('LEGENDARY_NOT_RECIPE:L')
  })

  it('flags a missing pure common', () => {
    expect(validateCatalog(makeCatalog(base.filter(s => s.id !== 'ice')))).toContain('MISSING_PURE:ice')
  })

  it('flags recipes naming unknown species', () => {
    expect(validateCatalog(makeCatalog(base, [{ parents: ['x', 'flame'], legendaryId: 'y' }]))).toContain('UNKNOWN_RECIPE_SPECIES:x')
  })
})

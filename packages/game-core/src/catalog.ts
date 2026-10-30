import { ELEMENTS, pairKey, type Element } from './elements'
import type { Rarity } from './rarity'

export interface Species {
  id: string
  name: string
  /** 1..3 elements; the first is primary. */
  elements: readonly Element[]
  rarity: Rarity
  recipeOnly: boolean
}

export interface Recipe {
  parents: readonly [string, string]
  legendaryId: string
}

export interface Catalog {
  species: ReadonlyMap<string, Species>
  recipes: readonly Recipe[]
}

export function makeCatalog(species: Species[], recipes: Recipe[] = []): Catalog {
  return { species: new Map(species.map(s => [s.id, s])), recipes }
}

export function getSpecies(c: Catalog, id: string): Species {
  const s = c.species.get(id)
  if (!s) throw new Error('UNKNOWN_SPECIES')
  return s
}

/** Pool key for a species: pairKey of its element set (pure flame → 'flame+flame'). */
export function speciesPairKey(s: Species): string {
  const [a, b] = s.elements
  return pairKey(a!, b ?? a!)
}

/** Returns error codes; [] means the catalog satisfies the spec §5 rules. */
export function validateCatalog(c: Catalog): string[] {
  const errors: string[] = []
  const tiers = new Set<string>()
  for (const s of c.species.values()) {
    if (s.elements.length < 1 || s.elements.length > 3 || new Set(s.elements).size !== s.elements.length) {
      errors.push(`BAD_ELEMENTS:${s.id}`)
      continue
    }
    if (s.rarity === 'legendary' && !s.recipeOnly) errors.push(`LEGENDARY_NOT_RECIPE:${s.id}`)
    const tier = `${speciesPairKey(s)}:${s.rarity}`
    if (tiers.has(tier)) errors.push(`DUPLICATE_TIER:${tier}`)
    tiers.add(tier)
  }
  for (const e of ELEMENTS) {
    const pure = [...c.species.values()].some(s => s.elements.length === 1 && s.elements[0] === e && s.rarity === 'common' && !s.recipeOnly)
    if (!pure) errors.push(`MISSING_PURE:${e}`)
  }
  for (const r of c.recipes) {
    for (const id of [...r.parents, r.legendaryId]) {
      if (!c.species.has(id)) errors.push(`UNKNOWN_RECIPE_SPECIES:${id}`)
    }
    const legend = c.species.get(r.legendaryId)
    if (legend && (legend.rarity !== 'legendary' || !legend.recipeOnly)) errors.push(`RECIPE_NOT_LEGENDARY:${r.legendaryId}`)
  }
  return errors
}

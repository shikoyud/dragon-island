import { ELEMENTS, STRONG_AGAINST, isOpposite } from './elements'
import type { SpeciesRow } from './data/species-rows'

export type { SpeciesRow } from './data/species-rows'

/** 1..3 elements; the first is primary. */
export interface Species extends SpeciesRow {}

export interface Catalog {
  species: ReadonlyMap<string, Species>
}

export function makeCatalog(species: readonly Species[]): Catalog {
  return { species: new Map(species.map(s => [s.id, s])) }
}

export function getSpecies(c: Catalog, id: string): Species {
  const s = c.species.get(id)
  if (!s) throw new Error('UNKNOWN_SPECIES')
  return s
}

export function isBasic(s: Species): boolean {
  return s.elements.length === 1
}

/** §3.4 rule for a two-element hybrid: opposite pair = epic, counter pair = rare, else uncommon. */
function gridRarity(a: Species['elements'][number], b: Species['elements'][number]): string {
  if (isOpposite(a, b)) return 'epic'
  if (STRONG_AGAINST[a].includes(b) || STRONG_AGAINST[b].includes(a)) return 'rare'
  return 'uncommon'
}

/** Returns error codes; [] means the catalog satisfies GDD §3.3–3.4. */
export function validateCatalog(c: Catalog): string[] {
  const errors: string[] = []
  const ordered = new Set<string>()
  for (const s of c.species.values()) {
    if (s.elements.length < 1 || s.elements.length > 3 || new Set(s.elements).size !== s.elements.length) {
      errors.push(`BAD_ELEMENTS:${s.id}`)
      continue
    }
    if (s.rarity === 'legendary') continue // Legendaries share element sets with grid rows
    const key = s.elements.join('-')
    if (ordered.has(key)) errors.push(`DUPLICATE_ELEMENTS:${key}`)
    ordered.add(key)
    if (s.elements.length === 2 && s.rarity !== gridRarity(s.elements[0]!, s.elements[1]!)) {
      errors.push(`HYBRID_RARITY:${s.id}`)
    }
  }
  for (const e of ELEMENTS) {
    const has = [...c.species.values()].some(s => isBasic(s) && s.elements[0] === e && s.rarity === 'common')
    if (!has) errors.push(`MISSING_BASIC:${e}`)
  }
  return errors
}

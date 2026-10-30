// GDD ยง3.2: one pool function that both the odds and the roll read.
import { isBasic, type Catalog, type Species } from './catalog'
import { BREED_WEIGHT, LEGENDARY_EVENTS } from './data/breeding'
import type { Preset } from './data/presets'
import { isOpposite, type Element } from './elements'
import type { Rng } from './rng'

export interface BreedContext {
  activeLegendaries: readonly string[]
  /** ง3.5: the player has not yet bred their first hybrid (callers pass `!firstHybridDone`). */
  firstHybridPending: boolean
}
export interface PoolEntry { species: Species; weight: number }

/** Legendaries whose event window contains `day` (ยง8.4). */
export function activeLegendaries(day: number, preset: Preset): readonly string[] {
  return LEGENDARY_EVENTS
    .filter(e => day >= e.days[preset.id][0] && day <= e.days[preset.id][1])
    .map(e => e.speciesId)
}

/** ยง3.2 rule 1: two opposite Basics cannot breed. */
export function breedValidity(a: Species, b: Species): 'OPPOSITE_BASICS' | null {
  return isBasic(a) && isBasic(b) && isOpposite(a.elements[0]!, b.elements[0]!) ? 'OPPOSITE_BASICS' : null
}

/** Qualifying species with their integer weights, in id order. */
export function breedingPool(a: Species, b: Species, ctx: BreedContext, c: Catalog): PoolEntry[] {
  const union = new Set<Element>([...a.elements, ...b.elements])
  const primaries = new Set<Element>([a.elements[0]!, b.elements[0]!])
  const parentBasic = isBasic(a) || isBasic(b)
  const picked: Species[] = []
  for (const s of c.species.values()) {
    if (!primaries.has(s.elements[0]!)) continue
    if (!s.elements.every(e => union.has(e))) continue
    if (isBasic(s) && !parentBasic) continue
    if (s.rarity === 'legendary' && !ctx.activeLegendaries.includes(s.id)) continue
    picked.push(s)
  }
  // Floor guard: with no Common or Uncommon in reach, each parent's primary Basic joins the pool.
  if (!picked.some(s => s.rarity === 'common' || s.rarity === 'uncommon')) {
    for (const p of primaries) {
      const basic = [...c.species.values()].find(s => isBasic(s) && s.rarity === 'common' && s.elements[0] === p)
      if (basic && !picked.includes(basic)) picked.push(basic)
    }
  }
  // ง3.5: while the first hybrid is pending, a pool holding a hybrid is restricted to hybrids.
  const isHybrid = (s: Species) => s.elements.length >= 2 && s.rarity !== 'legendary'
  const pool = ctx.firstHybridPending && picked.some(isHybrid) ? picked.filter(isHybrid) : picked
  return pool
    .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    .map(species => ({ species, weight: BREED_WEIGHT[species.rarity] }))
}

/** Exact probabilities (for display); the roll uses the integer weights. */
export function breedingOdds(a: Species, b: Species, ctx: BreedContext, c: Catalog): Record<string, number> {
  const pool = breedingPool(a, b, ctx, c)
  const total = pool.reduce((n, e) => n + e.weight, 0)
  return Object.fromEntries(pool.map(e => [e.species.id, e.weight / total]))
}

/** One `rng.int(total)` picks the offspring; replays pin this order. */
export function rollOffspring(a: Species, b: Species, ctx: BreedContext, c: Catalog, rng: Rng): Species {
  const pool = breedingPool(a, b, ctx, c)
  const total = pool.reduce((n, e) => n + e.weight, 0)
  if (total === 0) throw new Error('EMPTY_POOL')
  let roll = rng.int(total)
  for (const e of pool) {
    if (roll < e.weight) return e.species
    roll -= e.weight
  }
  return pool[pool.length - 1]!.species
}

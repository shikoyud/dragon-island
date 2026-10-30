import { getSpecies, type Catalog, type Species } from './catalog'
import { pairKey, type Element } from './elements'
import { RARITIES, RARITY, type Rarity } from './rarity'
import type { Rng } from './rng'

export interface Parent { speciesId: string; level: number }
export interface BreedContext { pity: Readonly<Record<string, number>> }
export interface BreedRoll { speciesId: string; pairKey: string; rarePlus: boolean }

export const RECIPE_MIN_LEVEL = 15
export const RECIPE_CHANCE = 0.03
export const PITY_THRESHOLD = 10

export function tierWeights(scoreSum: number): Record<Rarity, number> {
  return {
    common: 70,
    rare: 25 + 5 * scoreSum,
    epic: 5 + 2 * scoreSum,
    legendary: 1,
  }
}

function sameSet(elements: readonly Element[], eA: Element, eB: Element): boolean {
  const want = new Set([eA, eB])
  const have = new Set(elements)
  return have.size === want.size && [...want].every(e => have.has(e))
}

export function poolFor(eA: Element, eB: Element, a: Parent, b: Parent, c: Catalog): Species[] {
  const pool = [...c.species.values()].filter(s => !s.recipeOnly && sameSet(s.elements, eA, eB))
  if (pool.length > 0) return pool
  const parents = [getSpecies(c, a.speciesId)]
  if (b.speciesId !== a.speciesId) parents.push(getSpecies(c, b.speciesId))
  return parents
}

interface Tier { rarity: Rarity; weight: number; species: Species[] }

/** Tiers present in the pool with their integer weights, after pity. */
function tiersFor(pool: Species[], scoreSum: number, ctx: BreedContext, key: string): Tier[] {
  const w = tierWeights(scoreSum)
  let tiers = RARITIES
    .map(rarity => ({ rarity, weight: w[rarity], species: pool.filter(s => s.rarity === rarity) }))
    .filter(t => t.species.length > 0)
  if ((ctx.pity[key] ?? 0) >= PITY_THRESHOLD && tiers.some(t => t.rarity !== 'common')) {
    tiers = tiers.filter(t => t.rarity !== 'common')
  }
  return tiers
}

/** Legendary id if the unordered parent pair matches a recipe and both are high enough. */
function recipeFor(a: Parent, b: Parent, c: Catalog): string | null {
  if (a.level < RECIPE_MIN_LEVEL || b.level < RECIPE_MIN_LEVEL) return null
  const r = c.recipes.find(({ parents: [x, y] }) =>
    (x === a.speciesId && y === b.speciesId) || (x === b.speciesId && y === a.speciesId))
  return r ? r.legendaryId : null
}

function scoreSum(a: Species, b: Species): number {
  return RARITY[a.rarity].score + RARITY[b.rarity].score
}

/** Exact probabilities of each child species (non-zero entries only). */
export function breedingOdds(a: Parent, b: Parent, ctx: BreedContext, c: Catalog): Record<string, number> {
  const sa = getSpecies(c, a.speciesId), sb = getSpecies(c, b.speciesId)
  const odds: Record<string, number> = {}
  const add = (id: string, p: number) => { if (p > 0) odds[id] = (odds[id] ?? 0) + p }
  const legendary = recipeFor(a, b, c)
  let rest = 1
  if (legendary) { add(legendary, RECIPE_CHANCE); rest -= RECIPE_CHANCE }
  const pick = rest / (sa.elements.length * sb.elements.length)
  for (const eA of sa.elements) {
    for (const eB of sb.elements) {
      const tiers = tiersFor(poolFor(eA, eB, a, b, c), scoreSum(sa, sb), ctx, pairKey(eA, eB))
      const total = tiers.reduce((n, t) => n + t.weight, 0)
      for (const t of tiers) for (const s of t.species) add(s.id, pick * (t.weight / total) / t.species.length)
    }
  }
  return odds
}

/** RNG call order is fixed for replay: element A, element B, recipe, tier, species. */
export function rollOffspring(a: Parent, b: Parent, ctx: BreedContext, c: Catalog, rng: Rng): BreedRoll {
  const sa = getSpecies(c, a.speciesId), sb = getSpecies(c, b.speciesId)
  const eA = sa.elements[rng.int(sa.elements.length)]!
  const eB = sb.elements[rng.int(sb.elements.length)]!
  const key = pairKey(eA, eB)
  const legendary = recipeFor(a, b, c)
  if (legendary && rng.next() < RECIPE_CHANCE) return { speciesId: legendary, pairKey: key, rarePlus: true }
  const tiers = tiersFor(poolFor(eA, eB, a, b, c), scoreSum(sa, sb), ctx, key)
  let roll = rng.int(tiers.reduce((n, t) => n + t.weight, 0))
  let tier = tiers[tiers.length - 1]!
  for (const t of tiers) {
    if (roll < t.weight) { tier = t; break }
    roll -= t.weight
  }
  const child = tier.species[rng.int(tier.species.length)]!
  return { speciesId: child.id, pairKey: key, rarePlus: child.rarity !== 'common' }
}

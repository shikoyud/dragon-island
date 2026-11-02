import { activeLegendaries, breedValidity, rollOffspring } from '../breeding'
import { breederBreedMs, hatcherySlots } from '../buildings'
import { getSpecies, type Catalog } from '../catalog'
import { isUnfinished } from '../construction'
import { breedTimerMs } from '../data/breeding-timers'
import { FIRST_HYBRID_MS, basicPriceGold } from '../data/breeding'
import { BREED_MIN_LEVEL } from '../data/dragon-levels'
import { FIRST_HATCH_XP_MULT, HATCH_XP, START_BREED_XP } from '../data/xp'
import { canLiveIn, habitatSlots, residents } from '../habitat'
import { addXp, breedXpApplies } from '../progression'
import { spendGold } from '../wallet'
import { collectHabitat } from './island-actions'
import type { Element } from '../elements'
import type { Habitat, PlayerState } from '../state'
import { isUnlocked } from '../data/unlocks'
import { failure, success, type Handler } from './types'

export { BREED_MIN_LEVEL }

export const startBreed: Handler<'startBreed'> = (s, a, ctx) => {
  const pa = s.dragons.find(d => d.id === a.parentA)
  const pb = s.dragons.find(d => d.id === a.parentB)
  if (!pa || !pb || pa.id === pb.id) return failure('INVALID_PARENTS')
  if (pa.level < BREED_MIN_LEVEL || pb.level < BREED_MIN_LEVEL) return failure('LEVEL_TOO_LOW')
  if (!isUnlocked('mountain:1', s.level)) return failure('LEVEL_TOO_LOW')
  const sa = getSpecies(ctx.catalog, pa.speciesId), sb = getSpecies(ctx.catalog, pb.speciesId)
  const invalid = breedValidity(sa, sb)
  if (invalid) return failure(invalid)
  // A finished egg waiting for a Hatchery slot keeps its building blocked (§5.4); a new building does nothing yet.
  const index = s.breeders.findIndex((b, i) => b.egg === null && !b.stored && !isUnfinished(s, { type: 'breeder', index: i }))
  if (index < 0) return failure('NO_FREE_BREEDER')

  const bctx = { activeLegendaries: activeLegendaries(ctx.day, ctx.preset), firstHybridPending: !s.firstHybridDone }
  const child = rollOffspring(sa, sb, bctx, ctx.catalog, ctx.rng)
  // R25: the scripted breed takes a flat minute, only when the restricted pool was actually used.
  const scripted = bctx.firstHybridPending && child.elements.length >= 2 && child.rarity !== 'legendary'
  const hatchMs = scripted ? FIRST_HYBRID_MS : breedTimerMs(child.rarity, child.elements, ctx.preset)
  const readyAtMs = ctx.nowMs + (scripted ? FIRST_HYBRID_MS : breederBreedMs(hatchMs, s.breeders[index]!))
  const pays = breedXpApplies(sa, sb, child)
  const next = {
    ...s,
    breeders: s.breeders.map((b, i) => i === index ? { ...b, egg: { speciesId: child.id, readyAtMs, hatchMs, xpFree: !pays } } : b),
    goalStats: { ...s.goalStats, breeds: s.goalStats.breeds + 1 },
    firstHybridDone: s.firstHybridDone || scripted,
  }
  return success(pays ? addXp(next, START_BREED_XP, ctx.preset, ctx.day) : next)
}

/** The Dragon Book with `speciesId` added once (R22). */
export function discover(discovered: readonly string[], speciesId: string): string[] {
  return discovered.includes(speciesId) ? [...discovered] : [...discovered, speciesId]
}

/** Hatchery slots hold eggs and hatched dragons that found no habitat. */
export function hatcheryUsed(s: { hatchery: readonly unknown[]; dragons: readonly { habitatId: string | null; stored?: true }[] }): number {
  return s.hatchery.length + s.dragons.filter(d => d.habitatId === null && !d.stored).length
}

export const collectEgg: Handler<'collectEgg'> = (s, a, ctx) => {
  if (a.breeder < 0 || a.breeder >= s.breeders.length) return failure('NOT_FOUND')
  const egg = s.breeders[a.breeder]!.egg
  if (!egg) return failure('BREEDER_EMPTY')
  if (ctx.nowMs < egg.readyAtMs) return failure('NOT_READY')
  if (hatcheryUsed(s) >= hatcherySlots(s.hatcheryLevel, s.hatcheryFifthSlot)) return failure('HATCHERY_FULL')
  return success({
    ...s,
    breeders: s.breeders.map((b, i) => i === a.breeder ? { ...b, egg: null } : b),
    // The hatch timer starts now, when the egg reaches its slot (§5.4).
    hatchery: [...s.hatchery, { speciesId: egg.speciesId, readyAtMs: ctx.nowMs + egg.hatchMs, xpFree: egg.xpFree }],
  })
}

/** The first finished habitat a new `element` Basic can live in with room (R26), or undefined. */
export function basicHome(s: PlayerState, catalog: Catalog, element: Element): Habitat | undefined {
  const species = getSpecies(catalog, element)
  return s.habitats.find(h => !h.stored && canLiveIn(species, h) && !isUnfinished(s, { type: 'habitat', id: h.id }) && residents(s, h.id).length < habitatSlots(h))
}

/** M2 Q3, R26: buy a Basic with Gold; it moves into the first finished habitat it can live in with room, at Lv 1. */
export const buyBasic: Handler<'buyBasic'> = (s, a, ctx) => {
  if (!isUnlocked(`basic:${a.element}`, s.level)) return failure('LEVEL_TOO_LOW')
  const home = basicHome(s, ctx.catalog, a.element)
  if (!home) return failure('NO_HABITAT_SLOT')
  const paid = spendGold(s, basicPriceGold(a.element))
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const collected = collectHabitat(paid, home.id, ctx.catalog, ctx.nowMs, ctx.preset)
  return success({
    ...collected,
    dragons: [...collected.dragons, { id: `d${s.nextId}`, speciesId: a.element, level: 1, feeds: 0, habitatId: home.id }],
    discovered: discover(s.discovered, a.element),
    nextId: s.nextId + 1,
  })
}

export const hatch: Handler<'hatch'> = (s, a, ctx) => {
  const egg = s.hatchery[a.slot]
  if (!egg) return failure('NOT_FOUND')
  if (ctx.nowMs < egg.readyAtMs) return failure('NOT_READY')
  const species = getSpecies(ctx.catalog, egg.speciesId)
  const home = s.habitats.find(h => !h.stored && canLiveIn(species, h) && !isUnfinished(s, { type: 'habitat', id: h.id }) && residents(s, h.id).length < habitatSlots(h))
  const dragon = { id: `d${s.nextId}`, speciesId: egg.speciesId, level: 1, feeds: 0, habitatId: home ? home.id : null }
  const collected = home ? collectHabitat(s, home.id, ctx.catalog, ctx.nowMs, ctx.preset) : s
  const next = {
    ...collected,
    hatchery: collected.hatchery.filter((_, i) => i !== a.slot),
    dragons: [...collected.dragons, dragon],
    discovered: discover(s.discovered, egg.speciesId),
    nextId: s.nextId + 1,
    goalStats: { ...collected.goalStats, hatches: collected.goalStats.hatches + 1 },
  }
  if (egg.xpFree) return success(next)
  // R30: a species new to the Dragon Book pays double.
  const firstTime = !s.discovered.includes(egg.speciesId)
  return success(addXp(next, HATCH_XP[species.rarity] * (firstTime ? FIRST_HATCH_XP_MULT : 1), ctx.preset, ctx.day))
}

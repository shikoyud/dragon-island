import { rollOffspring } from '../breeding'
import { hatcherySlots, nestBreedMs } from '../buildings'
import { getSpecies } from '../catalog'
import { isUnfinished } from '../construction'
import { breedTimerMs } from '../data/breeding-timers'
import { BREED_MIN_LEVEL } from '../data/dragon-levels'
import { HATCH_XP, START_BREED_XP } from '../data/xp'
import { canLiveIn, habitatSlots, residents } from '../habitat'
import { addXp } from '../progression'
import { TUTORIAL_TIMER_MS } from '../time'
import { collectHabitat } from './island-actions'
import { failure, success, type Handler } from './types'

export { BREED_MIN_LEVEL }
export { TUTORIAL_TIMER_MS }

export const startBreed: Handler<'startBreed'> = (s, a, ctx) => {
  const pa = s.dragons.find(d => d.id === a.parentA)
  const pb = s.dragons.find(d => d.id === a.parentB)
  if (!pa || !pb || pa.id === pb.id) return failure('INVALID_PARENTS')
  if (pa.level < BREED_MIN_LEVEL || pb.level < BREED_MIN_LEVEL) return failure('LEVEL_TOO_LOW')
  const nest = s.nests.findIndex(n => n.egg === null)
  if (nest < 0) return failure('NO_FREE_NEST')

  const roll = rollOffspring(pa, pb, { pity: s.pity }, ctx.catalog, ctx.rng)
  const child = getSpecies(ctx.catalog, roll.speciesId)
  const readyAtMs = ctx.nowMs + (s.tutorial.breedDone
    ? nestBreedMs(breedTimerMs(child.rarity, child.elements, ctx.preset), s.nests[nest]!.level)
    : TUTORIAL_TIMER_MS)
  const next = {
    ...s,
    nests: s.nests.map((n, i) => i === nest ? { ...n, egg: { speciesId: roll.speciesId, readyAtMs } } : n),
    pity: { ...s.pity, [roll.pairKey]: roll.rarePlus ? 0 : (s.pity[roll.pairKey] ?? 0) + 1 },
    tutorial: { ...s.tutorial, breedDone: true },
  }
  return success(addXp(next, START_BREED_XP))
}

/** Hatchery slots hold eggs and hatched dragons that found no habitat. */
export function hatcheryUsed(s: { hatchery: readonly unknown[]; dragons: readonly { habitatId: string | null }[] }): number {
  return s.hatchery.length + s.dragons.filter(d => d.habitatId === null).length
}

export const collectEgg: Handler<'collectEgg'> = (s, a, ctx) => {
  if (a.nest < 0 || a.nest >= s.nests.length) return failure('NOT_FOUND')
  const egg = s.nests[a.nest]!.egg
  if (!egg) return failure('NEST_EMPTY')
  if (ctx.nowMs < egg.readyAtMs) return failure('NOT_READY')
  if (hatcheryUsed(s) >= hatcherySlots(s.hatcheryLevel)) return failure('HATCHERY_FULL')
  const species = getSpecies(ctx.catalog, egg.speciesId)
  const readyAtMs = ctx.nowMs + (s.tutorial.hatchDone ? breedTimerMs(species.rarity, species.elements, ctx.preset) : TUTORIAL_TIMER_MS)
  return success({
    ...s,
    nests: s.nests.map((n, i) => i === a.nest ? { ...n, egg: null } : n),
    hatchery: [...s.hatchery, { speciesId: egg.speciesId, readyAtMs }],
    tutorial: { ...s.tutorial, hatchDone: true },
  })
}

export const hatch: Handler<'hatch'> = (s, a, ctx) => {
  const egg = s.hatchery[a.slot]
  if (!egg) return failure('NOT_FOUND')
  if (ctx.nowMs < egg.readyAtMs) return failure('NOT_READY')
  const species = getSpecies(ctx.catalog, egg.speciesId)
  const home = s.habitats.find(h => canLiveIn(species, h) && !isUnfinished(s, { type: 'habitat', id: h.id }) && residents(s, h.id).length < habitatSlots(h))
  const dragon = { id: `d${s.nextId}`, speciesId: egg.speciesId, level: 1, feeds: 0, habitatId: home ? home.id : null }
  const collected = home ? collectHabitat(s, home.id, ctx.catalog, ctx.nowMs) : s
  const next = {
    ...collected,
    hatchery: collected.hatchery.filter((_, i) => i !== a.slot),
    dragons: [...collected.dragons, dragon],
    nextId: s.nextId + 1,
  }
  return success(addXp(next, HATCH_XP[species.rarity]))
}

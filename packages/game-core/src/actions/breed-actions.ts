import { rollOffspring } from '../breeding'
import { hatcherySlots, nestBreedMs } from '../buildings'
import { getSpecies } from '../catalog'
import { isUnfinished } from '../construction'
import { canLiveIn, habitatSlots, residents } from '../habitat'
import { addXp } from '../progression'
import { RARITY } from '../rarity'
import { TUTORIAL_TIMER_MS } from '../time'
import { collectHabitat } from './island-actions'
import { failure, success, type Handler } from './types'

export const BREED_MIN_LEVEL = 4
export { TUTORIAL_TIMER_MS }

export const startBreed: Handler<'startBreed'> = (s, a, ctx) => {
  const pa = s.dragons.find(d => d.id === a.parentA)
  const pb = s.dragons.find(d => d.id === a.parentB)
  if (!pa || !pb || pa.id === pb.id) return failure('INVALID_PARENTS')
  if (pa.level < BREED_MIN_LEVEL || pb.level < BREED_MIN_LEVEL) return failure('LEVEL_TOO_LOW')
  const nest = s.nests.findIndex(n => n.egg === null)
  if (nest < 0) return failure('NO_FREE_NEST')

  const boost = s.oddsBoosts > 0
  const roll = rollOffspring(pa, pb, { boost, pity: s.pity }, ctx.catalog, ctx.rng)
  const rarity = getSpecies(ctx.catalog, roll.speciesId).rarity
  const readyAtMs = ctx.nowMs + (s.tutorial.breedDone ? nestBreedMs(RARITY[rarity].breedMs, s.nests[nest]!.level) : TUTORIAL_TIMER_MS)
  const next = {
    ...s,
    nests: s.nests.map((n, i) => i === nest ? { ...n, egg: { speciesId: roll.speciesId, readyAtMs } } : n),
    oddsBoosts: boost ? s.oddsBoosts - 1 : s.oddsBoosts,
    pity: { ...s.pity, [roll.pairKey]: roll.rarePlus ? 0 : (s.pity[roll.pairKey] ?? 0) + 1 },
    tutorial: { ...s.tutorial, breedDone: true },
  }
  return success(addXp(next, RARITY[rarity].xp))
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
  const rarity = getSpecies(ctx.catalog, egg.speciesId).rarity
  const readyAtMs = ctx.nowMs + (s.tutorial.hatchDone ? RARITY[rarity].hatchMs : TUTORIAL_TIMER_MS)
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
  const dragon = { id: `d${s.nextId}`, speciesId: egg.speciesId, level: 1, habitatId: home ? home.id : null }
  const collected = home ? collectHabitat(s, home.id, ctx.catalog, ctx.nowMs) : s
  const next = {
    ...collected,
    hatchery: collected.hatchery.filter((_, i) => i !== a.slot),
    dragons: [...collected.dragons, dragon],
    nextId: s.nextId + 1,
  }
  return success(addXp(next, RARITY[species.rarity].xp))
}

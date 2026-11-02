import { hatcherySlots } from '../buildings'
import { residents } from '../habitat'
import type { PlayerState, StoredMark } from '../state'
import { isStored } from '../storage'
import { hatcheryUsed } from './breed-actions'
import { collectDragonHome, collectHabitat } from './island-actions'
import { failure, success, type Handler } from './types'

/**
 * Puts a building, dragon or egg into Storage (shiko, 2026-11-01). A habitat must be empty and is collected first; a
 * building keeps its level and its timers pause (S1, S2); a dragon in a team stays out (S4); an egg keeps its time left (S5).
 */
export const putInStorage: Handler<'putInStorage'> = (s, a, ctx) => {
  const t = a.target
  const mark: StoredMark = { atMs: ctx.nowMs }
  switch (t.type) {
    case 'dragon': {
      const d = s.dragons.find(x => x.id === t.id)
      if (!d || d.stored) return failure('NOT_FOUND')
      if (s.defenceTeam?.includes(d.id) || s.pve.active?.team.includes(d.id)) return failure('INVALID_ACTION')
      const collected = collectDragonHome(s, d.id, ctx.catalog, ctx.nowMs, ctx.preset)
      return success({ ...collected, dragons: collected.dragons.map(x => x.id === d.id ? { ...x, habitatId: null, stored: true } : x) })
    }
    case 'egg': {
      const egg = s.hatchery[t.slot]
      if (!egg) return failure('NOT_FOUND')
      const stored = { speciesId: egg.speciesId, remainingMs: Math.max(0, egg.readyAtMs - ctx.nowMs), ...(egg.xpFree ? { xpFree: true } : {}) }
      return success({ ...s, hatchery: s.hatchery.filter((_, i) => i !== t.slot), storedEggs: [...(s.storedEggs ?? []), stored] })
    }
    default:
      break
  }
  if (isStored(s, t)) return failure('NOT_FOUND')
  switch (t.type) {
    case 'habitat': {
      const h = s.habitats.find(x => x.id === t.id)
      if (!h) return failure('NOT_FOUND')
      if (residents(s, h.id).length > 0) return failure('INVALID_ACTION')
      const collected = collectHabitat(s, h.id, ctx.catalog, ctx.nowMs, ctx.preset)
      return success({ ...collected, habitats: collected.habitats.map(x => x.id === h.id ? { ...x, stored: mark } : x) })
    }
    case 'farm':
      if (!s.farms[t.index]) return failure('NOT_FOUND')
      return success({ ...s, farms: s.farms.map((f, i) => i === t.index ? { ...f, stored: mark } : f) })
    case 'breeder':
      if (!s.breeders[t.index]) return failure('NOT_FOUND')
      return success({ ...s, breeders: s.breeders.map((b, i) => i === t.index ? { ...b, stored: mark } : b) })
    case 'roost':
      if (!s.roostPlacement) return failure('NOT_FOUND')
      return success({ ...s, roostStored: mark })
    case 'decoration':
      if (!s.decorations.some(d => d.id === t.id)) return failure('NOT_FOUND')
      return success({ ...s, decorations: s.decorations.map(d => d.id === t.id ? { ...d, stored: mark } : d) })
  }
}

/** Puts a stored egg back in a free Hatchery slot with the time it had left (S5). */
export const takeEgg: Handler<'takeEgg'> = (s, a, ctx) => {
  const eggs = s.storedEggs ?? []
  const egg = eggs[a.index]
  if (!egg) return failure('NOT_FOUND')
  if (hatcheryUsed(s) >= hatcherySlots(s.hatcheryLevel, s.hatcheryFifthSlot)) return failure('HATCHERY_FULL')
  const next: PlayerState = {
    ...s,
    storedEggs: eggs.filter((_, i) => i !== a.index),
    hatchery: [...s.hatchery, { speciesId: egg.speciesId, readyAtMs: ctx.nowMs + egg.remainingMs, ...(egg.xpFree ? { xpFree: true } : {}) }],
  }
  return success(next)
}

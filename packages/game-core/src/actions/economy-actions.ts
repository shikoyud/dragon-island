import type { Catalog } from '../catalog'
import { GROVE_L3, HATCHERY_FIFTH_SLOT } from '../data/breeding-buildings'
import { FARM_MAX_LEVEL } from '../data/farms'
import { HABITAT_MAX_LEVEL } from '../data/habitats'
import type { Preset } from '../data/presets'
import { placementRuleError } from '../placement-rules'
import type { PlayerState } from '../state'
import { FOOD_PACK, ownsAerie, priceMicroUsd, skipTargetReadyAt, type SkipTarget, type StoreItem } from '../store'
import { completeConstruction } from './build-actions'
import { collectHabitat } from './island-actions'
import { failure, success, type ActionError, type Handler } from './types'

function skipSlotCount(s: PlayerState, target: SkipTarget): number {
  return target === 'breeder' ? s.breeders.length : target === 'hatchery' ? s.hatchery.length
    : target === 'construction' ? s.constructions.length : s.farms.length
}

/** Typed reason an item can't be bought now, or null if it can. */
function validate(item: StoreItem, s: PlayerState, nowMs: number): ActionError | null {
  switch (item.kind) {
    case 'skip': {
      if (!Number.isInteger(item.index) || item.index < 0 || item.index >= skipSlotCount(s, item.target)) return 'NOT_FOUND'
      const readyAt = skipTargetReadyAt(s, item.target, item.index)
      return readyAt === null || readyAt <= nowMs ? 'NOTHING_TO_SKIP' : null
    }
    case 'foodPack':
      return null
    case 'habitatL5': {
      const h = s.habitats.find(x => x.id === item.habitatId)
      if (!h) return 'NOT_FOUND'
      if (h.element === 'aerie' || h.level >= HABITAT_MAX_LEVEL) return 'MAX_LEVEL'
      return h.level === HABITAT_MAX_LEVEL - 1 ? null : 'INVALID_ACTION'
    }
    case 'farmL5': {
      const f = s.farms[item.index]
      if (!f) return 'NOT_FOUND'
      if (f.level >= FARM_MAX_LEVEL) return 'MAX_LEVEL'
      return f.level === FARM_MAX_LEVEL - 1 ? null : 'INVALID_ACTION'
    }
    // The Aerie takes a habitat footprint, on any island.
    case 'goldenAerie':
      if (ownsAerie(s)) return 'AERIE_EXISTS'
      return placementRuleError(s, { kind: 'habitat', element: 'terra' }, item.placement)
    case 'hatcheryL5':
      if (s.hatcheryFifthSlot) return 'MAX_LEVEL'
      return s.level < HATCHERY_FIFTH_SLOT.minPl ? 'LEVEL_TOO_LOW' : null
    case 'groveL3': {
      const g = s.breeders[item.index]
      if (!g || g.kind !== 'grove') return 'NOT_FOUND'
      if (g.level >= GROVE_L3.level) return 'MAX_LEVEL'
      if (g.level !== GROVE_L3.level - 1) return 'INVALID_ACTION'
      return s.level < GROVE_L3.minPl ? 'LEVEL_TOO_LOW' : null
    }
  }
}

function applyItem(item: StoreItem, s: PlayerState, nowMs: number, c: Catalog, preset: Preset): PlayerState {
  switch (item.kind) {
    case 'skip': {
      const at = <T extends { readyAtMs: number } | null>(xs: T[]) =>
        xs.map((x, i) => i === item.index && x ? { ...x, readyAtMs: nowMs } : x)
      if (item.target === 'breeder') return { ...s, breeders: s.breeders.map((b, i) => i === item.index && b.egg ? { ...b, egg: { ...b.egg, readyAtMs: nowMs } } : b) }
      if (item.target === 'construction') {
        return completeConstruction({ ...s, constructions: at(s.constructions) }, item.index, c, nowMs, preset)
      }
      if (item.target === 'hatchery') return { ...s, hatchery: at(s.hatchery) }
      return { ...s, farms: at(s.farms) }
    }
    case 'foodPack': return { ...s, food: s.food + FOOD_PACK }
    case 'habitatL5': {
      // A new level changes the cap, so Gold accrued so far is collected first.
      const collected = collectHabitat(s, item.habitatId, c, nowMs, preset)
      return { ...collected, habitats: collected.habitats.map(h => h.id === item.habitatId ? { ...h, level: HABITAT_MAX_LEVEL } : h) }
    }
    case 'farmL5':
      return { ...s, farms: s.farms.map((f, i) => i === item.index ? { ...f, level: FARM_MAX_LEVEL } : f) }
    case 'goldenAerie':
      return {
        ...s,
        habitats: [...s.habitats, { id: `h${s.nextId}`, element: 'aerie', level: HABITAT_MAX_LEVEL, lastCollectedMs: nowMs, placement: item.placement }],
        nextId: s.nextId + 1,
      }
    case 'hatcheryL5':
      return { ...s, hatcheryFifthSlot: true }
    case 'groveL3':
      return { ...s, breeders: s.breeders.map((b, i) => i === item.index ? { ...b, level: GROVE_L3.level } : b) }
  }
}

/** Applies a store item; the server settles the token charge from the effect. */
export const buy: Handler<'buy'> = (s, a, ctx) => {
  const error = validate(a.item, s, ctx.nowMs)
  if (error) return failure(error)
  const microUsd = priceMicroUsd(a.item, s, ctx.nowMs)
  if (microUsd === null) return failure('NOT_FOUND')
  return success(applyItem(a.item, s, ctx.nowMs, ctx.catalog, ctx.preset), [{ type: 'charge', microUsd }])
}

import type { Catalog } from '../catalog'
import type { PlayerState } from '../state'
import { FOOD_PACK, priceMicroUsd, skipTargetReadyAt, type SkipTarget, type StoreItem } from '../store'
import { completeConstruction } from './build-actions'
import { failure, success, type ActionError, type Handler } from './types'

function skipSlotCount(s: PlayerState, target: SkipTarget): number {
  return target === 'nest' ? s.nests.length : target === 'hatchery' ? s.hatchery.length
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
  }
}

function applyItem(item: StoreItem, s: PlayerState, nowMs: number, c: Catalog): PlayerState {
  switch (item.kind) {
    case 'skip': {
      const at = <T extends { readyAtMs: number } | null>(xs: T[]) =>
        xs.map((x, i) => i === item.index && x ? { ...x, readyAtMs: nowMs } : x)
      if (item.target === 'nest') return { ...s, nests: s.nests.map((n, i) => i === item.index && n.egg ? { ...n, egg: { ...n.egg, readyAtMs: nowMs } } : n) }
      if (item.target === 'construction') {
        return completeConstruction({ ...s, constructions: at(s.constructions) }, item.index, c, nowMs)
      }
      if (item.target === 'hatchery') return { ...s, hatchery: at(s.hatchery) }
      return { ...s, farms: at(s.farms) }
    }
    case 'foodPack': return { ...s, food: s.food + FOOD_PACK }
  }
}

/** Applies a store item; the server settles the token charge from the effect. */
export const buy: Handler<'buy'> = (s, a, ctx) => {
  const error = validate(a.item, s, ctx.nowMs)
  if (error) return failure(error)
  const microUsd = priceMicroUsd(a.item, s, ctx.nowMs)
  if (microUsd === null) return failure('NOT_FOUND')
  return success(applyItem(a.item, s, ctx.nowMs, ctx.catalog), [{ type: 'charge', microUsd }])
}

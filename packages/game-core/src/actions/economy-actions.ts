import { MAX_DRAGON_LEVEL } from '../dragon'
import { HOARD, HOARD_MIN_PLAYER_LEVEL, MICRO_USD_PER_GOLD, remainingSellMicroUsd, utcDay } from '../sell'
import type { PlayerState } from '../state'
import { FOOD_PACK, MAX_NESTS, priceMicroUsd, skipTargetReadyAt, type StoreItem } from '../store'
import { failure, success, type ActionError, type Handler } from './types'

/** Sells eligible gold for a token payout within the Hoard's daily limit. */
export const sellGold: Handler<'sellGold'> = (s, a, ctx) => {
  if (!s.earningUnlocked) return failure('EARNING_LOCKED')
  if (s.hoardLevel === 0) return failure('NO_HOARD')
  if (!Number.isSafeInteger(a.gold) || a.gold <= 0) return failure('INVALID_AMOUNT')
  if (a.gold > s.eligibleGold) return failure('INSUFFICIENT_GOLD')
  const microUsd = a.gold * MICRO_USD_PER_GOLD
  if (microUsd > remainingSellMicroUsd(s, ctx.nowMs)) return failure('SELL_LIMIT_REACHED')
  const day = utcDay(ctx.nowMs)
  const soldToday = s.sell.day === day ? s.sell.soldTodayMicroUsd : 0
  return success({
    ...s,
    gold: s.gold - a.gold,
    eligibleGold: s.eligibleGold - a.gold,
    sell: { day, soldTodayMicroUsd: soldToday + microUsd },
    ledger: { ...s.ledger, soldMicroUsd: s.ledger.soldMicroUsd + microUsd },
  }, [{ type: 'payout', microUsd }])
}

function skipSlotCount(s: PlayerState, target: 'nest' | 'hatchery' | 'farm'): number {
  return target === 'nest' ? s.nests.length : target === 'hatchery' ? s.hatchery.length : s.farms.length
}

/** Typed reason an item can't be bought now, or null if it can. */
function validate(item: StoreItem, s: PlayerState, nowMs: number): ActionError | null {
  switch (item.kind) {
    case 'skip': {
      if (!Number.isInteger(item.index) || item.index < 0 || item.index >= skipSlotCount(s, item.target)) return 'NOT_FOUND'
      const readyAt = skipTargetReadyAt(s, item.target, item.index)
      return readyAt === null || readyAt <= nowMs ? 'NOTHING_TO_SKIP' : null
    }
    case 'nest':
      return s.nests.length >= MAX_NESTS ? 'MAX_NESTS' : null
    case 'levelUp': {
      const d = s.dragons.find(x => x.id === item.dragonId)
      if (!d) return 'NOT_FOUND'
      return d.level >= MAX_DRAGON_LEVEL ? 'MAX_LEVEL' : null
    }
    case 'hoard':
      if (s.hoardLevel >= HOARD.length) return 'MAX_LEVEL'
      return s.level < HOARD_MIN_PLAYER_LEVEL ? 'LEVEL_TOO_LOW' : null
    case 'foodPack':
    case 'oddsBoost':
      return null
  }
}

function applyItem(item: StoreItem, s: PlayerState, nowMs: number): PlayerState {
  switch (item.kind) {
    case 'skip': {
      const at = <T extends { readyAtMs: number }>(xs: T[]) => xs.map((x, i) => i === item.index ? { ...x, readyAtMs: nowMs } : x)
      if (item.target === 'nest') return { ...s, nests: s.nests.map((e, i) => i === item.index && e ? { ...e, readyAtMs: nowMs } : e) }
      if (item.target === 'hatchery') return { ...s, hatchery: at(s.hatchery) }
      return { ...s, farms: at(s.farms) }
    }
    case 'nest': return { ...s, nests: [...s.nests, null] }
    case 'foodPack': return { ...s, food: s.food + FOOD_PACK }
    case 'levelUp': return { ...s, dragons: s.dragons.map(d => d.id === item.dragonId ? { ...d, level: d.level + 1 } : d) }
    case 'oddsBoost': return { ...s, oddsBoosts: s.oddsBoosts + 1 }
    case 'hoard': return { ...s, hoardLevel: s.hoardLevel + 1 }
  }
}

/** Applies a store item; the server settles the token charge from the effect. */
export const buy: Handler<'buy'> = (s, a, ctx) => {
  const error = validate(a.item, s, ctx.nowMs)
  if (error) return failure(error)
  const microUsd = priceMicroUsd(a.item, s, ctx.nowMs)
  if (microUsd === null) return failure('NOT_FOUND')
  return success(applyItem(a.item, s, ctx.nowMs), [{ type: 'charge', microUsd }])
}

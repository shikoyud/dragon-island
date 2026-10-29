import { getSpecies, type Catalog } from '../catalog'
import { foodToNextLevel, MAX_DRAGON_LEVEL } from '../dragon'
import { isUnfinished } from '../construction'
import { canLiveIn, habitatSlots, residents, storedGold } from '../habitat'
import { addXp } from '../progression'
import { RARITY } from '../rarity'
import type { PlayerState } from '../state'
import { earnGold, spendGold } from '../wallet'
import { failure, success, type Handler } from './types'

/**
 * Collects a habitat's stored gold as eligible gold; never moves `lastCollectedMs` back.
 * Every change to a habitat's income rate or cap (residents, levels, upgrades)
 * collects first, so accrued gold is neither lost nor re-rated.
 */
export function collectHabitat(s: PlayerState, habitatId: string, c: Catalog, nowMs: number): PlayerState {
  const h = s.habitats.find(x => x.id === habitatId)!
  const gold = storedGold(h, residents(s, habitatId), c, nowMs)
  const habitats = s.habitats.map(x => x.id === habitatId ? { ...x, lastCollectedMs: Math.max(x.lastCollectedMs, nowMs) } : x)
  return earnGold({ ...s, habitats }, gold, true)
}

/** Collects the habitat a dragon lives in, if any. */
export function collectDragonHome(s: PlayerState, dragonId: string, c: Catalog, nowMs: number): PlayerState {
  const home = s.dragons.find(d => d.id === dragonId)?.habitatId
  return home ? collectHabitat(s, home, c, nowMs) : s
}

export const collectGold: Handler<'collectGold'> = (s, a, ctx) => {
  if (!s.habitats.some(h => h.id === a.habitatId)) return failure('NOT_FOUND')
  return success(collectHabitat(s, a.habitatId, ctx.catalog, ctx.nowMs))
}

export const moveDragon: Handler<'moveDragon'> = (s, a, ctx) => {
  const d = s.dragons.find(x => x.id === a.dragonId)
  const target = s.habitats.find(x => x.id === a.habitatId)
  if (!d || !target) return failure('NOT_FOUND')
  if (d.habitatId === target.id) return success(s)
  if (isUnfinished(s, { type: 'habitat', id: target.id })) return failure('UNDER_CONSTRUCTION')
  if (!canLiveIn(getSpecies(ctx.catalog, d.speciesId), target)) return failure('ELEMENT_MISMATCH')
  if (residents(s, target.id).length >= habitatSlots(target)) return failure('NO_HABITAT_SLOT')
  const collected = collectHabitat(collectDragonHome(s, d.id, ctx.catalog, ctx.nowMs), target.id, ctx.catalog, ctx.nowMs)
  return success({ ...collected, dragons: collected.dragons.map(x => x.id === d.id ? { ...x, habitatId: target.id } : x) })
}

export const feed: Handler<'feed'> = (s, a, ctx) => {
  const d = s.dragons.find(x => x.id === a.dragonId)
  if (!d) return failure('NOT_FOUND')
  if (d.level >= MAX_DRAGON_LEVEL) return failure('MAX_LEVEL')
  const cost = foodToNextLevel(d.level)
  if (s.food < cost) return failure('INSUFFICIENT_FOOD')
  const collected = collectDragonHome(s, d.id, ctx.catalog, ctx.nowMs)
  const fed = {
    ...collected,
    food: collected.food - cost,
    dragons: collected.dragons.map(x => x.id === d.id ? { ...x, level: x.level + 1 } : x),
  }
  return success(addXp(fed, Math.floor(cost / 10)))
}

/** Sale gold is ineligible; a player always keeps two dragons so they can breed. */
export const sellDragon: Handler<'sellDragon'> = (s, a, ctx) => {
  const d = s.dragons.find(x => x.id === a.dragonId)
  if (!d) return failure('NOT_FOUND')
  if (s.dragons.length <= 2) return failure('LAST_DRAGONS')
  const gold = RARITY[getSpecies(ctx.catalog, d.speciesId).rarity].sellGold
  const collected = collectDragonHome(s, d.id, ctx.catalog, ctx.nowMs)
  const defenceTeam = s.defenceTeam?.includes(d.id) ? null : s.defenceTeam
  return success(earnGold({ ...collected, defenceTeam, dragons: collected.dragons.filter(x => x.id !== d.id) }, gold, false))
}

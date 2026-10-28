import { getSpecies, type Catalog } from '../catalog'
import { foodToNextLevel, MAX_DRAGON_LEVEL } from '../dragon'
import { canLiveIn, HABITAT_LEVELS, habitatBuildCost, habitatSlots, maxHabitats, residents, storedGold } from '../habitat'
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

export const buildHabitat: Handler<'buildHabitat'> = (s, a, ctx) => {
  if (s.habitats.length >= maxHabitats(s.level)) return failure('HABITAT_LIMIT')
  const paid = spendGold(s, habitatBuildCost(s, a.element))
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const habitat = { id: `h${s.nextId}`, element: a.element, level: 1, lastCollectedMs: ctx.nowMs }
  return success({ ...paid, habitats: [...paid.habitats, habitat], nextId: s.nextId + 1 })
}

export const upgradeHabitat: Handler<'upgradeHabitat'> = (s, a, ctx) => {
  const h = s.habitats.find(x => x.id === a.habitatId)
  if (!h) return failure('NOT_FOUND')
  const cost = HABITAT_LEVELS[h.level - 1]!.upgradeCost
  if (cost === null) return failure('MAX_LEVEL')
  const paid = spendGold(collectHabitat(s, h.id, ctx.catalog, ctx.nowMs), cost)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  return success({ ...paid, habitats: paid.habitats.map(x => x.id === h.id ? { ...x, level: x.level + 1 } : x) })
}

export const moveDragon: Handler<'moveDragon'> = (s, a, ctx) => {
  const d = s.dragons.find(x => x.id === a.dragonId)
  const target = s.habitats.find(x => x.id === a.habitatId)
  if (!d || !target) return failure('NOT_FOUND')
  if (d.habitatId === target.id) return success(s)
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

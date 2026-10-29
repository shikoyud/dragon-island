import { upgradeInfo } from '../buildings'
import type { Catalog } from '../catalog'
import { FARM_PLOT_BUILD_MS, NEXUS_BUILD_MS, NEXUS_COST, isUnderConstruction, newHabitatTimerMs, startConstruction } from '../construction'
import { DECORATIONS, decorationRefund } from '../decorations'
import { MAX_PLOTS, plotCost } from '../farm'
import { habitatBuildCost, maxHabitats } from '../habitat'
import { FOOTPRINT, outerIslandsUnlocked, placementError, type Footprint, type OccupantRef } from '../island'
import type { PlayerState } from '../state'
import { earnGold, spendGold } from '../wallet'
import { clearReward } from '../obstacles'
import { addXp } from '../progression'
import { collectHabitat } from './island-actions'
import { failure, success, type Handler } from './types'

export const placeBuilding: Handler<'placeBuilding'> = (s, a, ctx) => {
  const b = a.building
  const size: Footprint = b.kind === 'decoration' ? DECORATIONS[b.decoration].size : b.kind === 'farm' ? FOOTPRINT.farm : FOOTPRINT.habitat
  const bad = placementError(s, a.placement, size)
  if (bad) return failure(bad)
  if (b.kind === 'decoration') {
    const d = DECORATIONS[b.decoration]
    if (s.level < d.minLevel) return failure('LEVEL_TOO_LOW')
    if (d.island && a.placement.island !== d.island) return failure('WRONG_ISLAND')
  }
  if (b.kind === 'nexus') {
    if (a.placement.island !== 'dawnspire') return failure('WRONG_ISLAND')
    if (s.habitats.some(h => h.element === 'any')) return failure('NEXUS_EXISTS')
  }
  const habitatsOwned = s.habitats.filter(h => h.element !== 'any').length
  if (b.kind === 'habitat' && habitatsOwned >= maxHabitats(s.level, outerIslandsUnlocked(s))) return failure('HABITAT_LIMIT')
  if (b.kind === 'farm' && s.farms.length >= MAX_PLOTS) return failure('MAX_PLOTS')

  const cost = b.kind === 'decoration' ? DECORATIONS[b.decoration].cost
    : b.kind === 'habitat' ? habitatBuildCost(s, b.element)
    : b.kind === 'farm' ? plotCost(s.farms.length)
    : NEXUS_COST
  const paid = spendGold(s, cost)
  if (!paid) return failure('INSUFFICIENT_GOLD')

  if (b.kind === 'decoration') {
    return success({
      ...paid,
      decorations: [...paid.decorations, { id: `c${s.nextId}`, kind: b.decoration, placement: a.placement }],
      nextId: s.nextId + 1,
    })
  }
  if (b.kind === 'farm') {
    const index = s.farms.length
    const started = startConstruction(paid, { kind: 'build', building: { type: 'farm', index } }, FARM_PLOT_BUILD_MS[index - 2]!, ctx.nowMs)
    if (!started) return failure('BUILDERS_BUSY')
    return success({ ...started, farms: [...started.farms, { crop: null, readyAtMs: 0, level: 1, placement: a.placement }] })
  }
  const id = `h${s.nextId}`
  const isNexus = b.kind === 'nexus'
  const started = startConstruction(paid, { kind: 'build', building: { type: 'habitat', id } },
    isNexus ? NEXUS_BUILD_MS : newHabitatTimerMs(habitatsOwned), ctx.nowMs)
  if (!started) return failure('BUILDERS_BUSY')
  const habitat = { id, element: isNexus ? 'any' as const : b.element, level: isNexus ? 5 : 1, lastCollectedMs: ctx.nowMs, placement: a.placement }
  return success({ ...started, habitats: [...started.habitats, habitat], nextId: s.nextId + 1 })
}

function footprintOf(s: PlayerState, t: OccupantRef): Footprint | null {
  switch (t.type) {
    case 'habitat': return s.habitats.some(h => h.id === t.id) ? FOOTPRINT.habitat : null
    case 'farm': return s.farms[t.index] ? FOOTPRINT.farm : null
    case 'nest': return s.nests[t.index] ? FOOTPRINT.nest : null
    case 'hatchery': return FOOTPRINT.hatchery
    case 'hoard': return s.hoardLevel > 0 && s.hoardPlacement ? FOOTPRINT.hoard : null
    case 'decoration': {
      const d = s.decorations.find(x => x.id === t.id)
      return d ? DECORATIONS[d.kind].size : null
    }
    default: return null
  }
}

export const moveBuilding: Handler<'moveBuilding'> = (s, a) => {
  const t = a.target
  const size = footprintOf(s, t)
  if (size === null) return failure('NOT_FOUND')
  if ((t.type === 'hatchery' || t.type === 'hoard') && a.placement.island !== 'home') return failure('WRONG_ISLAND')
  if (t.type === 'habitat' && s.habitats.find(h => h.id === t.id)!.element === 'any' && a.placement.island !== 'dawnspire') return failure('WRONG_ISLAND')
  if (t.type === 'decoration') {
    const only = DECORATIONS[s.decorations.find(x => x.id === t.id)!.kind].island
    if (only && a.placement.island !== only) return failure('WRONG_ISLAND')
  }
  const bad = placementError(s, a.placement, size, t)
  if (bad) return failure(bad)
  const p = a.placement
  switch (t.type) {
    case 'habitat': return success({ ...s, habitats: s.habitats.map(h => h.id === t.id ? { ...h, placement: p } : h) })
    case 'farm': return success({ ...s, farms: s.farms.map((f, i) => i === t.index ? { ...f, placement: p } : f) })
    case 'nest': return success({ ...s, nests: s.nests.map((n, i) => i === t.index ? { ...n, placement: p } : n) })
    case 'hatchery': return success({ ...s, hatcheryPlacement: p })
    case 'hoard': return success({ ...s, hoardPlacement: p })
    default: return success({ ...s, decorations: s.decorations.map(d => d.id === t.id ? { ...d, placement: p } : d) })
  }
}

export const removeDecoration: Handler<'removeDecoration'> = (s, a) => {
  const d = s.decorations.find(x => x.id === a.id)
  if (!d) return failure('NOT_FOUND')
  return success(earnGold({ ...s, decorations: s.decorations.filter(x => x.id !== a.id) }, decorationRefund(d.kind), false))
}

export const startUpgrade: Handler<'startUpgrade'> = (s, a, ctx) => {
  const ref = a.building
  const exists = ref.type === 'habitat' ? s.habitats.some(h => h.id === ref.id)
    : ref.type === 'farm' ? s.farms[ref.index] !== undefined
    : ref.type === 'nest' ? s.nests[ref.index] !== undefined
    : true
  if (!exists) return failure('NOT_FOUND')
  if (isUnderConstruction(s, ref)) return failure('UNDER_CONSTRUCTION')
  const info = upgradeInfo(s, ref)
  if (!info) return failure('MAX_LEVEL')
  if (s.level < info.minLevel) return failure('LEVEL_TOO_LOW')
  const paid = spendGold(s, info.cost)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const started = startConstruction(paid, { kind: 'upgrade', building: ref }, info.timerMs, ctx.nowMs)
  if (!started) return failure('BUILDERS_BUSY')
  return success(started)
}

/** Applies construction `index` (which must be ready); shared by finishConstruction and the construction skip. */
export function completeConstruction(s: PlayerState, index: number, c: Catalog, nowMs: number): PlayerState {
  const con = s.constructions[index]!
  const rest = { ...s, constructions: s.constructions.filter((_, i) => i !== index) }
  if (con.kind === 'build') return rest
  if (con.kind === 'clear') {
    const o = rest.islands.obstacles.find(x => x.id === con.obstacleId)
    const cleared = { ...rest, islands: { ...rest.islands, obstacles: rest.islands.obstacles.filter(x => x.id !== con.obstacleId) } }
    if (!o) return cleared
    const reward = clearReward(o)
    return addXp({ ...cleared, food: cleared.food + reward.food }, reward.xp)
  }
  const ref = con.building
  switch (ref.type) {
    case 'habitat': {
      const collected = collectHabitat(rest, ref.id, c, nowMs)
      return { ...collected, habitats: collected.habitats.map(h => h.id === ref.id ? { ...h, level: h.level + 1 } : h) }
    }
    case 'farm': return { ...rest, farms: rest.farms.map((f, i) => i === ref.index ? { ...f, level: f.level + 1 } : f) }
    case 'nest': return { ...rest, nests: rest.nests.map((n, i) => i === ref.index ? { ...n, level: n.level + 1 } : n) }
    case 'hatchery': return { ...rest, hatcheryLevel: rest.hatcheryLevel + 1 }
  }
}

export const finishConstruction: Handler<'finishConstruction'> = (s, a, ctx) => {
  const con = s.constructions[a.index]
  if (!con) return failure('NOT_FOUND')
  if (ctx.nowMs < con.readyAtMs) return failure('NOT_READY')
  return success(completeConstruction(s, a.index, ctx.catalog, ctx.nowMs))
}

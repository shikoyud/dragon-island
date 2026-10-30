import { upgradeInfo } from '../buildings'
import type { Catalog } from '../catalog'
import type { Preset } from '../data/presets'
import { FARM_PLOT_BUILD_MS, isUnderConstruction, startConstruction } from '../construction'
import { HABITATS, habitatBuildMs } from '../data/habitats'
import { DECORATIONS, decorationRefund } from '../decorations'
import { MAX_PLOTS, plotCost } from '../farm'
import { placementRuleError } from '../placement-rules'
import type { PlayerState } from '../state'
import { earnGold, spendGold } from '../wallet'
import { clearReward } from '../obstacles'
import { addXp } from '../progression'
import { collectHabitat } from './island-actions'
import { failure, success, type Handler } from './types'

export const placeBuilding: Handler<'placeBuilding'> = (s, a, ctx) => {
  const b = a.building
  const bad = placementRuleError(s, b, a.placement)
  if (bad) return failure(bad)
  if (b.kind === 'decoration' && s.level < DECORATIONS[b.decoration].minLevel) return failure('LEVEL_TOO_LOW')
  if (b.kind === 'habitat' && s.level < HABITATS[b.element].unlockPl) return failure('LEVEL_TOO_LOW')
  if (b.kind === 'farm' && s.farms.length >= MAX_PLOTS) return failure('MAX_PLOTS')

  const cost = b.kind === 'decoration' ? DECORATIONS[b.decoration].cost
    : b.kind === 'habitat' ? HABITATS[b.element].buildGold
    : plotCost(s.farms.length)
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
  const started = startConstruction(paid, { kind: 'build', building: { type: 'habitat', id } }, habitatBuildMs(b.element, ctx.preset), ctx.nowMs)
  if (!started) return failure('BUILDERS_BUSY')
  const habitat = { id, element: b.element, level: 1, lastCollectedMs: ctx.nowMs, placement: a.placement }
  return success({ ...started, habitats: [...started.habitats, habitat], nextId: s.nextId + 1 })
}

export const moveBuilding: Handler<'moveBuilding'> = (s, a) => {
  const t = a.target
  const bad = placementRuleError(s, { kind: 'move', target: t }, a.placement)
  if (bad) return failure(bad)
  const p = a.placement
  switch (t.type) {
    case 'habitat': return success({ ...s, habitats: s.habitats.map(h => h.id === t.id ? { ...h, placement: p } : h) })
    case 'farm': return success({ ...s, farms: s.farms.map((f, i) => i === t.index ? { ...f, placement: p } : f) })
    case 'nest': return success({ ...s, nests: s.nests.map((n, i) => i === t.index ? { ...n, placement: p } : n) })
    case 'hatchery': return success({ ...s, hatcheryPlacement: p })
    default: return success({ ...s, decorations: s.decorations.map(d => d.id === t.id ? { ...d, placement: p } : d) })
  }
}

export const removeDecoration: Handler<'removeDecoration'> = (s, a) => {
  const d = s.decorations.find(x => x.id === a.id)
  if (!d) return failure('NOT_FOUND')
  return success(earnGold({ ...s, decorations: s.decorations.filter(x => x.id !== a.id) }, decorationRefund(d.kind)))
}

export const startUpgrade: Handler<'startUpgrade'> = (s, a, ctx) => {
  const ref = a.building
  const exists = ref.type === 'habitat' ? s.habitats.some(h => h.id === ref.id)
    : ref.type === 'farm' ? s.farms[ref.index] !== undefined
    : ref.type === 'nest' ? s.nests[ref.index] !== undefined
    : true
  if (!exists) return failure('NOT_FOUND')
  if (isUnderConstruction(s, ref)) return failure('UNDER_CONSTRUCTION')
  const info = upgradeInfo(s, ref, ctx.preset)
  if (!info) return failure('MAX_LEVEL')
  if (s.level < info.minLevel) return failure('LEVEL_TOO_LOW')
  const paid = spendGold(s, info.cost)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const started = startConstruction(paid, { kind: 'upgrade', building: ref }, info.timerMs, ctx.nowMs)
  if (!started) return failure('BUILDERS_BUSY')
  return success(started)
}

/** Applies construction `index` (which must be ready); shared by finishConstruction and the construction skip. */
export function completeConstruction(s: PlayerState, index: number, c: Catalog, nowMs: number, preset: Preset): PlayerState {
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
      const collected = collectHabitat(rest, ref.id, c, nowMs, preset)
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
  return success(completeConstruction(s, a.index, ctx.catalog, ctx.nowMs, ctx.preset))
}

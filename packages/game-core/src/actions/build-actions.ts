import { upgradeInfo } from '../buildings'
import type { Catalog } from '../catalog'
import type { Preset } from '../data/presets'
import { isUnderConstruction, startConstruction } from '../construction'
import { BREEDER_LEVELS } from '../data/breeding-buildings'
import { FIRST_FARM_CLASSIC_MS, MAX_FARMS } from '../data/farms'
import { HABITATS, habitatBuildMs } from '../data/habitats'
import { ROOST_TIERS } from '../data/roost'
import { isUnlocked, type UnlockKey } from '../data/unlocks'
import { DECORATIONS, decorationRefund } from '../decorations'
import { farmBuildGold } from '../farm'
import { placementRuleError } from '../placement-rules'
import type { PlayerState } from '../state'
import { earnGold, spendGold } from '../wallet'
import { clearReward, rollDrop } from '../obstacles'
import type { Rng } from '../rng'
import { addXp, payBuildXp } from '../progression'
import { collectHabitat } from './island-actions'
import { takeOut } from '../storage'
import { failure, success, type Handler } from './types'

export const placeBuilding: Handler<'placeBuilding'> = (s, a, ctx) => {
  const b = a.building
  const bad = placementRuleError(s, b, a.placement)
  if (bad) return failure(bad)
  if (b.kind === 'decoration' && s.level < DECORATIONS[b.decoration].minLevel) return failure('LEVEL_TOO_LOW')
  if (b.kind === 'habitat' && !isUnlocked(`habitat:${b.element}`, s.level)) return failure('LEVEL_TOO_LOW')
  if (b.kind === 'farm' && s.farms.length >= MAX_FARMS) return failure('MAX_PLOTS')
  if (b.kind === 'farm' && !isUnlocked(`farm:${s.farms.length + 1}` as UnlockKey, s.level)) return failure('LEVEL_TOO_LOW')
  if (b.kind === 'roost' && s.roostPlacement !== null) return failure('MAX_LEVEL')
  if (b.kind === 'roost' && !isUnlocked('roost:1', s.level)) return failure('LEVEL_TOO_LOW')
  const grove = BREEDER_LEVELS.grove[0]!
  const roost = ROOST_TIERS[0]!
  if (b.kind === 'grove' && s.breeders.some(x => x.kind === 'grove')) return failure('MAX_LEVEL')
  if (b.kind === 'grove' && !isUnlocked('grove:1', s.level)) return failure('LEVEL_TOO_LOW')

  const cost = b.kind === 'decoration' ? DECORATIONS[b.decoration].cost
    : b.kind === 'habitat' ? HABITATS[b.element].buildGold
    : b.kind === 'grove' ? grove.gold!
    : b.kind === 'roost' ? roost.gold
    : farmBuildGold(s.farms.length + 1)
  const paid = spendGold(s, cost)
  if (!paid) return failure('INSUFFICIENT_GOLD')

  if (b.kind === 'roost') {
    // The tier rises when the build finishes (R33), so the level cap waits for it.
    const started = startConstruction(paid, { kind: 'build', building: { type: 'roost' } }, Math.floor(roost.classicMs / ctx.preset.timerDiv), ctx.nowMs)
    if (!started) return failure('BUILDERS_BUSY')
    return success(payBuildXp({ ...started, roostPlacement: a.placement }, cost, s, ctx.preset, ctx.day))
  }

  if (b.kind === 'grove') {
    const index = s.breeders.length
    const started = startConstruction(paid, { kind: 'build', building: { type: 'breeder', index } }, Math.floor(grove.classicMs / ctx.preset.timerDiv), ctx.nowMs)
    if (!started) return failure('BUILDERS_BUSY')
    const built = { ...started, breeders: [...started.breeders, { kind: 'grove' as const, egg: null, level: 1, placement: a.placement }] }
    return success(payBuildXp(built, cost, s, ctx.preset, ctx.day))
  }

  if (b.kind === 'decoration') {
    return success({
      ...paid,
      decorations: [...paid.decorations, { id: `c${s.nextId}`, kind: b.decoration, placement: a.placement }],
      nextId: s.nextId + 1,
    })
  }
  if (b.kind === 'farm') {
    const index = s.farms.length
    const started = startConstruction(paid, { kind: 'build', building: { type: 'farm', index } }, Math.floor(FIRST_FARM_CLASSIC_MS / ctx.preset.timerDiv), ctx.nowMs)
    if (!started) return failure('BUILDERS_BUSY')
    const built = { ...started, farms: [...started.farms, { crop: null, readyAtMs: 0, level: 1, placement: a.placement }] }
    return success(payBuildXp(built, cost, s, ctx.preset, ctx.day))
  }
  const id = `h${s.nextId}`
  const started = startConstruction(paid, { kind: 'build', building: { type: 'habitat', id } }, habitatBuildMs(b.element, ctx.preset), ctx.nowMs)
  if (!started) return failure('BUILDERS_BUSY')
  const habitat = { id, element: b.element, level: 1, lastCollectedMs: ctx.nowMs, placement: a.placement }
  const built = { ...started, habitats: [...started.habitats, habitat], nextId: s.nextId + 1 }
  return success(payBuildXp(built, cost, s, ctx.preset, ctx.day))
}

export const moveBuilding: Handler<'moveBuilding'> = (st, a, ctx) => {
  const t = a.target
  const bad = placementRuleError(st, { kind: 'move', target: t }, a.placement)
  if (bad) return failure(bad)
  // Placing from Storage is this same Move, free (S3).
  const s = takeOut(st, t, ctx.nowMs)
  const p = a.placement
  switch (t.type) {
    case 'habitat': return success({ ...s, habitats: s.habitats.map(h => h.id === t.id ? { ...h, placement: p } : h) })
    case 'farm': return success({ ...s, farms: s.farms.map((f, i) => i === t.index ? { ...f, placement: p } : f) })
    case 'breeder': return success({ ...s, breeders: s.breeders.map((b, i) => i === t.index ? { ...b, placement: p } : b) })
    case 'hatchery': return success({ ...s, hatcheryPlacement: p })
    case 'roost': return success({ ...s, roostPlacement: p })
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
    : ref.type === 'breeder' ? s.breeders[ref.index] !== undefined
    : ref.type === 'roost' ? s.roostPlacement !== null
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
  return success(payBuildXp(started, info.cost, s, ctx.preset, ctx.day))
}

/** Applies construction `index` (which must be ready); shared by finishConstruction and the construction skip. */
export function completeConstruction(s: PlayerState, index: number, c: Catalog, nowMs: number, preset: Preset, day: number, rng: Rng): PlayerState {
  const con = s.constructions[index]!
  const rest = { ...s, constructions: s.constructions.filter((_, i) => i !== index) }
  if (con.kind === 'build') return con.building.type === 'roost' ? { ...rest, roostTier: ROOST_TIERS[0]!.tier } : rest
  if (con.kind === 'clear') {
    const o = rest.islands.obstacles.find(x => x.id === con.obstacleId)
    const cleared = { ...rest, islands: { ...rest.islands, obstacles: rest.islands.obstacles.filter(x => x.id !== con.obstacleId) } }
    if (!o) return cleared
    // R54: the drop rolls here, so every path that completes a clear pays it once.
    const drop = rollDrop(o.kind, rng)
    const dropped: PlayerState = {
      ...cleared,
      gold: cleared.gold + (drop.gold ?? 0),
      food: cleared.food + (drop.food ?? 0),
      speedUps: drop.token ? { ...cleared.speedUps, [drop.token]: cleared.speedUps[drop.token] + 1 } : cleared.speedUps,
    }
    return addXp(dropped, clearReward(o).xp, preset, day)
  }
  const ref = con.building
  switch (ref.type) {
    case 'habitat': {
      const collected = collectHabitat(rest, ref.id, c, nowMs, preset)
      return { ...collected, habitats: collected.habitats.map(h => h.id === ref.id ? { ...h, level: h.level + 1 } : h) }
    }
    case 'farm': return { ...rest, farms: rest.farms.map((f, i) => i === ref.index ? { ...f, level: f.level + 1 } : f) }
    case 'breeder': return { ...rest, breeders: rest.breeders.map((b, i) => i === ref.index ? { ...b, level: b.level + 1 } : b) }
    case 'hatchery': return { ...rest, hatcheryLevel: rest.hatcheryLevel + 1 }
    case 'roost': return { ...rest, roostTier: rest.roostTier + 1 }
  }
}

export const finishConstruction: Handler<'finishConstruction'> = (s, a, ctx) => {
  const con = s.constructions[a.index]
  if (!con) return failure('NOT_FOUND')
  if (ctx.nowMs < con.readyAtMs) return failure('NOT_READY')
  return success(completeConstruction(s, a.index, ctx.catalog, ctx.nowMs, ctx.preset, ctx.day, ctx.rng))
}

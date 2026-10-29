import {
  constructionFor, CROPS, DECORATIONS, FOOTPRINT, getSpecies, hatcherySlots, HOME_EXPANSION, HOME_MAX_STEP, homeSize,
  OBSTACLES, placementRuleError, residents, storedGold,
  type BuildingRef, type Catalog, type IslandId, type MovableRef, type Placement, type PlayerState,
} from '@wyrmhaven/game-core'
import { textureKey } from '../art/phaserLoader'
import type { GameArtSet, Sprite } from '../art/types'
import type { Placing, Target } from './bridge'
import { anchor, depthOrder, dragonSpot, HATCHERY_ITEM_SCALE, hatcherySpot } from './layout'

/** One thing to draw: a sprite at a whole-pixel spot with an optional badge and click target. */
export interface IslandObject {
  id: string
  key: string
  sprite: Sprite
  x: number
  y: number
  target: Target
  badge?: string
  scale?: number
  /** Static frame of a multi-frame sheet to show (crop growth stages). */
  frame?: number
  /** Facings 1 and 3 draw the mirror of the front view. */
  flipX?: boolean
  /** ok/bad colour a placement ghost; building marks a construction in progress. */
  tint?: 'ok' | 'bad' | 'building'
}

export interface IslandMarkers {
  habitats: string[]
  dragons: string[]
  waiting: { id: string; noRoom: boolean }[]
  nests: { index: number; egg: boolean }[]
  hatchery: { slot: number }[]
  farms: { plot: number; crop: string | null }[]
  hoard: boolean
  obstacles: string[]
  decorations: string[]
  /** Constructions running anywhere (the builder count). */
  constructions: number
  /** The placement ghost's footprint, drawn as a diamond outline tinted by legality. */
  ghost: { legal: boolean; col: number; row: number; size: number } | null
  sign: { cost: number; minLevel: number } | null
}

export interface IslandModel {
  objects: IslandObject[]
  markers: IslandMarkers
}

export function timerLabel(readyAtMs: number, nowMs: number): string {
  const left = Math.max(0, readyAtMs - nowMs)
  if (left === 0) return 'ready'
  const s = Math.ceil(left / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.ceil(s / 60)}m`
  return `${Math.ceil(s / 3600)}h`
}

/** World y of a badge's bottom edge: 2 px above the sprite's visible top (canvas top when unknown), scaled. */
export function badgeY(o: Pick<IslandObject, 'y' | 'sprite' | 'scale'>): number {
  return o.y - Math.round((o.sprite.h - (o.sprite.top ?? 0)) * (o.scale ?? 1)) - 2
}

/** Dragon sheet for a species, falling back to the fire dragon until hybrids have art. */
export function dragonKey(speciesId: string, art: GameArtSet): string {
  return art.dragon[speciesId] ? textureKey(`dragon.${speciesId}`) : textureKey('dragon.fire')
}

const flip = (facing: number): { flipX?: true } => (facing === 1 || facing === 3 ? { flipX: true } : {})

type DecorationKind = keyof typeof DECORATIONS
const decorationLook = (art: GameArtSet, kind: DecorationKind) => ({
  key: textureKey(`decoration.${kind}`),
  sprite: art.decoration[kind],
})
const nexusLook = (art: GameArtSet) => ({ key: textureKey('building.nexus'), sprite: art.building.nexus })

/** Sprite and texture key of a thing that can be placed, for the ghost. */
function ghostLook(state: PlayerState, art: GameArtSet, what: Placing['what']): { key: string; sprite: Sprite } {
  if (what.kind === 'move') {
    const t: MovableRef = what.target
    switch (t.type) {
      case 'habitat': {
        const h = state.habitats.find(x => x.id === t.id)
        if (!h || h.element === 'any') return nexusLook(art)
        return { key: textureKey(`habitat.${h.element}`), sprite: art.habitat[h.element] }
      }
      case 'farm': return { key: textureKey('building.farmPlot'), sprite: art.building.farmPlot }
      case 'nest': return { key: textureKey('building.nest'), sprite: art.building.nest }
      case 'hatchery': return { key: textureKey('building.hatchery'), sprite: art.building.hatchery }
      case 'hoard': return { key: textureKey('building.hoard'), sprite: art.building.hoard }
      case 'decoration': {
        const d = state.decorations.find(x => x.id === t.id)
        return d ? decorationLook(art, d.kind) : nexusLook(art)
      }
    }
  }
  switch (what.kind) {
    case 'habitat': return { key: textureKey(`habitat.${what.element}`), sprite: art.habitat[what.element] }
    case 'nexus': return nexusLook(art)
    case 'farm': return { key: textureKey('building.farmPlot'), sprite: art.building.farmPlot }
    case 'nest': return { key: textureKey('building.nest'), sprite: art.building.nest }
    case 'hoard': return { key: textureKey('building.hoard'), sprite: art.building.hoard }
    case 'decoration': return decorationLook(art, what.decoration)
  }
}

/** Where the home expansion sign stands: the middle of the strip that step `homeStep + 1` adds. */
function signCell(homeStep: number): { col: number; row: number } {
  const { w, h } = homeSize(homeStep)
  return homeSize(homeStep + 1).w > w ? { col: w, row: Math.floor(h / 2) - 1 } : { col: Math.floor(w / 2) - 1, row: h }
}

/**
 * Pure: everything the Island scene draws for a state at a moment, for one island view. No Phaser, so it is
 * unit-tested directly; the scene only turns objects into sprites. Objects are ordered by anchor y (back to
 * front); a building's dragons, eggs and crops travel with it. The placement ghost is last.
 */
export function buildIslandModel(
  state: PlayerState | null, art: GameArtSet, catalog: Catalog, nowMs: number, view: IslandId, placing: Placing | null,
): IslandModel {
  const objects: IslandObject[] = []
  const markers: IslandMarkers = {
    habitats: [], dragons: [], waiting: [], nests: [], hatchery: [], farms: [], hoard: false,
    obstacles: [], decorations: [], constructions: 0, ghost: null, sign: null,
  }
  if (!state) return { objects, markers }
  markers.constructions = state.constructions.length

  const groups: { col: number; row: number; size: number; objects: IslandObject[] }[] = []
  const add = (p: { col: number; row: number }, size: number, group: IslandObject[]) => groups.push({ col: p.col, row: p.row, size, objects: group })
  /** Common look of a building: mirror by facing, plus the construction tint and timer badge. */
  const look = (ref: BuildingRef, placement: Placement): Partial<IslandObject> => {
    const c = constructionFor(state, ref)
    return { ...flip(placement.facing), ...(c ? { tint: 'building' as const, badge: timerLabel(c.readyAtMs, nowMs) } : {}) }
  }

  for (const o of state.islands.obstacles) {
    if (o.island !== view) continue
    const size = OBSTACLES[o.kind].size
    const a = anchor(o.col, o.row, size)
    const c = state.constructions.find(x => x.kind === 'clear' && x.obstacleId === o.id)
    add(o, size, [{
      id: `obstacle:${o.id}`, key: textureKey(`obstacle.${o.kind}`),
      sprite: art.obstacle[o.kind],
      ...a, target: { kind: 'obstacle', id: o.id },
      ...(c ? { tint: 'building' as const, badge: timerLabel(c.readyAtMs, nowMs) } : {}),
    }])
    markers.obstacles.push(o.id)
  }

  for (const d of state.decorations) {
    if (d.placement.island !== view) continue
    const a = anchor(d.placement.col, d.placement.row, DECORATIONS[d.kind].size)
    add(d.placement, DECORATIONS[d.kind].size, [{ id: `decoration:${d.id}`, ...decorationLook(art, d.kind), ...a, target: { kind: 'decoration', id: d.id }, ...flip(d.placement.facing) }])
    markers.decorations.push(d.id)
  }

  for (const h of state.habitats) {
    if (h.placement.island !== view) continue
    const a = anchor(h.placement.col, h.placement.row, FOOTPRINT.habitat)
    const gold = storedGold(h, residents(state, h.id), catalog, nowMs)
    const base = h.element === 'any'
      ? nexusLook(art)
      : { key: textureKey(`habitat.${h.element}`), sprite: art.habitat[h.element] }
    const group: IslandObject[] = [{
      id: `habitat:${h.id}`, ...base, ...a, target: { kind: 'habitat', id: h.id },
      badge: gold > 0 ? `${gold}g` : undefined, ...look({ type: 'habitat', id: h.id }, h.placement),
    }]
    markers.habitats.push(h.id)
    residents(state, h.id).forEach((d, slot) => {
      group.push({ id: `dragon:${d.id}`, key: dragonKey(d.speciesId, art), sprite: art.dragon[d.speciesId] ?? art.dragon['fire']!, ...dragonSpot(a, slot), target: { kind: 'dragon', id: d.id } })
      markers.dragons.push(d.id)
    })
    // Residents back to front on the platform, after the platform itself.
    group.splice(1, group.length - 1, ...group.slice(1).sort((p, q) => p.y - q.y))
    add(h.placement, FOOTPRINT.habitat, group)
  }

  state.nests.forEach((nest, index) => {
    if (nest.placement.island !== view) return
    const a = anchor(nest.placement.col, nest.placement.row, FOOTPRINT.nest)
    const group: IslandObject[] = [{
      id: `nest:${index}`, key: textureKey('building.nest'), sprite: art.building.nest, ...a,
      target: { kind: 'nest', index }, ...look({ type: 'nest', index }, nest.placement),
    }]
    if (nest.egg) {
      const el = getSpecies(catalog, nest.egg.speciesId).elements[0]!
      group.push({ id: `egg:${index}`, key: textureKey(`egg.${el}`), sprite: art.egg[el], x: a.x, y: a.y - 10, target: { kind: 'nest', index }, badge: timerLabel(nest.egg.readyAtMs, nowMs) })
    }
    add(nest.placement, FOOTPRINT.nest, group)
    markers.nests.push({ index, egg: nest.egg !== null })
  })

  if (state.hatcheryPlacement.island === view) {
    const a = anchor(state.hatcheryPlacement.col, state.hatcheryPlacement.row, FOOTPRINT.hatchery)
    const group: IslandObject[] = [{
      id: 'hatchery', key: textureKey('building.hatchery'), sprite: art.building.hatchery, ...a,
      target: { kind: 'hatcheryBuilding' }, ...look({ type: 'hatchery' }, state.hatcheryPlacement),
    }]
    let spot = 0
    state.hatchery.forEach((egg, slot) => {
      const el = getSpecies(catalog, egg.speciesId).elements[0]!
      group.push({ id: `hatchery:${slot}`, key: textureKey(`egg.${el}`), sprite: art.egg[el], ...hatcherySpot(a, spot++), scale: HATCHERY_ITEM_SCALE, target: { kind: 'hatchery', slot } })
      markers.hatchery.push({ slot })
    })
    for (const d of state.dragons.filter(x => x.habitatId === null)) {
      const el = getSpecies(catalog, d.speciesId).elements[0]!
      const at = hatcherySpot(a, Math.min(spot++, hatcherySlots(state.hatcheryLevel) - 1))
      group.push({ id: `dragon:${d.id}`, key: textureKey(`hatchling.${el}`), sprite: art.hatchling[el], ...at, scale: HATCHERY_ITEM_SCALE, target: { kind: 'dragon', id: d.id } })
      markers.dragons.push(d.id)
      markers.waiting.push({ id: d.id, noRoom: true })
    }
    // One badge for the whole hatchery (per-egg badges pile up over its small niches); the panel lists each egg.
    // A construction timer wins, then waiting hatchlings, then the soonest egg.
    if (!group[0]!.badge) {
      const soonest = Math.min(...state.hatchery.map(e => e.readyAtMs))
      const badge = markers.waiting.length > 0 ? 'no room' : state.hatchery.length > 0 ? timerLabel(soonest, nowMs) : undefined
      if (badge) group[0]!.badge = badge
    }
    add(state.hatcheryPlacement, FOOTPRINT.hatchery, group)
  }

  state.farms.forEach((plot, i) => {
    if (plot.placement.island !== view) return
    const a = anchor(plot.placement.col, plot.placement.row, FOOTPRINT.farm)
    const group: IslandObject[] = [{
      id: `farm:${i}`, key: textureKey('building.farmPlot'), sprite: art.building.farmPlot, ...a,
      target: { kind: 'farm', plot: i }, ...look({ type: 'farm', index: i }, plot.placement),
    }]
    if (plot.crop) {
      const grow = CROPS[plot.crop].growMs
      const fraction = Math.min(1, Math.max(0, 1 - (plot.readyAtMs - nowMs) / grow))
      const sprite = art.building.cropStage[plot.crop]
      // A stage sheet shows growth by frame; a single still (or fallback) grows by scale.
      const growth = sprite.frames > 1
        ? { frame: fraction >= 1 ? sprite.frames - 1 : Math.floor(fraction * (sprite.frames - 1)) }
        : { scale: 0.5 + 0.5 * fraction }
      group.push({ id: `crop:${i}`, key: textureKey(`crop.${plot.crop}`), sprite, x: a.x, y: a.y - 10, target: { kind: 'farm', plot: i }, badge: timerLabel(plot.readyAtMs, nowMs), ...growth })
    }
    add(plot.placement, FOOTPRINT.farm, group)
    markers.farms.push({ plot: i, crop: plot.crop })
  })

  if (state.hoardLevel > 0 && state.hoardPlacement && state.hoardPlacement.island === view) {
    const a = anchor(state.hoardPlacement.col, state.hoardPlacement.row, FOOTPRINT.hoard)
    add(state.hoardPlacement, FOOTPRINT.hoard, [{ id: 'hoard', key: textureKey('building.hoard'), sprite: art.building.hoard, ...a, target: { kind: 'hoard' }, badge: `Hoard ${state.hoardLevel}`, ...flip(state.hoardPlacement.facing) }])
    markers.hoard = true
  }

  if (view === 'home' && state.islands.homeStep < HOME_MAX_STEP) {
    const next = HOME_EXPANSION[state.islands.homeStep]!
    const { col, row } = signCell(state.islands.homeStep)
    const a = anchor(col, row, 2)
    add({ col, row }, 2, [{ id: 'sign', key: textureKey('island.sign'), sprite: art.island.sign, ...a, target: { kind: 'expandSign' } }])
    markers.sign = { cost: next.cost, minLevel: next.minLevel }
  }

  // Stable sort: back to front in isometric depth, ties keep insertion order.
  for (const g of groups.sort(depthOrder)) objects.push(...g.objects)

  if (placing) {
    const placement: Placement = { island: view, col: placing.col, row: placing.row, facing: placing.facing }
    const legal = placementRuleError(state, placing.what, placement) === null
    objects.push({
      id: 'ghost', ...ghostLook(state, art, placing.what), ...anchor(placing.col, placing.row, placing.size),
      target: { kind: 'cell', col: placing.col, row: placing.row }, tint: legal ? 'ok' : 'bad', ...flip(placing.facing),
    })
    markers.ghost = { legal, col: placing.col, row: placing.row, size: placing.size }
  }
  return { objects, markers }
}

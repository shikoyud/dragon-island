import {
  constructionFor, cropGrowMs, DECORATIONS, FOOTPRINT, getSpecies, hatcherySlots, HOME_EXPANSION, HOME_MAX_STEP, homeSize, unlockPl,
  DEFAULT_PRESET, dragonRateX20, habitatCap, hatcheryUsed, LAUNCH_CATALOG, OBSTACLES, placementRuleError, residents, stageOf, storedGold,
  type BreederKind, type BuildingRef, type Catalog, type Dragon, type Habitat, type IslandId, type MovableRef, type Placement, type PlayerState, type Preset,
} from '@wyrmhaven/game-core'
import { textureKey } from '../art/phaserLoader'
import type { GameArtSet, Sprite } from '../art/types'
import { placementSubject, type Placing, type Target } from './bridge'
import { anchor, depthOrder, dragonSpot, HATCHERY_ITEM_SCALE, hatcherySpot, NEST_EGG_SCALE } from './layout'

/** One thing to draw: a sprite at a whole-pixel spot with an optional badge and click target. */
export interface IslandObject {
  id: string
  key: string
  sprite: Sprite
  x: number
  y: number
  target: Target
  /**
   * 'gold' / 'full' mark a habitat with Gold to collect (tappable); any other string is a timer or status label.
   * (The brief's `{ timer: number }` form is not used: labels like 'no room' and 'ready' need a string.)
   */
  badge?: 'gold' | 'full' | (string & {})
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
  breeders: { index: number; egg: boolean }[]
  hatchery: { slot: number }[]
  farms: { plot: number; crop: string | null }[]
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

/** The client clock can lag the server by a moment, so a fresh 1-minute timer reads a little over. Up to this much over a whole unit still shows that unit. */
const TIMER_LAG_S = 5

export function timerLabel(readyAtMs: number, nowMs: number): string {
  const left = Math.max(0, readyAtMs - nowMs)
  if (left === 0) return 'ready'
  const s = Math.ceil(left / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.ceil((s - TIMER_LAG_S) / 60)}m`
  return `${Math.ceil((s - TIMER_LAG_S) / 3600)}h`
}

/** True when a finished egg could move to the Hatchery now (R18). */
export const hatcheryHasRoom = (s: PlayerState): boolean => hatcheryUsed(s) < hatcherySlots(s.hatcheryLevel, s.hatcheryFifthSlot)

/** Badge of an egg in a breeder: its timer, then 'ready', or 'hatchery full' when it is done but has nowhere to go. */
export function eggBadge(s: PlayerState, readyAtMs: number, nowMs: number): string {
  return readyAtMs <= nowMs && !hatcheryHasRoom(s) ? 'hatchery full' : timerLabel(readyAtMs, nowMs)
}

/** The GOLD badge waits for this share of the habitat's cap, if that is less than a minute of its residents' income (M1 Q1). */
export const GOLD_BADGE_CAP_PERCENT = 5

/**
 * Stored Gold at which a habitat shows its GOLD badge: min(Gold per minute of its residents, 5 % of its cap), floored.
 * The per-minute rate is the one the habitat panel shows (sum of goldPerMinuteX20 ÷ 20). Client-only; collecting from
 * the panel still works from 1 Gold.
 */
export function goldBadgeThreshold(h: Habitat, live: readonly Dragon[], cap: number, catalog: Catalog, preset: Preset): number {
  const perMinuteX20 = live.reduce((n, d) => {
    const sp = getSpecies(catalog, d.speciesId)
    return n + dragonRateX20(sp, d.level, h, preset)
  }, 0)
  return Math.min(Math.floor(perMinuteX20 / 20), Math.floor(cap * GOLD_BADGE_CAP_PERCENT / 100))
}

/** World y of a badge's bottom edge: 2 px above the sprite's visible top (canvas top when unknown), scaled. */
export function badgeY(o: Pick<IslandObject, 'y' | 'sprite' | 'scale'>): number {
  return o.y - Math.round((o.sprite.h - (o.sprite.top ?? 0)) * (o.scale ?? 1)) - 2
}

/**
 * Sheet for a dragon by stage (R11): Baby uses the hatchling of its primary element, Juvenile its `juvenile.<species>`
 * sheet when the manifest has one (else the dragon sheet), Adult the dragon sheet. A species without art falls back to
 * its primary Basic (R23).
 */
export function dragonLook(speciesId: string, level: number, art: GameArtSet, catalog: Catalog = LAUNCH_CATALOG): { key: string; sprite: Sprite } {
  const stage = stageOf(level)
  if (stage === 'baby') {
    const el = catalog.species.get(speciesId)?.elements[0] ?? 'flame'
    return { key: textureKey(`hatchling.${el}`), sprite: art.hatchling[el] }
  }
  const juvenile = stage === 'juvenile' ? art.juvenile[speciesId] : undefined
  if (juvenile) return { key: textureKey(`juvenile.${speciesId}`), sprite: juvenile }
  const adult = art.dragon[speciesId]
  if (adult) return { key: textureKey(`dragon.${speciesId}`), sprite: adult }
  // No art for this species (R23): the primary element's Basic, so Flame/Sea and Sea/Flame look different. Juveniles try
  // that Basic's juvenile sheet first. Basics always have a dragon slot.
  const primary = catalog.species.get(speciesId)?.elements[0] ?? 'flame'
  const primaryJuvenile = stage === 'juvenile' ? art.juvenile[primary] : undefined
  if (primaryJuvenile) return { key: textureKey(`juvenile.${primary}`), sprite: primaryJuvenile }
  return { key: textureKey(`dragon.${primary}`), sprite: art.dragon[primary]! }
}

export const dragonKey = (speciesId: string, level: number, art: GameArtSet, catalog: Catalog = LAUNCH_CATALOG): string =>
  dragonLook(speciesId, level, art, catalog).key

const flip = (facing: number): { flipX?: true } => (facing === 1 || facing === 3 ? { flipX: true } : {})

type DecorationKind = keyof typeof DECORATIONS
const decorationLook = (art: GameArtSet, kind: DecorationKind) => ({
  key: textureKey(`decoration.${kind}`),
  sprite: art.decoration[kind],
})
/**
 * Mountain and Grove sheets stay specified at 80x80, their footprint size from M4 (docs/art/gdd-m2-art-list.md). Until
 * then they stand on a 2-cell footprint (R9), so they are drawn smaller. Change this constant, not the sheet sizes;
 * M4 sets it back to 1. The `building.nest` fallback is 32x32 already and keeps its native scale.
 */
export const BREEDER_ART_SCALE = 0.5
/**
 * A Mountain or Grove at `level`: its own `building.<kind>.<level>` sheet, else the nearest lower level's, else the small
 * nest sprite (which stands on the footprint's bottom vertex like any building).
 */
function breederLook(art: GameArtSet, kind: BreederKind, level: number): { key: string; sprite: Sprite; scale?: number } {
  for (let l = level; l >= 1; l--) {
    const s = art.building.breeder[kind][l]
    if (s) return { key: textureKey(`building.${kind}.${l}`), sprite: s, scale: BREEDER_ART_SCALE }
  }
  return { key: textureKey('building.nest'), sprite: art.building.nest }
}
/** The Hatchery at `level`: `building.hatchery.<level>`, else a lower level's, else `building.hatchery`. The fifth slot is not a level. */
function hatcheryLook(art: GameArtSet, level: number): { key: string; sprite: Sprite } {
  for (let l = level; l >= 1; l--) {
    const s = art.building.hatcheryLevel[l]
    if (s) return { key: textureKey(`building.hatchery.${l}`), sprite: s }
  }
  return { key: textureKey('building.hatchery'), sprite: art.building.hatchery }
}
const nexusLook = (art: GameArtSet) => ({ key: textureKey('building.nexus'), sprite: art.building.nexus })
/** The Golden Aerie: its own sprite when the manifest has one, else the Nexus sprite. */
const aerieLook = (art: GameArtSet) => (art.building.goldenAerie ? { key: textureKey('building.goldenAerie'), sprite: art.building.goldenAerie } : nexusLook(art))

/** Sprite and texture key of a thing that can be placed, for the ghost. */
function ghostLook(state: PlayerState, art: GameArtSet, what: Placing['what']): { key: string; sprite: Sprite; scale?: number } {
  if (what.kind === 'move') {
    const t: MovableRef = what.target
    switch (t.type) {
      case 'habitat': {
        const h = state.habitats.find(x => x.id === t.id)
        if (!h) return nexusLook(art)
        if (h.element === 'aerie') return aerieLook(art)
        return { key: textureKey(`habitat.${h.element}`), sprite: art.habitat[h.element] }
      }
      case 'farm': return { key: textureKey('building.farmPlot'), sprite: art.building.farmPlot }
      case 'breeder': {
        const b = state.breeders[t.index]
        return b ? breederLook(art, b.kind, b.level) : breederLook(art, 'mountain', 1)
      }
      case 'hatchery': return hatcheryLook(art, state.hatcheryLevel)
      case 'decoration': {
        const d = state.decorations.find(x => x.id === t.id)
        return d ? decorationLook(art, d.kind) : nexusLook(art)
      }
    }
  }
  switch (what.kind) {
    case 'habitat': return { key: textureKey(`habitat.${what.element}`), sprite: art.habitat[what.element] }
    case 'farm': return { key: textureKey('building.farmPlot'), sprite: art.building.farmPlot }
    case 'grove': return breederLook(art, 'grove', 1)
    case 'decoration': return decorationLook(art, what.decoration)
    case 'goldenAerie': return aerieLook(art)
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
  preset: Preset = DEFAULT_PRESET,
): IslandModel {
  const objects: IslandObject[] = []
  const markers: IslandMarkers = {
    habitats: [], dragons: [], waiting: [], breeders: [], hatchery: [], farms: [],
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
    const live = residents(state, h.id)
    const cap = habitatCap(h.element, h.level, preset)
    const gold = storedGold(h, live, catalog, nowMs, preset)
    const base = h.element === 'aerie'
      ? aerieLook(art)
      : { key: textureKey(`habitat.${h.element}`), sprite: art.habitat[h.element] }
    const group: IslandObject[] = [{
      id: `habitat:${h.id}`, ...base, ...a, target: { kind: 'habitat', id: h.id },
      badge: gold > 0 && gold >= cap ? 'full' : gold > 0 && gold >= goldBadgeThreshold(h, live, cap, catalog, preset) ? 'gold' : undefined,
      ...look({ type: 'habitat', id: h.id }, h.placement),
    }]
    markers.habitats.push(h.id)
    live.forEach((d, slot) => {
      group.push({ id: `dragon:${d.id}`, ...dragonLook(d.speciesId, d.level, art, catalog), ...dragonSpot(a, slot), target: { kind: 'dragon', id: d.id } })
      markers.dragons.push(d.id)
    })
    // Residents back to front on the platform, after the platform itself.
    group.splice(1, group.length - 1, ...group.slice(1).sort((p, q) => p.y - q.y))
    add(h.placement, FOOTPRINT.habitat, group)
  }

  state.breeders.forEach((breeder, index) => {
    if (breeder.placement.island !== view) return
    const a = anchor(breeder.placement.col, breeder.placement.row, FOOTPRINT.breeder)
    const group: IslandObject[] = [{
      id: `breeder:${index}`, ...breederLook(art, breeder.kind, breeder.level), ...a,
      target: { kind: 'breeder', index }, ...look({ type: 'breeder', index }, breeder.placement),
    }]
    if (breeder.egg) {
      const el = getSpecies(catalog, breeder.egg.speciesId).elements[0]!
      group.push({ id: `egg:${index}`, key: textureKey(`egg.${el}`), sprite: art.egg[el], x: a.x, y: a.y - 9, scale: NEST_EGG_SCALE, target: { kind: 'breeder', index }, badge: eggBadge(state, breeder.egg.readyAtMs, nowMs) })
    }
    add(breeder.placement, FOOTPRINT.breeder, group)
    markers.breeders.push({ index, egg: breeder.egg !== null })
  })

  if (state.hatcheryPlacement.island === view) {
    const a = anchor(state.hatcheryPlacement.col, state.hatcheryPlacement.row, FOOTPRINT.hatchery)
    const group: IslandObject[] = [{
      id: 'hatchery', ...hatcheryLook(art, state.hatcheryLevel), ...a,
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
      const at = hatcherySpot(a, Math.min(spot++, hatcherySlots(state.hatcheryLevel, state.hatcheryFifthSlot) - 1))
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
      const grow = cropGrowMs(plot.crop, preset)
      const fraction = Math.min(1, Math.max(0, 1 - (plot.readyAtMs - nowMs) / grow))
      const sprite = art.building.cropStage[plot.crop]
      // A stage sheet shows growth by frame; a single still (or fallback) grows by scale.
      const growth = sprite.frames > 1
        ? { frame: fraction >= 1 ? sprite.frames - 1 : Math.floor(fraction * (sprite.frames - 1)) }
        : { scale: 0.5 + 0.5 * fraction }
      // A ripe crop sways when the art has the loop.
      const sway = fraction >= 1 ? art.building.cropSway[plot.crop] : undefined
      const look = sway ? { key: textureKey(`crop.${plot.crop}.sway`), sprite: sway } : { key: textureKey(`crop.${plot.crop}`), sprite, ...growth }
      group.push({ id: `crop:${i}`, ...look, x: a.x, y: a.y - 10, target: { kind: 'farm', plot: i }, badge: nowMs >= plot.readyAtMs ? 'ripe' : timerLabel(plot.readyAtMs, nowMs) })
    }
    add(plot.placement, FOOTPRINT.farm, group)
    markers.farms.push({ plot: i, crop: plot.crop })
  })

  if (view === 'home' && state.islands.homeStep < HOME_MAX_STEP) {
    const next = HOME_EXPANSION[state.islands.homeStep]!
    const { col, row } = signCell(state.islands.homeStep)
    const a = anchor(col, row, 2)
    add({ col, row }, 2, [{ id: 'sign', key: textureKey('island.sign'), sprite: art.island.sign, ...a, target: { kind: 'expandSign' } }])
    markers.sign = { cost: next.cost, minLevel: unlockPl(`home:${state.islands.homeStep}`) }
  }

  // Stable sort: back to front in isometric depth, ties keep insertion order.
  // A building under construction gets the construction effect on its footprint's centre, drawn just after it.
  for (const g of groups.sort(depthOrder)) {
    for (const o of g.objects) {
      objects.push(o)
      if (o.tint === 'building') {
        objects.push({ id: `fx:${o.id}`, key: textureKey('fx.construction'), sprite: art.fx.construction, x: o.x, y: o.y - g.size * 4, target: o.target })
      }
    }
  }

  if (placing) {
    const placement: Placement = { island: view, col: placing.col, row: placing.row, facing: placing.facing }
    const legal = placementRuleError(state, placementSubject(placing.what), placement) === null
    objects.push({
      id: 'ghost', ...ghostLook(state, art, placing.what), ...anchor(placing.col, placing.row, placing.size),
      target: { kind: 'cell', col: placing.col, row: placing.row }, tint: legal ? 'ok' : 'bad', ...flip(placing.facing),
    })
    markers.ghost = { legal, col: placing.col, row: placing.row, size: placing.size }
  }
  return { objects, markers }
}

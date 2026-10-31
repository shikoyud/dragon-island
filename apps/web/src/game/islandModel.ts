import {
  constructionFor, cropGrowMs, DECORATIONS, FOOTPRINT, getSpecies, hatcherySlots, isPlot, ownedPlots, plotOrigin, plotPrice, plotsBought, plotsTouch, TILES_PER_PLOT,
  DEFAULT_PRESET, dragonRateX20, habitatCap, hatcheryUsed, LAUNCH_CATALOG, OBSTACLES, placementRuleError, residents, stageOf, storedGold,
  type BreederKind, type BuildingRef, type Catalog, type Dragon, type Habitat, type IslandId, type MovableRef, type Placement, type PlayerState, type Preset,
} from '@wyrmhaven/game-core'
import { textureKey } from '../art/phaserLoader'
import type { GameArtSet, Sprite } from '../art/types'
import { placementSubject, type Placing, type Target } from './bridge'
import { anchor, cellTop, depthOrder, dragonSpot, HATCHERY_ITEM_SCALE, hatcherySpot, ISO, NEST_EGG_SCALE, TAP_PX } from './layout'

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
  /**
   * The least this is tapped at on screen, in CSS px: something drawn smaller than that at the current zoom (a 32 px plot
   * sign at zoom 1) gets a tap box of this size, centred on it, in place of its own pixels.
   */
  minTap?: number
  /** With `minTap`: the tap box is used at every zoom, never the pixel-perfect test (a plot sign). */
  boxAlways?: boolean
}

/**
 * Everything a sprite shows or does, as one string. The scene keeps a sprite while its id and this stay the same, and makes
 * it again otherwise. The badge is not in it: that is an object of its own, kept by its own label.
 */
export function objectSignature(o: IslandObject, reducedMotion: boolean): string {
  return JSON.stringify([o.key, o.sprite.frames, o.sprite.fps, o.x, o.y, o.target, o.scale, o.frame, o.flipX, o.tint, o.minTap, o.boxAlways, reducedMotion])
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
  /** The placement ghost's footprint, drawn as a diamond outline tinted by legality. */
  ghost: { legal: boolean; col: number; row: number; size: number } | null
  /** One per unowned plot touching owned land; `price` is null when the island's price list has run out. */
  signs: { plot: number; price: number | null }[]
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

/**
 * R61: habitat and Farm sheets draw at footprint width over sheet width, until art lands at final size. The fallback and
 * today's sheets are drawn for older footprints; new art at final size comes out at scale 1 with no code change.
 */
const fitFootprint = <T extends { sprite: Sprite }>(look: T, size: number): T & { scale: number } => ({ ...look, scale: size * ISO.w / look.sprite.w })
const habitatLook = (art: GameArtSet, element: Exclude<Habitat['element'], 'aerie'>) => fitFootprint({ key: textureKey(`habitat.${element}`), sprite: art.habitat[element] }, FOOTPRINT.habitat)
const farmLook = (art: GameArtSet) => fitFootprint({ key: textureKey('building.farmPlot'), sprite: art.building.farmPlot }, FOOTPRINT.farm)

const flip = (facing: number): { flipX?: true } => (facing === 1 || facing === 3 ? { flipX: true } : {})

type DecorationKind = keyof typeof DECORATIONS
const decorationLook = (art: GameArtSet, kind: DecorationKind) => ({
  key: textureKey(`decoration.${kind}`),
  sprite: art.decoration[kind],
})
/**
 * A Mountain or Grove at `level`: its own `building.<kind>.<level>` sheet (80x80, the 5x5 footprint's width, so it draws
 * at scale 1), else the nearest lower level's, else the small nest sprite (which stands on the footprint's bottom vertex
 * like any building).
 */
function breederLook(art: GameArtSet, kind: BreederKind, level: number): { key: string; sprite: Sprite } {
  for (let l = level; l >= 1; l--) {
    const s = art.building.breeder[kind][l]
    if (s) return { key: textureKey(`building.${kind}.${l}`), sprite: s }
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
/**
 * The Dragon Roost at `tier`: `building.roost.<tier>` (64x64, the 4x4 footprint's width, so scale 1), else the nearest
 * lower tier's, else the small nest sprite. Tier 0 (still being built) and a missing sheet both use the nest.
 */
function roostLook(art: GameArtSet, tier: number): { key: string; sprite: Sprite } {
  for (let t = tier; t >= 1; t--) {
    const s = art.building.roostTier[t]
    if (s) return { key: textureKey(`building.roost.${t}`), sprite: s }
  }
  return { key: textureKey('building.nest'), sprite: art.building.nest }
}
const nexusLook = (art: GameArtSet) => ({ key: textureKey('building.nexus'), sprite: art.building.nexus })
/** The Golden Aerie: its own sprite when the manifest has one, else the Nexus sprite. */
const aerieLook = (art: GameArtSet) => fitFootprint(art.building.goldenAerie ? { key: textureKey('building.goldenAerie'), sprite: art.building.goldenAerie } : nexusLook(art), FOOTPRINT.habitat)

/** Sprite and texture key of a thing that can be placed, for the ghost. */
function ghostLook(state: PlayerState, art: GameArtSet, what: Placing['what']): { key: string; sprite: Sprite; scale?: number } {
  if (what.kind === 'move') {
    const t: MovableRef = what.target
    switch (t.type) {
      case 'habitat': {
        const h = state.habitats.find(x => x.id === t.id)
        if (!h) return nexusLook(art)
        return h.element === 'aerie' ? aerieLook(art) : habitatLook(art, h.element)
      }
      case 'farm': return farmLook(art)
      case 'breeder': {
        const b = state.breeders[t.index]
        return b ? breederLook(art, b.kind, b.level) : breederLook(art, 'mountain', 1)
      }
      case 'hatchery': return hatcheryLook(art, state.hatcheryLevel)
      case 'roost': return roostLook(art, state.roostTier)
      case 'decoration': {
        const d = state.decorations.find(x => x.id === t.id)
        return d ? decorationLook(art, d.kind) : nexusLook(art)
      }
    }
  }
  switch (what.kind) {
    case 'habitat': return habitatLook(art, what.element)
    case 'farm': return farmLook(art)
    case 'grove': return breederLook(art, 'grove', 1)
    case 'roost': return roostLook(art, 1)
    case 'decoration': return decorationLook(art, what.decoration)
    case 'goldenAerie': return aerieLook(art)
  }
}

/**
 * Which of `n` grass variants a cell takes: a small integer hash of (col, row), stable and pure. A linear mix such as
 * (7 col + 13 row) % 3 collapses to (col + row) % 3 and draws diagonal stripes.
 */
export function groundVariant(col: number, row: number, n: number): number {
  let h = Math.imul(col + 1, 0x27d4eb2d) ^ Math.imul(row + 1, 0x165667b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) % n
}

/**
 * Texture keys the baked ground draws on `island`: its own grass tiles when the manifest has any, else the current ones;
 * its cliff pieces only as a pair, else the current pair. Empty / null = the scene's placeholder diamonds and skirt.
 */
export function groundTiles(art: GameArtSet, island: IslandId): { grass: string[]; cliffSw: string | null; cliffSe: string | null } {
  const own = art.ground.island[island]
  const grass = own && own.grass.length > 0
    ? own.grass.map((_, i) => `ground.${island}.${i}`)
    : art.ground.grass.map((_, i) => `ground.grass.${i}`)
  if (own?.cliffSw && own.cliffSe) return { grass, cliffSw: `ground.cliff.${island}.sw`, cliffSe: `ground.cliff.${island}.se` }
  const plain = art.ground.cliffSw && art.ground.cliffSe
  return { grass, cliffSw: plain ? 'ground.cliff.sw' : null, cliffSe: plain ? 'ground.cliff.se' : null }
}

/** The unowned plots of an island that touch owned land (§5.5, R44). */
function signPlots(s: PlayerState, island: IslandId): number[] {
  const owned = ownedPlots(s, island)
  const out: number[] = []
  for (let plot = 0; isPlot(plot); plot++) if (!owned.includes(plot) && owned.some(o => plotsTouch(o, plot))) out.push(plot)
  return out
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
    obstacles: [], decorations: [], ghost: null, signs: [],
  }
  if (!state) return { objects, markers }

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
      ...a, target: { kind: 'obstacle', id: o.id }, minTap: TAP_PX,
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
    const base = h.element === 'aerie' ? aerieLook(art) : habitatLook(art, h.element)
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

  if (state.roostPlacement && state.roostPlacement.island === view) {
    const a = anchor(state.roostPlacement.col, state.roostPlacement.row, FOOTPRINT.roost)
    add(state.roostPlacement, FOOTPRINT.roost, [{
      id: 'roost', ...roostLook(art, state.roostTier), ...a, target: { kind: 'roost' }, ...look({ type: 'roost' }, state.roostPlacement),
    }])
  }

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
      id: `farm:${i}`, ...farmLook(art), ...a,
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

  const price = plotPrice(view, plotsBought(state, view))
  for (const plot of signPlots(state, view)) {
    const o = plotOrigin(plot)
    // The sign stands on the plot's centre: depth-sorted as a 2x2 around it.
    const mid = TILES_PER_PLOT / 2
    add({ col: o.col + mid - 1, row: o.row + mid - 1 }, 2, [{
      id: `sign:${plot}`, key: textureKey('island.sign'), sprite: art.island.sign, ...cellTop(o.col + mid, o.row + mid), target: { kind: 'plot', island: view, plot }, minTap: TAP_PX, boxAlways: true,
    }])
    markers.signs.push({ plot, price })
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

import {
  breedTimerMs, constructionFor, cropGrowMs, DECORATIONS, FOOTPRINT, getSpecies, hatcherySlots, offeredPlots, ownedPlots, plotOfTile, plotPrice, plotsBought,
  DEFAULT_PRESET, dragonRateX20, habitatCap, hatcheryUsed, LAUNCH_CATALOG, OBSTACLES, placementRuleError, residents, sameRef, stageOf, storedGold, upgradeInfo,
  type BreederKind, type BuildingRef, type Catalog, type Dragon, type Habitat, type IslandId, type MovableRef, type Placement, type PlayerState, type Preset,
} from '@wyrmhaven/game-core'
import { textureKey } from '../art/phaserLoader'
import type { GameArtSet, Sprite } from '../art/types'
import { placementSubject, type Placing, type Target } from './bridge'
import { anchor, cellCentre, cellTop, depthOrder, dragonSpot, habitatDragonScale, hatcheryEggScale, hatcheryNestSpot, ISO, NEST_EGG_HATCHERY_SCALE, NEST_EGG_SCALE, SIGN_SCALE, signSpot, TAP_PX, UPGRADE_POST } from './layout'

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
  /** bad reddens a placement ghost on an illegal spot; building marks a construction in progress. */
  tint?: 'bad' | 'building'
  /**
   * The least this is tapped at on screen, in CSS px: something drawn smaller than that at the current zoom (a plot sign,
   * its 48 px art drawn at `SIGN_SCALE`, is 24 px at zoom 1) gets a tap box of this size, centred on it, in place of its own pixels.
   */
  minTap?: number
  /** With `minTap`: the tap box is used at every zoom, never the pixel-perfect test (a plot sign). */
  boxAlways?: boolean
  /** A white label drawn under the sprite (the 'Tap to buy' of a plot sign); a constant size on screen, like a badge. */
  caption?: string
  /** 0..1: a small bar the scene draws under the sprite (an egg hatching). Absent = no bar. */
  progress?: number
}

/**
 * Everything a sprite shows or does, as one string. The scene keeps a sprite while its id and this stay the same, and makes
 * it again otherwise. The badge is not in it: that is an object of its own, kept by its own label.
 */
export function objectSignature(o: IslandObject, reducedMotion: boolean): string {
  return JSON.stringify([o.key, o.sprite.frames, o.sprite.fps, o.x, o.y, o.target, o.scale, o.frame, o.flipX, o.tint, o.minTap, o.boxAlways, o.caption, reducedMotion])
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

/**
 * U12: a habitat's upgrade post shows when its next level exists and its level gate is met, whether or not the Gold covers
 * it. Not while it is being built or upgraded: there is nothing to start.
 */
export function upgradeReady(s: PlayerState, h: Habitat, preset: Preset): boolean {
  const ref: BuildingRef = { type: 'habitat', id: h.id }
  const next = upgradeInfo(s, ref, preset)
  return next !== null && s.level >= next.minLevel && !constructionFor(s, ref)
}

/**
 * How far an egg in the Hatchery has come, 0..1, or undefined once it is ready (no bar then). Its stored timer has no start
 * time, so this reads against its species' full timer.
 */
function hatchProgress(readyAtMs: number, speciesId: string, nowMs: number, catalog: Catalog, preset: Preset): number | undefined {
  const left = readyAtMs - nowMs
  if (left <= 0) return undefined
  const sp = getSpecies(catalog, speciesId)
  return Math.max(0, 1 - left / breedTimerMs(sp.rarity, sp.elements, preset))
}

/** Index of the egg still hatching that is due soonest, or -1. */
function soonestHatching(eggs: readonly { readyAtMs: number }[], nowMs: number): number {
  return eggs.reduce((best, e, i) => (e.readyAtMs > nowMs && (best < 0 || e.readyAtMs < eggs[best]!.readyAtMs) ? i : best), -1)
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
/** A hatchling's sheet: the species' own (`hatchling.trial-champion`) when the manifest has one, else its primary element's. */
export function hatchlingLook(speciesId: string, art: GameArtSet, catalog: Catalog = LAUNCH_CATALOG): { key: string; sprite: Sprite } {
  const own = art.special.hatchling[speciesId]
  if (own) return { key: textureKey(`hatchling.${speciesId}`), sprite: own }
  const el = catalog.species.get(speciesId)?.elements[0] ?? 'flame'
  return { key: textureKey(`hatchling.${el}`), sprite: art.hatchling[el] }
}

/** An egg's sheet: the species' own when the manifest has one, else its primary element's. */
export function eggLook(speciesId: string, art: GameArtSet, catalog: Catalog = LAUNCH_CATALOG): { key: string; sprite: Sprite } {
  const own = art.special.egg[speciesId]
  if (own) return { key: textureKey(`egg.${speciesId}`), sprite: own }
  const el = getSpecies(catalog, speciesId).elements[0]!
  return { key: textureKey(`egg.${el}`), sprite: art.egg[el] }
}

export function dragonLook(speciesId: string, level: number, art: GameArtSet, catalog: Catalog = LAUNCH_CATALOG): { key: string; sprite: Sprite } {
  const stage = stageOf(level)
  if (stage === 'baby') {
    return hatchlingLook(speciesId, art, catalog)
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

/** The placement arrow draws at half its art's size, its tip this many world px above the footprint's top vertex. */
export const ARROW_SCALE = 0.5
export const ARROW_GAP = 2

/** What the sign on a plot for sale says on Home. */
export const SIGN_CAPTION = 'Tap to buy'
export { SIGN_SCALE }

/**
 * Pure: everything the Island scene draws for a state at a moment, for one island view. No Phaser, so it is
 * unit-tested directly; the scene only turns objects into sprites. Objects are ordered by anchor y (back to
 * front); a building's dragons, eggs and crops travel with it. While it is being moved its own sprite gives way to the
 * placement ghost, on whose cell the rest of its group is built. The ghost, what it carries and its arrow are last.
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
  const movedRef = placing?.what.kind === 'move' ? placing.what.target : null
  const isMoved = (ref: MovableRef | undefined) => Boolean(ref && movedRef && sameRef(ref, movedRef))
  /** Where a building stands for this picture: on the ghost's cell, on the island in view, while it is the one being moved. */
  const standing = (ref: MovableRef, placement: Placement): Placement =>
    placing && isMoved(ref) ? { island: view, col: placing.col, row: placing.row, facing: placing.facing } : placement
  /** What the moved building holds, ridden on the ghost. */
  const carried: IslandObject[] = []
  /** A group's first object is its building, unless `ref` is the one being moved: the ghost stands in for that. */
  const add = (p: { col: number; row: number }, size: number, group: IslandObject[], ref?: MovableRef) => {
    if (isMoved(ref)) carried.push(...group.slice(1))
    else groups.push({ col: p.col, row: p.row, size, objects: group })
  }
  /** Common look of a building: mirror by facing, plus the construction tint and timer badge. */
  const look = (ref: BuildingRef, placement: Placement): Partial<IslandObject> => {
    const c = constructionFor(state, ref)
    return { ...flip(placement.facing), ...(c ? { tint: 'building' as const, badge: timerLabel(c.readyAtMs, nowMs) } : {}) }
  }

  const owned = ownedPlots(state, view)
  for (const o of state.islands.obstacles) {
    if (o.island !== view) continue
    const size = OBSTACLES[o.kind].size
    const a = anchor(o.col, o.row, size)
    const c = state.constructions.find(x => x.kind === 'clear' && x.obstacleId === o.id)
    // An obstacle on land not owned can't be cleared (U5): a tap opens the plot's buy panel instead.
    const plot = plotOfTile(o.col, o.row)
    const target: Target = plot !== null && !owned.includes(plot) ? { kind: 'plot', island: view, plot } : { kind: 'obstacle', id: o.id }
    add(o, size, [{
      id: `obstacle:${o.id}`, key: textureKey(`obstacle.${o.kind}`),
      sprite: art.obstacle[o.kind],
      ...a, target, minTap: TAP_PX,
      ...(c ? { tint: 'building' as const, badge: timerLabel(c.readyAtMs, nowMs) } : {}),
    }])
    markers.obstacles.push(o.id)
  }

  for (const d of state.decorations) {
    const ref: MovableRef = { type: 'decoration', id: d.id }
    const at = standing(ref, d.placement)
    if (at.island !== view) continue
    const a = anchor(at.col, at.row, DECORATIONS[d.kind].size)
    add(at, DECORATIONS[d.kind].size, [{ id: `decoration:${d.id}`, ...decorationLook(art, d.kind), ...a, target: { kind: 'decoration', id: d.id }, ...flip(d.placement.facing) }], ref)
    markers.decorations.push(d.id)
  }

  for (const h of state.habitats) {
    const ref: MovableRef = { type: 'habitat', id: h.id }
    const at = standing(ref, h.placement)
    if (at.island !== view) continue
    const a = anchor(at.col, at.row, FOOTPRINT.habitat)
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
      const look = dragonLook(d.speciesId, d.level, art, catalog)
      group.push({ id: `dragon:${d.id}`, ...look, ...dragonSpot(a, slot), scale: habitatDragonScale(look.sprite.w), target: { kind: 'dragon', id: d.id } })
      markers.dragons.push(d.id)
    })
    if (!placing && upgradeReady(state, h, preset)) {
      group.push({
        id: `post:${h.id}`, key: textureKey('ui.island.upgradePost'), sprite: art.island.upgradePost, x: a.x + UPGRADE_POST.x, y: a.y + UPGRADE_POST.y,
        scale: UPGRADE_POST.scale, target: { kind: 'habitat', id: h.id }, minTap: TAP_PX,
      })
    }
    // Residents and the post back to front on the platform, after the platform itself.
    group.splice(1, group.length - 1, ...group.slice(1).sort((p, q) => p.y - q.y))
    add(at, FOOTPRINT.habitat, group, ref)
  }

  state.breeders.forEach((breeder, index) => {
    const ref: MovableRef = { type: 'breeder', index }
    const at = standing(ref, breeder.placement)
    if (at.island !== view) return
    const a = anchor(at.col, at.row, FOOTPRINT.breeder)
    const group: IslandObject[] = [{
      id: `breeder:${index}`, ...breederLook(art, breeder.kind, breeder.level), ...a,
      target: { kind: 'breeder', index }, ...look({ type: 'breeder', index }, breeder.placement),
    }]
    if (breeder.egg) {
      group.push({ id: `egg:${index}`, ...eggLook(breeder.egg.speciesId, art, catalog), x: a.x, y: a.y - 9, scale: NEST_EGG_SCALE, target: { kind: 'breeder', index }, badge: eggBadge(state, breeder.egg.readyAtMs, nowMs) })
    }
    add(at, FOOTPRINT.breeder, group, ref)
    markers.breeders.push({ index, egg: breeder.egg !== null })
  })

  const roostAt = state.roostPlacement && standing({ type: 'roost' }, state.roostPlacement)
  if (state.roostPlacement && roostAt?.island === view) {
    const a = anchor(roostAt.col, roostAt.row, FOOTPRINT.roost)
    add(roostAt, FOOTPRINT.roost, [{
      id: 'roost', ...roostLook(art, state.roostTier), ...a, target: { kind: 'roost' }, ...look({ type: 'roost' }, state.roostPlacement),
    }], { type: 'roost' })
  }

  const hatcheryAt = standing({ type: 'hatchery' }, state.hatcheryPlacement)
  if (hatcheryAt.island === view) {
    const a = anchor(hatcheryAt.col, hatcheryAt.row, FOOTPRINT.hatchery)
    const group: IslandObject[] = [{
      id: 'hatchery', ...hatcheryLook(art, state.hatcheryLevel), ...a,
      target: { kind: 'hatcheryBuilding' }, ...look({ type: 'hatchery' }, state.hatcheryPlacement),
    }]
    let spot = 0
    // One bar, on the egg due soonest, like the one badge below: 16 px bars over eggs 9 px apart bury the nest. The panel lists each egg.
    const barred = soonestHatching(state.hatchery, nowMs)
    const eggScale = hatcheryEggScale(state.hatchery.length)
    const eggs: IslandObject[] = []
    state.hatchery.forEach((egg, slot) => {
      const progress = slot === barred ? hatchProgress(egg.readyAtMs, egg.speciesId, nowMs, catalog, preset) : undefined
      const o: IslandObject = { id: `hatchery:${slot}`, ...eggLook(egg.speciesId, art, catalog), ...hatcheryNestSpot(a, spot++), scale: eggScale, target: { kind: 'hatchery', slot }, ...(progress === undefined ? {} : { progress }) }
      eggs.push(o)
      group.push(o)
      markers.hatchery.push({ slot })
    })
    for (const d of state.dragons.filter(x => x.habitatId === null)) {
      const at = hatcheryNestSpot(a, Math.min(spot++, hatcherySlots(state.hatcheryLevel, state.hatcheryFifthSlot) - 1))
      group.push({ id: `dragon:${d.id}`, ...hatchlingLook(d.speciesId, art, catalog), ...at, scale: NEST_EGG_HATCHERY_SCALE, target: { kind: 'dragon', id: d.id } })
      markers.dragons.push(d.id)
      markers.waiting.push({ id: d.id, noRoom: true })
    }
    // What is in the nest, back to front, after the castle.
    group.splice(1, group.length - 1, ...group.slice(1).sort((p, q) => p.y - q.y))
    // One badge for the whole hatchery (per-egg badges pile up over its small nest); the panel lists each egg.
    // A construction timer wins and stays on the castle, as does 'no room'; otherwise the timer sits over the soonest egg.
    if (!group[0]!.badge) {
      if (markers.waiting.length > 0) group[0]!.badge = 'no room'
      else if (eggs.length > 0) {
        const soonest = state.hatchery.reduce((best, e, i) => (e.readyAtMs < state.hatchery[best]!.readyAtMs ? i : best), 0)
        eggs[soonest]!.badge = timerLabel(state.hatchery[soonest]!.readyAtMs, nowMs)
      }
    }
    add(hatcheryAt, FOOTPRINT.hatchery, group, { type: 'hatchery' })
  }

  state.farms.forEach((plot, i) => {
    const ref: MovableRef = { type: 'farm', index: i }
    const at = standing(ref, plot.placement)
    if (at.island !== view) return
    const a = anchor(at.col, at.row, FOOTPRINT.farm)
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
    add(at, FOOTPRINT.farm, group, ref)
    markers.farms.push({ plot: i, crop: plot.crop })
  })

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

  // Signs go on top of everything (a building next to them), just under the ghost. Each stands on the cell `signSpot` picks,
  // clear of the obstacles' art. On Home a sign says what it is; the other islands keep the plain sign.
  const price = plotPrice(view, plotsBought(state, view))
  const hereObstacles = state.islands.obstacles.filter(o => o.island === view)
  for (const plot of offeredPlots(state, view)) {
    const spot = signSpot(plot, hereObstacles, art)
    objects.push({
      id: `sign:${plot}`, key: textureKey('island.sign'), sprite: art.island.sign, ...cellCentre(spot.col, spot.row), target: { kind: 'plot', island: view, plot }, scale: SIGN_SCALE, minTap: TAP_PX, boxAlways: true,
      // No caption while placing: it would hide the Move arrow.
      ...(view === 'home' && !placing ? { caption: SIGN_CAPTION } : {}),
    })
    markers.signs.push({ plot, price })
  }

  if (placing) {
    const placement: Placement = { island: view, col: placing.col, row: placing.row, facing: placing.facing }
    const legal = placementRuleError(state, placementSubject(placing.what), placement) === null
    const target: Target = { kind: 'cell', col: placing.col, row: placing.row }
    const ghost: IslandObject = {
      id: 'ghost', ...ghostLook(state, art, placing.what), ...anchor(placing.col, placing.row, placing.size),
      target, ...(legal ? {} : { tint: 'bad' as const }), ...flip(placing.facing),
    }
    const top = cellTop(placing.col, placing.row)
    objects.push(ghost, ...carried, { id: 'arrow', key: textureKey('ui.island.arrow'), sprite: art.island.arrow, x: top.x, y: top.y - ARROW_GAP, scale: ARROW_SCALE, target })
    markers.ghost = { legal, col: placing.col, row: placing.row, size: placing.size }
  }
  return { objects, markers }
}

import {
  CROPS, getSpecies, HATCHERY_SLOTS, residents, storedGold, type Catalog, type PlayerState,
} from '@wyrmhaven/game-core'
import { textureKey } from '../art/phaserLoader'
import type { GameArtSet, Sprite } from '../art/types'
import type { Target } from './bridge'
import { dragonSlots, farmPos, habitatSlots, hatcheryPos, hoardPos, nestPos } from './layout'

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
}

export interface IslandMarkers {
  habitats: string[]
  dragons: string[]
  waiting: { id: string; noRoom: boolean }[]
  nests: { index: number; egg: boolean }[]
  hatchery: { slot: number }[]
  farms: { plot: number; crop: string | null }[]
  hoard: boolean
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

/** Dragon sheet for a species, falling back to the fire dragon until hybrids have art. */
export function dragonKey(speciesId: string, art: GameArtSet): string {
  return art.dragon[speciesId] ? textureKey(`dragon.${speciesId}`) : textureKey('dragon.fire')
}

/**
 * Pure: everything the Island scene draws for a state at a moment. No Phaser, so it is unit-tested
 * directly; the scene only turns objects into sprites.
 */
export function buildIslandModel(state: PlayerState | null, art: GameArtSet, catalog: Catalog, nowMs: number): IslandModel {
  const objects: IslandObject[] = []
  const markers: IslandMarkers = { habitats: [], dragons: [], waiting: [], nests: [], hatchery: [], farms: [], hoard: false }
  if (!state) return { objects, markers }
  const n = state.habitats.length

  // Each habitat with its dragons is one group; groups are drawn back row first so front tiles overlap.
  const groups: { y: number; objects: IslandObject[] }[] = []
  state.habitats.forEach((h, i) => {
    const p = habitatSlots(i, n)
    const gold = storedGold(h, residents(state, h.id), catalog, nowMs)
    const group: IslandObject[] = [{ id: `habitat:${h.id}`, key: textureKey(`habitat.${h.element}`), sprite: art.habitat[h.element], ...p, target: { kind: 'habitat', id: h.id }, badge: gold > 0 ? `${gold}g` : undefined }]
    markers.habitats.push(h.id)
    residents(state, h.id).forEach((d, slot) => {
      const dp = dragonSlots(i, slot, 7, n)
      group.push({ id: `dragon:${d.id}`, key: dragonKey(d.speciesId, art), sprite: art.dragon[d.speciesId] ?? art.dragon['fire']!, ...dp, target: { kind: 'dragon', id: d.id } })
      markers.dragons.push(d.id)
    })
    groups.push({ y: p.y, objects: group })
  })
  for (const g of groups.sort((a, b) => a.y - b.y)) objects.push(...g.objects)

  state.nests.forEach((egg, index) => {
    const p = nestPos(index)
    objects.push({ id: `nest:${index}`, key: textureKey('building.nest'), sprite: art.building.nest, ...p, target: { kind: 'nest', index } })
    if (egg) {
      const el = getSpecies(catalog, egg.speciesId).elements[0]!
      objects.push({ id: `egg:${index}`, key: textureKey(`egg.${el}`), sprite: art.egg[el], x: p.x, y: p.y - 10, target: { kind: 'nest', index }, badge: timerLabel(egg.readyAtMs, nowMs) })
    }
    markers.nests.push({ index, egg: egg !== null })
  })

  let hatcherySlot = 0
  state.hatchery.forEach((egg, slot) => {
    const p = hatcheryPos(hatcherySlot++)
    const el = getSpecies(catalog, egg.speciesId).elements[0]!
    objects.push({ id: `hatchery:${slot}`, key: textureKey(`egg.${el}`), sprite: art.egg[el], ...p, target: { kind: 'hatchery', slot }, badge: timerLabel(egg.readyAtMs, nowMs) })
    markers.hatchery.push({ slot })
  })
  for (const d of state.dragons.filter(x => x.habitatId === null)) {
    const p = hatcheryPos(Math.min(hatcherySlot++, HATCHERY_SLOTS - 1))
    const el = getSpecies(catalog, d.speciesId).elements[0]!
    objects.push({ id: `dragon:${d.id}`, key: textureKey(`hatchling.${el}`), sprite: art.hatchling[el], ...p, target: { kind: 'dragon', id: d.id }, badge: 'no room' })
    markers.dragons.push(d.id)
    markers.waiting.push({ id: d.id, noRoom: true })
  }

  state.farms.forEach((plot, i) => {
    const p = farmPos(i)
    objects.push({ id: `farm:${i}`, key: textureKey('building.farmPlot'), sprite: art.building.farmPlot, ...p, target: { kind: 'farm', plot: i } })
    if (plot.crop) {
      const grow = CROPS[plot.crop].growMs
      const fraction = Math.min(1, Math.max(0, 1 - (plot.readyAtMs - nowMs) / grow))
      const sprite = art.building.cropStage[plot.crop]
      // A stage sheet shows growth by frame; a single still (or fallback) grows by scale.
      const growth = sprite.frames > 1
        ? { frame: Math.min(sprite.frames - 1, Math.floor(fraction * sprite.frames)) }
        : { scale: 0.5 + 0.5 * fraction }
      objects.push({ id: `crop:${i}`, key: textureKey(`crop.${plot.crop}`), sprite, x: p.x, y: p.y - 10, target: { kind: 'farm', plot: i }, badge: timerLabel(plot.readyAtMs, nowMs), ...growth })
    }
    markers.farms.push({ plot: i, crop: plot.crop })
  })

  if (state.hoardLevel > 0) {
    const p = hoardPos()
    objects.push({ id: 'hoard', key: textureKey('building.hoard'), sprite: art.building.hoard, ...p, target: { kind: 'hoard' }, badge: `Hoard ${state.hoardLevel}` })
    markers.hoard = true
  }
  return { objects, markers }
}

import { DECORATIONS, ELEMENTS, ISLAND_ORDER, OBSTACLES, type Catalog, type CropId, type DecorationId, type Element, type IslandId, type ObstacleKind } from '@wyrmhaven/game-core'
import { footprintPx, SLOT_SIZES, type GameArtSet, type SlotName, type Sprite } from './types'

export interface ManifestEntry { file: string; w: number; h: number; frames: number; fps: number; /** Transparent top rows. */ top?: number }
/** `public/art/<version>/manifest.json`; keys documented in docs/superpowers/plans/2026-10-28-web-client.md Task 2. */
export interface Manifest { assets: Record<string, ManifestEntry> }

const CROPS: CropId[] = ['sprout', 'bushel', 'harvest', 'bounty']

/** Builds the typed art set; any key the manifest lacks becomes an empty sprite at its slot's default size. */
export function artSetFromManifest(version: string, manifest: Manifest, catalog: Catalog): GameArtSet {
  const get = (key: string, slot: SlotName | { w: number; h: number }): Sprite => {
    const e = manifest.assets[key]
    if (!e) return { src: '', ...(typeof slot === 'string' ? SLOT_SIZES[slot] : slot), frames: 1, fps: 0 }
    return { src: `/art/${version}/${e.file}`, w: e.w, h: e.h, frames: e.frames, fps: e.fps, ...(e.top !== undefined ? { top: e.top } : {}) }
  }
  const perElement = (prefix: string, slot: SlotName): Record<Element, Sprite> =>
    Object.fromEntries(ELEMENTS.map(el => [el, get(`${prefix}.${el}`, slot)])) as Record<Element, Sprite>

  const layerKeys = Object.keys(manifest.assets)
    .filter(k => /^island\.layer\.\d+$/.test(k))
    .sort((a, b) => Number(a.split('.')[2]) - Number(b.split('.')[2]))

  return {
    version,
    egg: perElement('egg', 'egg'),
    hatchling: perElement('hatchling', 'hatchling'),
    dragon: Object.fromEntries([...catalog.species.keys()].map(id => [id, get(`dragon.${id}`, 'dragon')])),
    habitat: perElement('habitat', 'habitat'),
    building: {
      nest: get('building.nest', 'nest'),
      hatchery: get('building.hatchery', 'hatchery'),
      farmPlot: get('building.farmPlot', 'farmPlot'),
      cropStage: Object.fromEntries(CROPS.map(c => [c, get(`crop.${c}`, 'crop')])) as Record<CropId, Sprite>,
      hoard: get('building.hoard', 'hoard'),
      nexus: get('building.nexus', 'nexus'),
    },
    elementIcon: perElement('icon', 'icon'),
    ui: { panel: get('ui.panel', 'panel'), button: get('ui.button', 'button'), cursor: get('ui.cursor', 'cursor') },
    island: { base: get('island.base', 'island'), layers: layerKeys.map(k => get(k, 'island')), locked: get('island.locked', 'locked'), sign: get('island.sign', 'sign') },
    obstacle: Object.fromEntries((Object.keys(OBSTACLES) as ObstacleKind[]).map(k => [k, get(`obstacle.${k}`, footprintPx(OBSTACLES[k].size))])) as Record<ObstacleKind, Sprite>,
    decoration: Object.fromEntries((Object.keys(DECORATIONS) as DecorationId[]).map(d => [d, get(`decoration.${d}`, footprintPx(DECORATIONS[d].size))])) as Record<DecorationId, Sprite>,
    map: Object.fromEntries(ISLAND_ORDER.map(i => [i, get(`map.${i}`, 'map')])) as Record<IslandId, Sprite>,
  }
}

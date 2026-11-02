import { DECORATIONS, ELEMENTS, ISLAND_ORDER, OBSTACLES, type Catalog, type CropId, type DecorationId, type Element, type IslandId, type ObstacleKind } from '@wyrmhaven/game-core'
import { footprintPx, SLOT_SIZES, type GameArtSet, type SlotName, type Sprite } from './types'

export interface ManifestEntry { file: string; w: number; h: number; frames: number; fps: number; /** Transparent top rows. */ top?: number }
/** `public/art/<version>/manifest.json`; keys documented in docs/superpowers/plans/2026-10-28-web-client.md Task 2. */
export interface Manifest { assets: Record<string, ManifestEntry> }

/** Manifest keys the HUD reads (docs/art/hud-art-list.md). */
const HUD_KEY = /^(icon\.[a-z]+\.(16|32)|ui\..+|map\.backdrop|map\.bridge|battle\.boss\.marker|trial\.chapter\.[a-z]+|trial\.node(\.boss|\.locked)?)$/

/** Manifest keys tried in turn for each obstacle until its own art lands: the nearest old sprite by footprint. */
const OBSTACLE_ART: Record<ObstacleKind, readonly string[]> = {
  ancientTree: ['ancientTree', 'boulder'], boulder: ['boulder'], largeRock: ['largeRock', 'ruin'],
  tree: ['tree'], smallRock: ['smallRock', 'rock'], bush: ['bush'],
}

const BATTLE_FX = ['hit', 'crit', 'immune', 'ko', 'swap'] as const
const CROPS: CropId[] = ['dragonBush', 'emberWheat', 'seaMelon', 'thunderPumpkin', 'frostBerries', 'warlordPepper']

/** Builds the typed art set; any key the manifest lacks becomes an empty sprite at its slot's default size. */
export function artSetFromManifest(version: string, manifest: Manifest, catalog: Catalog): GameArtSet {
  const get = (key: string, slot: SlotName | { w: number; h: number }): Sprite => {
    const e = manifest.assets[key]
    if (!e) return { src: '', ...(typeof slot === 'string' ? SLOT_SIZES[slot] : slot), frames: 1, fps: 0 }
    return { src: `/art/${version}/${e.file}`, w: e.w, h: e.h, frames: e.frames, fps: e.fps, ...(e.top !== undefined ? { top: e.top } : {}) }
  }
  /** A sprite only when the manifest has the key. */
  const present = (key: string): Sprite | null => (manifest.assets[key] ? get(key, 'icon') : null)
  /** `building.<name>.<1..max>` sheets the manifest has, by level; absent levels stay absent so nothing is requested. */
  const levelSheets = (name: string, max: number, size: number): Record<number, Sprite> =>
    Object.fromEntries(Array.from({ length: max }, (_, i) => i + 1).flatMap(l => (manifest.assets[`building.${name}.${l}`] ? [[l, get(`building.${name}.${l}`, { w: size, h: size })]] : [])))
  const perElement = (prefix: string, slot: SlotName): Record<Element, Sprite> =>
    Object.fromEntries(ELEMENTS.map(el => [el, get(`${prefix}.${el}`, slot)])) as Record<Element, Sprite>

  /** `<prefix>.<speciesId>` for species with an id of their own (not an element's Basic), only when the manifest has the key. */
  const speciesSheets = (prefix: string): Record<string, Sprite> =>
    Object.fromEntries([...catalog.species.keys()].filter(id => !(ELEMENTS as readonly string[]).includes(id)).flatMap(id => { const s = present(`${prefix}.${id}`); return s ? [[id, s]] : [] }))

  const layerKeys = Object.keys(manifest.assets)
    .filter(k => /^island\.layer\.\d+$/.test(k))
    .sort((a, b) => Number(a.split('.')[2]) - Number(b.split('.')[2]))

  return {
    version,
    egg: perElement('egg', 'egg'),
    hatchling: perElement('hatchling', 'hatchling'),
    // Basics always get a slot (drawn fallback if the art is missing); a hybrid or Legendary only when the manifest has
    // art for it. dragonLook falls back to the primary element's Basic sheet for the rest (R23), so no empty fallback texture per hybrid.
    dragon: Object.fromEntries([...catalog.species.values()]
      .filter(s => s.elements.length === 1 || manifest.assets[`dragon.${s.id}`])
      .map(s => [s.id, get(`dragon.${s.id}`, 'dragon')])),
    juvenile: Object.fromEntries([...catalog.species.keys()].flatMap(id => (manifest.assets[`juvenile.${id}`] ? [[id, get(`juvenile.${id}`, 'dragon')]] : []))),
    habitat: perElement('habitat', 'habitat'),
    building: {
      nest: get('building.nest', 'nest'),
      hatchery: get('building.hatchery', 'hatchery'),
      breeder: { mountain: levelSheets('mountain', 3, 80), grove: levelSheets('grove', 3, 80) },
      hatcheryLevel: levelSheets('hatchery', 4, 80),
      roostTier: levelSheets('roost', 5, 64),
      farmPlot: get('building.farmPlot', 'farmPlot'),
      cropStage: Object.fromEntries(CROPS.map(c => [c, get(`crop.${c}`, 'crop')])) as Record<CropId, Sprite>,
      cropSway: Object.fromEntries(CROPS.flatMap(c => { const s = present(`crop.${c}.sway`); return s ? [[c, s]] : [] })),
      nexus: get('building.nexus', 'nexus'),
      goldenAerie: present('building.goldenAerie'),
    },
    elementIcon: perElement('icon', 'icon'),
    ui: { panel: get('ui.panel', 'panel'), button: get('ui.button', 'button'), cursor: get('ui.cursor', 'cursor') },
    island: { base: get('island.base', 'island'), layers: layerKeys.map(k => get(k, 'island')), locked: get('island.locked', 'locked'), sign: get('island.sign', 'sign'), arrow: get('ui.island.arrow', 'arrow'), upgradePost: get('ui.island.upgradePost', 'upgradePost') },
    obstacle: Object.fromEntries((Object.keys(OBSTACLES) as ObstacleKind[]).map(k => [k, get(`obstacle.${OBSTACLE_ART[k].find(n => manifest.assets[`obstacle.${n}`]) ?? k}`, footprintPx(OBSTACLES[k].size))])) as Record<ObstacleKind, Sprite>,
    decoration: Object.fromEntries((Object.keys(DECORATIONS) as DecorationId[]).map(d => [d, get(`decoration.${d}`, footprintPx(DECORATIONS[d].size))])) as Record<DecorationId, Sprite>,
    map: Object.fromEntries(ISLAND_ORDER.map(i => [i, get(`map.${i}`, 'map')])) as Record<IslandId, Sprite>,
    fx: { construction: get('fx.construction', 'fxConstruction'), hatch: get('fx.hatch', 'fxHatch'), coins: get('fx.coins', 'fxCoins'), ...(manifest.assets['fx.levelUp'] ? { levelUp: get('fx.levelUp', 'fxHatch') } : {}) },
    ground: {
      grass: [0, 1, 2].map(i => present(`ground.grass.${i}`)).filter((g): g is Sprite => g !== null),
      fog: present('ground.fog'), water: present('ground.water'), cliffSw: present('ground.cliff.sw'), cliffSe: present('ground.cliff.se'),
      // Home keeps the plain tiles above; every other island may have its own, piece by piece.
      island: Object.fromEntries(ISLAND_ORDER.filter(i => i !== 'home').flatMap(i => {
        const grass = [0, 1, 2].map(n => present(`ground.${i}.${n}`)).filter((g): g is Sprite => g !== null)
        const cliffSw = present(`ground.cliff.${i}.sw`), cliffSe = present(`ground.cliff.${i}.se`)
        return grass.length > 0 || cliffSw || cliffSe ? [[i, { grass, cliffSw, cliffSe }]] : []
      })),
      plotEdge: present('ground.plotEdge'),
      sky: present('ground.sky'),
      clouds: [0, 1, 2].map(i => present(`ground.cloud.${i}`)).filter((c): c is Sprite => c !== null),
      rock: present('ground.rock'),
      rim: [0, 1, 2, 3].map(i => present(`ground.rim.${i}`)).filter((r): r is Sprite => r !== null),
      waterfall: present('ground.waterfall'),
    },
    battle: {
      backdrop: Object.fromEntries(ELEMENTS.flatMap(el => { const s = present(`battle.backdrop.${el}`); return s ? [[el, s]] : [] })),
      platform: present('ui.battle.platform'),
      moveFx: Object.fromEntries([...ELEMENTS, 'physical'].flatMap(m => { const s = present(`fx.move.${m}`); return s ? [[m, s]] : [] })),
      fx: Object.fromEntries(BATTLE_FX.flatMap(n => { const s = present(`fx.${n}`); return s ? [[n, s]] : [] })),
    },
    special: {
      egg: speciesSheets('egg'),
      hatchling: speciesSheets('hatchling'),
    },
    hud: Object.fromEntries(Object.keys(manifest.assets).filter(k => HUD_KEY.test(k)).map(k => [k, get(k, 'icon')])),
  }
}

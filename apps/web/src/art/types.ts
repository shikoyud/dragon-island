import type { CropId, DecorationId, Element, IslandId, ObstacleKind } from '@wyrmhaven/game-core'

/** One image or horizontal sprite sheet. Same shape as the waitlist site's manifest entries. */
export interface Sprite {
  /** Empty string = no asset yet; a programmatic fallback is drawn instead. */
  src: string
  w: number
  h: number
  frames: number
  fps: number
  /** Fully transparent rows above the art (smallest over all frames); badges sit just above them. */
  top?: number
}

export interface GameArtSet {
  /** Folder under /art/ and cache-buster. */
  version: string
  egg: Record<Element, Sprite>
  hatchling: Record<Element, Sprite>
  /** Keyed by species id. */
  dragon: Record<string, Sprite>
  habitat: Record<Element, Sprite>
  building: {
    nest: Sprite
    hatchery: Sprite
    farmPlot: Sprite
    cropStage: Record<CropId, Sprite>
    hoard: Sprite
    /** The all-element habitat on Dawnspire. */
    nexus: Sprite
  }
  elementIcon: Record<Element, Sprite>
  ui: { panel: Sprite; button: Sprite; cursor: Sprite }
  island: { base: Sprite; layers: Sprite[]; /** One locked ground cell. */ locked: Sprite; /** The home expansion sign. */ sign: Sprite }
  /** Base-building art; missing files draw footprint-sized boxes (16 px per cell). */
  obstacle: Record<ObstacleKind, Sprite>
  decoration: Record<DecorationId, Sprite>
  /** Island map icons. */
  map: Record<IslandId, Sprite>
}

/** Default pixel sizes per slot, used when an asset is missing. */
export const SLOT_SIZES = {
  egg: { w: 32, h: 32 },
  hatchling: { w: 32, h: 32 },
  dragon: { w: 48, h: 48 },
  habitat: { w: 80, h: 64 },
  nexus: { w: 80, h: 64 },
  nest: { w: 32, h: 32 },
  hatchery: { w: 64, h: 64 },
  farmPlot: { w: 32, h: 32 },
  crop: { w: 16, h: 16 },
  hoard: { w: 64, h: 64 },
  icon: { w: 16, h: 16 },
  panel: { w: 24, h: 24 },
  button: { w: 24, h: 16 },
  cursor: { w: 8, h: 8 },
  island: { w: 480, h: 270 },
  locked: { w: 16, h: 16 },
  sign: { w: 32, h: 32 },
  map: { w: 32, h: 32 },
} as const

export type SlotName = keyof typeof SLOT_SIZES

/** Pixel edge of a base-building object with a footprint of `cells` x `cells` (16 px per cell). */
export const footprintPx = (cells: 1 | 2 | 3): { w: number; h: number } => ({ w: cells * 16, h: cells * 16 })

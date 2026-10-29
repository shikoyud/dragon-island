import type { CropId, DecorationId, Element, ObstacleKind } from '@wyrmhaven/game-core'

/** One image or horizontal sprite sheet. Same shape as the waitlist site's manifest entries. */
export interface Sprite {
  /** Empty string = no asset yet; a programmatic fallback is drawn instead. */
  src: string
  w: number
  h: number
  frames: number
  fps: number
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
  }
  elementIcon: Record<Element, Sprite>
  ui: { panel: Sprite; button: Sprite; cursor: Sprite }
  island: { base: Sprite; layers: Sprite[] }
  /** Base-building slots (Task 14 fills the manifest); absent ones draw at OPTIONAL_SLOT_SIZES. */
  obstacle?: Record<ObstacleKind, Sprite>
  decoration?: Record<DecorationId, Sprite>
  nexus?: Sprite
  sign?: Sprite
  locked?: Sprite
  map?: Sprite
}

/** Fallback pixel sizes of the optional slots; obstacles and decorations scale with their footprint (1/2/3 cells). */
export const OPTIONAL_SLOT_SIZES = {
  footprint: { 1: { w: 16, h: 16 }, 2: { w: 32, h: 32 }, 3: { w: 48, h: 48 } },
  nexus: { w: 80, h: 64 },
  sign: { w: 32, h: 32 },
  locked: { w: 16, h: 16 },
  map: { w: 32, h: 32 },
} as const

/** Default pixel sizes per slot, used when an asset is missing. */
export const SLOT_SIZES = {
  egg: { w: 32, h: 32 },
  hatchling: { w: 32, h: 32 },
  dragon: { w: 48, h: 48 },
  habitat: { w: 96, h: 64 },
  nest: { w: 32, h: 32 },
  hatchery: { w: 64, h: 48 },
  farmPlot: { w: 32, h: 24 },
  crop: { w: 16, h: 16 },
  hoard: { w: 48, h: 48 },
  icon: { w: 16, h: 16 },
  panel: { w: 24, h: 24 },
  button: { w: 24, h: 16 },
  cursor: { w: 8, h: 8 },
  island: { w: 480, h: 270 },
} as const

export type SlotName = keyof typeof SLOT_SIZES

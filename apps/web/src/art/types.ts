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
  /** Juvenile (Lv 4-6) sheets by species id; only species the manifest has art for appear (R11), the rest use `dragon`. */
  juvenile: Record<string, Sprite>
  habitat: Record<Element, Sprite>
  building: {
    nest: Sprite
    hatchery: Sprite
    /** Per-level Mountain and Grove sheets (`building.<kind>.<level>`), only for levels the manifest has; the rest fall back (lower level, then `nest`). */
    breeder: { mountain: Record<number, Sprite>; grove: Record<number, Sprite> }
    /** Per-level Hatchery sheets (`building.hatchery.<1..4>`), only for levels the manifest has; the rest fall back (lower level, then `hatchery`). */
    hatcheryLevel: Record<number, Sprite>
    /** Per-tier Dragon Roost sheets (`building.roost.<1..5>`), only for tiers the manifest has; the rest fall back (lower tier, then `nest`). */
    roostTier: Record<number, Sprite>
    farmPlot: Sprite
    cropStage: Record<CropId, Sprite>
    /** Ripe-stage sway loop per crop, when the manifest has one (else the last growth frame stays still). */
    cropSway: Partial<Record<CropId, Sprite>>
    /** The all-element habitat. */
    nexus: Sprite
    /** The Golden Aerie's own sprite when the manifest has one; null = it reuses the Nexus sprite. */
    goldenAerie: Sprite | null
  }
  elementIcon: Record<Element, Sprite>
  ui: { panel: Sprite; button: Sprite; cursor: Sprite }
  island: { base: Sprite; layers: Sprite[]; /** One locked ground cell. */ locked: Sprite; /** The sign on a plot for sale. */ sign: Sprite }
  /** Base-building art; missing files draw footprint-sized boxes (16 px per cell). */
  obstacle: Record<ObstacleKind, Sprite>
  decoration: Record<DecorationId, Sprite>
  /** Island map icons. */
  map: Record<IslandId, Sprite>
  /** Effects: a loop over buildings under construction, a one-shot burst where an egg hatches. */
  fx: { construction: Sprite; hatch: Sprite; /** Gold coin burst, one-shot, on a tapped gold badge. */ coins: Sprite; /** Level-up burst, one-shot; optional, the screen alone marks a level without it. */ levelUp?: Sprite }
  /** Isometric ground tiles; null (or empty) until the art exists, and the island scene draws placeholders. */
  ground: { grass: Sprite[]; fog: Sprite | null; water: Sprite | null; cliffSw: Sprite | null; cliffSe: Sprite | null }
  /** HUD art present in the manifest (icon.<name>.16/.32, ui.*), by manifest key; absent keys use drawn placeholders. */
  hud: Record<string, Sprite>
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
  icon: { w: 16, h: 16 },
  panel: { w: 24, h: 24 },
  button: { w: 24, h: 16 },
  cursor: { w: 8, h: 8 },
  island: { w: 480, h: 270 },
  locked: { w: 16, h: 16 },
  sign: { w: 32, h: 32 },
  map: { w: 32, h: 32 },
  fxConstruction: { w: 32, h: 32 },
  fxHatch: { w: 48, h: 48 },
  fxCoins: { w: 32, h: 32 },
} as const

export type SlotName = keyof typeof SLOT_SIZES

/** Pixel edge of a base-building object with a footprint of `cells` x `cells` (16 px per cell). */
export const footprintPx = (cells: number): { w: number; h: number } => ({ w: cells * 16, h: cells * 16 })

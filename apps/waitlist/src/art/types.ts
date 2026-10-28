import type { Element } from '../domain/elements'

export type { Element }

export interface Sprite {
  src: string
  w: number
  h: number
  frames: number
  fps: number
}

export interface ArtSet {
  /** Busts the share-card cache. */
  version: string
  hero: { base: Sprite; layers: Sprite[] }
  egg: Record<Element, Sprite>
  hatchling: Record<Element, Sprite>
  elementIcon: Record<Element, Sprite>
  ui: { panel: Sprite; button: Sprite }
}

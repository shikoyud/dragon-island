import { DECORATIONS, OBSTACLES, type Element } from '@wyrmhaven/game-core'
import type Phaser from 'phaser'
import { drawFallback, fallbackKey, type FallbackSlot } from './fallback'
import type { GameArtSet, Sprite } from './types'

/** Texture key for a slot path such as `egg.fire` or `dragon.fw-rare`. */
export const textureKey = (slotPath: string): string => `art:${slotPath}`

interface Entry { key: string; sprite: Sprite; slot: FallbackSlot; element: Element }

/** Flattens the art set into (texture key, sprite, fallback slot, element) rows. */
export function artEntries(art: GameArtSet): Entry[] {
  const rows: Entry[] = []
  const add = (path: string, sprite: Sprite, slot: FallbackSlot, element: Element = 'fire') =>
    rows.push({ key: textureKey(path), sprite, slot, element })
  for (const [el, s] of Object.entries(art.egg) as [Element, Sprite][]) add(`egg.${el}`, s, 'egg', el)
  for (const [el, s] of Object.entries(art.hatchling) as [Element, Sprite][]) add(`hatchling.${el}`, s, 'hatchling', el)
  for (const [id, s] of Object.entries(art.dragon)) add(`dragon.${id}`, s, 'dragon', elementOfSpecies(id))
  for (const [el, s] of Object.entries(art.habitat) as [Element, Sprite][]) add(`habitat.${el}`, s, 'habitat', el)
  add('building.nest', art.building.nest, 'nest')
  add('building.hatchery', art.building.hatchery, 'hatchery')
  add('building.farmPlot', art.building.farmPlot, 'farmPlot')
  for (const [c, s] of Object.entries(art.building.cropStage)) add(`crop.${c}`, s, 'crop', 'nature')
  add('building.hoard', art.building.hoard, 'hoard')
  add('building.nexus', art.building.nexus, 'nexus')
  for (const [d, s] of Object.entries(art.decoration)) add(`decoration.${d}`, s, 'decoration', DECORATIONS[d as keyof typeof DECORATIONS].island ? 'light' : 'nature')
  for (const [k, s] of Object.entries(art.obstacle)) add(`obstacle.${k}`, s, 'obstacle', OBSTACLES[k as keyof typeof OBSTACLES].size > 1 ? 'earth' : 'nature')
  for (const [i, s] of Object.entries(art.map)) add(`map.${i}`, s, 'map', 'water')
  for (const [el, s] of Object.entries(art.elementIcon) as [Element, Sprite][]) add(`icon.${el}`, s, 'icon', el)
  add('ui.panel', art.ui.panel, 'panel')
  add('ui.button', art.ui.button, 'button')
  add('ui.cursor', art.ui.cursor, 'cursor')
  add('island.base', art.island.base, 'island', 'water')
  add('island.locked', art.island.locked, 'locked')
  add('island.sign', art.island.sign, 'sign')
  art.island.layers.forEach((s, i) => add(`island.layer.${i}`, s, 'island', 'water'))
  return rows
}

/** Pure species ids are element names; hybrids fall back to fire until the catalog carries art hints. */
function elementOfSpecies(id: string): Element {
  const pure = ['fire', 'water', 'earth', 'nature', 'electric', 'ice', 'metal', 'dark', 'light'] as const
  return (pure as readonly string[]).includes(id) ? (id as Element) : 'fire'
}

/**
 * Queues every real sprite sheet on the scene loader and generates a canvas texture for every
 * empty slot with `drawFallback`. Call from `preload`; fallbacks are available immediately.
 */
export function loadArt(scene: Phaser.Scene, art: GameArtSet): void {
  for (const { key, sprite, slot, element } of artEntries(art)) {
    if (scene.textures.exists(key)) continue
    if (sprite.src) {
      scene.load.spritesheet(key, sprite.src, { frameWidth: sprite.w, frameHeight: sprite.h })
    } else {
      const tex = scene.textures.createCanvas(key, sprite.w, sprite.h)
      if (!tex) continue
      drawFallback(tex.context, slot, element, sprite.w, sprite.h)
      tex.refresh()
    }
  }
}

/** Animation key for a sprite sheet texture. */
export const animKey = (key: string): string => `${key}:idle`

/** Plays the sheet's idle loop, or shows frame 0 when the sprite is static or motion is reduced. */
export function playOrStill(sprite: Phaser.GameObjects.Sprite, key: string, frames: number, fps: number, reducedMotion: boolean): void {
  sprite.setTexture(key, 0)
  if (frames <= 1 || fps <= 0 || reducedMotion) {
    sprite.anims.stop()
    return
  }
  const anims = sprite.scene.anims
  if (!anims.exists(animKey(key))) {
    anims.create({ key: animKey(key), frames: anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }), frameRate: fps, repeat: -1 })
  }
  sprite.play(animKey(key))
}

/** Fallback texture key helper kept for callers that draw ad-hoc fallbacks. */
export { fallbackKey }

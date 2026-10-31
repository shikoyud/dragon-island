import { DECORATIONS, ELEMENTS, OBSTACLES, type Element } from '@wyrmhaven/game-core'
import type Phaser from 'phaser'
import { drawFallback, fallbackKey, type FallbackSlot } from './fallback'
import type { GameArtSet, Sprite } from './types'

/** Texture key for a slot path such as `egg.flame` or `dragon.fw-rare`. */
export const textureKey = (slotPath: string): string => `art:${slotPath}`

interface Entry { key: string; sprite: Sprite; slot: FallbackSlot; element: Element }

/** Flattens the art set into (texture key, sprite, fallback slot, element) rows. */
export function artEntries(art: GameArtSet): Entry[] {
  const rows: Entry[] = []
  const add = (path: string, sprite: Sprite, slot: FallbackSlot, element: Element = 'flame') =>
    rows.push({ key: textureKey(path), sprite, slot, element })
  for (const [el, s] of Object.entries(art.egg) as [Element, Sprite][]) add(`egg.${el}`, s, 'egg', el)
  for (const [el, s] of Object.entries(art.hatchling) as [Element, Sprite][]) add(`hatchling.${el}`, s, 'hatchling', el)
  for (const [id, s] of Object.entries(art.dragon)) add(`dragon.${id}`, s, 'dragon', elementOfSpecies(id))
  for (const [id, s] of Object.entries(art.juvenile)) add(`juvenile.${id}`, s, 'dragon', elementOfSpecies(id))
  for (const [el, s] of Object.entries(art.habitat) as [Element, Sprite][]) add(`habitat.${el}`, s, 'habitat', el)
  add('building.nest', art.building.nest, 'nest')
  add('building.hatchery', art.building.hatchery, 'hatchery')
  // Level sheets exist only when the manifest has them, so an absent key never becomes a request or a texture.
  for (const kind of ['mountain', 'grove'] as const) for (const [l, s] of Object.entries(art.building.breeder[kind])) add(`building.${kind}.${l}`, s, 'nest')
  for (const [l, s] of Object.entries(art.building.hatcheryLevel)) add(`building.hatchery.${l}`, s, 'hatchery')
  for (const [t, s] of Object.entries(art.building.roostTier)) add(`building.roost.${t}`, s, 'hatchery')
  add('building.farmPlot', art.building.farmPlot, 'farmPlot')
  for (const [c, s] of Object.entries(art.building.cropStage)) add(`crop.${c}`, s, 'crop', 'nature')
  for (const [c, s] of Object.entries(art.building.cropSway)) if (s) add(`crop.${c}.sway`, s, 'crop', 'nature')
  add('building.nexus', art.building.nexus, 'nexus')
  if (art.building.goldenAerie) add('building.goldenAerie', art.building.goldenAerie, 'nexus', 'light')
  for (const [d, s] of Object.entries(art.decoration)) add(`decoration.${d}`, s, 'decoration', DECORATIONS[d as keyof typeof DECORATIONS].island ? 'light' : 'nature')
  for (const [k, s] of Object.entries(art.obstacle)) add(`obstacle.${k}`, s, 'obstacle', OBSTACLES[k as keyof typeof OBSTACLES].size > 1 ? 'terra' : 'nature')
  for (const [i, s] of Object.entries(art.map)) add(`map.${i}`, s, 'map', 'sea')
  // The Map's backdrop and Bridge load only when they exist: without them it shows the sea and draws its own lines.
  for (const k of ['map.backdrop', 'map.bridge']) { const s = art.hud[k]; if (s) add(k, s, 'island', 'sea') }
  for (const [el, s] of Object.entries(art.elementIcon) as [Element, Sprite][]) add(`icon.${el}`, s, 'icon', el)
  add('ui.panel', art.ui.panel, 'panel')
  add('ui.button', art.ui.button, 'button')
  add('ui.cursor', art.ui.cursor, 'cursor')
  add('island.base', art.island.base, 'island', 'sea')
  add('island.locked', art.island.locked, 'locked')
  add('island.sign', art.island.sign, 'sign')
  art.island.layers.forEach((s, i) => add(`island.layer.${i}`, s, 'island', 'sea'))
  add('fx.construction', art.fx.construction, 'fx', 'terra')
  add('fx.hatch', art.fx.hatch, 'fx', 'light')
  add('fx.coins', art.fx.coins, 'fxCoins', 'light')
  if (art.fx.levelUp) add('fx.levelUp', art.fx.levelUp, 'fx', 'light')
  // Ground tiles load only when they exist: without them the island scene draws its own diamonds.
  const ground = art.ground
  ground.grass.forEach((s, i) => add(`ground.grass.${i}`, s, 'island', 'nature'))
  for (const [k, s] of [['fog', ground.fog], ['water', ground.water], ['cliff.sw', ground.cliffSw], ['cliff.se', ground.cliffSe]] as const) if (s) add(`ground.${k}`, s, 'island', 'terra')
  return rows
}

/** Pure species ids are element names; hybrids fall back to flame until the catalog carries art hints. */
function elementOfSpecies(id: string): Element {
  return (ELEMENTS as readonly string[]).includes(id) ? (id as Element) : 'flame'
}

/**
 * Queues every real sprite sheet on the scene loader and generates a canvas texture for every
 * empty slot with `drawFallback`. Call from `preload`; fallbacks are available immediately.
 */
export function loadArt(scene: Phaser.Scene, art: GameArtSet): void {
  const entries = artEntries(art)
  const drawn = (e: Entry): void => {
    const tex = scene.textures.createCanvas(e.key, e.sprite.w, e.sprite.h)
    if (!tex) return
    drawFallback(tex.context, e.slot, e.element, e.sprite.w, e.sprite.h)
    tex.refresh()
  }
  for (const e of entries) {
    if (scene.textures.exists(e.key)) continue
    if (e.sprite.src) scene.load.spritesheet(e.key, e.sprite.src, { frameWidth: e.sprite.w, frameHeight: e.sprite.h })
    else drawn(e)
  }
  // A PNG that fails to load leaves no texture, and Phaser would show its green __MISSING box: draw the usual placeholder instead.
  scene.load.on('loaderror', (file: { key: string }) => {
    const e = entries.find(x => x.key === file.key)
    if (e && !scene.textures.exists(e.key)) drawn(e)
  })
}

/** Ticks the water tile sprite through its frames; does nothing for a still, reduced motion or a sheet whose frames are missing. */
export function animateWater(scene: Phaser.Scene, water: Phaser.GameObjects.TileSprite, key: string, frames: number, fps: number, reducedMotion: boolean): void {
  if (frames <= 1 || fps <= 0 || reducedMotion || !hasFrames(scene, key, frames)) return
  let f = 0
  scene.time.addEvent({ delay: 1000 / fps, loop: true, callback: () => { if (water.active) water.setFrame(f = (f + 1) % frames) } })
}

/** Animation key for a sprite sheet texture. */
export const animKey = (key: string): string => `${key}:idle`

/**
 * True when the texture really has frames 0..frames-1. A sheet that failed to load has no texture and a drawn fallback
 * has no numbered frames; an animation made from either has no frames, and Phaser throws when it is played.
 */
function hasFrames(scene: Phaser.Scene, key: string, frames: number): boolean {
  if (!scene.textures.exists(key)) return false
  const texture = scene.textures.get(key)
  return Array.from({ length: frames }, (_, i) => i).every(i => texture.has(i as unknown as string))
}

/**
 * Plays the sheet's idle loop, or shows frame 0 when the sprite is static, motion is reduced or the sheet's frames
 * are missing. Never throws: one bad sheet costs that sprite its animation, not the island.
 */
export function playOrStill(sprite: Phaser.GameObjects.Sprite, key: string, frames: number, fps: number, reducedMotion: boolean): void {
  sprite.setTexture(key, 0)
  if (frames <= 1 || fps <= 0 || reducedMotion || !hasFrames(sprite.scene, key, frames)) {
    sprite.anims.stop()
    return
  }
  const anims = sprite.scene.anims
  if (!anims.exists(animKey(key))) {
    anims.create({ key: animKey(key), frames: anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }), frameRate: fps, repeat: -1 })
  }
  // The island rebuilds its sprites every second; start where the loop would be on the scene clock (plus a position offset
  // so neighbours are out of step) so the rebuild does not restart every animation at frame 0.
  const now = sprite.scene.time?.now ?? 0
  const spread = Math.abs(Math.floor((sprite.x ?? 0) * 7 + (sprite.y ?? 0) * 13)) % frames
  const startFrame = (Math.floor((now / 1000) * fps) + spread) % frames
  sprite.play({ key: animKey(key), startFrame })
}

/** A sheet with frames to play, as opposed to a still or a drawn fallback. */
export const isSheet = (sprite: Sprite): boolean => sprite.frames > 1 && sprite.fps > 0

/**
 * Plays the sheet once on `spr` and destroys it at the end, on its own animation because the idle one loops.
 * A still, or a sheet whose frames are missing, does nothing and returns false, so the caller can use a tween instead.
 */
export function playOneShot(spr: Phaser.GameObjects.Sprite, key: string, sprite: Sprite): boolean {
  if (!isSheet(sprite) || !hasFrames(spr.scene, key, sprite.frames)) return false
  const anims = spr.scene.anims
  const anim = `${key}:once`
  if (!anims.exists(anim)) anims.create({ key: anim, frames: anims.generateFrameNumbers(key, { start: 0, end: sprite.frames - 1 }), frameRate: sprite.fps, repeat: 0 })
  spr.play(anim).once('animationcomplete', () => spr.destroy())
  return true
}

/** Fallback texture key helper kept for callers that draw ad-hoc fallbacks. */
export { fallbackKey }

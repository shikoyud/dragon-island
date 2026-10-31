import { FOOTPRINT, ISLAND_TILES, LAUNCH_CATALOG, ownedPlots, plotOrigin, TILES_PER_PLOT, type Catalog } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { animateWater, isSheet, playOneShot, playOrStill, textureKey } from '../../art/phaserLoader'
import { FALLBACK_ART } from '../../art/slots'
import type { GameArtSet } from '../../art/types'
import type { Bridge, Target } from '../bridge'
import {
  cameraBounds, clampView, groundCell, lockedTiles, openingView, panBy, screenToWorld, shownSize, SKIRT, worldToScreen, zoomRange, type View,
} from '../camera'
import { badgeY, buildIslandModel, groundTiles, groundVariant, objectSignature, type IslandMarkers, type IslandObject } from '../islandModel'
import { anchor, cellCentre, cellTop, footprintDiamond, islandBox, pointerToCell, tapHit, type Box, type Pos } from '../layout'
import { createPanZoom, heldPointers } from '../panZoom'
import { pickTarget, type Hit } from '../pickTarget'

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#f2f1ea', stroke: '#0f1324', strokeThickness: 2,
}
const TINT = { ok: 0x9dffa8, bad: 0xff7a7a, building: 0xa8a8c0 } as const
/** Placeholder ground colours until the ground tiles in docs/art/hud-art-list.md exist. */
const GROUND = {
  grass: [0x5f9e3f, 0x579538], fog: [0xb9c4cf, 0xaab6c3], cliffLeft: 0x6b4a2b, cliffRight: 0x8b6136, lip: 0x3d6e2c, strata: 0x58391f,
}
const EMPTY: IslandMarkers = {
  habitats: [], dragons: [], waiting: [], breeders: [], hatchery: [], farms: [],
  obstacles: [], decorations: [], ghost: null, signs: [],
}
/** On-screen height of badge text in CSS pixels (the font is 8 px in world space). */
const BADGE_PX = 14
/** Local (unscaled) size of a tappable badge's hit box: 28 local px x BADGE_PX / 8 = 49 CSS px, over the 44 px minimum. */
const BADGE_HIT_LOCAL = 28
/** World box of the baked landmass: the island's diamond and the cliff skirt under it. */
const groundBox = (): Box => {
  const b = islandBox(ISLAND_TILES, ISLAND_TILES)
  return { x: b.x, y: b.y, w: b.w, h: b.h + SKIRT }
}

const points = (pts: Pos[]) => pts.map(p => new Phaser.Math.Vector2(p.x, p.y))

/**
 * Draws one island of the player's base in an isometric (2:1) projection from `buildIslandModel` (pure, tested) on
 * every state, view or placing change and once a second for timers; a sprite whose look is unchanged is kept. The camera is a pure `View` (camera.ts) moved by
 * `panZoom`. The scene owns no game logic: it emits `select`, `hover` and `cell` events only. While the Map or a battle
 * shows it sleeps: no drawing and no clock, its camera and bake kept, and it catches up when it wakes.
 */
export class IslandScene extends Phaser.Scene {
  /** Placeholder diamonds and the cliff skirt are drawn here, then baked into `groundRt`. */
  private ground!: Phaser.GameObjects.Graphics
  /** The whole landmass (ground, fog, cliff) baked into one texture per island and holding, instead of ~1,100 images. */
  private groundRt: Phaser.GameObjects.RenderTexture | null = null
  private water: Phaser.GameObjects.TileSprite | null = null
  private waterTimer: Phaser.Time.TimerEvent | null = null
  private hatchView: string | null = null
  private outline!: Phaser.GameObjects.Graphics
  private layer!: Phaser.GameObjects.Container
  /** What is on the layer, in draw order. Kept across syncs: only what changed is made again (see `reconcile`). */
  private drawn: Phaser.GameObjects.GameObject[] = []
  private badges: Phaser.GameObjects.Text[] = []
  /** The sprite or badge text standing for each object id (`badge:` + id for a badge) and the look it was made with. */
  private live = new Map<string, { obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Text; sig: string }>()
  /** Sprites that must be at least `minTap` CSS px to tap: their hit box follows the zoom (see `fitTapTargets`). */
  private tapTargets: { spr: Phaser.GameObjects.Sprite; minTap: number; always: boolean; pixel: Phaser.Types.Input.HitAreaCallback; area: unknown }[] = []
  private current: IslandMarkers = EMPTY
  private catalog: Catalog = LAUNCH_CATALOG
  private readonly gestures = createPanZoom({
    view: () => this.view,
    apply: v => this.apply(v),
    range: () => this.range(),
    size: () => ({ w: this.scale.width, h: this.scale.height }),
  })
  private levelUpOnWake = false
  private lastCell = ''
  private hoverKey = ''
  private groundKey = ''
  private view: View | null = null
  private framed = ''

  constructor(private readonly bridge: Bridge) {
    super('island')
  }

  create(): void {
    this.ground = this.add.graphics().setVisible(false)
    const land = groundBox()
    // A headless game (tests) has no renderer to hold a texture: it bakes nothing.
    if (this.game.config.renderType !== Phaser.HEADLESS) this.groundRt = this.add.renderTexture(land.x, land.y, land.w, land.h).setOrigin(0, 0)
    this.layer = this.add.container(0, 0)
    // Over the sprites: an illegal footprint must show even where it overlaps a building.
    this.outline = this.add.graphics()
    // Bridge subscriptions must die with the scene: React StrictMode (and hot reload) destroys and
    // recreates the game, and a destroyed scene drawing on a state event crashes Phaser.
    const offs = [
      this.bridge.on('state', () => this.sync()),
      this.bridge.on('view', () => this.sync()),
      this.bridge.on('insets', () => { this.framed = ''; this.sync() }),
      this.bridge.on('placing', e => {
        this.lastCell = ''
        this.sync()
        if (e.placing && !this.sys.isSleeping()) this.reveal(anchor(e.placing.col, e.placing.row, e.placing.size))
      }),
      this.bridge.on('levelUp', () => {
        if (!this.alive()) return
        // The screen can open before the island wakes (a level gained in a battle): play it then.
        if (this.sys.isSleeping()) this.levelUpOnWake = true
        else this.playLevelUp()
      }),
      this.bridge.on('levelUpClosed', () => { this.levelUpOnWake = false }),
    ]
    const cellToScreen = (col: number, row: number) => this.toScreen(cellCentre(col, row))
    const focusCell = () => {
      const { top, bottom } = this.bridge.insets
      const w = this.toWorld({ x: this.scale.width / 2, y: (top + this.scale.height - bottom) / 2 })
      return pointerToCell(w.x, w.y)
    }
    this.bridge.cellToScreen = cellToScreen
    this.bridge.focusCell = focusCell
    const onResize = () => { if (this.alive() && !this.sys.isSleeping()) this.frame() }
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize)
    // Back from the Map or a battle: the camera is where it was (or opens on a new island), and the bake catches up.
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      this.sync()
      if (this.levelUpOnWake) this.playLevelUp()
      this.levelUpOnWake = false
    })
    this.events.on(Phaser.Scenes.Events.SLEEP, () => {
      this.gestures.reset()
      this.hoverKey = ''
      this.input.setDefaultCursor('')
    })
    // A lost WebGL context empties every render target. Phaser restores its textures and then says so: bake the land again.
    const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | Phaser.Renderer.Canvas.CanvasRenderer | undefined
    const onRestore = () => { if (this.alive()) { this.groundKey = ''; this.sync() } }
    renderer?.on?.(Phaser.Renderer.Events.RESTORE_WEBGL, onRestore)
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      offs.forEach(off => off())
      // StrictMode boots a second game while this one is torn down: clear only the hooks this scene set, so the
      // hooks always belong to the live scene (and their presence means the island is ready for input).
      if (this.bridge.cellToScreen === cellToScreen) this.bridge.cellToScreen = null
      if (this.bridge.focusCell === focusCell) this.bridge.focusCell = null
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize)
      renderer?.off?.(Phaser.Renderer.Events.RESTORE_WEBGL, onRestore)
    })
    // Every sprite under the pointer is reported, not only the topmost: `pickTarget` chooses (a real pixel hit beats a tap box).
    this.input.setTopOnly(false)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p))
    this.input.on('pointermove', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.onMove(p, over))
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.onUp(p, over))
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.gestures.wheel(p, dy))
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.sync() })
    this.sync()
    this.bridge.emit({ type: 'ready' })
  }

  private art(): GameArtSet {
    return this.bridge.art ?? FALLBACK_ART
  }

  /**
   * True while this scene can still own display objects. `game.destroy` only marks the game until its next step, and
   * the art swap puts the new art on the bridge at once: until then this game's textures do not match `bridge.art`.
   * The replacement game draws the latest state when its own island scene starts, so nothing is lost by skipping.
   * `pendingDestroy` is missing from Phaser's types; test/artSwapCrash.test.ts pins it against the real game.
   */
  private alive(): boolean {
    const dying = (this.game as (Phaser.Game & { pendingDestroy?: boolean }) | undefined)?.pendingDestroy
    return !dying && Boolean(this.sys?.displayList) && this.sys.settings.status !== Phaser.Scenes.DESTROYED && this.sys.settings.status !== Phaser.Scenes.SHUTDOWN
  }

  // ---- camera ------------------------------------------------------------------------------------------------

  /** Camera bounds grown by the HUD insets at a zoom, so the island centres in the band the HUD leaves free. */
  private bounds(zoom: number): Box {
    const b = cameraBounds()
    const { top, bottom } = this.bridge.insets
    return { x: b.x, y: b.y - top / zoom, w: b.w, h: b.h + (top + bottom) / zoom }
  }

  /** The opening view (R58): owned land centred in the band the HUD leaves free, at the whole-number zoom that fits it. */
  private opening(): View {
    const { top, bottom } = this.bridge.insets
    const v = openingView(this.bridge.state, this.bridge.view, this.scale.width, Math.max(1, this.scale.height - top - bottom))
    // The free band's middle sits (top - bottom) / 2 below the screen's: look that much higher in the world.
    return { ...v, cy: v.cy + (bottom - top) / 2 / v.zoom }
  }

  private fit(): number {
    return this.opening().zoom
  }

  private range(): { min: number; max: number } {
    return zoomRange(this.fit())
  }

  private apply(v: View): void {
    this.view = clampView(v, this.scale.width, this.scale.height, this.bounds(v.zoom))
    const cam = this.cameras.main
    cam.setZoom(this.view.zoom)
    cam.centerOn(this.view.cx, this.view.cy)
    const scale = this.badgeScale()
    for (const t of this.badges) if (t.active) t.setScale(scale)
    this.fitTapTargets()
  }

  /**
   * Gives each small tap target (an obstacle, a plot sign) a box of at least its `minTap` CSS px at the current zoom,
   * centred on the sprite. Past that size the pixel-perfect hit comes back, except for `boxAlways` targets (signs), which
   * keep their box at every zoom. Where boxes overlap, Phaser hands the tap to the topmost sprite, which is the draw
   * order: a building or dragon drawn in front of an obstacle or sign still wins.
   */
  private fitTapTargets(): void {
    const zoom = this.view?.zoom ?? 1
    for (const { spr, minTap, always, pixel, area } of this.tapTargets) {
      if (!spr.active || !spr.input) continue
      const shown = { w: spr.displayWidth, h: spr.displayHeight }
      const box = tapHit(shown, zoom, minTap, always)
      if (box.pixel) {
        spr.input.hitArea = area
        spr.input.hitAreaCallback = pixel
      } else {
        const w = box.w / spr.scaleX
        const h = box.h / spr.scaleY
        spr.input.hitArea = new Phaser.Geom.Rectangle((spr.width - w) / 2, (spr.height - h) / 2, w, h)
        spr.input.hitAreaCallback = Phaser.Geom.Rectangle.Contains
      }
    }
  }

  /** Opens the camera on the owned land when the view, the state's arrival or the screen changes; otherwise only re-clamps. */
  private frame(): void {
    const s = this.bridge.state
    const key = `${this.bridge.view}:${s ? 'state' : 'none'}:${this.scale.width}x${this.scale.height}`
    if (key === this.framed && this.view) return this.apply(this.view)
    this.framed = key
    this.apply(this.opening())
  }

  /** Pans just enough to bring a world point (the placement ghost) into the band the HUD leaves free. */
  private reveal(p: Pos): void {
    if (!this.view) return
    const s = this.toScreen(p)
    const { top, bottom } = this.bridge.insets
    const pad = 48
    const minY = top + pad * 2 // the anchor is the footprint's bottom: leave room for the sprite above it
    const maxY = this.scale.height - bottom - pad / 2
    const dx = s.x < pad ? pad - s.x : s.x > this.scale.width - pad ? this.scale.width - pad - s.x : 0
    const dy = s.y < minY ? minY - s.y : s.y > maxY ? maxY - s.y : 0
    if (dx || dy) this.apply(panBy(this.view, dx, dy))
  }

  private toWorld(p: { x: number; y: number }): { x: number; y: number } {
    return this.view ? screenToWorld(this.view, this.scale.width, this.scale.height, p.x, p.y) : p
  }

  private toScreen(w: Pos): Pos {
    return worldToScreen(this.view ?? { cx: 0, cy: 0, zoom: 1 }, this.scale.width, this.scale.height, w.x, w.y)
  }

  // ---- input -------------------------------------------------------------------------------------------------

  private onDown(p: Phaser.Input.Pointer): void {
    this.gestures.down(p, heldPointers(this.input))
  }

  private onMove(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[] = []): void {
    if (this.gestures.move(p, heldPointers(this.input), p.isDown)) return
    // One hover target: the one a tap here would open.
    if (!p.wasTouch) {
      const hover = this.bridge.placing ? null : this.targetAt(p, over)
      const key = hover ? JSON.stringify(hover) : ''
      if (key !== this.hoverKey) {
        this.hoverKey = key
        this.bridge.emit({ type: 'hover', target: hover })
        // From the same answer a tap would get: a sprite's own hand cursor stays an arrow between overlapping tap boxes.
        this.input.setDefaultCursor(hover ? 'pointer' : '')
      }
    }
    // The placement reducer tracks the cursor, so hover moves matter only while placing (and not for touches).
    if (!this.bridge.placing || p.wasTouch) return
    this.emitCell(p, false)
  }

  /** Emits the cell under a screen point; while placing, the pointer holds the footprint's centre. */
  private emitCell(p: { x: number; y: number }, always: boolean): boolean {
    const w = this.toWorld(p)
    const c = groundCell(this.bridge.state, w.x, w.y)
    if (!c) return false
    const off = this.bridge.placing ? Math.floor((this.bridge.placing.size - 1) / 2) : 0
    const cell = { col: c.col - off, row: c.row - off }
    const key = `${cell.col},${cell.row}`
    if (!always && key === this.lastCell) return true
    this.lastCell = key
    this.bridge.emit({ type: 'cell', col: cell.col, row: cell.row })
    return true
  }

  private onUp(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.gestures.up(p, heldPointers(this.input))) return
    // A gold badge sits above every sprite: a tap on it collects instead of opening the habitat.
    const badge = this.bridge.placing ? undefined : over.find(o => o.getData('collect'))
    if (badge) return this.collect(badge as Phaser.GameObjects.Text)
    // While placing, every click is a cell; otherwise a sprite under the pointer wins over the ground.
    const hit = this.bridge.placing ? null : this.targetAt(p, over)
    if (hit) this.bridge.emit({ type: 'select', target: hit })
    else this.emitCell(p, true)
  }

  /**
   * What a tap at `p` opens, from the sprites under it (topmost first). A sprite whose tap box was enlarged is a pixel hit
   * only when the pointer is on its own opaque pixels; `pickTarget` lets those beat the boxes.
   */
  private targetAt(p: { x: number; y: number }, over: Phaser.GameObjects.GameObject[]): Target | null {
    const w = this.toWorld(p)
    const hits: Hit<Target>[] = []
    for (const o of over) {
      const target = o.getData('target') as Target | undefined
      if (!target) continue
      const spr = o as Phaser.GameObjects.Sprite
      const entry = this.tapTargets.find(t => t.spr === spr)
      let pixel = true
      if (entry) {
        const lx = (w.x - spr.x) / spr.scaleX + spr.displayOriginX
        const ly = (w.y - spr.y) / spr.scaleY + spr.displayOriginY
        pixel = Boolean(entry.pixel(entry.area, lx, ly, spr))
      }
      hits.push({ target, pixel, centre: { x: spr.x, y: spr.y - spr.displayHeight / 2 } })
    }
    return pickTarget(hits, w)
  }

  // ---- drawing -----------------------------------------------------------------------------------------------

  /** Brings the ground, camera framing and every dynamic object up to the current state, making only what changed. */
  sync(): void {
    if (!this.alive() || this.sys.isSleeping()) return
    const { state, view } = this.bridge
    this.drawGround()
    this.frame()
    const model = buildIslandModel(state, this.art(), this.catalog, this.bridge.nowMs, view, this.bridge.placing, this.bridge.preset)
    // Fewer eggs in the hatchery on the same island than a moment ago: one hatched (or was sold). Burst once.
    const hatched = state && view === this.hatchView && model.markers.hatchery.length < this.current.hatchery.length
    this.hatchView = view
    this.current = model.markers
    if (hatched && state.hatcheryPlacement.island === view) {
      const p = state.hatcheryPlacement
      this.playOnce('fx.hatch', anchor(p.col, p.row, FOOTPRINT.hatchery))
    }
    this.drawOutline(model.markers.ghost)
    this.reconcile(model.objects)
    this.fitTapTargets()
  }

  /**
   * Makes the layer show `objects`: an object whose id and look are unchanged keeps its sprite (and its running animation),
   * anything else is made again, and what has gone is destroyed. Destroying and remaking ~100 sprites a second did nothing a
   * player could see, and each pixel-perfect `setInteractive` and badge canvas has a cost. Badges go on top of every sprite,
   * so a dragon never hides its habitat's gold.
   */
  private reconcile(objects: IslandObject[]): void {
    const motion = this.bridge.reducedMotion
    const next = new Map<string, { obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Text; sig: string }>()
    const sprites: Phaser.GameObjects.GameObject[] = []
    const badges: Phaser.GameObjects.Text[] = []
    const keep = (id: string, sig: string, make: () => Phaser.GameObjects.Sprite | Phaser.GameObjects.Text) => {
      const had = this.live.get(id)
      if (had) this.live.delete(id)
      const entry = had && had.sig === sig ? had : { obj: (had?.obj.destroy(), make()), sig }
      next.set(id, entry)
      return entry.obj
    }
    for (const o of objects) sprites.push(keep(o.id, objectSignature(o, motion), () => this.draw(o)))
    for (const o of objects) {
      if (!o.badge) continue
      badges.push(keep(`badge:${o.id}`, JSON.stringify([o.badge, o.x, badgeY(o), o.target]), () => this.drawBadge(o, o.badge!)) as Phaser.GameObjects.Text)
    }
    for (const { obj } of this.live.values()) obj.destroy()
    this.live = next
    this.drawn = [...sprites, ...badges]
    this.badges = badges
    this.tapTargets = this.tapTargets.filter(t => t.spr.active)
    // The order is the model's, whatever was made when. Same members, so the list can simply be replaced.
    if (this.drawn.some((o, i) => this.layer.list[i] !== o)) this.layer.list = [...this.drawn]
  }

  /**
   * Collect from a tapped gold badge: ask React to run `collectGold`, then the coin burst in place of the badge, or
   * without `fx.coins` art the badge itself goes up and away. Nothing moves with reduced motion.
   */
  private collect(badge: Phaser.GameObjects.Text): void {
    this.bridge.emit({ type: 'collectGold', habitatId: badge.getData('collect') as string })
    badge.disableInteractive()
    // Spent: it hides and floats away below. If the collect comes to nothing, the next sync draws a fresh one.
    for (const entry of this.live.values()) if (entry.obj === badge) entry.sig = ''
    if (this.bridge.reducedMotion) return
    if (isSheet(this.art().fx.coins)) {
      badge.setVisible(false)
      this.playOnce('fx.coins', { x: badge.x, y: badge.y })
      return
    }
    this.tweens.add({ targets: badge, y: badge.y - 12 / (this.view?.zoom ?? 1), alpha: 0, duration: 450, ease: 'Quad.easeOut' })
  }

  /** The level-up burst in the middle of what the player sees, if the art has it. The view, as the camera's midpoint is a frame old on waking. */
  private playLevelUp(): void {
    if (!this.art().fx.levelUp || !this.view) return
    this.playOnce('fx.levelUp', { x: this.view.cx, y: this.view.cy })
  }

  /** Plays a one-shot effect at a world point: its sheet once, or a fade for a still; nothing with reduced motion. */
  private playOnce(path: 'fx.hatch' | 'fx.coins' | 'fx.levelUp', at: Pos): void {
    if (this.bridge.reducedMotion) return
    const key = textureKey(path)
    const sprite = (path === 'fx.hatch' ? this.art().fx.hatch : path === 'fx.coins' ? this.art().fx.coins : this.art().fx.levelUp)!
    const spr = this.add.sprite(at.x, at.y, key).setOrigin(0.5, 1).setDepth(1)
    if (!playOneShot(spr, key, sprite)) this.tweens.add({ targets: spr, alpha: 0, y: at.y - 8, duration: 700, onComplete: () => spr.destroy() })
  }

  /**
   * The landmass: grass diamonds for owned plots, fog for the rest and a cliff skirt under the two front edges, over
   * the sea. Uses the `ground.*` tiles when the manifest has them and drawn diamonds otherwise. All of it is baked into
   * one render texture and only drawn again when the view or its owned plots change (buying a plot, a Bridge, a switch of
   * island) or after the WebGL context comes back. The sea stays a separate animated tile sprite behind it.
   */
  private drawGround(): void {
    const { state, view } = this.bridge
    const key = `${view}:${state ? ownedPlots(state, view).join(',') : '-'}`
    if (key === this.groundKey) return
    this.groundKey = key
    const g = this.ground.clear()
    const rt = this.groundRt?.clear() ?? null
    // The old water's looping timer goes with it, or one more would tick per ground-key change.
    this.waterTimer?.remove()
    this.waterTimer = null
    this.water?.destroy()
    this.water = null
    if (!state) return
    const tiles = this.art().ground
    const land = groundBox()
    // Tiles are drawn at their world position less the texture's own corner.
    const shown = shownSize()
    if (tiles.water) {
      const b = cameraBounds()
      const pad = 2048 // the sea also fills the screen beyond the camera bounds when zoomed out
      this.water = this.add.tileSprite(b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad, textureKey('ground.water'), 0).setOrigin(0, 0).setDepth(-1).setAlpha(0.4) // softened: the sea is backdrop, not the subject
      const w = tiles.water
      this.waterTimer = animateWater(this, this.water, textureKey('ground.water'), w.frames, w.fps, this.bridge.reducedMotion)
    }
    if (!rt) return
    const at = (k: string, x: number, y: number) => rt.batchDrawFrame(textureKey(k), undefined, x - land.x, y - land.y)
    const left = cellTop(0, shown.h)
    const bottom = cellTop(shown.w, shown.h)
    const right = cellTop(shown.w, 0)
    const down = (p: Pos, d: number): Pos => ({ x: p.x, y: p.y + d })
    // The drawn skirt always goes first: it backs the cliff tiles, whose stepped bottoms would otherwise show sea between them.
    {
      g.fillStyle(GROUND.cliffLeft, 1).fillPoints(points([left, bottom, down(bottom, SKIRT), down(left, SKIRT)]), true)
      g.fillStyle(GROUND.cliffRight, 1).fillPoints(points([bottom, right, down(right, SKIRT), down(bottom, SKIRT)]), true)
      g.lineStyle(1, GROUND.strata, 0.6)
      g.lineBetween(left.x, left.y + SKIRT / 2 + 1, bottom.x, bottom.y + SKIRT / 2 + 1)
      g.lineBetween(bottom.x, bottom.y + SKIRT / 2 + 1, right.x, right.y + SKIRT / 2 + 1)
      g.fillStyle(GROUND.lip, 1)
      g.fillPoints(points([left, bottom, down(bottom, 2), down(left, 2)]), true)
      g.fillPoints(points([bottom, right, down(right, 2), down(bottom, 2)]), true)
    }
    // Placeholder diamonds, for any tile the manifest has no art for.
    const diamond = (palette: readonly number[], col: number, row: number) => g.fillStyle(palette[(col + row) % 2]!, 1).fillPoints(points(footprintDiamond(col, row, 1)), true)
    rt.beginDraw()
    // The skirt first (it is the backing), then everything else over it in the order the sprites used to go.
    rt.batchDraw(g, -land.x, -land.y)
    g.clear()
    // This island's own tiles when the manifest has them, else today's (groundTiles); read here, in the bake, so a stale tile can't be picked.
    const pick = groundTiles(this.art(), view)
    if (pick.cliffSw && pick.cliffSe) {
      // A 16x16 piece per front edge cell, drawn over the cell's bounding box; its face hangs below the cell's edge.
      for (let col = 0; col < shown.w; col++) { const t = cellTop(col, shown.h - 1); at(pick.cliffSw, t.x - 8, t.y) }
      for (let row = 0; row < shown.h; row++) { const t = cellTop(shown.w - 1, row); at(pick.cliffSe, t.x - 8, t.y) }
    }
    // A diamond's 16x8 tile has its top-left corner 8 px left of the cell's top vertex.
    for (const plot of ownedPlots(state, view)) {
      const o = plotOrigin(plot)
      for (let row = o.row; row < o.row + TILES_PER_PLOT; row++) for (let col = o.col; col < o.col + TILES_PER_PLOT; col++) {
        if (pick.grass.length > 0) {
          const t = cellTop(col, row)
          at(pick.grass[groundVariant(col, row, pick.grass.length)]!, t.x - 8, t.y)
        } else {
          diamond(GROUND.grass, col, row)
        }
        // The optional plot-border mark on the plot's back edges (its top-left row and column of cells).
        if (tiles.plotEdge && (row === o.row || col === o.col)) { const t = cellTop(col, row); at('ground.plotEdge', t.x - 8, t.y) }
      }
    }
    for (const c of lockedTiles(state, view)) {
      if (tiles.fog) {
        const t = cellTop(c.col, c.row)
        at('ground.fog', t.x - 8, t.y)
      } else {
        diamond(GROUND.fog, c.col, c.row)
      }
    }
    rt.batchDraw(g, -land.x, -land.y)
    g.clear()
    rt.endDraw()
  }

  /** The placement ghost's footprint: a translucent, outlined diamond tinted by legality, over everything. */
  private drawOutline(ghost: IslandMarkers['ghost']): void {
    const g = this.outline.clear()
    if (!ghost) return
    const color = ghost.legal ? TINT.ok : TINT.bad
    const pts = points(footprintDiamond(ghost.col, ghost.row, ghost.size))
    g.fillStyle(color, 0.25).fillPoints(pts, true)
    g.lineStyle(1, color, 1).strokePoints(pts, true, true)
  }

  markers(): IslandMarkers {
    return this.current
  }

  private draw(o: IslandObject): Phaser.GameObjects.Sprite {
    const spr = this.add.sprite(o.x, o.y, o.key).setOrigin(0.5, 1)
    playOrStill(spr, o.key, o.sprite.frames, o.sprite.fps, this.bridge.reducedMotion)
    if (o.frame) spr.setFrame(o.frame)
    if (o.scale) spr.setScale(o.scale)
    if (o.flipX) spr.setFlipX(true)
    if (o.tint) spr.setTint(TINT[o.tint])
    if (o.id === 'ghost') {
      spr.setAlpha(0.8)
    } else {
      spr.setData('target', o.target)
      // Pixel-perfect hits: a click on the transparent sky above a platform reaches the ground or what is behind it.
      spr.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 1 })
      if (o.minTap) this.tapTargets.push({ spr, minTap: o.minTap, always: !!o.boxAlways, pixel: spr.input!.hitAreaCallback, area: spr.input!.hitArea })
    }
    this.layer.add(spr)
    return spr
  }

  /** Badges keep one on-screen size (BADGE_PX tall) at every zoom instead of growing with the art. */
  private badgeScale(): number {
    return BADGE_PX / 8 / (this.view?.zoom ?? 1)
  }

  private drawBadge(o: IslandObject, badge: string): Phaser.GameObjects.Text {
    const tappable = (badge === 'gold' || badge === 'full') && o.target.kind === 'habitat'
    const label = badge === 'gold' ? 'GOLD' : badge === 'full' ? 'FULL' : badge
    const t = this.add.text(o.x, badgeY(o), label, TEXT_STYLE).setOrigin(0.5, 1).setResolution(4).setScale(this.badgeScale())
    if (tappable) {
      // The text is scaled to BADGE_PX on screen at every zoom, so a hit box of HIT_LOCAL local pixels is
      // HIT_LOCAL * BADGE_PX / 8 = at least 44 CSS px. It grows upward and sideways from the text's bottom edge.
      const w = Math.max(t.width, BADGE_HIT_LOCAL)
      const h = Math.max(t.height, BADGE_HIT_LOCAL)
      t.setData('collect', (o.target as { id: string }).id)
      t.setInteractive({ hitArea: new Phaser.Geom.Rectangle((t.width - w) / 2, t.height - h, w, h), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true })
    }
    this.layer.add(t)
    return t
  }
}

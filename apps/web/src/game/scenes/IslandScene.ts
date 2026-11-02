import { FOOTPRINT, ISLAND_TILES, LAUNCH_CATALOG, ownedPlots, plotOrigin, TILES_PER_PLOT, type Catalog, type PlayerState } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { isSheet, playOneShot, playOrStill, textureKey } from '../../art/phaserLoader'
import { FALLBACK_ART } from '../../art/slots'
import type { GameArtSet, Sprite } from '../../art/types'
import type { Bridge, Placing, Target } from '../bridge'
import {
  cameraBounds, clampView, groundCell, landPlots, lockedTiles, openingView, panBy, revealPan, screenToWorld, shownSize, SKIRT, worldToScreen, zoomRange, type View,
} from '../camera'
import { paintLandmass, type BakeArt, type BakeImage } from '../islandBake'
import { ARROW_GAP, ARROW_SCALE, badgeY, buildIslandModel, groundTiles, groundVariant, objectSignature, type IslandMarkers, type IslandObject } from '../islandModel'
import { driftCloud, landmass, nearestPlot } from '../islandShape'
import { anchor, cellCentre, cellTop, footprintContains, footprintDiamond, islandBox, pointerToCell, progressFill, PROGRESS_BAR, tapHit, type Box, type Pos } from '../layout'
import { createPanZoom, heldPointers } from '../panZoom'
import { pickTarget, type Hit } from '../pickTarget'

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#f2f1ea', stroke: '#0f1324', strokeThickness: 2,
}
const TINT = { ok: 0x9dffa8, bad: 0xff7a7a, building: 0xa8a8c0 } as const
/** An egg's progress bar: a dark frame and a green fill. */
const BAR = { frame: 0x141627, fill: 0x62d44a } as const
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
/** Home's baked landmass, in Phaser's texture manager. */
const BAKE_KEY = 'island:home-bake'
/** The sky's plain colour, when its art is absent. */
const SKY_FALLBACK = '#8fd0ee'
/** A waterfall starts this far above the lip, so its foam covers the strip of grass between the river and the edge. */
const FALL_LIP = 6
/** How far the placement arrow bobs, in world px, and how long one way takes. */
const ARROW_BOB = { y: 2, ms: 450 } as const
/** Where the clouds start, as shares of the camera bounds. */
const CLOUD_AT = [{ x: 0.08, y: 0.16 }, { x: 0.62, y: 0.06 }, { x: 0.88, y: 0.62 }] as const
/** World box of the baked landmass on islands other than Home: the island's diamond and the cliff skirt under it. */
const groundBox = (): Box => {
  const b = islandBox(ISLAND_TILES, ISLAND_TILES)
  return { x: b.x, y: b.y, w: b.w, h: b.h + SKIRT }
}

/** What stands for one object id on the layer. */
type LiveObject = Phaser.GameObjects.Sprite | Phaser.GameObjects.Text | Phaser.GameObjects.Graphics

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
  /** Home's landmass, shown from the canvas texture `BAKE_KEY`. */
  private bakeImage: Phaser.GameObjects.Image | null = null
  private falls: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics)[] = []
  private sky: Phaser.GameObjects.Image | null = null
  private clouds: Phaser.GameObjects.Image[] = []
  private hatchView: string | null = null
  private outline!: Phaser.GameObjects.Graphics
  private layer!: Phaser.GameObjects.Container
  /** What is on the layer, in draw order. Kept across syncs: only what changed is made again (see `reconcile`). */
  private drawn: Phaser.GameObjects.GameObject[] = []
  private badges: Phaser.GameObjects.Text[] = []
  /** The sprite or badge text standing for each object id (`badge:` + id for a badge) and the look it was made with. */
  private live = new Map<string, { obj: LiveObject; sig: string }>()
  /** Sprites that must be at least `minTap` CSS px to tap: their hit box follows the zoom (see `fitTapTargets`). */
  private tapTargets: { spr: Phaser.GameObjects.Sprite; minTap: number; always: boolean; pixel: Phaser.Types.Input.HitAreaCallback; area: unknown }[] = []
  private current: IslandMarkers = EMPTY
  private catalog: Catalog = LAUNCH_CATALOG
  private readonly gestures = createPanZoom({
    view: () => this.view,
    apply: v => { this.fitting = false; this.apply(v) },
    range: () => this.range(),
    size: () => ({ w: this.scale.width, h: this.scale.height }),
    grab: p => this.grabGhost(p),
    onGrabMove: p => this.carryGhost(p),
  })
  private levelUpOnWake = false
  /** The cell of the ghost's footprint under the press that holds it, counted from its top-left. */
  private held = { col: 0, row: 0 }
  /** What is being placed, as last seen: a change means placing started. */
  private placed: Placing['what'] | null = null
  private hoverKey = ''
  private groundKey = ''
  private view: View | null = null
  private framed = ''
  /** The camera is still on the opening view just framed, so a new measure of the HUD refits it. A gesture or placing ends that. */
  private fitting = false

  constructor(private readonly bridge: Bridge) {
    super('island')
  }

  create(): void {
    this.cameras.main.setBackgroundColor(SKY_FALLBACK)
    this.makeSky()
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
      this.bridge.on('view', () => { this.sync(); this.revealGhost() }),
      // The HUD measures after it mounts: an opening view fits itself to that. Otherwise (the bar is another height from the
      // menu it replaces) the camera stays where it is, re-clamped, with the ghost kept in sight.
      this.bridge.on('insets', () => {
        if (this.fitting) this.framed = ''
        this.sync()
        this.revealGhost()
      }),
      this.bridge.on('placing', e => {
        this.fitting = false
        this.sync()
        const started = e.placing !== null && e.placing.what !== this.placed
        this.placed = e.placing?.what ?? null
        // Only at the start: following every cell would scroll the view out from under a tap.
        if (started) this.revealGhost()
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
    const onRestore = () => { if (this.alive()) this.rebake() }
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
    // Let go over the HUD or off the page: the press is over, and nothing is left holding the ghost.
    this.input.on('pointerupoutside', () => this.gestures.reset())
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.gestures.wheel(p, dy))
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.sync() })
    this.sync()
    this.bridge.emit({ type: 'ready' })
  }

  private art(): GameArtSet {
    return this.bridge.art ?? FALLBACK_ART
  }

  /** The sky and the clouds behind every island; each only if its art loaded. */
  private makeSky(): void {
    const { sky, clouds } = this.art().ground
    if (sky && this.textures.exists(textureKey('ground.sky'))) this.sky = this.add.image(0, 0, textureKey('ground.sky')).setDepth(-3)
    const b = cameraBounds('home')
    this.clouds = clouds.flatMap((_, i) => {
      const key = textureKey(`ground.cloud.${i}`)
      if (!this.textures.exists(key)) return []
      return [this.add.image(b.x + b.w * CLOUD_AT[i % CLOUD_AT.length]!.x, b.y + b.h * CLOUD_AT[i % CLOUD_AT.length]!.y, key).setDepth(-2)]
    })
  }

  /** Clouds drift in world space and wrap at the bounds; they stay still under reduced motion. A sleeping scene isn't updated. */
  update(_time: number, deltaMs: number): void {
    if (this.bridge.reducedMotion) return
    const b = cameraBounds(this.bridge.view)
    for (const c of this.clouds) c.x = driftCloud(c.x, deltaMs, b.x, b.x + b.w, c.displayWidth / 2)
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
    const b = cameraBounds(this.bridge.view)
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
    // The sky stays put on screen: at the view's centre, a whole number of screen pixels per art pixel, so it never scrolls or pixelates unevenly.
    if (this.sky) {
      const cover = Math.ceil(Math.max(this.scale.width / this.sky.width, this.scale.height / this.sky.height))
      this.sky.setPosition(this.view.cx, this.view.cy).setScale(cover / this.view.zoom)
    }
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
    this.fitting = true
    this.apply(this.opening())
  }

  /** Pans just enough to bring the footprint standing on world point `p`, up to world height `topY`, into the band the HUD leaves free. */
  private reveal(p: Pos, topY: number): void {
    if (!this.view) return
    const s = this.toScreen(p)
    const { dx, dy } = revealPan({ x: s.x, top: this.toScreen({ x: p.x, y: topY }).y, bottom: s.y }, { w: this.scale.width, h: this.scale.height }, this.bridge.insets)
    if (dx || dy) this.apply(panBy(this.view, dx, dy))
  }

  /** Brings the placement ghost and its arrow into sight, if there is one and the scene is showing. */
  private revealGhost(): void {
    const p = this.bridge.placing
    if (!p || !this.alive() || this.sys.isSleeping()) return
    const arrow = this.art().island.arrow.h * ARROW_SCALE
    this.reveal(anchor(p.col, p.row, p.size), cellTop(p.col, p.row).y - ARROW_GAP - arrow - ARROW_BOB.y)
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
  }

  /** Emits the cell under a screen point (a tap); while placing, the tap holds the footprint's centre. Off the land, nothing. */
  private emitCell(p: { x: number; y: number }): void {
    const w = this.toWorld(p)
    const c = groundCell(this.bridge.state, this.bridge.view, w.x, w.y)
    if (!c) return
    const off = this.bridge.placing ? Math.floor((this.bridge.placing.size - 1) / 2) : 0
    this.bridge.emit({ type: 'cell', col: c.col - off, row: c.row - off })
  }

  /** While placing, a press on the ghost's footprint takes hold of it, by the cell pressed. */
  private grabGhost(p: { x: number; y: number }): boolean {
    const placing = this.bridge.placing
    if (!placing) return false
    const w = this.toWorld(p)
    const c = pointerToCell(w.x, w.y)
    if (!footprintContains(c, placing)) return false
    this.held = { col: c.col - placing.col, row: c.row - placing.row }
    return true
  }

  /** Carries the held ghost, its held cell under the pointer. Off the land it waits at the last good cell. */
  private carryGhost(p: { x: number; y: number }): void {
    const placing = this.bridge.placing
    if (!placing) return
    const w = this.toWorld(p)
    const c = groundCell(this.bridge.state, this.bridge.view, w.x, w.y)
    if (!c) return
    const col = c.col - this.held.col
    const row = c.row - this.held.row
    if (col !== placing.col || row !== placing.row) this.bridge.emit({ type: 'cell', col, row })
  }

  private onUp(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.gestures.up(p, heldPointers(this.input))) return
    // A gold badge sits above every sprite: a tap on it collects instead of opening the habitat.
    const badge = this.bridge.placing ? undefined : over.find(o => o.getData('collect'))
    if (badge) return this.collect(badge as Phaser.GameObjects.Text)
    // While placing, every click is a cell; otherwise a sprite under the pointer wins over the ground.
    const hit = this.bridge.placing ? null : this.targetAt(p, over)
    if (hit) this.bridge.emit({ type: 'select', target: hit })
    else this.emitCell(p)
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
    const next = new Map<string, { obj: LiveObject; sig: string }>()
    const sprites: Phaser.GameObjects.GameObject[] = []
    const badges: Phaser.GameObjects.Text[] = []
    const keep = (id: string, sig: string, make: () => LiveObject) => {
      const had = this.live.get(id)
      if (had) this.live.delete(id)
      const entry = had && had.sig === sig ? had : { obj: (had?.obj.destroy(), make()), sig }
      next.set(id, entry)
      return entry.obj
    }
    for (const o of objects) sprites.push(keep(o.id, objectSignature(o, motion), () => this.draw(o)))
    // Bars go over every sprite and under the badges. Made again only when the fill changes.
    const bars: Phaser.GameObjects.GameObject[] = []
    for (const o of objects) {
      if (o.progress === undefined) continue
      const fill = progressFill(o.progress)
      bars.push(keep(`bar:${o.id}`, JSON.stringify([o.x, o.y, fill]), () => this.drawBar(o, fill)))
    }
    for (const o of objects) {
      if (!o.badge) continue
      badges.push(keep(`badge:${o.id}`, JSON.stringify([o.badge, o.x, badgeY(o), o.target]), () => this.drawBadge(o, o.badge!)) as Phaser.GameObjects.Text)
    }
    // Captions (a sign's 'Tap to buy') sit with the badges, on top, and scale like them.
    for (const o of objects) {
      if (!o.caption) continue
      badges.push(keep(`caption:${o.id}`, JSON.stringify([o.caption, o.x, o.y]), () => this.drawCaption(o, o.caption!)) as Phaser.GameObjects.Text)
    }
    for (const { obj } of this.live.values()) obj.destroy()
    this.live = next
    this.drawn = [...sprites, ...bars, ...badges]
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
   * The landmass, drawn again only when the view or its plots change (buying a plot, a Bridge, a switch of island) or after
   * the WebGL context comes back. Home is the floating island (`bakeHome`); every other island keeps grass diamonds for
   * owned plots, fog for the rest and a cliff skirt, from the `ground.*` tiles when the manifest has them and drawn
   * diamonds otherwise, baked into one render texture.
   */
  private drawGround(): void {
    const { state, view } = this.bridge
    // Owned plots and, on Home, the offered ones (they change with each purchase) decide what is drawn.
    const key = `${view}:${state ? ownedPlots(state, view).join(',') : '-'}:${state ? landPlots(state, view).join(',') : '-'}`
    if (key === this.groundKey) return
    this.groundKey = key
    const rt = this.groundRt?.clear().setVisible(view !== 'home') ?? null
    this.clearHomeBake()
    if (!state) return
    if (view === 'home') return this.bakeHome(state)
    this.ground.clear()
    if (rt) this.bakeTiles(rt, state)
  }

  /** The bake to throw away when the land changes: the image, its texture and the waterfalls standing on it. */
  private clearHomeBake(): void {
    this.bakeImage?.destroy()
    this.bakeImage = null
    if (this.textures.exists(BAKE_KEY)) this.textures.remove(BAKE_KEY)
    for (const f of this.falls) f.destroy()
    this.falls = []
  }

  /** Throws the ground away and makes it again: after a lost WebGL context, whose textures come back empty. */
  rebake(): void {
    this.groundKey = ''
    this.sync()
  }

  /**
   * Home's floating island: one canvas the size of its landmass, shown as an image, with a waterfall sprite per fall.
   * A headless game (tests) has no renderer to hold the texture: it paints nothing, the waterfalls still stand.
   */
  private bakeHome(state: PlayerState): void {
    const land = landmass(landPlots(state, 'home'))
    const owned = ownedPlots(state, 'home')
    const shown = landPlots(state, 'home')
    if (this.game.config.renderType !== Phaser.HEADLESS) {
      const tex = this.textures.createCanvas(BAKE_KEY, land.box.w, land.box.h)
      if (tex) {
        paintLandmass(tex.context, land, this.bakeArt(), (col, row) => !owned.includes(nearestPlot(shown, col, row)))
        tex.refresh()
        this.bakeImage = this.add.image(land.box.x, land.box.y, BAKE_KEY).setOrigin(0, 0).setDepth(-1)
      }
    }
    const fall = this.art().ground.waterfall
    const key = textureKey('ground.waterfall')
    this.falls = land.falls.map(p => {
      if (fall && this.textures.exists(key)) {
        const spr = this.add.sprite(p.x, p.y - FALL_LIP, key).setOrigin(0.5, 0).setDepth(-0.5).setName('waterfall')
        playOrStill(spr, key, fall.frames, fall.fps, this.bridge.reducedMotion)
        return spr
      }
      const g = this.add.graphics().setDepth(-0.5).setName('waterfall')
      g.fillStyle(0xbfe6fa, 1).fillRect(p.x - 12, p.y - FALL_LIP, 24, 72)
      g.fillStyle(0x3fa6e0, 1).fillRect(p.x - 8, p.y - FALL_LIP + 3, 4, 66).fillRect(p.x + 2, p.y - FALL_LIP + 3, 5, 66)
      return g
    })
  }

  /** The bitmaps the painter samples, the ones whose textures really exist: a PNG that failed leaves none, and it paints its own look. */
  private bakeArt(): BakeArt {
    const ground = this.art().ground
    const img = (path: string, s: Sprite | null | undefined): BakeImage | null => {
      const key = textureKey(path)
      if (!s || !this.textures.exists(key)) return null
      return { source: this.textures.get(key).getSourceImage() as CanvasImageSource, w: s.w, h: s.h }
    }
    return {
      grass: ground.grass.map((s, i) => img(`ground.grass.${i}`, s)).filter((b): b is BakeImage => b !== null),
      variant: groundVariant,
      rock: img('ground.rock', ground.rock),
      rim: ground.rim.map((s, i) => img(`ground.rim.${i}`, s)).filter((b): b is BakeImage => b !== null),
      water: img('ground.water', ground.water),
    }
  }

  /** Every other island: tiles baked into the render texture. */
  private bakeTiles(rt: Phaser.GameObjects.RenderTexture, state: PlayerState): void {
    const { view } = this.bridge
    const g = this.ground
    const tiles = this.art().ground
    const land = groundBox()
    // Tiles are drawn at their world position less the texture's own corner.
    const shown = shownSize()
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

  /** The placement ghost's footprint: a translucent, outlined diamond coloured by legality, over everything. */
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
    if (o.id === 'arrow') {
      if (!this.bridge.reducedMotion) {
        const bob = this.tweens.add({ targets: spr, y: o.y - ARROW_BOB.y, duration: ARROW_BOB.ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        spr.once(Phaser.GameObjects.Events.DESTROY, () => bob.remove())
      }
    } else if (o.id !== 'ghost') {
      spr.setData('target', o.target)
      // Pixel-perfect hits: a click on the transparent sky above a platform reaches the ground or what is behind it.
      spr.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 1 })
      if (o.minTap) this.tapTargets.push({ spr, minTap: o.minTap, always: !!o.boxAlways, pixel: spr.input!.hitAreaCallback, area: spr.input!.hitArea })
    }
    this.layer.add(spr)
    return spr
  }

  /** The bar under a sprite: a dark frame centred on its anchor, just below it, and `fill` px of green. */
  private drawBar(o: IslandObject, fill: number): Phaser.GameObjects.Graphics {
    const x = o.x - PROGRESS_BAR.w / 2
    const y = o.y + 1
    const g = this.add.graphics()
    g.fillStyle(BAR.frame, 1).fillRect(x, y, PROGRESS_BAR.w, PROGRESS_BAR.h)
    g.fillStyle(BAR.fill, 1).fillRect(x + 1, y + 1, fill, PROGRESS_BAR.h - 2)
    this.layer.add(g)
    return g
  }

  /** Badges keep one on-screen size (BADGE_PX tall) at every zoom instead of growing with the art. */
  private badgeScale(): number {
    return BADGE_PX / 8 / (this.view?.zoom ?? 1)
  }

  /** A label under a sprite's anchor: dark text on white, the badge's size on screen at every zoom. */
  private drawCaption(o: IslandObject, caption: string): Phaser.GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = { ...TEXT_STYLE, color: '#0f1324', stroke: undefined, strokeThickness: 0, backgroundColor: '#ffffff', padding: { x: 3, y: 1 } }
    const t = this.add.text(o.x, o.y + 2, caption, style).setOrigin(0.5, 0).setResolution(4).setScale(this.badgeScale())
    this.layer.add(t)
    return t
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

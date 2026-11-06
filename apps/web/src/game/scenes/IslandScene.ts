import { FOOTPRINT, ISLAND_ORDER, LAUNCH_CATALOG, ownedPlots, type Catalog, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { isSheet, playOneShot, playOrStill, textureKey } from '../../art/phaserLoader'
import { FALLBACK_ART } from '../../art/slots'
import type { GameArtSet, Sprite } from '../../art/types'
import type { Bridge, Placing, Target } from '../bridge'
import { archipelagoOpening, opensZoomedOut, fromIsland, isOpenIsland, ISLAND_AT, LOCKED_FOOT_Y, islandUnder, landCentre, lockedIslandObject, nearestIsland, toIsland, worldBounds } from '../archipelago'
import {
  clampView, groundCell, landPlots, offeredPlotAt, openingView, panBy, revealPan, screenToWorld, worldToScreen, zoomAt, zoomRange, type View,
} from '../camera'
import { paintLandmass, type BakeArt, type BakeImage } from '../islandBake'
import { selectionOutline, type Outline } from '../overlayModel'
import { ARROW_GAP, ARROW_SCALE, badgeY, buildIslandModel, groundTiles, groundVariant, objectSignature, type IslandMarkers, type IslandObject } from '../islandModel'
import { driftCloud, landmass, nearestPlot } from '../islandShape'
import { anchor, captionPx, cellCentre, cellTop, footprintContains, footprintDiamond, pointerToCell, progressFill, PROGRESS_BAR, tapHit, type Box, type Pos } from '../layout'
import { createPanZoom, heldPointers } from '../panZoom'
import { pickTarget, type Hit } from '../pickTarget'

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#f2f1ea', stroke: '#0f1324', strokeThickness: 2,
}
/** A collect bubble: dark text on a white box. */
const BUBBLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#a8740a', backgroundColor: '#fbfaf6', padding: { x: 3, y: 2 },
}
/** The home finder's outline and arrows. */
const HOME_GLOW = 0x9dffa8
/** The selection outline's yellow. */
const SELECTED = 0xffd23f
const TINT = { ok: 0x9dffa8, bad: 0xff7a7a, building: 0xa8a8c0, locked: 0x6f7480 } as const
/** An egg's progress bar: a dark frame and a green fill. */
const BAR = { frame: 0x141627, fill: 0x62d44a } as const
const EMPTY: IslandMarkers = {
  habitats: [], dragons: [], waiting: [], breeders: [], hatchery: [], farms: [],
  obstacles: [], decorations: [], ghost: null, signs: [],
}
/** On-screen height of badge text in CSS pixels (the font is 8 px in world space). */
const BADGE_PX = 14
/** Local (unscaled) size of a tappable badge's hit box: 28 local px x BADGE_PX / 8 = 49 CSS px, over the 44 px minimum. */
const BADGE_HIT_LOCAL = 28
/** An island's baked landmass, in Phaser's texture manager. */
const bakeKey = (id: IslandId): string => `island:${id}-bake`
/** The sky's plain colour, when its art is absent. */
const SKY_FALLBACK = '#8fd0ee'
/** A waterfall starts this far above the lip, so its foam covers the strip of grass between the river and the edge. */
const FALL_LIP = 6
/** How far the placement arrow bobs, in world px, and how long one way takes. */
const ARROW_BOB = { y: 2, ms: 450 } as const
/** Where the clouds start, as shares of the camera bounds. */
const CLOUD_AT = [{ x: 0.08, y: 0.16 }, { x: 0.62, y: 0.06 }, { x: 0.88, y: 0.62 }] as const

/** What stands for one object id on the layer. */
type LiveObject = Phaser.GameObjects.Sprite | Phaser.GameObjects.Text | Phaser.GameObjects.Graphics

/**
 * One island in the scene (R99): a container at its world offset (`ISLAND_AT`) holding, bottom to top, its ground (the bake
 * and waterfalls), the placement footprint's fill, the selection and home-finder outlines, its objects, and the footprint's
 * outline. Everything inside is in the island's own coordinates, as `buildIslandModel` gives them.
 */
interface Isle {
  id: IslandId
  root: Phaser.GameObjects.Container
  ground: Phaser.GameObjects.Container
  footFill: Phaser.GameObjects.Graphics
  selectionLine: Phaser.GameObjects.Graphics
  homesLine: Phaser.GameObjects.Graphics
  layer: Phaser.GameObjects.Container
  outline: Phaser.GameObjects.Graphics
  arrows: Phaser.GameObjects.Graphics | null
  bakeImage: Phaser.GameObjects.Image | null
  falls: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics)[]
  groundKey: string
  /** The sprite or badge text standing for each object id (`badge:` + id for a badge) and the look it was made with. */
  live: Map<string, { obj: LiveObject; sig: string }>
  badges: Phaser.GameObjects.Text[]
  current: IslandMarkers
}

const points = (pts: Pos[]) => pts.map(p => new Phaser.Math.Vector2(p.x, p.y))

/**
 * Draws every island of the player's base together (R99) in an isometric (2:1) projection from `buildIslandModel` (pure,
 * tested), one container per island at its world offset, on every state, view or placing change and once a second for
 * timers; a sprite whose look is unchanged is kept. The camera is a pure `View` (camera.ts) moved by `panZoom` over the
 * whole archipelago. `bridge.view` is the island taps and placement use (R100): a tap makes its island the view, a pan makes
 * the nearest island the view, and a view set from outside pans the camera there. The scene owns no game logic: it emits
 * `select`, `hover` and `cell` events only. While a battle shows it sleeps, and catches up when it wakes.
 */
export class IslandScene extends Phaser.Scene {
  private isles = new Map<IslandId, Isle>()
  private sky: Phaser.GameObjects.Image | null = null
  private clouds: Phaser.GameObjects.Image[] = []
  private homesKey = ''
  private shownHomes: string[] = []
  /** The outline drawn now, for specs and tests; null when none is. */
  private shownSelection: Outline | null = null
  /** A view this scene set itself (a tap, a pan): the camera is already there, so it does not move. */
  private selfView: IslandId | null = null
  /** Sprites that must be at least `minTap` CSS px to tap: their hit box follows the zoom (see `fitTapTargets`). */
  private tapTargets: { spr: Phaser.GameObjects.Sprite; minTap: number; always: boolean; pixel: Phaser.Types.Input.HitAreaCallback; area: unknown }[] = []
  private catalog: Catalog = LAUNCH_CATALOG
  private readonly gestures = createPanZoom({
    view: () => this.view,
    apply: v => { this.fitting = false; this.apply(v); this.followCamera() },
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
    for (const id of ISLAND_ORDER) this.isles.set(id, this.makeIsle(id))
    // Bridge subscriptions must die with the scene: React StrictMode (and hot reload) destroys and
    // recreates the game, and a destroyed scene drawing on a state event crashes Phaser.
    const offs = [
      this.bridge.on('state', () => this.sync()),
      // A view this scene chose is already in sight; one set from outside (Move to, Go) brings its island into view (R100).
      this.bridge.on('view', e => {
        const own = e.view === this.selfView
        this.selfView = null
        if (!own) this.panToIsland(e.view)
        this.sync()
        this.revealGhost()
      }),
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
      this.bridge.on('selection', () => { if (this.alive()) this.drawSelection() }),
      this.bridge.on('homeFinder', () => { if (this.alive()) this.drawSelection() }),
    ]
    // Cells, the focus and signs are the view island's own (R100).
    const cellToScreen = (col: number, row: number) => this.toScreen(fromIsland(this.bridge.view, cellCentre(col, row)))
    const focusCell = () => {
      const { top, bottom } = this.bridge.insets
      const w = toIsland(this.bridge.view, this.toWorld({ x: this.scale.width / 2, y: (top + this.scale.height - bottom) / 2 }))
      return pointerToCell(w.x, w.y)
    }
    this.bridge.cellToScreen = cellToScreen
    this.bridge.focusCell = focusCell
    const signCell = (plot: number) => this.isle(this.bridge.view).current.signs.find(s => s.plot === plot) ?? null
    // A locked island's caption hangs 2 world px under its picture's foot, `captionPx` tall on screen.
    const islandToScreen = (id: IslandId) => {
      if (isOpenIsland(this.bridge.state, id)) return this.toScreen(landCentre(this.bridge.state, id))
      const foot = this.toScreen(fromIsland(id, { x: 0, y: LOCKED_FOOT_Y }))
      const zoom = this.view?.zoom ?? 1
      return { x: foot.x, y: foot.y + 2 * zoom + captionPx(zoom) / 2 + 1 }
    }
    this.bridge.islandToScreen = islandToScreen
    this.bridge.signCell = signCell
    const zoomTo = (zoom: number) => this.zoomTo(zoom)
    this.bridge.zoomTo = zoomTo
    const onResize = () => { if (this.alive() && !this.sys.isSleeping()) this.frame() }
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize)
    // Back from a battle: the camera is where it was, and the bakes catch up.
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
      if (this.bridge.signCell === signCell) this.bridge.signCell = null
      if (this.bridge.islandToScreen === islandToScreen) this.bridge.islandToScreen = null
      if (this.bridge.zoomTo === zoomTo) { this.bridge.zoomTo = null; this.bridge.zoom = null }
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

  /** One island's container and its layers, at its world offset, bottom to top. */
  private makeIsle(id: IslandId): Isle {
    const ground = this.add.container(0, 0)
    // Between the ground and the sprites, so the ghost keeps its colours.
    const footFill = this.add.graphics()
    // The selection's outline (UI rework Phase 4) also lies on the ground, under what stands on it.
    const selectionLine = this.add.graphics().setName('selection')
    const homesLine = this.add.graphics().setName('homes')
    const layer = this.add.container(0, 0)
    // Over the sprites: an illegal footprint must show even where it overlaps a building.
    const outline = this.add.graphics()
    const root = this.add.container(ISLAND_AT[id].x, ISLAND_AT[id].y, [ground, footFill, selectionLine, homesLine, layer, outline]).setName(`isle:${id}`)
    return {
      id, root, ground, footFill, selectionLine, homesLine, layer, outline, arrows: null, bakeImage: null, falls: [], groundKey: '',
      live: new Map(), badges: [], current: EMPTY,
    }
  }

  private isle(id: IslandId): Isle {
    return this.isles.get(id)!
  }

  /** The sky and the clouds behind every island; each only if its art loaded. */
  private makeSky(): void {
    const { sky, clouds } = this.art().ground
    if (sky && this.textures.exists(textureKey('ground.sky'))) this.sky = this.add.image(0, 0, textureKey('ground.sky')).setDepth(-3)
    const b = worldBounds()
    this.clouds = clouds.flatMap((_, i) => {
      const key = textureKey(`ground.cloud.${i}`)
      if (!this.textures.exists(key)) return []
      return [this.add.image(b.x + b.w * CLOUD_AT[i % CLOUD_AT.length]!.x, b.y + b.h * CLOUD_AT[i % CLOUD_AT.length]!.y, key).setDepth(-2)]
    })
  }

  /** Clouds drift in world space and wrap at the bounds; they stay still under reduced motion. A sleeping scene isn't updated. */
  update(_time: number, deltaMs: number): void {
    if (this.bridge.reducedMotion) return
    const b = worldBounds()
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

  /** Camera bounds, every island (R99), grown by the HUD insets at a zoom, so land can centre in the band the HUD leaves free. */
  private bounds(zoom: number): Box {
    const b = worldBounds()
    const { top, bottom } = this.bridge.insets
    return { x: b.x, y: b.y - top / zoom, w: b.w, h: b.h + (top + bottom) / zoom }
  }

  /**
   * The opening view, centred in the band the HUD leaves free. A big screen opens zoomed out on the view island and the next in
   * the chain, so every island shows at once (R99); a phone opens on the view island's land at the zoom that fits it (R58).
   */
  private opening(): View {
    const { top, bottom } = this.bridge.insets
    const band = this.scale.height - top - bottom
    const id = this.bridge.view
    const land = openingView(this.bridge.state, id, this.scale.width, Math.max(1, band))
    const v = opensZoomedOut(this.scale.width, band)
      ? archipelagoOpening(this.bridge.state, id)
      : { cx: land.cx + ISLAND_AT[id].x, cy: land.cy + ISLAND_AT[id].y, zoom: land.zoom }
    // The free band's middle sits (top - bottom) / 2 below the screen's: look that much higher in the world.
    return { ...v, cy: v.cy + (bottom - top) / 2 / v.zoom }
  }

  /** Centres an island's land in the free band at the zoom the camera has (R100): a view set from outside. */
  private panToIsland(id: IslandId): void {
    if (!this.view || !this.alive() || this.sys.isSleeping()) return
    const { top, bottom } = this.bridge.insets
    const c = landCentre(this.bridge.state, id)
    this.fitting = false
    this.apply({ cx: c.x, cy: c.y + (bottom - top) / 2 / this.view.zoom, zoom: this.view.zoom })
  }

  /** After a pan or zoom, the island nearest the middle of the free band becomes the view (R100); never while placing. */
  private followCamera(): void {
    if (!this.view || this.bridge.placing) return
    const { top, bottom } = this.bridge.insets
    const id = nearestIsland(this.bridge.state, this.view.cx, this.view.cy - (bottom - top) / 2 / this.view.zoom)
    if (id !== this.bridge.view) this.setOwnView(id)
  }

  /** Makes an island the view without moving the camera: the player is already looking at it. */
  private setOwnView(id: IslandId): void {
    // A locked island has nothing to work on: the view stays where it was.
    if (id === this.bridge.view || !isOpenIsland(this.bridge.state, id)) return
    this.selfView = id
    this.bridge.setView(id)
  }

  /** The zoom that fits the view island's owned land (R58): the zoom range runs three steps past it. */
  private fit(): number {
    const { top, bottom } = this.bridge.insets
    return openingView(this.bridge.state, this.bridge.view, this.scale.width, Math.max(1, this.scale.height - top - bottom)).zoom
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
    const captionScale = this.captionScale()
    for (const isle of this.isles.values()) for (const t of isle.badges) if (t.active) t.setScale(t.getData('caption') ? captionScale : scale)
    this.fitTapTargets()
    this.publishZoom()
  }

  /** Tells the HUD's zoom slider where the camera is, when that or its range changed. */
  private publishZoom(): void {
    if (!this.view) return
    const { min, max } = this.range()
    const had = this.bridge.zoom
    if (had && had.zoom === this.view.zoom && had.min === min && had.max === max) return
    this.bridge.zoom = { zoom: this.view.zoom, min, max }
    this.bridge.emit({ type: 'zoom' })
  }

  /** The slider's zoom: about the screen centre, to a whole number in range. Like a gesture, it ends the opening fit. */
  private zoomTo(zoom: number): void {
    if (!this.view || !this.alive() || this.sys.isSleeping()) return
    const { min, max } = this.range()
    const z = Math.min(max, Math.max(min, Math.round(zoom)))
    if (z === this.view.zoom) return
    const { width: w, height: h } = this.scale
    this.fitting = false
    this.apply(zoomAt(this.view, w, h, w / 2, h / 2, z))
    this.followCamera()
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
    // Not the view: every island is in the one world, and a change of view moves the camera itself (R100).
    const key = `${s ? 'state' : 'none'}:${this.scale.width}x${this.scale.height}`
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
    const at = ISLAND_AT[this.bridge.view]
    const foot = anchor(p.col, p.row, p.size)
    this.reveal({ x: foot.x + at.x, y: foot.y + at.y }, cellTop(p.col, p.row).y + at.y - ARROW_GAP - arrow - ARROW_BOB.y)
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
      const hover = this.bridge.placing ? null : (this.targetAt(p, over)?.target ?? null)
      const key = hover ? JSON.stringify(hover) : ''
      if (key !== this.hoverKey) {
        this.hoverKey = key
        this.bridge.emit({ type: 'hover', target: hover })
        // From the same answer a tap would get: a sprite's own hand cursor stays an arrow between overlapping tap boxes.
        this.input.setDefaultCursor(hover ? 'pointer' : '')
      }
    }
  }

  /**
   * Emits the cell under a screen point (a tap); while placing, the tap holds the footprint's centre and only the view
   * island's land counts. Otherwise a tap on another island's land makes it the view first (R100). Off the land, nothing.
   */
  private emitCell(p: { x: number; y: number }): void {
    const world = this.toWorld(p)
    const island = this.bridge.placing ? this.bridge.view : islandUnder(this.bridge.state, world.x, world.y)
    if (!island || !isOpenIsland(this.bridge.state, island)) return
    const w = toIsland(island, world)
    const c = groundCell(this.bridge.state, island, w.x, w.y)
    if (!c) return
    this.setOwnView(island)
    const off = this.bridge.placing ? Math.floor((this.bridge.placing.size - 1) / 2) : 0
    this.bridge.emit({ type: 'cell', col: c.col - off, row: c.row - off })
  }

  /** While placing, a press on the ghost's footprint takes hold of it, by the cell pressed. */
  private grabGhost(p: { x: number; y: number }): boolean {
    const placing = this.bridge.placing
    if (!placing) return false
    const w = toIsland(this.bridge.view, this.toWorld(p))
    const c = pointerToCell(w.x, w.y)
    if (!footprintContains(c, placing)) return false
    this.held = { col: c.col - placing.col, row: c.row - placing.row }
    return true
  }

  /** Carries the held ghost, its held cell under the pointer. Off the land it waits at the last good cell. */
  private carryGhost(p: { x: number; y: number }): void {
    const placing = this.bridge.placing
    if (!placing) return
    const w = toIsland(this.bridge.view, this.toWorld(p))
    const c = groundCell(this.bridge.state, this.bridge.view, w.x, w.y)
    if (!c) return
    const col = c.col - this.held.col
    const row = c.row - this.held.row
    if (col !== placing.col || row !== placing.row) this.bridge.emit({ type: 'cell', col, row })
  }

  private onUp(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.gestures.up(p, heldPointers(this.input))) return
    // A gold badge sits above every sprite: a tap on it collects instead of opening the habitat.
    const badge = this.bridge.placing ? undefined : over.find(o => o.getData('collect') !== undefined || o.getData('harvest') !== undefined)
    if (badge) return this.collect(badge as Phaser.GameObjects.Text)
    // While placing, every click is a cell; otherwise a sprite under the pointer wins over the ground.
    const hit = this.bridge.placing ? null : (this.targetAt(p, over) ?? this.plotUnder(p))
    if (!hit) return this.emitCell(p)
    // What was tapped is on its island: that island is now the one being worked on (R100).
    if (hit.island) this.setOwnView(hit.island)
    this.bridge.emit({ type: 'select', target: hit.target })
  }

  /** Bare ground on a plot for sale opens that plot, as its sign does. */
  private plotUnder(p: { x: number; y: number }): { target: Target; island: IslandId } | null {
    const world = this.toWorld(p)
    const island = islandUnder(this.bridge.state, world.x, world.y)
    if (!island || !isOpenIsland(this.bridge.state, island)) return null
    const w = toIsland(island, world)
    const plot = offeredPlotAt(this.bridge.state, island, w.x, w.y)
    return plot === null ? null : { target: { kind: 'plot', island, plot }, island }
  }

  /**
   * What a tap at `p` opens, from the sprites under it (topmost first). A sprite whose tap box was enlarged is a pixel hit
   * only when the pointer is on its own opaque pixels; `pickTarget` lets those beat the boxes.
   */
  private targetAt(p: { x: number; y: number }, over: Phaser.GameObjects.GameObject[]): { target: Target; island: IslandId | null } | null {
    // A label is drawn over everything, so it takes the tap whatever stands under it.
    const label = over.find(o => o.getData('caption'))
    if (label) return { target: label.getData('target') as Target, island: (label.getData('island') as IslandId | undefined) ?? null }
    const w = this.toWorld(p)
    const hits: Hit<Target>[] = []
    for (const o of over) {
      const target = o.getData('target') as Target | undefined
      if (!target) continue
      const spr = o as Phaser.GameObjects.Sprite
      // Sprites stand in their island's container: their x and y are the island's own.
      const at = ISLAND_AT[(spr.getData('island') as IslandId | undefined) ?? 'home']
      const sx = spr.x + at.x
      const sy = spr.y + at.y
      const entry = this.tapTargets.find(t => t.spr === spr)
      let pixel = true
      if (entry) {
        const lx = (w.x - sx) / spr.scaleX + spr.displayOriginX
        const ly = (w.y - sy) / spr.scaleY + spr.displayOriginY
        pixel = Boolean(entry.pixel(entry.area, lx, ly, spr))
      }
      hits.push({ target, pixel, centre: { x: sx, y: sy - spr.displayHeight / 2 } })
    }
    const target = pickTarget(hits, w)
    if (!target) return null
    const from = over.find(o => o.getData('target') === target)
    return { target, island: (from?.getData('island') as IslandId | undefined) ?? null }
  }

  // ---- drawing -----------------------------------------------------------------------------------------------

  /** Brings the ground, camera framing and every dynamic object up to the current state, making only what changed. */
  sync(): void {
    if (!this.alive() || this.sys.isSleeping()) return
    const { state, view } = this.bridge
    for (const isle of this.isles.values()) this.drawGround(isle)
    this.frame()
    for (const isle of this.isles.values()) {
      const id = isle.id
      if (!isOpenIsland(state, id)) {
        // A locked island: its greyed picture and caption (R99), nothing else.
        isle.current = EMPTY
        this.drawOutline(isle, null)
        this.reconcile(isle, state ? [lockedIslandObject(state, this.art(), id)] : [])
        continue
      }
      // Only the view island carries the placement ghost.
      const model = buildIslandModel(state, this.art(), this.catalog, this.bridge.nowMs, id, id === view ? this.bridge.placing : null, this.bridge.preset)
      // Fewer eggs in the hatchery than a moment ago: one hatched (or was sold). Burst once.
      if (state && state.hatcheryPlacement.island === id && model.markers.hatchery.length < isle.current.hatchery.length) {
        const p = state.hatcheryPlacement
        this.playOnce('fx.hatch', fromIsland(id, anchor(p.col, p.row, FOOTPRINT.hatchery)))
      }
      isle.current = model.markers
      this.drawOutline(isle, model.markers.ghost)
      this.reconcile(isle, model.objects)
    }
    this.drawSelection()
    this.fitTapTargets()
  }

  /**
   * Makes the layer show `objects`: an object whose id and look are unchanged keeps its sprite (and its running animation),
   * anything else is made again, and what has gone is destroyed. Destroying and remaking ~100 sprites a second did nothing a
   * player could see, and each pixel-perfect `setInteractive` and badge canvas has a cost. Badges go on top of every sprite,
   * so a dragon never hides its habitat's gold.
   */
  private reconcile(isle: Isle, objects: IslandObject[]): void {
    const motion = this.bridge.reducedMotion
    const next = new Map<string, { obj: LiveObject; sig: string }>()
    const sprites: Phaser.GameObjects.GameObject[] = []
    const badges: Phaser.GameObjects.Text[] = []
    const keep = (id: string, sig: string, make: () => LiveObject) => {
      const had = isle.live.get(id)
      if (had) isle.live.delete(id)
      const entry = had && had.sig === sig ? had : { obj: (had?.obj.destroy(), make()), sig }
      next.set(id, entry)
      return entry.obj
    }
    for (const o of objects) sprites.push(keep(o.id, objectSignature(o, motion), () => this.draw(isle, o)))
    // Bars go over every sprite and under the badges. Made again only when the fill changes.
    const bars: Phaser.GameObjects.GameObject[] = []
    for (const o of objects) {
      if (o.progress === undefined) continue
      const fill = progressFill(o.progress)
      bars.push(keep(`bar:${o.id}`, JSON.stringify([o.x, o.y, fill]), () => this.drawBar(isle, o, fill)))
    }
    for (const o of objects) {
      if (!o.badge) continue
      badges.push(keep(`badge:${o.id}`, JSON.stringify([o.badge, o.x, badgeY(o), o.target]), () => this.drawBadge(isle, o, o.badge!)) as Phaser.GameObjects.Text)
    }
    // Captions (a sign's 'Tap to buy') sit with the badges, on top, and scale like them.
    for (const o of objects) {
      if (!o.caption) continue
      badges.push(keep(`caption:${o.id}`, JSON.stringify([o.caption, o.x, o.y, o.target]), () => this.drawCaption(isle, o, o.caption!)) as Phaser.GameObjects.Text)
    }
    for (const { obj } of isle.live.values()) obj.destroy()
    isle.live = next
    const drawn = [...sprites, ...bars, ...badges]
    isle.badges = badges
    this.tapTargets = this.tapTargets.filter(t => t.spr.active)
    // The order is the model's, whatever was made when. Same members, so the list can simply be replaced.
    if (drawn.length !== isle.layer.list.length || drawn.some((o, i) => isle.layer.list[i] !== o)) isle.layer.list = drawn
  }

  /**
   * Collect from a tapped gold badge: ask React to run `collectGold`, then the coin burst in place of the badge, or
   * without `fx.coins` art the badge itself goes up and away. Nothing moves with reduced motion.
   */
  private collect(badge: Phaser.GameObjects.Text): void {
    const plot = badge.getData('harvest') as number | undefined
    if (plot !== undefined) this.bridge.emit({ type: 'harvest', plot })
    else this.bridge.emit({ type: 'collectGold', habitatId: badge.getData('collect') as string })
    badge.disableInteractive()
    // Spent: it hides and floats away below. If the collect comes to nothing, the next sync draws a fresh one.
    for (const isle of this.isles.values()) for (const entry of isle.live.values()) if (entry.obj === badge) entry.sig = ''
    if (this.bridge.reducedMotion) return
    if (isSheet(this.art().fx.coins)) {
      badge.setVisible(false)
      this.playOnce('fx.coins', fromIsland((badge.getData('island') as IslandId | undefined) ?? 'home', { x: badge.x, y: badge.y }))
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
   * An island's landmass, drawn again only when its plots change (buying a plot or its Bridge) or after the WebGL context
   * comes back. Every open island is a floating island (`bakeIsland`); a locked one has no land, only its picture.
   */
  private drawGround(isle: Isle): void {
    const { state } = this.bridge
    const id = isle.id
    // Owned plots and the offered ones (they change with each purchase) decide what is drawn.
    const key = state && isOpenIsland(state, id) ? `${ownedPlots(state, id).join(',')}:${landPlots(state, id).join(',')}` : '-'
    if (key === isle.groundKey) return
    isle.groundKey = key
    this.clearBake(isle)
    if (!state || key === '-') return
    this.bakeIsland(isle, state)
  }

  /** The bake to throw away when the land changes: the image, its texture and the waterfalls standing on it. */
  private clearBake(isle: Isle): void {
    isle.bakeImage?.destroy()
    isle.bakeImage = null
    if (this.textures.exists(bakeKey(isle.id))) this.textures.remove(bakeKey(isle.id))
    for (const f of isle.falls) f.destroy()
    isle.falls = []
  }

  /** Throws the ground away and makes it again: after a lost WebGL context, whose textures come back empty. */
  rebake(): void {
    for (const isle of this.isles.values()) isle.groundKey = ''
    this.sync()
  }

  /**
   * An island floating (Home's look, on every island since UI rework Phase 3): one canvas the size of its landmass, shown as
   * an image in the island's ground, with a waterfall sprite per fall. A headless game (tests) has no renderer to hold the
   * texture: it paints nothing, the waterfalls still stand.
   */
  private bakeIsland(isle: Isle, state: PlayerState): void {
    const id = isle.id
    const shown = landPlots(state, id)
    const land = landmass(shown)
    const owned = ownedPlots(state, id)
    if (shown.length > 0 && this.game.config.renderType !== Phaser.HEADLESS) {
      const tex = this.textures.createCanvas(bakeKey(id), land.box.w, land.box.h)
      if (tex) {
        paintLandmass(tex.context, land, this.bakeArt(id), (col, row) => !owned.includes(nearestPlot(shown, col, row)))
        tex.refresh()
        isle.bakeImage = this.add.image(land.box.x, land.box.y, bakeKey(id)).setOrigin(0, 0)
        isle.ground.addAt(isle.bakeImage, 0)
      }
    }
    const fall = this.art().ground.waterfall
    const key = textureKey('ground.waterfall')
    isle.falls = land.falls.map(p => {
      if (fall && this.textures.exists(key)) {
        const spr = this.add.sprite(p.x, p.y - FALL_LIP, key).setOrigin(0.5, 0).setName('waterfall')
        playOrStill(spr, key, fall.frames, fall.fps, this.bridge.reducedMotion)
        isle.ground.add(spr)
        return spr
      }
      const g = this.add.graphics().setName('waterfall')
      g.fillStyle(0xbfe6fa, 1).fillRect(p.x - 12, p.y - FALL_LIP, 24, 72)
      g.fillStyle(0x3fa6e0, 1).fillRect(p.x - 8, p.y - FALL_LIP + 3, 4, 66).fillRect(p.x + 2, p.y - FALL_LIP + 3, 5, 66)
      isle.ground.add(g)
      return g
    })
    // The landmass under its waterfalls, whatever order they were made in.
    if (isle.bakeImage) isle.ground.sendToBack(isle.bakeImage)
  }

  /** The bitmaps the painter samples, the ones whose textures really exist: a PNG that failed leaves none, and it paints its own look. */
  private bakeArt(view: IslandId): BakeArt {
    const ground = this.art().ground
    // Each island's own grass when the art set has it (Ember Reach's ash, Frostspire's snow), else Home's.
    const own = ground.island[view]
    const grassSprites = own && own.grass.length > 0 ? own.grass : ground.grass
    const grassKeys = groundTiles(this.art(), view).grass
    const img = (path: string, s: Sprite | null | undefined): BakeImage | null => {
      const key = textureKey(path)
      if (!s || !this.textures.exists(key)) return null
      return { source: this.textures.get(key).getSourceImage() as CanvasImageSource, w: s.w, h: s.h }
    }
    return {
      grass: grassKeys.map((k, i) => img(k, grassSprites[i])).filter((b): b is BakeImage => b !== null),
      variant: groundVariant,
      rock: img('ground.rock', ground.rock),
      rim: ground.rim.map((s, i) => img(`ground.rim.${i}`, s)).filter((b): b is BakeImage => b !== null),
      water: img('ground.water', ground.water),
    }
  }

  /** The placement ghost's footprint, coloured by legality: a translucent diamond on the ground, its outline over everything. */
  private drawOutline(isle: Isle, ghost: IslandMarkers['ghost']): void {
    const fill = isle.footFill.clear()
    const line = isle.outline.clear()
    if (!ghost) return
    const color = ghost.legal ? TINT.ok : TINT.bad
    const pts = points(footprintDiamond(ghost.col, ghost.row, ghost.size))
    fill.fillStyle(color, 0.25).fillPoints(pts, true)
    line.lineStyle(2, color, 1).strokePoints(pts, true, true)
  }

  /**
   * A yellow diamond round the selected thing's footprint, with a faint fill, when it stands on the island on screen.
   * Not while placing: the ghost has the ground then.
   */
  private drawSelection(): void {
    for (const isle of this.isles.values()) isle.selectionLine.clear()
    this.drawHomes()
    const { state, placing, selection } = this.bridge
    const o = state && !placing ? selectionOutline(state, selection) : null
    // Every island is on screen together: the outline goes on whichever island the selection stands on.
    this.shownSelection = o
    if (!o) return
    const g = this.isle(o.island).selectionLine
    const pts = points(footprintDiamond(o.col, o.row, o.size))
    g.fillStyle(SELECTED, 0.18).fillPoints(pts, true)
    g.lineStyle(3, 0x141627, 1).strokePoints(pts, true, true)
    g.lineStyle(2, SELECTED, 1).strokePoints(pts, true, true)
  }

  /**
   * The home finder (ruling A5): every habitat the waiting dragon fits is outlined, with an arrow bobbing over it (still
   * under reduced motion). Redrawn whole when the finder or the state changes.
   */
  private drawHomes(): void {
    const { state, placing, homeFinder } = this.bridge
    const spots = state && homeFinder ? homeFinder.homes.map(id => selectionOutline(state, { kind: 'habitat', id })) : []
    // The clock syncs the scene every second: the same finder in the same places keeps its arrows and their bob.
    const key = JSON.stringify([Boolean(placing), homeFinder, spots])
    if (key === this.homesKey) return
    this.homesKey = key
    for (const isle of this.isles.values()) {
      isle.arrows?.destroy()
      isle.arrows = null
      isle.homesLine.clear()
    }
    this.shownHomes = []
    if (!state || placing || !homeFinder) return
    for (const id of homeFinder.homes) {
      const o = selectionOutline(state, { kind: 'habitat', id })
      if (!o) continue
      const isle = this.isle(o.island)
      const g = isle.homesLine
      if (!isle.arrows) {
        isle.arrows = this.add.graphics()
        isle.root.add(isle.arrows)
        if (!this.bridge.reducedMotion) this.tweens.add({ targets: isle.arrows, y: -ARROW_BOB.y * 2, duration: ARROW_BOB.ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      }
      const arrows = isle.arrows
      this.shownHomes.push(id)
      const pts = points(footprintDiamond(o.col, o.row, o.size))
      g.fillStyle(HOME_GLOW, 0.22).fillPoints(pts, true)
      g.lineStyle(3, 0x141627, 1).strokePoints(pts, true, true)
      g.lineStyle(2, HOME_GLOW, 1).strokePoints(pts, true, true)
      const top = cellTop(o.col, o.row)
      const tip = { x: top.x, y: top.y - 40 }
      arrows.fillStyle(0x141627, 1).fillTriangle(tip.x - 9, tip.y - 12, tip.x + 9, tip.y - 12, tip.x, tip.y + 1)
      arrows.fillStyle(HOME_GLOW, 1).fillTriangle(tip.x - 6, tip.y - 10, tip.x + 6, tip.y - 10, tip.x, tip.y - 2)
    }
  }

  /** The habitats the home finder outlines now, for tests. */
  homesShown(): string[] {
    return this.shownHomes
  }

  /** The selection outline drawn now; null when none is. */
  selectionShown(): Outline | null {
    return this.shownSelection
  }

  /** The view island's object layer, what is on it and its badges, and the sprite kept for each id: tests read them. */
  get layer(): Phaser.GameObjects.Container {
    return this.isle(this.bridge.view).layer
  }

  get footFill(): Phaser.GameObjects.Graphics {
    return this.isle(this.bridge.view).footFill
  }

  get outline(): Phaser.GameObjects.Graphics {
    return this.isle(this.bridge.view).outline
  }

  get drawn(): Phaser.GameObjects.GameObject[] {
    return this.layer.list
  }

  get badges(): Phaser.GameObjects.Text[] {
    return this.isle(this.bridge.view).badges
  }

  get live(): Map<string, { obj: LiveObject; sig: string }> {
    return this.isle(this.bridge.view).live
  }

  /** What the view island shows; `markersOf` for another. */
  markers(): IslandMarkers {
    return this.isle(this.bridge.view).current
  }

  markersOf(id: IslandId): IslandMarkers {
    return this.isle(id).current
  }

  /** An island's container, for tests: it stands at the island's world offset. */
  isleRoot(id: IslandId): Phaser.GameObjects.Container {
    return this.isle(id).root
  }

  private draw(isle: Isle, o: IslandObject): Phaser.GameObjects.Sprite {
    const spr = this.add.sprite(o.x, o.y, o.key).setOrigin(0.5, 1).setData('island', isle.id)
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
    isle.layer.add(spr)
    return spr
  }

  /** The bar under a sprite: a dark frame centred on its anchor, just below it, and `fill` px of green. */
  private drawBar(isle: Isle, o: IslandObject, fill: number): Phaser.GameObjects.Graphics {
    const x = o.x - PROGRESS_BAR.w / 2
    const y = o.y + 1
    const g = this.add.graphics()
    g.fillStyle(BAR.frame, 1).fillRect(x, y, PROGRESS_BAR.w, PROGRESS_BAR.h)
    g.fillStyle(BAR.fill, 1).fillRect(x + 1, y + 1, fill, PROGRESS_BAR.h - 2)
    isle.layer.add(g)
    return g
  }

  /** Badges keep one on-screen size (BADGE_PX tall) at every zoom instead of growing with the art. */
  private badgeScale(): number {
    return BADGE_PX / 8 / (this.view?.zoom ?? 1)
  }

  /** Captions have their own on-screen size by zoom (`captionPx`): smaller than a badge when the whole island shows. */
  private captionScale(): number {
    const zoom = this.view?.zoom ?? 1
    return captionPx(zoom) / 8 / zoom
  }

  /** A label under a sprite's anchor: dark text on white, `captionPx` tall on screen. Its own box is a tap target, as what it labels. */
  private drawCaption(isle: Isle, o: IslandObject, caption: string): Phaser.GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = { ...TEXT_STYLE, color: '#0f1324', stroke: undefined, strokeThickness: 0, backgroundColor: '#ffffff', padding: { x: 3, y: 1 } }
    const t = this.add.text(o.x, o.y + 2, caption, style).setOrigin(0.5, 0).setResolution(4).setScale(this.captionScale()).setData('caption', true).setData('target', o.target).setData('island', isle.id)
    t.setInteractive({ useHandCursor: true })
    isle.layer.add(t)
    return t
  }

  private drawBadge(isle: Isle, o: IslandObject, badge: string): Phaser.GameObjects.Text {
    const gold = (badge === 'gold' || badge === 'full') && o.target.kind === 'habitat'
    const ripe = badge === 'ripe' && o.target.kind === 'farm'
    const tappable = gold || ripe
    const label = badge === 'gold' ? 'GOLD' : badge === 'full' ? 'FULL' : ripe ? 'FOOD' : badge
    // A collect bubble (UI rework A3): white with a dark rim, its word in the currency's colour; timers keep the outlined text.
    const style = tappable ? { ...BUBBLE_STYLE, color: ripe ? '#c0563a' : badge === 'full' ? '#b3261e' : '#a8740a' } : TEXT_STYLE
    const t = this.add.text(o.x, badgeY(o), label, style).setOrigin(0.5, 1).setResolution(4).setScale(this.badgeScale()).setData('island', isle.id)
    if (ripe) t.setData('harvest', (o.target as { plot: number }).plot)
    if (tappable) {
      // The text is scaled to BADGE_PX on screen at every zoom, so a hit box of HIT_LOCAL local pixels is
      // HIT_LOCAL * BADGE_PX / 8 = at least 44 CSS px. It grows upward and sideways from the text's bottom edge.
      const w = Math.max(t.width, BADGE_HIT_LOCAL)
      const h = Math.max(t.height, BADGE_HIT_LOCAL)
      if (gold) t.setData('collect', (o.target as { id: string }).id)
      t.setInteractive({ hitArea: new Phaser.Geom.Rectangle((t.width - w) / 2, t.height - h, w, h), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true })
    }
    isle.layer.add(t)
    return t
  }
}

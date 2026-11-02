import type { IslandId } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { playOrStill, textureKey } from '../../art/phaserLoader'
import { FALLBACK_ART } from '../../art/slots'
import type { GameArtSet } from '../../art/types'
import type { Bridge } from '../bridge'
import { clampView, screenToWorld, worldToScreen, zoomRange, type View } from '../camera'
import type { Box } from '../layout'
import { buildMapModel, MAP_CELL, MAP_PLOT, MAP_SPOTS, mapBounds, mapIslandAt, mapOpeningView, type MapIsland, type MapModel } from '../mapModel'
import { createPanZoom, heldPointers } from '../panZoom'

/** On-screen height of label text in CSS pixels (the font is 8 px in world space), at every zoom. */
const LABEL_PX = 12
const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#f2f1ea', stroke: '#0f1324', strokeThickness: 2, align: 'center',
}
const LABEL_COLOR: Record<MapIsland['state'], string> = { current: '#ffe066', open: '#f2f1ea', next: '#f2f1ea', locked: '#a9aec4' }
/** Locks are a dim tint (§5.5 gates); the next island is only a little dim, since it's the one to buy. */
const ICON_TINT: Partial<Record<MapIsland['state'], number>> = { next: 0xc4c4d4, locked: 0x585c70 }
const PLOT_COLOR = {
  owned: 0x7bd35a,
  openEmpty: [0x2f6a44, 0.85],
  shut: [0x2b3450, 0.8],
  edge: 0x0f1324,
  current: 0xffe066,
  built: 0xe3c489,
  unbuilt: 0x9aa3bd,
} as const
/** The island scene's sky colour, behind everything when the sky art is missing. */
const SKY_FALLBACK = '#8fd0ee'
/** On-screen size of the chain over a locked island, in world px at zoom 1 (32 px art at 2x). */
const CHAIN_PX = 64
/** The middle of a floating island, from its spot: halfway down the room it stands in. */
const FLOAT_MIDDLE = (MAP_CELL.top + MAP_CELL.plotsBottom) / 2

/**
 * All six islands, in place of `IslandScene` while the Map is open (R60): the same gestures, the sky with clouds, each
 * island floating (shut ones chained), its plots as a diamond grid, the Bridges and a label. Display only, like the positions: the scene emits
 * `select` for the island under a tap, and React opens its panel. No clock here: nothing on the Map runs on a timer, so it
 * redraws only when the holding or the view changes.
 */
export class MapScene extends Phaser.Scene {
  private view: View | null = null
  private sky: Phaser.GameObjects.Image | null = null
  private model: MapModel | null = null
  private bridgesLine!: Phaser.GameObjects.Graphics
  private plots!: Phaser.GameObjects.Graphics
  private drawn: Phaser.GameObjects.GameObject[] = []
  private labels: Phaser.GameObjects.Text[] = []
  private drawnKey = ''
  private framed = ''
  private readonly gestures = createPanZoom({
    view: () => this.view,
    apply: v => this.apply(v),
    range: () => zoomRange(this.opening().zoom),
    size: () => ({ w: this.scale.width, h: this.scale.height }),
  })

  constructor(private readonly bridge: Bridge) {
    super('map')
  }

  create(): void {
    this.drawSky()
    this.bridgesLine = this.add.graphics()
    this.plots = this.add.graphics()
    const offs = [
      this.bridge.on('state', () => this.sync()),
      this.bridge.on('view', () => this.sync()),
      this.bridge.on('insets', () => { if (this.showing()) this.frame() }),
    ]
    const toScreen = (id: IslandId) => this.toScreen(MAP_SPOTS[id])
    this.bridge.mapIslandToScreen = toScreen
    const onResize = () => { if (this.showing()) this.frame() }
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize)
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.opened())
    this.events.on(Phaser.Scenes.Events.SLEEP, () => {
      this.gestures.reset()
      this.input.setDefaultCursor('')
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      offs.forEach(off => off())
      if (this.bridge.mapIslandToScreen === toScreen) this.bridge.mapIslandToScreen = null
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize)
    })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.gestures.down(p, heldPointers(this.input)))
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.gestures.move(p, heldPointers(this.input), p.isDown)) this.hover(p)
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => { if (this.gestures.up(p, heldPointers(this.input))) this.tap(p) })
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.gestures.wheel(p, dy))
    this.opened()
  }

  private art(): GameArtSet {
    return this.bridge.art ?? FALLBACK_ART
  }

  /**
   * The sky the islands float in (the floating look, UI rework Phase 3): the island's sky art held to the camera, and a
   * cloud in each gap of the chain, alternating sides. Without the art the camera's sky colour shows.
   */
  private drawSky(): void {
    this.cameras.main.setBackgroundColor(SKY_FALLBACK)
    const art = this.art().ground
    if (art.sky && this.textures.exists(textureKey('ground.sky'))) this.sky = this.add.image(0, 0, textureKey('ground.sky')).setDepth(-3)
    const clouds = art.clouds.map((_, i) => textureKey(`ground.cloud.${i}`)).filter(k => this.textures.exists(k))
    if (clouds.length === 0) return
    const order = Object.values(MAP_SPOTS).sort((a, b) => a.y - b.y)
    order.slice(1).forEach((spot, i) => {
      const above = order[i]!
      const side = i % 2 === 0 ? -1 : 1
      this.add.image((spot.x + above.x) / 2 + side * 150, (spot.y + above.y) / 2 + 40, clouds[i % clouds.length]!).setScale(2).setAlpha(0.85).setDepth(-1)
    })
  }

  /** True while this scene owns display objects and is what's on screen; see `IslandScene.alive`. */
  private showing(): boolean {
    const dying = (this.game as (Phaser.Game & { pendingDestroy?: boolean }) | undefined)?.pendingDestroy
    return !dying && Boolean(this.sys?.displayList) && !this.sys.isSleeping() && this.sys.settings.status !== Phaser.Scenes.DESTROYED && this.sys.settings.status !== Phaser.Scenes.SHUTDOWN
  }

  /** The Map came up: open on the viewed island, whatever was panned last time (or changed while it slept). */
  private opened(): void {
    this.framed = ''
    this.sync()
    this.frame()
  }

  // ---- camera ------------------------------------------------------------------------------------------------

  private opening(): View {
    const { top, bottom } = this.bridge.insets
    const v = mapOpeningView(this.bridge.view, Math.max(1, this.scale.height - top - bottom), this.scale.width)
    // The free band's middle sits (top - bottom) / 2 below the screen's: look that much higher in the world.
    return { ...v, cy: v.cy + (bottom - top) / 2 / v.zoom }
  }

  /** The chain's bounds grown by the HUD insets, so Home and Warlord's Crown can both clear the bars. */
  private bounds(zoom: number): Box {
    const b = mapBounds()
    const { top, bottom } = this.bridge.insets
    return { x: b.x, y: b.y - top / zoom, w: b.w, h: b.h + (top + bottom) / zoom }
  }

  private apply(v: View): void {
    this.view = clampView(v, this.scale.width, this.scale.height, this.bounds(v.zoom))
    const cam = this.cameras.main
    cam.setZoom(this.view.zoom)
    cam.centerOn(this.view.cx, this.view.cy)
    const scale = LABEL_PX / 8 / this.view.zoom
    for (const t of this.labels) t.setScale(scale)
    if (this.sky) {
      const cover = Math.ceil(Math.max(this.scale.width / this.sky.width, this.scale.height / this.sky.height))
      this.sky.setPosition(this.view.cx, this.view.cy).setScale(cover / this.view.zoom)
    }
  }

  private frame(): void {
    const { top, bottom } = this.bridge.insets
    const key = `${this.bridge.view}:${this.scale.width}x${this.scale.height}:${top}:${bottom}`
    if (key === this.framed && this.view) return this.apply(this.view)
    this.framed = key
    this.apply(this.opening())
  }

  private toWorld(p: { x: number; y: number }): { x: number; y: number } {
    return this.view ? screenToWorld(this.view, this.scale.width, this.scale.height, p.x, p.y) : p
  }

  private toScreen(w: { x: number; y: number }): { x: number; y: number } {
    return worldToScreen(this.view ?? { cx: 0, cy: 0, zoom: 1 }, this.scale.width, this.scale.height, w.x, w.y)
  }

  // ---- input -------------------------------------------------------------------------------------------------

  private islandAt(p: { x: number; y: number }): IslandId | null {
    if (!this.model) return null
    const w = this.toWorld(p)
    return mapIslandAt(this.model, w.x, w.y)
  }

  private tap(p: { x: number; y: number }): void {
    const id = this.islandAt(p)
    // Open water does nothing.
    if (id) this.bridge.emit({ type: 'select', target: { kind: 'mapIsland', id } })
  }

  private hover(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) this.input.setDefaultCursor(this.islandAt(p) ? 'pointer' : '')
  }

  // ---- drawing -----------------------------------------------------------------------------------------------

  private sync(): void {
    if (!this.showing() || !this.bridge.state) return
    const model = buildMapModel(this.bridge.state, this.art(), this.bridge.view)
    this.model = model
    const key = model.islands.map(i => `${i.id}:${i.state}:${i.plots.filter(p => p.owned).map(p => p.plot).join(',')}`).join('|')
    if (key === this.drawnKey) return
    this.drawnKey = key
    for (const o of this.drawn) o.destroy()
    this.drawn = []
    this.labels = []
    this.drawBridges(model)
    this.drawPlots(model)
    for (const i of model.islands) this.drawIsland(i)
    if (this.view) this.apply(this.view)
  }

  /** True when the island's art is drawn: it floats in the whole cell, and its plot grid is left out. */
  private floats(i: MapIsland): boolean {
    return i.key !== '' && this.textures.exists(i.key)
  }

  /** From the middle of one island to the middle of the next: both ends hide behind what they join. */
  private drawBridges(model: MapModel): void {
    const g = this.bridgesLine.clear()
    const art = this.art().hud['map.bridge']
    const middle = (id: IslandId) => {
      const i = model.islands.find(x => x.id === id)!
      return { x: i.x, y: i.y + (this.floats(i) ? FLOAT_MIDDLE : 0) }
    }
    const iconMiddle = (MAP_CELL.top + MAP_CELL.iconBottom) / 2
    for (const b of model.bridges) {
      const fromIsland = model.islands.find(x => x.id === b.from)!
      const from = { x: MAP_SPOTS[b.from].x, y: MAP_SPOTS[b.from].y + (this.floats(fromIsland) ? FLOAT_MIDDLE : iconMiddle) }
      const to = middle(b.to)
      if (art?.src && this.textures.exists(textureKey('map.bridge'))) {
        const img = this.add.image((from.x + to.x) / 2, (from.y + to.y) / 2, textureKey('map.bridge'))
        img.setDisplaySize(Math.hypot(to.x - from.x, to.y - from.y), art.h).setRotation(Math.atan2(to.y - from.y, to.x - from.x)).setDepth(0)
        if (!b.built) img.setTint(0x585c70).setAlpha(0.7)
        this.drawn.push(img)
      } else {
        g.lineStyle(b.built ? 4 : 2, b.built ? PLOT_COLOR.built : PLOT_COLOR.unbuilt, b.built ? 1 : 0.85)
        g.lineBetween(from.x, from.y, to.x, to.y)
      }
    }
  }

  /** Every plot of every island in one `Graphics`, redrawn only when a holding changes: owned bright, the rest dim. */
  private drawPlots(model: MapModel): void {
    const g = this.plots.clear().setDepth(1)
    const hw = MAP_PLOT.w / 2 - 0.5
    const hh = MAP_PLOT.h / 2 - 0.5
    const diamond = (x: number, y: number, w: number, h: number) => [
      new Phaser.Math.Vector2(x, y - h), new Phaser.Math.Vector2(x + w, y), new Phaser.Math.Vector2(x, y + h), new Phaser.Math.Vector2(x - w, y),
    ]
    for (const i of model.islands) {
      if (this.floats(i)) continue
      const open = i.state === 'current' || i.state === 'open'
      for (const p of i.plots) {
        const [color, alpha] = p.owned ? [PLOT_COLOR.owned, 1] : open ? PLOT_COLOR.openEmpty : PLOT_COLOR.shut
        g.fillStyle(color, alpha).fillPoints(diamond(p.x, p.y, hw, hh), true)
        g.lineStyle(1, PLOT_COLOR.edge, 0.6).strokePoints(diamond(p.x, p.y, hw, hh), true, true)
      }
      if (i.state === 'current') g.lineStyle(2, PLOT_COLOR.current, 1).strokePoints(diamond(i.x, i.y, MAP_PLOT.w * 2 + 1, MAP_PLOT.h * 2 + 1), true, true)
    }
  }

  /** A chain and padlock over the middle of a shut island's icon; a drawn padlock without the art. */
  private drawChain(i: MapIsland): void {
    const x = i.x
    const y = i.y + (this.floats(i) ? FLOAT_MIDDLE : (MAP_CELL.top + MAP_CELL.iconBottom) / 2)
    const key = textureKey('map.chain')
    if (this.art().hud['map.chain']?.src && this.textures.exists(key)) {
      this.drawn.push(this.add.image(x, y, key).setDisplaySize(CHAIN_PX, CHAIN_PX).setDepth(2.5))
      return
    }
    const g = this.add.graphics().setDepth(2.5)
    g.lineStyle(4, 0x0f1324, 1).strokeCircle(x, y - 8, 9)
    g.lineStyle(2, 0xc9ccd8, 1).strokeCircle(x, y - 8, 9)
    g.fillStyle(0x0f1324, 1).fillRect(x - 14, y - 4, 28, 22)
    g.fillStyle(0xe3b23c, 1).fillRect(x - 12, y - 2, 24, 18)
    g.fillStyle(0x0f1324, 1).fillRect(x - 2, y + 3, 4, 8)
    this.drawn.push(g)
  }

  private drawIsland(i: MapIsland): void {
    if (this.floats(i)) {
      const sprite = this.art().map[i.id]
      const spr = this.add.sprite(i.x, i.y + MAP_CELL.plotsBottom, i.key).setOrigin(0.5, 1).setScale(i.scale).setDepth(2)
      playOrStill(spr, i.key, sprite.frames, sprite.fps, this.bridge.reducedMotion)
      const tint = ICON_TINT[i.state]
      if (tint !== undefined) spr.setTint(tint)
      this.drawn.push(spr)
    }
    if (i.chained) this.drawChain(i)
    // One fact a line: the label is wider than an island otherwise.
    const t = this.add.text(i.x, i.y + MAP_CELL.labelTop, i.label.split(' · ').join('\n'), { ...LABEL_STYLE, color: LABEL_COLOR[i.state] })
    t.setOrigin(0.5, 0).setResolution(4).setDepth(3)
    this.drawn.push(t)
    this.labels.push(t)
  }
}

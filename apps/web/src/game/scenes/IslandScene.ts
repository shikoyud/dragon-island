import { islandSize, LAUNCH_CATALOG, type Catalog } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { playOrStill } from '../../art/phaserLoader'
import { FALLBACK_ART } from '../../art/slots'
import type { GameArtSet } from '../../art/types'
import type { Bridge, Target } from '../bridge'
import {
  cameraBounds, clampView, fitZoom, groundCell, isClick, lockedTiles, panBy, screenToWorld, shownSize, SKIRT, stepZoom, zoomAt,
  zoomRange, type View,
} from '../camera'
import { badgeY, buildIslandModel, type IslandMarkers, type IslandObject } from '../islandModel'
import { anchor, cellCentre, cellTop, footprintDiamond, pointerToCell, type Box, type Pos } from '../layout'

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#f2f1ea', stroke: '#0f1324', strokeThickness: 2,
}
const TINT = { ok: 0x9dffa8, bad: 0xff7a7a, building: 0xa8a8c0 } as const
/** Placeholder ground colours until the ground tiles in docs/art/hud-art-list.md exist. */
const GROUND = {
  grass: [0x5f9e3f, 0x579538], fog: [0xb9c4cf, 0xaab6c3], cliffLeft: 0x6b4a2b, cliffRight: 0x8b6136, lip: 0x3d6e2c, strata: 0x58391f,
}
const EMPTY: IslandMarkers = {
  habitats: [], dragons: [], waiting: [], nests: [], hatchery: [], farms: [], hoard: false,
  obstacles: [], decorations: [], constructions: 0, ghost: null, sign: null,
}
/** Pinch distance ratio that counts as one zoom step. */
const PINCH_STEP = 1.25

const points = (pts: Pos[]) => pts.map(p => new Phaser.Math.Vector2(p.x, p.y))

/**
 * Draws one island of the player's base in an isometric (2:1) projection from `buildIslandModel` (pure, tested) on
 * every state, view or placing change and once a second for timers. The camera is a pure `View` (camera.ts):
 * drag pans, the wheel or a pinch zooms about the pointer, by whole numbers. The scene owns no game logic: it emits
 * `select`, `hover` and `cell` events only.
 */
export class IslandScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.Graphics
  private outline!: Phaser.GameObjects.Graphics
  private layer!: Phaser.GameObjects.Container
  private drawn: Phaser.GameObjects.GameObject[] = []
  private current: IslandMarkers = EMPTY
  private catalog: Catalog = LAUNCH_CATALOG
  private down: { x: number; y: number } | null = null
  private last: { x: number; y: number } | null = null
  private panning = false
  private pinch: number | null = null
  private lastCell = ''
  private groundKey = ''
  private view: View | null = null
  private framed = ''

  constructor(private readonly bridge: Bridge) {
    super('island')
  }

  create(): void {
    this.ground = this.add.graphics()
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
        if (e.placing) this.reveal(anchor(e.placing.col, e.placing.row, e.placing.size))
      }),
      // Switch to the battle scene while a battle is being built; come back when it is cleared.
      this.bridge.on('battle', e => { if (e.preview && this.alive()) this.scene.switch('battle') }),
    ]
    const cellToScreen = (col: number, row: number) => this.toScreen(cellCentre(col, row))
    const focusCell = () => {
      const { top, bottom } = this.bridge.insets
      const w = this.toWorld({ x: this.scale.width / 2, y: (top + this.scale.height - bottom) / 2 })
      return pointerToCell(w.x, w.y)
    }
    this.bridge.cellToScreen = cellToScreen
    this.bridge.focusCell = focusCell
    const onResize = () => { if (this.alive()) this.frame() }
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize)
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      offs.forEach(off => off())
      // StrictMode boots a second game while this one is torn down: clear only the hooks this scene set, so the
      // hooks always belong to the live scene (and their presence means the island is ready for input).
      if (this.bridge.cellToScreen === cellToScreen) this.bridge.cellToScreen = null
      if (this.bridge.focusCell === focusCell) this.bridge.focusCell = null
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize)
    })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p))
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p))
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.onUp(p, over))
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!this.view || dy === 0) return
      this.zoomTo(stepZoom(this.view.zoom, dy < 0 ? -1 : 1, this.range()), p.x, p.y)
    })
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.sync() })
    this.sync()
    this.bridge.emit({ type: 'ready' })
  }

  private art(): GameArtSet {
    return this.bridge.art ?? FALLBACK_ART
  }

  /** True while this scene can still own display objects. */
  private alive(): boolean {
    return Boolean(this.sys?.displayList) && this.sys.settings.status !== Phaser.Scenes.DESTROYED && this.sys.settings.status !== Phaser.Scenes.SHUTDOWN
  }

  // ---- camera ------------------------------------------------------------------------------------------------

  /** Camera bounds grown by the HUD insets at a zoom, so the island centres in the band the HUD leaves free. */
  private bounds(zoom: number): Box {
    const b = cameraBounds(this.bridge.state, this.bridge.view)
    const { top, bottom } = this.bridge.insets
    return { x: b.x, y: b.y - top / zoom, w: b.w, h: b.h + (top + bottom) / zoom }
  }

  private fit(): number {
    const { top, bottom } = this.bridge.insets
    return fitZoom(this.scale.width, Math.max(1, this.scale.height - top - bottom), cameraBounds(this.bridge.state, this.bridge.view))
  }

  private range(): { min: number; max: number } {
    return zoomRange(this.fit())
  }

  private apply(v: View): void {
    this.view = clampView(v, this.scale.width, this.scale.height, this.bounds(v.zoom))
    const cam = this.cameras.main
    cam.setZoom(this.view.zoom)
    cam.centerOn(this.view.cx, this.view.cy)
  }

  /** Frames the island when the view, its shown size or the screen changes; otherwise only re-clamps. */
  private frame(): void {
    const s = this.bridge.state
    const size = s ? shownSize(s, this.bridge.view) : { w: 0, h: 0 }
    const key = `${this.bridge.view}:${size.w}x${size.h}:${this.scale.width}x${this.scale.height}`
    if (key === this.framed && this.view) return this.apply(this.view)
    this.framed = key
    const zoom = this.fit()
    const b = this.bounds(zoom)
    this.apply({ cx: b.x + b.w / 2, cy: b.y + b.h / 2, zoom })
  }

  private zoomTo(zoom: number, sx: number, sy: number): void {
    if (!this.view || zoom === this.view.zoom) return
    this.apply(zoomAt(this.view, this.scale.width, this.scale.height, sx, sy, zoom))
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
    const v = this.view ?? { cx: 0, cy: 0, zoom: 1 }
    return { x: (w.x - v.cx) * v.zoom + this.scale.width / 2, y: (w.y - v.cy) * v.zoom + this.scale.height / 2 }
  }

  // ---- input -------------------------------------------------------------------------------------------------

  private pointersDown(): Phaser.Input.Pointer[] {
    return [this.input.pointer1, this.input.pointer2].filter((p): p is Phaser.Input.Pointer => Boolean(p?.isDown))
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const two = this.pointersDown()
    if (two.length === 2) {
      // A second finger: this press is a pinch, never a click or a pan.
      this.pinch = Phaser.Math.Distance.Between(two[0]!.x, two[0]!.y, two[1]!.x, two[1]!.y)
      this.down = null
      this.panning = true
      return
    }
    this.down = { x: p.x, y: p.y }
    this.last = { x: p.x, y: p.y }
    this.panning = false
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const two = this.pointersDown()
    if (two.length === 2 && this.pinch !== null && this.view) {
      const [a, b] = two as [Phaser.Input.Pointer, Phaser.Input.Pointer]
      const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)
      const ratio = dist / this.pinch
      if (ratio >= PINCH_STEP || ratio <= 1 / PINCH_STEP) {
        this.zoomTo(stepZoom(this.view.zoom, ratio > 1 ? -1 : 1, this.range()), (a.x + b.x) / 2, (a.y + b.y) / 2)
        this.pinch = dist
      }
      return
    }
    if (this.down && this.last && p.isDown && this.view) {
      // Pan once the press has moved past the click threshold, from where it went down: the grabbed point stays
      // under the pointer. Deltas come from our own last position, never Phaser's prevPosition (stale on a new press).
      if (!this.panning && !isClick(this.down.x, this.down.y, p.x, p.y)) this.panning = true
      if (this.panning) {
        this.apply(panBy(this.view, p.x - this.last.x, p.y - this.last.y))
        this.last = { x: p.x, y: p.y }
        return
      }
    }
    // The placement reducer tracks the cursor, so hover moves matter only while placing (and not for touches).
    if (!this.bridge.placing || p.wasTouch) return
    this.emitCell(p, false)
  }

  /** Emits the cell under a screen point; while placing, the pointer holds the footprint's centre. */
  private emitCell(p: { x: number; y: number }, always: boolean): boolean {
    const w = this.toWorld(p)
    const c = groundCell(this.bridge.state, this.bridge.view, w.x, w.y)
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
    if (this.pointersDown().length === 0) this.pinch = null
    const wasPan = this.panning || !this.down || !isClick(this.down.x, this.down.y, p.x, p.y)
    this.down = null
    this.last = null
    this.panning = false
    if (wasPan) return
    // While placing, every click is a cell; otherwise a sprite under the pointer wins over the ground.
    const hit = this.bridge.placing ? undefined : over.find(o => o.getData('target'))
    if (hit) this.bridge.emit({ type: 'select', target: hit.getData('target') as Target })
    else this.emitCell(p, true)
  }

  // ---- drawing -----------------------------------------------------------------------------------------------

  /** Rebuilds the ground, camera framing and every dynamic object from the current state. */
  sync(): void {
    if (!this.alive()) return
    const { state, view } = this.bridge
    this.drawGround()
    this.frame()
    for (const obj of this.drawn) obj.destroy()
    this.drawn = []
    const model = buildIslandModel(state, this.art(), this.catalog, this.bridge.nowMs, view, this.bridge.placing)
    this.current = model.markers
    this.drawOutline(model.markers.ghost)
    for (const o of model.objects) this.draw(o)
    // Badges go on top of every sprite, so a dragon never hides its habitat's gold.
    for (const o of model.objects) if (o.badge) this.drawBadge(o, o.badge)
  }

  /**
   * The landmass: a checker of grass diamonds for unlocked cells, fog diamonds for the locked ring, and a cliff
   * skirt under the two front edges, over the sea (the canvas background). Redrawn only when the view or home step changes.
   */
  private drawGround(): void {
    const { state, view } = this.bridge
    const key = `${view}:${state?.islands.homeStep ?? -1}`
    if (key === this.groundKey) return
    this.groundKey = key
    const g = this.ground.clear()
    if (!state) return
    const shown = shownSize(state, view)
    const left = cellTop(0, shown.h)
    const bottom = cellTop(shown.w, shown.h)
    const right = cellTop(shown.w, 0)
    const down = (p: Pos, d: number): Pos => ({ x: p.x, y: p.y + d })
    g.fillStyle(GROUND.cliffLeft, 1).fillPoints(points([left, bottom, down(bottom, SKIRT), down(left, SKIRT)]), true)
    g.fillStyle(GROUND.cliffRight, 1).fillPoints(points([bottom, right, down(right, SKIRT), down(bottom, SKIRT)]), true)
    g.lineStyle(1, GROUND.strata, 0.6)
    g.lineBetween(left.x, left.y + SKIRT / 2 + 1, bottom.x, bottom.y + SKIRT / 2 + 1)
    g.lineBetween(bottom.x, bottom.y + SKIRT / 2 + 1, right.x, right.y + SKIRT / 2 + 1)
    g.fillStyle(GROUND.lip, 1)
    g.fillPoints(points([left, bottom, down(bottom, 2), down(left, 2)]), true)
    g.fillPoints(points([bottom, right, down(right, 2), down(bottom, 2)]), true)
    const { w, h } = islandSize(state, view)
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      g.fillStyle(GROUND.grass[(col + row) % 2]!, 1).fillPoints(points(footprintDiamond(col, row, 1)), true)
    }
    for (const t of lockedTiles(state, view)) {
      g.fillStyle(GROUND.fog[(t.col + t.row) % 2]!, 1).fillPoints(points(footprintDiamond(t.col, t.row, 1)), true)
    }
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

  private draw(o: IslandObject): void {
    const spr = this.add.sprite(o.x, o.y, o.key).setOrigin(0.5, 1)
    playOrStill(spr, o.key, o.sprite.frames, o.sprite.fps, this.bridge.reducedMotion)
    if (o.frame) spr.setFrame(o.frame)
    if (o.scale) spr.setScale(o.scale)
    if (o.flipX) spr.setFlipX(true)
    if (o.tint) spr.setTint(TINT[o.tint])
    if (o.id === 'ghost') {
      spr.setAlpha(0.6)
    } else {
      spr.setData('target', o.target)
      // Pixel-perfect hits: a click on the transparent sky above a platform reaches the ground or what is behind it.
      spr.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 1 })
      spr.on('pointerover', () => this.bridge.emit({ type: 'hover', target: o.target }))
      spr.on('pointerout', () => this.bridge.emit({ type: 'hover', target: null }))
    }
    this.layer.add(spr)
    this.drawn.push(spr)
  }

  private drawBadge(o: IslandObject, badge: string): void {
    const t = this.add.text(o.x, badgeY(o), badge, TEXT_STYLE).setOrigin(0.5, 1).setResolution(4)
    this.layer.add(t)
    this.drawn.push(t)
  }
}

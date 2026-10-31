import { FOOTPRINT, LAUNCH_CATALOG, ownedPlots, plotOrigin, TILES_PER_PLOT, type Catalog } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { animateWater, isSheet, playOneShot, playOrStill, textureKey } from '../../art/phaserLoader'
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
  habitats: [], dragons: [], waiting: [], breeders: [], hatchery: [], farms: [],
  obstacles: [], decorations: [], constructions: 0, ghost: null, signs: [],
}
/** On-screen height of badge text in CSS pixels (the font is 8 px in world space). */
const BADGE_PX = 14
/** Local (unscaled) size of a tappable badge's hit box: 28 local px x BADGE_PX / 8 = 49 CSS px, over the 44 px minimum. */
const BADGE_HIT_LOCAL = 28
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
  private groundTiles!: Phaser.GameObjects.Container
  private water: Phaser.GameObjects.TileSprite | null = null
  private hatchView: string | null = null
  private outline!: Phaser.GameObjects.Graphics
  private layer!: Phaser.GameObjects.Container
  private drawn: Phaser.GameObjects.GameObject[] = []
  private badges: Phaser.GameObjects.Text[] = []
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
    this.groundTiles = this.add.container(0, 0)
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
      this.bridge.on('levelUp', () => {
        if (!this.alive() || !this.art().fx.levelUp) return
        const c = this.cameras.main.midPoint
        this.playOnce('fx.levelUp', { x: c.x, y: c.y })
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
    const scale = this.badgeScale()
    for (const t of this.badges) if (t.active) t.setScale(scale)
  }

  /** Frames the island when the view, its shown size or the screen changes; otherwise only re-clamps. */
  private frame(): void {
    const s = this.bridge.state
    const size = s ? shownSize() : { w: 0, h: 0 }
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
    // A gold badge sits above every sprite: a tap on it collects instead of opening the habitat.
    const badge = this.bridge.placing ? undefined : over.find(o => o.getData('collect'))
    if (badge) return this.collect(badge as Phaser.GameObjects.Text)
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
    this.badges = []
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
    for (const o of model.objects) this.draw(o)
    // Badges go on top of every sprite, so a dragon never hides its habitat's gold.
    for (const o of model.objects) if (o.badge) this.drawBadge(o, o.badge)
  }

  /**
   * Collect from a tapped gold badge: ask React to run `collectGold`, then the coin burst in place of the badge, or
   * without `fx.coins` art the badge itself goes up and away. Nothing moves with reduced motion.
   */
  private collect(badge: Phaser.GameObjects.Text): void {
    this.bridge.emit({ type: 'collectGold', habitatId: badge.getData('collect') as string })
    badge.disableInteractive()
    if (this.bridge.reducedMotion) return
    if (isSheet(this.art().fx.coins)) {
      badge.setVisible(false)
      this.playOnce('fx.coins', { x: badge.x, y: badge.y })
      return
    }
    this.tweens.add({ targets: badge, y: badge.y - 12 / (this.view?.zoom ?? 1), alpha: 0, duration: 450, ease: 'Quad.easeOut' })
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
   * the sea. Uses the `ground.*` tiles when the manifest has them and drawn diamonds otherwise. Redrawn only when the
   * view or its owned plots change.
   */
  private drawGround(): void {
    const { state, view } = this.bridge
    const key = `${view}:${state ? ownedPlots(state, view).join(',') : '-'}`
    if (key === this.groundKey) return
    this.groundKey = key
    const g = this.ground.clear()
    this.groundTiles.removeAll(true)
    this.water?.destroy()
    this.water = null
    if (!state) return
    const tiles = this.art().ground
    const tile = (k: string, x: number, y: number) => this.groundTiles.add(this.add.image(x, y, textureKey(k)).setOrigin(0, 0))
    const shown = shownSize()
    if (tiles.water) {
      const b = cameraBounds(state, view)
      const pad = 2048 // the sea also fills the screen beyond the camera bounds when zoomed out
      this.water = this.add.tileSprite(b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad, textureKey('ground.water'), 0).setOrigin(0, 0).setDepth(-1).setAlpha(0.4) // softened: the sea is backdrop, not the subject
      const w = tiles.water
      animateWater(this, this.water, textureKey('ground.water'), w.frames, w.fps, this.bridge.reducedMotion)
    }
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
    if (tiles.cliffSw && tiles.cliffSe) {
      // A 16x16 piece per front edge cell, drawn over the cell's bounding box; its face hangs below the cell's edge.
      for (let col = 0; col < shown.w; col++) { const t = cellTop(col, shown.h - 1); tile('ground.cliff.sw', t.x - 8, t.y) }
      for (let row = 0; row < shown.h; row++) { const t = cellTop(shown.w - 1, row); tile('ground.cliff.se', t.x - 8, t.y) }
    }
    // A diamond's 16x8 tile has its top-left corner 8 px left of the cell's top vertex.
    for (const plot of ownedPlots(state, view)) {
      const o = plotOrigin(plot)
      for (let row = o.row; row < o.row + TILES_PER_PLOT; row++) for (let col = o.col; col < o.col + TILES_PER_PLOT; col++) {
        if (tiles.grass.length > 0) {
          const t = cellTop(col, row)
          tile(`ground.grass.${(col * 7 + row * 13) % tiles.grass.length}`, t.x - 8, t.y)
        } else {
          g.fillStyle(GROUND.grass[(col + row) % 2]!, 1).fillPoints(points(footprintDiamond(col, row, 1)), true)
        }
      }
    }
    for (const c of lockedTiles(state, view)) {
      if (tiles.fog) {
        const t = cellTop(c.col, c.row)
        tile('ground.fog', t.x - 8, t.y)
      } else {
        g.fillStyle(GROUND.fog[(c.col + c.row) % 2]!, 1).fillPoints(points(footprintDiamond(c.col, c.row, 1)), true)
      }
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
      spr.setAlpha(0.8)
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

  /** Badges keep one on-screen size (BADGE_PX tall) at every zoom instead of growing with the art. */
  private badgeScale(): number {
    return BADGE_PX / 8 / (this.view?.zoom ?? 1)
  }

  private drawBadge(o: IslandObject, badge: string): void {
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
    this.drawn.push(t)
    this.badges.push(t)
  }
}

import { LAUNCH_CATALOG, type Catalog } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { playOrStill } from '../../art/phaserLoader'
import { FALLBACK_ART } from '../../art/slots'
import type { GameArtSet } from '../../art/types'
import type { Bridge, Target } from '../bridge'
import { cameraBounds, groundCell, isClick, lockedTiles, stepZoom, zoomRange } from '../camera'
import { buildIslandModel, type IslandMarkers, type IslandObject } from '../islandModel'
import { CELL } from '../layout'

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#f2f1ea' }
const TINT = { ok: 0x9dffa8, bad: 0xff7a7a, building: 0xa8a8c0 } as const
const EMPTY: IslandMarkers = {
  habitats: [], dragons: [], waiting: [], nests: [], hatchery: [], farms: [], hoard: false,
  obstacles: [], decorations: [], constructions: 0, ghost: null, sign: null,
}

/**
 * Draws one island of the player's base on a 16 px grid from `buildIslandModel` (pure, tested) on every
 * state, view or placing change and once a second for timers. The camera pans by dragging and zooms with
 * the wheel inside the island's bounds (pure rules in `camera.ts`). The scene owns no game logic: it emits
 * `select`, `hover` and `cell` events only.
 */
export class IslandScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.Graphics
  private layer!: Phaser.GameObjects.Container
  private drawn: Phaser.GameObjects.GameObject[] = []
  private current: IslandMarkers = EMPTY
  private catalog: Catalog = LAUNCH_CATALOG
  private down: { x: number; y: number } | null = null
  private panning = false
  private lastCell = ''
  private groundKey = ''

  constructor(private readonly bridge: Bridge) {
    super('island')
  }

  create(): void {
    this.ground = this.add.graphics()
    this.layer = this.add.container(0, 0)
    // Bridge subscriptions must die with the scene: React StrictMode (and hot reload) destroys and
    // recreates the game, and a destroyed scene drawing on a state event crashes Phaser.
    const offs = [
      this.bridge.on('state', () => this.sync()),
      this.bridge.on('view', () => this.sync()),
      this.bridge.on('placing', () => { this.lastCell = ''; this.sync() }),
      // Switch to the battle scene while a battle is being built; come back when it is cleared.
      this.bridge.on('battle', e => { if (e.preview && this.alive()) this.scene.switch('battle') }),
    ]
    this.events.once(Phaser.Scenes.Events.DESTROY, () => offs.forEach(off => off()))
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.down = { x: p.x, y: p.y }; this.panning = false })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p))
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.onUp(p, over))
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main
      cam.setZoom(stepZoom(cam.zoom, dy < 0 ? -1 : 1, zoomRange(this.scale.width, this.scale.height)))
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

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.down && p.isDown) {
      if (!this.panning && !isClick(this.down.x, this.down.y, p.x, p.y)) this.panning = true
      if (this.panning) {
        const cam = this.cameras.main
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom
        return
      }
    }
    // The placement reducer tracks the cursor, so hover moves matter only while placing.
    if (!this.bridge.placing) return
    const c = groundCell(this.bridge.state, this.bridge.view, p.worldX, p.worldY)
    if (!c || `${c.col},${c.row}` === this.lastCell) return
    this.lastCell = `${c.col},${c.row}`
    this.bridge.emit({ type: 'cell', col: c.col, row: c.row })
  }

  private onUp(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    const wasPan = this.panning || !this.down || !isClick(this.down.x, this.down.y, p.x, p.y)
    this.down = null
    this.panning = false
    if (wasPan) return
    const c = groundCell(this.bridge.state, this.bridge.view, p.worldX, p.worldY)
    // While placing, every click is a cell; otherwise a sprite under the pointer wins over the ground.
    const hit = this.bridge.placing ? undefined : over.find(o => o.getData('target'))
    if (hit) this.bridge.emit({ type: 'select', target: hit.getData('target') as Target })
    else if (c) this.bridge.emit({ type: 'cell', col: c.col, row: c.row })
  }

  /** Rebuilds the ground, camera bounds and every dynamic object from the current state. */
  sync(): void {
    if (!this.alive()) return
    const { state, view } = this.bridge
    this.drawGround()
    const b = cameraBounds(state, view)
    this.cameras.main.setBounds(0, 0, b.w, b.h)
    for (const obj of this.drawn) obj.destroy()
    this.drawn = []
    const model = buildIslandModel(state, this.art(), this.catalog, this.bridge.nowMs, view, this.bridge.placing)
    this.current = model.markers
    for (const o of model.objects) this.draw(o)
    // Badges go on top of every sprite, so a dragon never hides its habitat's gold.
    for (const o of model.objects) if (o.badge) this.drawBadge(o, o.badge)
  }

  private drawGround(): void {
    const { state, view } = this.bridge
    const key = `${view}:${state?.islands.homeStep ?? -1}`
    if (key === this.groundKey) return
    this.groundKey = key
    const g = this.ground.clear()
    if (!state) return
    for (const t of lockedTiles(state, view)) g.fillStyle(0x0b0f1c, 1).fillRect(t.col * CELL, t.row * CELL, CELL, CELL)
    const b = cameraBounds(state, view)
    g.fillStyle(0x24402f, 1).fillRect(0, 0, b.w, b.h)
    g.lineStyle(1, 0xffffff, 0.08)
    for (let x = 0; x <= b.w; x += CELL) g.lineBetween(x, 0, x, b.h)
    for (let y = 0; y <= b.h; y += CELL) g.lineBetween(0, y, b.w, y)
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
      spr.setAlpha(0.75)
    } else {
      spr.setData('target', o.target)
      spr.setInteractive({ useHandCursor: true })
      spr.on('pointerover', () => this.bridge.emit({ type: 'hover', target: o.target }))
      spr.on('pointerout', () => this.bridge.emit({ type: 'hover', target: null }))
    }
    this.layer.add(spr)
    this.drawn.push(spr)
  }

  private drawBadge(o: IslandObject, badge: string): void {
    const t = this.add.text(o.x, o.y - o.sprite.h - 2, badge, TEXT_STYLE).setOrigin(0.5, 1)
    this.layer.add(t)
    this.drawn.push(t)
  }
}

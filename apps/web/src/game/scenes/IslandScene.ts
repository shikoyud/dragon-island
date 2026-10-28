import { LAUNCH_CATALOG, type Catalog } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { playOrStill, textureKey } from '../../art/phaserLoader'
import { FALLBACK_ART } from '../../art/slots'
import type { GameArtSet } from '../../art/types'
import type { Bridge } from '../bridge'
import { buildIslandModel, type IslandMarkers, type IslandObject } from '../islandModel'

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#f2f1ea' }

/**
 * Draws the player's island from `buildIslandModel` (pure, tested) on every state change and once a
 * second for timers. The scene owns no game logic and emits only `select`/`hover` events.
 */
export class IslandScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container
  private drawn: Phaser.GameObjects.GameObject[] = []
  private current: IslandMarkers = { habitats: [], dragons: [], waiting: [], nests: [], hatchery: [], farms: [], hoard: false }
  private catalog: Catalog = LAUNCH_CATALOG

  constructor(private readonly bridge: Bridge) {
    super('island')
  }

  create(): void {
    this.layer = this.add.container(0, 0)
    const art = this.art()
    this.layer.add(this.add.image(0, 0, textureKey('island.base')).setOrigin(0, 0))
    art.island.layers.forEach((s, i) => {
      const key = textureKey(`island.layer.${i}`)
      const spr = this.add.sprite(0, 0, key).setOrigin(0, 0)
      playOrStill(spr, key, s.frames, s.fps, this.bridge.reducedMotion)
      this.layer.add(spr)
    })
    this.bridge.on('state', () => this.sync())
    // Switch to the battle scene while a battle is being built; come back when it is cleared.
    this.bridge.on('battle', e => { if (e.preview) this.scene.switch('battle') })
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.sync() })
    this.sync()
    this.bridge.emit({ type: 'ready' })
  }

  private art(): GameArtSet {
    return this.bridge.art ?? FALLBACK_ART
  }

  /** Rebuilds every dynamic object from the current state. */
  sync(): void {
    for (const obj of this.drawn) obj.destroy()
    this.drawn = []
    const model = buildIslandModel(this.bridge.state, this.art(), this.catalog, this.bridge.nowMs)
    this.current = model.markers
    for (const o of model.objects) this.draw(o)
  }

  markers(): IslandMarkers {
    return this.current
  }

  private draw(o: IslandObject): void {
    const spr = this.add.sprite(o.x, o.y, o.key).setOrigin(0.5, 1)
    playOrStill(spr, o.key, o.sprite.frames, o.sprite.fps, this.bridge.reducedMotion)
    if (o.scale) spr.setScale(o.scale)
    spr.setInteractive({ useHandCursor: true })
    spr.on('pointerdown', () => this.bridge.emit({ type: 'select', target: o.target }))
    spr.on('pointerover', () => this.bridge.emit({ type: 'hover', target: o.target }))
    spr.on('pointerout', () => this.bridge.emit({ type: 'hover', target: null }))
    this.layer.add(spr)
    this.drawn.push(spr)
    if (o.badge) {
      const t = this.add.text(o.x, o.y - o.sprite.h - 2, o.badge, TEXT_STYLE).setOrigin(0.5, 1)
      this.layer.add(t)
      this.drawn.push(t)
    }
  }
}

import Phaser from 'phaser'
import { loadArt } from '../../art/phaserLoader'
import { FALLBACK_ART } from '../../art/slots'
import type { Bridge } from '../bridge'

/** Loads the active art set (real sheets or canvas fallbacks) once, then starts the island. */
export class BootScene extends Phaser.Scene {
  constructor(private readonly bridge: Bridge) {
    super('boot')
  }

  preload(): void {
    loadArt(this, this.bridge.art ?? FALLBACK_ART)
  }

  create(): void {
    this.scene.start('island')
  }
}

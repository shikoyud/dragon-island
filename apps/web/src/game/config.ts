import Phaser from 'phaser'
import type { Bridge } from './bridge'
import { BASE, integerZoom } from './layout'
import { BattleScene } from './scenes/BattleScene'
import { BootScene } from './scenes/BootScene'
import { IslandScene } from './scenes/IslandScene'

export interface GameOptions {
  /** Tests: no renderer, no requestAnimationFrame dependence. */
  headless?: boolean
}

/**
 * Pixel-perfect Phaser game at the 480×270 base, scaled by whole numbers to the parent's size.
 * Scenes read everything from the bridge; nothing here touches the network.
 */
export function createGame(parent: HTMLElement, bridge: Bridge, opts: GameOptions = {}): Phaser.Game {
  const zoom = integerZoom(parent.clientWidth || BASE.w, parent.clientHeight || BASE.h)
  const game = new Phaser.Game({
    type: opts.headless ? Phaser.HEADLESS : Phaser.AUTO,
    parent,
    width: BASE.w,
    height: BASE.h,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#0f1324',
    scale: { mode: Phaser.Scale.NONE, width: BASE.w, height: BASE.h, zoom },
    audio: { noAudio: true },
    banner: false,
    scene: [new BootScene(bridge), new IslandScene(bridge), new BattleScene(bridge)],
  })
  if (!opts.headless && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      game.scale.setZoom(integerZoom(parent.clientWidth, parent.clientHeight))
    })
    ro.observe(parent)
    game.events.once(Phaser.Core.Events.DESTROY, () => ro.disconnect())
  }
  return game
}

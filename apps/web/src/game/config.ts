import Phaser from 'phaser'
import type { Bridge } from './bridge'
import { BattleScene } from './scenes/BattleScene'
import { BootScene } from './scenes/BootScene'
import { IslandScene } from './scenes/IslandScene'

export interface GameOptions {
  /** Tests: no renderer, no requestAnimationFrame dependence. */
  headless?: boolean
}

/**
 * Phaser game that fills its parent: the canvas is the parent's size in CSS pixels (no CSS scaling, so a pointer
 * position is a game position) and each scene's camera zooms by whole numbers for crisp pixel art.
 * Scenes read everything from the bridge; nothing here touches the network.
 */
export function createGame(parent: HTMLElement, bridge: Bridge, opts: GameOptions = {}): Phaser.Game {
  const game = new Phaser.Game({
    type: opts.headless ? Phaser.HEADLESS : Phaser.AUTO,
    parent,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#2a6f97',
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 480, height: parent.clientHeight || 270 },
    // Two touch points for pinch zoom.
    input: { activePointers: 2 },
    audio: { noAudio: true },
    banner: false,
    scene: [new BootScene(bridge), new IslandScene(bridge), new BattleScene(bridge)],
  })
  // Phaser caches the canvas's page rectangle and re-measures only when the parent resizes, so a layout shift
  // that moves the canvas without resizing it offsets every pointer. Re-measure before Phaser sees each event
  // (capture phase on the parent runs before the canvas's own listeners).
  const remeasure = () => { if (game.isBooted) game.scale.updateBounds() }
  const events = ['pointerdown', 'pointermove', 'wheel'] as const
  for (const e of events) parent.addEventListener(e, remeasure, { capture: true, passive: true })
  game.events.once(Phaser.Core.Events.DESTROY, () => { for (const e of events) parent.removeEventListener(e, remeasure, { capture: true }) })
  return game
}

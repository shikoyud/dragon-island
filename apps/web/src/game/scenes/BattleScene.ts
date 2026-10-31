import type { BattlePreview, Side } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { FALLBACK_ART } from '../../art/slots'
import type { Bridge } from '../bridge'
import { dragonKey } from '../islandModel'
import { BATTLE, integerZoom } from '../layout'

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#f2f1ea' }
const ACTIVE_X: Record<Side, number> = { attacker: 150, defender: 330 }
const ACTIVE_Y = 170
const BENCH_X: Record<Side, readonly number[]> = { attacker: [40, 90], defender: [390, 440] }
const BENCH_Y = 120

/**
 * Shows the active dragons and the benches from the current preview and replays new log events
 * (a flash and the damage on the side that was hit). Reduced motion skips them. Task 8 rebuilds this.
 */
export class BattleScene extends Phaser.Scene {
  private drawn: Phaser.GameObjects.GameObject[] = []
  private shownLog = 0

  constructor(private readonly bridge: Bridge) {
    super('battle')
  }

  create(): void {
    this.add.rectangle(0, 0, BATTLE.w, BATTLE.h, 0x0f1324).setOrigin(0, 0)
    // The canvas fills the screen: show the fixed stage at the largest whole-number zoom, centred.
    const fit = () => {
      if (!this.alive()) return
      this.cameras.main.setZoom(integerZoom(this.scale.width, this.scale.height)).centerOn(BATTLE.w / 2, BATTLE.h / 2)
    }
    fit()
    this.scale.on(Phaser.Scale.Events.RESIZE, fit)
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.scale.off(Phaser.Scale.Events.RESIZE, fit))
    const off = this.bridge.on('battle', e => {
      if (!this.alive()) return
      this.render(e.preview)
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, off)
    this.render(this.bridge.battle)
  }

  private alive(): boolean {
    return Boolean(this.sys?.displayList) && this.sys.settings.status !== Phaser.Scenes.DESTROYED && this.sys.settings.status !== Phaser.Scenes.SHUTDOWN
  }

  render(preview: BattlePreview | null): void {
    if (!this.alive()) return
    for (const o of this.drawn) o.destroy()
    this.drawn = []
    if (!preview) {
      this.shownLog = 0
      return
    }
    const art = this.bridge.art ?? FALLBACK_ART
    const draw = (side: Side) => {
      const { team, active } = preview.state.sides[side]
      let benchSlot = 0
      team.forEach((f, slot) => {
        const isActive = slot === active
        const x = isActive ? ACTIVE_X[side] : BENCH_X[side][benchSlot++]!
        const y = isActive ? ACTIVE_Y : BENCH_Y
        const spr = this.add.sprite(x, y, dragonKey(f.spec.speciesId, f.spec.level, art)).setOrigin(0.5, 1)
        if (side === 'attacker') spr.setFlipX(true)
        spr.setAlpha(f.hp > 0 ? 1 : 0.35)
        if (!isActive) spr.setScale(0.5)
        const hp = this.add.text(x, y + 4, `${f.hp}/${f.stats.hp}`, TEXT_STYLE).setOrigin(0.5, 0)
        this.drawn.push(spr, hp)
      })
    }
    draw('attacker')
    draw('defender')
    if (preview.state.log.length < this.shownLog) this.shownLog = 0 // an undo: nothing new to play
    if (!this.bridge.reducedMotion) this.animate(preview)
    else this.shownLog = preview.state.log.length
  }

  /** A flash and the damage for each new attack, 250 ms apart. */
  private animate(preview: BattlePreview): void {
    const events = preview.state.log.slice(this.shownLog).flatMap(e => (e.kind === 'attack' ? [e] : []))
    this.shownLog = preview.state.log.length
    events.forEach((e, i) => {
      this.time.delayedCall(i * 250, () => {
        if (!this.alive()) return
        const toX = ACTIVE_X[e.side === 'attacker' ? 'defender' : 'attacker']
        const flash = this.add.rectangle(toX, ACTIVE_Y - 24, 24, 24, e.multiplier >= 2 ? 0xf4d03f : 0xffffff, 0.6)
        this.drawn.push(flash)
        this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() })
        const dmg = this.add.text(toX, ACTIVE_Y - 40, e.immune ? 'immune' : `-${e.damage}`, { ...TEXT_STYLE, color: '#e4572e' }).setOrigin(0.5, 1)
        this.drawn.push(dmg)
        this.tweens.add({ targets: dmg, y: dmg.y - 12, alpha: 0, duration: 400, onComplete: () => dmg.destroy() })
      })
    })
  }
}

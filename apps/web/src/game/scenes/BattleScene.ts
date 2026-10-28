import type { BattlePreview } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { FALLBACK_ART } from '../../art/slots'
import type { Bridge } from '../bridge'
import { dragonKey } from '../islandModel'

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#f2f1ea' }
const ATTACK_X = [96, 128, 160]
const DEFEND_X = [320, 352, 384]
const ROW_Y = [150, 130, 170]

/**
 * Shows both teams from the current preview and replays its log step by step (lunge, flash, fade).
 * Reduced motion jumps to the final frame. Target sprites emit `battleTarget` when clicked.
 */
export class BattleScene extends Phaser.Scene {
  private drawn: Phaser.GameObjects.GameObject[] = []
  private shownLog = 0

  constructor(private readonly bridge: Bridge) {
    super('battle')
  }

  create(): void {
    this.add.rectangle(0, 0, 480, 270, 0x0f1324).setOrigin(0, 0)
    this.bridge.on('battle', e => {
      if (!e.preview && this.scene.isActive()) this.scene.switch('island')
      this.render(e.preview)
    })
    this.render(this.bridge.battle)
  }

  render(preview: BattlePreview | null): void {
    for (const o of this.drawn) o.destroy()
    this.drawn = []
    this.shownLog = 0
    if (!preview) return
    const art = this.bridge.art ?? FALLBACK_ART
    const draw = (side: 'attacker' | 'defender') => {
      preview[side].forEach((c, slot) => {
        const x = (side === 'attacker' ? ATTACK_X : DEFEND_X)[slot]!
        const y = ROW_Y[slot]!
        const spr = this.add.sprite(x, y, dragonKey(c.spec.speciesId, art)).setOrigin(0.5, 1)
        if (side === 'attacker') spr.setFlipX(true)
        spr.setAlpha(c.hp > 0 ? 1 : 0.35)
        if (side === 'defender') {
          spr.setInteractive({ useHandCursor: true })
          spr.on('pointerdown', () => this.bridge.emit({ type: 'battleTarget', slot }))
        }
        const hp = this.add.text(x, y + 4, `${c.hp}/${c.stats.hp}`, TEXT_STYLE).setOrigin(0.5, 0)
        this.drawn.push(spr, hp)
      })
    }
    draw('attacker')
    draw('defender')
    if (!this.bridge.reducedMotion) this.animate(preview)
  }

  /** Lunge + flash for each new log event, 250 ms apart. */
  private animate(preview: BattlePreview): void {
    const events = preview.log.slice(this.shownLog)
    this.shownLog = preview.log.length
    events.forEach((e, i) => {
      this.time.delayedCall(i * 250, () => {
        const fromX = (e.side === 'attacker' ? ATTACK_X : DEFEND_X)[e.slot]!
        const toX = (e.side === 'attacker' ? DEFEND_X : ATTACK_X)[e.target]!
        const flash = this.add.rectangle(toX, ROW_Y[e.target]! - 24, 24, 24, e.multiplier >= 2 ? 0xf4d03f : 0xffffff, 0.6)
        this.drawn.push(flash)
        this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() })
        const dmg = this.add.text(toX, ROW_Y[e.target]! - 40, `-${e.damage}`, { ...TEXT_STYLE, color: '#e4572e' }).setOrigin(0.5, 1)
        this.drawn.push(dmg)
        this.tweens.add({ targets: dmg, y: dmg.y - 12, alpha: 0, duration: 400, onComplete: () => dmg.destroy() })
        void fromX
      })
    })
  }
}

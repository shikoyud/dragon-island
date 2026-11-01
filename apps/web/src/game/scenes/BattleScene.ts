import type { BattleEvent, BattlePreview, Side } from '@wyrmhaven/game-core'
import Phaser from 'phaser'
import { playOneShot, playOrStill, textureKey } from '../../art/phaserLoader'
import type { Sprite } from '../../art/types'
import { FALLBACK_ART } from '../../art/slots'
import { backdropFill, battleView, dragonFlip, hitFx } from '../battleModel'
import type { Bridge } from '../bridge'
import { dragonLook } from '../islandModel'
import { BATTLE, BATTLE_BLEED, BATTLE_DRAGON_SCALE, BATTLE_HEADER_H, BATTLE_HORIZON_Y, BATTLE_PLATFORM, BATTLE_SPOT, battleCamera, battleStage } from '../layout'

const SIDES: readonly Side[] = ['attacker', 'defender']
/** Just past the stage's edge, where a dragon slides from. */
const OFF_STAGE: Record<Side, number> = { attacker: -90, defender: BATTLE.w + 90 }
const LUNGE_PX = 18
const LUNGE_MS = 90
const TINT_MS = 220
const FADE_MS = 320
const SLIDE_MS = 170
const FLOAT_PX = 26
const FLOAT_MS = 520
const FX_DEPTH = 8
/** An IMMUNE word has no number to sit with: it floats this far above the target's head. */
const IMMUNE_GAP = 8
/** The font size of a floating number: its height, as far as clearing the header is concerned. */
const TEXT_PX = 20
/** A still fx fades over this long; a sheet plays its own length. */
const FX_MS = 420
/** Art platform (64x32) and fx (64x64) draw at these scales: a Tier 3 move reads stronger by size alone. */
const PLATFORM_SCALE = 2
const FX_SCALE = 2
const MOVE_FX_SCALE: Record<'physical' | 1 | 2 | 3, number> = { physical: 2, 1: 2, 2: 2.5, 3: 3.5 }
const TEXT_DEPTH = 10
const TEXT: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: 'Silkscreen, monospace', fontSize: `${TEXT_PX}px`, color: '#ffffff', stroke: '#141627', strokeThickness: 4 }

interface Slot {
  sprite: Phaser.GameObjects.Sprite
  /** What the sprite is, or is on its way to being: the last thing drawn or played. */
  look: { key: string; ko: boolean } | null
}

/**
 * The stage: two dragons on code-drawn platforms over a colour fill. React owns the HP bars, the names and the clock; this
 * draws `battleView(state, bridge.battleShown)` and plays the effects of each new event. Reduced motion draws the result.
 */
export class BattleScene extends Phaser.Scene {
  private slots!: Record<Side, Slot>
  private ground!: Phaser.GameObjects.Rectangle
  private platforms!: Phaser.GameObjects.Graphics
  private backdrop!: Phaser.GameObjects.Image
  private platformArt!: Record<Side, Phaser.GameObjects.Image>
  private shown = 0
  private painted: BattlePreview | null = null
  private fx: Phaser.GameObjects.GameObject[] = []
  /** Effects played since this scene began; tests read it. */
  playedEvents = 0

  constructor(private readonly bridge: Bridge) {
    super('battle')
  }

  create(): void {
    this.ground = this.add.rectangle(BATTLE.w / 2, BATTLE_HORIZON_Y, BATTLE_BLEED * 2, BATTLE_BLEED, 0xffffff).setOrigin(0.5, 0)
    // Backdrop art covers the stage (the fill shows only past its edges); the drawn platforms, or the platform art, sit on it.
    this.backdrop = this.add.image(0, 0, FALLBACK_KEY).setOrigin(0, 0).setVisible(false)
    this.platforms = this.add.graphics()
    const platformImage = (side: Side) => this.add.image(BATTLE_SPOT[side].x, BATTLE_SPOT[side].y - 4, FALLBACK_KEY).setScale(PLATFORM_SCALE).setVisible(false)
    this.platformArt = { attacker: platformImage('attacker'), defender: platformImage('defender') }
    const sprite = (side: Side) => this.add.sprite(BATTLE_SPOT[side].x, BATTLE_SPOT[side].y, FALLBACK_KEY).setOrigin(0.5, 1).setScale(BATTLE_DRAGON_SCALE).setVisible(false)
    this.slots = { attacker: { sprite: sprite('attacker'), look: null }, defender: { sprite: sprite('defender'), look: null } }

    const fit = () => {
      if (!this.alive()) return
      const box = battleStage(this.scale.width, this.scale.height)
      const at = battleCamera(this.scale.width, this.scale.height)
      this.cameras.main.setZoom(box.zoom).centerOn(at.x, at.y)
    }
    fit()
    this.scale.on(Phaser.Scale.Events.RESIZE, fit)
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.scale.off(Phaser.Scale.Events.RESIZE, fit))
    const offBattle = this.bridge.on('battle', () => { if (this.alive()) this.paint() })
    const offShown = this.bridge.on('battleShown', e => { if (this.alive()) this.onShown(e.shown) })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => { offBattle(); offShown() })
    // Asleep it plays nothing, and tweens would wait for it: catch up on waking.
    this.events.on(Phaser.Scenes.Events.WAKE, () => { fit(); this.paint() })
    this.paint()
  }

  /** The sprite on one side; tests read it. */
  dragon(side: Side): Phaser.GameObjects.Sprite {
    return this.slots[side].sprite
  }

  private alive(): boolean {
    return Boolean(this.sys?.displayList) && this.sys.settings.status !== Phaser.Scenes.DESTROYED && this.sys.settings.status !== Phaser.Scenes.SHUTDOWN
  }

  private drawBackdrop(): void {
    const fill = backdropFill(this.bridge.battleBackdrop)
    this.cameras.main.setBackgroundColor(fill.sky)
    this.ground.setFillStyle(fill.ground)
    const art = this.bridge.art ?? FALLBACK_ART
    const element = this.bridge.battleBackdrop
    const backdropKey = element && art.battle.backdrop[element] ? textureKey(`battle.backdrop.${element}`) : null
    if (backdropKey && this.textures.exists(backdropKey)) this.backdrop.setTexture(backdropKey).setDisplaySize(BATTLE.w, BATTLE.h).setVisible(true)
    else this.backdrop.setVisible(false)
    const platformKey = art.battle.platform ? textureKey('ui.battle.platform') : null
    const platformArt = platformKey !== null && this.textures.exists(platformKey)
    const g = this.platforms.clear()
    for (const side of SIDES) {
      const { x, y } = BATTLE_SPOT[side]
      if (platformArt) { this.platformArt[side].setTexture(platformKey).setVisible(true); continue }
      this.platformArt[side].setVisible(false)
      g.fillStyle(fill.rim).fillEllipse(x, y + 2, BATTLE_PLATFORM.w, BATTLE_PLATFORM.h)
      g.fillStyle(fill.platform).fillEllipse(x, y - 2, BATTLE_PLATFORM.w - 6, BATTLE_PLATFORM.h - 8)
    }
  }

  /** The look a side should have once `shown` events have played. */
  private lookAt(preview: BattlePreview, side: Side, shown: number) {
    const view = battleView(preview.state, shown)
    const slot = view.active[side]
    const f = preview.state.sides[side].team[slot]
    if (!f) return null
    return { ...dragonLook(f.spec.speciesId, f.spec.level, this.bridge.art ?? FALLBACK_ART), ko: view.hp[side][slot]! <= 0, flip: dragonFlip(side, f.spec.level) }
  }

  /** Draws what has played, touching nothing that is already right, so a newer preview can't interrupt an effect or spoil an event. */
  private paint(): void {
    const preview = this.bridge.battle
    this.shown = this.bridge.battleShown
    if (preview && !this.painted) this.drawBackdrop()
    if (!preview) this.clearFx()
    this.painted = preview
    for (const side of SIDES) {
      const slot = this.slots[side]
      const look = preview ? this.lookAt(preview, side, this.shown) : null
      if (!look) {
        slot.look = null
        this.tweens.killTweensOf(slot.sprite)
        slot.sprite.clearTint().setVisible(false)
        continue
      }
      if (slot.look?.key === look.key && slot.look.ko === look.ko) continue
      this.place(side, look)
    }
  }

  /** Puts a side's sprite at rest as `look`, stopping whatever was moving it. */
  private place(side: Side, look: { key: string; ko: boolean; flip: boolean; sprite: { frames: number; fps: number } }): void {
    const slot = this.slots[side]
    this.tweens.killTweensOf(slot.sprite)
    slot.look = { key: look.key, ko: look.ko }
    slot.sprite.clearTint().setVisible(true).setFlipX(look.flip).setPosition(BATTLE_SPOT[side].x, BATTLE_SPOT[side].y).setAlpha(look.ko ? 0 : 1)
    playOrStill(slot.sprite, look.key, look.sprite.frames, look.sprite.fps, this.bridge.reducedMotion)
  }

  private onShown(shown: number): void {
    const preview = this.bridge.battle
    if (!preview) { this.shown = shown; return }
    const e = preview.state.log[shown - 1]
    const oneMore = shown === this.shown + 1 && e !== undefined
    if (!oneMore || this.bridge.reducedMotion || !this.sys.isActive()) return this.paint()
    this.shown = shown
    this.playedEvents++
    if (e.kind === 'attack') this.playAttack(preview, e, shown)
    else this.playEntry(preview, e, shown)
  }

  private playAttack(preview: BattlePreview, e: Extract<BattleEvent, { kind: 'attack' }>, shown: number): void {
    const foeSide: Side = e.side === 'attacker' ? 'defender' : 'attacker'
    const me = this.slots[e.side].sprite
    const foe = this.slots[foeSide]
    const fx = hitFx(e)
    const dir = e.side === 'attacker' ? 1 : -1
    this.tweens.add({ targets: me, x: BATTLE_SPOT[e.side].x + dir * LUNGE_PX, duration: LUNGE_MS, yoyo: true, ease: 'Quad.easeOut' })

    const { x, y } = BATTLE_SPOT[foeSide]
    // A number sits over the target's body, whatever its stage's size, clear of the plates and the Exit button above; IMMUNE rides above the head.
    // IMMUNE: above the head, but never under the title row and the Exit button (an adult has only a few px of room there, so
    // the word then rests on the horns instead) and in place, since a rise would carry it into them.
    const top = e.immune
      ? Math.max(y - foe.sprite.displayHeight - IMMUNE_GAP, BATTLE_HEADER_H + TEXT_PX)
      : y - Math.round(foe.sprite.displayHeight * 0.6)
    this.floatText(x, top, fx.text, fx.colour, undefined, e.immune ? 0 : FLOAT_PX)
    if (fx.label) this.floatText(x, top + 22, fx.label, fx.colour, 14)
    if (fx.crit) this.floatText(x, top - 22, 'CRIT!', '#f4d03f', 16)

    if (fx.tint !== null) {
      foe.sprite.setTint(fx.tint)
      this.time.delayedCall(TINT_MS, () => { if (this.alive()) foe.sprite.clearTint() })
    }
    const move = preview.state.sides[e.side].team[e.slot]?.moves[e.move]
    const bodyY = y - Math.round(foe.sprite.displayHeight * 0.5)
    this.burst(`fx.move.${move?.element ?? 'physical'}`, this.art().battle.moveFx[move?.element ?? 'physical'], x, bodyY, MOVE_FX_SCALE[move?.tier ?? 'physical'])
    if (e.immune) this.burst('fx.immune', this.art().battle.fx.immune, x, bodyY, FX_SCALE)
    else this.burst('fx.hit', this.art().battle.fx.hit, x, bodyY, FX_SCALE)
    if (e.crit) this.burst('fx.crit', this.art().battle.fx.crit, x, bodyY, FX_SCALE)
    if (e.ko) this.burst('fx.ko', this.art().battle.fx.ko, x, bodyY, FX_SCALE)
    const after = this.lookAt(preview, foeSide, shown)
    if (fx.ko && after) {
      // A KO fades; `look` already says so, so a repaint leaves the fade running.
      foe.look = { key: after.key, ko: true }
      this.tweens.add({ targets: foe.sprite, alpha: 0, duration: FADE_MS, delay: LUNGE_MS })
    }
  }

  /** A swap slides the old dragon off and the new one in; a replacement only slides in, the old one having faded. */
  private playEntry(preview: BattlePreview, e: Extract<BattleEvent, { kind: 'swap' | 'replace' }>, shown: number): void {
    const slot = this.slots[e.side]
    const look = this.lookAt(preview, e.side, shown)
    if (!look) return
    const { x } = BATTLE_SPOT[e.side]
    const enter = () => {
      if (!this.alive()) return
      this.place(e.side, look)
      slot.sprite.setX(OFF_STAGE[e.side])
      this.tweens.add({ targets: slot.sprite, x, duration: SLIDE_MS, ease: 'Quad.easeOut' })
    }
    slot.look = { key: look.key, ko: look.ko }
    if (e.kind === 'replace') return enter()
    this.burst('fx.swap', this.art().battle.fx.swap, x, BATTLE_SPOT[e.side].y - Math.round(slot.sprite.displayHeight * 0.5), FX_SCALE)
    this.tweens.killTweensOf(slot.sprite)
    this.tweens.add({ targets: slot.sprite, x: OFF_STAGE[e.side], duration: SLIDE_MS, ease: 'Quad.easeIn', onComplete: enter })
  }

  private art() {
    return this.bridge.art ?? FALLBACK_ART
  }

  /**
   * A one-shot effect centred on (x, y): the sheet plays once and goes; a still fades. Nothing when the manifest has no such
   * sheet or it did not load, so a game without fx art plays the same battle with only its text and tints.
   */
  private burst(path: string, sprite: Sprite | undefined, x: number, y: number, scale: number): void {
    const key = textureKey(path)
    if (!sprite || !this.textures.exists(key)) return
    const fx = this.add.sprite(x, y, key).setScale(scale).setDepth(FX_DEPTH)
    this.fx.push(fx)
    fx.once(Phaser.GameObjects.Events.DESTROY, () => { this.fx = this.fx.filter(o => o !== fx) })
    if (!playOneShot(fx, key, sprite)) this.tweens.add({ targets: fx, alpha: 0, duration: FX_MS, onComplete: () => fx.destroy() })
  }

  private floatText(x: number, y: number, text: string, color: string, size?: number, rise = FLOAT_PX): void {
    const style = size ? { ...TEXT, color, fontSize: `${size}px` } : { ...TEXT, color }
    const t = this.add.text(x, y, text, style).setOrigin(0.5, 1).setDepth(TEXT_DEPTH)
    this.fx.push(t)
    this.tweens.add({
      targets: t, y: y - rise, alpha: 0, duration: FLOAT_MS, ease: 'Quad.easeIn',
      onComplete: () => { this.fx = this.fx.filter(o => o !== t); t.destroy() },
    })
  }

  private clearFx(): void {
    for (const o of this.fx) { this.tweens.killTweensOf(o); o.destroy() }
    this.fx = []
  }
}

/** A texture every game has, for the sprites before a battle's look is known. */
const FALLBACK_KEY = '__DEFAULT'

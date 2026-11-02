import type { Sprite } from '../art/types'

/** HUD pieces drawn from ui.* art when it exists: CSS variable, skin class and manifest key (docs/art/hud-art-list.md). */
const PIECES = [
  ['--ui-round', 'skin-round', 'ui.button.round'],
  ['--ui-round-active', 'skin-round-active', 'ui.button.round.active'],
  ['--ui-avatar', 'skin-avatar', 'ui.avatarFrame'],
  ['--ui-pill', 'skin-pill', 'ui.pill'],
  ['--ui-xp', 'skin-xp', 'ui.xpBar'],
  ['--ui-tab', 'skin-tab', 'ui.tab'],
  ['--ui-battle-hp', 'skin-battle-hp', 'ui.battle.hpFrame'],
  ['--ui-battle-move', 'skin-battle-move', 'ui.battle.moveButton'],
  ['--ui-battle-swap', 'skin-battle-swap', 'ui.battle.swap'],
  ['--ui-battle-turn', 'skin-battle-turn', 'ui.battle.turn'],
] as const

/**
 * CSS variables (image urls) and classes for the game root: hud.css styles a piece from its art only when its class
 * is present, and keeps the drawn CSS look otherwise.
 */
export function hudSkin(hud: Record<string, Sprite>): { className: string; style: Record<string, string> } {
  const style: Record<string, string> = {}
  const classes: string[] = []
  for (const [cssVar, cls, key] of PIECES) {
    const src = hud[key]?.src
    if (!src) continue
    style[cssVar] = `url("${src}")`
    classes.push(cls)
  }
  return { className: classes.join(' '), style }
}

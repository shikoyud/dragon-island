import { xpToNext } from '@wyrmhaven/game-core'
import { useMe } from '../state/me'
import { formatGold, Tokens } from '../ui/Money'

/** Gold, food, level and XP, trophies, game token balance. */
export function ResourcesBar() {
  const me = useMe()
  if (!me.data) return null
  const s = me.data.state
  return (
    <div className="resources" role="status" aria-label="Resources" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'baseline' }}>
      <span title="Gold">🪙 <strong>{formatGold(s.gold)}</strong></span>
      <span title="Food">🍖 <strong>{formatGold(s.food)}</strong></span>
      <span title="Level">Lv <strong>{s.level}</strong> <small>{s.xp} / {xpToNext(s.level)} XP</small></span>
      <span title="Trophies">🏆 <strong>{s.trophies}</strong></span>
      <span title="Game balance"><Tokens wei={me.data.balanceWei} /></span>
    </div>
  )
}

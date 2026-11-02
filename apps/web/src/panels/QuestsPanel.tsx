import { currentGoal, goalProgress, GOALS, LAUNCH_CATALOG, type GoalRow, type PlayerState } from '@wyrmhaven/game-core'
import { useContext } from 'react'
import type { DialogKey } from '../hud/Hud'
import { HudArtContext } from '../hud/Icon'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatGold } from '../ui/Money'
import { Panel } from '../ui/Panel'

/** A one-tap route from a Goal to where it is done, when there is an obvious place. */
export function goalRoute(g: GoalRow, s: PlayerState): { label: string; to: DialogKey } | null {
  switch (g.done.kind) {
    case 'stat':
      if (g.done.stat === 'harvests') return { label: 'Farm', to: { kind: 'target', target: { kind: 'farm', plot: 0 } } }
      if (g.done.stat === 'hatches') return { label: 'Hatchery', to: { kind: 'target', target: { kind: 'hatcheryBuilding' } } }
      return null
    case 'hatchery': return { label: 'Hatchery', to: { kind: 'target', target: { kind: 'hatcheryBuilding' } } }
    case 'firstHybrid': return { label: 'Breeding', to: { kind: 'panel', id: 'breed' } }
    case 'discovered': return { label: 'Dragon Book', to: { kind: 'panel', id: 'book' } }
    case 'roost':
      // The Roost if it stands (to upgrade it), else the Shop's Build tab where it is bought.
      return s.roostPlacement ? { label: 'Roost', to: { kind: 'upgrade', target: { type: 'roost' } } } : { label: 'Shop', to: { kind: 'panel', id: 'shop', tab: 'build' } }
    case 'habitatsOf':
    case 'dragonOf':
    case 'farms': return { label: 'Shop', to: { kind: 'panel', id: 'shop' } }
    default: return null
  }
}

/** The current Goal (§1.4): its text, progress, rewards (XP after the preset multiplier) and Claim. */
export function QuestsPanel({ onClose, onOpen }: { onClose?: () => void; onOpen?: (k: DialogKey) => void }) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const goalMark = useContext(HudArtContext)['ui.goal']?.src
  const s = me.data?.state
  if (!s) return null
  const g = currentGoal(s)
  if (!g) return <Panel title="Goals" onClose={onClose}><p>All goals done</p></Panel>
  const p = goalProgress(s, g, LAUNCH_CATALOG)
  const route = goalRoute(g, s)
  return (
    <Panel title="Goals" onClose={onClose}>
      <p style={{ margin: '0 0 4px' }}>{`Goal ${s.goalIndex + 1} of ${GOALS.length}`}</p>
      <p style={{ margin: '0 0 4px' }}>{g.text}</p>
      <p style={{ margin: '0 0 4px' }}>{`${p.have} / ${p.need}`}</p>
      <p style={{ margin: '0 0 8px' }}>{`+${formatGold(g.xp * preset.xpMult)} XP · +${formatGold(g.gold)} gold`}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {p.have >= p.need && goalMark && <img data-goal-mark className="pixel" src={goalMark} width={32} height={32} alt="" aria-hidden="true" />}
        {p.have >= p.need && <button type="button" className="btn btn--primary" disabled={pending} onClick={() => void run({ type: 'claimGoal' })}>Claim</button>}
        {p.have < p.need && route && onOpen && <button type="button" className="btn" onClick={() => onOpen(route.to)}>{`Go to ${route.label}`}</button>}
      </div>
    </Panel>
  )
}

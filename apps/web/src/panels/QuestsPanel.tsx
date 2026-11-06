import { useContext, useState } from 'react'
import type { DialogKey } from '../hud/Hud'
import { HudArtContext, Icon } from '../hud/Icon'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { PillButton } from '../ui/kit/buttons'
import { formatGold } from '../ui/Money'
import { Panel } from '../ui/Panel'
import { goalRows, recommendedRows, type GoalView } from './goalsModel'

export { goalRoute } from './goalsModel'

/**
 * Goals (design, Phase 5: task; §1.4): tabs Recommended and All; each row has its icon, title, hint, reward pills, and
 * Claim! or Go on the current Goal. Goals come one at a time, so earlier rows read Done and later ones Later.
 */
export function QuestsPanel({ onClose, onOpen }: { onClose?: () => void; onOpen?: (k: DialogKey) => void }) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const goalMark = useContext(HudArtContext)['ui.goal']?.src
  const [tab, setTab] = useState<'recommended' | 'all'>('recommended')
  const s = me.data?.state
  if (!s) return null
  const all = goalRows(s, preset)
  const rows = tab === 'all' ? all : recommendedRows(all)
  const finished = s.goalIndex >= all.length
  const row = (g: GoalView) => (
    <li key={g.id} className={`goal-row goal-row--${g.state}`} aria-label={g.title}>
      <span className="goal-row__icon"><Icon name={g.icon} size={48} /></span>
      <div className="goal-row__text">
        <h3 className="goal-row__title">{g.title}</h3>
        <p className="goal-row__hint">{g.hint}</p>
        <p className="goal-row__rewards">
          <span className="goal-row__rewards-label">Rewards:</span>
          <span className="goal-pill" aria-label={`+${formatGold(g.xp)} XP`}><Icon name="xp" size={20} /><span aria-hidden="true">{formatGold(g.xp)}</span></span>
          <span className="goal-pill" aria-label={`+${formatGold(g.gold)} gold`}><Icon name="gold" size={20} /><span aria-hidden="true">{formatGold(g.gold)}</span></span>
        </p>
      </div>
      <div className="goal-row__go">
        {g.state === 'claim' && (
          <>
            {goalMark && <img data-goal-mark className="pixel" src={goalMark} width={32} height={32} alt="" aria-hidden="true" />}
            <PillButton color="green" disabled={pending} ariaLabel="Claim" onClick={() => void run({ type: 'claimGoal' })}>Claim!</PillButton>
          </>
        )}
        {g.state === 'go' && <span className="goal-row__progress">{`${g.have} / ${g.need}`}</span>}
        {g.state === 'go' && g.route && onOpen && <PillButton color="yellow" ariaLabel={`Go to ${g.route.label}`} onClick={() => onOpen(g.route!.to)}>Go</PillButton>}
        {g.state === 'done' && <span className="goal-row__chip">Done</span>}
        {g.state === 'later' && <span className="goal-row__chip goal-row__chip--later">Later</span>}
      </div>
    </li>
  )
  return (
    <Panel title="Goals" onClose={onClose}>
      <div className="hud-tabs goal-tabs" role="tablist" aria-label="Goal lists">
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'recommended'} onClick={() => setTab('recommended')}>Recommended</button>
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>All</button>
      </div>
      <p className="goal-count">{finished ? 'All goals done' : `Goal ${s.goalIndex + 1} of ${all.length}`}</p>
      {rows.length > 0 && <ul className="goal-list" aria-label="Goals">{rows.map(row)}</ul>}
    </Panel>
  )
}

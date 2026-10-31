import type { TeamIds } from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { useState } from 'react'
import { PvpPanel } from './PvpPanel'
import { TrialsPanel } from './TrialsPanel'

/** The Battle button's dialog: the Elemental Trials and the Arena as two tabs. It opens on Trials, where an active Trial shows. */
export function BattleHub({ nowMs, chapter, onTrial, onResume, onPvp, onClose }: {
  nowMs: number
  /** The chapter a fight just ended in: Trials opens on its nodes. */
  chapter?: number
  onTrial: (chapter: number, node: number, team: TeamIds) => void; onResume: () => void; onPvp: (offer: Offer, team: TeamIds) => void; onClose: () => void
}) {
  const [tab, setTab] = useState<'trials' | 'pvp'>('trials')
  return (
    <div className="battle-hub">
      <div className="hud-tabs" role="tablist" aria-label="Battle mode">
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'trials'} onClick={() => setTab('trials')}>Trials</button>
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'pvp'} onClick={() => setTab('pvp')}>Arena</button>
      </div>
      <div role="tabpanel">
        {tab === 'trials' ? <TrialsPanel nowMs={nowMs} chapter={chapter} onFight={onTrial} onResume={onResume} onClose={onClose} /> : <PvpPanel onFight={onPvp} onClose={onClose} />}
      </div>
    </div>
  )
}

import type { TeamIds } from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { useState } from 'react'
import { PvePanel } from './PvePanel'
import { PvpPanel } from './PvpPanel'

/** The Battle button's dialog: Campaign (PvE) and Arena (PvP) as two tabs. */
export function BattleHub({ nowMs, onPve, onPvp, onClose }: {
  nowMs: number; onPve: (stage: number, team: TeamIds) => void; onPvp: (offer: Offer, team: TeamIds) => void; onClose: () => void
}) {
  const [tab, setTab] = useState<'pve' | 'pvp'>('pve')
  return (
    <div className="battle-hub">
      <div className="hud-tabs" role="tablist" aria-label="Battle mode">
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'pve'} onClick={() => setTab('pve')}>Campaign</button>
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'pvp'} onClick={() => setTab('pvp')}>Arena</button>
      </div>
      <div role="tabpanel">
        {tab === 'pve' ? <PvePanel onFight={onPve} onClose={onClose} nowMs={nowMs} /> : <PvpPanel onFight={onPvp} onClose={onClose} />}
      </div>
    </div>
  )
}

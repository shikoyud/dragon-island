import type { GameInfo } from '@wyrmhaven/shared'
import { useState } from 'react'
import { terminalLabel } from '../hud/TerminalClock'
import { Panel } from '../ui/Panel'
import { SignIn } from '../wallet/SignIn'
import { SpeedUpsRow } from './SpeedUpsRow'
import { WalletPanel } from './WalletPanel'

export type SettingsTab = 'account' | 'wallet'

/**
 * Settings (UI rework Phase 3): Account holds the address, Sign out, speed-ups and the Finals countdown (moved off the HUD,
 * review image-5); Wallet holds deposit and withdraw.
 */
export function SettingsPanel({ onClose, nowMs, game, tab: first = 'account' }: { onClose: () => void; nowMs: number; game?: Pick<GameInfo, 'launchAtMs' | 'preset'>; tab?: SettingsTab }) {
  const [tab, setTab] = useState<SettingsTab>(first)
  const clock = game ? terminalLabel(game, nowMs) : null
  return (
    <Panel title="Settings" onClose={onClose}>
      <div className="hud-tabs" role="tablist" aria-label="Settings sections">
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'account'} onClick={() => setTab('account')}>Account</button>
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'wallet'} onClick={() => setTab('wallet')}>Wallet</button>
      </div>
      {tab === 'account' ? (
        <div className="settings-tab__body" role="tabpanel" aria-label="Account">
          {clock && <p className="settings-clock" role="timer" aria-label="Terminal countdown">{clock}</p>}
          <SpeedUpsRow />
          <div className="settings-dialog__account"><SignIn /></div>
        </div>
      ) : (
        <div role="tabpanel" aria-label="Wallet"><WalletPanel framed={false} /></div>
      )}
    </Panel>
  )
}

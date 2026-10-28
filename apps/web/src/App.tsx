import type { TeamIds } from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from './api/session'
import { loadActiveArt, FALLBACK_ART } from './art/slots'
import type { GameArtSet } from './art/types'
import { createBridge } from './game/bridge'
import { GameCanvas } from './game/GameCanvas'
import { Verify } from './pages/Verify'
import { BattlePanel } from './panels/BattlePanel'
import { HoardPanel } from './panels/HoardPanel'
import { PanelHost, type PanelId } from './panels/PanelHost'
import { PvePanel } from './panels/PvePanel'
import { PvpPanel } from './panels/PvpPanel'
import { ResourcesBar } from './panels/ResourcesBar'
import { SeasonPanel } from './panels/SeasonPanel'
import { WalletPanel } from './panels/WalletPanel'
import { useBattle } from './state/battle'
import { useMe } from './state/me'
import { SignIn } from './wallet/SignIn'

const TOOLBAR: { id: PanelId; label: string }[] = [
  { id: 'breed', label: 'Breed' },
  { id: 'nests', label: 'Nests' },
  { id: 'farm', label: 'Farm' },
  { id: 'store', label: 'Store' },
  { id: 'hoard', label: 'Hoard' },
  { id: 'pve', label: 'Campaign' },
  { id: 'pvp', label: 'Arena' },
  { id: 'season', label: 'Season' },
  { id: 'wallet', label: 'Wallet' },
]

export function App() {
  const session = useSession()
  const me = useMe()
  const bridge = useMemo(() => createBridge(), [])
  const [art, setArt] = useState<GameArtSet>(FALLBACK_ART)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [named, setNamed] = useState<PanelId | null>(null)
  const [verifySeason, setVerifySeason] = useState<number | null>(null)
  const battle = useBattle()

  useEffect(() => { void loadActiveArt().then(setArt) }, [])
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { bridge.setBattle(battle.preview) }, [bridge, battle.preview])

  const startPvp = (offer: Offer, team: TeamIds) => { battle.startPvp(offer, team); setNamed(null) }
  const startPve = (stage: number, team: TeamIds) => { battle.startPve(stage, team); setNamed(null) }
  const closeBattle = () => { battle.reset(); bridge.setBattle(null) }

  return (
    <div className="shell" data-layout="sidebar">
      <header className="shell__header">
        <h1 style={{ margin: 0, fontSize: 18 }}>Wyrmhaven</h1>
        {session && <ResourcesBar />}
        <SignIn />
      </header>
      {!session && (
        <main className="shell__welcome">
          <p>Breed dragons. Build your island. Battle for the season.</p>
          <p><small>Connect a wallet and sign in to start. Signing costs no gas.</small></p>
        </main>
      )}
      {session && me.data && (
        <main className="shell__main">
          <section className="shell__canvas"><GameCanvas bridge={bridge} art={art} /></section>
          <aside className="shell__side">
            <nav aria-label="Panels" className="toolbar">
              {TOOLBAR.map(t => (
                <button key={t.id} type="button" className={`btn ${named === t.id ? 'btn--primary' : ''}`} aria-pressed={named === t.id} onClick={() => setNamed(named === t.id ? null : t.id)}>
                  {t.label}
                </button>
              ))}
            </nav>
            {battle.setup ? (
              <BattlePanel battle={battle} onClose={closeBattle} />
            ) : verifySeason !== null ? (
              <Verify seasonId={verifySeason} onClose={() => setVerifySeason(null)} />
            ) : named === 'wallet' ? <WalletPanel onClose={() => setNamed(null)} />
              : named === 'hoard' ? <HoardPanel nowMs={nowMs} onClose={() => setNamed(null)} />
              : named === 'pvp' ? <PvpPanel onFight={startPvp} onClose={() => setNamed(null)} />
              : named === 'pve' ? <PvePanel onFight={startPve} onClose={() => setNamed(null)} nowMs={nowMs} />
              : named === 'season' ? <SeasonPanel nowMs={nowMs} onClose={() => setNamed(null)} onVerify={id => { setVerifySeason(id); setNamed(null) }} />
              : <PanelHost bridge={bridge} nowMs={nowMs} named={named} onCloseNamed={() => setNamed(null)} />}
          </aside>
        </main>
      )}
    </div>
  )
}

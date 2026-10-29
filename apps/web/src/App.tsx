import type { TeamIds } from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from './api/session'
import { loadActiveArt, FALLBACK_ART } from './art/slots'
import type { GameArtSet } from './art/types'
import { createBridge } from './game/bridge'
import { placingAction } from './state/placing'
import { StartPlacingProvider, type StartPlacing } from './state/startPlacing'
import { usePlacing } from './state/usePlacing'
import { useAction } from './state/actions'
import { useAutoFinish } from './panels/useAutoFinish'
import { PlacementBar } from './panels/PlacementBar'
import { GameCanvas } from './game/GameCanvas'
import { Admin } from './pages/Admin'
import { Verify } from './pages/Verify'
import { BattlePanel } from './panels/BattlePanel'
import { HoardPanel } from './panels/HoardPanel'
import { PanelHost, type PanelId } from './panels/PanelHost'
import { PvePanel } from './panels/PvePanel'
import { PvpPanel } from './panels/PvpPanel'
import { ResourcesBar } from './panels/ResourcesBar'
import { ReferralPanel } from './panels/ReferralPanel'
import { SeasonPanel } from './panels/SeasonPanel'
import { WalletPanel } from './panels/WalletPanel'
import { useBattle } from './state/battle'
import { useMe } from './state/me'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { TermsPrompt } from './ui/TermsPrompt'
import { ToastProvider, useToasts } from './ui/Toast'
import { SignIn } from './wallet/SignIn'
import { Shell } from './Shell'

const TOOLBAR: { id: PanelId; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'map', label: 'Map' },
  { id: 'breed', label: 'Breed' },
  { id: 'nests', label: 'Nests' },
  { id: 'farm', label: 'Farm' },
  { id: 'store', label: 'Store' },
  { id: 'hoard', label: 'Hoard' },
  { id: 'pve', label: 'Campaign' },
  { id: 'pvp', label: 'Arena' },
  { id: 'season', label: 'Season' },
  { id: 'referral', label: 'Referral' },
  { id: 'wallet', label: 'Wallet' },
]

export function App() {
  // The operator console is the only hash route; everything else is the game.
  if (typeof location !== 'undefined' && location.hash === '#/admin') return <ErrorBoundary><Admin /></ErrorBoundary>
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Game />
      </ToastProvider>
    </ErrorBoundary>
  )
}

function Game() {
  const session = useSession()
  const toasts = useToasts()
  const me = useMe()
  const bridge = useMemo(() => createBridge(), [])
  const [art, setArt] = useState<GameArtSet>(FALLBACK_ART)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [named, setNamed] = useState<PanelId | null>(null)
  const [verifySeason, setVerifySeason] = useState<number | null>(null)
  const battle = useBattle()
  const { placing, view, dispatch } = usePlacing(bridge)
  const { run, pending } = useAction()
  useAutoFinish(nowMs)

  useEffect(() => { void loadActiveArt().then(setArt) }, [])
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { bridge.setBattle(battle.preview) }, [bridge, battle.preview])
  useEffect(() => { if (battle.error) toasts.error(battle.error) }, [battle.error, toasts])
  useEffect(() => { if (me.error) toasts.error(me.error) }, [me.error, toasts])

  const startPvp = (offer: Offer, team: TeamIds) => { battle.startPvp(offer, team); setNamed(null) }
  const startPve = (stage: number, team: TeamIds) => { battle.startPve(stage, team); setNamed(null) }
  const closeBattle = () => { battle.reset(); bridge.setBattle(null) }

  const header = (
    <>
      <h1 style={{ margin: 0, fontSize: 18 }}>Dragon Island</h1>
      {session && <ResourcesBar />}
      <SignIn />
    </>
  )
  if (!session || !me.data) {
    return (
      <div className="shell" data-testid="shell">
        <header className="shell__header">{header}</header>
        <main className="shell__welcome">
          <p>Breed dragons. Build your island. Battle for the season.</p>
          <p><small>Connect a wallet and sign in to start. Signing costs no gas.</small></p>
        </main>
      </div>
    )
  }
  const ghostAction = placing ? placingAction(me.data.state, view, placing) : null
  const confirmPlacing = () => {
    if (!ghostAction) return
    void run(ghostAction).then(res => { if (res) dispatch({ type: 'cancel' }) })
  }
  const startPlacing: StartPlacing = (what, size, from) => {
    // Show the island the thing belongs on: a move stays where it is, the Hoard is home-only, the Nexus Dawnspire-only.
    const island = from?.island ?? (what.kind === 'hoard' ? 'home' : what.kind === 'nexus' ? 'dawnspire' : view)
    if (island !== view) bridge.setView(island)
    dispatch({ type: 'start', what, size, island, from })
  }
  const side = (
    <StartPlacingProvider value={startPlacing}>
      {me.data.termsRequired && <TermsPrompt version={me.data.termsRequired} />}
      {placing && (
        <PlacementBar legal={ghostAction !== null} pending={pending} onTurn={() => dispatch({ type: 'turn' })} onConfirm={confirmPlacing} onCancel={() => dispatch({ type: 'cancel' })} />
      )}
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
        : named === 'referral' ? <ReferralPanel onClose={() => setNamed(null)} />
        : named === 'season' ? <SeasonPanel nowMs={nowMs} onClose={() => setNamed(null)} onVerify={id => { setVerifySeason(id); setNamed(null) }} />
        : <PanelHost bridge={bridge} nowMs={nowMs} named={named} onCloseNamed={() => setNamed(null)} />}
    </StartPlacingProvider>
  )
  return <Shell header={header} canvas={<GameCanvas bridge={bridge} art={art} />} side={side} />
}

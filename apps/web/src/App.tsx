import type { TeamIds } from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from './api/session'
import { loadActiveArt, FALLBACK_ART } from './art/slots'
import type { GameArtSet } from './art/types'
import { createBridge } from './game/bridge'
import { GameCanvas } from './game/GameCanvas'
import { Dialog } from './hud/Dialog'
import { Hud, type DialogKey } from './hud/Hud'
import { HudArtContext } from './hud/Icon'
import { Admin } from './pages/Admin'
import { Verify } from './pages/Verify'
import { BattlePanel } from './panels/BattlePanel'
import { dialogLabel, PanelHost, useDialog } from './panels/PanelHost'
import { PlacementBar } from './panels/PlacementBar'
import { useAutoFinish } from './panels/useAutoFinish'
import { useAction } from './state/actions'
import { useBattle } from './state/battle'
import { useMe } from './state/me'
import { nearestLegalCell, placingAction } from './state/placing'
import { StartPlacingProvider, type StartPlacing } from './state/startPlacing'
import { usePlacing } from './state/usePlacing'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { TermsPrompt } from './ui/TermsPrompt'
import { ToastProvider, useToasts } from './ui/Toast'
import { SignIn } from './wallet/SignIn'

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

/**
 * The full-screen island with the HUD over it. One dialog at a time (a HUD button or a click on the island
 * opens it); placement mode closes it and swaps the bottom bar for the placement strip.
 */
function Game() {
  const session = useSession()
  const toasts = useToasts()
  const me = useMe()
  const bridge = useMemo(() => createBridge(), [])
  const [art, setArt] = useState<GameArtSet>(FALLBACK_ART)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [dialog, setDialog] = useDialog(bridge)
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
  const close = useCallback(() => setDialog(null), [setDialog])

  const signedIn = Boolean(session && me.data)
  if (!signedIn || !me.data) {
    return (
      <div className="game-root" data-testid="shell">
        <main className="welcome">
          <section className="panel welcome__card">
            <h1>Dragon Island</h1>
            <p>Breed dragons. Build your island. Battle for the season.</p>
            <p><small>Connect a wallet and sign in to start. Signing costs no gas.</small></p>
            <SignIn />
          </section>
        </main>
      </div>
    )
  }

  const state = me.data.state
  const ghostAction = placing ? placingAction(state, view, placing) : null
  const confirmPlacing = () => {
    if (!ghostAction) return
    void run(ghostAction).then(res => { if (res) dispatch({ type: 'cancel' }) })
  }
  const startPlacing: StartPlacing = (what, size, from) => {
    // Show the island the thing belongs on: a move stays where it is, the Hoard is home-only, the Nexus Dawnspire-only.
    const island = from?.island ?? (what.kind === 'hoard' ? 'home' : what.kind === 'nexus' ? 'dawnspire' : view)
    // A new building opens on the free spot nearest the middle of the screen (the island's middle after a switch).
    const focus = island === view ? bridge.focusCell?.() : null
    const mid = focus ? { col: focus.col - Math.floor((size - 1) / 2), row: focus.row - Math.floor((size - 1) / 2) } : { col: 4, row: 4 }
    const cell = from ? undefined : nearestLegalCell(state, what, island, mid) ?? undefined
    setDialog(null)
    if (island !== view) bridge.setView(island)
    dispatch({ type: 'start', what, size, island, from, cell })
  }
  const startPvp = (offer: Offer, team: TeamIds) => { battle.startPvp(offer, team); setDialog(null) }
  const startPve = (stage: number, team: TeamIds) => { battle.startPve(stage, team); setDialog(null) }
  const closeBattle = () => { battle.reset(); bridge.setBattle(null) }

  const content = battle.setup
    ? { label: 'Battle', node: <BattlePanel battle={battle} onClose={closeBattle} />, onClose: closeBattle, modal: false }
    : verifySeason !== null
      ? { label: 'Verify season', node: <Verify seasonId={verifySeason} onClose={() => setVerifySeason(null)} />, onClose: () => setVerifySeason(null) }
      : dialog && !placing
        ? { label: dialogLabel(dialog), node: <PanelHost bridge={bridge} nowMs={nowMs} dialog={dialog} onOpen={setDialog} onPve={startPve} onPvp={startPvp} onVerify={id => { setVerifySeason(id); setDialog(null) }} />, onClose: close }
        : null

  return (
    <HudArtContext.Provider value={art.hud}>
      <StartPlacingProvider value={startPlacing}>
        <div className="game-root" data-testid="shell">
          <GameCanvas bridge={bridge} art={art} />
          <Hud
            battle={Boolean(battle.setup)}
            bridge={bridge}
            nowMs={nowMs}
            open={dialog}
            onOpen={setDialog}
            placing={placing !== null}
            bottom={placing ? (
              <PlacementBar legal={ghostAction !== null} pending={pending} onTurn={() => dispatch({ type: 'turn' })} onConfirm={confirmPlacing} onCancel={() => dispatch({ type: 'cancel' })} />
            ) : undefined}
          />
          {content && <Dialog label={content.label} onClose={content.onClose} modal={content.modal ?? true}>{content.node}</Dialog>}
          {me.data.termsRequired && <Dialog label="Updated terms" onClose={() => {}}><TermsPrompt version={me.data.termsRequired} /></Dialog>}
        </div>
      </StartPlacingProvider>
    </HudArtContext.Provider>
  )
}

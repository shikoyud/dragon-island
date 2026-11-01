import { TRIAL_CHAPTERS, type TeamIds } from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from './api/session'
import { loadActiveArt, FALLBACK_ART } from './art/slots'
import type { GameArtSet } from './art/types'
import { createBridge } from './game/bridge'
import { GameCanvas } from './game/GameCanvas'
import { Dialog } from './hud/Dialog'
import { Hud, isMapDialog, type DialogKey } from './hud/Hud'
import { LevelUp, useLevelUp } from './hud/LevelUp'
import { HudArtContext, hudArtOf } from './hud/Icon'
import { hudSkin } from './hud/skin'
import { Admin } from './pages/Admin'
import { BattlePanel } from './panels/BattlePanel'
import { dialogLabel, PanelHost, useDialog } from './panels/PanelHost'
import { PlacementBar } from './panels/PlacementBar'
import { useAutoFinish } from './panels/useAutoFinish'
import { useAction } from './state/actions'
import { useBattle } from './state/battle'
import { useGameClock } from './state/clock'
import { useMe, useRefreshOnNewDay } from './state/me'
import { placementIslands, placementStart, placingAction } from './state/placing'
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
  const nowMs = useGameClock(me.data?.game?.serverNowMs)
  const [dialog, setDialog] = useDialog(bridge)
  const battle = useBattle()
  const { placing, view, dispatch, moveToIsland } = usePlacing(bridge)
  const { run, pending } = useAction()
  useAutoFinish(nowMs)
  useRefreshOnNewDay(me.data?.game, nowMs)
  // Waits out placement and battles; a rise from any source (/me, an action reply) counts, and a returning player's stored level decides the first load.
  const levelUp = useLevelUp(me.data?.state.level, placing !== null || Boolean(battle.setup), me.data?.playerId)

  useEffect(() => { void loadActiveArt().then(setArt) }, [])
  const battleSetup = battle.setup
  const backdrop = battleSetup?.mode === 'pve' ? TRIAL_CHAPTERS[battleSetup.trial.chapter - 1]!.element : null
  useEffect(() => { bridge.setBattle(battle.preview, backdrop) }, [bridge, battle.preview, backdrop])
  useEffect(() => { if (battle.error) toasts.error(battle.error) }, [battle.error, toasts])
  useEffect(() => { if (me.error) toasts.error(me.error) }, [me.error, toasts])
  const levelUpOpen = levelUp !== null
  useEffect(() => { bridge.emit({ type: levelUpOpen ? 'levelUp' : 'levelUpClosed' }) }, [bridge, levelUpOpen])
  // A panel over the Map closes back to the Map; the Map closes to the island.
  const mapPanelOpen = dialog?.kind === 'target' && dialog.target.kind === 'mapIsland'
  const close = useCallback(() => setDialog(mapPanelOpen ? { kind: 'panel', id: 'map' } : null), [setDialog, mapPanelOpen])
  // The Map runs in place of the island (R60): never under placement or a battle, and any other dialog closes it.
  const mapShown = isMapDialog(dialog) && placing === null && !battle.setup
  useEffect(() => { bridge.setMapOpen(mapShown) }, [bridge, mapShown])
  // The bare Map has no Dialog to close it: Escape does it here. With an island panel open, the Dialog's Escape closes that first.
  const mapBare = mapShown && !mapPanelOpen && levelUp === null
  useEffect(() => {
    if (!mapBare) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDialog(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mapBare, setDialog])
  // A Trial's fight ends where it began, on its chapter's nodes. Stable, or a clock tick would render the battle screen.
  const resetBattle = battle.reset
  const closeBattle = useCallback(() => {
    resetBattle()
    bridge.setBattle(null)
    if (battleSetup?.mode === 'pve') setDialog({ kind: 'panel', id: 'battle', chapter: battleSetup.trial.chapter })
  }, [resetBattle, bridge, battleSetup, setDialog])
  const skin = useMemo(() => hudSkin(art.hud), [art])
  const hudArt = useMemo(() => hudArtOf(art), [art])
  // The Island buttons scan every unlocked island for room: only when the state, the thing being placed or the view changes.
  const stateNow = me.data?.state
  const placingWhat = placing?.what
  const islandChoices = useMemo(
    () => (stateNow && placingWhat ? placementIslands(stateNow, placingWhat, view) : []),
    [stateNow, placingWhat, view],
  )

  const signedIn = Boolean(session && me.data)
  if (!signedIn || !me.data) {
    return (
      <div className="game-root" data-testid="shell">
        <main className="welcome">
          <section className="panel welcome__card">
            <h1>Dragon Island</h1>
            <p>Breed dragons. Build your island. Battle for glory.</p>
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
    void run(ghostAction).then(res => { if (res) dispatch({ type: 'done' }) })
  }
  const startPlacing: StartPlacing = (what, size, from) => {
    // Show the island the thing belongs on: a move stays where it is, a new building goes where it has room.
    const { island, cell } = placementStart(state, what, size, view, bridge.focusCell?.(), from)
    setDialog(null)
    // Start first so Cancel knows the view to return to, then show the island it belongs on.
    dispatch({ type: 'start', what, size, island, from, cell })
    if (island !== view) bridge.setView(island)
  }
  const startPvp = (offer: Offer, team: TeamIds) => { battle.startPvp(offer, team); setDialog(null) }
  const startTrial = (chapter: number, node: number, team: TeamIds) => { void battle.startTrial(chapter, node, team).then(entered => { if (entered) setDialog(null) }) }
  const resumeTrial = () => { void battle.resumeTrial().then(entered => { if (entered) setDialog(null) }) }

  // Escape belongs to the level-up screen while it is up; the panel under it stays open.
  const underLevelUp = (fn: () => void) => (levelUp ? () => {} : fn)
  const content = !battle.setup && dialog && !placing && !(dialog.kind === 'panel' && dialog.id === 'map')
    ? { label: dialogLabel(dialog), node: <PanelHost bridge={bridge} nowMs={nowMs} dialog={dialog} onOpen={setDialog} fighting={battle.pending} onTrial={startTrial} onResumeTrial={resumeTrial} onPvp={startPvp} />, onClose: underLevelUp(close) }
    : null

  return (
    <HudArtContext.Provider value={hudArt}>
      <StartPlacingProvider value={startPlacing}>
        <div className={`game-root ${skin.className}`} style={skin.style} data-testid="shell">
          <GameCanvas bridge={bridge} art={art} nowMs={nowMs} />
          {/* The battle has the whole screen: on a phone the stage and its controls need every pixel, and it has no clock. */}
          {battle.setup ? <BattlePanel battle={battle} bridge={bridge} onClose={closeBattle} /> : (
            <Hud
              bridge={bridge}
              nowMs={nowMs}
              open={dialog}
              onOpen={setDialog}
              placing={placing !== null}
              bottom={placing ? (
                <PlacementBar legal={ghostAction !== null} pending={pending} islands={islandChoices} onIsland={island => moveToIsland(state, island)} onTurn={() => dispatch({ type: 'turn' })} onConfirm={confirmPlacing} onCancel={() => dispatch({ type: 'cancel' })} />
              ) : undefined}
            />
          )}
          {content && <Dialog label={content.label} onClose={content.onClose}>{content.node}</Dialog>}
          {levelUp && <LevelUp from={levelUp.from} to={levelUp.to} onClose={levelUp.dismiss} />}
          {me.data.termsRequired && <Dialog label="Updated terms" onClose={() => {}}><TermsPrompt version={me.data.termsRequired} /></Dialog>}
        </div>
      </StartPlacingProvider>
    </HudArtContext.Provider>
  )
}

import { DEFAULT_PRESET, ISLANDS, ownedPlots, type MovableRef, type PlayerState, type TeamIds } from '@wyrmhaven/game-core'
import type { GameInfo, Offer } from '@wyrmhaven/shared'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { Bridge, HomeFinder, Target } from '../game/bridge'
import { homesFor } from '../game/overlayModel'
import { useAction } from '../state/actions'
import { actionRow, sameTarget, selectionOf } from '../hud/actionRow'
import type { DialogKey } from '../hud/Hud'
import { useMe } from '../state/me'
import { useStartPlacing } from '../state/startPlacing'
import { BattleHub } from './BattleHub'
import { BreedPanel } from './BreedPanel'
import { DecorationPanel } from './DecorationPanel'
import { DragonPanel } from './DragonPanel'
import { DragonBookPanel } from './DragonBookPanel'
import { FarmPanel } from './FarmPanel'
import { HabitatPanel } from './HabitatPanel'
import { MapIslandPanel } from './MapIslandPanel'
import { HatcheryPanel } from './HatcheryPanel'
import { ObstaclePanel } from './ObstaclePanel'
import { PlotPanel } from './PlotPanel'
import { QuestsPanel } from './QuestsPanel'
import { RoostPanel } from './RoostPanel'
import { SettingsPanel } from './SettingsPanel'
import { ShopPanel } from './ShopPanel'
import { InfoDialog } from './InfoDialog'
import { UpgradeDialog } from './UpgradeDialog'

/**
 * True while the dialog's panel has something to show: what it is about still exists (an obstacle not yet cleared, a dragon
 * not sold, a plot not yet bought). Its answers match the `return null`s in the panels; test/dialogSubject.test.tsx pins that.
 */
export function dialogHasSubject(s: PlayerState, dialog: DialogKey, game: Pick<GameInfo, 'launchAtMs'> | undefined): boolean {
  if (dialog.kind === 'info' || dialog.kind === 'upgrade') return movableExists(s, dialog.target)
  if (dialog.kind === 'panel') {
    if (dialog.id === 'breed') return game !== undefined
    return dialog.id !== 'wings' && dialog.id !== 'inbox' // not built until a later milestone
  }
  const t = dialog.target
  switch (t.kind) {
    case 'habitat': return s.habitats.some(h => h.id === t.id)
    case 'dragon': return s.dragons.some(d => d.id === t.id)
    case 'decoration': return s.decorations.some(d => d.id === t.id)
    case 'obstacle': return s.islands.obstacles.some(o => o.id === t.id)
    case 'farm': return s.farms[t.plot] !== undefined
    case 'roost': return s.roostPlacement !== null
    case 'plot': return !ownedPlots(s, t.island).includes(t.plot)
    case 'breeder': return game !== undefined
    case 'hatchery':
    case 'hatcheryBuilding':
    case 'mapIsland': return true
    case 'cell':
    case 'empty': return false
  }
}

function movableExists(s: PlayerState, t: MovableRef): boolean {
  switch (t.type) {
    case 'habitat': return s.habitats.some(h => h.id === t.id && !h.stored)
    case 'farm': return s.farms[t.index] !== undefined && !s.farms[t.index]!.stored
    case 'breeder': return s.breeders[t.index] !== undefined && !s.breeders[t.index]!.stored
    case 'hatchery': return true
    case 'roost': return s.roostPlacement !== null && !s.roostStored
    case 'decoration': return s.decorations.some(d => d.id === t.id && !d.stored)
  }
}

/** The selected thing on the island, the open home finder, and their setters; see `useDialog`. */
export interface Selection {
  selected: Target | null
  setSelected: (t: Target | null) => void
  /** The waiting dragon whose home is being chosen (ruling A5), with the habitats it fits; null when none is. */
  finding: HomeFinder | null
  setFinding: (dragonId: string | null) => void
}

/**
 * The one open dialog, and the one selected thing. A tap on a building, habitat, farm, Hatchery, breeder or obstacle
 * selects it (UI rework ruling A1: its action row shows, no dialog); the same tap again, empty land or a cell deselects.
 * Anything else tapped (a plot for sale, a waiting dragon, an island on the Map) opens its panel as before. When what a
 * dialog is about goes away while it is open (a clear finishes, a dragon is sold) the dialog closes, and a selection
 * whose thing is gone clears: no empty box, scrim or row stays.
 */
export function useDialog(bridge: Bridge, initial: DialogKey | null = null): [DialogKey | null, (k: DialogKey | null) => void, Selection] {
  const [dialog, setDialog] = useState<DialogKey | null>(initial)
  const [selected, setSelected] = useState<Target | null>(null)
  const [findingId, setFinding] = useState<string | null>(null)
  const me = useMe().data
  const { run } = useAction()
  const state = useRef<PlayerState | undefined>(undefined)
  state.current = me?.state
  // The habitats are worked out from the live state, so a slot filling or a habitat sold updates the outlines.
  const homes = findingId && me ? homesFor(me.state, findingId) : []
  const finding = findingId && homes.length > 0 ? { dragonId: findingId, homes } : null
  const findingRef = useRef(finding)
  findingRef.current = finding
  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => { if (findingId && !finding) setFinding(null) }, [findingId, finding])
  useEffect(() => { bridge.setHomeFinder(finding) }, [bridge, finding])
  useEffect(() => bridge.on('select', e => {
    const t = e.target
    // Choosing a home: a tap on an outlined habitat (or a dragon in it) moves the dragon there; every other tap does nothing.
    const f = findingRef.current
    if (f) {
      const home = t.kind === 'habitat' ? t.id : t.kind === 'dragon' ? state.current?.dragons.find(d => d.id === t.id)?.habitatId ?? null : null
      if (home && f.homes.includes(home)) {
        setFinding(null)
        void runRef.current({ type: 'moveDragon', dragonId: f.dragonId, habitatId: home })
      }
      return
    }
    // A dragon waiting in the Hatchery with somewhere to go opens the home finder; with nowhere, its panel as before.
    if (t.kind === 'dragon' && state.current && homesFor(state.current, t.id).length > 0) {
      setDialog(null)
      setSelected(null)
      setFinding(t.id)
      return
    }
    if (t.kind === 'empty' || t.kind === 'cell') {
      setDialog(null)
      setSelected(null)
      return
    }
    const sel = selectionOf(state.current, t)
    if (sel) {
      setDialog(null)
      setSelected(cur => (sameTarget(cur, sel) ? null : sel))
      return
    }
    setSelected(null)
    setDialog({ kind: 'target', target: t })
  }), [bridge])
  const gone = dialog !== null && me !== undefined && !dialogHasSubject(me.state, dialog, me.game)
  useEffect(() => { if (gone) setDialog(null) }, [gone])
  const selectedGone = selected !== null && me !== undefined && actionRow(me.state, selected, 0, DEFAULT_PRESET) === null
  useEffect(() => { if (selectedGone) setSelected(null) }, [selectedGone])
  const shown = selectedGone ? null : selected
  useEffect(() => { bridge.setSelection(finding ? null : shown) }, [bridge, shown, finding])
  return [gone ? null : dialog, setDialog, { selected: finding ? null : shown, setSelected, finding, setFinding }]
}

export interface PanelHostProps {
  bridge: Bridge
  nowMs: number
  dialog: DialogKey | null
  onOpen: (k: DialogKey | null) => void
  onTrial?: (chapter: number, node: number, team: TeamIds) => void
  /** The battle hook's pending: a Trial is starting. */
  fighting?: boolean
  onResumeTrial?: () => void
  onPvp?: (offer: Offer, team: TeamIds) => void
}

/** The panel for the open dialog (a named HUD panel or a clicked island object), or null. */
export function PanelHost({ bridge, nowMs, dialog, onOpen, fighting, onTrial = () => {}, onResumeTrial = () => {}, onPvp = () => {} }: PanelHostProps): ReactElement | null {
  const startPlacing = useStartPlacing()
  const game = useMe().data?.game
  const close = () => onOpen(null)
  if (!dialog) return null
  if (dialog.kind === 'panel') {
    switch (dialog.id) {
      case 'shop': return <ShopPanel key={dialog.tab ?? 'build'} tab={dialog.tab === 'store' ? 'store' : 'build'} nowMs={nowMs} view={bridge.view} onPlace={(what, size) => { onOpen(null); startPlacing(what, size) }} onClose={close} />
      case 'map': return null // the Map is a scene (R60), not a dialog; its islands open panels
      case 'breed': return <BreedPanel nowMs={nowMs} onClose={close} />
      case 'book': return <DragonBookPanel art={bridge.art} onSelect={id => onOpen({ kind: 'target', target: { kind: 'dragon', id } })} onClose={close} />
      case 'battle': return <BattleHub nowMs={nowMs} chapter={dialog.chapter} fighting={fighting} onShop={() => onOpen({ kind: 'panel', id: 'shop', tab: 'build' })} onTrial={onTrial} onResume={onResumeTrial} onPvp={onPvp} onClose={close} />
      case 'quests': return <QuestsPanel onClose={close} onOpen={onOpen} />
      case 'wings':
      case 'inbox': return null // not built until a later milestone; the bar buttons are disabled
      case 'settings': return <SettingsPanel onClose={close} nowMs={nowMs} game={game} tab={dialog.tab === 'wallet' ? 'wallet' : 'account'} />
    }
  }
  if (dialog.kind === 'info') {
    const r = dialog.target
    switch (r.type) {
      case 'habitat': return <HabitatPanel habitatId={r.id} nowMs={nowMs} onClose={close} />
      case 'decoration': return <DecorationPanel decorationId={r.id} onClose={close} />
      // The Hatchery's Info is its nest: the eggs and their timers.
      case 'hatchery': return <HatcheryPanel nowMs={nowMs} onClose={close} onOpenDragon={id => onOpen({ kind: 'target', target: { kind: 'dragon', id } })} />
      default: return <InfoDialog target={r} nowMs={nowMs} onClose={close} />
    }
  }
  if (dialog.kind === 'upgrade') {
    return dialog.target.type === 'roost'
      ? <RoostPanel nowMs={nowMs} onClose={close} />
      : <UpgradeDialog building={dialog.target} nowMs={nowMs} onClose={close} />
  }
  const t = dialog.target
  switch (t.kind) {
    case 'habitat': return <HabitatPanel habitatId={t.id} nowMs={nowMs} onClose={close} onOpenDragon={id => onOpen({ kind: 'target', target: { kind: 'dragon', id } })} />
    case 'dragon': return <DragonPanel dragonId={t.id} onClose={close} onOpen={onOpen} />
    case 'decoration': return <DecorationPanel decorationId={t.id} onClose={close} />
    case 'breeder': return <BreedPanel nowMs={nowMs} onClose={close} />
    case 'hatchery':
    case 'hatcheryBuilding': return <HatcheryPanel nowMs={nowMs} onClose={close} onOpenDragon={id => onOpen({ kind: 'target', target: { kind: 'dragon', id } })} />
    case 'roost': return <RoostPanel nowMs={nowMs} onClose={close} />
    case 'farm': return <FarmPanel index={t.plot} nowMs={nowMs} onClose={close} />
    case 'obstacle': return <ObstaclePanel obstacleId={t.id} nowMs={nowMs} onClose={close} />
    case 'mapIsland': return <MapIslandPanel island={t.id} view={bridge.view} onView={id => { bridge.setView(id); close() }} onClose={() => onOpen({ kind: 'panel', id: 'map' })} art={bridge.art} />
    case 'plot': return <PlotPanel key={`${t.island}:${t.plot}`} island={t.island} plot={t.plot} onClose={close} />
    default: return null
  }
}

/** Accessible name of the dialog around a panel. */
export function dialogLabel(dialog: DialogKey): string {
  if (dialog.kind === 'panel') return dialog.id === 'book' ? 'Dragon Book' : dialog.id === 'quests' ? 'Goals' : dialog.id.charAt(0).toUpperCase() + dialog.id.slice(1)
  if (dialog.kind === 'info') return 'Info'
  if (dialog.kind === 'upgrade') return 'Upgrade'
  return dialog.target.kind === 'mapIsland' ? ISLANDS[dialog.target.id].name : dialog.target.kind
}

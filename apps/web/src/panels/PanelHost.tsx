import { ISLANDS, ownedPlots, type PlayerState, type TeamIds } from '@wyrmhaven/game-core'
import type { GameInfo, Offer } from '@wyrmhaven/shared'
import { useEffect, useState, type ReactElement } from 'react'
import type { Bridge } from '../game/bridge'
import type { DialogKey } from '../hud/Hud'
import { useMe } from '../state/me'
import { useStartPlacing } from '../state/startPlacing'
import { SignIn } from '../wallet/SignIn'
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
import { ShopPanel } from './ShopPanel'
import { SpeedUpsRow } from './SpeedUpsRow'
import { WalletPanel } from './WalletPanel'

/**
 * True while the dialog's panel has something to show: what it is about still exists (an obstacle not yet cleared, a dragon
 * not sold, a plot not yet bought). Its answers match the `return null`s in the panels; test/dialogSubject.test.tsx pins that.
 */
export function dialogHasSubject(s: PlayerState, dialog: DialogKey, game: Pick<GameInfo, 'launchAtMs'> | undefined): boolean {
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

/**
 * The one open dialog; a click on something in the island scene opens its panel (replacing what was open). When what it
 * is about goes away while it is open (a clear finishes, a dragon is sold) the dialog closes: no empty box or scrim stays.
 */
export function useDialog(bridge: Bridge, initial: DialogKey | null = null): [DialogKey | null, (k: DialogKey | null) => void] {
  const [dialog, setDialog] = useState<DialogKey | null>(initial)
  const me = useMe().data
  useEffect(() => bridge.on('select', e => setDialog(e.target.kind === 'empty' || e.target.kind === 'cell' ? null : { kind: 'target', target: e.target })), [bridge])
  const gone = dialog !== null && me !== undefined && !dialogHasSubject(me.state, dialog, me.game)
  useEffect(() => { if (gone) setDialog(null) }, [gone])
  return [gone ? null : dialog, setDialog]
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
  const close = () => onOpen(null)
  if (!dialog) return null
  if (dialog.kind === 'panel') {
    switch (dialog.id) {
      case 'shop': return <ShopPanel key={dialog.tab ?? 'build'} tab={dialog.tab} nowMs={nowMs} view={bridge.view} onPlace={(what, size) => { onOpen(null); startPlacing(what, size) }} onClose={close} />
      case 'map': return null // the Map is a scene (R60), not a dialog; its islands open panels
      case 'breed': return <BreedPanel nowMs={nowMs} onClose={close} />
      case 'book': return <DragonBookPanel art={bridge.art} onSelect={id => onOpen({ kind: 'target', target: { kind: 'dragon', id } })} onClose={close} />
      case 'battle': return <BattleHub nowMs={nowMs} chapter={dialog.chapter} fighting={fighting} onShop={() => onOpen({ kind: 'panel', id: 'shop', tab: 'build' })} onTrial={onTrial} onResume={onResumeTrial} onPvp={onPvp} onClose={close} />
      case 'quests': return <QuestsPanel onClose={close} onOpen={onOpen} />
      case 'wings':
      case 'inbox': return null // not built until a later milestone; the bar buttons are disabled
      case 'settings': return <div className="settings-dialog"><WalletPanel onClose={close} /><SpeedUpsRow /><div className="settings-dialog__account"><SignIn /></div></div>
    }
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
  if (dialog.kind === 'panel') return dialog.id === 'book' ? 'Dragon Book' : dialog.id.charAt(0).toUpperCase() + dialog.id.slice(1)
  return dialog.target.kind === 'mapIsland' ? ISLANDS[dialog.target.id].name : dialog.target.kind
}

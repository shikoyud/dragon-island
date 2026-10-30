import type { TeamIds } from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { useEffect, useState, type ReactElement } from 'react'
import type { Bridge } from '../game/bridge'
import type { DialogKey } from '../hud/Hud'
import { useStartPlacing } from '../state/startPlacing'
import { SignIn } from '../wallet/SignIn'
import { BattleHub } from './BattleHub'
import { BreedPanel } from './BreedPanel'
import { DecorationPanel } from './DecorationPanel'
import { DragonPanel } from './DragonPanel'
import { DragonsPanel } from './DragonsPanel'
import { ExpandSignPanel } from './ExpandSignPanel'
import { FarmPanel } from './FarmPanel'
import { HabitatPanel } from './HabitatPanel'
import { IslandMapPanel } from './IslandMapPanel'
import { NestsPanel } from './NestsPanel'
import { ObstaclePanel } from './ObstaclePanel'
import { ShopPanel } from './ShopPanel'
import { WalletPanel } from './WalletPanel'

/** The one open dialog; a click on something in the island scene opens its panel (replacing what was open). */
export function useDialog(bridge: Bridge, initial: DialogKey | null = null): [DialogKey | null, (k: DialogKey | null) => void] {
  const [dialog, setDialog] = useState<DialogKey | null>(initial)
  useEffect(() => bridge.on('select', e => setDialog(e.target.kind === 'empty' || e.target.kind === 'cell' ? null : { kind: 'target', target: e.target })), [bridge])
  return [dialog, setDialog]
}

export interface PanelHostProps {
  bridge: Bridge
  nowMs: number
  dialog: DialogKey | null
  onOpen: (k: DialogKey | null) => void
  onPve?: (stage: number, team: TeamIds) => void
  onPvp?: (offer: Offer, team: TeamIds) => void
}

/** The panel for the open dialog (a named HUD panel or a clicked island object), or null. */
export function PanelHost({ bridge, nowMs, dialog, onOpen, onPve = () => {}, onPvp = () => {} }: PanelHostProps): ReactElement | null {
  const startPlacing = useStartPlacing()
  const close = () => onOpen(null)
  if (!dialog) return null
  if (dialog.kind === 'panel') {
    switch (dialog.id) {
      case 'shop': return <ShopPanel key={dialog.tab ?? 'build'} tab={dialog.tab} nowMs={nowMs} view={bridge.view} onPlace={(what, size) => { onOpen(null); startPlacing(what, size) }} onClose={close} />
      case 'map': return <IslandMapPanel view={bridge.view} onView={id => { bridge.setView(id); close() }} onClose={close} art={bridge.art} />
      case 'breed': return <BreedPanel onClose={close} />
      case 'book': return <DragonsPanel onSelect={id => onOpen({ kind: 'target', target: { kind: 'dragon', id } })} onClose={close} />
      case 'battle': return <BattleHub nowMs={nowMs} onPve={onPve} onPvp={onPvp} onClose={close} />
      case 'wings':
      case 'quests':
      case 'inbox': return null // not built until a later milestone; the bar buttons are disabled
      case 'settings': return <div className="settings-dialog"><WalletPanel onClose={close} /><div className="settings-dialog__account"><SignIn /></div></div>
    }
  }
  const t = dialog.target
  switch (t.kind) {
    case 'habitat': return <HabitatPanel habitatId={t.id} nowMs={nowMs} onClose={close} onOpenDragon={id => onOpen({ kind: 'target', target: { kind: 'dragon', id } })} />
    case 'dragon': return <DragonPanel dragonId={t.id} onClose={close} />
    case 'decoration': return <DecorationPanel decorationId={t.id} onClose={close} />
    case 'breeder':
    case 'hatchery':
    case 'hatcheryBuilding': return <NestsPanel nowMs={nowMs} onClose={close} />
    case 'farm': return <FarmPanel index={t.plot} nowMs={nowMs} onClose={close} />
    case 'obstacle': return <ObstaclePanel obstacleId={t.id} nowMs={nowMs} onClose={close} />
    case 'expandSign': return <ExpandSignPanel onClose={close} />
    default: return null
  }
}

/** Accessible name of the dialog around a panel. */
export function dialogLabel(dialog: DialogKey): string {
  if (dialog.kind === 'panel') return dialog.id === 'book' ? 'Dragon Book' : dialog.id.charAt(0).toUpperCase() + dialog.id.slice(1)
  return dialog.target.kind
}

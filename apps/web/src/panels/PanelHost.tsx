import { useEffect, useState } from 'react'
import type { IslandId } from '@wyrmhaven/game-core'
import type { Bridge, Target } from '../game/bridge'
import { useStartPlacing } from '../state/startPlacing'
import { BreedPanel } from './BreedPanel'
import { BuildShopPanel } from './BuildShopPanel'
import { DecorationPanel } from './DecorationPanel'
import { DragonPanel } from './DragonPanel'
import { ExpandSignPanel } from './ExpandSignPanel'
import { FarmPanel } from './FarmPanel'
import { HabitatPanel } from './HabitatPanel'
import { HoardPanel } from './HoardPanel'
import { IslandMapPanel } from './IslandMapPanel'
import { NestsPanel } from './NestsPanel'
import { ObstaclePanel } from './ObstaclePanel'
import { StorePanel } from './StorePanel'

export type PanelId = 'build' | 'map' | 'breed' | 'store' | 'nests' | 'farm' | 'wallet' | 'pvp' | 'pve' | 'season' | 'hoard' | 'referral'

/** Opens the panel for whatever the player clicked in the scene, or a named panel from the toolbar. */
export function PanelHost({ bridge, nowMs, named, onCloseNamed }: { bridge: Bridge; nowMs: number; named: PanelId | null; onCloseNamed: () => void }) {
  const [target, setTarget] = useState<Target>({ kind: 'empty' })
  useEffect(() => bridge.on('select', e => setTarget(e.target)), [bridge])
  const close = () => setTarget({ kind: 'empty' })
  const [view, setView] = useState<IslandId>(bridge.view)
  useEffect(() => bridge.on('view', e => setView(e.view)), [bridge])
  const startPlacing = useStartPlacing()

  if (named === 'build') return <BuildShopPanel view={view} onPlace={(what, size) => { startPlacing(what, size); onCloseNamed() }} onClose={onCloseNamed} />
  if (named === 'map') return <IslandMapPanel view={view} onView={id => bridge.setView(id)} onClose={onCloseNamed} art={bridge.art} />
  if (named === 'breed') return <BreedPanel onClose={onCloseNamed} />
  if (named === 'store') return <StorePanel nowMs={nowMs} onClose={onCloseNamed} />
  if (named === 'nests') return <NestsPanel nowMs={nowMs} onClose={onCloseNamed} />
  if (named === 'farm') return <FarmPanel nowMs={nowMs} onClose={onCloseNamed} />

  switch (target.kind) {
    case 'habitat': return <HabitatPanel habitatId={target.id} nowMs={nowMs} onClose={close} />
    case 'dragon': return <DragonPanel dragonId={target.id} onClose={close} />
    case 'decoration': return <DecorationPanel decorationId={target.id} onClose={close} />
    case 'nest':
    case 'hatchery':
    case 'hatcheryBuilding': return <NestsPanel nowMs={nowMs} onClose={close} />
    case 'farm': return <FarmPanel nowMs={nowMs} onClose={close} />
    case 'obstacle': return <ObstaclePanel obstacleId={target.id} nowMs={nowMs} onClose={close} />
    case 'expandSign': return <ExpandSignPanel onClose={close} />
    case 'hoard': return <HoardPanel nowMs={nowMs} onClose={close} />
    case 'empty':
    default:
      return null
  }
}

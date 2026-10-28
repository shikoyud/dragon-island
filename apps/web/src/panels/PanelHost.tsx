import { useEffect, useState } from 'react'
import type { Bridge, Target } from '../game/bridge'
import { BreedPanel } from './BreedPanel'
import { DragonPanel } from './DragonPanel'
import { FarmPanel } from './FarmPanel'
import { HabitatPanel } from './HabitatPanel'
import { NestsPanel } from './NestsPanel'
import { StorePanel } from './StorePanel'

export type PanelId = 'breed' | 'store' | 'nests' | 'farm' | 'wallet' | 'pvp' | 'pve' | 'season' | 'hoard'

/** Opens the panel for whatever the player clicked in the scene, or a named panel from the toolbar. */
export function PanelHost({ bridge, nowMs, named, onCloseNamed }: { bridge: Bridge; nowMs: number; named: PanelId | null; onCloseNamed: () => void }) {
  const [target, setTarget] = useState<Target>({ kind: 'empty' })
  useEffect(() => bridge.on('select', e => setTarget(e.target)), [bridge])
  const close = () => setTarget({ kind: 'empty' })

  if (named === 'breed') return <BreedPanel onClose={onCloseNamed} />
  if (named === 'store') return <StorePanel nowMs={nowMs} onClose={onCloseNamed} />
  if (named === 'nests') return <NestsPanel nowMs={nowMs} onClose={onCloseNamed} />
  if (named === 'farm') return <FarmPanel nowMs={nowMs} onClose={onCloseNamed} />

  switch (target.kind) {
    case 'habitat': return <HabitatPanel habitatId={target.id} nowMs={nowMs} onClose={close} />
    case 'dragon': return <DragonPanel dragonId={target.id} onClose={close} />
    case 'nest':
    case 'hatchery': return <NestsPanel nowMs={nowMs} onClose={close} />
    case 'farm': return <FarmPanel nowMs={nowMs} onClose={close} />
    case 'hoard':
    case 'empty':
    default:
      return null
  }
}

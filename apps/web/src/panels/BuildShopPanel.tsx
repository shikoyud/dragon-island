import {
  DECORATIONS, ELEMENTS, FOOTPRINT, HABITATS, FARM_UNLOCK_PL, farmBuildGold, MAX_FARMS,
  type DecorationId, type Footprint, type IslandId, type PlayerState,
} from '@wyrmhaven/game-core'
import type { ReactNode } from 'react'
import type { Placing } from '../game/bridge'
import { useMe } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
/** "flowerPatch" -> "Flower patch". */
const decorationName = (id: DecorationId) => cap(id.replace(/([A-Z])/g, ' $1').toLowerCase())
const DAWNSPIRE_ONLY = 'Dawnspire only'

/** Gold-and-token shop for everything that goes on the grid (spec section 8). Cards start placement. */
export function BuildShopPanel({ onPlace, view, onClose }: { onPlace: (what: Placing['what'], size: Footprint) => void; view: IslandId; onClose?: () => void }) {
  const me = useMe()
  const s = me.data?.state
  if (!s) return null
  return <Shop s={s} onPlace={onPlace} view={view} onClose={onClose} />
}

function Shop({ s, onPlace, view, onClose }: { s: PlayerState; onPlace: (what: Placing['what'], size: Footprint) => void; view: IslandId; onClose?: () => void }) {
  const card = (id: string, label: string, price: string, reason: string | undefined, what: Placing['what'], size: Footprint) => (
    <li key={id}>
      <ActionButton id={`shop-${id}`} disabled={Boolean(reason)} reason={reason} onClick={() => onPlace(what, size)}>
        {label} · {price}
      </ActionButton>
    </li>
  )
  const section = (key: string, title: string, items: ReactNode) => (
    <section data-testid={`shop-${key}`} style={{ marginBottom: 10 }}>
      <h3 style={{ fontSize: 12 }}>{title}</h3>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>{items}</ul>
    </section>
  )
  const gold = (cost: number, minLevel: number, other?: string) =>
    s.level < minLevel ? `Level ${minLevel}` : other ?? (s.gold < cost ? 'Not enough gold' : undefined)

  const plots = s.farms.length
  return (
    <Panel title="Build" onClose={onClose}>
      {section('habitats', 'Habitats', <>
        {ELEMENTS.map(el => {
          const { buildGold, unlockPl } = HABITATS[el]
          return card(`habitat-${el}`, `${cap(el)} habitat`, `${formatGold(buildGold)} gold`,
            gold(buildGold, unlockPl), { kind: 'habitat', element: el }, FOOTPRINT.habitat)
        })}
      </>)}
      {section('farming', 'Farming', card('farm', 'Farm plot', plots >= MAX_FARMS ? 'maximum' : `${formatGold(farmBuildGold(plots + 1))} gold`,
        plots >= MAX_FARMS ? 'Maximum plots reached' : gold(farmBuildGold(plots + 1), FARM_UNLOCK_PL[plots]!), { kind: 'farm' }, FOOTPRINT.farm))}
      {section('decorations', 'Decorations', (Object.keys(DECORATIONS) as DecorationId[]).map(id => {
        const d = DECORATIONS[id]
        // Locked items stay visible, greyed (spec section 8): Dawnspire-only ones say so off the Dawnspire.
        const reason = d.island && d.island !== view ? DAWNSPIRE_ONLY : gold(d.cost, d.minLevel)
        return card(`deco-${id}`, decorationName(id), `${formatGold(d.cost)} gold`, reason, { kind: 'decoration', decoration: id }, d.size)
      }))}
    </Panel>
  )
}

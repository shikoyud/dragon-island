import {
  DECORATIONS, ELEMENTS, FOOTPRINT, habitatBuildCost, HOARD_MIN_PLAYER_LEVEL, MAX_NESTS, MAX_PLOTS, maxHabitats, NEXUS_COST,
  outerIslandsUnlocked, plotCost, priceMicroUsd, type DecorationId, type Footprint, type IslandId, type PlayerState,
} from '@wyrmhaven/game-core'
import type { ReactNode } from 'react'
import type { Placing } from '../game/bridge'
import { useMe } from '../state/me'
import { formatGold, formatMicroUsd } from '../ui/Money'
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
  const owned = s.habitats.filter(h => h.element !== 'any').length
  const atLimit = owned >= maxHabitats(s.level, outerIslandsUnlocked(s))
  const nextMultiple = (Math.floor(s.level / 5) + 1) * 5
  const nexusOwned = s.habitats.some(h => h.element === 'any')
  const dummy = { island: 'home' as const, col: 0, row: 0, facing: 0 as const }
  const nestPrice = priceMicroUsd({ kind: 'nest', placement: dummy }, s, 0)
  const hoardPrice = priceMicroUsd({ kind: 'hoard' }, s, 0)

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
          const cost = habitatBuildCost(s, el)
          return card(`habitat-${el}`, `${cap(el)} habitat`, `${formatGold(cost)} gold`,
            atLimit ? `Reach level ${nextMultiple} for another habitat` : gold(cost, 1), { kind: 'habitat', element: el }, FOOTPRINT.habitat)
        })}
        {card('nexus', 'Nexus habitat', `${formatGold(NEXUS_COST)} gold`,
          view !== 'dawnspire' ? DAWNSPIRE_ONLY : nexusOwned ? 'You already have the Nexus habitat.' : gold(NEXUS_COST, 1), { kind: 'nexus' }, FOOTPRINT.habitat)}
      </>)}
      {section('farming', 'Farming', card('farm', 'Farm plot', plots >= MAX_PLOTS ? 'maximum' : `${formatGold(plotCost(plots))} gold`,
        plots >= MAX_PLOTS ? 'Maximum plots reached' : gold(plotCost(plots), 1), { kind: 'farm' }, FOOTPRINT.farm))}
      {section('breeding', 'Breeding', card('nest', 'Nest', nestPrice === null ? 'maximum' : formatMicroUsd(nestPrice),
        s.nests.length >= MAX_NESTS ? 'Maximum nests reached' : undefined, { kind: 'nest' }, FOOTPRINT.nest))}
      {section('hoard', 'Hoard', card('hoard', 'Hoard', hoardPrice === null ? 'unavailable' : formatMicroUsd(hoardPrice),
        s.level < HOARD_MIN_PLAYER_LEVEL ? `Level ${HOARD_MIN_PLAYER_LEVEL}`
          : s.hoardLevel > 0 ? 'Already built. Upgrade it in the Hoard panel.'
          : view !== 'home' ? 'The Hoard goes on the home island' : undefined, { kind: 'hoard' }, FOOTPRINT.hoard))}
      {section('decorations', 'Decorations', (Object.keys(DECORATIONS) as DecorationId[]).map(id => {
        const d = DECORATIONS[id]
        // Locked items stay visible, greyed (spec section 8): Dawnspire-only ones say so off the Dawnspire.
        const reason = d.island && d.island !== view ? DAWNSPIRE_ONLY : gold(d.cost, d.minLevel)
        return card(`deco-${id}`, decorationName(id), `${formatGold(d.cost)} gold`, reason, { kind: 'decoration', decoration: id }, d.size)
      }))}
    </Panel>
  )
}

import type { Footprint, MovableRef } from '@wyrmhaven/game-core'
import { useState } from 'react'
import { buildingSprite, dragonLook, eggLook } from '../game/islandModel'
import { Icon } from '../hud/Icon'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { SpriteStill, useGameArt } from '../ui/GameArt'
import { PillButton } from '../ui/kit/buttons'
import { FullScreenFrame } from '../ui/kit/frames'
import { KitCard } from '../ui/kit/pieces'
import { ActionButton } from '../ui/Panel'
import { storageItems, type StorageFilter, type StorageItem } from './storageModel'

const FILTERS: readonly { id: StorageFilter | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'dragons', label: 'Dragons' }, { id: 'eggs', label: 'Eggs' }, { id: 'buildings', label: 'Buildings' }, { id: 'items', label: 'Items' },
]

/**
 * Storage (design, Phase 5: storage; shiko 2026-11-01): plank "Storage" with the count, a search bar and Go to shop on
 * top, the Type filter panel left, the cards right with Use and Sell. Use puts a building back with the Move placement
 * (free, rule 5), an egg back in the Hatchery, and finds a dragon a home; tokens are only listed (ruling S6).
 */
export function StoragePanel({ onPlace, onHome, onShop, onClose }: {
  onPlace: (target: MovableRef, size: Footprint) => void
  onHome: (dragonId: string) => void
  onShop: () => void
  onClose?: () => void
}) {
  const me = useMe()
  const art = useGameArt()
  const { run, pending } = useAction()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StorageFilter | 'all'>('all')
  const [selling, setSelling] = useState<string | null>(null)
  const s = me.data?.state
  if (!s) return null
  const items = storageItems(s)
  const q = query.trim().toLowerCase()
  const shown = items.filter(i => (filter === 'all' || i.filter === filter) && (!q || i.name.toLowerCase().includes(q)))
  const artOf = (i: StorageItem) =>
    i.kind === 'dragon' ? <SpriteStill sprite={dragonLook(i.speciesId!, i.level ?? 1, art).sprite} height={72} />
      : i.kind === 'egg' ? <SpriteStill sprite={eggLook(i.speciesId!, art).sprite} height={56} />
        : i.kind === 'building' ? <SpriteStill sprite={buildingSprite(s, art, i.target!)} height={72} />
          : <Icon name="speedUp" size={48} />
  const idOf = (i: StorageItem) => i.key.replace(/[^a-z0-9]+/gi, '-')
  const use = (i: StorageItem) => {
    const u = i.use
    if (!u) return
    if (u.kind === 'place') onPlace(u.target, u.size)
    else if (u.kind === 'home') onHome(u.dragonId)
    else void run(u.action)
  }
  return (
    <FullScreenFrame title="Storage" badge={`${items.length}`} backdrop="wood" onClose={onClose}>
      <div className="storage-top">
        <input type="search" className="storage-search" aria-label="Search" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
        <PillButton color="green" onClick={onShop}>Go to shop</PillButton>
      </div>
      <div className="storage-grid">
        <div className="storage-filter" role="group" aria-label="Type">
          {FILTERS.map(f => (
            <button key={f.id} type="button" className="storage-filter__btn" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        {items.length === 0 ? (
          <div className="storage-empty">
            <p>Storage is empty</p>
            <small>Store a building, dragon or egg from its Info.</small>
          </div>
        ) : (
          <ul className="storage-list">
            {shown.map(i => (
              <li key={i.key}>
                <KitCard title={i.name} rarity={i.rarity} art={artOf(i)} footer={selling === i.key && i.sell ? (
                  <>
                    <ActionButton id={`storage-sell-confirm-${idOf(i)}`} danger disabled={pending} onClick={() => void run(i.sell!).then(() => setSelling(null))}>Confirm sell</ActionButton>
                    <ActionButton id={`storage-keep-${idOf(i)}`} onClick={() => setSelling(null)}>Keep it</ActionButton>
                  </>
                ) : (
                  <>
                    {i.use && <ActionButton id={`storage-use-${idOf(i)}`} primary disabled={pending} onClick={() => use(i)}>Use</ActionButton>}
                    {i.sell && <ActionButton id={`storage-sell-${idOf(i)}`} disabled={pending} onClick={() => setSelling(i.key)}>Sell</ActionButton>}
                    {!i.use && !i.sell && <small>{`×${i.count ?? 1} · use it from a timer's Speed Up`}</small>}
                  </>
                )} />
              </li>
            ))}
            {shown.length === 0 && <li className="shop-empty">Nothing matches</li>}
          </ul>
        )}
      </div>
    </FullScreenFrame>
  )
}

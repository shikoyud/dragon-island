import { ELEMENTS, LAUNCH_CATALOG, RARITIES, type Element, type Rarity, type Species } from '@wyrmhaven/game-core'
import { useState } from 'react'
import type { GameArtSet } from '../art/types'
import { dragonLook } from '../game/islandModel'
import { usePreset } from '../state/preset'
import { useMe } from '../state/me'
import { FullScreenFrame } from '../ui/kit/frames'
import { ElementRibbon, RarityShield } from '../ui/kit/pieces'
import { bookHint, elementName } from './bookHints'
import { DragonsPanel } from './DragonsPanel'

const TILE = 64
/** One width for every tile, found or not: the longest names wrap instead of widening theirs. */
const TILE_WIDTH = 150
const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }
type Order = 'number' | 'name' | 'found'
const ORDER_LABEL: Record<Order, string> = { number: 'Order by number', name: 'Order by name', found: 'Found first' }

/** First frame of the species' sheet at a fixed size. Decorative: it never carries the species name (R22). */
function Silhouette({ sp, art, found }: { sp: Species; art?: GameArtSet | null; found: boolean }) {
  const sprite = art ? dragonLook(sp.id, 10, art, LAUNCH_CATALOG).sprite : null
  const style = {
    width: TILE, height: TILE, imageRendering: 'pixelated' as const, display: 'block',
    ...(sprite?.src ? { backgroundImage: `url("${sprite.src}")`, backgroundSize: `${TILE * sprite.frames}px ${TILE}px`, backgroundPosition: '0 0', backgroundRepeat: 'no-repeat' } : { background: 'var(--border)' }),
    ...(found ? {} : { filter: 'brightness(0) opacity(0.35)' }),
  }
  return <span aria-hidden="true" data-testid="book-sprite" style={style} />
}

/**
 * The Dragon Book (design, Phase 5: dragonbook; §1.4, §3.4, §4.4): a book page with ribbon tabs down the left (Book, My
 * dragons, then one per rarity), search, an element filter and the order on top, and numbered cards; found species are
 * named, the rest are `???` silhouettes whose hint shows when tapped. Only the chosen rarity's sprites are drawn.
 */
export function DragonBookPanel({ onSelect, onClose, art }: { onSelect: (dragonId: string) => void; onClose?: () => void; art?: GameArtSet | null }) {
  const me = useMe()
  const preset = usePreset()
  const [tab, setTab] = useState<'book' | 'mine'>('book')
  const [open, setOpen] = useState<Rarity>('common')
  const [picked, setPicked] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [element, setElement] = useState<Element | null>(null)
  const [order, setOrder] = useState<Order>('number')
  const s = me.data?.state
  if (!s) return null
  const all = [...LAUNCH_CATALOG.species.values()]
  const number = new Map(all.map((sp, i) => [sp.id, i + 1]))
  const found = new Set(s.discovered)
  const pickedSp = picked ? LAUNCH_CATALOG.species.get(picked) : undefined
  const q = query.trim().toLowerCase()
  // Search matches found names only: a ??? card never answers to its hidden name (R22).
  const shown = all
    .filter(sp => sp.rarity === open && (!element || sp.elements.includes(element)) && (!q || (found.has(sp.id) && sp.name.toLowerCase().includes(q))))
    .sort((x, y) => order === 'name' ? (found.has(x.id) ? x.name : '~').localeCompare(found.has(y.id) ? y.name : '~')
      : order === 'found' ? Number(found.has(y.id)) - Number(found.has(x.id)) || number.get(x.id)! - number.get(y.id)!
        : number.get(x.id)! - number.get(y.id)!)
  return (
    <FullScreenFrame title="Dragon Book" badge={`${all.filter(sp => found.has(sp.id)).length}/${all.length}`} backdrop="wood" onClose={onClose}>
      <div className="book">
        <nav className="book__ribbons" aria-label="Dragon Book tabs">
          <div className="book__tabs" role="tablist" aria-label="Dragon Book sections">
            <button type="button" role="tab" className="book__ribbon" aria-selected={tab === 'book'} onClick={() => setTab('book')}>Book</button>
            <button type="button" role="tab" className="book__ribbon" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>My dragons</button>
          </div>
          {tab === 'book' && RARITIES.map(r => {
            const group = all.filter(sp => sp.rarity === r)
            if (group.length === 0) return null
            return (
              <button key={r} type="button" className={`book__ribbon book__ribbon--${r}`} aria-pressed={open === r} onClick={() => { setOpen(r); setPicked(null) }}>
                {`${RARITY_LABEL[r]} (${group.filter(sp => found.has(sp.id)).length}/${group.length})`}
              </button>
            )
          })}
        </nav>
        <div className="book__page">
          {tab === 'mine' ? (
            <div role="tabpanel" aria-label="My dragons"><DragonsPanel onSelect={onSelect} /></div>
          ) : (
            <div role="tabpanel" aria-label="Book" className="book__panel">
              <div className="book__tools">
                <input type="search" className="book__search" aria-label="Search found dragons" placeholder="Search here" value={query} onChange={e => setQuery(e.target.value)} />
                <select className="book__order" aria-label="Order" value={order} onChange={e => setOrder(e.target.value as Order)}>
                  {(Object.keys(ORDER_LABEL) as Order[]).map(o => <option key={o} value={o}>{ORDER_LABEL[o]}</option>)}
                </select>
                <p className="book__count"><strong>{all.filter(sp => found.has(sp.id)).length} / {all.length}</strong> found</p>
              </div>
              <div className="book__elements" role="group" aria-label="Elements">
                <button type="button" className="book__el" aria-pressed={element === null} onClick={() => setElement(null)}>All</button>
                {ELEMENTS.map(el => (
                  <button key={el} type="button" className="book__el" aria-pressed={element === el} aria-label={elementName(el)} onClick={() => setElement(element === el ? null : el)}>
                    <ElementRibbon element={el} />
                  </button>
                ))}
              </div>
              <section aria-label={RARITY_LABEL[open]}>
                <ul className="book__grid">
                  {shown.map(sp => {
                    const has = found.has(sp.id)
                    return (
                      <li key={sp.id}>
                        <button type="button" className={`book-card${has ? ' book-card--found' : ''}`} data-testid="book-tile" aria-label={has ? sp.name : '???'}
                          aria-pressed={picked === sp.id} style={{ width: TILE_WIDTH }} onClick={() => setPicked(sp.id)}>
                          <span className="book-card__title" aria-hidden="true">{`${number.get(sp.id)}. ${has ? sp.name : '???'}`}</span>
                          <span className="book-card__art" aria-hidden="true">
                            <Silhouette sp={sp} art={art} found={has} />
                            {has && <span className="book-card__shield"><RarityShield rarity={sp.rarity} /></span>}
                          </span>
                          <span className="book-card__ribbons" aria-hidden="true">{sp.elements.map(el => <ElementRibbon key={el} element={el} />)}</span>
                        </button>
                      </li>
                    )
                  })}
                  {shown.length === 0 && <li className="book__empty">No dragons match</li>}
                </ul>
              </section>
              {pickedSp && (
                <div className="book__detail" data-testid="book-detail" aria-live="polite">
                  <h3>{found.has(pickedSp.id) ? pickedSp.name : '???'}</h3>
                  <p>{pickedSp.elements.map(elementName).join(' · ')} · {RARITY_LABEL[pickedSp.rarity]}</p>
                  <p>{bookHint(pickedSp, preset, LAUNCH_CATALOG)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </FullScreenFrame>
  )
}

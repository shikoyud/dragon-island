import { LAUNCH_CATALOG, RARITIES, type Rarity, type Species } from '@wyrmhaven/game-core'
import { useState } from 'react'
import type { GameArtSet } from '../art/types'
import { dragonLook } from '../game/islandModel'
import { usePreset } from '../state/preset'
import { useMe } from '../state/me'
import { Panel } from '../ui/Panel'
import { bookHint, elementName } from './bookHints'
import { DragonsPanel } from './DragonsPanel'

const TILE = 48
const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

/** First frame of the species' sheet at a fixed size. Decorative: it never carries the species name (R22). */
function Silhouette({ sp, art, found }: { sp: Species; art?: GameArtSet | null; found: boolean }) {
  const sprite = art ? dragonLook(sp.id, 10, art, LAUNCH_CATALOG).sprite : null
  const style = {
    width: TILE, height: TILE, imageRendering: 'pixelated' as const, display: 'block',
    ...(sprite?.src ? { backgroundImage: `url("${sprite.src}")`, backgroundSize: `${TILE * sprite.frames}px ${TILE}px`, backgroundPosition: '0 0', backgroundRepeat: 'no-repeat' } : { background: 'var(--border)' }),
    ...(found ? {} : { filter: 'brightness(0)' }),
  }
  return <span aria-hidden="true" data-testid="book-sprite" style={style} />
}

/** The Dragon Book (§1.4, §3.4, §4.4): every species by rarity, found ones named, the rest `???` silhouettes with a hint. */
export function DragonBookPanel({ onSelect, onClose, art }: { onSelect: (dragonId: string) => void; onClose?: () => void; art?: GameArtSet | null }) {
  const me = useMe()
  const preset = usePreset()
  const [tab, setTab] = useState<'book' | 'mine'>('book')
  const [open, setOpen] = useState<Rarity>('common')
  const [picked, setPicked] = useState<string | null>(null)
  const s = me.data?.state
  if (!s) return null
  const all = [...LAUNCH_CATALOG.species.values()]
  const found = new Set(s.discovered)
  const pickedSp = picked ? LAUNCH_CATALOG.species.get(picked) : undefined
  return (
    <Panel title="Dragon Book" onClose={onClose}>
      <div className="hud-tabs" role="tablist" aria-label="Dragon Book sections">
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'book'} onClick={() => setTab('book')}>Book</button>
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>My dragons</button>
      </div>
      {tab === 'mine' ? (
        <div role="tabpanel" aria-label="My dragons"><DragonsPanel onSelect={onSelect} /></div>
      ) : (
        <div role="tabpanel" aria-label="Book">
          <p><strong>{all.filter(sp => found.has(sp.id)).length} / {all.length}</strong> found</p>
          {RARITIES.map(r => {
            const group = all.filter(sp => sp.rarity === r)
            if (group.length === 0) return null
            const isOpen = open === r
            return (
              <section key={r} aria-label={RARITY_LABEL[r]}>
                <button type="button" className="btn btn--ghost" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? ('' as Rarity) : r)}>
                  {RARITY_LABEL[r]} ({group.filter(sp => found.has(sp.id)).length}/{group.length})
                </button>
                {isOpen && (
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {group.map(sp => {
                      const has = found.has(sp.id)
                      return (
                        <li key={sp.id}>
                          <button type="button" className="btn" data-testid="book-tile" aria-pressed={picked === sp.id} onClick={() => setPicked(sp.id)}>
                            <Silhouette sp={sp} art={art} found={has} />
                            <small>{has ? sp.name : '???'}</small>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
          {pickedSp && (
            <div data-testid="book-detail" aria-live="polite">
              <h3>{found.has(pickedSp.id) ? pickedSp.name : '???'}</h3>
              <p>{pickedSp.elements.map(elementName).join(' · ')} · {RARITY_LABEL[pickedSp.rarity]}</p>
              <p>{bookHint(pickedSp, preset, LAUNCH_CATALOG)}</p>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

import type { MovableRef } from '@wyrmhaven/game-core'
import { useState, type ReactNode } from 'react'
import { buildingSprite } from '../game/islandModel'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { useGameArt, SpriteStill } from '../ui/GameArt'
import { ElementRibbon } from '../ui/kit/pieces'
import { PillButton } from '../ui/kit/buttons'
import { Panel } from '../ui/Panel'
import { infoOf } from './infoModel'
import { MoveTurn } from './MoveTurn'

/**
 * The Info dialog (design, Phase 5: habitat-info): plank "<Building> level N"; the building's art left with Store and
 * Sell under it; a table right (its rows, then Description). `children` adds what only this building has, below.
 */
export function InfoDialog({ target, nowMs = 0, onClose, children }: { target: MovableRef; nowMs?: number; onClose?: () => void; children?: ReactNode }) {
  const me = useMe()
  const preset = usePreset()
  const art = useGameArt()
  const { run, pending } = useAction()
  const [confirming, setConfirming] = useState(false)
  const s = me.data?.state
  const info = s ? infoOf(s, target, preset, nowMs) : null
  if (!s || !info) return null
  const id = target.type === 'habitat' || target.type === 'decoration' ? target.id : target.type === 'farm' || target.type === 'breeder' ? `${target.type}-${target.index}` : target.type
  const store = info.store
  const sell = info.sell
  return (
    <Panel title={info.level ? `${info.name} ${info.level}` : info.name} onClose={onClose}>
      <div className="info-grid">
        <div className="info-grid__art">
          <SpriteStill sprite={buildingSprite(s, art, target)} height={120} />
          <div className="info-grid__buttons">
            {store && (
              <PillButton id={`store-${id}`} color="blue" disabled={pending || store.blocked !== undefined} reason={store.blocked}
                onClick={() => void run(store.action).then(ok => { if (ok) onClose?.() })}>
                Store
              </PillButton>
            )}
            {sell && (confirming ? (
              <>
                <PillButton id={`remove-confirm-${id}`} color="red" disabled={pending} onClick={() => void run(sell.action).then(() => setConfirming(false))}>
                  {`Confirm ${sell.label.charAt(0).toLowerCase()}${sell.label.slice(1)}`}
                </PillButton>
                <PillButton color="grey" onClick={() => setConfirming(false)}>Keep it</PillButton>
              </>
            ) : (
              <PillButton id={`remove-${id}`} color="blue" disabled={pending} onClick={() => setConfirming(true)}>{sell.label}</PillButton>
            ))}
            <MoveTurn target={target} turnOnly />
          </div>
        </div>
        <dl className="info-table">
          {info.rows.map(r => (
            <div key={r.label} className="info-table__row">
              <dt>{r.label}</dt>
              <dd>{r.elements ? <span className="info-table__ribbons" aria-label={r.value}>{r.elements.map(e => <ElementRibbon key={e} element={e} />)}</span> : r.value}</dd>
            </div>
          ))}
          <div className="info-table__row info-table__row--wide">
            <dt>Description</dt>
            <dd>{info.description}</dd>
          </div>
        </dl>
      </div>
      {confirming && <p><small>Remove it for good? You get back only a quarter of the price.</small></p>}
      {children}
    </Panel>
  )
}

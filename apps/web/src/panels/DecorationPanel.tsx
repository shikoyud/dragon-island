import { decorationRefund } from '@wyrmhaven/game-core'
import { useState } from 'react'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { MoveTurn } from './MoveTurn'

/** A placed decoration: move it, turn it, or remove it (two steps) for 25% of its price back in gold. */
export function DecorationPanel({ decorationId, onClose }: { decorationId: string; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const [confirming, setConfirming] = useState(false)
  const s = me.data?.state
  const d = s?.decorations.find(x => x.id === decorationId)
  if (!s || !d) return null
  const name = d.kind.replace(/([A-Z])/g, ' $1').toLowerCase()
  const refund = formatGold(decorationRefund(d.kind))
  return (
    <Panel title={`Decoration: ${name}`} onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <MoveTurn target={{ type: 'decoration', id: d.id }} />
        {confirming ? (
          <>
            <ActionButton id={`remove-confirm-${d.id}`} danger disabled={pending} onClick={() => void run({ type: 'removeDecoration', id: d.id }).then(() => setConfirming(false))}>
              Confirm remove · +{refund} gold
            </ActionButton>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>Keep it</button>
          </>
        ) : (
          <ActionButton id={`remove-${d.id}`} danger disabled={pending} onClick={() => setConfirming(true)}>
            Remove · +{refund} gold
          </ActionButton>
        )}
      </div>
      <p><small>{confirming ? 'Remove it for good? You get back only a quarter of the price.' : 'Removing refunds a quarter of the price as gold that cannot be sold.'}</small></p>
    </Panel>
  )
}

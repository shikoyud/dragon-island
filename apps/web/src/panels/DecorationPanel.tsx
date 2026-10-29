import { DECORATIONS, decorationRefund } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { useStartPlacing } from '../state/startPlacing'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

/** A placed decoration: move it, turn it, or remove it for 25% of its price back as ineligible gold. */
export function DecorationPanel({ decorationId, onClose }: { decorationId: string; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const startPlacing = useStartPlacing()
  const s = me.data?.state
  const d = s?.decorations.find(x => x.id === decorationId)
  if (!s || !d) return null
  const name = d.kind.replace(/([A-Z])/g, ' $1').toLowerCase()
  const target = { type: 'decoration', id: d.id } as const
  return (
    <Panel title={`Decoration: ${name}`} onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => startPlacing({ kind: 'move', target }, DECORATIONS[d.kind].size, d.placement)}>Move</button>
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => void run({ type: 'moveBuilding', target, placement: { ...d.placement, facing: ((d.placement.facing + 1) % 4) as typeof d.placement.facing } })}
        >
          Turn
        </button>
        <ActionButton id={`remove-${d.id}`} danger disabled={pending} onClick={() => void run({ type: 'removeDecoration', id: d.id })}>
          Remove · +{formatGold(decorationRefund(d.kind))} gold
        </ActionButton>
      </div>
      <p><small>Removing refunds a quarter of the price as gold that cannot be sold.</small></p>
    </Panel>
  )
}

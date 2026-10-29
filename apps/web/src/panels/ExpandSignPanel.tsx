import { HOME_EXPANSION, HOME_MAX_STEP, homeSize } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

/** The sign on the home island's edge: buy the next 2-cell strip (spec section 3). */
export function ExpandSignPanel({ onClose }: { onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  if (!s) return null
  const step = s.islands.homeStep
  if (step >= HOME_MAX_STEP) return <Panel title="Expansion" onClose={onClose}><p>The home island is fully expanded.</p></Panel>
  const next = HOME_EXPANSION[step]!
  const size = homeSize(step + 1)
  const reason = s.level < next.minLevel ? `Needs player level ${next.minLevel}` : s.gold < next.cost ? 'Not enough gold' : ''
  return (
    <Panel title="Expansion" onClose={onClose}>
      <ActionButton id="expand-island" disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'expandIsland' })}>
        Expand to {size.w}x{size.h} · {formatGold(next.cost)} gold
      </ActionButton>
    </Panel>
  )
}

import { priceMicroUsd, type StoreItem } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatMicroUsd } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

/** Store prices come from game-core in USD; the token charge is shown after the server converts it. */
export function StorePanel({ nowMs, onClose }: { nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  if (!s) return null

  const items: { id: string; label: string; item: StoreItem }[] = [
    { id: 'food-pack', label: 'Food pack · 1,000 food', item: { kind: 'foodPack' } },
  ]

  return (
    <Panel title="Store" onClose={onClose}>
      <p><small>Prices in USD, paid in DRIS from your game balance at the current rate.</small></p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {items.map(({ id, label, item }) => {
          const price = priceMicroUsd(item, s, nowMs)
          const reason = price === null ? 'Not available right now' : undefined
          return (
            <li key={id}>
              <ActionButton id={`buy-${id}`} disabled={pending || Boolean(reason)} reason={reason} onClick={() => void run({ type: 'buy', item })}>
                {label}{price !== null ? ` · ${formatMicroUsd(price)}` : ''}
              </ActionButton>
            </li>
          )
        })}
      </ul>
      <p><small>Timer skips are offered next to each nest, egg and plot.</small></p>
    </Panel>
  )
}

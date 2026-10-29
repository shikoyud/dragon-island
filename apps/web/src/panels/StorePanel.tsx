import { FOOTPRINT, HOARD, HOARD_MIN_PLAYER_LEVEL, MAX_NESTS, priceMicroUsd, type StoreItem } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { useStartPlacing } from '../state/startPlacing'
import { formatMicroUsd } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

/** Store prices come from game-core in USD; the token charge is shown after the server converts it. */
export function StorePanel({ nowMs, onClose }: { nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const startPlacing = useStartPlacing()
  const s = me.data?.state
  if (!s) return null

  const items: { id: string; label: string; item: StoreItem; disabledReason?: string; place?: () => void }[] = [
    { id: 'food-pack', label: 'Food pack · 1,000 food', item: { kind: 'foodPack' } },
    { id: 'odds-boost', label: 'Breeding odds boost (one breed)', item: { kind: 'oddsBoost' } },
    { id: 'extra-nest', label: `Extra nest (${s.nests.length + 1} of ${MAX_NESTS})`, item: { kind: 'nest', placement: { island: 'home', col: 0, row: 0, facing: 0 } }, place: () => startPlacing({ kind: 'nest' }, FOOTPRINT.nest), disabledReason: s.nests.length >= MAX_NESTS ? 'Maximum nests reached' : undefined },
    {
      id: 'hoard', label: s.hoardLevel === 0 ? 'Build the Hoard' : `Upgrade Hoard to level ${s.hoardLevel + 1}`, item: { kind: 'hoard' },
      place: s.hoardLevel === 0 ? () => startPlacing({ kind: 'hoard' }, FOOTPRINT.hoard) : undefined,
      disabledReason: s.level < HOARD_MIN_PLAYER_LEVEL ? `Needs player level ${HOARD_MIN_PLAYER_LEVEL}` : s.hoardLevel >= HOARD.length ? 'Hoard is at its maximum level' : undefined,
    },
  ]

  return (
    <Panel title="Store" onClose={onClose}>
      <p><small>Prices in USD, paid in DRIS from your game balance at the current rate.</small></p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {items.map(({ id, label, item, disabledReason, place }) => {
          const price = priceMicroUsd(item, s, nowMs)
          const reason = disabledReason ?? (price === null ? 'Not available right now' : undefined)
          return (
            <li key={id}>
              <ActionButton id={`buy-${id}`} disabled={pending || Boolean(reason)} reason={reason} onClick={() => (place ? place() : void run({ type: 'buy', item }))}>
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

import { getSpecies, hatcherySlots, hatcheryUsed, LAUNCH_CATALOG, priceMicroUsd } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatSkipPrice } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { isReady, Timer } from '../ui/Timer'
import { useToasts } from '../ui/Toast'
import { UpgradeSection } from './UpgradeSection'

/**
 * The Hatchery (§3.1, §5.4): one row per slot. An egg shows only its timer (R20); a hatched dragon with no habitat
 * waits in its slot and opens its panel; free slots read Empty.
 */
export function HatcheryPanel({ nowMs, onClose, onOpenDragon }: { nowMs: number; onClose?: () => void; onOpenDragon?: (id: string) => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const toasts = useToasts()
  const s = me.data?.state
  if (!s) return null
  const catalog = LAUNCH_CATALOG
  const slots = hatcherySlots(s.hatcheryLevel, s.hatcheryFifthSlot)
  const used = hatcheryUsed(s)
  const waiting = s.dragons.filter(d => d.habitatId === null)
  const empty = Math.max(slots, used) - used
  const fifthSlotInStore = priceMicroUsd({ kind: 'hatcheryL5' }, s, nowMs) !== null
  const skipPrice = (index: number) => priceMicroUsd({ kind: 'skip', target: 'hatchery', index }, s, nowMs)

  const hatch = async (slot: number) => {
    const name = getSpecies(catalog, s.hatchery[slot]!.speciesId).name
    if (await run({ type: 'hatch', slot })) toasts.info(`Hatched ${name}`)
  }

  return (
    <Panel title={`Hatchery · ${used}/${slots}`} onClose={onClose}>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {s.hatchery.map((egg, slot) => {
          const price = skipPrice(slot)
          return (
            <li key={`egg-${slot}`} data-testid={`hatchery-slot-${slot}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span>Egg · <Timer readyAtMs={egg.readyAtMs} nowMs={nowMs} /></span>
              <ActionButton id={`hatch-${slot}`} primary disabled={pending || !isReady(egg.readyAtMs, nowMs)} reason="Still hatching" onClick={() => void hatch(slot)}>
                Hatch
              </ActionButton>
              {price !== null && (
                <ActionButton id={`skip-hatch-${slot}`} disabled={pending} onClick={() => void run({ type: 'buy', item: { kind: 'skip', target: 'hatchery', index: slot } })}>
                  Skip · {formatSkipPrice(price)}
                </ActionButton>
              )}
            </li>
          )
        })}
        {waiting.map((d, i) => {
          const slot = s.hatchery.length + i
          return (
            <li key={d.id} data-testid={`hatchery-slot-${slot}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <button type="button" className="btn" onClick={() => onOpenDragon?.(d.id)}>{getSpecies(catalog, d.speciesId).name}</button>
              <small>Needs a habitat</small>
              <small>It holds this slot until it has a home.</small>
            </li>
          )
        })}
        {Array.from({ length: empty }, (_, i) => {
          const slot = used + i
          return <li key={`empty-${slot}`} data-testid={`hatchery-slot-${slot}`} style={{ marginBottom: 6 }}><small>Empty</small></li>
        })}
      </ul>
      {fifthSlotInStore && <p><small>Fifth slot in the Store</small></p>}
      <UpgradeSection building={{ type: 'hatchery' }} nowMs={nowMs} />
    </Panel>
  )
}

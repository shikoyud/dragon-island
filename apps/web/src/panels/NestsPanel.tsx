import { getSpecies, LAUNCH_CATALOG, priceMicroUsd } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatMicroUsd } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { isReady, Timer } from '../ui/Timer'

export function NestsPanel({ nowMs, onClose }: { nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  if (!s) return null
  const catalog = LAUNCH_CATALOG
  const skipPrice = (target: 'nest' | 'hatchery', index: number) => priceMicroUsd({ kind: 'skip', target, index }, s, nowMs)

  return (
    <Panel title="Nests & hatchery" onClose={onClose}>
      <h3 style={{ fontSize: 12 }}>Nests</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {s.nests.map((egg, i) => {
          const price = skipPrice('nest', i)
          return (
            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span>Nest {i + 1}:</span>
              {egg ? (
                <>
                  <span>{getSpecies(catalog, egg.speciesId).name} egg · <Timer readyAtMs={egg.readyAtMs} nowMs={nowMs} /></span>
                  <ActionButton id={`collect-egg-${i}`} primary disabled={pending || !isReady(egg.readyAtMs, nowMs)} reason="Still incubating" onClick={() => void run({ type: 'collectEgg', nest: i })}>
                    Collect egg
                  </ActionButton>
                  {price !== null && (
                    <ActionButton id={`skip-nest-${i}`} disabled={pending} onClick={() => void run({ type: 'buy', item: { kind: 'skip', target: 'nest', index: i } })}>
                      Skip · {formatMicroUsd(price)}
                    </ActionButton>
                  )}
                </>
              ) : <span><small>empty</small></span>}
            </li>
          )
        })}
      </ul>
      <h3 style={{ fontSize: 12 }}>Hatchery ({s.hatchery.length}/3 eggs{s.dragons.some(d => d.habitatId === null) ? ', plus waiting hatchlings' : ''})</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {s.hatchery.map((egg, slot) => {
          const price = skipPrice('hatchery', slot)
          return (
            <li key={slot} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span>{getSpecies(catalog, egg.speciesId).name} egg · <Timer readyAtMs={egg.readyAtMs} nowMs={nowMs} /></span>
              <ActionButton id={`hatch-${slot}`} primary disabled={pending || !isReady(egg.readyAtMs, nowMs)} reason="Still hatching" onClick={() => void run({ type: 'hatch', slot })}>
                Hatch
              </ActionButton>
              {price !== null && (
                <ActionButton id={`skip-hatch-${slot}`} disabled={pending} onClick={() => void run({ type: 'buy', item: { kind: 'skip', target: 'hatchery', index: slot } })}>
                  Skip · {formatMicroUsd(price)}
                </ActionButton>
              )}
            </li>
          )
        })}
        {s.hatchery.length === 0 && <li><small>No eggs hatching.</small></li>}
      </ul>
    </Panel>
  )
}

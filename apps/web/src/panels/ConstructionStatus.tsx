import { priceMicroUsd } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatMicroUsd } from '../ui/Money'
import { ActionButton } from '../ui/Panel'
import { Timer } from '../ui/Timer'
import { useAutoFinish } from './useAutoFinish'

/** Timer, manual Finish once ready, Skip price and the automatic finish attempt for one construction. */
export function ConstructionStatus({ index, readyAtMs, nowMs, id, label }: { index: number; readyAtMs: number; nowMs: number; id: string; label: string }) {
  const me = useMe()
  const { run, pending } = useAction()
  useAutoFinish(index, readyAtMs, nowMs)
  const s = me.data?.state
  const skip = s && index >= 0 ? priceMicroUsd({ kind: 'skip', target: 'construction', index }, s, nowMs) : null
  return (
    <>
      <span>{label} · <Timer readyAtMs={readyAtMs} nowMs={nowMs} /></span>
      {nowMs >= readyAtMs && (
        <ActionButton id={`finish-construction-${id}`} primary disabled={pending} onClick={() => void run({ type: 'finishConstruction', index })}>
          Finish
        </ActionButton>
      )}
      {skip !== null && (
        <ActionButton id={`skip-construction-${id}`} disabled={pending} onClick={() => void run({ type: 'buy', item: { kind: 'skip', target: 'construction', index } })}>
          Skip · {formatMicroUsd(skip)}
        </ActionButton>
      )}
    </>
  )
}

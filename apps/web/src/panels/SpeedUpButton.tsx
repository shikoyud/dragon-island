import { SPEED_UP_TOKEN_MS, type SkipTarget, type SpeedUpToken } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { ActionButton } from '../ui/Panel'

export const TOKEN_NAMES: Record<SpeedUpToken, string> = { '15m': '15 min', '1h': '1 h', '3h': '3 h' }
const ORDER: SpeedUpToken[] = ['15m', '1h', '3h']

/** The largest owned token no longer than the time left, else the smallest owned; null with none. */
export function pickToken(owned: Record<SpeedUpToken, number>, remainingMs: number): SpeedUpToken | null {
  const have = ORDER.filter(t => owned[t] > 0)
  const fits = have.filter(t => SPEED_UP_TOKEN_MS[t] <= remainingMs)
  return fits.length > 0 ? fits[fits.length - 1]! : (have[0] ?? null)
}

/** `Use 1 h · 2 left`: spends a speed-up token (R55) on a running timer. Hidden with no tokens or no timer left. */
export function SpeedUpButton({ id, target, index, readyAtMs, nowMs }: { id: string; target: SkipTarget; index: number; readyAtMs: number; nowMs: number }) {
  const me = useMe()
  const { run, pending } = useAction()
  const owned = me.data?.state.speedUps
  if (!owned || readyAtMs <= nowMs) return null
  const token = pickToken(owned, readyAtMs - nowMs)
  if (token === null) return null
  return (
    <ActionButton id={id} disabled={pending} onClick={() => void run({ type: 'useSpeedUp', token, target, index })}>
      {`Use ${TOKEN_NAMES[token]} · ${owned[token]} left`}
    </ActionButton>
  )
}

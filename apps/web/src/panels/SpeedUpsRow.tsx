import { useMe } from '../state/me'
import { TOKEN_NAMES } from './SpeedUpButton'

/** The speed-up token inventory (R55), shown with no timer running: `15 min × 3 · 1 h × 0 · 3 h × 2`. */
export function SpeedUpsRow() {
  const state = useMe().data?.state
  const owned = state?.speedUps
  if (!owned) return null
  const pulls = state.pve.chestPulls
  return (
    <p className="settings-dialog__speedups">
      <strong>Speed-ups</strong>
      <br />
      <span>{(['15m', '1h', '3h'] as const).map(k => `${TOKEN_NAMES[k]} × ${owned[k]}`).join(' · ')}</span>
      {pulls > 0 && (
        <>
          <br />
          <span>Dragon Chest pulls saved: {pulls}</span>
        </>
      )}
    </p>
  )
}

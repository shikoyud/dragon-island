import { newPlayer, STATE_VERSION, type PlayerState } from '@wyrmhaven/game-core'

/**
 * Loads a stored PlayerState. There is no save migration (R2): a state whose `version` is not the current
 * STATE_VERSION is replaced by a fresh player and `onReset` is told. A current state comes back unchanged.
 */
export function migrateState(raw: unknown, nowMs: number, onReset?: () => void): PlayerState {
  if (typeof raw !== 'object' || raw === null) throw new Error('STATE_CORRUPT')
  const s = raw as Record<string, unknown>
  if (typeof s['gold'] !== 'number' || !Array.isArray(s['dragons'])) throw new Error('STATE_CORRUPT')
  if (s['version'] !== STATE_VERSION) {
    onReset?.()
    return newPlayer(nowMs)
  }
  return raw as PlayerState
}

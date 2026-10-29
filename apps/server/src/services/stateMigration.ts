import { layoutLegacyState, utcDay, type PlayerState } from '@wyrmhaven/game-core'

/**
 * Loads a stored PlayerState, filling in fields added by later game-core versions so rows written
 * before them keep working. Idempotent: a current state comes back unchanged.
 */
export function migrateState(raw: unknown, nowMs: number): PlayerState {
  if (typeof raw !== 'object' || raw === null) throw new Error('STATE_CORRUPT')
  const s = raw as Record<string, unknown>
  if (typeof s['gold'] !== 'number' || !Array.isArray(s['dragons'])) throw new Error('STATE_CORRUPT')
  const day = utcDay(nowMs)
  const out: Record<string, unknown> = { ...s }
  // Phase 2 additions
  if (!('defenceTeam' in out)) out['defenceTeam'] = null
  if (typeof out['trophies'] !== 'number') out['trophies'] = 0
  if (typeof out['pvp'] !== 'object' || out['pvp'] === null) out['pvp'] = { day, count: 0 }
  if (typeof out['pve'] !== 'object' || out['pve'] === null) out['pve'] = { cleared: 0, replays: { day, count: 0 } }
  // Base building: states saved before the grid get islands, placements, Nest objects and farm levels.
  if (!('islands' in out)) return layoutLegacyState(out)
  return out as unknown as PlayerState
}

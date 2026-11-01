// GDD §6.3 dragon fatigue, R68: absolute HP plus a timestamp; regen is floored and capped at max; a level-up raises max, not HP.
import { combatStats } from './battle/stats'
import type { Catalog } from './catalog'
import type { Preset } from './data/presets'
import { MIN_FIGHT_PCT, TRIAL_FLOOR_HP } from './data/trials'
import type { Dragon, PlayerState } from './state'

const MS_PER_MINUTE = 60_000

export function maxHp(d: Dragon, c: Catalog): number {
  return combatStats({ speciesId: d.speciesId, level: d.level }, c).hp
}

/** HP now: the stored HP plus regen since `atMs`. A clock stepping back reads the stored HP, no more and never less. */
export function currentHp(d: Dragon, c: Catalog, nowMs: number, preset: Preset): number {
  const max = maxHp(d, c)
  if (!d.fatigue) return max
  const elapsed = Math.max(0, nowMs - d.fatigue.atMs)
  return Math.min(max, d.fatigue.hp + Math.floor((max * preset.healPctPerMin * elapsed) / (100 * MS_PER_MINUTE)))
}

export function canFight(d: Dragon, c: Catalog, nowMs: number, preset: Preset): boolean {
  return currentHp(d, c, nowMs, preset) * 100 >= maxHp(d, c) * MIN_FIGHT_PCT
}

const rested = ({ fatigue: _, ...d }: Dragon): Dragon => d

/** HP after a battle: a KO returns at TRIAL_FLOOR_HP, max clears the record. */
export function afterBattle(d: Dragon, hp: number, c: Catalog, nowMs: number): Dragon {
  const kept = Math.max(TRIAL_FLOOR_HP, hp)
  return kept >= maxHp(d, c) ? rested(d) : { ...d, fatigue: { hp: kept, atMs: nowMs } }
}

/** Freezes HP where regen has it now. Call before a level-up, so the higher max can't reprice the time gone by (R68). */
export function holdHp(d: Dragon, c: Catalog, nowMs: number, preset: Preset): Dragon {
  if (!d.fatigue) return d
  const hp = currentHp(d, c, nowMs, preset)
  return hp >= maxHp(d, c) ? rested(d) : { ...d, fatigue: { hp, atMs: Math.max(nowMs, d.fatigue.atMs) } }
}

/** True when a dragon is below max right now; a fatigue that has healed by itself doesn't count. */
export function anyHurt(s: PlayerState, c: Catalog, nowMs: number, preset: Preset): boolean {
  return s.dragons.some(d => currentHp(d, c, nowMs, preset) < maxHp(d, c))
}

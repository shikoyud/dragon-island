import type { BattleDragonSpec } from './battle/stats'
import type { Catalog } from './catalog'
import { MAX_DRAGON_LEVEL } from './dragon'
import type { Rarity } from './rarity'
import type { Rng } from './rng'

/** Server-built view of an opponent; `playerId: null` marks a generated bot. */
export interface OpponentSnapshot {
  playerId: string | null
  trophies: number
  level: number
  team: readonly BattleDragonSpec[]
}

/**
 * `teamLevel` = rounded mean level of the seeker's three highest-level dragons
 * (server computes). Not the defence team: that is chosen by the seeker, so
 * basing bot strength on it would let an empty or weak defence buy easy bots.
 */
export interface Seeker { trophies: number; level: number; teamLevel: number }

export const MATCH_TROPHY_RANGE = 100
export const MATCH_LEVEL_RANGE = 5
export const MATCH_OFFERS = 3
export const BOT_RARITIES: readonly Rarity[] = ['common', 'rare']

const clampLevel = (level: number) => Math.min(MAX_DRAGON_LEVEL, Math.max(1, level))

/** Three picks (with replacement) from common/rare non-recipe species, in stable id order. */
export function generateBotTeam(level: number, c: Catalog, rng: Rng): BattleDragonSpec[] {
  const pool = [...c.species.values()]
    .filter(s => !s.recipeOnly && BOT_RARITIES.includes(s.rarity))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return Array.from({ length: MATCH_OFFERS }, () => ({ speciesId: pool[rng.int(pool.length)]!.id, level: clampLevel(level) }))
}

export function generateBot(seeker: Seeker, c: Catalog, rng: Rng): OpponentSnapshot {
  const trophies = Math.max(0, seeker.trophies + rng.int(2 * MATCH_TROPHY_RANGE + 1) - MATCH_TROPHY_RANGE)
  return { playerId: null, trophies, level: seeker.level, team: generateBotTeam(seeker.teamLevel, c, rng) }
}

/**
 * Up to three eligible candidates chosen without replacement, then bots to fill.
 * The server passes only other players who have a saved defence team, never the seeker.
 */
export function pickOpponents(seeker: Seeker, candidates: readonly OpponentSnapshot[], c: Catalog, rng: Rng): OpponentSnapshot[] {
  const eligible = candidates.filter(o =>
    Math.abs(o.trophies - seeker.trophies) <= MATCH_TROPHY_RANGE && Math.abs(o.level - seeker.level) <= MATCH_LEVEL_RANGE)
  const picks: OpponentSnapshot[] = []
  while (picks.length < MATCH_OFFERS && eligible.length > 0) picks.push(eligible.splice(rng.int(eligible.length), 1)[0]!)
  while (picks.length < MATCH_OFFERS) picks.push(generateBot(seeker, c, rng))
  return picks
}

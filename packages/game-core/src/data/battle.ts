// GDD §6.1, §6.2 and §6.4 battle constants.
export const TEAM_SIZE = 3
export const TURN_LIMIT = 30
/** §6.1: Physical plus three tiers. */
export const KIT_SIZE = 4
/** Crit chance in percent: rng.int(100) < CRIT_PERCENT. */
export const CRIT_PERCENT = 10
/** Variance in thousandths: VARIANCE_MIN + rng.int(VARIANCE_MAX - VARIANCE_MIN + 1). */
export const VARIANCE_MIN = 900
export const VARIANCE_MAX = 1100
/** §6.4: how often the AI takes the highest expected damage: rng.int(100) < AI_BEST_MOVE_PERCENT. */
export const AI_BEST_MOVE_PERCENT = 80
/** Wire limit on a submitted move list, not a GDD number: more than any battle can use, since trailing moves are ignored. */
export const MAX_BATTLE_MOVES = 45

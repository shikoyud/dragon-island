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
/** §6.4: the swap test fires when every element move is at or under this multiplier (R66) ... */
export const AI_SWAP_BELOW_MULT = 0.5
/** ... and a bench dragon has a move at this multiplier or better, which is the 2x of the matrix. */
export const AI_SWAP_TARGET_MULT = 2
/** §6.4's "highest expected damage" takes no crit and the variance at the middle of the range, in thousandths. */
export const AI_EXPECTED_VARIANCE = (VARIANCE_MIN + VARIANCE_MAX) / 2
/** Wire limit on a submitted move list, not a GDD number: more than any battle can use, since trailing moves are ignored. */
export const MAX_BATTLE_MOVES = 45

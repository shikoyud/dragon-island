// GDD §6.1 and §6.2 battle constants.
export const TEAM_SIZE = 3
export const TURN_LIMIT = 30
/** Crit chance in percent: rng.int(100) < CRIT_PERCENT. */
export const CRIT_PERCENT = 10
/** Variance in thousandths: VARIANCE_MIN + rng.int(VARIANCE_MAX - VARIANCE_MIN + 1). */
export const VARIANCE_MIN = 900
export const VARIANCE_MAX = 1100

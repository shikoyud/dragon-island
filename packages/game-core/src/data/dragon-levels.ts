// GDD §4.1 (levels, food curve, evolution stages), §4.2 (Roost level caps), §4.3 (feed XP); ruling R5.
export const MAX_DRAGON_LEVEL = 40
export const FEEDS_PER_LEVEL = 4
/** Breeding needs both parents at the Juvenile stage (§4.1). */
export const BREED_MIN_LEVEL = 4
/** Level cap by Roost tier; index = `roostTier` (§4.2). */
export const ROOST_LEVEL_CAPS: readonly number[] = [7, 10, 15, 20, 30, 40]
/** Evolution stage starts (§4.1): Juvenile from Lv 4, Adult from Lv 7. */
export const JUVENILE_FROM_LEVEL = 4
export const ADULT_FROM_LEVEL = 7

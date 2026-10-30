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
/** Food for one feed at Lv 1, and its growth per level as an exact fraction: ×1.2 = 6/5 (§4.1, R5). */
export const FOOD_PER_FEED_BASE = 5
export const FOOD_PER_FEED_GROWTH = { num: 6, den: 5 } as const
/** Food per point of feed XP (§4.3). */
export const FOOD_PER_FEED_XP = 10

/** Food for one feed at `level`: ⌈5 × 1.2^(L−1)⌉ = ⌈5·6^(L−1) / 5^(L−1)⌉, exact in integers (R5, §4.1). */
export function foodPerFeed(level: number): number {
  const n = BigInt(level - 1)
  const den = BigInt(FOOD_PER_FEED_GROWTH.den) ** n
  return Number((BigInt(FOOD_PER_FEED_BASE) * BigInt(FOOD_PER_FEED_GROWTH.num) ** n + den - 1n) / den)
}

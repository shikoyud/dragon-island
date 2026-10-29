/**
 * Spec §12 season prizes. Prize pool = 30% of the vault's net inflows; 70% of it is a threshold pot
 * split by SP tier (highest tier only, equal shares), 30% a placement pot over the top 100 weighted
 * by (101 − rank). Everything is integer wei; rounding remainders and unreached tiers stay in the vault.
 */
export const PRIZE = {
  poolShareBps: 3000,
  thresholdBps: 7000,
  placementBps: 3000,
  tiers: [{ sp: 200, bps: 1000 }, { sp: 500, bps: 2000 }, { sp: 1000, bps: 3000 }, { sp: 2000, bps: 4000 }],
  topN: 100,
} as const

export interface Standing { playerId: string; sp: number }
export interface PrizeAward { playerId: string; wei: bigint; tier: number | null; rank: number | null }

const BPS = 10_000n

export function prizePoolWei(netInflowsWei: bigint): bigint {
  return (netInflowsWei * BigInt(PRIZE.poolShareBps)) / BPS
}

/** Highest tier index whose SP threshold `sp` reaches, or null. */
export function tierOf(sp: number): number | null {
  let tier: number | null = null
  PRIZE.tiers.forEach((t, i) => { if (sp >= t.sp) tier = i })
  return tier
}

/** `poolWei` is the whole prize pool. Returns awards > 0 only; players with no SP never win. */
export function computePrizes(poolWei: bigint, standings: readonly Standing[]): { awards: PrizeAward[]; unspentWei: bigint } {
  const ranked = standings
    .filter(s => s.sp > 0)
    .slice()
    .sort((a, b) => b.sp - a.sp || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0))
  const thresholdPot = (poolWei * BigInt(PRIZE.thresholdBps)) / BPS
  const placementPot = (poolWei * BigInt(PRIZE.placementBps)) / BPS
  const wei = new Map<string, bigint>()
  const add = (id: string, w: bigint) => wei.set(id, (wei.get(id) ?? 0n) + w)

  const tiers = ranked.map(s => tierOf(s.sp))
  PRIZE.tiers.forEach((t, i) => {
    const members = ranked.filter((_, k) => tiers[k] === i)
    if (members.length === 0) return
    const each = (thresholdPot * BigInt(t.bps)) / BPS / BigInt(members.length)
    members.forEach(m => add(m.playerId, each))
  })

  const top = ranked.slice(0, PRIZE.topN)
  const weights = top.map((_, k) => BigInt(PRIZE.topN + 1 - (k + 1)))
  const sumW = weights.reduce((n, w) => n + w, 0n)
  top.forEach((s, k) => add(s.playerId, (placementPot * weights[k]!) / sumW))

  const awards: PrizeAward[] = []
  let spent = 0n
  ranked.forEach((s, k) => {
    const w = wei.get(s.playerId) ?? 0n
    if (w <= 0n) return
    spent += w
    awards.push({ playerId: s.playerId, wei: w, tier: tiers[k]!, rank: k < PRIZE.topN ? k + 1 : null })
  })
  return { awards, unspentWei: poolWei - spent }
}

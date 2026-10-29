import { describe, expect, it } from 'vitest'
import { computePrizes, prizePoolWei } from '../src/prizes'

describe('computePrizes', () => {
  it('splits the threshold pot by highest tier reached and the placement pot by 101 − rank', () => {
    const pool = 10_000n * 10n ** 18n
    const r = computePrizes(pool, [{ playerId: 'a', sp: 2100 }, { playerId: 'b', sp: 600 }, { playerId: 'c', sp: 600 }, { playerId: 'd', sp: 10 }])
    const threshold = (pool * 7000n) / 10_000n
    const placement = pool - threshold
    const a = r.awards.find(x => x.playerId === 'a')!
    expect(a.tier).toBe(3)
    expect(a.rank).toBe(1)
    // tier 2000 pot 40% all to a; tier 500 pot 20% split b/c; tiers 200 and 1000 unreached → unspent
    const sumW = 5050n // all 100 ranks, whether or not they are filled
    expect(a.wei).toBe((threshold * 4000n) / 10_000n + (placement * 100n) / sumW)
    expect(r.awards.find(x => x.playerId === 'b')!.wei).toBe((threshold * 2000n) / 10_000n / 2n + (placement * 99n) / sumW)
    expect(r.awards.find(x => x.playerId === 'c')!.rank).toBe(3) // tie broken by playerId
    expect(r.awards.find(x => x.playerId === 'd')!.tier).toBeNull()
    expect(r.unspentWei).toBe(pool - r.awards.reduce((n, x) => n + x.wei, 0n))
  })

  it('unreached tiers and empty ranks leave wei unspent', () => {
    // Placement weights always sum over all 100 ranks (5050): a lone player gets 100/5050 of the 30% pot, the empty ranks stay in the vault.
    const r = computePrizes(1_000_000n, [{ playerId: 'a', sp: 50 }])
    expect(r.awards).toEqual([{ playerId: 'a', wei: (300_000n * 100n) / 5050n, tier: null, rank: 1 }])
    expect(r.unspentWei).toBe(1_000_000n - (300_000n * 100n) / 5050n)
  })

  it('ignores zero-SP players and an empty season', () => {
    expect(computePrizes(5n, [{ playerId: 'a', sp: 0 }])).toEqual({ awards: [], unspentWei: 5n })
    expect(computePrizes(5n, [])).toEqual({ awards: [], unspentWei: 5n })
    expect(prizePoolWei(10_001n)).toBe(3_000n)
  })

  it('ranks at most 100 players', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ playerId: `p${String(i).padStart(3, '0')}`, sp: 150 - i }))
    const r = computePrizes(10n ** 24n, many)
    expect(r.awards.filter(a => a.rank !== null)).toHaveLength(100)
    expect(r.awards.filter(a => a.rank === null)).toHaveLength(0) // the rest got no tier either (max sp 150 < 200)
  })
})

import { describe, expect, it } from 'vitest'
import { HATCHERY_SLOTS, newPlayer } from '../src/state'

describe('newPlayer', () => {
  it('matches the spec §9 starting state', () => {
    expect(HATCHERY_SLOTS).toBe(3)
    expect(newPlayer(0)).toEqual({
      gold: 1000, eligibleGold: 0, food: 100, xp: 0, level: 1,
      dragons: [{ id: 'd1', speciesId: 'fire', level: 1, habitatId: 'h1' }, { id: 'd2', speciesId: 'water', level: 1, habitatId: 'h2' }],
      habitats: [{ id: 'h1', element: 'fire', level: 1, lastCollectedMs: 0 }, { id: 'h2', element: 'water', level: 1, lastCollectedMs: 0 }],
      nests: [null], hatchery: [], farms: [{ crop: null, readyAtMs: 0 }, { crop: null, readyAtMs: 0 }],
      pity: {}, oddsBoosts: 0, hoardLevel: 0, earningUnlocked: false,
      sell: { day: 0, soldTodayMicroUsd: 0 }, ledger: { depositedMicroUsd: 0, withdrawnMicroUsd: 0, soldMicroUsd: 0 },
      tutorial: { breedDone: false, hatchDone: false }, nextId: 3,
      defenceTeam: null, trophies: 0, pvp: { day: 0, count: 0 }, pve: { cleared: 0, replays: { day: 0, count: 0 } },
    })
  })

  it('stamps the day counters', () => {
    const s = newPlayer(86_400_000 * 3 + 5)
    expect(s.pvp).toEqual({ day: 3, count: 0 })
    expect(s.pve.replays).toEqual({ day: 3, count: 0 })
  })

  it('stamps the UTC day and collection time', () => {
    const s = newPlayer(86_400_000 * 3 + 5)
    expect(s.sell.day).toBe(3)
    expect(s.habitats.map(h => h.lastCollectedMs)).toEqual([86_400_000 * 3 + 5, 86_400_000 * 3 + 5])
  })
})

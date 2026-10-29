import { describe, expect, it } from 'vitest'
import { HATCHERY_SLOTS, newPlayer } from '../src/state'

describe('newPlayer', () => {
  it('matches the spec §9 starting state', () => {
    expect(HATCHERY_SLOTS).toBe(3)
    expect(newPlayer(0)).toEqual({
      gold: 1000, eligibleGold: 0, food: 100, xp: 0, level: 1,
      dragons: [{ id: 'd1', speciesId: 'fire', level: 1, habitatId: 'h1' }, { id: 'd2', speciesId: 'water', level: 1, habitatId: 'h2' }],
      habitats: [{ id: 'h1', element: 'fire', level: 1, lastCollectedMs: 0, placement: { island: 'home', col: 0, row: 0, facing: 0 } }, { id: 'h2', element: 'water', level: 1, lastCollectedMs: 0, placement: { island: 'home', col: 5, row: 0, facing: 0 } }],
      nests: [{ egg: null, level: 1, placement: { island: 'home', col: 4, row: 8, facing: 0 } }], hatchery: [],
      hatcheryLevel: 1, hatcheryPlacement: { island: 'home', col: 0, row: 8, facing: 0 }, hoardPlacement: null,
      decorations: [], islands: { homeStep: 0, unlocked: ['home'], obstacles: [] }, constructions: [],
      farms: [
        { crop: null, readyAtMs: 0, level: 1, placement: { island: 'home', col: 10, row: 0, facing: 0 } },
        { crop: null, readyAtMs: 0, level: 1, placement: { island: 'home', col: 10, row: 2, facing: 0 } },
      ],
      pity: {}, oddsBoosts: 0, hoardLevel: 0, earningUnlocked: false,
      sell: { day: 0, soldTodayMicroUsd: 0 }, ledger: { depositedMicroUsd: 0, withdrawnMicroUsd: 0, soldMicroUsd: 0 },
      tutorial: { breedDone: false, hatchDone: false, buildsStarted: 0 }, nextId: 3,
      defenceTeam: null, trophies: 0, pvp: { day: 0, count: 0 }, pve: { cleared: 0, replays: { day: 0, count: 0 } },
    })
  })

  it('starts on a 12x12 home island with the fixed layout', () => {
    const s = newPlayer(0)
    expect(s.habitats.map(h => h.placement)).toEqual([
      { island: 'home', col: 0, row: 0, facing: 0 }, { island: 'home', col: 5, row: 0, facing: 0 }])
    expect(s.farms.map(f => [f.level, f.placement.col, f.placement.row])).toEqual([[1, 10, 0], [1, 10, 2]])
    expect(s.nests).toEqual([{ egg: null, level: 1, placement: { island: 'home', col: 4, row: 8, facing: 0 } }])
    expect([s.hatcheryLevel, s.hatcheryPlacement, s.hoardPlacement]).toEqual([1, { island: 'home', col: 0, row: 8, facing: 0 }, null])
    expect(s.islands).toEqual({ homeStep: 0, unlocked: ['home'], obstacles: [] })
    expect([s.constructions, s.decorations, s.tutorial.buildsStarted]).toEqual([[], [], 0])
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

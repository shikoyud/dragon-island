import { describe, expect, it } from 'vitest'
import { HATCHERY_SLOTS, newPlayer, STATE_VERSION } from '../src/state'

describe('newPlayer', () => {
  it('matches the spec §9 starting state', () => {
    expect(HATCHERY_SLOTS).toBe(3)
    expect(newPlayer(0)).toEqual({
      gold: 1000, food: 100, xp: 0, level: 1,
      dragons: [{ id: 'd1', speciesId: 'flame', level: 1, habitatId: 'h1' }, { id: 'd2', speciesId: 'sea', level: 1, habitatId: 'h2' }],
      habitats: [{ id: 'h1', element: 'flame', level: 1, lastCollectedMs: 0, placement: { island: 'home', col: 0, row: 0, facing: 0 } }, { id: 'h2', element: 'sea', level: 1, lastCollectedMs: 0, placement: { island: 'home', col: 5, row: 0, facing: 0 } }],
      nests: [{ egg: null, level: 1, placement: { island: 'home', col: 4, row: 8, facing: 0 } }], hatchery: [],
      hatcheryLevel: 1, hatcheryPlacement: { island: 'home', col: 0, row: 8, facing: 0 },
      decorations: [], islands: { homeStep: 0, unlocked: ['home'], obstacles: [] }, constructions: [],
      farms: [
        { crop: null, readyAtMs: 0, level: 1, placement: { island: 'home', col: 10, row: 0, facing: 0 } },
        { crop: null, readyAtMs: 0, level: 1, placement: { island: 'home', col: 10, row: 2, facing: 0 } },
      ],
      pity: {}, version: 2,
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
    expect([s.hatcheryLevel, s.hatcheryPlacement]).toEqual([1, { island: 'home', col: 0, row: 8, facing: 0 }])
    expect(s.islands).toEqual({ homeStep: 0, unlocked: ['home'], obstacles: [] })
    expect([s.constructions, s.decorations, s.tutorial.buildsStarted]).toEqual([[], [], 0])
  })

  it('stamps the day counters', () => {
    const s = newPlayer(86_400_000 * 3 + 5)
    expect(s.pvp).toEqual({ day: 3, count: 0 })
    expect(s.pve.replays).toEqual({ day: 3, count: 0 })
  })

  it('stamps the collection time', () => {
    const s = newPlayer(86_400_000 * 3 + 5)
    expect(s.habitats.map(h => h.lastCollectedMs)).toEqual([86_400_000 * 3 + 5, 86_400_000 * 3 + 5])
  })

  it('new players carry the state version and no removed fields', () => {
    const s = newPlayer(0)
    expect(s.version).toBe(STATE_VERSION)
    expect(STATE_VERSION).toBe(2)
    expect(s).not.toHaveProperty('hoardLevel')
    expect(s).not.toHaveProperty('eligibleGold')
    expect(s).not.toHaveProperty('ledger')
    expect(s).not.toHaveProperty('oddsBoosts')
  })
})

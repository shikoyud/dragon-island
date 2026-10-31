import { describe, expect, it } from 'vitest'
import { occupants, overlaps, placementError } from '../src/island'
import { HOME_OBSTACLES } from '../src/data/island-start'
import { newPlayer, STATE_VERSION } from '../src/state'

describe('newPlayer', () => {
  it('matches the spec §9 starting state', () => {
    expect(newPlayer(0)).toEqual({
      gold: 1000, food: 50, xp: 0, level: 1, roostTier: 0, roostPlacement: null,
      dragons: [{ id: 'd1', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' }, { id: 'd2', speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h2' }],
      habitats: [{ id: 'h1', element: 'terra', level: 1, lastCollectedMs: 0, placement: { island: 'home', col: 8, row: 8, facing: 0 } }, { id: 'h2', element: 'flame', level: 1, lastCollectedMs: 0, placement: { island: 'home', col: 12, row: 8, facing: 0 } }],
      breeders: [{ kind: 'mountain', egg: null, level: 1, placement: { island: 'home', col: 8, row: 12, facing: 0 } }], hatchery: [],
      hatcheryLevel: 1, hatcheryFifthSlot: false, hatcheryPlacement: { island: 'home', col: 16, row: 8, facing: 0 },
      decorations: [], islands: { unlocked: ['home'], plots: { home: [5, 6, 9, 10] }, obstacles: HOME_OBSTACLES }, constructions: [], speedUps: { '15m': 0, '1h': 0, '3h': 0 },
      farms: [{ crop: null, readyAtMs: 0, level: 1, placement: { island: 'home', col: 20, row: 8, facing: 0 } }],
      version: 9, firstHybridDone: false, discovered: ['terra', 'flame'],
      goalIndex: 0, goalStats: { collects: 0, harvests: 0, feeds: 0, breeds: 0, hatches: 0 }, nextId: 3,
      defenceTeam: null, trophies: 0, pvp: { day: 0, count: 0 }, pve: { cleared: 0, replays: { day: 0, count: 0 } },
    })
  })

  it("starts on Home's centre plots with the fixed layout (R50)", () => {
    const s = newPlayer(0)
    expect(s.habitats.map(h => h.placement)).toEqual([
      { island: 'home', col: 8, row: 8, facing: 0 }, { island: 'home', col: 12, row: 8, facing: 0 }])
    expect(s.farms.map(f => [f.level, f.placement.col, f.placement.row])).toEqual([[1, 20, 8]])
    expect(s.breeders).toEqual([{ kind: 'mountain', egg: null, level: 1, placement: { island: 'home', col: 8, row: 12, facing: 0 } }])
    expect([s.hatcheryLevel, s.hatcheryPlacement]).toEqual([1, { island: 'home', col: 16, row: 8, facing: 0 }])
    expect(s.islands).toEqual({ unlocked: ['home'], plots: { home: [5, 6, 9, 10] }, obstacles: HOME_OBSTACLES })
    expect([s.constructions, s.decorations]).toEqual([[], []])
    expect(s).not.toHaveProperty('tutorial')
  })

  it('lays the starting buildings out without overlap, on legal cells (R1, R9)', () => {
    const s = newPlayer(0)
    const occ = occupants(s, 'home')
    expect(occ).toHaveLength(5 + HOME_OBSTACLES.length)
    for (const o of occ) {
      expect(placementError(s, { island: 'home', col: o.col, row: o.row, facing: 0 }, o.size, o.ref)).toBeNull()
    }
    for (const [i, a] of occ.entries()) for (const b of occ.slice(i + 1)) expect(overlaps(a, b)).toBe(false)
  })

  it('has a Terra and a Flame habitat with one Lv 1 Basic each', () => {
    const s = newPlayer(0)
    expect(s.habitats.map(h => h.element)).toEqual(['terra', 'flame'])
    expect(s.dragons.map(d => [d.speciesId, d.habitatId])).toEqual([['terra', 'h1'], ['flame', 'h2']])
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
    expect(STATE_VERSION).toBe(9)
    expect(s).not.toHaveProperty('hoardLevel')
    expect(s).not.toHaveProperty('eligibleGold')
    expect(s).not.toHaveProperty('ledger')
    expect(s).not.toHaveProperty('oddsBoosts')
  })
})

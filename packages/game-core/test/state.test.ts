import { describe, expect, it } from 'vitest'
import { occupants, overlaps, placementError } from '../src/island'
import { newPlayer, STATE_VERSION } from '../src/state'

describe('newPlayer', () => {
  it('matches the spec §9 starting state', () => {
    expect(newPlayer(0)).toEqual({
      gold: 1000, food: 50, xp: 0, level: 1, roostTier: 0, roostPlacement: null,
      dragons: [{ id: 'd1', speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' }, { id: 'd2', speciesId: 'flame', level: 1, feeds: 0, habitatId: 'h2' }],
      habitats: [{ id: 'h1', element: 'terra', level: 1, lastCollectedMs: 0, placement: { island: 'home', col: 0, row: 0, facing: 0 } }, { id: 'h2', element: 'flame', level: 1, lastCollectedMs: 0, placement: { island: 'home', col: 5, row: 0, facing: 0 } }],
      breeders: [{ kind: 'mountain', egg: null, level: 1, placement: { island: 'home', col: 4, row: 8, facing: 0 } }], hatchery: [],
      hatcheryLevel: 1, hatcheryFifthSlot: false, hatcheryPlacement: { island: 'home', col: 0, row: 8, facing: 0 },
      decorations: [], islands: { homeStep: 0, unlocked: ['home'], obstacles: [] }, constructions: [],
      farms: [{ crop: null, readyAtMs: 0, level: 1, placement: { island: 'home', col: 10, row: 0, facing: 0 } }],
      version: 5, firstHybridDone: false, discovered: ['terra', 'flame'],
      tutorial: { breedDone: false, hatchDone: false }, nextId: 3,
      defenceTeam: null, trophies: 0, pvp: { day: 0, count: 0 }, pve: { cleared: 0, replays: { day: 0, count: 0 } },
    })
  })

  it('starts on a 12x12 home island with the fixed layout', () => {
    const s = newPlayer(0)
    expect(s.habitats.map(h => h.placement)).toEqual([
      { island: 'home', col: 0, row: 0, facing: 0 }, { island: 'home', col: 5, row: 0, facing: 0 }])
    expect(s.farms.map(f => [f.level, f.placement.col, f.placement.row])).toEqual([[1, 10, 0]])
    expect(s.breeders).toEqual([{ kind: 'mountain', egg: null, level: 1, placement: { island: 'home', col: 4, row: 8, facing: 0 } }])
    expect([s.hatcheryLevel, s.hatcheryPlacement]).toEqual([1, { island: 'home', col: 0, row: 8, facing: 0 }])
    expect(s.islands).toEqual({ homeStep: 0, unlocked: ['home'], obstacles: [] })
    expect([s.constructions, s.decorations]).toEqual([[], []])
    expect(s.tutorial).toEqual({ breedDone: false, hatchDone: false })
  })

  it('lays the starting buildings out without overlap, on legal cells (R1, R9)', () => {
    const s = newPlayer(0)
    const occ = occupants(s, 'home')
    expect(occ).toHaveLength(5)
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
    expect(STATE_VERSION).toBe(5)
    expect(s).not.toHaveProperty('hoardLevel')
    expect(s).not.toHaveProperty('eligibleGold')
    expect(s).not.toHaveProperty('ledger')
    expect(s).not.toHaveProperty('oddsBoosts')
  })
})

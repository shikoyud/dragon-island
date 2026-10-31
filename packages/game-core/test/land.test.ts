import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { DECORATIONS } from '../src/decorations'
import { FOOTPRINT, occupants, overlaps, placementError } from '../src/island'
import { obstacleMult } from '../src/obstacles'
import { ownedPlots, ownsFootprint, plotError, plotsBought, plotsTouch, STARTING_PLOTS } from '../src/plots'
import { buildXp } from '../src/progression'
import { createRng } from '../src/rng'
import { newPlayer, STATE_VERSION, type IslandId, type Placement, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'
import { withPlots } from './helpers/land'

const base = newPlayer(0)
const run = (s: PlayerState, a: Action) => applyAction(s, a, 0, createRng(1), FIXTURE_CATALOG)
const P = (col: number, row: number, island: IslandId = 'home'): Placement => ({ island, col, row, facing: 0 })
const buy = (s: PlayerState, plot: number, island: IslandId = 'home') => run(s, { type: 'buyPlot', island, plot })

describe('the start (§5.5, R50)', () => {
  it('owns the centre 2x2 of Home, on a new state version', () => {
    expect(base.islands.plots.home).toEqual([5, 6, 9, 10])
    expect(base.islands.unlocked).toEqual(['home'])
    expect(base.islands.obstacles).toEqual([])
    expect(base.islands).not.toHaveProperty('homeStep')
    expect(STATE_VERSION).toBe(8)
  })
  it('places the buildings on the fixed table', () => {
    expect(base.habitats.map(h => [h.element, h.placement])).toEqual([['terra', P(8, 8)], ['flame', P(12, 8)]])
    expect(base.hatcheryPlacement).toEqual(P(16, 8))
    expect(base.farms.map(f => [f.level, f.placement])).toEqual([[1, P(20, 8)]])
    expect(base.breeders.map(b => [b.kind, b.placement])).toEqual([['mountain', P(8, 12)]])
  })
  it('nothing overlaps and everything stands on owned land', () => {
    const occ = occupants(base, 'home')
    expect(occ).toHaveLength(5)
    occ.forEach((a, i) => occ.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)))
    for (const o of occ) expect(ownsFootprint(base, P(o.col, o.row), o.size)).toBe(true)
  })
})

describe('footprints (§5.4)', () => {
  it('are the GDD sizes', () => {
    expect(FOOTPRINT).toEqual({ habitat: 4, hatchery: 4, farm: 3, breeder: 5, roost: 4 })
  })
  it('leave decoration sizes alone', () => {
    expect(DECORATIONS.stonePath.size).toBe(1)
    expect(DECORATIONS.dragonColossus.size).toBe(3)
  })
})

describe('placement on owned land (R43)', () => {
  it('a habitat inside the holding is legal, one tile over is NOT_OWNED', () => {
    expect(placementError(base, P(20, 12), FOOTPRINT.habitat)).toBeNull()
    expect(placementError(base, P(21, 12), FOOTPRINT.habitat)).toBe('NOT_OWNED')
  })
  it('off the island is OUT_OF_BOUNDS, ahead of ownership', () => {
    expect(placementError(base, P(-1, 8), FOOTPRINT.habitat)).toBe('OUT_OF_BOUNDS')
    expect(placementError(base, P(29, 8), FOOTPRINT.habitat)).toBe('OUT_OF_BOUNDS')
  })
  it('a locked island comes first, overlap last', () => {
    expect(placementError(base, P(99, 99, 'isle2'), FOOTPRINT.habitat)).toBe('ISLAND_LOCKED')
    expect(placementError(base, P(8, 8), FOOTPRINT.habitat)).toBe('OVERLAP')
    expect(placementError(base, P(0, 0), FOOTPRINT.habitat)).toBe('NOT_OWNED')
  })
  it('a move ignores the mover, and still needs owned land', () => {
    expect(placementError(base, P(8, 8), FOOTPRINT.habitat, { type: 'habitat', id: 'h1' })).toBeNull()
    expect(placementError(base, P(0, 0), FOOTPRINT.habitat, { type: 'habitat', id: 'h1' })).toBe('NOT_OWNED')
  })
  it('straddling two owned plots is legal once the plot is bought', () => {
    const a = ok(buy({ ...base, level: 2 }, 7))
    expect(placementError(a, P(21, 12), FOOTPRINT.habitat)).toBeNull()
    expect(ok(run({ ...a, gold: 10_000 }, { type: 'placeBuilding', building: { kind: 'habitat', element: 'terra' }, placement: P(21, 12) })).habitats).toHaveLength(3)
  })
  it('a notch in an L-shaped holding refuses a 5x5 that touches it', () => {
    const l = withPlots(base, [5, 6, 9, 10, 7])
    expect(placementError(l, P(22, 15), FOOTPRINT.breeder)).toBe('NOT_OWNED')
    expect(ownsFootprint(l, P(22, 15), FOOTPRINT.breeder)).toBe(false)
    expect(ownsFootprint(l, P(22, 11), FOOTPRINT.breeder)).toBe(true)
    err(run({ ...l, level: 12, gold: 1_000_000 }, { type: 'placeBuilding', building: { kind: 'grove' }, placement: P(22, 15) }), 'NOT_OWNED')
  })
  it('a move is refused off owned land by the handler', () => {
    err(run(base, { type: 'moveBuilding', target: { type: 'habitat', id: 'h1' }, placement: P(0, 0) }), 'NOT_OWNED')
  })
})

describe('plot helpers', () => {
  it('count what was bought past the first four', () => {
    expect(ownedPlots(base, 'home')).toEqual(STARTING_PLOTS)
    expect(plotsBought(base, 'home')).toBe(0)
    expect(plotsBought(withPlots(base, [...STARTING_PLOTS, 4, 7]), 'home')).toBe(2)
    expect(ownedPlots(base, 'isle2')).toEqual([])
    expect(plotsBought(base, 'isle2')).toBe(0)
  })
  it('plotsTouch is false for an index outside 0..15', () => {
    expect(plotsTouch(15, 14)).toBe(true)
    expect(plotsTouch(15, 16)).toBe(false)
    expect(plotsTouch(-1, 0)).toBe(false)
    expect(plotsTouch(12, 16)).toBe(false)
    expect(plotsTouch(3, 4)).toBe(false)
  })
  it('plotError leaves Gold to the handler', () => {
    expect(plotError({ ...base, level: 2, gold: 0 }, 'home', 4)).toBeNull()
  })
})

describe('buyPlot (§5.5, R44-R47)', () => {
  it('prices by the count bought, pays build XP, adds the plot', () => {
    const s = { ...base, level: 2, gold: 600 }
    const a = ok(buy(s, 4))
    expect(a.gold).toBe(500)
    expect(a.xp).toBe(s.xp + buildXp(100, s))
    expect(a.islands.plots.home).toEqual([5, 6, 9, 10, 4])
    const b = ok(buy(a, 8)) // touches 4 and 9
    expect(b.gold).toBe(0)
    expect(b.islands.plots.home).toContain(8)
  })
  it('a third at PL 2 is LEVEL_TOO_LOW with nothing charged', () => {
    const two = withPlots({ ...base, level: 2, gold: 10_000 }, [5, 6, 9, 10, 4, 8])
    err(buy(two, 7), 'LEVEL_TOO_LOW')
    expect(ok(buy({ ...two, level: 3 }, 7)).gold).toBe(8_500)
  })
  it('price reads the count, not the position', () => {
    expect(ok(buy({ ...base, level: 2 }, 7)).gold).toBe(base.gold - 100)
  })
  it('refuses a plot that touches nothing, or only at a corner (R44)', () => {
    err(buy({ ...base, level: 2 }, 0), 'PLOT_NOT_ADJACENT')
  })
  it('refuses an owned plot, charging nothing', () => {
    err(buy({ ...base, level: 2 }, 5), 'PLOT_OWNED')
  })
  it('too little Gold is INSUFFICIENT_GOLD', () => {
    err(buy({ ...base, level: 2, gold: 99 }, 4), 'INSUFFICIENT_GOLD')
  })
  it('a level below the gate is LEVEL_TOO_LOW', () => {
    err(buy(base, 4), 'LEVEL_TOO_LOW')
  })
  it('a bad index or island is INVALID_ACTION', () => {
    for (const plot of [16, -1, 1.5]) err(buy({ ...base, level: 2 }, plot), 'INVALID_ACTION')
    err(run(base, { type: 'buyPlot', island: 'atlantis' as IslandId, plot: 4 }), 'INVALID_ACTION')
  })
  it('a plot on a locked island is ISLAND_LOCKED', () => {
    err(buy({ ...base, level: 50, gold: 10_000_000 }, 4, 'isle2'), 'ISLAND_LOCKED')
  })
  it('runs out of no plots: the twelfth Home plot costs 75,000 at PL 12', () => {
    const all = [5, 6, 9, 10, 4, 8, 7, 11, 1, 2, 13, 14, 0, 3, 12]
    const a = ok(buy(withPlots({ ...base, level: 12, gold: 75_000 }, all), 15))
    expect(a.gold).toBe(0)
    expect(a.islands.plots.home).toHaveLength(16)
  })
})

describe('buyBridge (§5.5, R42, R47)', () => {
  const bridge = (s: PlayerState, island: Exclude<IslandId, 'home'>) => run(s, { type: 'buyBridge', island })
  it('waits for its Player Level', () => {
    err(bridge({ ...base, level: 11, gold: 150_000 }, 'isle2'), 'LEVEL_TOO_LOW')
  })
  it('opens the island with its 4 centre plots, pays build XP, and its first plot costs 100,000', () => {
    const s = { ...base, level: 12, gold: 150_000 }
    const a = ok(bridge(s, 'isle2'))
    expect(a.gold).toBe(0)
    expect(a.islands.unlocked).toEqual(['home', 'isle2'])
    expect(a.islands.plots.isle2).toEqual([5, 6, 9, 10])
    expect(a.xp).toBe(s.xp + buildXp(150_000, s))
    const b = ok(buy({ ...a, gold: 100_000 }, 4, 'isle2'))
    expect(b.gold).toBe(0)
    expect(b.islands.plots.isle2).toContain(4)
  })
  it('too little Gold is INSUFFICIENT_GOLD', () => {
    err(bridge({ ...base, level: 12, gold: 149_999 }, 'isle2'), 'INSUFFICIENT_GOLD')
  })
  it('goes in order', () => {
    err(bridge({ ...base, level: 18, gold: 10_000_000 }, 'isle3'), 'ISLAND_LOCKED')
  })
  it('a second time is PLOT_OWNED, charging nothing', () => {
    const a = ok(bridge({ ...base, level: 12, gold: 300_000 }, 'isle2'))
    err(bridge(a, 'isle2'), 'PLOT_OWNED')
  })
  it('Warlord\'s Crown needs no Legendary (R42)', () => {
    const five: PlayerState = { ...base, level: 40, gold: 100_000_000, islands: { ...base.islands, unlocked: ['home', 'isle2', 'isle3', 'isle4', 'isle5'] } }
    expect(ok(bridge(five, 'isle6')).islands.unlocked.at(-1)).toBe('isle6')
  })
  it('home has no Bridge', () => {
    err(run(base, { type: 'buyBridge', island: 'home' } as unknown as Action), 'INVALID_ACTION')
  })
  it('outer plots have no PL gate beyond the Bridge (R47)', () => {
    const s = withPlots({ ...base, level: 12, gold: 10_000_000, islands: { ...base.islands, unlocked: ['home', 'isle2'] } }, [5, 6, 9, 10], 'isle2')
    let a = s
    for (const plot of [4, 8, 7, 11, 1, 2, 13, 14, 0, 3, 12, 15]) a = ok(buy(a, plot, 'isle2'))
    expect(a.islands.plots.isle2).toHaveLength(16)
    expect(s.gold - a.gold).toBe(2_870_000) // R49: the price list governs
  })
})

describe('obstacleMult (§5.6)', () => {
  it('reads ISLANDS', () => {
    expect((['home', 'isle2', 'isle3', 'isle4', 'isle5', 'isle6'] as const).map(obstacleMult)).toEqual([1, 3, 10, 40, 150, 500])
  })
})

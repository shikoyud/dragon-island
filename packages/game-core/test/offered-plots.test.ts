import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { plotPrice } from '../src/data/islands'
import { OBSTACLES, type ObstacleKind } from '../src/data/obstacles'
import { occupants } from '../src/island'
import { OBSTACLE_GAP, obstaclesApart, spawnPlotObstacles } from '../src/obstacles'
import { HOME_PLOT_ORDER, offeredPlots, ownedPlots, plotError, plotOfTile, plotOrigin, STARTING_PLOTS, TILES_PER_PLOT } from '../src/plots'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'
import { withPlots } from './helpers/land'

const run = (s: PlayerState, a: Action, seed = 1) => applyAction(s, a, 0, createRng(seed), FIXTURE_CATALOG)
const base = newPlayer(0)
const sizeOf = (o: { kind: ObstacleKind }) => OBSTACLES[o.kind].size
const plotsOf = (o: { kind: ObstacleKind; col: number; row: number }) =>
  new Set([plotOfTile(o.col, o.row), plotOfTile(o.col + sizeOf(o) - 1, o.row + sizeOf(o) - 1)])
const onPlot = (plot: number) => base.islands.obstacles.filter(o => [...plotsOf(o)].every(p => p === plot))

describe('offered plots on Home (U1)', () => {
  it('keeps the fixed order', () => {
    expect(HOME_PLOT_ORDER).toEqual([2, 7, 11, 1, 14, 13, 4, 8, 3, 15, 0, 12])
  })
  it('offers exactly 3 on Home, from the fixed order', () => {
    expect(offeredPlots(newPlayer(0), 'home')).toEqual([2, 7, 11])
  })
  it('buying an offered plot reveals the next one', () => {
    const s = ok(run({ ...newPlayer(0), level: 2, gold: 1_000 }, { type: 'buyPlot', island: 'home', plot: 7 }))
    expect(offeredPlots(s, 'home')).toEqual([2, 11, 1])
  })
  it('refuses a plot not offered, charging nothing', () => {
    expect(plotError({ ...newPlayer(0), level: 2 }, 'home', 4)).toBe('PLOT_NOT_OFFERED')
    err(run({ ...base, level: 2, gold: 1_000 }, { type: 'buyPlot', island: 'home', plot: 4 }), 'PLOT_NOT_OFFERED')
    expect(plotError({ ...base, level: 2 }, 'home', 0)).toBe('PLOT_NOT_ADJACENT')
    expect(plotError({ ...base, level: 2 }, 'home', 5)).toBe('PLOT_OWNED')
    expect(plotError({ ...base, level: 2 }, 'home', 7)).toBeNull()
  })
  it('works on arbitrary ownership: the first 3 unowned that touch owned land', () => {
    expect(offeredPlots(withPlots(base, [5, 6, 9, 10, 2, 7, 11, 1, 14]), 'home')).toEqual([13, 4, 8])
    expect(offeredPlots(withPlots(base, [0]), 'home')).toEqual([1, 4])
    expect(offeredPlots(withPlots(base, [], 'home'), 'home')).toEqual([])
  })
  it('offers every unowned plot touching owned land on other islands, as M4', () => {
    const s = withPlots({ ...base, islands: { ...base.islands, unlocked: ['home', 'isle2'] } }, [5, 6, 9, 10], 'isle2')
    expect(offeredPlots(s, 'isle2')).toEqual([1, 2, 4, 7, 8, 11, 13, 14])
    expect(offeredPlots(base, 'isle3')).toEqual([])
  })
  it('all 12 plots stay reachable at the same prices, then none is offered', () => {
    let s: PlayerState = { ...base, level: 50, gold: 10_000_000 }
    const start = s.gold
    for (let i = 0; i < 12; i++) {
      const [next] = offeredPlots(s, 'home')
      expect(next, `purchase ${i}`).toBe(HOME_PLOT_ORDER[i])
      s = ok(run(s, { type: 'buyPlot', island: 'home', plot: next! }, i + 1))
    }
    expect(ownedPlots(s, 'home')).toHaveLength(16)
    expect(offeredPlots(s, 'home')).toEqual([])
    expect(plotPrice('home', 12)).toBeNull()
    let total = 0
    for (let i = 0; i < 12; i++) total += plotPrice('home', i)!
    expect(start - s.gold).toBe(total)
  })
})

describe('obstacles around a bought Home plot (U4)', () => {
  it('reveal spawns 2-4 on the new plot only, and nothing on the plot bought', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const before = { ...base, level: 12, gold: 1_000_000 }
      // 7 is bought; offered goes [2,7,11] -> [2,11,1], so only plot 1 is newly offered.
      const after = ok(run(before, { type: 'buyPlot', island: 'home', plot: 7 }, seed))
      const fresh = after.islands.obstacles.filter(o => !before.islands.obstacles.includes(o))
      // Plot 1 sits against Home's buildings and plot 2's Boulder: when the gap leaves no room an obstacle is skipped (U7), so a
      // big roll (seeds 27 and 44) can leave 1. Never 0 and never more than 4.
      expect(fresh.length).toBeGreaterThanOrEqual(1)
      expect(fresh.length).toBeLessThanOrEqual(4)
      for (const x of fresh) expect([plotOfTile(x.col, x.row), plotOfTile(x.col + sizeOf(x) - 1, x.row + sizeOf(x) - 1)]).toEqual([1, 1])
      expect(after.nextId).toBe(before.nextId + fresh.length)
    }
  })
  it('a clear on an unowned plot fails PLOT_LOCKED, and works once bought', () => {
    const o = onPlot(2)[0]!
    const rich = { ...base, level: 12, gold: 1_000_000 }
    err(run(rich, { type: 'clearObstacle', obstacleId: o.id }), 'PLOT_LOCKED')
    const bought = ok(run(rich, { type: 'buyPlot', island: 'home', plot: 2 }))
    const r = ok(run(bought, { type: 'clearObstacle', obstacleId: o.id }))
    expect(r.constructions).toHaveLength(1)
  })
})

describe('Home start table (U6)', () => {
  it('8 on owned land, 28 tiles, no Ancient Tree or Boulder there', () => {
    const owned = base.islands.obstacles.filter(o => [...plotsOf(o)].every(p => STARTING_PLOTS.includes(p!)))
    expect(owned).toHaveLength(8)
    expect(owned.reduce((n, o) => n + sizeOf(o) ** 2, 0)).toBe(28)
    expect(owned.some(o => o.kind === 'ancientTree' || o.kind === 'boulder')).toBe(false)
  })
  it('plots 2, 7 and 11 hold 3 each, and nothing else exists', () => {
    expect([2, 7, 11].map(p => onPlot(p).length)).toEqual([3, 3, 3])
    expect(base.islands.obstacles).toHaveLength(17)
    expect(onPlot(2).map(o => o.kind)).toEqual(['boulder', 'tree', 'bush'])
    expect(onPlot(7).map(o => o.kind)).toEqual(['ancientTree', 'smallRock', 'bush'])
    expect(onPlot(11).map(o => o.kind)).toEqual(['largeRock', 'tree', 'bush'])
  })
  it('no two obstacles closer than the gap', () => {
    const all = base.islands.obstacles
    all.forEach((a, i) => all.slice(i + 1).forEach(b =>
      expect(obstaclesApart(a, sizeOf(a), b, sizeOf(b)), `${a.id} / ${b.id}`).toBe(true)))
  })
})

describe('the spawn gap (U7)', () => {
  it('has a gap of 2, and measures empty tiles on one axis', () => {
    expect(OBSTACLE_GAP).toBe(2)
    const a = { col: 0, row: 0 }
    expect(obstaclesApart(a, 2, { col: 4, row: 0 }, 1)).toBe(true) // tiles 2,3 empty
    expect(obstaclesApart(a, 2, { col: 3, row: 0 }, 1)).toBe(false) // only tile 2
    expect(obstaclesApart(a, 2, { col: 3, row: 4 }, 1)).toBe(true) // clear on rows
    expect(obstaclesApart(a, 2, { col: 3, row: 3 }, 1)).toBe(false) // diagonal, 1 apart each way
    expect(obstaclesApart({ col: 3, row: 3 }, 1, a, 2)).toBe(false)
    expect(obstaclesApart({ col: 4, row: 3 }, 1, a, 2)).toBe(true)
  })
  it('keeps the gap in every spawn, over 200 seeds on every plot', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const plot = seed % 16
      const out = spawnPlotObstacles('isle3', plot, 40, createRng(seed), [])
      out.forEach((a, i) => out.slice(i + 1).forEach(b => expect(obstaclesApart(a, sizeOf(a), b, sizeOf(b)), `seed ${seed}`).toBe(true)))
      expect(out.length).toBeGreaterThanOrEqual(2)
      expect(out.length).toBeLessThanOrEqual(4)
    }
  })
  it('keeps the gap from buildings and from neighbouring plots', () => {
    const bare = { ...base, islands: { ...base.islands, obstacles: [] } }
    const around = occupants(bare, 'home').map(o => ({ col: o.col, row: o.row, size: o.size }))
    for (let seed = 1; seed <= 200; seed++) {
      const plot = STARTING_PLOTS[seed % 4]!
      // a neighbour's obstacle right on the shared edge
      const o = plotOrigin(plot)
      const occupied = [...around, { col: o.col + TILES_PER_PLOT - 1, row: o.row + 3, size: 1 }]
      const out = spawnPlotObstacles('home', plot, 40, createRng(seed), occupied)
      for (const x of out) for (const b of occupied) expect(obstaclesApart(x, sizeOf(x), b, b.size), `seed ${seed} ${x.kind}`).toBe(true)
    }
  })
  it('drops to a smaller kind when the gap leaves no room; the count stays 2..4', () => {
    const o = plotOrigin(5)
    // A bush on the plot's centre-ish tile: no 4x4 or 3x3 fits next to it in its own quadrant.
    const occupied = [{ col: o.col + 4, row: o.row + 4, size: 1 }]
    for (let seed = 1; seed <= 200; seed++) {
      const out = spawnPlotObstacles('home', 5, 40, createRng(seed), occupied)
      expect(out.length).toBeGreaterThanOrEqual(2)
      expect(out.length).toBeLessThanOrEqual(4)
      for (const x of out) {
        expect(obstaclesApart(x, sizeOf(x), occupied[0]!, 1)).toBe(true)
        if (x.col >= o.col + 4 && x.row >= o.row + 4) expect(sizeOf(x)).toBe(1)
      }
    }
  })
  it('is deterministic for a seed', () => {
    expect(spawnPlotObstacles('home', 0, 3, createRng(7), [])).toEqual(spawnPlotObstacles('home', 0, 3, createRng(7), []))
  })
})

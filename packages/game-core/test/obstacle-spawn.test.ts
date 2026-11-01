import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { HOME_OBSTACLES } from '../src/data/island-start'
import { MAX_CLEARS, OBSTACLE_SPAWN, OBSTACLES, type ObstacleKind } from '../src/data/obstacles'
import { FLASH_14, FLASH_28 } from '../src/data/presets'
import { SPEED_UP_TOKEN_MS } from '../src/data/speedups'
import { occupants, overlaps } from '../src/island'
import { clearCost, clearReward, clearTimerMs, rollDrop, spawnPlotObstacles } from '../src/obstacles'
import { cumulativeXp, levelLimit, xpToNext } from '../src/progression'
import { ISLAND_TILES, plotOrigin, STARTING_PLOTS, TILES_PER_PLOT } from '../src/plots'
import { createRng } from '../src/rng'
import { newPlayer, STATE_VERSION, type IslandId, type Obstacle, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const run = (st: PlayerState, a: Action, t = 0, seed = 1) => applyAction(st, a, t, createRng(seed), FIXTURE_CATALOG)
const base = newPlayer(0)
const rich: PlayerState = { ...base, gold: 1_000_000_000, level: 30 }
const one = (kind: ObstacleKind, island: IslandId = 'home'): Obstacle => ({ id: 'ox', kind, island, col: 8, row: 8 })
const KINDS = Object.keys(OBSTACLES) as ObstacleKind[]

describe('the §5.6 table', () => {
  it('holds the literal values', () => {
    const row = (k: ObstacleKind) => [OBSTACLES[k].size, OBSTACLES[k].gold, OBSTACLES[k].classicMs, OBSTACLES[k].xp, OBSTACLES[k].drop]
    expect(row('ancientTree')).toEqual([4, 25_000, 14_400_000, 1_250, { percent: 10, token: '3h' }])
    expect(row('boulder')).toEqual([4, 25_000, 14_400_000, 1_250, { percent: 10, token: '3h' }])
    expect(row('largeRock')).toEqual([3, 5_000, 3_600_000, 250, { percent: 5, token: '1h' }])
    expect(row('tree')).toEqual([2, 1_000, 900_000, 50, { percent: 5, token: '15m' }])
    expect(row('smallRock')).toEqual([2, 500, 300_000, 25, { percent: 10, gold: [100, 300] }])
    expect(row('bush')).toEqual([1, 100, 30_000, 5, { percent: 10, food: [10, 25] }])
    expect(OBSTACLE_SPAWN).toEqual({ min: 2, max: 4, weights: { ancientTree: 1, boulder: 1, largeRock: 2, tree: 4, smallRock: 4, bush: 8 } })
    expect(MAX_CLEARS).toBe(2)
    expect(SPEED_UP_TOKEN_MS).toEqual({ '15m': 900_000, '1h': 3_600_000, '3h': 10_800_000 })
  })
  it('scales Gold by the island and XP not at all (R52)', () => {
    expect(clearCost(one('bush', 'isle6'))).toBe(50_000)
    expect(clearCost(one('ancientTree', 'isle2'))).toBe(75_000)
    expect(clearReward(one('bush', 'isle6'))).toEqual({ xp: 5 })
    expect(clearReward(one('bush', 'home'))).toEqual({ xp: 5 })
  })
  it('divides the timer by the preset (R53)', () => {
    expect(clearTimerMs('ancientTree', FLASH_14)).toBe(2_400_000)
    expect(clearTimerMs('ancientTree', FLASH_28)).toBe(3_600_000)
    expect(clearTimerMs('bush', FLASH_14)).toBe(5_000)
  })
})

describe('Home\'s start (R50)', () => {
  it('is a new state version with exactly the fixed rows', () => {
    expect(STATE_VERSION).toBe(11)
    expect(base.version).toBe(11)
    expect(base.speedUps).toEqual({ '15m': 0, '1h': 0, '3h': 0 })
    expect(base.islands.obstacles).toEqual(HOME_OBSTACLES)
    expect(base.nextId).toBe(3)
    const count = (k: ObstacleKind) => base.islands.obstacles.filter(o => o.kind === k).length
    expect(KINDS.map(count)).toEqual([1, 1, 1, 3, 3, 12])
    const at = (k: ObstacleKind) => base.islands.obstacles.filter(o => o.kind === k).map(o => [o.col, o.row])
    expect(at('ancientTree')).toEqual([[20, 20]])
    expect(at('boulder')).toEqual([[8, 20]])
    expect(at('largeRock')).toEqual([[20, 16]])
    expect(at('tree')).toEqual([[13, 21], [17, 20], [8, 18]])
    expect(at('smallRock')).toEqual([[15, 22], [10, 18], [18, 22]])
    expect(at('bush')).toEqual([[22, 11], [23, 11], [21, 11], [12, 18], [12, 21], [14, 20], [16, 21], [13, 23], [17, 23], [19, 20], [23, 16], [20, 19]])
  })
  it('covers a third of the starting plots, clear of the buildings and of itself', () => {
    const tiles = base.islands.obstacles.reduce((n, o) => n + OBSTACLES[o.kind].size ** 2, 0)
    const total = STARTING_PLOTS.length * TILES_PER_PLOT ** 2
    expect(tiles).toBe(77)
    expect(tiles / total).toBeGreaterThanOrEqual(0.25)
    expect(tiles / total).toBeLessThanOrEqual(0.35)
    const all = occupants(base, 'home')
    all.forEach((a, i) => all.slice(i + 1).forEach(b => expect(overlaps(a, b), `${JSON.stringify(a.ref)} / ${JSON.stringify(b.ref)}`).toBe(false)))
    for (const o of base.islands.obstacles) {
      const size = OBSTACLES[o.kind].size
      for (const [c, r] of [[o.col, o.row], [o.col + size - 1, o.row + size - 1]] as const) {
        expect(STARTING_PLOTS).toContain(Math.floor(r / TILES_PER_PLOT) * 4 + Math.floor(c / TILES_PER_PLOT))
      }
    }
  })
  it('gives every starting obstacle its own id, clear of the d, h and c ids', () => {
    const ids = base.islands.obstacles.map(o => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(id => /^os\d+$/.test(id))).toBe(true)
  })
})

describe('spawning on a plot (R51)', () => {
  it('puts 2 to 4 obstacles inside the plot, none overlapping, over 200 seeds', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const plot = seed % 16
      const out = spawnPlotObstacles('isle3', plot, 40, createRng(seed))
      expect(out.length).toBeGreaterThanOrEqual(2)
      expect(out.length).toBeLessThanOrEqual(4)
      const o = plotOrigin(plot)
      for (const x of out) {
        const size = OBSTACLES[x.kind].size
        expect(x.island).toBe('isle3')
        expect(x.col).toBeGreaterThanOrEqual(o.col)
        expect(x.row).toBeGreaterThanOrEqual(o.row)
        expect(x.col + size).toBeLessThanOrEqual(o.col + TILES_PER_PLOT)
        expect(x.row + size).toBeLessThanOrEqual(o.row + TILES_PER_PLOT)
        expect(x.col + size).toBeLessThanOrEqual(ISLAND_TILES)
      }
      out.forEach((a, i) => out.slice(i + 1).forEach(b => expect(overlaps({ ...a, size: OBSTACLES[a.kind].size }, { ...b, size: OBSTACLES[b.kind].size })).toBe(false)))
      expect(out.map(x => x.id)).toEqual(out.map((_, i) => `o${40 + i}`))
    }
  })
  it('is deterministic for a seed, and reaches every count and kind', () => {
    expect(spawnPlotObstacles('home', 0, 3, createRng(7))).toEqual(spawnPlotObstacles('home', 0, 3, createRng(7)))
    const counts = new Set<number>()
    const kinds = new Set<string>()
    for (let seed = 1; seed <= 400; seed++) {
      const out = spawnPlotObstacles('home', 0, 3, createRng(seed))
      counts.add(out.length)
      out.forEach(o => kinds.add(o.kind))
    }
    expect([...counts].sort()).toEqual([2, 3, 4])
    expect([...kinds].sort()).toEqual([...KINDS].sort())
  })
  it('a bought plot spawns on its own tiles and advances nextId by the count', () => {
    const r = ok(run({ ...rich, level: 30 }, { type: 'buyPlot', island: 'home', plot: 4 }, 0, 5))
    const fresh = r.islands.obstacles.filter(o => !base.islands.obstacles.includes(o))
    expect(fresh.length).toBeGreaterThanOrEqual(2)
    expect(fresh.length).toBeLessThanOrEqual(4)
    expect(r.nextId).toBe(base.nextId + fresh.length)
    expect(fresh.map(o => o.id)).toEqual(fresh.map((_, i) => `o${base.nextId + i}`))
    const o = plotOrigin(4)
    for (const x of fresh) expect([x.col >= o.col, x.col < o.col + 8, x.row >= o.row, x.row < o.row + 8]).toEqual([true, true, true, true])
  })
  it('a Bridge spawns on all 4 of its plots, ids unique across them (R48)', () => {
    const r = ok(run({ ...rich, level: 30 }, { type: 'buyBridge', island: 'isle2' }, 0, 9))
    const fresh = r.islands.obstacles.filter(o => o.island === 'isle2')
    expect(fresh.length).toBeGreaterThanOrEqual(8)
    expect(fresh.length).toBeLessThanOrEqual(16)
    for (const plot of STARTING_PLOTS) {
      const o = plotOrigin(plot)
      const here = fresh.filter(x => x.col >= o.col && x.col < o.col + 8 && x.row >= o.row && x.row < o.row + 8)
      expect(here.length, `plot ${plot}`).toBeGreaterThanOrEqual(2)
    }
    expect(new Set(r.islands.obstacles.map(o => o.id)).size).toBe(r.islands.obstacles.length)
    expect(r.nextId).toBe(base.nextId + fresh.length)
    const all = occupants(r, 'isle2')
    all.forEach((a, i) => all.slice(i + 1).forEach(b => expect(overlaps(a, b)).toBe(false)))
  })
  it('replays the same obstacles from the same seed and action', () => {
    const go = () => ok(run({ ...rich }, { type: 'buyPlot', island: 'home', plot: 4 }, 0, 11)).islands.obstacles
    expect(go()).toEqual(go())
    const other = ok(run({ ...rich }, { type: 'buyPlot', island: 'home', plot: 4 }, 0, 12)).islands.obstacles
    expect(other).not.toEqual(go())
  })
})

const bush = base.islands.obstacles.filter(o => o.kind === 'bush')
const clear = (id: string): Action => ({ type: 'clearObstacle', obstacleId: id })

describe('two clears at once (M4 Q1 a)', () => {
  it('runs 2 clears, then CLEARS_BUSY with nothing charged', () => {
    const a = ok(run(rich, clear(bush[0]!.id)))
    const b = ok(run(a, clear(bush[1]!.id)))
    expect(b.constructions.length).toBe(2)
    err(run(b, clear(bush[2]!.id)), 'CLEARS_BUSY')
    err(run(b, clear(bush[1]!.id)), 'UNDER_CONSTRUCTION')
    expect(b.gold).toBe(rich.gold - 200)
  })
  it('lets builds start beside 2 clears, with 2 builds of their own', () => {
    const b = ok(run(ok(run(rich, clear(bush[0]!.id))), clear(bush[1]!.id)))
    const up1 = ok(run(b, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }))
    const up2 = ok(run(up1, { type: 'startUpgrade', building: { type: 'habitat', id: 'h2' } }))
    expect(up2.constructions.length).toBe(4)
    err(run(up2, { type: 'startUpgrade', building: { type: 'farm', index: 0 } }), 'BUILDERS_BUSY')
  })
  it('lets a clear start beside 2 builds', () => {
    const up = ok(run(ok(run(rich, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } })), { type: 'startUpgrade', building: { type: 'habitat', id: 'h2' } }))
    const c = ok(run(up, clear(bush[0]!.id)))
    expect(c.constructions.length).toBe(3)
  })
  it('charges nothing when Gold is short', () => {
    err(run({ ...rich, gold: 99 }, clear(bush[0]!.id)), 'INSUFFICIENT_GOLD')
    const poor = { ...rich, gold: 99 }
    expect(run(poor, clear(bush[0]!.id)).ok).toBe(false)
  })
  it('a finished clear frees its slot', () => {
    const b = ok(run(ok(run(rich, clear(bush[0]!.id))), clear(bush[1]!.id)))
    const c = ok(run(b, { type: 'finishConstruction', index: 0 }, 60_000))
    expect(ok(run(c, clear(bush[2]!.id), 60_000)).constructions.length).toBe(2)
  })
})

describe('completing a clear', () => {
  const tree = base.islands.obstacles.find(o => o.kind === 'tree')!
  const started = ok(run(rich, clear(tree.id)))
  it('pays XP and removes the obstacle once, by finish and by a $DRIS skip', () => {
    const done = ok(run(started, { type: 'finishConstruction', index: 0 }, 150_000))
    const skipped = ok(run(started, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 0))
    for (const d of [done, skipped]) {
      expect(d.islands.obstacles.some(o => o.id === tree.id)).toBe(false)
      expect(d.islands.obstacles.length).toBe(base.islands.obstacles.length - 1)
      expect(d.constructions).toEqual([])
      expect(d.level).toBeGreaterThanOrEqual(rich.level)
    }
    expect(done.xp - rich.xp).toBe(skipped.xp - rich.xp)
  })
  it('pays 50 x xpMult XP and no Food when nothing drops', () => {
    const before = { ...started, level: 1, xp: 0 }
    const d = ok(run(before, { type: 'finishConstruction', index: 0 }, 150_000, SEEDS.miss))
    expect([cumulativeXp(d.level) + d.xp, d.food]).toEqual([50 * FLASH_14.xpMult, before.food])
    expect(d.speedUps).toEqual(before.speedUps)
    expect(d.gold).toBe(before.gold)
  })
  it('banks XP above the day\'s limit (R40)', () => {
    const big = base.islands.obstacles.find(o => o.kind === 'ancientTree')!
    const top = levelLimit(1, FLASH_14)!
    const s0 = ok(run({ ...rich, level: top, xp: 0 }, clear(big.id)))
    const d = ok(run(s0, { type: 'finishConstruction', index: 0 }, 20_000_000, SEEDS.miss))
    expect([d.level, d.xp]).toEqual([top, 1_250 * FLASH_14.xpMult])
    expect(d.xp).toBeGreaterThan(xpToNext(top))
  })
  it('leaves Goal stats alone', () => {
    const d = ok(run(started, { type: 'finishConstruction', index: 0 }, 150_000))
    expect(d.goalStats).toEqual(base.goalStats)
  })
})

/** Seeds pinned by search: the first roll decides the drop (`rng.int(100) < percent`). */
const SEEDS = { miss: 0, token: 7, gold: 7, food: 7 }

describe('drops (R54)', () => {
  const finish = (kind: ObstacleKind, seed: number) => {
    const o = base.islands.obstacles.find(x => x.kind === kind)!
    const s0 = ok(run({ ...rich, level: 1 }, clear(o.id)))
    return { s0, d: ok(run(s0, { type: 'finishConstruction', index: 0 }, 99_999_999, seed)) }
  }
  it('a token drop adds 1 to speedUps', () => {
    const { s0, d } = finish('tree', SEEDS.token)
    expect(d.speedUps).toEqual({ ...s0.speedUps, '15m': 1 })
  })
  it('a Gold drop pays 100..300', () => {
    const { s0, d } = finish('smallRock', SEEDS.gold)
    expect(d.gold - s0.gold).toBeGreaterThanOrEqual(100)
    expect(d.gold - s0.gold).toBeLessThanOrEqual(300)
  })
  it('a Food drop pays 10..25', () => {
    const { s0, d } = finish('bush', SEEDS.food)
    expect(d.food - s0.food).toBeGreaterThanOrEqual(10)
    expect(d.food - s0.food).toBeLessThanOrEqual(25)
  })
  it('rolls at the §5.6 rates over 10,000 rolls', () => {
    const rng = createRng(2024)
    for (const kind of KINDS) {
      const pct = OBSTACLES[kind].drop!.percent
      let hits = 0
      for (let i = 0; i < 10_000; i++) {
        const d = rollDrop(kind, rng)
        if (d.gold !== undefined || d.food !== undefined || d.token !== undefined) hits++
      }
      expect(Math.abs(hits / 100 - pct), kind).toBeLessThanOrEqual(1)
    }
  })
  it('stays inside each range', () => {
    const rng = createRng(5)
    for (let i = 0; i < 2_000; i++) {
      const g = rollDrop('smallRock', rng).gold
      if (g !== undefined) { expect(g).toBeGreaterThanOrEqual(100); expect(g).toBeLessThanOrEqual(300) }
      const f = rollDrop('bush', rng).food
      if (f !== undefined) { expect(f).toBeGreaterThanOrEqual(10); expect(f).toBeLessThanOrEqual(25) }
    }
  })
  it('every completion path rolls the same drop for the same seed', () => {
    const o = base.islands.obstacles.find(x => x.kind === 'tree')!
    const s0 = ok(run({ ...rich, level: 1 }, clear(o.id)))
    const a = ok(run(s0, { type: 'finishConstruction', index: 0 }, 99_999_999, SEEDS.token))
    const b = ok(run(s0, { type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, 0, SEEDS.token))
    expect(b.speedUps).toEqual(a.speedUps)
  })
})

describe('the builder ceiling reads only builds', () => {
  it('does not count a clear against the Ascension\'s builder check', () => {
    const b = ok(run(ok(run(rich, clear(bush[0]!.id))), clear(bush[1]!.id)))
    expect(b.constructions.length).toBe(MAX_CLEARS)
    const withBuilds = ok(run(b, { type: 'startUpgrade', building: { type: 'habitat', id: 'h1' } }))
    expect(withBuilds.constructions.length).toBe(3)
  })
})

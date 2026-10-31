// Review Focus 4 (§4.4, §5.5): the unlock schedule has to fit on the land the gates open, with no moves. Played with real actions only.
import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action, Placeable } from '../src/actions/types'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { OBSTACLES } from '../src/data/obstacles'
import { FLASH_14 } from '../src/data/presets'
import { placementRuleError, subjectFootprint } from '../src/placement-rules'
import { clearCost, MAX_CLEARS } from '../src/obstacles'
import { ISLAND_TILES, plotError } from '../src/plots'
import { createRng } from '../src/rng'
import { newPlayer, type Obstacle, type Placement, type PlayerState } from '../src/state'
import { ALL_PLOTS } from './helpers/land'

const ROOM_SCHEDULE = [
  [3, ['habitat:sea', 'habitat:nature', 'farm']], [4, ['farm']], [5, ['roost']], [6, ['habitat:electric']], [7, ['farm']],
  [8, ['habitat:ice']], [10, ['habitat:metal', 'farm']], [12, ['grove']],
] as const

const GRANT = 1e12
const DAY_MS = 86_400_000

const subjectOf = (key: string): Placeable => {
  if (key === 'farm' || key === 'roost' || key === 'grove') return { kind: key }
  return { kind: 'habitat', element: key.slice('habitat:'.length) as Extract<Placeable, { kind: 'habitat' }>['element'] }
}

const overlapsObstacle = (o: Obstacle, p: Placement, size: number): boolean => {
  const n = OBSTACLES[o.kind].size
  return p.col < o.col + n && o.col < p.col + size && p.row < o.row + n && o.row < p.row + size
}

/** One player, one fake clock, real `applyAction` only. The level is pinned and Gold granted at each step. */
function session(seed: number) {
  const rng = createRng(seed)
  let s = newPlayer(0)
  let now = 0
  let level = 1
  const used: Action['type'][] = []
  let clears = 0

  const act = (a: Action): boolean => {
    used.push(a.type)
    const r = applyAction(s, a, now, rng, LAUNCH_CATALOG, FLASH_14, 1)
    if (!r.ok) return false
    s = { ...r.state, level, xp: 0, gold: GRANT }
    return true
  }
  const setLevel = (pl: number) => { level = pl; s = { ...s, level: pl, xp: 0, gold: GRANT } }
  /** Moves the clock to the next finish and finishes everything that is ready. */
  const settle = () => {
    if (s.constructions.length === 0) return
    now = Math.max(now, Math.min(...s.constructions.map(k => k.readyAtMs)))
    for (let i = s.constructions.length - 1; i >= 0; i--) if (s.constructions[i]!.readyAtMs <= now) act({ type: 'finishConstruction', index: i })
  }
  const settleAll = () => { while (s.constructions.length > 0) settle() }

  const buyPlots = () => {
    for (;;) {
      const plot = ALL_PLOTS.find(p => plotError(s, 'home', p) === null)
      if (plot === undefined || !act({ type: 'buyPlot', island: 'home', plot })) return
    }
  }
  const firstLegal = (subject: Placeable): Placement | null => {
    for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
      const p: Placement = { island: 'home', col, row, facing: 0 }
      if (placementRuleError(s, subject, p) === null) return p
    }
    return null
  }
  /** Obstacles to clear for the cell that needs the fewest, ties by lowest Gold. */
  const cheapestClears = (subject: Placeable): Obstacle[] | null => {
    const size = subjectFootprint(s, subject)!
    const bare: PlayerState = { ...s, islands: { ...s.islands, obstacles: [] } }
    let best: Obstacle[] | null = null
    let bestCost = Infinity
    for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
      const p: Placement = { island: 'home', col, row, facing: 0 }
      if (placementRuleError(bare, subject, p) !== null) continue
      const hit = s.islands.obstacles.filter(o => o.island === 'home' && overlapsObstacle(o, p, size))
      const cost = hit.reduce((n, o) => n + clearCost(o), 0)
      if (best === null || hit.length < best.length || (hit.length === best.length && cost < bestCost)) { best = hit; bestCost = cost }
    }
    return best
  }
  const clearThenWait = (hit: readonly Obstacle[]) => {
    for (const o of hit) {
      if (s.constructions.filter(k => k.kind === 'clear').length >= MAX_CLEARS) settleAll()
      if (!s.constructions.some(k => k.kind === 'clear' && k.obstacleId === o.id)) {
        if (!act({ type: 'clearObstacle', obstacleId: o.id })) throw new Error(`clear ${o.id} refused`)
        clears++
      }
    }
    settleAll()
  }
  /** Places one unlock: the first legal cell, else clear the fewest obstacles and retry. Returns false if it can never fit. */
  const place = (key: string): boolean => {
    const subject = subjectOf(key)
    for (let tries = 0; tries < 20; tries++) {
      settleAll() // a builder is free once the last build is done
      const at = firstLegal(subject)
      if (at) {
        if (!act({ type: 'placeBuilding', building: subject, placement: at })) throw new Error(`${key} refused at ${at.col},${at.row}`)
        return true
      }
      const hit = cheapestClears(subject)
      if (!hit || hit.length === 0) return false
      clearThenWait(hit)
    }
    return false
  }
  return {
    act, setLevel, settleAll, buyPlots, place, firstLegal,
    get s() { return s }, get used() { return used }, get clears() { return clears }, get now() { return now },
  }
}

describe('the starting land alone', () => {
  it('holds every unlock through PL 5: no plot bought, no obstacle cleared, no move', () => {
    const g = session(1)
    g.setLevel(5)
    for (const [pl, keys] of ROOM_SCHEDULE) {
      if (pl > 5) continue
      for (const key of keys) {
        g.settleAll()
        const at = g.firstLegal(subjectOf(key))
        expect(at, `${key} (PL ${pl}) needs a legal cell on the start`).not.toBeNull()
        expect(g.act({ type: 'placeBuilding', building: subjectOf(key), placement: at! })).toBe(true)
      }
    }
    expect(g.used).not.toContain('buyPlot')
    expect(g.used).not.toContain('clearObstacle')
    expect(g.used).not.toContain('moveBuilding')
    expect(g.s.islands.plots.home).toHaveLength(4)
  })
})

describe('the schedule through PL 12 fits with no moves (seeds 1..50)', () => {
  it('places every unlock, buying plots as their gates open', () => {
    let worst = 0
    let worstSeed = 0
    const perPl = new Map<number, number>()
    for (let seed = 1; seed <= 50; seed++) {
      const g = session(seed)
      let last = 0
      for (let pl = 1; pl <= 12; pl++) {
        g.setLevel(pl)
        g.buyPlots()
        for (const [at, keys] of ROOM_SCHEDULE) {
          if (at !== pl) continue
          for (const key of keys) expect(g.place(key), `seed ${seed}: ${key} at PL ${pl}`).toBe(true)
        }
        perPl.set(pl, Math.max(perPl.get(pl) ?? 0, g.clears - last))
        last = g.clears
      }
      g.settleAll()
      expect(g.used, `seed ${seed}`).not.toContain('moveBuilding')
      expect(g.s.habitats.map(h => h.element).sort(), `seed ${seed}`).toEqual(['electric', 'flame', 'ice', 'metal', 'nature', 'sea', 'terra'])
      expect(g.s.farms, `seed ${seed}`).toHaveLength(5)
      expect(g.s.roostPlacement, `seed ${seed}`).not.toBeNull()
      expect(g.s.breeders.some(b => b.kind === 'grove'), `seed ${seed}`).toBe(true)
      expect(g.now).toBeLessThan(1000 * DAY_MS)
      if (g.clears > worst) { worst = g.clears; worstSeed = seed }
    }
    expect(worst).toBe(0) // measured: no seed needs a single clear through PL 12
  })
})

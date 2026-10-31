// Review Focus 4 (§4.4, §5.5): the unlock schedule has to fit on the land the gates open, with no moves. Played with real actions only.
// The harness below only ever sends buyPlot, clearObstacle, finishConstruction and placeBuilding, so "no moves" holds by construction.
import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action, Placeable } from '../src/actions/types'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { FLASH_14 } from '../src/data/presets'
import { unlocksAt, type UnlockKey } from '../src/data/unlocks'
import { MAX_CLEARS } from '../src/obstacles'
import { placementRuleError } from '../src/placement-rules'
import { ISLAND_TILES, plotError } from '../src/plots'
import { createRng } from '../src/rng'
import { newPlayer, type Obstacle, type Placement, type PlayerState } from '../src/state'
import { ALL_PLOTS, cheapestClears, withObstacleField } from './helpers/land'

/** The brief's schedule, kept as a literal and checked against the unlock table below so it can't drift. */
const ROOM_SCHEDULE = [
  [3, ['habitat:sea', 'habitat:nature', 'farm']], [4, ['farm']], [5, ['roost']], [6, ['habitat:electric']], [7, ['farm']],
  [8, ['habitat:ice']], [10, ['habitat:metal', 'farm']], [12, ['grove']],
] as const

const GRANT = 1e12

const subjectOf = (key: string): Placeable => {
  if (key === 'farm' || key === 'roost' || key === 'grove') return { kind: key }
  return { kind: 'habitat', element: key.slice('habitat:'.length) as Extract<Placeable, { kind: 'habitat' }>['element'] }
}

/** What the unlock table opens at a level that takes floor space (from PL 2: Terra, Flame, the Hatchery and the Mountain are the start). */
const spaceTakers = (pl: number): string[] => unlocksAt(pl).flatMap((k: UnlockKey): string[] => {
  if (k.startsWith('habitat:')) return [k]
  if (k.startsWith('farm:')) return Number(k.slice(5)) >= 2 ? ['farm'] : []
  return k === 'roost:1' ? ['roost'] : k === 'grove:1' ? ['grove'] : []
})

/** One player, one fake clock, real `applyAction` only. The level is pinned and Gold granted at each step. */
function session(seed: number, from?: PlayerState) {
  const rng = createRng(seed)
  let s = from ?? newPlayer(0)
  let now = 0
  let level = s.level
  const used = new Set<Action['type']>()
  let clears = 0

  const act = (a: Action): boolean => {
    used.add(a.type)
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
  const clearThenWait = (hit: readonly Obstacle[]) => {
    for (const o of hit) {
      if (s.constructions.filter(k => k.kind === 'clear').length >= MAX_CLEARS) settleAll()
      if (!act({ type: 'clearObstacle', obstacleId: o.id })) throw new Error(`clear ${o.id} refused`)
      clears++
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
      const hit = cheapestClears(s, subject)
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

describe('the schedule', () => {
  it('is what the unlock table opens through PL 12', () => {
    for (const [pl, keys] of ROOM_SCHEDULE) expect([...keys].sort(), `PL ${pl}`).toEqual(spaceTakers(pl).sort())
    for (let pl = 2; pl <= 12; pl++) if (!ROOM_SCHEDULE.some(([at]) => at === pl)) expect(spaceTakers(pl), `PL ${pl}`).toEqual([])
  })
})

describe('the starting land alone', () => {
  it('holds every unlock through PL 5: no plot bought, no obstacle cleared', () => {
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
    expect(g.used.has('buyPlot')).toBe(false)
    expect(g.used.has('clearObstacle')).toBe(false)
    expect(g.s.islands.plots.home).toHaveLength(4)
  })
})

describe('the schedule through PL 12 fits (seeds 1..50)', () => {
  it('places every unlock, buying plots as their gates open', () => {
    let worst = 0
    for (let seed = 1; seed <= 50; seed++) {
      const g = session(seed)
      for (let pl = 1; pl <= 12; pl++) {
        g.setLevel(pl)
        g.buyPlots()
        for (const [at, keys] of ROOM_SCHEDULE) {
          if (at !== pl) continue
          for (const key of keys) expect(g.place(key), `seed ${seed}: ${key} at PL ${pl}`).toBe(true)
        }
      }
      g.settleAll()
      expect(g.s.habitats.map(h => h.element).sort(), `seed ${seed}`).toEqual(['electric', 'flame', 'ice', 'metal', 'nature', 'sea', 'terra'])
      expect(g.s.farms, `seed ${seed}`).toHaveLength(5)
      expect(g.s.roostPlacement, `seed ${seed}`).not.toBeNull()
      expect(g.s.breeders.some(b => b.kind === 'grove'), `seed ${seed}`).toBe(true)
      expect(g.s.constructions, `seed ${seed}`).toEqual([])
      worst = Math.max(worst, g.clears)
    }
    expect(worst).toBe(0) // measured: no seed needs a single clear through PL 12
  })
})

describe('a forced clear', () => {
  it('clears the fewest obstacles a Roost needs, then places it', () => {
    const g = session(1, { ...withObstacleField(newPlayer(0)), level: 5, gold: GRANT })
    expect(g.firstLegal({ kind: 'roost' })).toBeNull()
    const need = cheapestClears(g.s, { kind: 'roost' })!
    expect(need.length).toBeGreaterThan(0)
    expect(g.place('roost')).toBe(true)
    expect(g.clears).toBe(need.length)
    expect(g.s.roostPlacement).not.toBeNull()
    for (const o of need) expect(g.s.islands.obstacles.some(x => x.id === o.id)).toBe(false)
    expect(g.s.islands.obstacles).toHaveLength(withObstacleField(newPlayer(0)).islands.obstacles.length - need.length)
  })
})

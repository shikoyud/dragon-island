import { applyAction, createRng, ISLAND_ORDER, ISLANDS, LAUNCH_CATALOG, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { ISLAND_AT, islandFrame, islandUnder, lockedLabel, nearestIsland, worldBounds } from '../src/game/archipelago'
import { landBox } from '../src/game/camera'
import { boxesOverlap } from '../src/game/layout'

const fresh = newPlayer(0)
const bridged = (s: PlayerState): PlayerState => {
  const r = applyAction({ ...s, level: 12, gold: 150_000 }, { type: 'buyBridge', island: 'isle2' }, 0, createRng(1), LAUNCH_CATALOG)
  if (!r.ok) throw new Error(r.error)
  return r.state
}
/** The world point at the middle of an island's shown land. */
const landCentre = (s: PlayerState, id: (typeof ISLAND_ORDER)[number]) => {
  const b = landBox(s, id)
  return { x: ISLAND_AT[id].x + b.x + b.w / 2, y: ISLAND_AT[id].y + b.y + b.h / 2 }
}

describe('the archipelago (R99)', () => {
  it('puts Home at the origin and no two islands in one place', () => {
    expect(ISLAND_AT.home).toEqual({ x: 0, y: 0 })
    for (const a of ISLAND_ORDER) for (const b of ISLAND_ORDER) {
      if (a !== b) expect(boxesOverlap(islandFrame(a), islandFrame(b)), `${a} / ${b}`).toBe(false)
    }
  })

  it('the world holds every island frame', () => {
    const w = worldBounds()
    for (const id of ISLAND_ORDER) {
      const f = islandFrame(id)
      expect(f.x).toBeGreaterThanOrEqual(w.x)
      expect(f.y).toBeGreaterThanOrEqual(w.y)
      expect(f.x + f.w).toBeLessThanOrEqual(w.x + w.w)
      expect(f.y + f.h).toBeLessThanOrEqual(w.y + w.h)
    }
  })

  it('finds the island under a world point: its land, else its frame; open sky is none', () => {
    const s = bridged(fresh)
    const home = landCentre(s, 'home')
    expect(islandUnder(s, home.x, home.y)).toBe('home')
    const isle2 = landCentre(s, 'isle2')
    expect(islandUnder(s, isle2.x, isle2.y)).toBe('isle2')
    // A locked island is found by its frame: its picture stands there.
    const f = islandFrame('isle4')
    expect(islandUnder(s, f.x + f.w / 2, f.y + f.h / 2)).toBe('isle4')
    const w = worldBounds()
    expect(islandUnder(s, w.x - 500, w.y - 500)).toBeNull()
  })

  it('the nearest island is always an open one', () => {
    const f = islandFrame('isle3')
    expect(nearestIsland(fresh, f.x + f.w / 2, f.y + f.h / 2)).toBe('home')
    const s = bridged(fresh)
    const isle2 = landCentre(s, 'isle2')
    expect(nearestIsland(s, isle2.x + 10, isle2.y - 10)).toBe('isle2')
  })

  it('labels a locked island with its level and, for the next one, its Bridge price', () => {
    const s = { ...fresh, level: 12 }
    expect(lockedLabel(s, 'isle2')).toBe(`${ISLANDS.isle2.name} · Level 12 · Bridge 150,000`)
    expect(lockedLabel(s, 'isle3')).toMatch(new RegExp(`^${ISLANDS.isle3.name} · Level \\d+$`))
  })
})

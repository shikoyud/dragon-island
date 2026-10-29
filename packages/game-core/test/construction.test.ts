import { describe, expect, it } from 'vitest'
import { newHabitatTimerMs, startConstruction } from '../src/construction'
import { newPlayer } from '../src/state'

describe('construction', () => {
  it('new habitat timers double from 10 min and cap at 8 h', () => {
    expect([2, 3, 4, 8, 9, 20].map(newHabitatTimerMs)).toEqual([600_000, 1_200_000, 2_400_000, 28_800_000, 28_800_000, 28_800_000])
  })
  it('two builders, then null; the first two builds take 15 s', () => {
    const s = newPlayer(0)
    const a = startConstruction(s, { kind: 'upgrade', building: { type: 'habitat', id: 'h1' } }, 600_000, 1_000)!
    expect(a.constructions[0]).toEqual({ kind: 'upgrade', building: { type: 'habitat', id: 'h1' }, readyAtMs: 16_000 })
    const b = startConstruction(a, { kind: 'upgrade', building: { type: 'habitat', id: 'h2' } }, 600_000, 1_000)!
    expect(b.constructions[1]!.readyAtMs).toBe(16_000)
    expect(b.tutorial.buildsStarted).toBe(2)
    expect(startConstruction(b, { kind: 'upgrade', building: { type: 'farm', index: 0 } }, 1, 1_000)).toBeNull()
    const c = startConstruction({ ...b, constructions: [] }, { kind: 'upgrade', building: { type: 'farm', index: 0 } }, 600_000, 1_000)!
    expect(c.constructions[0]!.readyAtMs).toBe(601_000)
  })
})

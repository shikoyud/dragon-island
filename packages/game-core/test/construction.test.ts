import { describe, expect, it } from 'vitest'
import * as construction from '../src/construction'
import { startConstruction } from '../src/construction'
import { newPlayer } from '../src/state'

describe('construction', () => {
  it('two builders, then null; every build takes its own timer (no tutorial timers)', () => {
    const s = newPlayer(0)
    const a = startConstruction(s, { kind: 'upgrade', building: { type: 'habitat', id: 'h1' } }, 600_000, 1_000)!
    expect(a.constructions[0]).toEqual({ kind: 'upgrade', building: { type: 'habitat', id: 'h1' }, readyAtMs: 601_000 })
    const b = startConstruction(a, { kind: 'upgrade', building: { type: 'habitat', id: 'h2' } }, 300_000, 1_000)!
    expect(b.constructions[1]!.readyAtMs).toBe(301_000)
    expect(b.tutorial).toEqual({ breedDone: false, hatchDone: false })
    expect(startConstruction(b, { kind: 'upgrade', building: { type: 'farm', index: 0 } }, 1, 1_000)).toBeNull()
  })

  it('no longer exports the tutorial build count', () => {
    expect(construction).not.toHaveProperty('TUTORIAL_BUILDS')
  })
})

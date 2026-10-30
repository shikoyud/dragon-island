import { newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it, vi } from 'vitest'
import { migrateState } from '../src/services/stateMigration'

describe('migrateState (no save migration, R2)', () => {
  const now = 5 * 86_400_000 + 123

  it('replaces a state without a version by a fresh player and calls onReset once', () => {
    const { version, ...old } = newPlayer(0)
    void version
    const onReset = vi.fn()
    expect(migrateState({ ...old, gold: 5 }, now, onReset)).toEqual(newPlayer(now))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('replaces a state of another version', () => {
    const onReset = vi.fn()
    expect(migrateState({ ...newPlayer(0), version: 1 }, now, onReset)).toEqual(newPlayer(now))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('replaces a version 2 state that still has nests and pity, once', () => {
    const v2 = { ...newPlayer(0), version: 2, pity: { 'flame+sea': 3 }, nests: [{ egg: null, level: 1, placement: { island: 'home', col: 4, row: 8, facing: 0 } }] }
    const onReset = vi.fn()
    const out = migrateState(v2, now, onReset)
    expect(out).toEqual(newPlayer(now))
    expect(out).not.toHaveProperty('pity')
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('leaves a current state untouched and does not call onReset', () => {
    const s = { ...newPlayer(now), trophies: 42, defenceTeam: ['d1', 'd2', 'd3'] as [string, string, string] }
    const onReset = vi.fn()
    expect(migrateState(s, now + 1, onReset)).toEqual(s)
    expect(onReset).not.toHaveBeenCalled()
  })

  it('rejects garbage', () => {
    expect(() => migrateState(null, now)).toThrow()
    expect(() => migrateState({ gold: 'lots' }, now)).toThrow()
  })
})

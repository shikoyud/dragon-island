import { newPlayer, utcDay } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { migrateState } from '../src/services/stateMigration'

describe('migrateState', () => {
  const now = 5 * 86_400_000 + 123

  it('fills fields added after Phase 1 rows were written', () => {
    const { defenceTeam, trophies, pvp, pve, ...phase1 } = newPlayer(0)
    void defenceTeam; void trophies; void pvp; void pve
    const migrated = migrateState(phase1, now)
    expect(migrated.defenceTeam).toBeNull()
    expect(migrated.trophies).toBe(0)
    expect(migrated.pvp).toEqual({ day: utcDay(now), count: 0 })
    expect(migrated.pve).toEqual({ cleared: 0, replays: { day: utcDay(now), count: 0 } })
    expect(migrated.gold).toBe(1000)
  })

  it('leaves a current state untouched', () => {
    const s = { ...newPlayer(now), trophies: 42, defenceTeam: ['d1', 'd2', 'd3'] as [string, string, string] }
    expect(migrateState(s, now + 1)).toEqual(s)
  })

  it('rejects garbage', () => {
    expect(() => migrateState(null, now)).toThrow()
    expect(() => migrateState({ gold: 'lots' }, now)).toThrow()
  })
})

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

  it('lays a pre-building state out on the grid', () => {
    const old = { ...newPlayer(0), nests: [null], hoardLevel: 1 } as unknown as Record<string, unknown>
    for (const k of ['islands', 'hatcheryLevel', 'hatcheryPlacement', 'hoardPlacement', 'decorations', 'constructions']) delete old[k]
    old['farms'] = [{ crop: null, readyAtMs: 0 }]
    old['habitats'] = (old['habitats'] as Record<string, unknown>[]).map(({ placement, ...h }) => { void placement; return h })
    const m = migrateState(old, now)
    expect(m.islands.unlocked).toEqual(['home'])
    expect(m.nests[0]!.egg).toBeNull()
    expect(m.farms[0]!.level).toBe(1)
    expect(m.hatcheryLevel).toBe(1)
    expect(m.hoardPlacement).not.toBeNull()
    expect(m.tutorial.buildsStarted).toBe(2)
    expect(migrateState(m, now)).toEqual(m)
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

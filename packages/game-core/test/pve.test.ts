import { describe, expect, it } from 'vitest'
import { getSpecies, isBasic, makeCatalog } from '../src/catalog'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import {
  PVE_MIN_PLAYER_LEVEL, PVE_REPLAYS_PER_DAY, PVE_STAGES, PVP_ATTACKS_PER_DAY, PVP_MIN_PLAYER_LEVEL,
  stageLevel, stageRarity, stageRewards, stageTeam,
} from '../src/pve'
import { FIXTURE_CATALOG as C } from './fixtures'

describe('pve campaign', () => {
  it('has the caps and unlock levels', () => {
    expect([PVE_STAGES, PVE_REPLAYS_PER_DAY, PVE_MIN_PLAYER_LEVEL, PVP_MIN_PLAYER_LEVEL, PVP_ATTACKS_PER_DAY]).toEqual([30, 10, 5, 8, 20])
  })

  it('scales stage level and rarity', () => {
    expect([1, 27, 28, 30].map(stageLevel)).toEqual([3, 29, 30, 32])
    expect([1, 10, 11, 20, 21, 30].map(stageRarity)).toEqual(['common', 'common', 'rare', 'rare', 'epic', 'epic'])
  })

  it('builds fixed teams, falling back to lower rarities the catalog lacks', () => {
    expect(stageTeam(7, C)).toEqual(stageTeam(7, C))
    expect(stageTeam(7, C)).toHaveLength(3)
    expect(stageTeam(7, C).every(d => d.level === 9)).toBe(true)
    expect(stageTeam(25, C).every(d => getSpecies(C, d.speciesId).rarity === 'epic')).toBe(true)
    expect(stageTeam(15, C).every(d => getSpecies(C, d.speciesId).rarity === 'rare')).toBe(true)
    const basicsOnly = makeCatalog([...LAUNCH_CATALOG.species.values()].filter(isBasic))
    expect(stageTeam(25, basicsOnly).every(d => getSpecies(basicsOnly, d.speciesId).rarity === 'common')).toBe(true)
  })

  it('draws stage teams from the full catalog, hybrids included, never Legendaries (R24)', () => {
    // Re-pinned in Task 1: the launch catalog now holds Epics, so stage 25 is no longer all Basics.
    const rarities = (stage: number) => stageTeam(stage, LAUNCH_CATALOG).map(d => getSpecies(LAUNCH_CATALOG, d.speciesId).rarity)
    expect(rarities(25).every(r => r === 'epic')).toBe(true)
    expect(rarities(15).every(r => r === 'rare')).toBe(true)
    for (let stage = 1; stage <= 30; stage++) expect(rarities(stage)).not.toContain('legendary')
  })

  it('pays first clears in full and replays a quarter of the gold', () => {
    expect(stageRewards(4, true)).toEqual({ gold: 400, food: 80, xp: 15 })
    expect(stageRewards(4, false)).toEqual({ gold: 100, food: 0, xp: 0 })
  })
})

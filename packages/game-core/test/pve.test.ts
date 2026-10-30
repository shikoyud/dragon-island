import { describe, expect, it } from 'vitest'
import { getSpecies } from '../src/catalog'
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
    expect(stageTeam(25, LAUNCH_CATALOG).every(d => getSpecies(LAUNCH_CATALOG, d.speciesId).rarity === 'common')).toBe(true)
  })

  it('pays first clears in full and replays a quarter of the gold', () => {
    expect(stageRewards(4, true)).toEqual({ gold: 400, food: 80, xp: 15 })
    expect(stageRewards(4, false)).toEqual({ gold: 100, food: 0, xp: 0 })
  })
})

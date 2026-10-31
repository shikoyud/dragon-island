import { describe, expect, it } from 'vitest'
import { DECORATIONS, decorationRefund } from '../src/decorations'
import { upgradeInfo } from '../src/buildings'
import { canLiveIn } from '../src/habitat'
import { FLASH_14 } from '../src/data/presets'
import { newPlayer } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'

const P = { island: 'home', col: 0, row: 0, facing: 0 } as const

describe('buildings', () => {
  it('upgrade tables match the spec', () => {
    expect(upgradeInfo(newPlayer(0), { type: 'habitat', id: 'h2' }, FLASH_14)).toEqual({ cost: 20_000, timerMs: 600_000, minLevel: 1 })
    expect(upgradeInfo({ ...newPlayer(0), habitats: newPlayer(0).habitats.map(h => ({ ...h, level: 5 })) }, { type: 'habitat', id: 'h2' }, FLASH_14)).toBeNull()
    expect(upgradeInfo(newPlayer(0), { type: 'farm', index: 0 }, FLASH_14)).toEqual({ cost: 15_000, timerMs: 600_000, minLevel: 1 })
  })
  it('farm upgrades go L2 to L4 for Gold with no level gate; L4 has no Gold upgrade (the store sells L5)', () => {
    const at = (level: number) => ({ ...newPlayer(0), farms: newPlayer(0).farms.map(f => ({ ...f, level })) })
    const info = (level: number) => upgradeInfo(at(level), { type: 'farm', index: 0 }, FLASH_14)
    expect([2, 3, 4].map(l => info(l - 1))).toEqual([
      { cost: 15_000, timerMs: 600_000, minLevel: 1 },
      { cost: 75_000, timerMs: 2_400_000, minLevel: 1 },
      { cost: 400_000, timerMs: 7_200_000, minLevel: 1 },
    ])
    expect(info(4)).toBeNull()
    expect(info(5)).toBeNull()
    expect(upgradeInfo(at(1), { type: 'farm', index: 9 }, FLASH_14)).toBeNull()
  })
  it('habitat upgrades go L2 to L4 for Gold; L4 has no Gold upgrade (the store sells L5)', () => {
    const at = (level: number) => ({ ...newPlayer(0), habitats: newPlayer(0).habitats.map(h => ({ ...h, level })) })
    const info = (level: number) => upgradeInfo(at(level), { type: 'habitat', id: 'h2' }, FLASH_14)
    expect([info(2)?.cost, info(3)?.cost, info(4)]).toEqual([80_000, 320_000, null])
    expect([info(2)?.timerMs, info(3)?.timerMs]).toEqual([2_400_000, 7_200_000])
  })
  it('the Golden Aerie lives anywhere', () => {
    expect(canLiveIn(FIXTURE_CATALOG.species.get('flame')!, { id: 'x', element: 'aerie', level: 5, lastCollectedMs: 0, placement: P })).toBe(true)
  })
  it('decorations table and refund', () => {
    expect(DECORATIONS.stonePath).toEqual({ size: 1, cost: 10, minLevel: 1 })
    expect(DECORATIONS.dragonColossus).toEqual({ size: 3, cost: 1_000_000, minLevel: 45, island: 'isle6' })
    expect(Object.keys(DECORATIONS)).toHaveLength(15)
    expect(decorationRefund('hayCart')).toBe(250)
  })
})

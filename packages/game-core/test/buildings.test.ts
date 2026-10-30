import { describe, expect, it } from 'vitest'
import { DECORATIONS, decorationRefund } from '../src/decorations'
import { farmFood, hatcherySlots, nestBreedMs, upgradeInfo } from '../src/buildings'
import { canLiveIn } from '../src/habitat'
import { FLASH_14 } from '../src/data/presets'
import { newPlayer } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'

const P = { island: 'home', col: 0, row: 0, facing: 0 } as const

describe('buildings', () => {
  it('upgrade tables match the spec', () => {
    expect(upgradeInfo(newPlayer(0), { type: 'habitat', id: 'h1' }, FLASH_14)).toEqual({ cost: 20_000, timerMs: 600_000, minLevel: 1 })
    expect(upgradeInfo({ ...newPlayer(0), habitats: newPlayer(0).habitats.map(h => ({ ...h, level: 5 })) }, { type: 'habitat', id: 'h1' }, FLASH_14)).toBeNull()
    expect(upgradeInfo(newPlayer(0), { type: 'farm', index: 0 }, FLASH_14)).toEqual({ cost: 1_500, timerMs: 900_000, minLevel: 4 })
    expect(upgradeInfo(newPlayer(0), { type: 'nest', index: 0 }, FLASH_14)).toEqual({ cost: 15_000, timerMs: 7_200_000, minLevel: 12 })
    expect(upgradeInfo(newPlayer(0), { type: 'hatchery' }, FLASH_14)).toEqual({ cost: 12_000, timerMs: 7_200_000, minLevel: 8 })
    expect([hatcherySlots(1), hatcherySlots(3)]).toEqual([3, 5])
    expect(nestBreedMs(43_200_000, 3)).toBe(34_560_000)
    expect(farmFood(3_000, 4)).toBe(4_500)
    expect(farmFood(10, 2)).toBe(11)
  })
  it('habitat upgrades go L2 to L4 for Gold; L4 has no Gold upgrade (the store sells L5)', () => {
    const at = (level: number) => ({ ...newPlayer(0), habitats: newPlayer(0).habitats.map(h => ({ ...h, level })) })
    const info = (level: number) => upgradeInfo(at(level), { type: 'habitat', id: 'h1' }, FLASH_14)
    expect([info(2)?.cost, info(3)?.cost, info(4)]).toEqual([80_000, 320_000, null])
    expect([info(2)?.timerMs, info(3)?.timerMs]).toEqual([2_400_000, 7_200_000])
  })
  it('the Golden Aerie lives anywhere', () => {
    expect(canLiveIn(FIXTURE_CATALOG.species.get('flame')!, { id: 'x', element: 'aerie', level: 5, lastCollectedMs: 0, placement: P })).toBe(true)
  })
  it('decorations table and refund', () => {
    expect(DECORATIONS.stonePath).toEqual({ size: 1, cost: 10, minLevel: 1 })
    expect(DECORATIONS.dragonColossus).toEqual({ size: 3, cost: 1_000_000, minLevel: 45, island: 'dawnspire' })
    expect(Object.keys(DECORATIONS)).toHaveLength(15)
    expect(decorationRefund('hayCart')).toBe(250)
  })
})

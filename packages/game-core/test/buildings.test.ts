import { describe, expect, it } from 'vitest'
import { DECORATIONS, decorationRefund } from '../src/decorations'
import { farmFood, hatcherySlots, nestBreedMs, upgradeInfo } from '../src/buildings'
import { canLiveIn, maxHabitats } from '../src/habitat'
import { newPlayer } from '../src/state'
import { FIXTURE_CATALOG } from './fixtures'

const P = { island: 'home', col: 0, row: 0, facing: 0 } as const

describe('buildings', () => {
  it('upgrade tables match the spec', () => {
    expect(upgradeInfo(newPlayer(0), { type: 'habitat', id: 'h1' })).toEqual({ cost: 1_000, timerMs: 600_000, minLevel: 1 })
    expect(upgradeInfo({ ...newPlayer(0), habitats: newPlayer(0).habitats.map(h => ({ ...h, level: 5 })) }, { type: 'habitat', id: 'h1' })).toBeNull()
    expect(upgradeInfo(newPlayer(0), { type: 'farm', index: 0 })).toEqual({ cost: 1_500, timerMs: 900_000, minLevel: 4 })
    expect(upgradeInfo(newPlayer(0), { type: 'nest', index: 0 })).toEqual({ cost: 15_000, timerMs: 7_200_000, minLevel: 12 })
    expect(upgradeInfo(newPlayer(0), { type: 'hatchery' })).toEqual({ cost: 12_000, timerMs: 7_200_000, minLevel: 8 })
    expect([hatcherySlots(1), hatcherySlots(3)]).toEqual([3, 5])
    expect(nestBreedMs(43_200_000, 3)).toBe(34_560_000)
    expect(farmFood(3_000, 4)).toBe(4_500)
    expect(farmFood(10, 2)).toBe(11)
  })
  it('habitat limit counts outer islands and the Nexus is free', () => {
    expect([maxHabitats(1, 0), maxHabitats(50, 0), maxHabitats(50, 5)]).toEqual([2, 12, 27])
    expect(canLiveIn(FIXTURE_CATALOG.species.get('flame')!, { id: 'x', element: 'any', level: 5, lastCollectedMs: 0, placement: P })).toBe(true)
  })
  it('decorations table and refund', () => {
    expect(DECORATIONS.stonePath).toEqual({ size: 1, cost: 10, minLevel: 1 })
    expect(DECORATIONS.dragonColossus).toEqual({ size: 3, cost: 1_000_000, minLevel: 45, island: 'dawnspire' })
    expect(Object.keys(DECORATIONS)).toHaveLength(15)
    expect(decorationRefund('hayCart')).toBe(250)
  })
})

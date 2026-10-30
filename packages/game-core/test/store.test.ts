import { describe, expect, it } from 'vitest'
import { newPlayer } from '../src/state'
import { FOOD_PACK, MAX_NESTS, priceMicroUsd } from '../src/store'

const base = newPlayer(0)
const egg = (readyAtMs: number) => ({ ...newPlayer(0), nests: [{ ...base.nests[0]!, egg: { speciesId: 'flame', readyAtMs } }] })

describe('priceMicroUsd', () => {
  it('prices timer skips per started 30 minutes', () => {
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, egg(1_800_001), 0)).toBe(200_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, egg(1_800_000), 0)).toBe(100_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, egg(0), 0)).toBeNull()
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, base, 0)).toBeNull()
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 3 }, egg(5), 0)).toBeNull()
  })

  it('prices hatchery and farm skips', () => {
    const s = { ...base, hatchery: [{ speciesId: 'flame', readyAtMs: 60_000 }], farms: [{ ...base.farms[0]!, crop: 'warlordPepper' as const, readyAtMs: 43_200_000 }, base.farms[1]!] }
    expect(priceMicroUsd({ kind: 'skip', target: 'hatchery', index: 0 }, s, 0)).toBe(100_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'farm', index: 0 }, s, 0)).toBe(2_400_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'farm', index: 1 }, s, 0)).toBeNull()
  })

  it('prices the L5 upgrade by element tier, only from level 4 (§5.2)', () => {
    const at = (element: 'terra' | 'ice' | 'dark', level: number) =>
      ({ ...base, habitats: [{ ...base.habitats[0]!, element, level }] })
    const item = { kind: 'habitatL5' as const, habitatId: 'h1' }
    expect([at('terra', 4), at('ice', 4), at('dark', 4)].map(s => priceMicroUsd(item, s, 0))).toEqual([1_500_000, 2_500_000, 4_000_000])
    expect(priceMicroUsd(item, at('terra', 3), 0)).toBeNull()
    expect(priceMicroUsd(item, at('terra', 5), 0)).toBeNull()
    expect(priceMicroUsd({ kind: 'habitatL5', habitatId: 'h9' }, at('terra', 4), 0)).toBeNull()
  })

  it('prices the farm L5 upgrade at $2.00, only from level 4 (§5.3)', () => {
    const at = (level: number) => ({ ...base, farms: [{ ...base.farms[0]!, level }, base.farms[1]!] })
    const item = { kind: 'farmL5' as const, index: 0 }
    expect(priceMicroUsd(item, at(4), 0)).toBe(2_000_000)
    expect(priceMicroUsd(item, at(3), 0)).toBeNull()
    expect(priceMicroUsd(item, at(5), 0)).toBeNull()
    expect(priceMicroUsd({ kind: 'farmL5', index: 9 }, at(4), 0)).toBeNull()
  })

  it('prices the Golden Aerie at $5.00', () => {
    expect(priceMicroUsd({ kind: 'goldenAerie', placement: { island: 'home', col: 6, row: 7, facing: 0 } }, base, 0)).toBe(5_000_000)
  })

  it('prices flat items', () => {
    expect(FOOD_PACK).toBe(1_000)
    expect(priceMicroUsd({ kind: 'foodPack' }, base, 0)).toBe(500_000)
    expect(MAX_NESTS).toBe(4)
  })
})

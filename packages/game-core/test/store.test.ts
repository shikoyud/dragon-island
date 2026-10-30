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
    const s = { ...base, hatchery: [{ speciesId: 'flame', readyAtMs: 60_000 }], farms: [{ ...base.farms[0]!, crop: 'bounty' as const, readyAtMs: 43_200_000 }, base.farms[1]!] }
    expect(priceMicroUsd({ kind: 'skip', target: 'hatchery', index: 0 }, s, 0)).toBe(100_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'farm', index: 0 }, s, 0)).toBe(2_400_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'farm', index: 1 }, s, 0)).toBeNull()
  })

  it('prices flat items', () => {
    expect(FOOD_PACK).toBe(1_000)
    expect(priceMicroUsd({ kind: 'foodPack' }, base, 0)).toBe(500_000)
    expect(MAX_NESTS).toBe(4)
  })
})

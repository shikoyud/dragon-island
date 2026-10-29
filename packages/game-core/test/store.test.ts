import { describe, expect, it } from 'vitest'
import { newPlayer } from '../src/state'
import { FOOD_PACK, MAX_NESTS, priceMicroUsd } from '../src/store'

const base = newPlayer(0)
const egg = (readyAtMs: number) => ({ ...newPlayer(0), nests: [{ ...base.nests[0]!, egg: { speciesId: 'fire', readyAtMs } }] })
const atLevel = (level: number) => ({ ...base, dragons: base.dragons.map(d => d.id === 'd1' ? { ...d, level } : d) })

describe('priceMicroUsd', () => {
  it('prices timer skips per started 30 minutes', () => {
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, egg(1_800_001), 0)).toBe(200_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, egg(1_800_000), 0)).toBe(100_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, egg(0), 0)).toBeNull()
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 0 }, base, 0)).toBeNull()
    expect(priceMicroUsd({ kind: 'skip', target: 'nest', index: 3 }, egg(5), 0)).toBeNull()
  })

  it('prices hatchery and farm skips', () => {
    const s = { ...base, hatchery: [{ speciesId: 'fire', readyAtMs: 60_000 }], farms: [{ ...base.farms[0]!, crop: 'bounty' as const, readyAtMs: 43_200_000 }, base.farms[1]!] }
    expect(priceMicroUsd({ kind: 'skip', target: 'hatchery', index: 0 }, s, 0)).toBe(100_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'farm', index: 0 }, s, 0)).toBe(2_400_000)
    expect(priceMicroUsd({ kind: 'skip', target: 'farm', index: 1 }, s, 0)).toBeNull()
  })

  it('prices nests by count', () => {
    expect(MAX_NESTS).toBe(4)
    expect(priceMicroUsd({ kind: 'nest' }, base, 0)).toBe(2_000_000)
    expect(priceMicroUsd({ kind: 'nest' }, { ...base, nests: Array.from({ length: 2 }, () => base.nests[0]!) }, 0)).toBe(4_000_000)
    expect(priceMicroUsd({ kind: 'nest' }, { ...base, nests: Array.from({ length: 3 }, () => base.nests[0]!) }, 0)).toBe(8_000_000)
    expect(priceMicroUsd({ kind: 'nest' }, { ...base, nests: Array.from({ length: 4 }, () => base.nests[0]!) }, 0)).toBeNull()
  })

  it('prices level-ups from food cost with a floor', () => {
    expect(priceMicroUsd({ kind: 'levelUp', dragonId: 'd1' }, base, 0)).toBe(50_000)
    expect(priceMicroUsd({ kind: 'levelUp', dragonId: 'd1' }, atLevel(20), 0)).toBe(3_200_000)
    expect(priceMicroUsd({ kind: 'levelUp', dragonId: 'd1' }, atLevel(30), 0)).toBeNull()
    expect(priceMicroUsd({ kind: 'levelUp', dragonId: 'd9' }, base, 0)).toBeNull()
  })

  it('prices Hoard levels', () => {
    expect(priceMicroUsd({ kind: 'hoard' }, base, 0)).toBe(2_000_000)
    expect(priceMicroUsd({ kind: 'hoard' }, { ...base, hoardLevel: 6 }, 0)).toBe(60_000_000)
    expect(priceMicroUsd({ kind: 'hoard' }, { ...base, hoardLevel: 7 }, 0)).toBeNull()
  })

  it('prices flat items', () => {
    expect(FOOD_PACK).toBe(1_000)
    expect(priceMicroUsd({ kind: 'foodPack' }, base, 0)).toBe(500_000)
    expect(priceMicroUsd({ kind: 'oddsBoost' }, base, 0)).toBe(500_000)
  })
})

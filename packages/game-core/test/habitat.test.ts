import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import { getSpecies, makeCatalog } from '../src/catalog'
import { FLASH_14, FLASH_28 } from '../src/data/presets'
import { canLiveIn, habitatCapacity, habitatSlots, residents, storedGold } from '../src/habitat'
import { createRng } from '../src/rng'
import { newPlayer, type Dragon, type Habitat, type PlayerState } from '../src/state'
import { FIXTURE_CATALOG as C } from './fixtures'
import { ok } from './helpers'

const HOUR = 3_600_000
const CLASSIC = { ...FLASH_14, goldMult: 1 }
const PL = { island: 'home' as const, col: 0, row: 0, facing: 0 as const }
const CAT = makeCatalog([
  { id: 'terra', name: 'terra', elements: ['terra'], rarity: 'common', recipeOnly: false },
  { id: 'war', name: 'war', elements: ['war'], rarity: 'common', recipeOnly: false },
  { id: 'tw-rare', name: 'tw-rare', elements: ['terra', 'war'], rarity: 'rare', recipeOnly: false },
], [])

/** A player with one habitat holding `n` Lv 5 Commons of `speciesId`, last collected at 0. */
function holding(element: Habitat['element'], speciesId: string, n: number, level = 1): PlayerState {
  const habitat: Habitat = { id: 'x1', element, level, lastCollectedMs: 0, placement: PL }
  const dragons: Dragon[] = Array.from({ length: n }, (_, i) => ({ id: `x${i}`, speciesId, level: 5, feeds: 0, habitatId: 'x1' }))
  return { ...newPlayer(0), habitats: [habitat], dragons }
}
const gold = (s: PlayerState, nowMs: number, preset = FLASH_14) =>
  storedGold(s.habitats[0]!, residents(s, 'x1'), CAT, nowMs, preset)

describe('habitat rules', () => {
  const s = newPlayer(0)
  const h1 = s.habitats[0]!

  it('accrues whole minutes of gold up to the cap', () => {
    const r = residents(s, 'h1')
    expect(r.map(d => d.id)).toEqual(['d1'])
    // Flame Common Lv 1 in Flash-14: 10 x 14 x 10 / 20 = 70 gold/min.
    expect(storedGold(h1, r, C, 600_000, FLASH_14)).toBe(700)
    expect(storedGold(h1, r, C, 90_000, FLASH_14)).toBe(70)
    expect(storedGold(h1, r, C, 3_000 * 60_000, FLASH_14)).toBe(100_000)
  })

  it('yields nothing when the clock is behind the last collection', () => {
    expect(storedGold({ ...h1, lastCollectedMs: 600_000 }, residents(s, 'h1'), C, 300_000, FLASH_14)).toBe(0)
  })

  it('lets a dragon live where any element matches, and anywhere in the Golden Aerie', () => {
    const sea = s.habitats[1]!
    expect(canLiveIn(getSpecies(C, 'fw-common'), sea)).toBe(true)
    expect(canLiveIn(getSpecies(C, 'flame'), sea)).toBe(false)
    expect(canLiveIn(getSpecies(C, 'flame'), { ...sea, element: 'aerie', level: 5 })).toBe(true)
  })

  it('holds 2..6 dragons by level; the Aerie holds 6', () => {
    expect([1, 2, 3, 4, 5].map(habitatCapacity)).toEqual([2, 3, 4, 5, 6])
    expect(habitatSlots({ ...h1, level: 3 })).toBe(4)
    expect(habitatSlots({ ...h1, element: 'aerie', level: 5 })).toBe(6)
  })
})

describe('§5.1 income by primary element', () => {
  it('a hybrid earns at its primary element rate wherever it lives', () => {
    // Terra/War Rare Lv 5 in a War habitat earns the Terra rate (§5.2 hybrid arbitrage).
    const war = holding('war', 'tw-rare', 1)
    const terra = holding('terra', 'tw-rare', 1)
    expect(gold(war, 60_000)).toBe(gold(terra, 60_000))
    // Terra Rare Lv 5: 15 x 132 x 10 / 20 = 990 per minute.
    expect(gold(war, 60_000)).toBe(990)
    expect(gold(war, 60_000)).toBeGreaterThan(gold(holding('war', 'war', 1), 60_000) * 3)
  })

  it('a Golden Aerie earns each resident at its own primary element', () => {
    const a = holding('aerie', 'terra', 1, 5)
    expect(gold(a, 60_000)).toBe(660)
    const mixed = { ...a, dragons: [...a.dragons, { id: 'x9', speciesId: 'war', level: 5, feeds: 0, habitatId: 'x1' }] }
    expect(gold(mixed, 60_000)).toBe(660 + 230)
  })
})

describe('§5.2 Sprinter vs Vault (R13), in classic terms', () => {
  const terra = holding('terra', 'terra', 2)
  const war = holding('war', 'war', 2)

  it('two Lv 5 Commons earn 132 gold/min in Terra', () => {
    expect(gold(terra, 60_000, CLASSIC)).toBe(132)
    expect(gold(terra, HOUR, CLASSIC)).toBe(7_920)
  })

  it('17 hourly check-ins in Terra make about 136k a day (134,640)', () => {
    const day = 17 * gold(terra, HOUR, CLASSIC)
    expect(day).toBe(134_640)
    expect(day).toBeGreaterThan(130_000)
    expect(day).toBeLessThan(140_000)
  })

  it('24 hourly check-ins in War make 66,240', () => {
    expect(gold(war, HOUR, CLASSIC)).toBe(2_760)
    expect(24 * gold(war, HOUR, CLASSIC)).toBe(66_240)
  })

  it('at 6-hour gaps Terra drops to 32,000 while War holds 66,240', () => {
    expect(gold(terra, 6 * HOUR, CLASSIC)).toBe(8_000)
    expect(4 * gold(terra, 6 * HOUR, CLASSIC)).toBe(32_000)
    expect(4 * gold(war, 6 * HOUR, CLASSIC)).toBe(66_240)
  })
})

describe('caps (Review Focus 1)', () => {
  const terra = holding('terra', 'terra', 2)

  it('two Lv 5 Commons in a Terra L1 in Flash-14: 79,200 after 60 min, exactly the cap after 10 hours', () => {
    expect(gold(terra, 60 * 60_000)).toBe(79_200)
    expect(gold(terra, 600 * 60_000)).toBe(80_000)
    expect(gold(terra, 1_000 * HOUR)).toBe(80_000)
  })

  it('Flash-28 uses the x6 cap', () => {
    expect(gold(terra, 1_000 * HOUR, FLASH_28)).toBe(48_000)
  })

  it('collecting after 10 hours pays exactly the cap through the action', () => {
    const r = applyAction(terra, { type: 'collectGold', habitatId: 'x1' }, 10 * HOUR, createRng(1), CAT, FLASH_14)
    const after = ok(r)
    expect(after.gold - terra.gold).toBe(80_000)
    expect(after.habitats[0]!.lastCollectedMs).toBe(10 * HOUR)
  })

  it('the cap follows the level (L3 = L1 x 12.25)', () => {
    const l3 = holding('terra', 'terra', 2, 3)
    expect(gold(l3, 1_000 * HOUR)).toBe(980_000)
  })
})

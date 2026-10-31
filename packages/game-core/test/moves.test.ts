import { describe, expect, it } from 'vitest'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { getSpecies } from '../src/catalog'
import { ELEMENTS } from '../src/elements'
import { MOVE_MIN_LEVEL, MOVE_MULT_PCT, MOVE_NAMES } from '../src/data/moves'
import { movesFor, moveUnlocked } from '../src/battle/moves'

const kit = (id: string) => movesFor(getSpecies(LAUNCH_CATALOG, id))

describe('§6.1 move data', () => {
  it('multipliers and unlock levels are literal', () => {
    expect(MOVE_MULT_PCT).toEqual({ physical: 52, 1: 85, 2: 100, 3: 162 })
    expect(MOVE_MIN_LEVEL).toEqual({ physical: 1, 1: 1, 2: 10, 3: 20 })
  })

  it('R67 names', () => {
    expect(MOVE_NAMES).toEqual({
      terra: { 1: 'Stone Toss', 2: 'Quake Stomp', 3: 'Mountain Fall' },
      flame: { 1: 'Cinder Spit', 2: 'Blaze Lash', 3: 'Inferno Crown' },
      sea: { 1: 'Spray Bolt', 2: 'Riptide Lash', 3: 'Abyss Surge' },
      nature: { 1: 'Thorn Flick', 2: 'Bramble Lash', 3: 'Verdant Wrath' },
      electric: { 1: 'Spark Jab', 2: 'Arc Burst', 3: 'Storm Lance' },
      ice: { 1: 'Frost Nip', 2: 'Rime Shard', 3: 'Glacier Break' },
      metal: { 1: 'Iron Tap', 2: 'Steel Rake', 3: 'Anvil Drop' },
      dark: { 1: 'Shade Nip', 2: 'Gloom Rend', 3: 'Umbral Maw' },
      light: { 1: 'Glint', 2: 'Radiant Slash', 3: 'Dawn Verdict' },
      war: { 1: 'Spear Jab', 2: 'War Cleave', 3: "Warlord's Decree" },
    })
  })

  it('all 31 names are unique (Strike plus 30)', () => {
    const names = [kit('terra')[0]!.name, ...ELEMENTS.flatMap(e => [MOVE_NAMES[e][1], MOVE_NAMES[e][2], MOVE_NAMES[e][3]])]
    expect(names).toHaveLength(31)
    expect(new Set(names).size).toBe(31)
    expect(names[0]).toBe('Strike')
  })
})

describe('A17 fixed kits', () => {
  it('a basic dragon: Physical, then three in its element', () => {
    const k = kit('terra')
    expect(k.map(m => m.element)).toEqual(['physical', 'terra', 'terra', 'terra'])
    expect(k.map(m => m.tier)).toEqual(['physical', 1, 2, 3])
    expect(k.map(m => m.name)).toEqual(['Strike', 'Stone Toss', 'Quake Stomp', 'Mountain Fall'])
    expect(k.map(m => m.multPct)).toEqual([52, 85, 100, 162])
    expect(k.map(m => m.minLevel)).toEqual([1, 1, 10, 20])
  })

  it('two elements: primary, secondary, primary', () => {
    expect(kit('flame-sea').map(m => m.element)).toEqual(['physical', 'flame', 'sea', 'flame'])
    expect(kit('sea-flame').map(m => m.element)).toEqual(['physical', 'sea', 'flame', 'sea'])
  })

  it('three elements: primary, secondary, third', () => {
    expect(kit('flame-ice-sea').map(m => m.element)).toEqual(['physical', 'flame', 'ice', 'sea'])
    expect(kit('flame-ice-sea').map(m => m.name)).toEqual(['Strike', 'Cinder Spit', 'Rime Shard', 'Abyss Surge'])
  })

  it('every launch species has 4 moves with Physical in slot 0', () => {
    for (const sp of LAUNCH_CATALOG.species.values()) {
      const k = movesFor(sp)
      expect(k, sp.id).toHaveLength(4)
      expect(k[0]!.element, sp.id).toBe('physical')
      expect(k[0]!.tier, sp.id).toBe('physical')
    }
  })
})

describe('unlocks', () => {
  const k = kit('flame-sea')
  it('Lv 9 has T2 and T3 locked', () => {
    expect(k.map(m => moveUnlocked(m, 9))).toEqual([true, true, false, false])
  })
  it('Lv 10 opens T2, Lv 19 keeps T3 locked, Lv 20 opens it', () => {
    expect(k.map(m => moveUnlocked(m, 10))).toEqual([true, true, true, false])
    expect(k.map(m => moveUnlocked(m, 19))).toEqual([true, true, true, false])
    expect(k.map(m => moveUnlocked(m, 20))).toEqual([true, true, true, true])
  })
})

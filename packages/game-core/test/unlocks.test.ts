// M3 Task 3, R32: one unlock table behind every Player Level gate (GDD §4.4, §5.2-§5.5).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { UNLOCKS, isUnlocked, unlockPl, unlocksAt, type UnlockKey } from '../src/data/unlocks'
import { ELEMENTS } from '../src/elements'
import { createRng } from '../src/rng'
import { newPlayer, type Breeder, type IslandId, type PlayerState } from '../src/state'
import { err, ok } from './helpers'

const sorted = (xs: readonly string[]) => [...xs].sort()
/** Home expansions past the first keep today's values until M4 (R32); §4.4 lists only the first. */
const notLaterHome = (k: string) => !/^home:([1-9]|\d\d)$/.test(k)
const at = (pl: number) => sorted(unlocksAt(pl).filter(notLaterHome))

// GDD §4.4, copied row by row. A key per thing a cell names; "Hatchery slot n" is hatchery:n.
const SECTION_4_4: Record<number, string[]> = {
  1: ['habitat:terra', 'habitat:flame', 'farm:1', 'hatchery:1', 'basic:terra', 'basic:flame', 'crop:dragonBush'],
  2: ['mountain:1', 'home:0'],
  3: ['habitat:sea', 'habitat:nature', 'farm:2', 'basic:sea', 'basic:nature', 'crop:emberWheat'],
  4: ['farm:3', 'pve', 'hatchery:2'],
  5: ['roost:1', 'crop:seaMelon'],
  6: ['habitat:electric', 'basic:electric'],
  7: ['farm:4'],
  8: ['habitat:ice', 'wings', 'basic:ice', 'crop:thunderPumpkin'],
  10: ['habitat:metal', 'roost:2', 'basic:metal'],
  12: ['grove:1', 'island:isle2', 'crop:frostBerries'],
  13: ['hatchery:3'],
  14: ['habitat:dark', 'basic:dark'],
  15: ['roost:3', 'crop:warlordPepper'],
  16: ['habitat:light', 'basic:light'],
  18: ['habitat:war', 'island:isle3', 'basic:war'],
  21: ['hatchery:4'],
  22: ['roost:4'],
  25: ['island:isle4'],
  30: ['roost:5'],
}
// Gates §4.4's table leaves to §5.3 (farms 5-8) and §5.4 (the fifth slot, Mountain and Grove levels).
const SECTION_5: Record<number, string[]> = {
  10: ['farm:5', 'mountain:2'],
  15: ['hatcheryFifthSlot', 'farm:6'],
  20: ['farm:7', 'mountain:3', 'grove:2'],
  25: ['farm:8', 'grove:3'],
}

describe('the §4.4 unlock schedule, PL 1 to 30', () => {
  for (let pl = 1; pl <= 30; pl++) {
    it(`PL ${pl} opens exactly its row`, () => {
      expect(at(pl)).toEqual(sorted([...(SECTION_4_4[pl] ?? []), ...(SECTION_5[pl] ?? [])]))
    })
  }
  it('R32: Islands 5 and 6 sit at PL 32 and 40; Home expansions keep today\'s gates until M4', () => {
    expect([unlockPl('island:isle5'), unlockPl('island:dawnspire')]).toEqual([32, 40])
    expect([...Array(12).keys()].map(i => unlockPl(`home:${i}`))).toEqual([2, 4, 7, 10, 14, 18, 22, 27, 32, 37, 42, 47])
  })
  it('lists every key once, with a positive whole level', () => {
    for (const [k, pl] of Object.entries(UNLOCKS)) expect(Number.isInteger(pl) && pl >= 1, k).toBe(true)
    // 10 habitats + 10 basics + 6 crops + 8 farms + 3 + 3 + 4 + the fifth slot + 5 roosts + pve + wings + 12 home + 5 islands
    expect(Object.keys(UNLOCKS)).toHaveLength(10 + 10 + 6 + 8 + 3 + 3 + 4 + 1 + 5 + 1 + 1 + 12 + 5)
  })
  it('a Basic opens with its Habitat (§4.4), as two separate keys', () => {
    for (const e of ELEMENTS) expect(unlockPl(`basic:${e}`)).toBe(unlockPl(`habitat:${e}`))
  })
  it('isUnlocked is level >= gate', () => {
    expect([isUnlocked('pve', 3), isUnlocked('pve', 4), isUnlocked('pve', 40)]).toEqual([false, true, true])
  })
})

describe('no other file holds a gate', () => {
  const root = join(__dirname, '..', 'src')
  const files = (dir: string): string[] => readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []
  })
  it('only data/unlocks.ts and decorations.ts say minPl, or give unlockPl / minLevel a number', () => {
    const offenders = files(root).map(f => relative(root, f).replace(/\\/g, '/'))
      .filter(f => f !== 'data/unlocks.ts' && f !== 'decorations.ts')
      .filter(f => {
        const text = readFileSync(join(root, f), 'utf8')
        return /\bminPl\b|\b(unlockPl|minLevel)\s*:\s*\d|FARM_UNLOCK_PL|PVE_MIN_PLAYER_LEVEL/.test(text)
      })
    expect(offenders).toEqual([])
  })
})

// Review Focus 4: every key refuses at pl - 1 and allows at pl, through the action that spends it.
const P = (col: number, row: number, island: IslandId = 'home') => ({ island, col, row, facing: 0 as const })
const base = newPlayer(0)
const run = (s: PlayerState, a: Action) => applyAction(s, a, 0, createRng(1), LAUNCH_CATALOG)
const rich = (s: PlayerState, level: number): PlayerState => ({ ...s, level, gold: 1e12 })
const grove = (level = 1): Breeder => ({ kind: 'grove', egg: null, level, placement: P(7, 7) })

type Probe = (level: number) => { state: PlayerState; action: Action }
const probes = (): [UnlockKey, Probe][] => {
  const list: [UnlockKey, Probe][] = []
  for (const e of ELEMENTS) {
    list.push([`habitat:${e}`, l => ({ state: rich(base, l), action: { type: 'placeBuilding', building: { kind: 'habitat', element: e }, placement: P(7, 7) } })])
    list.push([`basic:${e}`, l => ({
      state: { ...rich(base, l), habitats: [...base.habitats, { id: 'hx', element: e, level: 1, lastCollectedMs: 0, placement: P(7, 7) }] },
      action: { type: 'buyBasic', element: e },
    })])
  }
  for (const c of ['dragonBush', 'emberWheat', 'seaMelon', 'thunderPumpkin', 'frostBerries', 'warlordPepper'] as const)
    list.push([`crop:${c}`, l => ({ state: rich(base, l), action: { type: 'plant', plot: 0, crop: c } })])
  for (let n = 1; n <= 8; n++) {
    list.push([`farm:${n}` as UnlockKey, l => ({
      state: {
        ...rich(base, l),
        islands: { ...base.islands, unlocked: ['home', 'isle2'] },
        farms: Array.from({ length: n - 1 }, (_, i) => ({ ...base.farms[0]!, placement: P((i % 5) * 3, Math.floor(i / 5) * 3 + 6, 'isle2') })),
      },
      action: { type: 'placeBuilding', building: { kind: 'farm' }, placement: P(14, 13, 'isle2') },
    })])
  }
  list.push(['mountain:1', l => ({
    state: { ...rich(base, l), firstHybridDone: true, dragons: base.dragons.map(d => ({ ...d, level: 4 })) },
    action: { type: 'startBreed', parentA: 'd1', parentB: 'd2' },
  })])
  for (const n of [2, 3]) list.push([`mountain:${n}` as UnlockKey, l => ({
    state: { ...rich(base, l), breeders: [{ ...base.breeders[0]!, level: n - 1 }] }, action: { type: 'startUpgrade', building: { type: 'breeder', index: 0 } },
  })])
  list.push(['grove:1', l => ({ state: rich(base, l), action: { type: 'placeBuilding', building: { kind: 'grove' }, placement: P(7, 7) } })])
  list.push(['grove:2', l => ({
    state: { ...rich(base, l), breeders: [base.breeders[0]!, grove(1)] }, action: { type: 'startUpgrade', building: { type: 'breeder', index: 1 } },
  })])
  list.push(['grove:3', l => ({
    state: { ...rich(base, l), breeders: [base.breeders[0]!, grove(2)] }, action: { type: 'buy', item: { kind: 'groveL3', index: 1 } },
  })])
  for (const n of [2, 3, 4]) list.push([`hatchery:${n}` as UnlockKey, l => ({
    state: { ...rich(base, l), hatcheryLevel: n - 1 }, action: { type: 'startUpgrade', building: { type: 'hatchery' } },
  })])
  list.push(['hatcheryFifthSlot', l => ({ state: rich(base, l), action: { type: 'buy', item: { kind: 'hatcheryL5' } } })])
  // Roost Tiers 1-5: the build (PL 5), the three upgrades (PL 10, 15, 22), and Ascension (PL 30).
  list.push(['roost:1', l => ({ state: rich(base, l), action: { type: 'placeBuilding', building: { kind: 'roost' }, placement: P(7, 7) } })])
  for (const n of [2, 3, 4]) list.push([`roost:${n}` as UnlockKey, l => ({
    state: { ...rich(base, l), roostPlacement: P(7, 7), roostTier: n - 1 }, action: { type: 'startUpgrade', building: { type: 'roost' } },
  })])
  list.push(['roost:5', l => ({ state: { ...rich(base, l), roostPlacement: P(7, 7), roostTier: 4 }, action: { type: 'buy', item: { kind: 'ascension' } } })])
  list.push(['pve', l => ({ state: rich(base, l), action: { type: 'pveBattle', stage: 1, team: ['d1', 'd2', 'dX'], moves: [] } })])
  for (let i = 0; i < 12; i++) list.push([`home:${i}`, l => ({ state: { ...rich(base, l), islands: { ...base.islands, homeStep: i } }, action: { type: 'expandIsland' } })])
  const order: IslandId[] = ['home', 'isle2', 'isle3', 'isle4', 'isle5', 'dawnspire']
  for (const id of order.slice(1)) list.push([`island:${id}` as UnlockKey, l => ({
    state: {
      ...rich(base, l),
      islands: { ...base.islands, unlocked: order.slice(0, order.indexOf(id)) },
      dragons: [...base.dragons, { id: 'dL', speciesId: [...LAUNCH_CATALOG.species.values()].find(sp => sp.rarity === 'legendary')!.id, level: 1, feeds: 0, habitatId: null }],
    },
    action: { type: 'unlockIsland' },
  })])
  return list
}

describe('every gate refuses at PL - 1 and opens at PL', () => {
  // `wings` has no action behind it yet; `hatchery:1` is the free starting level.
  const covered = probes()
  it('covers every key that has an action', () => {
    const missing = (Object.keys(UNLOCKS) as UnlockKey[]).filter(k => k !== 'wings' && k !== 'hatchery:1' && !covered.some(([c]) => c === k))
    expect(missing).toEqual([])
  })
  for (const [key, probe] of covered) {
    const pl = unlockPl(key)
    if (pl > 1) it(`${key}: LEVEL_TOO_LOW at ${pl - 1}`, () => {
      const { state, action } = probe(pl - 1)
      err(run(state, action), 'LEVEL_TOO_LOW')
    })
    it(`${key}: not refused for level at ${pl}`, () => {
      const { state, action } = probe(pl)
      const r = run(state, action)
      if (r.ok) return
      expect(r.error, key).not.toBe('LEVEL_TOO_LOW')
      // Past the level gate, each probe's only expected refusal is a missing second Hatchery team, never the level.
      if (key === 'pve') expect(r.error).toBe('INVALID_TEAM')
      else if (key === 'island:dawnspire') expect(r.error).not.toBe('NO_LEGENDARY')
    })
  }
  it('actions that spend a gate succeed at PL (Gold and room given)', () => {
    for (const k of ['habitat:war', 'roost:1', 'roost:2', 'roost:3', 'roost:4', 'basic:sea', 'crop:seaMelon', 'farm:3', 'mountain:1', 'mountain:2', 'grove:1', 'grove:2', 'grove:3', 'hatchery:2', 'hatcheryFifthSlot', 'home:0', 'island:isle2'] as UnlockKey[]) {
      const { state, action } = covered.find(([c]) => c === k)![1](unlockPl(k))
      ok(run(state, action))
    }
  })
})

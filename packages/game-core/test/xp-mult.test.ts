import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { HARVEST_XP_PER_TIER, HATCH_XP, START_BREED_XP } from '../src/data/xp'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { FLASH_14, FLASH_28, type Preset } from '../src/data/presets'
import { feedXp } from '../src/dragon'
import { addXp } from '../src/progression'
import { createRng } from '../src/rng'
import { newPlayer, type PlayerState } from '../src/state'
import { err, ok } from './helpers'

const base = newPlayer(0)
// At max level XP accumulates unreduced, so awards can be read straight off `xp`.
const maxed: PlayerState = { ...base, level: 50 }
const run = (st: PlayerState, a: Action, t: number, preset: Preset = FLASH_14) =>
  applyAction(st, a, t, createRng(1), LAUNCH_CATALOG, preset, 1)

describe('addXp applies the preset multiplier (R27)', () => {
  it('multiplies by xpMult', () => {
    expect(addXp(base, 1, FLASH_14, 1).xp).toBe(12)
    expect(addXp(base, 1, FLASH_28, 1).xp).toBe(8)
    expect(addXp(base, 5, FLASH_14, 1)).toMatchObject({ level: 2, xp: 10 })
  })
})

describe('xpMult on every award', () => {
  it('a Lv 1 feed awards feedXp(5) x xpMult', () => {
    expect(feedXp(5)).toBe(1)
    expect(ok(run(base, { type: 'feed', dragonId: 'd1' }, 0)).xp).toBe(12)
    expect(ok(run(base, { type: 'feed', dragonId: 'd1' }, 0, FLASH_28)).xp).toBe(8)
  })

  it('harvest awards tier x 2 classic XP, times xpMult', () => {
    expect(HARVEST_XP_PER_TIER).toBe(2)
    const harvestOf = (crop: 'dragonBush' | 'warlordPepper', preset: Preset) => {
      const st = { ...maxed, farms: [{ ...base.farms[0]!, crop, readyAtMs: 0 }] }
      return ok(run(st, { type: 'harvest', plot: 0 }, 0, preset)).xp
    }
    expect(harvestOf('dragonBush', FLASH_14)).toBe(24)
    expect(harvestOf('warlordPepper', FLASH_14)).toBe(144)
    expect(harvestOf('dragonBush', FLASH_28)).toBe(16)
  })

  it('starting a breed awards 5 x xpMult and hatching a Rare 80 x xpMult', () => {
    const st: PlayerState = { ...maxed, firstHybridDone: true, dragons: base.dragons.map(d => ({ ...d, level: 4 })) }
    expect(ok(run(st, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 0)).xp).toBe(START_BREED_XP * 12)
    const r = ok(run({ ...maxed, hatchery: [{ speciesId: 'terra-flame', readyAtMs: 0 }] }, { type: 'hatch', slot: 0 }, 0))
    expect(HATCH_XP.rare).toBe(80)
    expect(r.xp).toBe(960)
  })

  it('collecting Gold awards no XP', () => {
    expect(ok(run(base, { type: 'collectGold', habitatId: 'h1' }, 600_000)).xp).toBe(0)
  })
})

describe('Flash-14 reaches PL 2 with feeding or harvesting alone', () => {
  it('five feeds (25 Food, 60 XP)', () => {
    let st = base
    // Alternate dragons so all five feeds are Lv 1 feeds (a dragon levels up after four).
    for (let i = 0; i < 5; i++) st = ok(run(st, { type: 'feed', dragonId: i % 2 ? 'd2' : 'd1' }, i))
    expect(st.food).toBe(25)
    expect(st.level).toBe(2)
    expect(st.xp).toBe(10)
  })

  it('three Dragon Bushes (72 XP)', () => {
    let st = base
    for (let i = 0; i < 3; i++) {
      const t = i * 100_000
      st = ok(run(st, { type: 'plant', plot: 0, crop: 'dragonBush' }, t))
      st = ok(run(st, { type: 'harvest', plot: 0 }, t + 15_000))
    }
    expect(st.level).toBe(2)
    expect(st.xp).toBe(22)
  })

  it('then startBreed no longer fails for Player Level', () => {
    let st = base
    for (let i = 0; i < 5; i++) st = ok(run(st, { type: 'feed', dragonId: i % 2 ? 'd2' : 'd1' }, i))
    expect(st.level).toBe(2)
    const leveled = { ...st, dragons: st.dragons.map(d => ({ ...d, level: 4 })) }
    ok(run(leveled, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 10))
    err(run({ ...leveled, level: 1 }, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 10), 'LEVEL_TOO_LOW')
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { getSpecies } from '../src/catalog'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { FLASH_14, FLASH_28, type Preset } from '../src/data/presets'
import { HATCH_XP, XP_LEVEL_LIMITS } from '../src/data/xp'
import { addRawXp, addXp, breedXpApplies, buildXp, cumulativeXp, levelLimit, settleLevels, xpToNext } from '../src/progression'
import { createRng } from '../src/rng'
import { newPlayer, type BreederEgg, type PlayerState } from '../src/state'
import { ok } from './helpers'
import { breedLoop, casual, harvestAndFeed, harvestLoop, runBot, type BotPlan, type BotResult } from './helpers/xpBots'

const base = newPlayer(0)
const run = (st: PlayerState, a: Action, day: number, preset: Preset = FLASH_14, seed = 1, t = 0) =>
  applyAction(st, a, t, createRng(seed), LAUNCH_CATALOG, preset, day)
const sp = (id: string) => getSpecies(LAUNCH_CATALOG, id)
const juvenile = (id: string, speciesId: string, habitatId: string) => ({ id, speciesId, level: 4, feeds: 0, habitatId })
/** Level 5 (so the breed gate is open) with two parents and an empty building; `done` skips the scripted first hybrid. */
const parents = (a: string, b: string, done = true): PlayerState => ({
  ...base, level: 5, firstHybridDone: done, discovered: ['terra', 'flame', 'sea', 'nature', 'sea-nature', 'terra-flame'],
  habitats: [...base.habitats, { ...base.habitats[0]!, id: 'h3', element: 'sea' }],
  dragons: [juvenile('d1', a, 'h1'), juvenile('d2', b, 'h3')],
})
/** The seed under which a breed of (a, b) rolls an egg meeting `want`, for pinning a specific roll. */
function seedFor(st: PlayerState, want: (e: BreederEgg) => boolean): number {
  for (let seed = 1; seed < 500; seed++) {
    const egg = ok(run(st, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 1, FLASH_14, seed)).breeders[0]!.egg!
    if (want(egg)) return seed
  }
  throw new Error('no seed rolls that egg')
}
/** Starts the breed at XP 0, carries the egg to the Hatchery and hatches it; the XP each step paid. */
function breedAndHatch(st: PlayerState, seed: number): { start: number; hatch: number; speciesId: string } {
  const total = (x: PlayerState) => cumulativeXp(x.level) + x.xp
  const laid = ok(run(st, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 5, FLASH_14, seed))
  const egg = laid.breeders[0]!.egg!
  const moved = ok(run(laid, { type: 'collectEgg', breeder: 0 }, 5, FLASH_14, 1, egg.readyAtMs))
  const hatched = ok(run(moved, { type: 'hatch', slot: 0 }, 5, FLASH_14, 1, moved.hatchery[0]!.readyAtMs))
  return { start: total(laid) - total(st), hatch: total(hatched) - total(laid), speciesId: egg.speciesId }
}

describe('no breed XP from Commons alone (Q1 a)', () => {
  it('breedXpApplies is false only when both parents and the child are Common', () => {
    expect(breedXpApplies(sp('terra'), sp('flame'), sp('terra'))).toBe(false)
    expect(breedXpApplies(sp('terra'), sp('flame'), sp('terra-flame'))).toBe(true)
    expect(breedXpApplies(sp('terra'), sp('sea-nature'), sp('terra'))).toBe(true)
  })

  it('Terra x Terra after the first hybrid pays 0 on start and on hatch', () => {
    const r = breedAndHatch(parents('terra', 'terra'), 1)
    expect(r).toEqual({ start: 0, hatch: 0, speciesId: 'terra' })
  })

  it('Terra x Flame rolling a hybrid pays 60 on start, and hatch XP as usual', () => {
    const st = parents('terra', 'flame')
    const r = breedAndHatch(st, seedFor(st, e => e.speciesId === 'terra-flame'))
    expect(r).toEqual({ start: 60, hatch: 960, speciesId: 'terra-flame' })
  })

  it('the scripted first hybrid pays like any hybrid', () => {
    expect(breedAndHatch(parents('terra', 'flame', false), 1).start).toBe(60)
  })

  it('the scripted first hybrid is not XP-free, and pays its hatch XP', () => {
    const st = parents('terra', 'flame', false)
    const laid = ok(run(st, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 5, FLASH_14, 1))
    expect(laid.breeders[0]!.egg!.xpFree).toBe(false)
    const r = breedAndHatch(st, 1)
    const child = sp(r.speciesId)
    expect(r.hatch).toBe(HATCH_XP[child.rarity] * FLASH_14.xpMult * (st.discovered.includes(child.id) ? 1 : 2))
    expect(r.hatch).toBeGreaterThan(0)
  })

  it('Terra x Flame rolling a Common pays 0', () => {
    const st = parents('terra', 'flame')
    const r = breedAndHatch(st, seedFor(st, e => sp(e.speciesId).rarity === 'common'))
    expect([r.start, r.hatch]).toEqual([0, 0])
  })

  it('Terra x Sea-Nature giving a Common pays normal XP', () => {
    const st = parents('terra', 'sea-nature')
    const r = breedAndHatch(st, seedFor(st, e => sp(e.speciesId).rarity === 'common'))
    expect([r.start, r.hatch]).toEqual([60, 120])
  })

  it('the egg records it, so a hatch needs no parents', () => {
    const st = parents('terra', 'terra')
    const laid = ok(run(st, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 5))
    expect(laid.breeders[0]!.egg!.xpFree).toBe(true)
    const moved = ok(run(laid, { type: 'collectEgg', breeder: 0 }, 5, FLASH_14, 1, laid.breeders[0]!.egg!.readyAtMs))
    expect(moved.hatchery[0]!.xpFree).toBe(true)
    const noParents: PlayerState = { ...moved, dragons: [] }
    const hatched = ok(run(noParents, { type: 'hatch', slot: 0 }, 5, FLASH_14, 1, moved.hatchery[0]!.readyAtMs))
    expect([hatched.level, hatched.xp]).toEqual([laid.level, laid.xp])
    expect(hatched.goalStats.hatches).toBe(1)
  })
})

describe('the level limit per game day (Q1 b, R40, R41)', () => {
  it('reads the §7.2 rows through Endgame', () => {
    expect(XP_LEVEL_LIMITS.flash14).toEqual([[1, 12], [2, 18], [3, 25], [4, 30], [5, 32], [6, 33], [7, 34], [8, 36], [9, 37], [10, 38], [11, 39], [12, 40]])
    expect(XP_LEVEL_LIMITS.flash28).toEqual([[2, 12], [3, 18], [5, 25], [7, 30], [8, 32], [10, 33], [12, 34], [14, 35], [16, 36], [18, 37], [20, 38], [22, 39], [25, 40]])
    expect(levelLimit(0, FLASH_14)).toBe(12) // before launch
  })

  it('levelLimit at every row boundary, and none from Finals on', () => {
    for (const preset of [FLASH_14, FLASH_28]) {
      let prev = 0
      for (const [lastDay, max] of XP_LEVEL_LIMITS[preset.id]) {
        expect(levelLimit(prev + 1, preset), `${preset.id} day ${prev + 1}`).toBe(max)
        expect(levelLimit(lastDay, preset), `${preset.id} day ${lastDay}`).toBe(max)
        prev = lastDay
      }
      expect(levelLimit(prev + 1, preset)).toBeNull()
    }
    expect(levelLimit(13, FLASH_14)).toBeNull()
    expect(levelLimit(26, FLASH_28)).toBeNull()
    expect(levelLimit(12, FLASH_14)).toBe(40)
    expect(levelLimit(25, FLASH_28)).toBe(40)
  })

  it('R41: a bank of XP for PL 45 on Flash-14 reaches PL 32 on Day 5 only, PL 40 on Day 12, and the rest on Day 13', () => {
    const bank = (pl: number, extra = 0): PlayerState => ({ ...base, level: 12, xp: cumulativeXp(pl) - cumulativeXp(12) + extra })
    const d5 = settleLevels(bank(45), FLASH_14, 5)
    expect(d5).toMatchObject({ level: 32, xp: cumulativeXp(45) - cumulativeXp(32) })
    const d12 = settleLevels(d5, FLASH_14, 12)
    expect(d12).toMatchObject({ level: 40, xp: cumulativeXp(45) - cumulativeXp(40) })
    expect(settleLevels(d12, FLASH_14, 13)).toMatchObject({ level: 45, xp: 0 })
    // Day 13 pays all the way to the cap and keeps the remainder.
    expect(settleLevels(bank(50, 777), FLASH_14, 13)).toMatchObject({ level: 50, xp: 777 })
    expect(settleLevels(bank(50, 777), FLASH_14, 12)).toMatchObject({ level: 40 })
  })

  it('R41: banked XP pays before the action is judged, so a first action on a new day sees the new level', () => {
    // Level 11 holding XP for PL 14: Frost Berries need PL 12.
    const held: PlayerState = { ...base, level: 11, xp: xpToNext(11) + xpToNext(12) + xpToNext(13) + 5, gold: 1_000_000 }
    const r = run(held, { type: 'plant', plot: 0, crop: 'frostBerries' }, 2)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state).toMatchObject({ level: 14, xp: 5 })
    // Contrast: Warlord Pepper needs PL 15. On Day 1 (limit 12) it is refused; on Day 2 (limit 18) the same bank opens it.
    const rich: PlayerState = { ...base, level: 12, xp: cumulativeXp(16) - cumulativeXp(12), gold: 1_000_000 }
    const pepper = { type: 'plant', plot: 0, crop: 'warlordPepper' } as const
    expect(run(rich, pepper, 1)).toMatchObject({ ok: false, error: 'LEVEL_TOO_LOW' })
    expect(ok(run(rich, pepper, 2))).toMatchObject({ level: 16, xp: 0 })
  })

  const toPl = (pl: number): PlayerState => ({ ...base, xp: cumulativeXp(pl) })

  it('at Flash-14 Day 1, XP for PL 15 stays PL 12 with the XP kept; Day 2\'s first action raises it to PL 15', () => {
    const banked = settleLevels(toPl(15), FLASH_14, 1)
    expect(banked.level).toBe(12)
    expect(banked.xp).toBe(cumulativeXp(15) - cumulativeXp(12))
    // An action that awards no XP pays it: applyAction settles after every success.
    const paid = ok(run(banked, { type: 'collectGold', habitatId: 'h1' }, 2))
    expect(paid).toMatchObject({ level: 15, xp: 0 })
  })

  it('a refused action pays nothing; the retry through a successful Day 2 action pays the bank', () => {
    const banked = settleLevels(toPl(15), FLASH_14, 1)
    const refused = run(banked, { type: 'harvest', plot: 0 }, 2)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect('state' in refused).toBe(false)
    expect(ok(run(banked, { type: 'collectGold', habitatId: 'h1' }, 2))).toMatchObject({ level: 15, xp: 0 })
  })

  it('a same-day action leaves the bank alone', () => {
    const banked = settleLevels(toPl(15), FLASH_14, 1)
    expect(ok(run(banked, { type: 'collectGold', habitatId: 'h1' }, 1))).toMatchObject({ level: 12, xp: banked.xp })
  })

  it('Review Focus 5: banked XP across three levels is all paid, none lost, with the remainder kept', () => {
    const extra = 123
    const banked = addXp({ ...base, level: 12 }, 0, { ...FLASH_14, xpMult: 1 }, 1)
    const xp = xpToNext(12) + xpToNext(13) + xpToNext(14) + extra
    const held = addRawXp(banked, xp, FLASH_14, 1)
    expect(held).toMatchObject({ level: 12, xp })
    expect(ok(run(held, { type: 'collectGold', habitatId: 'h1' }, 2))).toMatchObject({ level: 15, xp: extra })
  })

  it('a bank larger than the next day\'s limit pays up to that limit and keeps the rest', () => {
    const banked = settleLevels(toPl(30), FLASH_14, 1)
    const day2 = ok(run(banked, { type: 'collectGold', habitatId: 'h1' }, 2))
    expect(day2).toMatchObject({ level: 18, xp: cumulativeXp(30) - cumulativeXp(18) })
    const day3 = ok(run(day2, { type: 'collectGold', habitatId: 'h1' }, 3))
    expect(day3).toMatchObject({ level: 25, xp: cumulativeXp(30) - cumulativeXp(25) })
    const day4 = ok(run(day3, { type: 'collectGold', habitatId: 'h1' }, 4))
    expect(day4).toMatchObject({ level: 30, xp: 0 })
  })

  it('Day 13 (Finals) has no limit; Day 12 stops at PL 40', () => {
    expect(settleLevels(toPl(45), FLASH_14, 13)).toMatchObject({ level: 45, xp: 0 })
    expect(settleLevels(toPl(45), FLASH_14, 4)).toMatchObject({ level: 30 })
  })

  it('Flash-28 limits by its own rows', () => {
    for (const [day, level] of [[1, 12], [2, 12], [3, 18], [4, 25], [5, 25], [6, 30], [7, 30], [8, 32], [10, 33], [25, 40], [26, 45]] as const) {
      expect(settleLevels(toPl(45), FLASH_28, day).level, `day ${day}`).toBe(level)
    }
  })

  it('a level already above the limit never falls', () => {
    expect(settleLevels({ ...base, level: 20, xp: xpToNext(20) * 2 }, FLASH_14, 1)).toMatchObject({ level: 20 })
  })

  it('build XP adds to a bank, and its one-level cap reads the current level', () => {
    const held: PlayerState = { ...base, level: 12, xp: xpToNext(12) + 100, gold: 150_000 }
    const a = ok(run(held, { type: 'buyBridge', island: 'isle2' }, 1))
    expect(a).toMatchObject({ level: 12, xp: held.xp + xpToNext(12) })
    // 400,000 Gold is worth 20,000 XP; the award stays at one level's worth with a bank waiting.
    const big: PlayerState = { ...base, level: 12, xp: xpToNext(12) }
    expect(buildXp(400_000, big)).toBe(xpToNext(12))
  })
})

const dayOf = (r: BotResult, pl: number) => r.reached.get(pl)?.day
const hoursOf = (r: BotResult, pl: number) => r.reached.get(pl)?.hours ?? Infinity

/** A bot runs thousands of simulated actions; the default 5 s is too short on a loaded machine. */
const BOT_TIMEOUT_MS = 120_000

/** Bots playing the real rules from newPlayer (§4.3, §7.2). Each also has to get there, so a bot stuck at PL 1 can't pass. */
describe('non-stop bots hold to the §4.3 targets', () => {
  const flash14: readonly BotPlan[] = [
    harvestLoop(FLASH_14, 30, 5), harvestAndFeed(FLASH_14, 30, 5),
    breedLoop(FLASH_14, 30, 5, 1), breedLoop(FLASH_14, 30, 5, 2), breedLoop(FLASH_14, 30, 5, 3),
  ]
  for (const plan of flash14) {
    it(`Flash-14 ${plan.name} (seed ${plan.seed ?? 1}): PL 20 no earlier than Day 3, PL 30 no earlier than Day 4`, () => {
      const r = runBot(plan)
      expect(dayOf(r, 12)).toBe(1)
      expect(r.endOfDay).toEqual([12, 18, 25])
      expect(dayOf(r, 20)).toBe(3)
      expect(dayOf(r, 30)).toBe(4)
    }, BOT_TIMEOUT_MS)
  }

  for (const plan of [harvestLoop(FLASH_28, 20, 5), harvestAndFeed(FLASH_28, 20, 5), breedLoop(FLASH_28, 20, 5)]) {
    it(`Flash-28 ${plan.name}: PL 20 no earlier than Day 4`, () => {
      const r = runBot(plan)
      expect(r.endOfDay).toEqual([12, 12, 18])
      expect(dayOf(r, 20)).toBe(4)
    }, BOT_TIMEOUT_MS)
  }
})

describe('the casual bot: 6 sessions of 30 minutes a day, on the Gold and Food the game gives', () => {
  let r: BotResult
  beforeAll(() => { r = runBot(casual(FLASH_14, 50, 12)) }, BOT_TIMEOUT_MS)

  it('is inside the brief\'s bound: PL 12 by Day 2, PL 30 by Day 8', () => {
    expect(dayOf(r, 12)).toBeLessThanOrEqual(2)
    expect(dayOf(r, 30)).toBeLessThanOrEqual(8)
  })

  it('meets §7.2 exactly, because the limit is what paces it', () => {
    // Measured: PL 12 in the first session of Day 1, then every later level is the bank paying on the day's first action.
    expect(hoursOf(r, 12)).toBeLessThan(0.5)
    expect(r.endOfDay.slice(0, 4)).toEqual([12, 18, 25, 30])
    expect(hoursOf(r, 18)).toBeLessThan(24.5)
    expect(hoursOf(r, 25)).toBeLessThan(48.5)
    expect(hoursOf(r, 30)).toBeLessThan(72.5)
  })

  it('stays on §7.2 through Day 12 (R41): at most PL 32 at the end of Day 5, PL 40 at the end of Day 12', () => {
    expect(r.endOfDay).toHaveLength(12)
    expect(r.endOfDay[4]).toBeLessThanOrEqual(32)
    expect(r.endOfDay[11]).toBeLessThanOrEqual(40)
    expect(r.endOfDay.every((pl, i) => pl <= (levelLimit(i + 1, FLASH_14) ?? 50))).toBe(true)
    expect(r.endOfDay).toEqual([12, 18, 25, 30, 32, 33, 34, 36, 37, 38, 39, 40]) // paced by the limit, as measured
  })
})

describe('non-stop bots stay on §7.2 through Day 12 (R41)', () => {
  const plans: readonly BotPlan[] = [
    harvestLoop(FLASH_14, 50, 12), harvestAndFeed(FLASH_14, 50, 12), breedLoop(FLASH_14, 50, 12, 1), breedLoop(FLASH_14, 50, 12, 2),
  ]
  for (const plan of plans) {
    it(`Flash-14 ${plan.name} (seed ${plan.seed ?? 1}): at most PL 32 at the end of Day 5, PL 40 at the end of Day 12`, () => {
      const r = runBot(plan)
      expect(r.endOfDay).toHaveLength(12)
      expect(r.endOfDay[4]).toBeLessThanOrEqual(32)
      expect(r.endOfDay[11]).toBeLessThanOrEqual(40)
      expect(r.endOfDay.every((pl, i) => pl <= (levelLimit(i + 1, FLASH_14) ?? 50))).toBe(true)
      expect(r.endOfDay).toEqual([12, 18, 25, 30, 32, 33, 34, 36, 37, 38, 39, 40])
    }, BOT_TIMEOUT_MS)
  }
})

describe('the 14 Goals finish on the Gold and Food the game gives, on both presets', () => {
  for (const preset of [FLASH_14, FLASH_28]) {
    it(`${preset.id}: the casual bot claims all 14 with no grants`, () => {
      const r = runBot(casual(preset, 50, 6))
      expect(r.final.goalIndex).toBe(14)
    }, BOT_TIMEOUT_MS)
  }
})

// §6.3 dragon fatigue, R68: absolute HP plus a timestamp, regen floored, capped at max. Review Focus 3.
import { describe, expect, it } from 'vitest'
import { afterBattle, anyHurt, canFight, currentHp, maxHp, holdHp } from '../src/fatigue'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { FLASH_14, FLASH_28 } from '../src/data/presets'
import { MIN_FIGHT_PCT } from '../src/data/trials'
import { newPlayer, type Dragon } from '../src/state'

const C = LAUNCH_CATALOG
const MIN = 60_000
const lv40 = (fatigue?: Dragon['fatigue']): Dragon => ({ id: 'd1', speciesId: 'terra', level: 40, feeds: 0, habitatId: null, ...(fatigue ? { fatigue } : {}) })

describe('reading HP', () => {
  it('a Common Lv 40 has 8,000 HP, and no fatigue means full', () => {
    expect(maxHp(lv40(), C)).toBe(8_000)
    expect(currentHp(lv40(), C, 123, FLASH_14)).toBe(8_000)
  })

  it('Flash-14 regains 6 % a minute, full after 17 minutes (§6.3)', () => {
    const d = lv40({ hp: 1, atMs: 0 })
    expect(currentHp(d, C, 0, FLASH_14)).toBe(1)
    expect(currentHp(d, C, MIN, FLASH_14)).toBe(481)
    expect(currentHp(d, C, 16 * MIN, FLASH_14)).toBe(7_681)
    expect(currentHp(d, C, 17 * MIN, FLASH_14)).toBe(8_000)
    expect(currentHp(d, C, 1_000 * MIN, FLASH_14)).toBe(8_000)
  })

  it('Flash-28 regains 4 % a minute (§6.3)', () => {
    expect(currentHp(lv40({ hp: 1, atMs: 0 }), C, MIN, FLASH_28)).toBe(321)
  })

  it('floors the regen between whole minutes (R68)', () => {
    // 8,000 x 6 % = 480 a minute = 8 per second: 1 ms short of a second still reads the last whole HP.
    expect(currentHp(lv40({ hp: 1, atMs: 0 }), C, 999, FLASH_14)).toBe(1 + 7)
    expect(currentHp(lv40({ hp: 1, atMs: 0 }), C, 1_000, FLASH_14)).toBe(1 + 8)
  })

  it('a clock stepping back reads the stored HP: no more, and never less', () => {
    expect(currentHp(lv40({ hp: 500, atMs: 10 * MIN }), C, 2 * MIN, FLASH_14)).toBe(500)
  })
})

describe('the 25 % gate (R68: hp x 4 >= max)', () => {
  it('2,000 of 8,000 fights, 1,999 rests', () => {
    expect(MIN_FIGHT_PCT).toBe(25)
    expect(canFight(lv40({ hp: 2_000, atMs: 0 }), C, 0, FLASH_14)).toBe(true)
    expect(canFight(lv40({ hp: 1_999, atMs: 0 }), C, 0, FLASH_14)).toBe(false)
    expect(canFight(lv40(), C, 0, FLASH_14)).toBe(true)
  })

  it('regen carries a dragon over the gate', () => {
    const d = lv40({ hp: 1, atMs: 0 })
    expect(canFight(d, C, 4 * MIN, FLASH_14)).toBe(false) // 1,921
    expect(canFight(d, C, 5 * MIN, FLASH_14)).toBe(true) // 2,401
  })
})

describe('a level-up while tired (R68)', () => {
  it('raises max, not HP', () => {
    const tired = lv40({ hp: 1_000, atMs: 5 })
    const higher = { ...tired, level: 41 }
    expect(maxHp(higher, C)).toBeGreaterThan(8_000)
    expect(currentHp(higher, C, 5, FLASH_14)).toBe(1_000)
  })

  it('holdHp freezes what regen has given so far, so the higher max does not reprice it', () => {
    const tired = lv40({ hp: 1, atMs: 0 })
    const held = holdHp(tired, C, MIN, FLASH_14)
    expect(held.fatigue).toEqual({ hp: 481, atMs: MIN })
    expect(currentHp({ ...held, level: 41 }, C, MIN, FLASH_14)).toBe(481)
  })

  it('holdHp clears a fatigue that has healed fully, and leaves a rested dragon alone', () => {
    expect(holdHp(lv40({ hp: 1, atMs: 0 }), C, 20 * MIN, FLASH_14)).toEqual(lv40())
    expect(holdHp(lv40(), C, 0, FLASH_14)).toEqual(lv40())
  })
})

describe('afterBattle', () => {
  it('a KO comes back on 1 HP (§6.3)', () => {
    expect(afterBattle(lv40(), 0, C, 9).fatigue).toEqual({ hp: 1, atMs: 9 })
  })
  it('keeps real HP and stamps the time', () => {
    expect(afterBattle(lv40(), 4_321, C, 9).fatigue).toEqual({ hp: 4_321, atMs: 9 })
  })
  it('max HP clears fatigue', () => {
    expect(afterBattle(lv40({ hp: 1, atMs: 0 }), 8_000, C, 9)).toEqual(lv40())
  })
})

describe('anyHurt', () => {
  it('counts only fatigue that has not healed yet', () => {
    const s = { ...newPlayer(0), dragons: [lv40()] }
    expect(anyHurt(s, C, 0, FLASH_14)).toBe(false)
    const tired = { ...s, dragons: [lv40({ hp: 1, atMs: 0 })] }
    expect(anyHurt(tired, C, 0, FLASH_14)).toBe(true)
    expect(anyHurt(tired, C, 17 * MIN, FLASH_14)).toBe(false)
  })
})

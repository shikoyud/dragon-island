import { describe, expect, it } from 'vitest'
import { addXp, MAX_PLAYER_LEVEL, xpToNext } from '../src/progression'
import { FLASH_14 } from '../src/data/presets'
import { newPlayer } from '../src/state'

describe('player xp', () => {
  const s = newPlayer(0)
const x1 = { ...FLASH_14, xpMult: 1 }

  it('needs 50·L² per level', () => {
    expect(MAX_PLAYER_LEVEL).toBe(50)
    expect(xpToNext(1)).toBe(50)
    expect(xpToNext(3)).toBe(450)
  })

  it('levels up, carrying remainder', () => {
    expect(addXp(s, 60, x1)).toMatchObject({ level: 2, xp: 10 })
    expect(addXp(s, 250, x1)).toMatchObject({ level: 3, xp: 0 })
  })

  it('stops at max level and keeps accumulating', () => {
    expect(addXp({ ...s, level: 50, xp: 0 }, 999_999, x1)).toMatchObject({ level: 50, xp: 999_999 })
  })

  it('does not mutate input', () => {
    addXp(s, 1000, x1)
    expect(s).toEqual(newPlayer(0))
  })
})

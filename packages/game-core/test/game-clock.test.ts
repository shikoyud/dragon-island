import { describe, expect, it } from 'vitest'
import { finalsLockAtMs, gameDay, phaseOf, shutdownAtMs } from '../src/game-clock'
import { FLASH_14, FLASH_28 } from '../src/data/presets'

const DAY = 86_400_000

describe('game clock', () => {
  it('numbers days from 1 on launch day, 0 before launch', () => {
    expect(gameDay(0, 0)).toBe(1)
    expect(gameDay(0, DAY - 1)).toBe(1)
    expect(gameDay(0, DAY)).toBe(2)
    expect(gameDay(10, 0)).toBe(0)
  })
  it('maps days to phases for Flash-14', () => {
    expect(phaseOf(0, FLASH_14)).toBe('prelaunch')
    expect(phaseOf(1, FLASH_14)).toBe('rush')
    expect(phaseOf(4, FLASH_14)).toBe('rush')
    expect(phaseOf(5, FLASH_14)).toBe('endgame')
    expect(phaseOf(12, FLASH_14)).toBe('endgame')
    expect(phaseOf(13, FLASH_14)).toBe('finals')
    expect(phaseOf(14, FLASH_14)).toBe('finals')
    expect(phaseOf(15, FLASH_14)).toBe('settlement')
    expect(phaseOf(21, FLASH_14)).toBe('settlement')
    expect(phaseOf(22, FLASH_14)).toBe('closed')
  })
  it('maps days to phases for Flash-28', () => {
    expect(phaseOf(7, FLASH_28)).toBe('rush')
    expect(phaseOf(8, FLASH_28)).toBe('endgame')
    expect(phaseOf(26, FLASH_28)).toBe('finals')
    expect(phaseOf(29, FLASH_28)).toBe('settlement')
    expect(phaseOf(36, FLASH_28)).toBe('closed')
  })
  it('finalsLockAtMs is the end of the last finals day', () => {
    expect(finalsLockAtMs(0, FLASH_14)).toBe(14 * DAY)
    expect(finalsLockAtMs(5, FLASH_28)).toBe(5 + 28 * DAY)
  })
  it('shutdownAtMs is the end of settlement', () => {
    expect(shutdownAtMs(0, FLASH_14)).toBe(21 * DAY)
    expect(shutdownAtMs(7, FLASH_28)).toBe(7 + 35 * DAY)
  })
})

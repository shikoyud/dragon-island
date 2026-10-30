import type { GameInfo } from '@wyrmhaven/shared'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TerminalClock, terminalLabel } from '../src/hud/TerminalClock'

const DAY = 86_400_000
const HOUR = 3_600_000
const game = (over: Partial<GameInfo> = {}): GameInfo => ({ launchAtMs: 0, serverNowMs: 0, preset: 'flash14', day: 1, phase: 'rush', commitHash: '0x00', revealedSecret: null, ...over })

describe('TerminalClock', () => {
  it('counts down to the Finals lock in rush and endgame', () => {
    render(<TerminalClock game={game()} nowMs={DAY * 10 + HOUR} />)
    expect(screen.getByRole('timer')).toHaveTextContent('Finals lock in 3d 23:00:00')
  })

  it('zero-pads the clock parts and counts from day 1', () => {
    expect(terminalLabel(game(), 12 * DAY - 4 * HOUR - 66_000)).toBe('Finals lock in 2d 04:01:06')
    expect(terminalLabel(game(), DAY)).toBe('Finals lock in 13d 00:00:00')
  })

  it('counts down to the end of the finals during the finals', () => {
    expect(terminalLabel(game(), 12 * DAY + 1_000)).toBe('Finals end in 1d 23:59:59')
  })

  it('counts down the redemption window during settlement', () => {
    expect(terminalLabel(game(), 14 * DAY + HOUR)).toBe('Redemption ends in 6d 23:00:00')
  })

  it('counts down to launch before launch', () => {
    expect(terminalLabel(game({ launchAtMs: 5 * DAY }), 4 * DAY + 13 * HOUR)).toBe('Launch in 0d 11:00:00')
  })

  it('shows nothing once the game is closed', () => {
    expect(terminalLabel(game(), 22 * DAY)).toBeNull()
    const { container } = render(<TerminalClock game={game()} nowMs={22 * DAY} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('follows the preset: Flash-28 has a later lock', () => {
    expect(terminalLabel(game({ preset: 'flash28' }), 10 * DAY)).toBe('Finals lock in 18d 00:00:00')
  })
})

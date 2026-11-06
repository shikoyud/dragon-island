import { LAUNCH_CATALOG, newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { bookCount, goalsBubble, newBookEntries } from '../src/hud/hudModel'

describe('HUD layout model (UI rework Phase 3)', () => {
  it('counts found species over every species in the catalog', () => {
    expect(bookCount(newPlayer(0))).toEqual({ found: 2, total: LAUNCH_CATALOG.species.size })
  })
  it('counts species found since the Book was last opened (Q4)', () => {
    const s = { ...newPlayer(0), discovered: ['terra', 'flame', 'sea', 'nature'] }
    expect(newBookEntries(s, ['terra', 'flame'])).toBe(2)
    expect(newBookEntries(s, s.discovered)).toBe(0)
  })
  it('a player who never opened the Book has no badge for the starting pair', () => {
    expect(newBookEntries(newPlayer(0), null)).toBe(0)
  })
  it('Goals bubble: Claim! when claimable, Start! with no progress, nothing in between', () => {
    expect(goalsBubble(newPlayer(0))).toBe('Start!')
    const done = { ...newPlayer(0), goalStats: { ...newPlayer(0).goalStats, collects: 1 } }
    expect(goalsBubble(done)).toBe('Claim!')
    const allDone = { ...newPlayer(0), goalIndex: 9_999 }
    expect(goalsBubble(allDone)).toBeNull()
  })
})

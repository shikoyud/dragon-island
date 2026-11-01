// Task 5: the result of a Trial (§6.3), the Boss drops, and a Boss's tokens next to the clear-drop toast (R54/R55).
import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import type { ActionResponse } from '@wyrmhaven/shared'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BattleResult } from '../src/panels/BattleResult'
import { HatcheryPanel } from '../src/panels/HatcheryPanel'
import { SpeedUpsRow } from '../src/panels/SpeedUpsRow'
import { useAction } from '../src/state/actions'
import { dropMessages } from '../src/state/drops'
import { harness } from './harness'

const base = newPlayer(0)
const won = { won: true, stars: 3, gold: 3_000, food: 150, xp: 720, first: true } as const
const response = (trial: ActionResponse['trial'], winner: 'attacker' | 'defender' = 'attacker', state: PlayerState = base): ActionResponse =>
  ({ state, effects: [], battle: { winner, turns: 5 } as never, trial })

describe('BattleResult', () => {
  it('a win lists stars, Gold, Food and XP, and no drops that were not paid', () => {
    render(<BattleResult result={response(won)} />)
    const box = screen.getByRole('status', { name: 'Battle result' })
    expect(box).toHaveTextContent('Victory')
    expect(screen.getByLabelText('3 stars')).toHaveTextContent('★★★')
    expect(box).toHaveTextContent('3,000 gold · 150 food · 720 XP')
    for (const text of [/speed-up/, /egg/, /joined you/, /Chest pull/]) expect(screen.queryByText(text)).toBeNull()
  })

  it('a replay pays no XP and says nothing about it: no 0 XP', () => {
    render(<BattleResult result={response({ won: true, stars: 2, gold: 1_500, food: 75, xp: 0, first: false })} />)
    const box = screen.getByRole('status', { name: 'Battle result' })
    expect(box).toHaveTextContent('1,500 gold · 75 food')
    expect(box).not.toHaveTextContent(/XP/)
  })

  it('names tokens, an egg by rarity and element only, the Champion and a saved pull', () => {
    const trial = { ...won, tokens: { token: '1h', count: 4 }, egg: { rarity: 'uncommon', element: 'electric' }, champion: true, chestPull: true } as const
    render(<BattleResult result={response(trial)} />)
    expect(screen.getByText('4 × 1 h speed-up')).toBeInTheDocument()
    expect(screen.getByText('Uncommon Electric egg')).toBeInTheDocument()
    expect(screen.getByText('Trial Champion joined you')).toBeInTheDocument()
    expect(screen.getByText('Dragon Chest pull saved')).toBeInTheDocument()
  })

  it('a defeat reads Defeat and the team rests, with no stray separators', () => {
    render(<BattleResult result={response({ won: false, stars: 0, gold: 0, food: 0, xp: 0, first: false }, 'defender')} />)
    const box = screen.getByRole('status', { name: 'Battle result' })
    expect(box).toHaveTextContent('Defeat')
    expect(box).toHaveTextContent('The team rests')
    expect(box.textContent).not.toMatch(/·/)
  })

  it('a forfeit (no battle report) is a Defeat too', () => {
    render(<BattleResult result={{ state: base, effects: [], trial: { won: false, stars: 0, gold: 0, food: 0, xp: 0, first: false } }} />)
    expect(screen.getByRole('status', { name: 'Battle result' })).toHaveTextContent('Defeat')
  })

  it('a PvP battle shows its trophies', () => {
    render(<BattleResult result={response(undefined, 'attacker', { ...base, trophies: 42 })} />)
    expect(screen.getByRole('status', { name: 'Battle result' })).toHaveTextContent('Victory')
    expect(screen.getByRole('status', { name: 'Battle result' })).toHaveTextContent('Trophies 42')
  })
})

describe('SpeedUpsRow chest pulls', () => {
  it('shows the saved pulls above 0, and nothing about them at 0', () => {
    const saved = harness({ ...base, pve: { ...base.pve, chestPulls: 3 } }).wrap(<SpeedUpsRow />)
    expect(screen.getByText('Dragon Chest pulls saved: 3')).toBeInTheDocument()
    saved.unmount()
    harness(base).wrap(<SpeedUpsRow />)
    expect(screen.queryByText(/Chest pulls/)).toBeNull()
  })
})

describe('HatcheryPanel above capacity', () => {
  it('shows used over slots and says new eggs wait', () => {
    const egg = { speciesId: 'terra', readyAtMs: 9_000 }
    harness({ ...base, hatchery: [egg, egg] }).wrap(<HatcheryPanel nowMs={0} />)
    expect(screen.getByText('Hatchery · 2/1')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('New eggs wait until 2 more slots free up.')
  })
})

describe('a Boss\'s tokens are no clear drop', () => {
  const clear = { kind: 'clear' as const, obstacleId: 'o1', readyAtMs: 9_000_000 }
  const tokens = { ...base.speedUps, '1h': 4 }

  it('dropMessages stays empty when finishTrial adds tokens while a clear is still running', () => {
    const before: PlayerState = { ...base, constructions: [clear] }
    expect(dropMessages(before, { ...before, speedUps: tokens, gold: before.gold + 3_000, food: before.food + 150 })).toEqual([])
  })

  it('useAction raises no "Found" toast for a finishTrial that pays tokens', async () => {
    const before: PlayerState = { ...base, constructions: [clear] }
    const h = harness(before)
    h.action.mockImplementation(async () => response({ ...won, tokens: { token: '1h', count: 4 } }, 'attacker', { ...before, speedUps: tokens, gold: before.gold + 3_000 }) as never)
    function Go() {
      const { run } = useAction()
      return <button type="button" onClick={() => void run({ type: 'finishTrial', moves: [] })}>go</button>
    }
    h.wrap(<Go />)
    await userEvent.click(screen.getByRole('button', { name: 'go' }))
    await waitFor(() => expect(h.action).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText(/Found/)).toBeNull()
  })
})

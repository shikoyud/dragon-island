import { DEFAULT_PRESET, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { goalRows, recommendedRows } from '../src/panels/goalsModel'
import { QuestsPanel } from '../src/panels/QuestsPanel'
import { harness } from './harness'

const base = newPlayer(0)
const at = (n: number, patch: Partial<PlayerState> = {}): PlayerState => ({ ...base, goalIndex: n, ...patch })

describe('goalRows (design Phase 5: task)', () => {
  it('lists every Goal in order: done before the current one, Claim or Go on it, locked after', () => {
    const rows = goalRows(at(2), DEFAULT_PRESET)
    expect(rows).toHaveLength(14)
    expect(rows.slice(0, 4).map(r => r.state)).toEqual(['done', 'done', 'go', 'later'])
    expect(rows[2]).toMatchObject({ title: 'Feed a dragon', have: 0, need: 1, gold: 100 })
    expect(rows[2]!.hint.length).toBeGreaterThan(0)
    expect(goalRows(at(0, { goalStats: { ...base.goalStats, collects: 1 } }), DEFAULT_PRESET)[0]!.state).toBe('claim')
  })

  it('XP is after the preset multiplier', () => {
    expect(goalRows(base, DEFAULT_PRESET)[0]!.xp).toBe(25 * DEFAULT_PRESET.xpMult)
  })

  it('Recommended is the current Goal and the next two; none once all are done', () => {
    expect(recommendedRows(goalRows(at(3), DEFAULT_PRESET)).map(r => r.index)).toEqual([3, 4, 5])
    expect(recommendedRows(goalRows(at(13), DEFAULT_PRESET)).map(r => r.index)).toEqual([13])
    expect(recommendedRows(goalRows(at(14), DEFAULT_PRESET))).toEqual([])
  })

  it('Go opens a habitat for Collect and a dragon for Feed and the level Goals', () => {
    expect(goalRows(base, DEFAULT_PRESET)[0]!.route).toEqual({ label: 'Habitat', to: { kind: 'info', target: { type: 'habitat', id: 'h1' } } })
    expect(goalRows(at(2), DEFAULT_PRESET)[2]!.route).toEqual({ label: 'Dragon', to: { kind: 'target', target: { kind: 'dragon', id: 'd1' } } })
    expect(goalRows(at(3), DEFAULT_PRESET)[3]!.route?.label).toBe('Dragon')
  })

  it('Go routes shop goals to their Shop category', () => {
    expect(goalRows(at(6), DEFAULT_PRESET)[6]!.route).toEqual({ label: 'Shop', to: { kind: 'panel', id: 'shop', category: 'habitats' } })
    expect(goalRows(at(7), DEFAULT_PRESET)[7]!.route).toEqual({ label: 'Shop', to: { kind: 'panel', id: 'shop', category: 'dragons' } })
    expect(goalRows(at(8), DEFAULT_PRESET)[8]!.route).toEqual({ label: 'Shop', to: { kind: 'panel', id: 'shop', category: 'farms' } })
  })
})

describe('Goals dialog (design Phase 5: task)', () => {
  it('has Recommended and All tabs; All shows every Goal with done marks and locks', async () => {
    harness(at(1)).wrap(<QuestsPanel />)
    expect(screen.getByRole('tab', { name: 'Recommended' })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('list', { name: 'Goals' })).getAllByRole('listitem')).toHaveLength(3)
    await userEvent.click(screen.getByRole('tab', { name: 'All' }))
    const rows = within(screen.getByRole('list', { name: 'Goals' })).getAllByRole('listitem')
    expect(rows).toHaveLength(14)
    expect(within(rows[0]!).getByText('Done')).toBeInTheDocument()
    expect(within(rows[5]!).getByText('Later')).toBeInTheDocument()
  })

  it('a row has its reward pills, and Go opens the place', async () => {
    const onOpen = vi.fn()
    harness(at(1)).wrap(<QuestsPanel onOpen={onOpen} />)
    const row = screen.getByRole('listitem', { name: 'Plant and harvest a Dragon Bush' })
    expect(within(row).getByLabelText(/^\+\d+ XP$/)).toBeInTheDocument()
    expect(within(row).getByLabelText('+100 gold')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Go to Farm' }))
    expect(onOpen).toHaveBeenCalledWith({ kind: 'target', target: { kind: 'farm', plot: 0 } })
  })
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionBar } from '../src/hud/ActionBar'
import type { ActionRow } from '../src/hud/actionRow'

afterEach(cleanup)

const row: ActionRow = {
  name: 'Farm',
  buttons: [
    { icon: 'speedUp', label: 'Speed Up', above: '30s', intent: { kind: 'open', dialog: { kind: 'target', target: { kind: 'farm', plot: 0 } } } },
    { icon: 'upgrade', label: 'Upgrade', locked: 'Level 5', intent: { kind: 'open', dialog: { kind: 'target', target: { kind: 'farm', plot: 0 } } } },
    { icon: 'collect', label: 'Collect', disabled: 'Nothing to collect yet', intent: { kind: 'run', action: { type: 'harvest', plot: 0 } } },
    { icon: 'move', label: 'Move', intent: { kind: 'move', target: { type: 'farm', index: 0 }, size: 3 as never } },
  ],
}

describe('ActionBar', () => {
  it('names the row and its buttons, with the timer and reasons as descriptions', () => {
    render(<ActionBar row={row} onIntent={() => {}} />)
    expect(screen.getByRole('region', { name: 'Farm actions' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Speed Up' }).getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Speed Up' })).toHaveProperty('textContent', expect.stringContaining('30s'))
    expect(screen.getByRole('button', { name: 'Upgrade' }).textContent).toContain('Level 5')
    expect(screen.getByRole('button', { name: 'Collect' })).toHaveProperty('disabled', true)
  })

  it('puts the name over the last button only', () => {
    const { container } = render(<ActionBar row={row} onIntent={() => {}} />)
    const items = container.querySelectorAll('.action-bar__item')
    expect(items[items.length - 1]!.querySelector('.action-bar__name')?.textContent).toBe('Farm')
    expect(container.querySelectorAll('.action-bar__name')).toHaveLength(1)
  })

  it('a click hands the button\'s intent up; a locked Upgrade still works (it opens Info)', () => {
    const onIntent = vi.fn()
    render(<ActionBar row={row} onIntent={onIntent} />)
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move' }))
    expect(onIntent.mock.calls.map(c => c[0].kind)).toEqual(['open', 'move'])
  })
})

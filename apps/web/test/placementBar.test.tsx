import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlacementBar } from '../src/panels/PlacementBar'

describe('PlacementBar', () => {
  it('disables Confirm on an illegal ghost and wires the buttons', () => {
    const f = { onTurn: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn() }
    const { rerender } = render(<PlacementBar legal={false} {...f} />)
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Turn' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    rerender(<PlacementBar legal {...f} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(f.onTurn).toHaveBeenCalledOnce()
    expect(f.onCancel).toHaveBeenCalledOnce()
    expect(f.onConfirm).toHaveBeenCalledOnce()
  })

  it('shows an Island button per choice, marks the viewed one, and disables one with no room', () => {
    const f = { onTurn: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn(), onIsland: vi.fn() }
    const islands = [
      { island: 'home', name: 'Home Isle', current: true, room: true },
      { island: 'isle2', name: 'Ember Reach', current: false, room: true },
      { island: 'isle3', name: 'Frostspire', current: false, room: false },
    ] as const
    render(<PlacementBar legal {...f} islands={islands} />)
    expect(screen.getByRole('button', { name: 'Move to Home Isle' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Move to Ember Reach' }))
    expect(f.onIsland).toHaveBeenCalledWith('isle2')
    const full = screen.getByRole('button', { name: 'Move to Frostspire' }) as HTMLButtonElement
    expect(full.disabled).toBe(true)
    expect(full.title).toBe('No room on Frostspire')
  })

  it('has no Island buttons without choices', () => {
    render(<PlacementBar legal onTurn={vi.fn()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^Move to/ })).toBeNull()
  })
})

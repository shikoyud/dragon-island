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
})

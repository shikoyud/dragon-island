import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlacementBar } from '../src/panels/PlacementBar'

describe('PlacementBar', () => {
  it('disables OK on an illegal ghost and wires the buttons', () => {
    const f = { onTurn: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn() }
    const { rerender } = render(<PlacementBar legal={false} {...f} />)
    expect((screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Turn' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    rerender(<PlacementBar legal {...f} />)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
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

  it('locks the Island buttons and Cancel while a request is pending', () => {
    const islands = [
      { island: 'home', name: 'Home Isle', current: true, room: true },
      { island: 'isle2', name: 'Ember Reach', current: false, room: true },
    ] as const
    render(<PlacementBar legal pending islands={islands} onTurn={vi.fn()} onConfirm={vi.fn()} onCancel={vi.fn()} onIsland={vi.fn()} />)
    for (const name of ['Move to Home Isle', 'Move to Ember Reach', 'Cancel', 'OK']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('styles the pressed Island button so the current island shows', () => {
    const css = readFileSync(resolve(__dirname, '../src/styles/hud.css'), 'utf8')
    expect(css).toMatch(/\.placement-bar \.btn\[aria-pressed="true"\]\s*\{[^}]*(background|border|outline|box-shadow)/)
  })

  it('names its round buttons Cancel and OK, shows the labels beneath, and says why OK is shut', () => {
    const { rerender } = render(<PlacementBar legal={false} onTurn={vi.fn()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Cancel' }).textContent).toBe('CANCEL')
    expect(screen.getByRole('button', { name: 'OK' }).textContent).toBe('OK')
    expect(screen.getByText("Can't build here")).toBeTruthy()
    rerender(<PlacementBar legal onTurn={vi.fn()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText("Can't build here")).toBeNull()
  })

  it('puts Turn and the Island buttons in a row above Cancel and OK', () => {
    const islands = [{ island: 'home', name: 'Home Isle', current: true, room: true }] as const
    const { container } = render(<PlacementBar legal islands={islands} onTurn={vi.fn()} onConfirm={vi.fn()} onCancel={vi.fn()} onIsland={vi.fn()} />)
    const rows = [...container.querySelectorAll('.placement-bar > div')].map(r => [...r.querySelectorAll('button')].map(b => b.getAttribute('aria-label') ?? b.textContent))
    expect(rows).toEqual([['Move to Home Isle', 'Turn'], ['Cancel', 'OK']])
  })

  it('takes pointer events on its buttons only, and the message takes no room, so the view does not shift when it shows', () => {
    const css = readFileSync(resolve(__dirname, '../src/styles/hud.css'), 'utf8')
    const auto = css.match(/\.hud button[^{]*\{\s*pointer-events: auto;/)![0]
    expect(auto).not.toContain('.placement-bar')
    expect(css).toMatch(/\.placement-bar__why\s*\{[^}]*position: absolute/)
  })

  it('has no Island buttons without choices', () => {
    render(<PlacementBar legal onTurn={vi.fn()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^Move to/ })).toBeNull()
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Panel } from '../src/ui/Panel'
import { DialogFrame, FullScreenFrame } from '../src/ui/kit/frames'

const kitCss = readFileSync(resolve(__dirname, '../src/styles/kit.css'), 'utf8')
afterEach(cleanup)

describe('DialogFrame', () => {
  it('puts the title on the plank with an optional count badge', () => {
    render(<DialogFrame title="Hatchery" badge="2/4"><p>eggs</p></DialogFrame>)
    const frame = screen.getByRole('region', { name: 'Hatchery · 2/4' })
    expect(frame.querySelector('.kit-plank')).toHaveTextContent(/^Hatchery$/)
    expect(frame.querySelector('.kit-badge')).toHaveTextContent('2/4')
  })
  it('has a close button only with onClose, and it calls back', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<DialogFrame title="Shop">x</DialogFrame>)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    rerender(<DialogFrame title="Shop" onClose={onClose}>x</DialogFrame>)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('scrolls only its body, with the pixel scrollbar', () => {
    render(<DialogFrame title="Shop"><p>rows</p></DialogFrame>)
    expect(screen.getByText('rows').parentElement).toHaveClass('kit-frame__body', 'kit-scroll')
  })
  it('a long title truncates on one line instead of wrapping (review focus 1)', () => {
    expect(kitCss).toMatch(/\.kit-plank\s*\{[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*ellipsis/)
  })
  it('the pixel scrollbar is styled for both engines (review image-7)', () => {
    expect(kitCss).toMatch(/\.kit-scroll\s*\{[^}]*scrollbar-color/)
    expect(kitCss).toMatch(/\.kit-scroll::-webkit-scrollbar-thumb/)
  })
})

describe('Panel', () => {
  it('renders the kit frame and passes the badge through', () => {
    render(<Panel title="Hatchery" badge="1/2" onClose={() => {}}>x</Panel>)
    const frame = screen.getByRole('region', { name: 'Hatchery · 1/2' })
    expect(frame).toHaveClass('kit-frame', 'panel')
    expect(frame.querySelector('.kit-badge')).toHaveTextContent('1/2')
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('kit-square--close')
  })
})

describe('FullScreenFrame', () => {
  it('shows back and help only when given handlers', async () => {
    const back = vi.fn(), help = vi.fn(), close = vi.fn()
    const { rerender } = render(<FullScreenFrame title="Storage" badge="12" onClose={close}>items</FullScreenFrame>)
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull()
    rerender(<FullScreenFrame title="Storage" onClose={close} onBack={back} onHelp={help} backdrop="wood">items</FullScreenFrame>)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Help' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect([back, help, close].map(f => f.mock.calls.length)).toEqual([1, 1, 1])
    expect(screen.getByRole('region', { name: 'Storage' })).toHaveClass('kit-full', 'kit-full--wood')
  })
})

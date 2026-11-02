import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionButton } from '../src/ui/Panel'
import { BackButton, CloseButton, HelpButton, PillButton, PriceTag, type PillColor } from '../src/ui/kit/buttons'

const css = (p: string) => readFileSync(resolve(__dirname, '../src/styles', p), 'utf8')
afterEach(cleanup)

describe('kit pills', () => {
  it.each<PillColor>(['blue', 'yellow', 'green', 'purple', 'grey', 'red'])('%s pill has its colour class', color => {
    render(<PillButton color={color}>Go</PillButton>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('kit-pill', `kit-pill--${color}`)
  })
  it('defaults to blue', () => {
    render(<PillButton>Buy</PillButton>)
    expect(screen.getByRole('button', { name: 'Buy' })).toHaveClass('kit-pill--blue')
  })
  it('a disabled pill turns grey and is described by its reason', async () => {
    const onClick = vi.fn()
    render(<PillButton id="up" color="yellow" disabled reason="Requires level 4" onClick={onClick}>Upgrade</PillButton>)
    const b = screen.getByRole('button', { name: 'Upgrade' })
    expect(b).toHaveClass('kit-pill--grey')
    expect(b).toBeDisabled()
    expect(b).toHaveAccessibleDescription('Requires level 4')
    expect(screen.getByText('Requires level 4')).toBeVisible()
    await userEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })
  it('ActionButton keeps its API and draws a kit pill', () => {
    render(<ActionButton id="a" primary>Place</ActionButton>)
    expect(screen.getByRole('button', { name: 'Place' })).toHaveClass('kit-pill', 'kit-pill--yellow')
  })
  it('old .btn call sites keep working', () => {
    expect(css('tokens.css')).toMatch(/\.btn--primary\s*\{/)
  })
})

describe('kit price tag', () => {
  it('formats the amount with its currency icon', () => {
    const { container } = render(<PriceTag amount={12_500} currency="gold" />)
    expect(container).toHaveTextContent('12,500')
    expect(container.querySelector('[data-icon="gold"], img')).not.toBeNull()
    expect(container.firstChild).not.toHaveClass('kit-price--short')
  })
  it('shows a red number when unaffordable', () => {
    const { container } = render(<PriceTag amount={12_500} currency="gold" affordable={false} />)
    expect(container.firstChild).toHaveClass('kit-price--short')
  })
  it('formats micro-dollars', () => {
    const { container } = render(<PriceTag amount={2_000_000} currency="usd" />)
    expect(container).toHaveTextContent('$2.00')
  })
})

describe('kit square buttons', () => {
  it('close, back and help have their names and call back', async () => {
    const close = vi.fn(), back = vi.fn(), help = vi.fn()
    render(<><CloseButton onClick={close} /><BackButton onClick={back} /><HelpButton onClick={help} /></>)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect([close, back, help].map(f => f.mock.calls.length)).toEqual([1, 1, 1])
  })
  it('the close button is square: one size for width and height (review image-6)', () => {
    const k = css('kit.css')
    expect(k).toMatch(/\.kit-square\s*\{[^}]*width:\s*var\(--kit-square\)[^}]*height:\s*var\(--kit-square\)/)
  })
  it('kit buttons show a focus ring that reads on the light frame', () => {
    expect(css('kit.css')).toMatch(/:focus-visible[^{]*\{[^}]*outline:\s*3px solid var\(--kit-focus\)/)
  })
})

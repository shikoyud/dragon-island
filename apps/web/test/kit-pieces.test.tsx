import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToasts } from '../src/ui/Toast'
import { Bubble, ElementRibbon, KitCard, ProgressBar, RarityShield, ResourcePill, RoundAction, Tooltip } from '../src/ui/kit/pieces'

afterEach(cleanup)

describe('RoundAction', () => {
  it('is a button named by its label, with timer, badge and lock', async () => {
    const onClick = vi.fn()
    render(<RoundAction icon={<i />} label="Hatch" timer="20s" badge="New" locked onClick={onClick} />)
    const b = screen.getByRole('button', { name: 'Hatch' })
    expect(b).toHaveClass('kit-round', 'kit-round--locked')
    expect(b.querySelector('.kit-round__timer')).toHaveTextContent('20s')
    expect(b.querySelector('.kit-round__badge')).toHaveTextContent('New')
    expect(b.querySelector('.kit-round__lock')).not.toBeNull()
    await userEvent.click(b)
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('KitCard', () => {
  it('shows title, ribbons, shield, art and footer', () => {
    render(<KitCard title="Terra Basic" elements={['terra', 'flame']} rarity="epic" art={<i data-testid="art" />} footer={<button>Buy</button>} />)
    const card = screen.getByRole('article', { name: 'Terra Basic' })
    expect(card.querySelectorAll('.kit-ribbon')).toHaveLength(2)
    expect(card.querySelector('.kit-shield')).toHaveTextContent('E')
    expect(screen.getByTestId('art')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buy' })).toBeInTheDocument()
  })
  it('locked: grey, lock, Required level N, no footer', () => {
    render(<KitCard title="Sea Basic" lockedLevel={12} footer={<button>Buy</button>} />)
    const card = screen.getByRole('article', { name: 'Sea Basic' })
    expect(card).toHaveClass('kit-card--locked')
    expect(card).toHaveTextContent('Required level 12')
    expect(screen.queryByRole('button', { name: 'Buy' })).toBeNull()
  })
})

describe('ResourcePill', () => {
  it('shows the value and a plus that calls back', async () => {
    const onPlus = vi.fn()
    render(<ResourcePill icon={<i />} value="1,800" onPlus={onPlus} plusLabel="Buy gold" />)
    expect(screen.getByText('1,800')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Buy gold' }))
    expect(onPlus).toHaveBeenCalledOnce()
  })
})

describe('ProgressBar', () => {
  it('reports its value and clamps it', () => {
    const { rerender } = render(<ProgressBar value={30} max={60} label="30s" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '30')
    expect(bar).toHaveAttribute('aria-valuemax', '60')
    expect(bar).toHaveTextContent('30s')
    rerender(<ProgressBar value={90} max={60} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
    rerender(<ProgressBar value={-5} max={60} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('Bubble, ribbon, shield, tooltip', () => {
  it('bubble is a button named by its label when tappable', async () => {
    const onClick = vi.fn()
    render(<Bubble icon={<i />} label="Collect gold" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Collect gold' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('ribbon names its element; shield letters C U R E L', () => {
    render(<><ElementRibbon element="sea" />{(['common', 'uncommon', 'rare', 'epic', 'legendary'] as const).map(r => <RarityShield key={r} rarity={r} />)}</>)
    expect(screen.getByRole('img', { name: 'Sea' })).toHaveClass('kit-ribbon--sea')
    expect(screen.getAllByRole('img', { name: /common|uncommon|rare|epic|legendary/i }).map(e => e.textContent)).toEqual(['C', 'U', 'R', 'E', 'L'])
  })
  it('tooltip describes its child', () => {
    render(<Tooltip text="Gold from habitats"><button>Gold</button></Tooltip>)
    expect(screen.getByRole('button', { name: 'Gold' })).toHaveAccessibleDescription('Gold from habitats')
  })
})

describe('toasts', () => {
  it('render as kit toasts', async () => {
    function Push() { const t = useToasts(); return <button onClick={() => t.info('Saved')}>go</button> }
    render(<ToastProvider><Push /></ToastProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'go' }))
    expect(screen.getByRole('status')).toHaveClass('kit-toast')
  })
})

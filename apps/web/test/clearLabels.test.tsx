import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { attentionItems } from '../src/hud/hudModel'
import { ShopPanel } from '../src/panels/ShopPanel'
import { harness } from './harness'

const base = newPlayer(0)
const obstacles = [
  { id: 'a', kind: 'ancientTree' as const, island: 'home' as const, col: 8, row: 8 },
  { id: 'b', kind: 'bush' as const, island: 'home' as const, col: 12, row: 12 },
]
const two: PlayerState = {
  ...base, islands: { ...base.islands, obstacles },
  constructions: [{ kind: 'clear', obstacleId: 'a', readyAtMs: 3_600_000 }, { kind: 'clear', obstacleId: 'b', readyAtMs: 1_800_000 }],
}

describe('a clear is named by what is cleared', () => {
  it('two clears show two distinct Store rows, never "Upgrade"', () => {
    harness(two).wrap(<ShopPanel tab="store" onPlace={vi.fn()} view="home" nowMs={0} />)
    const rows = screen.getAllByRole('button', { name: /^Skip / })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Skip Clearing Ancient Tree')
    expect(rows[1]).toHaveTextContent('Skip Clearing Bush')
    expect(screen.queryByText(/Upgrade/)).toBeNull()
  })

  it('the HUD shortcuts name them too', () => {
    const labels = attentionItems(two, 0).map(i => i.label)
    expect(labels).toContain('Clearing Ancient Tree')
    expect(labels).toContain('Clearing Bush')
  })
})

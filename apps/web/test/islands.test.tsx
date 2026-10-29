import { homeStripObstacles, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { IslandMapPanel } from '../src/panels/IslandMapPanel'
import { ObstaclePanel } from '../src/panels/ObstaclePanel'
import { ExpandSignPanel } from '../src/panels/ExpandSignPanel'
import { PanelHost } from '../src/panels/PanelHost'
import { harness } from './harness'

const base = newPlayer(0)
const withRock = (over: Partial<PlayerState> = {}): PlayerState => ({
  ...base, gold: 1_000, islands: { homeStep: 1, unlocked: ['home'], obstacles: homeStripObstacles(1) }, ...over,
})

describe('IslandMapPanel', () => {
  it('unlocks the next island in order and switches view', async () => {
    const onView = vi.fn()
    const s = { ...base, level: 12, gold: 40_000 }
    const h = harness(s)
    h.action.mockResolvedValueOnce({ state: { ...s, gold: 0, islands: { ...s.islands, unlocked: ['home', 'isle2'] } }, effects: [] })
    h.wrap(<IslandMapPanel view="home" onView={onView} />)
    await userEvent.click(screen.getByRole('button', { name: /Unlock · 40,000 gold/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'unlockIsland' }, expect.any(String))
    expect(await screen.findByText(/Locked · level 30/)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: /^Go/ })[1]!)
    expect(onView).toHaveBeenCalledWith('isle2')
  })

  it('shows Locked · level N for later islands and the reasons for the next one', () => {
    const { wrap } = harness({ ...base, level: 3, gold: 10 })
    wrap(<IslandMapPanel view="home" onView={vi.fn()} />)
    expect(screen.getByText(/Locked · level 20/)).toBeInTheDocument()
    expect(screen.getByText(/Locked · level 45/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unlock · 40,000 gold/ })).toBeDisabled()
    expect(screen.getByText('Needs player level 12')).toBeInTheDocument()
  })

  it('says Not enough gold once the level is met', () => {
    const { wrap } = harness({ ...base, level: 12, gold: 10 })
    wrap(<IslandMapPanel view="home" onView={vi.fn()} />)
    expect(screen.getByText('Not enough gold')).toBeInTheDocument()
  })

  it('asks for a legendary dragon first at Dawnspire', () => {
    const { wrap } = harness({ ...base, level: 50, gold: 9_000_000, islands: { homeStep: 0, unlocked: ['home', 'isle2', 'isle3', 'isle4', 'isle5'], obstacles: [] } })
    wrap(<IslandMapPanel view="home" onView={vi.fn()} />)
    expect(screen.getByText('Own a legendary dragon first')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unlock · 3,000,000 gold/ })).toBeDisabled()
  })
})

describe('ObstaclePanel', () => {
  it('clears for gold and shows rewards', async () => {
    const h = harness(withRock())
    h.wrap(<ObstaclePanel obstacleId="home-s1-rock" nowMs={0} />)
    expect(screen.getByText(/\+40 XP/)).toBeInTheDocument()
    expect(screen.getByText(/\+0 food/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Clear · 250 gold · 5m/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'clearObstacle', obstacleId: 'home-s1-rock' }, expect.any(String))
  })

  it('disables Clear without gold and explains', () => {
    const { wrap } = harness(withRock({ gold: 10 }))
    wrap(<ObstaclePanel obstacleId="home-s1-rock" nowMs={0} />)
    expect(screen.getByRole('button', { name: /Clear · 250 gold/ })).toBeDisabled()
    expect(screen.getByText('Not enough gold')).toBeInTheDocument()
  })

  it('shows timer and Skip while clearing and auto-finishes when ready', async () => {
    const s = withRock({ constructions: [{ kind: 'clear', obstacleId: 'home-s1-rock', readyAtMs: 300_000 }] })
    const h = harness(s)
    const { rerender } = h.wrap(<ObstaclePanel obstacleId="home-s1-rock" nowMs={0} />)
    expect(screen.getByText('5m')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Skip/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, expect.any(String))
    rerender(<ObstaclePanel obstacleId="home-s1-rock" nowMs={300_000} />)
    await waitFor(() => expect(h.action).toHaveBeenCalledWith({ type: 'finishConstruction', index: 0 }, expect.any(String)))
  })
})

describe('ExpandSignPanel', () => {
  it('shows size, cost and sends expandIsland', async () => {
    const h = harness({ ...base, level: 2, gold: 5_000 })
    h.wrap(<ExpandSignPanel />)
    await userEvent.click(screen.getByRole('button', { name: /Expand to 14x12 · 1,000 gold/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'expandIsland' }, expect.any(String))
  })

  it('explains the level reason', () => {
    const { wrap } = harness({ ...base, level: 1, gold: 5_000 })
    wrap(<ExpandSignPanel />)
    expect(screen.getByRole('button', { name: /Expand to 14x12/ })).toBeDisabled()
    expect(screen.getByText('Needs player level 2')).toBeInTheDocument()
  })
})

describe('PanelHost targets', () => {
  it('opens the obstacle and sign panels from the bridge', async () => {
    const bridge = createBridge()
    const { wrap } = harness(withRock({ level: 2 }))
    wrap(<PanelHost bridge={bridge} nowMs={0} named={null} onCloseNamed={() => {}} />)
    bridge.emit({ type: 'select', target: { kind: 'obstacle', id: 'home-s1-rock' } })
    expect(await screen.findByRole('button', { name: /Clear · 250 gold/ })).toBeInTheDocument()
    bridge.emit({ type: 'select', target: { kind: 'expandSign' } })
    expect(await screen.findByRole('button', { name: /Expand to 16x12|Expand to 14x14/ })).toBeInTheDocument()
  })
})

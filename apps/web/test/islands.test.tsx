import { LAUNCH_CATALOG, newPlayer, type Obstacle, type PlayerState } from '@wyrmhaven/game-core'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { createBridge } from '../src/game/bridge'
import { MapIslandPanel } from '../src/panels/MapIslandPanel'
import { ObstaclePanel } from '../src/panels/ObstaclePanel'
import { harness, TestHost } from './harness'

const base = newPlayer(0)
const rock: Obstacle = { id: 'home-s1-rock', kind: 'rock', island: 'home', col: 20, row: 12 }
const withRock = (over: Partial<PlayerState> = {}): PlayerState => ({
  ...base, gold: 1_000, islands: { ...base.islands, obstacles: [rock] }, ...over,
})

describe('MapIslandPanel art', () => {
  it('lays the island list over the sea-chart backdrop when the art has one', () => {
    const art = artSetFromManifest('v1', { assets: { 'map.backdrop': { file: 'map-backdrop.png', w: 320, h: 180, frames: 1, fps: 0 } } }, LAUNCH_CATALOG)
    harness(base).wrap(<MapIslandPanel view="home" onView={() => {}} art={art} />)
    expect(screen.getByTestId('map-chart')).toHaveStyle({ backgroundImage: 'url("/art/v1/map-backdrop.png")' })
  })

  it('shows each island map icon when the art set has one', () => {
    const art = artSetFromManifest('v1', { assets: { 'map.home': { file: 'map-home.png', w: 32, h: 32, frames: 1, fps: 0 } } }, LAUNCH_CATALOG)
    const { wrap } = harness({ ...base, level: 3, gold: 10 })
    const { container } = wrap(<MapIslandPanel view="home" onView={vi.fn()} art={art} />)
    const imgs = [...container.querySelectorAll('img')]
    expect(imgs.map(i => i.getAttribute('src'))).toEqual(['/art/v1/map-home.png'])
    expect(imgs[0]).toHaveAttribute('width', '32')
  })
})

describe('ObstaclePanel', () => {
  it('clears for gold and shows rewards', async () => {
    const h = harness(withRock())
    h.wrap(<ObstaclePanel obstacleId="home-s1-rock" nowMs={0} />)
    expect(screen.getByText(/\+480 XP/)).toBeInTheDocument() // 40 classic XP x the Flash-14 multiplier
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

  it('shows timer and Skip while clearing and a manual Finish when ready', async () => {
    const s = withRock({ constructions: [{ kind: 'clear', obstacleId: 'home-s1-rock', readyAtMs: 300_000 }] })
    const h = harness(s)
    const { rerender } = h.wrap(<ObstaclePanel obstacleId="home-s1-rock" nowMs={0} />)
    expect(screen.getByText('5m')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Skip/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, expect.any(String))
    rerender(<ObstaclePanel obstacleId="home-s1-rock" nowMs={300_000} />)
    expect(h.action).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(h.action).toHaveBeenLastCalledWith({ type: 'finishConstruction', index: 0 }, expect.any(String))
  })
})

describe('PanelHost targets', () => {
  it('opens the obstacle panel from the bridge', async () => {
    const bridge = createBridge()
    const { wrap } = harness(withRock({ level: 2 }))
    wrap(<TestHost bridge={bridge} />)
    bridge.emit({ type: 'select', target: { kind: 'obstacle', id: 'home-s1-rock' } })
    expect(await screen.findByRole('button', { name: /Clear · 250 gold/ })).toBeInTheDocument()
  })
})

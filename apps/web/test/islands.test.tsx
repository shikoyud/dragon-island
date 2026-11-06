import { LAUNCH_CATALOG, newPlayer, type Obstacle, type PlayerState } from '@wyrmhaven/game-core'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { createBridge } from '../src/game/bridge'
import { MapIslandPanel } from '../src/panels/MapIslandPanel'
import { ObstaclePanel } from '../src/panels/ObstaclePanel'
import { upgradeBlockReason } from '../src/panels/UpgradeSection'
import { harness, TestHost } from './harness'

const base = newPlayer(0)
const rock: Obstacle = { id: 'home-start-rock', kind: 'smallRock', island: 'home', col: 20, row: 12 }
const withRock = (over: Partial<PlayerState> = {}): PlayerState => ({
  ...base, gold: 1_000, islands: { ...base.islands, obstacles: [rock] }, ...over,
})

describe('MapIslandPanel art', () => {
  it('lays the island over the sea-chart backdrop when the art has one', () => {
    const art = artSetFromManifest('v1', { assets: { 'map.backdrop': { file: 'map-backdrop.png', w: 320, h: 180, frames: 1, fps: 0 } } }, LAUNCH_CATALOG)
    harness(base).wrap(<MapIslandPanel island="home" view="home" onView={() => {}} art={art} />)
    expect(screen.getByTestId('map-chart')).toHaveStyle({ backgroundImage: 'url("/art/v1/map-backdrop.png")' })
  })

  it('shows the island map icon when the art set has one', () => {
    const art = artSetFromManifest('v1', { assets: { 'map.home': { file: 'map-home.png', w: 32, h: 32, frames: 1, fps: 0 } } }, LAUNCH_CATALOG)
    const { wrap } = harness({ ...base, level: 3, gold: 10 })
    const { container } = wrap(<MapIslandPanel island="home" view="home" onView={vi.fn()} art={art} />)
    const imgs = [...container.querySelectorAll('img')]
    expect(imgs.map(i => i.getAttribute('src'))).toEqual(['/art/v1/map-home.png'])
    expect(imgs[0]).toHaveAttribute('width', '32')
  })
})

describe('ObstaclePanel', () => {
  it('clears for gold and shows rewards', async () => {
    const h = harness(withRock())
    h.wrap(<ObstaclePanel obstacleId="home-start-rock" nowMs={0} />)
    expect(screen.getByText(/\+300 XP/)).toBeInTheDocument() // 25 classic XP x the Flash-14 multiplier
    expect(screen.getByText('10 % chance: 100–300 gold')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Clear · 500 gold · 50s/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'clearObstacle', obstacleId: 'home-start-rock' }, expect.any(String))
  })

  it('shows an Ancient Tree\'s cost, timer, XP and drop (§5.6)', () => {
    const tree: Obstacle = { id: 'big', kind: 'ancientTree', island: 'home', col: 20, row: 20 }
    harness({ ...base, gold: 100_000, islands: { ...base.islands, obstacles: [tree] } }).wrap(<ObstaclePanel obstacleId="big" nowMs={0} />)
    expect(screen.getByRole('button', { name: 'Clear · 25,000 gold · 40m' })).toBeEnabled()
    expect(screen.getByText('Reward: +15,000 XP')).toBeInTheDocument()
    expect(screen.getByText('10 % chance: 3 h speed-up')).toBeInTheDocument()
  })

  it('says two clears are running, and builds say nothing of clears', () => {
    const second: Obstacle = { ...rock, id: 'second', col: 22 }
    const third: Obstacle = { ...rock, id: 'third', col: 12 }
    const running = [{ kind: 'clear' as const, obstacleId: 'home-start-rock', readyAtMs: 9 }, { kind: 'clear' as const, obstacleId: 'second', readyAtMs: 9 }]
    const s = withRock({ islands: { ...base.islands, obstacles: [rock, second, third] }, constructions: running })
    harness(s).wrap(<ObstaclePanel obstacleId="third" nowMs={0} />)
    expect(screen.getByRole('button', { name: /Clear · 500 gold/ })).toBeDisabled()
    expect(screen.getByText('Two clears are running')).toBeInTheDocument()
    expect(upgradeBlockReason(s, 1, 100)).toBe('')
  })

  it('disables Clear without gold and explains', () => {
    const { wrap } = harness(withRock({ gold: 10 }))
    wrap(<ObstaclePanel obstacleId="home-start-rock" nowMs={0} />)
    expect(screen.getByRole('button', { name: /Clear · 500 gold/ })).toBeDisabled()
    expect(screen.getByText('Not enough gold')).toBeInTheDocument()
  })

  it('shows timer and Skip while clearing and a manual Finish when ready', async () => {
    const s = withRock({ constructions: [{ kind: 'clear', obstacleId: 'home-start-rock', readyAtMs: 300_000 }] })
    const h = harness(s)
    const { rerender } = h.wrap(<ObstaclePanel obstacleId="home-start-rock" nowMs={0} />)
    expect(screen.getByText('5m')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Skip/ }))
    expect(h.action).toHaveBeenCalledWith({ type: 'buy', item: { kind: 'skip', target: 'construction', index: 0 } }, expect.any(String))
    rerender(<ObstaclePanel obstacleId="home-start-rock" nowMs={300_000} />)
    expect(h.action).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(h.action).toHaveBeenLastCalledWith({ type: 'finishConstruction', index: 0 }, expect.any(String))
  })
})

describe('PanelHost targets', () => {
  it('a tap on an obstacle selects it: its row is Clear alone, its price above', async () => {
    const bridge = createBridge()
    const { wrap } = harness(withRock({ level: 2 }))
    wrap(<TestHost bridge={bridge} />)
    act(() => bridge.emit({ type: 'select', target: { kind: 'obstacle', id: 'home-start-rock' } }))
    const row = await screen.findByRole('region', { name: /actions$/ })
    expect(row.querySelectorAll('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Clear' }).textContent).toContain('500 gold')
  })
})

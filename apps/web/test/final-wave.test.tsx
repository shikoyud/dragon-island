import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { newPlayer, xpToNext, type PlayerState } from '@wyrmhaven/game-core'
import { renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { messageFor } from '../src/api/errors'
import type { Sprite } from '../src/art/types'
import { createBridge } from '../src/game/bridge'
import { Hud } from '../src/hud/Hud'
import { HudArtContext } from '../src/hud/Icon'
import { useLevelUp } from '../src/hud/LevelUp'
import { attentionItems, levelUnlockLines, MAX_ATTENTION, xpBarText, xpFraction } from '../src/hud/hudModel'
import { DragonPanel } from '../src/panels/DragonPanel'
import { goalRoute, QuestsPanel } from '../src/panels/QuestsPanel'
import { harness } from './harness'

const base = newPlayer(0)
const at = (level: number, xp = 0): PlayerState => ({ ...base, level, xp })
const claimable: PlayerState = { ...base, goalStats: { ...base.goalStats, collects: 1 } }
const mark: Sprite = { src: '/art/v1/ui-goal.png', w: 16, h: 16, frames: 1, fps: 0 }

describe('ui.goal art beside a claimable Goal (final fix 1)', () => {
  it('draws it when the manifest has it', () => {
    harness(claimable).wrap(<HudArtContext.Provider value={{ 'ui.goal': mark }}><QuestsPanel /></HudArtContext.Provider>)
    const img = document.querySelector('img[data-goal-mark]')
    expect(img).toHaveAttribute('src', '/art/v1/ui-goal.png')
    expect(screen.getByRole('button', { name: 'Claim' })).toBeInTheDocument()
  })
  it('draws nothing extra when the art is absent or has no file yet', () => {
    harness(claimable).wrap(<QuestsPanel />)
    expect(document.querySelector('img[data-goal-mark]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Claim' })).toBeInTheDocument()
  })
  it('draws nothing when the Goal is not done, even with the art', () => {
    harness(base).wrap(<HudArtContext.Provider value={{ 'ui.goal': mark }}><QuestsPanel /></HudArtContext.Provider>)
    expect(document.querySelector('img[data-goal-mark]')).toBeNull()
  })
  it('an empty src (no asset yet) draws nothing', () => {
    harness(claimable).wrap(<HudArtContext.Provider value={{ 'ui.goal': { ...mark, src: '' } }}><QuestsPanel /></HudArtContext.Provider>)
    expect(document.querySelector('img[data-goal-mark]')).toBeNull()
  })
})

describe('the Quests button and the Goal shortcut (final fix 5)', () => {
  const renderHud = (s: PlayerState) => {
    const h = harness(s)
    h.wrap(<Hud bridge={createBridge()} nowMs={10_000} open={null} onOpen={() => {}} placing={false} />)
  }
  it('keeps the name Goals while a Goal is claimable, with the state as its description and the Claim! bubble hidden from readers', () => {
    renderHud(claimable)
    const button = screen.getByRole('button', { name: 'Goals' })
    expect(button).toHaveAccessibleDescription('Goal ready')
    expect(document.querySelector('.hud-goals__bubble')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('.hud-goals__bubble')).toHaveTextContent('Claim!')
  })
  it('has no description when nothing is claimable', () => {
    renderHud(base)
    expect(screen.getByRole('button', { name: 'Goals' })).toHaveAccessibleDescription('')
    expect(document.querySelector('.hud-goals__bubble--claim')).toBeNull()
  })
  it('Goal ready is not cut by MAX_ATTENTION when other ready items already fill the list', () => {
    const ready = { kind: 'clear' as const, obstacleId: 'x', readyAtMs: 0 }
    const eggs = (n: number) => Array.from({ length: n }, () => ({ kind: 'grove' as const, level: 1, placement: { island: 'home' as const, col: 0, row: 0, facing: 0 as const }, egg: { speciesId: 'terra', readyAtMs: 0, hatchMs: 0, xpFree: false } }))
    const s: PlayerState = {
      ...claimable,
      constructions: [ready, { ...ready, obstacleId: 'y' }],
      breeders: [...base.breeders.map(b => ({ ...b, egg: { speciesId: 'terra', readyAtMs: 0, hatchMs: 0, xpFree: false } })), ...eggs(3)],
      hatchery: [{ speciesId: 'terra', readyAtMs: 0 }],
    }
    const items = attentionItems(s, 10)
    expect(items.length).toBe(MAX_ATTENTION)
    expect(items.some(i => i.id === 'goal')).toBe(true)
  })
  it('the Goal item opens Quests and carries no stand-in panel', () => {
    const goal = attentionItems(claimable, 0).find(i => i.id === 'goal')!
    expect(goal.open).toEqual({ kind: 'panel', id: 'quests' })
    expect(goal.panel).toBeUndefined()
  })
})

describe('level-up screen merges and resets (final fix 4)', () => {
  it('a held rise 5 to 6 and then to 8 is one screen from 5 to 8 once released', () => {
    const { result, rerender } = renderHook(({ level, hold }: { level: number; hold: boolean }) => useLevelUp(level, hold, 'p1'), { initialProps: { level: 5, hold: true } })
    rerender({ level: 6, hold: true })
    rerender({ level: 8, hold: true })
    expect(result.current).toBeNull()
    rerender({ level: 8, hold: false })
    expect(result.current).toMatchObject({ from: 5, to: 8 })
  })
  it('a new account that starts at PL 1 shows nothing, and its first rise counts from 1', () => {
    const { result, rerender } = renderHook(({ level, id }: { level: number; id: string }) => useLevelUp(level, false, id), { initialProps: { level: 9, id: 'p1' } })
    rerender({ level: 1, id: 'p2' })
    expect(result.current).toBeNull()
    rerender({ level: 2, id: 'p2' })
    expect(result.current).toMatchObject({ from: 1, to: 2 })
  })
  it('every PL 2 to 50 lists plain words only: no key left raw, nothing undefined', () => {
    for (let pl = 2; pl <= 50; pl++) {
      for (const line of levelUnlockLines(pl - 1, pl)) {
        expect(line, `PL ${pl}`).not.toMatch(/\w:\w|undefined/)
      }
    }
  })
  it('names the PvE gate as the Elemental Trials chapter, one line for pve and trial:1 (R71)', () => {
    const lines = levelUnlockLines(3, 4)
    expect(lines.filter(l => l.startsWith('Elemental Trials'))).toEqual(['Elemental Trials: Terra Wilds'])
    expect(lines).not.toContain('Campaign')
    expect(lines).not.toContain('PvE battles')
  })
  it('names each Trials chapter by its theme', () => {
    expect(levelUnlockLines(4, 5)).toContain('Elemental Trials: Flame Peaks')
    expect(levelUnlockLines(27, 28)).toContain('Elemental Trials: War Citadel')
  })
})

describe('the XP bar at the top level (final fix 4)', () => {
  it('xpFraction at PL 50 is full and the bar reads MAX', () => {
    expect(xpFraction(at(50, 12_345))).toBe(1)
    expect(xpBarText(at(50, 12_345), n => String(n))).toBe('MAX')
    expect(xpToNext(50)).toBe(Infinity)
  })
  it('the Hud bar shows MAX at PL 50', () => {
    harness(at(50, 99)).wrap(<Hud bridge={createBridge()} nowMs={0} open={null} onOpen={() => {}} placing={false} />)
    expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveTextContent('MAX')
  })
})

describe('the Feed button returns when the Roost tier rises (final fix 13)', () => {
  const placement = { island: 'home' as const, col: 7, row: 7, facing: 0 as const }
  const s = (tier: number): PlayerState => ({ ...base, level: 30, food: 1_000_000, roostPlacement: placement, roostTier: tier, dragons: base.dragons.map(d => d.id === 'd1' ? { ...d, level: 10 } : d) })
  it('Tier 1 caps a Lv 10 dragon (Upgrade Roost); Tier 2 lifts the cap and Feed is back', async () => {
    const h = harness(s(1))
    h.wrap(<DragonPanel dragonId="d1" onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: /upgrade roost/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^feed/i })).toBeNull()
    h.setState(s(2))
    expect(await screen.findByRole('button', { name: /^feed/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upgrade roost/i })).toBeNull()
  })
})

describe('Goals 11 and 14 have a Go to button (final fix 15)', () => {
  it('routes a Roost goal to the Roost when it is built, and to the Shop when it is not', async () => {
    const onOpen = vi.fn()
    const placement = { island: 'home' as const, col: 7, row: 7, facing: 0 as const }
    harness({ ...base, goalIndex: 10, roostPlacement: placement }).wrap(<QuestsPanel onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: 'Go to Roost' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'upgrade', target: { type: 'roost' } })
  })
  it('the Shop route when no Roost stands', async () => {
    const onOpen = vi.fn()
    harness({ ...base, goalIndex: 10 }).wrap(<QuestsPanel onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: 'Go to Shop' }))
    expect(onOpen).toHaveBeenLastCalledWith({ kind: 'panel', id: 'shop', tab: 'build' })
  })
  it('goalRoute answers for every Goal row that is not a plain counter', async () => {
    const { GOALS } = await import('@wyrmhaven/game-core')
    const roostGoals = GOALS.filter(g => g.done.kind === 'roost')
    expect(roostGoals.length).toBeGreaterThan(0)
    for (const g of roostGoals) expect(goalRoute(g, base)).not.toBeNull()
  })
})

describe('every ActionError has copy (final fix 10)', () => {
  it('walks the union in game-core and finds a sentence for each', () => {
    const src = readFileSync(join(__dirname, '..', '..', '..', 'packages', 'game-core', 'src', 'actions', 'types.ts'), 'utf8')
    const union = /export type ActionError =([^]*?)\n\n/.exec(src)![1]!
    const codes = [...union.matchAll(/'([A-Z_]+)'/g)].map(m => m[1]!)
    expect(codes).toEqual(expect.arrayContaining(['GOAL_NOT_DONE', 'NO_GOAL', 'INVALID_ACTION']))
    for (const code of codes) expect(messageFor(code), code).not.toBe(code)
  })
  it('says something about a Goal not done and no Goal left', () => {
    expect(messageFor('GOAL_NOT_DONE')).toMatch(/goal/i)
    expect(messageFor('NO_GOAL')).toMatch(/goal/i)
  })
})

describe('the page has an icon (final fix 19)', () => {
  it('index.html links an icon that exists in public/', () => {
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8')
    const href = /<link rel="icon"[^>]*href="([^"]+)"/.exec(html)?.[1]
    expect(href).toBeTruthy()
    if (!href!.startsWith('data:')) expect(existsSync(join(__dirname, '..', 'public', href!))).toBe(true)
  })
})

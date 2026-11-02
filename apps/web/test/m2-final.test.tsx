import { readFileSync } from 'node:fs'
import path from 'node:path'
import { clearReward, FLASH_14, FLASH_28, newPlayer, type Dragon, type Obstacle, type PlayerState } from '@wyrmhaven/game-core'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { timerLabel } from '../src/game/islandModel'
import { BreedPanel } from '../src/panels/BreedPanel'
import { DragonBookPanel } from '../src/panels/DragonBookPanel'
import { DragonPanel } from '../src/panels/DragonPanel'
import { HatcheryPanel } from '../src/panels/HatcheryPanel'
import { ObstaclePanel } from '../src/panels/ObstaclePanel'
import { UpgradeSection } from '../src/panels/UpgradeSection'
import { formatGold } from '../src/ui/Money'
import { harness, openInfo, TestHost } from './harness'

const base = newPlayer(0)
const GAME = { launchAtMs: 0 }
/** Game day 14: after every Legendary event window, so only the §3.2 outcomes are listed. */
const QUIET = 13 * 86_400_000
const dragon = (id: string, speciesId: string, over: Partial<Dragon> = {}): Dragon => ({ id, speciesId, level: 4, feeds: 0, habitatId: 'h1', ...over })
const breeding = (over: Partial<PlayerState> = {}): PlayerState => ({
  ...base, level: 2, firstHybridDone: true, dragons: base.dragons.map(d => ({ ...d, level: 4 })), ...over,
})
const pick = async (a: string, b: string) => {
  await userEvent.click(document.getElementById(`parent-a-${a}`)!)
  await userEvent.click(document.getElementById(`parent-b-${b}`)!)
}
const outcomes = () => within(screen.getByRole('list', { name: /breeding outcomes/i })).getAllByRole('listitem').map(li => li.textContent)
const breedButton = () => screen.getByRole('button', { name: /^breed$/i })

describe('tabs are tall enough to tap (item 6)', () => {
  it('.hud-tab has a 44 px minimum height', () => {
    const css = readFileSync(path.join(__dirname, '..', 'src', 'styles', 'hud.css'), 'utf8')
    expect(css).toMatch(/\.hud-tab \{[^}]*min-height: 44px/)
  })
})

describe('ObstaclePanel shows the XP it awards (item 7)', () => {
  const o: Obstacle = { id: 'o1', kind: 'bush', island: 'home', col: 8, row: 8 }
  const s = { ...base, islands: { ...base.islands, obstacles: [o] } }
  it('multiplies classic XP by the preset', () => {
    const xp = clearReward(o).xp
    const a = harness(s, 0, 'flash14').wrap(<ObstaclePanel obstacleId="o1" nowMs={0} />)
    expect(screen.getByText(new RegExp(`\\+${formatGold(xp * FLASH_14.xpMult)} XP`))).toBeInTheDocument()
    a.unmount()
    harness(s, 0, 'flash28').wrap(<ObstaclePanel obstacleId="o1" nowMs={0} />)
    expect(screen.getByText(new RegExp(`\\+${formatGold(xp * FLASH_28.xpMult)} XP`))).toBeInTheDocument()
  })
})

describe('Move to Hatchery (items 8, 15)', () => {
  const doneEgg = { speciesId: 'flame', readyAtMs: 0, hatchMs: 1, xpFree: false }
  it('does not claim the Hatchery is full while an action is merely pending', async () => {
    const h = harness({ ...base, breeders: [{ ...base.breeders[0]!, egg: doneEgg }] }, 0, undefined, GAME)
    h.action.mockImplementation(() => new Promise(() => {}))
    h.wrap(<BreedPanel nowMs={1} />)
    const move = screen.getByRole('button', { name: 'Move to Hatchery' })
    await userEvent.click(move)
    expect(move).toBeDisabled()
    expect(screen.queryByText('Hatchery is full')).toBeNull()
  })

  it('is disabled by a Hatchery full only because of a waiting hatchling', () => {
    const s = { ...base, breeders: [{ ...base.breeders[0]!, egg: doneEgg }], dragons: [...base.dragons, dragon('d9', 'sea', { level: 1, habitatId: null })] }
    expect(s.hatchery).toEqual([])
    harness(s, 0, undefined, GAME).wrap(<BreedPanel nowMs={1} />)
    expect(screen.getByRole('button', { name: 'Move to Hatchery' })).toBeDisabled()
    expect(screen.getByText('Hatchery is full')).toBeInTheDocument()
  })
})

describe('UpgradeSection at Grove level 2 (item 9)', () => {
  const grove = (level: number) => ({ kind: 'grove' as const, egg: null, level, placement: { island: 'home' as const, col: 9, row: 7, facing: 0 as const } })
  const at = (pl: number, l: number) => harness({ ...base, level: pl, gold: 9_000_000, breeders: [...base.breeders, grove(l)] }).wrap(<UpgradeSection building={{ type: 'breeder', index: 1 }} nowMs={0} />)

  it('points to the Store at PL 25', () => {
    at(25, 2)
    expect(screen.getByText('Level 3 in the Store')).toBeInTheDocument()
    expect(screen.queryByText('Max level')).toBeNull()
  })

  it('names the level below PL 25', () => {
    at(24, 2)
    expect(screen.getByText('Level 3 in the Store at player level 25')).toBeInTheDocument()
    expect(screen.queryByText('Max level')).toBeNull()
  })

  it('a true Grove level 3 and a level 3 Mountain say Max level', () => {
    const a = at(25, 3)
    expect(screen.getByText('Max level')).toBeInTheDocument()
    a.unmount()
    harness({ ...base, level: 25, breeders: [{ ...base.breeders[0]!, level: 3 }] }).wrap(<UpgradeSection building={{ type: 'breeder', index: 0 }} nowMs={0} />)
    expect(screen.getByText('Max level')).toBeInTheDocument()
  })
})

describe('DragonPanel for a waiting Legendary (item 11)', () => {
  const LINE = 'Needs room: upgrade a habitat or build a new one.'
  const show = (d: Dragon) => harness({ ...base, dragons: [...base.dragons, d] }).wrap(<DragonPanel dragonId={d.id} />)

  it('explains what to do, as it cannot be sold', () => {
    show(dragon('d9', 'magma-sovereign', { habitatId: null }))
    expect(screen.queryByRole('button', { name: /^sell/i })).toBeNull()
    expect(screen.getByText(LINE)).toBeInTheDocument()
  })

  it('stays quiet for a housed Legendary and for a waiting dragon that can be sold', () => {
    const a = show(dragon('d9', 'magma-sovereign'))
    expect(screen.queryByText(LINE)).toBeNull()
    a.unmount()
    show(dragon('d9', 'sea', { habitatId: null }))
    expect(screen.queryByText(LINE)).toBeNull()
  })
})

describe('BreedPanel pairs (item 13)', () => {
  it('refuses opposite Basics in the reversed order too (Ice x Flame)', async () => {
    const s = breeding({ dragons: [...breeding().dragons, dragon('d3', 'ice')] })
    harness(s, QUIET, undefined, GAME).wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d3', 'd2')
    expect(screen.queryByRole('list', { name: /breeding outcomes/i })).toBeNull()
    expect(breedButton()).toBeDisabled()
    expect(screen.getByText("Opposite Basics can't breed. Use a hybrid that carries one of them.")).toBeInTheDocument()
  })

  it('shows a table with Breed enabled for Flame x Ice-Sea, in both orders', async () => {
    const s = breeding({ dragons: [...breeding().dragons, dragon('d3', 'ice-sea')] })
    harness(s, QUIET, undefined, GAME).wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d2', 'd3')
    expect(outcomes().length).toBeGreaterThan(0)
    expect(breedButton()).toBeEnabled()
    await pick('d3', 'd2')
    expect(outcomes().length).toBeGreaterThan(0)
    expect(breedButton()).toBeEnabled()
  })
})

describe('BreedPanel buildings (item 15)', () => {
  it('shows the scripted 1m at a Mountain L2, with no building reduction', async () => {
    const s = breeding({ firstHybridDone: false, breeders: [{ ...base.breeders[0]!, level: 2 }] })
    harness(s, QUIET, undefined, GAME).wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(outcomes()).toEqual(['Terra-Flame · Rare · 50.00% · 1m', 'Flame-Terra · Rare · 50.00% · 1m'])
  })

  it('counts an unfinished Grove as busy', async () => {
    const grove = { kind: 'grove' as const, egg: null, level: 1, placement: { island: 'home' as const, col: 9, row: 7, facing: 0 as const } }
    const s = breeding({
      breeders: [{ ...base.breeders[0]!, egg: { speciesId: 'flame', readyAtMs: QUIET + 99_000, hatchMs: 1, xpFree: false } }, grove],
      constructions: [{ kind: 'build', building: { type: 'breeder', index: 1 }, readyAtMs: QUIET + 99_000 }],
    })
    harness(s, QUIET, undefined, GAME).wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    expect(breedButton()).toBeDisabled()
    expect(screen.getByText('Every breeding building is busy')).toBeInTheDocument()
  })

  it('opens from a tap on a breeder on the island', async () => {
    const bridge = createBridge()
    harness(base, 0, undefined, GAME).wrap(<TestHost bridge={bridge} />)
    act(() => bridge.emit({ type: 'select', target: { kind: 'breeder', index: 0 } }))
    fireEvent.click(screen.getByRole('button', { name: 'Breed' }))
    expect(await screen.findByRole('region', { name: 'Breed' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Breeding buildings' })).toBeInTheDocument()
  })
})

describe('the Breed button sits right under the pickers (item 20)', () => {
  it('comes before the outcome list', async () => {
    harness(breeding(), QUIET, undefined, GAME).wrap(<BreedPanel nowMs={QUIET} />)
    await pick('d1', 'd2')
    const list = screen.getByRole('list', { name: /breeding outcomes/i })
    expect(breedButton().compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Second parent' }).compareDocumentPosition(breedButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('Book tiles have one width (item 21)', () => {
  it('found and silhouette tiles share it', () => {
    harness(newPlayer(0)).wrap(<DragonBookPanel onSelect={() => {}} />)
    const tiles = screen.getAllByTestId('book-tile')
    expect(tiles.some(t => t.getAttribute('aria-label') === '???')).toBe(true)
    expect(tiles.some(t => t.getAttribute('aria-label') !== '???')).toBe(true)
    const widths = new Set(tiles.map(t => t.style.width))
    expect(widths.size).toBe(1)
    expect([...widths][0]).toMatch(/^\d+px$/)
  })
})

describe('timers do not round a minute up to two (item 22)', () => {
  it('shows 1m at 60,000 ms and a little over, 2m once clearly over', () => {
    expect(timerLabel(60_000, 0)).toBe('1m')
    expect(timerLabel(60_001, 0)).toBe('1m')
    expect(timerLabel(62_500, 0)).toBe('1m')
    expect(timerLabel(65_000, 0)).toBe('1m')
    expect(timerLabel(66_000, 0)).toBe('2m')
    expect(timerLabel(90_000, 0)).toBe('2m')
    expect(timerLabel(59_000, 0)).toBe('59s')
  })

  it('does the same at the hour', () => {
    expect(timerLabel(3_600_000, 0)).toBe('1h')
    expect(timerLabel(3_602_000, 0)).toBe('1h')
    expect(timerLabel(3_666_000, 0)).toBe('2h')
    expect(timerLabel(3_599_000, 0)).toBe('60m')
  })

  it('reads Egg 1m in the panel while the client clock lags', () => {
    const s = { ...base, breeders: [{ ...base.breeders[0]!, egg: { speciesId: 'flame', readyAtMs: 61_500, hatchMs: 1, xpFree: false } }] }
    harness(s, 0, undefined, GAME).wrap(<BreedPanel nowMs={0} />)
    expect(within(screen.getByTestId('breeder-0')).getByText('1m')).toBeInTheDocument()
  })
})

describe('HatcheryPanel says why a waiting hatchling blocks the slot (item 23)', () => {
  it('adds the line to the Needs a habitat row', () => {
    const s = { ...base, dragons: [...base.dragons, dragon('d9', 'sea', { level: 1, habitatId: null })] }
    harness(s).wrap(<HatcheryPanel nowMs={0} />)
    const row = screen.getByTestId('hatchery-slot-0')
    expect(within(row).getByText('Needs a habitat')).toBeInTheDocument()
    expect(within(row).getByText('It holds this slot until it has a home.')).toBeInTheDocument()
  })
})

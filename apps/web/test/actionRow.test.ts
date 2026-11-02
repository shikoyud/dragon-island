import { DEFAULT_PRESET, newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { actionRow, type ActionRow } from '../src/hud/actionRow'

const P = DEFAULT_PRESET
const fresh = newPlayer(0)
const icons = (r: ActionRow | null) => r?.buttons.map(b => b.icon)
const button = (r: ActionRow | null, icon: string) => r!.buttons.find(b => b.icon === icon)!

describe('actionRow: the buttons for each selected thing (design Phase 4 table)', () => {
  it('a habitat: a portrait per dragon, Get Egg, Collect, Upgrade, Info, Move', () => {
    const r = actionRow(fresh, { kind: 'habitat', id: 'h1' }, 0, P)
    expect(r!.name).toBe('Terra Habitat')
    expect(icons(r)).toEqual(['dragon', 'getEgg', 'collect', 'upgrade', 'info', 'move'])
    expect(button(r, 'dragon')).toMatchObject({ label: 'Terra Basic', portrait: { speciesId: 'terra', level: 1 }, intent: { kind: 'open', dialog: { kind: 'target', target: { kind: 'dragon', id: 'd1' } } } })
    expect(button(r, 'getEgg').intent).toEqual({ kind: 'open', dialog: { kind: 'panel', id: 'shop', category: 'dragons' } })
    expect(button(r, 'info').intent).toEqual({ kind: 'open', dialog: { kind: 'info', target: { type: 'habitat', id: 'h1' } } })
    expect(button(r, 'move').intent).toMatchObject({ kind: 'move', target: { type: 'habitat', id: 'h1' } })
  })

  it('Collect shows the stored gold above it and runs collectGold; with nothing stored it says why', () => {
    const empty = button(actionRow(fresh, { kind: 'habitat', id: 'h1' }, 0, P), 'collect')
    expect(empty.disabled).toBe('Nothing to collect yet')
    const later = button(actionRow(fresh, { kind: 'habitat', id: 'h1' }, 60 * 60_000, P), 'collect')
    expect(later.disabled).toBeUndefined()
    expect(later.above).toMatch(/^\d[\d,]*$/)
    expect(later.intent).toEqual({ kind: 'run', action: { type: 'collectGold', habitatId: 'h1' } })
  })

  it('a dragon selects its habitat\'s row', () => {
    expect(actionRow(fresh, { kind: 'dragon', id: 'd2' }, 0, P)!.name).toBe('Flame Habitat')
  })

  it('the Hatchery, empty: Get Egg, Upgrade, Info, Move (Storage hidden until Phase 5)', () => {
    const r = actionRow(fresh, { kind: 'hatcheryBuilding' }, 0, P)
    expect(r!.name).toBe('Hatchery')
    expect(icons(r)).toEqual(['getEgg', 'upgrade', 'info', 'move'])
  })

  it('the Hatchery, hatching: Hatch with the time above and a New badge, opening the Hatchery; ready: Hatch runs', () => {
    const s: PlayerState = { ...fresh, hatchery: [{ speciesId: 'sea', readyAtMs: 90_000 }] }
    const hatching = actionRow(s, { kind: 'hatchery', slot: 0 }, 0, P)
    expect(icons(hatching)).toEqual(['hatch', 'upgrade', 'info', 'move'])
    expect(button(hatching, 'hatch')).toMatchObject({ above: '2m', badge: 'new', intent: { kind: 'open', dialog: { kind: 'target', target: { kind: 'hatcheryBuilding' } } } })
    const ready = actionRow(s, { kind: 'hatcheryBuilding' }, 90_000, P)
    expect(button(ready, 'hatch')).toMatchObject({ intent: { kind: 'run', action: { type: 'hatch', slot: 0 } } })
    expect(button(ready, 'hatch').above).toBeUndefined()
  })

  it('a farm, idle: Grow Food; growing: Speed Up with the time; ready: Collect runs harvest', () => {
    const idle = actionRow(fresh, { kind: 'farm', plot: 0 }, 0, P)
    expect(idle!.name).toBe('Farm')
    expect(icons(idle)).toEqual(['growFood', 'upgrade', 'info', 'move'])
    expect(button(idle, 'growFood').intent).toEqual({ kind: 'open', dialog: { kind: 'target', target: { kind: 'farm', plot: 0 } } })
    const growing: PlayerState = { ...fresh, farms: [{ ...fresh.farms[0]!, crop: 'dragonBush' as const, readyAtMs: 30_000 }] }
    const g = actionRow(growing, { kind: 'farm', plot: 0 }, 0, P)
    expect(icons(g)).toEqual(['speedUp', 'upgrade', 'info', 'move'])
    expect(button(g, 'speedUp').above).toBe('30s')
    const ripe = actionRow(growing, { kind: 'farm', plot: 0 }, 30_000, P)
    expect(icons(ripe)).toEqual(['collect', 'upgrade', 'info', 'move'])
    expect(button(ripe, 'collect').intent).toEqual({ kind: 'run', action: { type: 'harvest', plot: 0 } })
  })

  it('the timer running out switches Speed Up to Collect with no new selection (review focus 3)', () => {
    const growing: PlayerState = { ...fresh, farms: [{ ...fresh.farms[0]!, crop: 'dragonBush' as const, readyAtMs: 30_000 }] }
    expect(icons(actionRow(growing, { kind: 'farm', plot: 0 }, 29_999, P))![0]).toBe('speedUp')
    expect(icons(actionRow(growing, { kind: 'farm', plot: 0 }, 30_000, P))![0]).toBe('collect')
  })

  it('a breeding building: Breed, Upgrade, Info, Move (no Rebreed: game-core has none); a ready egg is collected from it', () => {
    const r = actionRow(fresh, { kind: 'breeder', index: 0 }, 0, P)
    expect(r!.name).toBe('Breeding Mountain')
    expect(icons(r)).toEqual(['breed', 'upgrade', 'info', 'move'])
    expect(button(r, 'breed').intent).toEqual({ kind: 'open', dialog: { kind: 'panel', id: 'breed' } })
    const egg: PlayerState = { ...fresh, breeders: [{ ...fresh.breeders[0]!, egg: { speciesId: 'sea', readyAtMs: 10_000, hatchMs: 1, xpFree: false } }] }
    expect(button(actionRow(egg, { kind: 'breeder', index: 0 }, 0, P), 'breed')).toMatchObject({ above: '10s' })
    expect(button(actionRow(egg, { kind: 'breeder', index: 0 }, 10_000, P), 'breed').intent).toEqual({ kind: 'run', action: { type: 'collectEgg', breeder: 0 } })
  })

  it('an obstacle not started: Clear only, named, its gold cost above', () => {
    const r = actionRow(fresh, { kind: 'obstacle', id: 'os1' }, 0, P)
    expect(r!.name).toBe('Large Rock')
    expect(icons(r)).toEqual(['clear'])
    expect(button(r, 'clear')).toMatchObject({ intent: { kind: 'run', action: { type: 'clearObstacle', obstacleId: 'os1' } } })
    expect(button(r, 'clear').above).toMatch(/gold$/)
  })

  it('an obstacle being cleared: Speed Up with the time, opening its panel', () => {
    const s: PlayerState = { ...fresh, constructions: [{ kind: 'clear', obstacleId: 'os1', readyAtMs: 120_000 }] }
    const r = actionRow(s, { kind: 'obstacle', id: 'os1' }, 0, P)
    expect(icons(r)).toEqual(['speedUp'])
    expect(button(r, 'speedUp')).toMatchObject({ above: '2m', intent: { kind: 'open', dialog: { kind: 'target', target: { kind: 'obstacle', id: 'os1' } } } })
  })

  it('Upgrade is locked with the level it needs when the player is too low', () => {
    const r = actionRow({ ...fresh, level: 1 }, { kind: 'breeder', index: 0 }, 0, P)
    const up = button(r, 'upgrade')
    if (up.locked) expect(up.locked).toMatch(/^Level \d+$/)
    expect(up.intent).toEqual({ kind: 'open', dialog: { kind: 'upgrade', target: { type: 'breeder', index: 0 } } })
  })

  it('a plot for sale, the Map, empty land and a cell select nothing: they keep their old behaviour', () => {
    expect(actionRow(fresh, { kind: 'plot', island: 'home', plot: 2 }, 0, P)).toBeNull()
    expect(actionRow(fresh, { kind: 'mapIsland', id: 'isle2' }, 0, P)).toBeNull()
    expect(actionRow(fresh, { kind: 'empty' }, 0, P)).toBeNull()
    expect(actionRow(fresh, { kind: 'cell', col: 1, row: 1 }, 0, P)).toBeNull()
  })

  it('something gone (a sold habitat, a cleared obstacle) has no row', () => {
    expect(actionRow(fresh, { kind: 'habitat', id: 'nope' }, 0, P)).toBeNull()
    expect(actionRow(fresh, { kind: 'obstacle', id: 'nope' }, 0, P)).toBeNull()
  })
})

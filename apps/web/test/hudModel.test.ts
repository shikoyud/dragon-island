import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { attentionItems, MAX_ATTENTION, xpFraction } from '../src/hud/hudModel'

const base = (): PlayerState => newPlayer(0)

describe('HUD model', () => {
  it('xp fraction of the way to the next level, clamped to 0..1', () => {
    expect(xpFraction({ ...base(), level: 1, xp: 0 })).toBe(0)
    expect(xpFraction({ ...base(), level: 1, xp: 25 })).toBe(0.5) // 50 xp to level 2
    expect(xpFraction({ ...base(), level: 2, xp: 999 })).toBe(1)
  })

  it('lists daily quests even when nothing else needs attention', () => {
    expect(attentionItems(base(), 0).map(i => i.id)).toEqual(['quests'])
  })

  it('lists builds with a timer, and a Finish action once ready', () => {
    const s = { ...base(), constructions: [
      { kind: 'build' as const, building: { type: 'farm' as const, index: 1 }, readyAtMs: 60_000 },
      { kind: 'upgrade' as const, building: { type: 'habitat' as const, id: 'h1' }, readyAtMs: 5_000 },
    ] }
    const items = attentionItems(s, 10_000)
    // Ready first, then by time left.
    expect(items[0]).toMatchObject({ id: 'construction:1', ready: true, action: { type: 'finishConstruction', index: 1 }, panel: { kind: 'habitat', id: 'h1' } })
    expect(items[0]!.label).toMatch(/habitat/i)
    expect(items[1]).toMatchObject({ id: 'construction:0', ready: false, readyAtMs: 60_000, panel: { kind: 'farm', plot: 1 } })
  })

  it('lists eggs in nests and hatchery, ripe crops, and hatchlings with no room', () => {
    const s = base()
    s.nests[0]!.egg = { speciesId: 'fire', readyAtMs: 1_000 }
    s.hatchery = [{ speciesId: 'water', readyAtMs: 90_000 }] as PlayerState['hatchery']
    s.farms[0] = { ...s.farms[0]!, crop: 'sprout', readyAtMs: 500 }
    s.farms[1] = { ...s.farms[1]!, crop: 'sprout', readyAtMs: 800 }
    s.dragons.push({ ...s.dragons[0]!, id: 'd9', habitatId: null })
    const items = attentionItems(s, 2_000)
    const byId = Object.fromEntries(items.map(i => [i.id, i]))
    expect(byId['nest:0']).toMatchObject({ ready: true, action: { type: 'collectEgg', nest: 0 } })
    expect(byId['crops']).toMatchObject({ ready: true, label: expect.stringMatching(/2 crops/i), action: { type: 'harvest', plot: 0 } })
    expect(byId['hatchery']).toMatchObject({ ready: false, readyAtMs: 90_000 })
    expect(byId['noRoom']).toMatchObject({ ready: true, label: expect.stringMatching(/no room/i), panel: { kind: 'hatcheryBuilding' } })
    expect(items.length).toBeLessThanOrEqual(MAX_ATTENTION)
    expect(items.at(-1)!.id).toBe('quests')
  })

  it('keeps at most MAX_ATTENTION items, quests always last', () => {
    const s = { ...base(), constructions: [0, 1, 2, 3, 4, 5].map(i => ({ kind: 'build' as const, building: { type: 'farm' as const, index: i }, readyAtMs: 1000 * i })) }
    const items = attentionItems(s, 0)
    expect(items).toHaveLength(MAX_ATTENTION)
    expect(items.at(-1)!.id).toBe('quests')
  })
})

import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions/apply'
import type { Action } from '../src/actions/types'
import { activeBuilds } from '../src/construction'
import { createRng } from '../src/rng'
import { newPlayer, type Dragon, type PlayerState } from '../src/state'
import { isStored } from '../src/storage'
import { FIXTURE_CATALOG } from './fixtures'
import { err, ok } from './helpers'

const HOUR = 3_600_000
const rng = createRng(1)
const run = (st: PlayerState, a: Action, t: number) => applyAction(st, a, t, rng, FIXTURE_CATALOG)
const base = { ...newPlayer(0), gold: 1_000_000, level: 20 }
/** h2 empty: its Flame dragon waits in the Hatchery. */
const emptyH2: PlayerState = { ...base, dragons: base.dragons.map(d => d.id === 'd2' ? { ...d, habitatId: null } : d) }
const free = { island: 'home' as const, col: 20, row: 16, facing: 0 as const }

describe('putInStorage: buildings', () => {
  it('stores an empty habitat after collecting its gold', () => {
    const st: PlayerState = { ...emptyH2, habitats: emptyH2.habitats.map(h => h.id === 'h2' ? { ...h, lastCollectedMs: 0 } : h) }
    const a = ok(run(st, { type: 'putInStorage', target: { type: 'habitat', id: 'h2' } }, 600_000))
    expect(a.habitats.find(h => h.id === 'h2')!.stored).toEqual({ atMs: 600_000 })
    expect(isStored(a, { type: 'habitat', id: 'h2' })).toBe(true)
    // No residents: nothing to collect, but the stamp moves.
    expect(a.habitats.find(h => h.id === 'h2')!.lastCollectedMs).toBe(600_000)
  })

  it('refuses a habitat with dragons', () => {
    err(run(base, { type: 'putInStorage', target: { type: 'habitat', id: 'h1' } }, 0), 'INVALID_ACTION')
  })

  it('refuses the Hatchery', () => {
    err(run(base, { type: 'putInStorage', target: { type: 'hatchery' } as never }, 0), 'INVALID_ACTION')
  })

  it('refuses something already stored or missing', () => {
    const a = ok(run(emptyH2, { type: 'putInStorage', target: { type: 'habitat', id: 'h2' } }, 0))
    err(run(a, { type: 'putInStorage', target: { type: 'habitat', id: 'h2' } }, 0), 'NOT_FOUND')
    err(run(base, { type: 'putInStorage', target: { type: 'farm', index: 7 } }, 0), 'NOT_FOUND')
  })

  it('a stored building is off the grid', () => {
    const a = ok(run(emptyH2, { type: 'putInStorage', target: { type: 'habitat', id: 'h2' } }, 0))
    const at = { ...emptyH2.habitats.find(h => h.id === 'h2')!.placement }
    ok(run(a, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'stonePath' }, placement: at }, 0))
  })

  it('pauses a growing crop', () => {
    const planted = ok(run(base, { type: 'plant', plot: 0, crop: 'dragonBush' }, 0))
    const readyAt = planted.farms[0]!.readyAtMs
    const stored = ok(run(planted, { type: 'putInStorage', target: { type: 'farm', index: 0 } }, 1000))
    const back = ok(run(stored, { type: 'moveBuilding', target: { type: 'farm', index: 0 }, placement: free }, 1000 + HOUR))
    expect(back.farms[0]!.readyAtMs).toBe(readyAt + HOUR)
    expect(back.farms[0]!.stored).toBeUndefined()
    expect(back.farms[0]!.placement).toEqual(free)
  })

  it('a paused upgrade frees its builder and resumes when placed', () => {
    const up = ok(run(emptyH2, { type: 'startUpgrade', building: { type: 'habitat', id: 'h2' } }, 0))
    const readyAt = up.constructions[0]!.readyAtMs
    const stored = ok(run(up, { type: 'putInStorage', target: { type: 'habitat', id: 'h2' } }, 0))
    expect(activeBuilds(stored)).toBe(0)
    err(run(stored, { type: 'finishConstruction', index: 0 }, readyAt + 1), 'NOT_FOUND')
    const back = ok(run(stored, { type: 'moveBuilding', target: { type: 'habitat', id: 'h2' }, placement: free }, 2 * HOUR))
    expect(back.constructions[0]!.readyAtMs).toBe(readyAt + 2 * HOUR)
    expect(back.habitats.find(h => h.id === 'h2')!.lastCollectedMs).toBe(2 * HOUR)
  })

  it('stored buildings refuse every action but move', () => {
    const farm = ok(run(base, { type: 'putInStorage', target: { type: 'farm', index: 0 } }, 0))
    err(run(farm, { type: 'plant', plot: 0, crop: 'dragonBush' }, 0), 'NOT_FOUND')
    err(run(farm, { type: 'harvest', plot: 0 }, 0), 'NOT_FOUND')
    err(run(farm, { type: 'startUpgrade', building: { type: 'farm', index: 0 } }, 0), 'NOT_FOUND')
    const hab = ok(run(emptyH2, { type: 'putInStorage', target: { type: 'habitat', id: 'h2' } }, 0))
    err(run(hab, { type: 'collectGold', habitatId: 'h2' }, 0), 'NOT_FOUND')
    err(run(hab, { type: 'moveDragon', dragonId: 'd2', habitatId: 'h2' }, 0), 'NOT_FOUND')
    const grown: PlayerState = { ...base, dragons: base.dragons.map(d => ({ ...d, level: 10 })) }
    const br = ok(run(grown, { type: 'putInStorage', target: { type: 'breeder', index: 0 } }, 0))
    err(run(br, { type: 'collectEgg', breeder: 0 }, 0), 'NOT_FOUND')
    err(run(br, { type: 'startBreed', parentA: 'd1', parentB: 'd2' }, 0), 'NO_FREE_BREEDER')
  })

  it('a stored habitat earns nothing and takes no new dragon', () => {
    const hab = ok(run(emptyH2, { type: 'putInStorage', target: { type: 'habitat', id: 'h2' } }, 0))
    const egg: PlayerState = { ...hab, hatchery: [{ speciesId: 'flame', readyAtMs: 0 }] }
    const hatched = ok(run(egg, { type: 'hatch', slot: 0 }, 10 * HOUR))
    expect(hatched.dragons.filter(d => d.habitatId === 'h2')).toEqual([])
  })

  it('placing from Storage uses Move legality and costs nothing', () => {
    const hab = ok(run(emptyH2, { type: 'putInStorage', target: { type: 'habitat', id: 'h2' } }, 0))
    const blocked = { ...base.habitats.find(h => h.id === 'h1')!.placement }
    err(run(hab, { type: 'moveBuilding', target: { type: 'habitat', id: 'h2' }, placement: blocked }, 0), 'OVERLAP')
    const back = ok(run(hab, { type: 'moveBuilding', target: { type: 'habitat', id: 'h2' }, placement: free }, 0))
    expect(back.gold).toBe(hab.gold)
  })

  it('the Roost stores with roostStored and keeps its tier', () => {
    const st: PlayerState = { ...base, roostTier: 2, roostPlacement: free }
    const a = ok(run(st, { type: 'putInStorage', target: { type: 'roost' } }, 5))
    expect([a.roostStored, a.roostTier, isStored(a, { type: 'roost' })]).toEqual([{ atMs: 5 }, 2, true])
    const back = ok(run(a, { type: 'moveBuilding', target: { type: 'roost' }, placement: free }, 9))
    expect([back.roostStored, back.roostTier]).toEqual([undefined, 2])
  })

  it('stores and returns a decoration', () => {
    const deco = ok(run(base, { type: 'placeBuilding', building: { kind: 'decoration', decoration: 'stonePath' }, placement: free }, 0))
    const id = deco.decorations[0]!.id
    const a = ok(run(deco, { type: 'putInStorage', target: { type: 'decoration', id } }, 0))
    expect(a.decorations[0]!.stored).toEqual({ atMs: 0 })
  })
})

describe('putInStorage: dragons and eggs', () => {
  const d9: Dragon = { id: 'd9', speciesId: 'flame', level: 3, feeds: 0, habitatId: 'h2' }
  const three: PlayerState = { ...base, dragons: [...base.dragons, d9] }

  it('stores a dragon and moveDragon takes it out', () => {
    const a = ok(run(three, { type: 'putInStorage', target: { type: 'dragon', id: 'd9' } }, 0))
    expect(a.dragons.find(d => d.id === 'd9')).toMatchObject({ habitatId: null, stored: true, level: 3 })
    err(run(a, { type: 'feed', dragonId: 'd9' }, 0), 'NOT_FOUND')
    const back = ok(run(a, { type: 'moveDragon', dragonId: 'd9', habitatId: 'h2' }, 0))
    expect(back.dragons.find(d => d.id === 'd9')).toEqual({ ...d9 })
  })

  it('refuses a defence-team dragon', () => {
    err(run({ ...three, defenceTeam: ['d1', 'd2', 'd9'] }, { type: 'putInStorage', target: { type: 'dragon', id: 'd9' } }, 0), 'INVALID_ACTION')
  })

  it('stores an egg with its remaining time and takeEgg restores it', () => {
    const st: PlayerState = { ...base, hatchery: [{ speciesId: 'flame', readyAtMs: 5 * HOUR, xpFree: true }] }
    const a = ok(run(st, { type: 'putInStorage', target: { type: 'egg', slot: 0 } }, HOUR))
    expect([a.hatchery, a.storedEggs]).toEqual([[], [{ speciesId: 'flame', remainingMs: 4 * HOUR, xpFree: true }]])
    const back = ok(run(a, { type: 'takeEgg', index: 0 }, 10 * HOUR))
    expect([back.hatchery, back.storedEggs]).toEqual([[{ speciesId: 'flame', readyAtMs: 14 * HOUR, xpFree: true }], []])
    err(run(a, { type: 'takeEgg', index: 3 }, 0), 'NOT_FOUND')
  })

  it('takeEgg with a full Hatchery fails HATCHERY_FULL', () => {
    const full: PlayerState = { ...base, storedEggs: [{ speciesId: 'flame', remainingMs: 0 }], hatchery: Array.from({ length: 8 }, () => ({ speciesId: 'flame', readyAtMs: 0 })) }
    err(run(full, { type: 'takeEgg', index: 0 }, 0), 'HATCHERY_FULL')
  })
})

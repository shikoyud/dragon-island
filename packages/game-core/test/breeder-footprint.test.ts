import { describe, expect, it } from 'vitest'
import {
  applyAction, BREEDER_FOOTPRINT, createRng, FOOTPRINT, ISLAND_TILES, LAUNCH_CATALOG, newPlayer, occupants, placementRuleError,
  type Action, type PlacementSubject, type PlayerState,
} from '../src/index'
import { HOME_BUY_ORDER } from './helpers/land'

const run = (s: PlayerState, a: Action): PlayerState => {
  const r = applyAction(s, a, 0, createRng(1), LAUNCH_CATALOG)
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const P = (col: number, row: number) => ({ island: 'home' as const, col, row, facing: 0 as const })

/** Every legal top-left cell on the home island. */
const legalCells = (s: PlayerState, subject: PlacementSubject) => {
  const out: { col: number; row: number }[] = []
  for (let row = 0; row < ISLAND_TILES; row++) for (let col = 0; col < ISLAND_TILES; col++) {
    if (placementRuleError(s, subject, P(col, row)) === null) out.push({ col, row })
  }
  return out
}

describe('breeding buildings stand on 5x5 tiles (§5.4)', () => {
  it('sets the footprint to 5 and puts the first Mountain at (8, 8)', () => {
    expect(BREEDER_FOOTPRINT).toBe(5)
    expect(FOOTPRINT.breeder).toBe(5)
    expect(newPlayer(0).breeders[0]!.placement).toEqual(P(8, 8))
    expect(occupants(newPlayer(0), 'home').find(o => o.ref.type === 'breeder')).toMatchObject({ col: 8, row: 8, size: 5 })
  })

  it('leaves legal habitat cells on a fresh island', () => {
    const sea = { kind: 'habitat', element: 'sea' } as const
    expect(legalCells(newPlayer(0), sea).length).toBeGreaterThan(0)
  })

  it('lets a fresh PL 3 player build a Sea habitat and buy a Sea Basic into it through applyAction', () => {
    const s: PlayerState = { ...newPlayer(0), level: 3, gold: 10_000 }
    const sea = { kind: 'habitat', element: 'sea' } as const
    const built = run(s, { type: 'placeBuilding', building: sea, placement: { ...P(0, 0), ...legalCells(s, sea)[0]! } })
    expect(built.habitats.map(h => h.element)).toEqual(['terra', 'flame', 'sea'])
    const con = built.constructions.findIndex(c => c.kind === 'build')
    const done = applyAction(built, { type: 'finishConstruction', index: con }, built.constructions[con]!.readyAtMs, createRng(1), LAUNCH_CATALOG)
    if (!done.ok) throw new Error(done.error)
    const bought = run(done.state, { type: 'buyBasic', element: 'sea' })
    expect(bought.dragons.filter(d => d.speciesId === 'sea')).toHaveLength(1)
  })

  it('places the Breeding Grove on the home island of a normal PL 12 game', () => {
    // Every plot Home has open at PL 12 (R46), then a habitat first, as a normal game would.
    let s: PlayerState = { ...newPlayer(0), level: 12, gold: 5_000_000 }
    for (const plot of HOME_BUY_ORDER) s = run(s, { type: 'buyPlot', island: 'home', plot })
    s = run(s, { type: 'placeBuilding', building: { kind: 'habitat', element: 'sea' }, placement: { ...P(0, 0), ...legalCells(s, { kind: 'habitat', element: 'sea' })[0]! } })
    const cell = legalCells(s, { kind: 'grove' })[0]!
    const placed = run(s, { type: 'placeBuilding', building: { kind: 'grove' }, placement: { ...P(0, 0), ...cell } })
    expect(placed.breeders.map(b => b.kind)).toEqual(['mountain', 'grove'])
    expect(placed.breeders[1]!.placement.island).toBe('home')

    // Also with no plot bought at all, and with the Grove's minimum Gold.
    const fresh: PlayerState = { ...newPlayer(0), level: 12, gold: 400_000 }
    const atStart = run(fresh, { type: 'placeBuilding', building: { kind: 'grove' }, placement: { ...P(0, 0), ...legalCells(fresh, { kind: 'grove' })[0]! } })
    expect(atStart.gold).toBe(0)
  })
})

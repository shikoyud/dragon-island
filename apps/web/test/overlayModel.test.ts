import { newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { homesFor, selectionOutline } from '../src/game/overlayModel'

const s = newPlayer(0)

describe('selectionOutline', () => {
  it('goes round a building\'s footprint where it stands', () => {
    expect(selectionOutline(s, { kind: 'habitat', id: 'h1' })).toEqual({ island: 'home', col: 13, row: 8, size: 4 })
    expect(selectionOutline(s, { kind: 'farm', plot: 0 })).toEqual({ island: 'home', col: 21, row: 8, size: 3 })
    expect(selectionOutline(s, { kind: 'hatcheryBuilding' })).toMatchObject({ island: 'home', size: 4 })
    expect(selectionOutline(s, { kind: 'breeder', index: 0 })).toMatchObject({ island: 'home', col: 8, row: 8 })
  })

  it('an obstacle by its kind\'s size', () => {
    expect(selectionOutline(s, { kind: 'obstacle', id: 'os1' })).toMatchObject({ island: 'home', col: 16, row: 17 })
  })

  it('nothing selected, gone, or with no footprint: no outline', () => {
    expect(selectionOutline(s, null)).toBeNull()
    expect(selectionOutline(s, { kind: 'habitat', id: 'gone' })).toBeNull()
    expect(selectionOutline(s, { kind: 'plot', island: 'home', plot: 2 })).toBeNull()
    expect(selectionOutline(s, { kind: 'roost' })).toBeNull() // not built
  })
})

describe('homesFor (ruling A5)', () => {
  // d3 hatched with no room: a terra dragon waiting in the Hatchery.
  const waiting = { ...s, dragons: [...s.dragons, { id: 'd3', speciesId: 'terra', level: 1, feeds: 0, habitatId: null }] }

  it('lists the habitats that can hold the waiting dragon and have a free slot', () => {
    const homes = homesFor(waiting, 'd3')
    expect(homes).toContain('h1') // terra holds terra
    expect(homes).not.toContain('h2') // flame does not
  })

  it('a full habitat, one still being built, or a dragon that already has a home: none', () => {
    const full = { ...waiting, dragons: [...waiting.dragons, ...Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, speciesId: 'terra', level: 1, feeds: 0, habitatId: 'h1' }))] }
    expect(homesFor(full, 'd3')).toEqual([])
    const building = { ...waiting, constructions: [{ kind: 'build' as const, building: { type: 'habitat' as const, id: 'h1' }, readyAtMs: 1 }] }
    expect(homesFor(building, 'd3')).toEqual([])
    expect(homesFor(waiting, 'd1')).toEqual([])
    expect(homesFor(waiting, 'nope')).toEqual([])
  })
})

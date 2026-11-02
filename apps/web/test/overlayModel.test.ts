import { newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { selectionOutline } from '../src/game/overlayModel'

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

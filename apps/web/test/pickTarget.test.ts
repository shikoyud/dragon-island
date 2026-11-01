import { LAUNCH_CATALOG, newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { FALLBACK_ART } from '../src/art/slots'
import { buildIslandModel, type IslandObject } from '../src/game/islandModel'
import { tapHit } from '../src/game/layout'
import { pickTarget, type Hit } from '../src/game/pickTarget'

const hit = (target: string, pixel: boolean, x: number, y: number): Hit<string> => ({ target, pixel, centre: { x, y } })

describe('pickTarget', () => {
  it('a pixel hit beats a box-only hit, wherever each is in the draw order', () => {
    expect(pickTarget([hit('bush', false, 0, 0), hit('farm', true, 50, 50)], { x: 1, y: 1 })).toBe('farm')
    expect(pickTarget([hit('farm', true, 50, 50), hit('bush', false, 0, 0)], { x: 1, y: 1 })).toBe('farm')
  })

  it('among pixel hits the topmost (first) wins', () => {
    expect(pickTarget([hit('front', true, 9, 9), hit('back', true, 0, 0)], { x: 0, y: 0 })).toBe('front')
  })

  it('among box-only hits the middle nearest the pointer wins: three Bushes in a row', () => {
    const bushes = [hit('left', false, -16, 0), hit('mid', false, 0, 0), hit('right', false, 16, 0)]
    expect(pickTarget(bushes, { x: 1, y: 0 })).toBe('mid')
    expect(pickTarget([...bushes].reverse(), { x: 1, y: 0 })).toBe('mid')
    expect(pickTarget(bushes, { x: -13, y: 0 })).toBe('left')
    expect(pickTarget(bushes, { x: 15, y: 0 })).toBe('right')
  })

  it('a tie goes to the topmost', () => {
    expect(pickTarget([hit('a', false, -5, 0), hit('b', false, 5, 0)], { x: 0, y: 0 })).toBe('a')
  })

  it('a sign tapped on its pixels beats a Bush drawn in front; its transparent corner goes to the nearer middle', () => {
    const sign = { x: 0, y: 0 }
    const bush = { x: 20, y: 6 }
    expect(pickTarget([hit('bush', false, bush.x, bush.y), hit('sign', true, sign.x, sign.y)], { x: 2, y: 2 })).toBe('sign')
    // Corner of the sign's box: not on its pixels, and the Bush's middle is nearer.
    expect(pickTarget([hit('bush', false, bush.x, bush.y), hit('sign', false, sign.x, sign.y)], { x: 16, y: 5 })).toBe('bush')
    expect(pickTarget([hit('bush', false, bush.x, bush.y), hit('sign', false, sign.x, sign.y)], { x: 3, y: 1 })).toBe('sign')
  })

  it('no hits is no target', () => {
    expect(pickTarget([], { x: 0, y: 0 })).toBeNull()
  })
})

describe('the starting Farm with Bushes in front of it', () => {
  // The Start no longer puts Bushes in front of the Farm (U6), so the test lays the three it needs.
  const start = newPlayer(0)
  const front = [[22, 11], [23, 11], [21, 11]].map(([col, row], i) => ({ id: `ob${i}`, kind: 'bush' as const, island: 'home' as const, col: col!, row: row! }))
  const s = { ...start, islands: { ...start.islands, obstacles: [...start.islands.obstacles, ...front] } }
  const objects = buildIslandModel(s, FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', null).objects
  const farm = objects.find(o => o.target.kind === 'farm' && o.id.startsWith('farm:'))!
  const bushes = objects.filter(o => o.target.kind === 'obstacle')
  const size = (o: IslandObject) => ({ w: o.sprite.w * (o.scale ?? 1), h: o.sprite.h * (o.scale ?? 1) })
  const middle = (o: IslandObject) => ({ x: o.x, y: o.y - size(o).h / 2 })
  /** Phaser's box test: the tap box is centred on the sprite's middle. */
  const inBox = (o: IslandObject, zoom: number, p: { x: number; y: number }) => {
    const b = tapHit(size(o), zoom, o.minTap ?? 0, o.boxAlways)
    const c = middle(o)
    return Math.abs(p.x - c.x) <= b.w / 2 && Math.abs(p.y - c.y) <= b.h / 2
  }

  for (const zoom of [1, 2]) {
    it(`a tap on the Farm's middle opens the Farm at zoom ${zoom}, though Bush boxes cover it`, () => {
      // Points on the Farm's footprint: its middle and its front half.
      const spots = [middle(farm), { x: farm.x, y: farm.y - 4 }, { x: farm.x - 8, y: farm.y - 8 }, { x: farm.x + 8, y: farm.y - 8 }]
      const p = spots.find(q => bushes.some(b => inBox(b, zoom, q)))
      expect(p, 'premise: some Bush box covers part of the Farm').toBeDefined()
      const covering = bushes.filter(b => inBox(b, zoom, p!))
      // Phaser lists the topmost first: the Bushes are drawn after (above) the Farm here, then the Farm.
      const hits: Hit<string>[] = [
        ...covering.map(b => ({ target: b.id, pixel: false, centre: middle(b) })),
        { target: farm.id, pixel: true, centre: middle(farm) },
      ]
      expect(pickTarget(hits, p!)).toBe(farm.id)
    })
  }

  it('a tap on a Bush\'s own pixels opens that Bush, not the Bush beside it', () => {
    const [a, b] = bushes.filter(o => o.sprite.w <= 16)
    const hits: Hit<string>[] = [{ target: b!.id, pixel: false, centre: middle(b!) }, { target: a!.id, pixel: true, centre: middle(a!) }]
    expect(pickTarget(hits, middle(a!))).toBe(a!.id)
  })
})

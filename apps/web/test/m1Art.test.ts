import { FOOTPRINT, LAUNCH_CATALOG, newPlayer } from '@wyrmhaven/game-core'
import { describe, expect, it } from 'vitest'
import { artSetFromManifest } from '../src/art/fromManifest'
import { artEntries, textureKey } from '../src/art/phaserLoader'
import { FALLBACK_ART } from '../src/art/slots'
import { buildIslandModel } from '../src/game/islandModel'
import { nearestLegalCell } from '../src/state/placing'

const e = (file: string, w: number, h: number, frames = 1, fps = 0) => ({ file, w, h, frames, fps })
const C = LAUNCH_CATALOG

describe('M1 art keys (docs/art/gdd-m1-art-list.md)', () => {
  it('reads each crop from crop.<cropId> and its sway sheet, and the old v1 tier keys no longer count', () => {
    const art = artSetFromManifest('v2', { assets: {
      'crop.sprout': e('old.png', 16, 16, 4), 'crop.emberWheat': e('wheat.png', 16, 16, 3), 'crop.emberWheat.sway': e('wheat-sway.png', 16, 16, 4, 4),
    } }, C)
    expect(art.building.cropStage.emberWheat.src).toBe('/art/v2/wheat.png')
    expect(art.building.cropSway.emberWheat?.src).toBe('/art/v2/wheat-sway.png')
    expect(art.building.cropStage.dragonBush.src).toBe('') // no art of its own: the drawn fallback
  })

  it('prefers building.goldenAerie for the Aerie ghost when present, else the Nexus', () => {
    const s = { ...newPlayer(0), islands: { ...newPlayer(0).islands, homeStep: 1 } } // the starting island has no free 5x5 spot
    const spot = nearestLegalCell(s, { kind: 'goldenAerie' }, 'home', { col: 4, row: 4 })!
    const placing = { what: { kind: 'goldenAerie' as const }, size: FOOTPRINT.habitat, ...spot, facing: 0 as const }
    const art = artSetFromManifest('v2', { assets: { 'building.goldenAerie': e('aerie.png', 80, 64) } }, C)
    expect(art.building.goldenAerie?.src).toBe('/art/v2/aerie.png')
    expect(artEntries(art).map(r => r.key)).toContain(textureKey('building.goldenAerie'))
    expect(buildIslandModel(s, art, C, 0, 'home', placing).objects.find(o => o.id === 'ghost')!.key).toContain('building.goldenAerie')
    expect(FALLBACK_ART.building.goldenAerie).toBeNull()
    expect(buildIslandModel(s, FALLBACK_ART, C, 0, 'home', placing).objects.find(o => o.id === 'ghost')!.key).toContain('building.nexus')
  })

  it('has an fx.coins slot that falls back to a drawn 32x32 sprite', () => {
    expect(FALLBACK_ART.fx.coins).toMatchObject({ src: '', w: 32, h: 32 })
    const row = artEntries(FALLBACK_ART).find(r => r.key === textureKey('fx.coins'))!
    expect(row.slot).toBe('fxCoins')
    const art = artSetFromManifest('v2', { assets: { 'fx.coins': e('coins.png', 32, 32, 8, 12) } }, C)
    expect(art.fx.coins).toMatchObject({ src: '/art/v2/coins.png', frames: 8, fps: 12 })
  })
})

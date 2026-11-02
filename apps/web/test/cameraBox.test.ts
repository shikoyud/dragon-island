import { describe, expect, it, vi } from 'vitest'

// The real shape module but for the rasteriser, which must not run just for a box.
vi.mock('../src/game/islandShape', async orig => ({
  ...(await orig<typeof import('../src/game/islandShape')>()),
  landmass: vi.fn(() => { throw new Error('rasterised') }),
}))

describe('the camera box', () => {
  it('Home\'s bounds come without rasterising the land', async () => {
    const { cameraBounds } = await import('../src/game/camera')
    const { landmass, landmassBox } = await import('../src/game/islandShape')
    const all = Array.from({ length: 16 }, (_, i) => i)
    const box = landmassBox(all)
    expect(cameraBounds('home')).toEqual({ x: box.x - 24, y: box.y - 24, w: box.w + 48, h: box.h + 48 })
    expect(landmass).not.toHaveBeenCalled()
  })
})

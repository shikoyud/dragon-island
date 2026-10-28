// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { artSetFromManifest, type Manifest } from '../src/art/fromManifest'
import { ACTIVE_ART } from '../src/art/slots'
import { Sprite } from '../src/art/Sprite'
import { ELEMENTS, ELEMENT_COLORS } from '../src/domain/elements'

afterEach(cleanup)

const manifest: Manifest = {
  assets: { 'egg.fire': { file: 'egg-fire.png', w: 16, h: 20, frames: 6, fps: 8 } },
}

describe('artSetFromManifest', () => {
  it('maps a manifest entry to a versioned src with its frame data', () => {
    const art = artSetFromManifest('v1', manifest)
    expect(art.version).toBe('v1')
    expect(art.egg.fire).toEqual({ src: '/art/v1/egg-fire.png', w: 16, h: 20, frames: 6, fps: 8 })
  })

  it('yields an empty src for missing keys', () => {
    const art = artSetFromManifest('v1', manifest)
    expect(art.egg.ice.src).toBe('')
    expect(art.hero.base.src).toBe('')
    expect(art.ui.button.src).toBe('')
    for (const e of ELEMENTS) {
      expect(art.hatchling[e].src).toBe('')
      expect(art.elementIcon[e].src).toBe('')
    }
  })

  it('collects hero layers in numeric order', () => {
    const art = artSetFromManifest('v1', {
      assets: {
        'hero.layer.1': { file: 'b.png', w: 4, h: 4, frames: 1, fps: 1 },
        'hero.layer.0': { file: 'a.png', w: 4, h: 4, frames: 1, fps: 1 },
      },
    })
    expect(art.hero.layers.map((l) => l.src)).toEqual(['/art/v1/a.png', '/art/v1/b.png'])
  })

  it('ACTIVE_ART is the empty v0 set', () => {
    expect(ACTIVE_ART.version).toBe('v0')
    expect(ACTIVE_ART.egg.fire.src).toBe('')
  })
})

describe('<Sprite>', () => {
  it('renders a flat element-coloured block when src is empty', () => {
    const { container } = render(
      <Sprite sprite={{ src: '', w: 16, h: 16, frames: 1, fps: 1 }} element="fire" scale={2} />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.backgroundColor).not.toBe('')
    const probe = document.createElement('div')
    probe.style.backgroundColor = ELEMENT_COLORS.fire.base
    expect(el.style.backgroundColor).toBe(probe.style.backgroundColor)
    expect(el.style.width).toBe('32px')
    expect(el.style.height).toBe('32px')
  })

  it('animates a multi-frame sheet with steps(frames)', () => {
    const { container } = render(
      <Sprite sprite={{ src: '/a.png', w: 16, h: 20, frames: 6, fps: 8 }} element="water" scale={3} />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.animationTimingFunction).toBe('steps(6)')
    expect(el.style.animationDuration).toBe('0.75s')
    expect(el.style.width).toBe('48px')
    expect(el.style.height).toBe('60px')
    expect(el.style.backgroundSize).toBe('288px 60px')
    expect(el.style.imageRendering).toBe('pixelated')
  })

  it('does not animate a single frame or when animate is false', () => {
    const one = render(<Sprite sprite={{ src: '/a.png', w: 8, h: 8, frames: 1, fps: 1 }} element="ice" scale={1} />)
    expect((one.container.firstElementChild as HTMLElement).style.animationName).toBe('')
    const off = render(
      <Sprite sprite={{ src: '/a.png', w: 8, h: 8, frames: 4, fps: 4 }} element="ice" scale={1} animate={false} />,
    )
    expect((off.container.firstElementChild as HTMLElement).style.animationName).toBe('')
  })

  it('throws on a non-integer scale', () => {
    expect(() =>
      render(<Sprite sprite={{ src: '', w: 8, h: 8, frames: 1, fps: 1 }} element="fire" scale={1.5} />),
    ).toThrow()
  })
})

// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { artSetFromManifest, type Manifest } from '../src/art/fromManifest'
import { ACTIVE_ART } from '../src/art/slots'
import { Sprite } from '../src/art/Sprite'
import { ELEMENTS, ELEMENT_COLORS } from '../src/domain/elements'

afterEach(cleanup)

const manifest: Manifest = {
  assets: { 'egg.flame': { file: 'egg-flame.png', w: 16, h: 20, frames: 6, fps: 8 } },
}

describe('artSetFromManifest', () => {
  it('maps a manifest entry to a versioned src with its frame data', () => {
    const art = artSetFromManifest('v1', manifest)
    expect(art.version).toBe('v1')
    expect(art.egg.flame).toEqual({ src: '/art/v1/egg-flame.png', w: 16, h: 20, frames: 6, fps: 8 })
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

  it('ACTIVE_ART is the PixelLab v1 set', () => {
    expect(ACTIVE_ART.version).toBe('v1')
    expect(ACTIVE_ART.egg.flame.src).toBe('/art/v1/egg-flame.png')
  })
})

describe('art v1 manifest', () => {
  const dir = path.join(__dirname, '..', 'public', 'art', 'v1')
  const v1 = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as Manifest

  it('has every per-element key plus the hero and UI keys', () => {
    const keys = ['hero.base', 'hero.layer.0', 'ui.panel', 'ui.button']
    for (const e of ELEMENTS) if (e !== 'war') keys.push(`egg.${e}`, `hatchling.${e}`, `icon.${e}`)
    for (const k of keys) expect(v1.assets[k], k).toBeDefined()
  })

  it('has no War art yet: every War slot is empty and renders the colour block', () => {
    for (const prefix of ['egg', 'hatchling', 'icon']) expect(v1.assets[`${prefix}.war`], prefix).toBeUndefined()
    for (const sprite of [ACTIVE_ART.egg.war, ACTIVE_ART.hatchling.war, ACTIVE_ART.elementIcon.war]) {
      expect(sprite.src).toBe('')
      const { container } = render(<Sprite sprite={sprite} element="war" scale={1} />)
      const el = container.firstElementChild as HTMLElement
      expect(el.className).toContain('wh-sprite-fallback')
      const probe = document.createElement('div')
      probe.style.backgroundColor = ELEMENT_COLORS.war.base
      expect(el.style.backgroundColor).toBe(probe.style.backgroundColor)
    }
  })

  it('points every entry at a PNG on disk whose size matches w × frames by h', () => {
    for (const [key, a] of Object.entries(v1.assets)) {
      const file = path.join(dir, a.file)
      expect(existsSync(file), key).toBe(true)
      const png = readFileSync(file)
      expect(png.readUInt32BE(16), `${key} width`).toBe(a.w * a.frames)
      expect(png.readUInt32BE(20), `${key} height`).toBe(a.h)
      expect(Number.isInteger(a.frames) && a.frames >= 1, key).toBe(true)
    }
  })
})

describe('<Sprite>', () => {
  it('renders a flat element-coloured block when src is empty', () => {
    const { container } = render(
      <Sprite sprite={{ src: '', w: 16, h: 16, frames: 1, fps: 1 }} element="flame" scale={2} />,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.style.backgroundColor).not.toBe('')
    const probe = document.createElement('div')
    probe.style.backgroundColor = ELEMENT_COLORS.flame.base
    expect(el.style.backgroundColor).toBe(probe.style.backgroundColor)
    expect(el.style.width).toBe('32px')
    expect(el.style.height).toBe('32px')
  })

  it('animates a multi-frame sheet with steps(frames)', () => {
    const { container } = render(
      <Sprite sprite={{ src: '/a.png', w: 16, h: 20, frames: 6, fps: 8 }} element="sea" scale={3} />,
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
      render(<Sprite sprite={{ src: '', w: 8, h: 8, frames: 1, fps: 1 }} element="flame" scale={1.5} />),
    ).toThrow()
  })
})

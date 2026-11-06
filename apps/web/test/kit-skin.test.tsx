import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Sprite } from '../src/art/types'
import { HudArtContext } from '../src/hud/Icon'
import { hudSkin } from '../src/hud/skin'
import { KitGallery } from '../src/pages/KitGallery'
import { ElementRibbon, RarityShield } from '../src/ui/kit/pieces'

const sprite = (src: string): Sprite => ({ src, w: 16, h: 16, frames: 1, fps: 0 } as Sprite)
afterEach(cleanup)

describe('kit art slots', () => {
  it('adds a CSS variable and class per ui.kit.* key that has art, and nothing without', () => {
    const on = hudSkin({ 'ui.kit.close': sprite('/c.png'), 'ui.kit.pill.green': sprite('/g.png') })
    expect(on.style['--kit-close']).toBe('url("/c.png")')
    expect(on.className.split(' ')).toEqual(expect.arrayContaining(['skin-kit-close', 'skin-kit-pill-green']))
    const off = hudSkin({})
    expect(off.className).not.toMatch(/skin-kit/)
    expect(Object.keys(off.style)).toHaveLength(0)
  })
  it('ribbon and shield draw their art when it exists, and keep their names', () => {
    render(
      <HudArtContext.Provider value={{ 'ui.kit.ribbon.sea': sprite('/r.png'), 'ui.kit.shield.epic': sprite('/s.png') }}>
        <ElementRibbon element="sea" /><RarityShield rarity="epic" />
      </HudArtContext.Provider>,
    )
    expect(screen.getByRole('img', { name: 'Sea' })).toHaveStyle({ backgroundImage: 'url(/r.png)' })
    expect(screen.getByRole('img', { name: 'Epic' })).toHaveTextContent('E')
  })
})

describe('#/kit gallery', () => {
  it('shows every component and every pill colour', () => {
    render(<KitGallery />)
    for (const c of ['blue', 'yellow', 'green', 'purple', 'grey', 'red']) expect(document.querySelector(`.kit-pill--${c}`)).not.toBeNull()
    for (const sel of ['.kit-frame', '.kit-plank', '.kit-badge', '.kit-square--close', '.kit-square--back', '.kit-square--help', '.kit-price--short',
      '.kit-round', '.kit-card--locked', '.kit-resource', '.kit-bar', '.kit-bubble', '.kit-ribbon', '.kit-shield', '.kit-tip', '.kit-toast', '.kit-scroll']) {
      expect(document.querySelector(sel), sel).not.toBeNull()
    }
  })
})

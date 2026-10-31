// Task 9: HUD art for Icon (element icons, review F1), the skin classes for the battle ui, stars, and names on the Arena panel.
import { LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { artSetFromManifest, type Manifest } from '../src/art/fromManifest'
import type { Sprite } from '../src/art/types'
import { Stars } from '../src/hud/ArtMark'
import { HudArtContext, hudArtOf, Icon } from '../src/hud/Icon'
import { hudSkin } from '../src/hud/skin'

const sprite = (file: string): Sprite => ({ src: `/art/v1/${file}`, w: 16, h: 16, frames: 1, fps: 0 })
const assets: Manifest['assets'] = Object.fromEntries(['flame', 'terra', 'war'].map(e => [`icon.${e}`, { file: `icon-${e}.png`, w: 16, h: 16, frames: 1, fps: 0 }]))

describe('Icon and element icons (review F1)', () => {
  it('draws icon.<element> from the art set the App provides, in every place an element icon appears', () => {
    const art = hudArtOf(artSetFromManifest('v1', { assets }, LAUNCH_CATALOG))
    render(<HudArtContext.Provider value={art}><Icon name="flame" size={20} label="Flame" /><Icon name="terra" size={16} /></HudArtContext.Provider>)
    expect(screen.getByRole('img', { name: 'Flame' })).toHaveAttribute('src', '/art/v1/icon-flame.png')
    expect(document.querySelector('img[src="/art/v1/icon-terra.png"]')).not.toBeNull()
    expect(document.querySelector('[data-icon="flame"]')).toBeNull()
  })

  it('an element the manifest lacks keeps its diamond, and so does a game with no art at all', () => {
    const art = hudArtOf(artSetFromManifest('v1', { assets }, LAUNCH_CATALOG))
    render(<HudArtContext.Provider value={art}><Icon name="sea" /></HudArtContext.Provider>)
    expect(document.querySelector('svg[data-icon="sea"]')).not.toBeNull()
    expect(document.querySelector('img')).toBeNull()
    expect(Object.keys(hudArtOf(artSetFromManifest('v1', { assets: {} }, LAUNCH_CATALOG)))).toEqual([])
  })

  it('a sized icon still wins over the plain element one (War has both)', () => {
    render(<HudArtContext.Provider value={{ 'icon.war': sprite('plain.png'), 'icon.war.32': sprite('big.png') }}><Icon name="war" size={32} /></HudArtContext.Provider>)
    expect(document.querySelector('img')).toHaveAttribute('src', '/art/v1/big.png')
  })

  it('a sprite with no file yet is not drawn', () => {
    render(<HudArtContext.Provider value={{ 'icon.flame': { ...sprite('x.png'), src: '' } }}><Icon name="flame" /></HudArtContext.Provider>)
    expect(document.querySelector('svg[data-icon="flame"]')).not.toBeNull()
  })
})

describe('Stars', () => {
  it('uses ui.star and ui.star.empty, and the glyphs without them', () => {
    const { unmount } = render(<HudArtContext.Provider value={{ 'ui.star': sprite('s.png'), 'ui.star.empty': sprite('e.png') }}><Stars filled={1} total={3} /></HudArtContext.Provider>)
    expect(screen.getByLabelText('1 stars').querySelectorAll('img')).toHaveLength(3)
    unmount()
    render(<Stars filled={2} total={3} />)
    expect(screen.getByLabelText('2 stars')).toHaveTextContent('★★☆')
  })
})

describe('hudSkin and the battle ui', () => {
  it('sets a class and a variable per battle piece the manifest has, and nothing for the rest', () => {
    const none = hudSkin({})
    expect(none.className).toBe('')
    const skin = hudSkin({ 'ui.battle.hpFrame': sprite('hp.png'), 'ui.battle.turn': sprite('turn.png') })
    expect(skin.className.split(' ').sort()).toEqual(['skin-battle-hp', 'skin-battle-turn'])
    expect(skin.style['--ui-battle-hp']).toBe('url("/art/v1/hp.png")')
    expect(skin.style['--ui-battle-move']).toBeUndefined()
  })
})

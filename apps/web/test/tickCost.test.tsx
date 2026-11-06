import { DEFAULT_PRESET, LAUNCH_CATALOG, newPlayer } from '@wyrmhaven/game-core'
import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import type { Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { FALLBACK_ART } from '../src/art/slots'
import { createBridge } from '../src/game/bridge'
import { buildIslandModel, objectSignature } from '../src/game/islandModel'
import { Hud } from '../src/hud/Hud'
import * as IconModule from '../src/hud/Icon'
import { ME_KEY } from '../src/state/me'
import { ShopPanel } from '../src/panels/ShopPanel'
import { ToastProvider } from '../src/ui/Toast'
import { harness } from './harness'

/** Counts every time a parent renders an icon, past the icon's own memo. */
const counter = vi.hoisted(() => ({ renders: 0, buttons: 0, marks: 0 }))
vi.mock('../src/ui/Panel', async original => {
  const actual = await original<typeof import('../src/ui/Panel')>()
  return { ...actual, ActionButton: (props: ComponentProps<typeof actual.ActionButton>) => { counter.buttons++; return <actual.ActionButton {...props} /> } }
})
vi.mock('../src/hud/Icon', async original => {
  const actual = await original<typeof import('../src/hud/Icon')>()
  return { ...actual, Icon: (props: ComponentProps<typeof actual.Icon>) => { counter.renders++; return <actual.Icon {...props} /> } }
})

vi.mock('../src/hud/ArtMark', async original => {
  const actual = await original<typeof import('../src/hud/ArtMark')>()
  return { ...actual, ArtMark: (props: ComponentProps<typeof actual.ArtMark>) => { counter.marks++; return <actual.ArtMark {...props} /> } }
})

function hud(gold: number) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const setMe = (g: number) => qc.setQueryData(ME_KEY, { playerId: 'p1', address: '0xabc', state: { ...newPlayer(0), gold: g }, balanceWei: 0n, earningUnlocked: false, banned: false })
  setMe(gold)
  sessionStore.set({ token: 't', playerId: 'p1', address: '0xabc' })
  const bridge = createBridge()
  const onOpen = vi.fn()
  const wrap = (ui: ReactNode) => <QueryClientProvider client={qc}><ApiProvider api={{} as Api}><ToastProvider>{ui}</ToastProvider></ApiProvider></QueryClientProvider>
  const at = (nowMs: number) => wrap(<Hud bridge={bridge} nowMs={nowMs} open={null} onOpen={onOpen} placing={false} />)
  return { at, setMe, bridge }
}

describe('the 1 s clock tick costs the HUD next to nothing', () => {
  beforeEach(() => { counter.renders = 0 })

  it('renders none of its menus or pills again on a tick', () => {
    const { at } = hud(100)
    const { rerender } = render(at(10_000))
    expect(counter.renders).toBeGreaterThan(0)
    counter.renders = 0
    rerender(at(11_000))
    rerender(at(12_000))
    expect(counter.renders).toBe(0)
  })

  it('does not render the zoom slider again on a tick, only on a zoom event', () => {
    const { at, bridge } = hud(100)
    bridge.zoom = { zoom: 2, min: 1, max: 4 }
    const { rerender, container } = render(at(10_000))
    expect(container.querySelector('input[aria-label="Zoom"]')).not.toBeNull()
    counter.marks = 0
    rerender(at(11_000))
    rerender(at(12_000))
    expect(counter.marks).toBe(0)
    act(() => { bridge.zoom = { zoom: 3, min: 1, max: 4 }; bridge.emit({ type: 'zoom' }) })
    expect(counter.marks).toBeGreaterThan(0)
    expect(container.querySelector('input[aria-label="Zoom"]')).toHaveValue('3')
  })

  it('a resource change still reaches the pills', async () => {
    const { at, setMe } = hud(100)
    const { rerender, container } = render(at(10_000))
    expect(container.querySelector('[aria-label="Gold"]')).toHaveTextContent('100')
    setMe(250)
    rerender(at(10_000))
    await vi.waitFor(() => expect(container.querySelector('[aria-label="Gold"]')).toHaveTextContent('250'))
  })

  it('a placeholder glyph keeps one set of elements, so React does no work on it', () => {
    expect(IconModule.glyphRects('wings')).toBe(IconModule.glyphRects('wings'))
    expect(IconModule.glyphRects('wings')).not.toBe(IconModule.glyphRects('inbox'))
    expect(IconModule.glyphRects('wings')?.length).toBeGreaterThan(0)
  })
})

describe('the open Shop on a clock tick', () => {
  beforeEach(() => { counter.buttons = 0 })

  it('renders no Build row again on a tick, even with a new onPlace each render (as PanelHost passes)', () => {
    const h = harness({ ...newPlayer(0), gold: 500 })
    const { rerender } = h.wrap(<ShopPanel view="home" nowMs={0} onPlace={() => {}} />)
    expect(counter.buttons).toBeGreaterThan(5)
    counter.buttons = 0
    rerender(<ShopPanel view="home" nowMs={1000} onPlace={() => {}} />)
    expect(counter.buttons).toBe(0)
  })

  it('a row still calls the latest onPlace, and a state change still reaches the rows', async () => {
    const h = harness({ ...newPlayer(0), gold: 0 })
    const first = vi.fn()
    const latest = vi.fn()
    const { rerender } = h.wrap(<ShopPanel view="home" nowMs={0} onPlace={first} />)
    expect(document.querySelector('#shop-farm')).toBeDisabled()
    h.setState({ ...newPlayer(0), gold: 50_000, level: 12 })
    await vi.waitFor(() => expect(document.querySelector('#shop-farm')).toBeEnabled())
    rerender(<ShopPanel view="home" nowMs={1000} onPlace={latest} />)
    await userEvent.click(document.querySelector('#shop-farm')!)
    expect(latest).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })
})

describe('objectSignature', () => {
  const objects = buildIslandModel(newPlayer(0), FALLBACK_ART, LAUNCH_CATALOG, 0, 'home', null, DEFAULT_PRESET).objects

  it('ids are unique, the key the scene reuses sprites by', () => {
    expect(new Set(objects.map(o => o.id)).size).toBe(objects.length)
  })

  it('is the same for the same look, and differs for anything the sprite shows or does', () => {
    const o = objects[0]!
    expect(objectSignature({ ...o }, false)).toBe(objectSignature(o, false))
    for (const change of [{ x: o.x + 1 }, { y: o.y + 1 }, { key: 'other' }, { scale: 3 }, { frame: 2 }, { flipX: !o.flipX }, { tint: 'bad' as const }, { minTap: 99 }, { boxAlways: !o.boxAlways }, { target: { kind: 'roost' as const } }, { sprite: { ...o.sprite, fps: o.sprite.fps + 1 } }]) {
      expect(objectSignature({ ...o, ...change }, false), JSON.stringify(change)).not.toBe(objectSignature(o, false))
    }
    expect(objectSignature(o, true)).not.toBe(objectSignature(o, false))
  })

  it('ignores the badge, which is drawn as its own object', () => {
    const o = objects[0]!
    expect(objectSignature({ ...o, badge: '1m' }, false)).toBe(objectSignature({ ...o, badge: '2m' }, false))
  })
})

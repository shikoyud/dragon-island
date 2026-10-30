import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import type { PlayerState } from '@wyrmhaven/game-core'
import type { GameInfo } from '@wyrmhaven/shared'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import type { Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { ME_KEY } from '../src/state/me'
import { ToastProvider } from '../src/ui/Toast'
import type { Bridge } from '../src/game/bridge'
import type { DialogKey } from '../src/hud/Hud'
import { PanelHost, useDialog } from '../src/panels/PanelHost'

/** Renders panels against a fake API whose /me state can be swapped mid-test with `setState`. */
export function harness(state: PlayerState, nowMs = 0, preset?: 'flash14' | 'flash28', game?: Partial<GameInfo>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const setMe = (s: PlayerState) =>
    qc.setQueryData(ME_KEY, { playerId: 'p1', address: '0xabc', state: s, balanceWei: 10n ** 18n * 5n, earningUnlocked: false, banned: false, ...(preset || game ? { game: { ...(preset ? { preset } : {}), ...game } } : {}) })
  setMe(state)
  sessionStore.set({ token: 't', playerId: 'p1', address: '0xabc' })
  const action = vi.fn(async () => ({ state, effects: [] }))
  const api = { action } as unknown as Api
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  )
  const wrap = (ui: ReactNode) => render(ui, { wrapper })
  const setState = (s: PlayerState) => act(() => { setMe(s) })
  return { wrap, wrapper, action, nowMs, setState }
}

/** The App's dialog wiring for panel tests: island clicks on `bridge` open their panel, like the real game. */
export function TestHost({ bridge, initial = null }: { bridge: Bridge; initial?: DialogKey | null }) {
  const [dialog, setDialog] = useDialog(bridge, initial)
  return <PanelHost bridge={bridge} nowMs={0} dialog={dialog} onOpen={setDialog} />
}

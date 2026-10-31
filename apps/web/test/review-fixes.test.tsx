import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { ApiError, type Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { VaultProvider, type VaultAdapter } from '../src/chain/vault'
import { ShopPanel } from '../src/panels/ShopPanel'
import { WalletPanel } from '../src/panels/WalletPanel'
import { useAction } from '../src/state/actions'
import { useBattle } from '../src/state/battle'
import { ME_KEY, useMe } from '../src/state/me'
import { ToastProvider } from '../src/ui/Toast'
import { WalletProvider, type WalletAdapter } from '../src/wallet/WalletProvider'

const E18 = 10n ** 18n
const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const
const OTHER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as const

function harness(state: PlayerState, api: Record<string, unknown>, wallet?: WalletAdapter, vault?: VaultAdapter) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(ME_KEY, { playerId: 'p1', address: ADDRESS, state, balanceWei: 20n * E18, earningUnlocked: false, banned: false })
  sessionStore.set({ token: 't', playerId: 'p1', address: ADDRESS })
  const w: WalletAdapter = wallet ?? { address: ADDRESS, chainId: 46630, isConnected: true, connect: vi.fn(async () => {}), switchChain: vi.fn(async () => {}), signMessage: vi.fn(async () => '0x' as const) }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><ApiProvider api={api as unknown as Api}><ToastProvider><WalletProvider adapter={w}>{vault ? <VaultProvider adapter={vault}>{children}</VaultProvider> : children}</WalletProvider></ToastProvider></ApiProvider></QueryClientProvider>
  )
  return { qc, wrapper, render: (ui: ReactNode) => render(ui, { wrapper }) }
}

describe('C1: action errors surface as toasts from any panel', () => {
  it('shows one mapped toast and does not reject when a real panel action fails', async () => {
    const api = { action: vi.fn(async () => { throw new ApiError(402, 'INSUFFICIENT_TOKENS') }) }
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const h = harness(newPlayer(0), api)
    h.render(<ShopPanel tab="store" nowMs={0} view="home" onPlace={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /food pack/i }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toHaveTextContent(/not enough tokens/i)
    await new Promise(r => setTimeout(r, 0))
    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
  })

  it('run resolves to null on a server error instead of throwing', async () => {
    const api = { action: vi.fn(async () => { throw new ApiError(422, 'PLOT_BUSY') }) }
    const h = harness(newPlayer(0), api)
    const { result } = renderHook(() => useAction(), { wrapper: h.wrapper })
    let out: unknown = 'unset'
    await act(async () => { out = await result.current.run({ type: 'harvest', plot: 0 }) })
    expect(out).toBeNull()
    expect(result.current.error?.code).toBe('PLOT_BUSY')
  })
})

describe('I2/I8: money effects refresh /me and in-flight refetches cannot clobber newer state', () => {
  it('invalidates /me after a charge or payout effect', async () => {
    const me = vi.fn(async () => ({ playerId: 'p1', address: ADDRESS, state: { ...newPlayer(0), food: 1_100 }, balanceWei: '10000000000000000000', earningUnlocked: false, banned: false }))
    const api = { action: vi.fn(async () => ({ state: { ...newPlayer(0), food: 1_100 }, effects: [{ type: 'charge', microUsd: 500_000 }] })), me }
    const h = harness(newPlayer(0), api)
    const { result } = renderHook(() => ({ action: useAction(), me: useMe() }), { wrapper: h.wrapper }) // a mounted /me observer, as in the app
    await act(async () => { await result.current.action.run({ type: 'buy', item: { kind: 'foodPack' } }) })
    await waitFor(() => expect(me).toHaveBeenCalled())
  })

  it('cancels an in-flight /me fetch before applying the action state', async () => {
    let resolveMe!: (v: unknown) => void
    const me = vi.fn(() => new Promise(r => { resolveMe = r }))
    const api = { action: vi.fn(async () => ({ state: { ...newPlayer(0), gold: 1_020 }, effects: [] })), me }
    const h = harness(newPlayer(0), api)
    void h.qc.fetchQuery({ queryKey: ME_KEY, queryFn: () => (api.me as () => Promise<unknown>)() }).catch(() => {})
    const { result } = renderHook(() => useAction(), { wrapper: h.wrapper })
    await act(async () => { await result.current.run({ type: 'collectGold', habitatId: 'h1' }) })
    resolveMe({ playerId: 'p1', address: ADDRESS, state: newPlayer(0), balanceWei: 0n, earningUnlocked: false, banned: false })
    await new Promise(r => setTimeout(r, 10))
    expect((h.qc.getQueryData(ME_KEY) as { state: PlayerState }).state.gold).toBe(1_020)
  })
})

describe('C2/I1: deposit step machine, receipt waits and account guard', () => {
  function minedVault() {
    let allowance = 0n
    let resolveMined!: () => void
    const mined = new Promise<void>(r => { resolveMined = r })
    const v: VaultAdapter = {
      configured: true, entryFeeWei: 1n, walletBalanceWei: 100n * E18, allowanceWei: 0n, remainingPayoutWei: 50n * E18,
      enter: vi.fn(async () => '0xe' as const),
      approve: vi.fn(async () => '0xa' as const),
      deposit: vi.fn(async () => '0xd' as const),
      claim: vi.fn(async () => '0xc' as const),
      waitForTx: vi.fn(async () => { await mined; return 'success' as const }),
      refetch: vi.fn(async () => { v.allowanceWei = allowance }),
    }
    return { v, mine: () => { allowance = 1_000n * E18; resolveMined() } }
  }

  it('disables the button while a step is in flight and only advances to Deposit once mined', async () => {
    const { v, mine } = minedVault()
    const h = harness(newPlayer(0), {}, undefined, v)
    h.render(<WalletPanel />)
    await userEvent.type(screen.getByLabelText(/deposit amount/i), '10')
    const approve = screen.getByRole('button', { name: /approve/i })
    await userEvent.click(approve)
    expect(v.approve).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('button', { name: /approving|approve/i })).toBeDisabled())
    await userEvent.click(screen.getByRole('button', { name: /approving|approve/i }))
    expect(v.approve).toHaveBeenCalledTimes(1) // no double submit
    expect(screen.getByRole('button', { name: /^deposit/i })).toBeDisabled() // step 2 visible but locked
    await act(async () => { mine() })
    await waitFor(() => expect(screen.getByRole('button', { name: /^deposit/i })).toBeEnabled())
    expect(v.waitForTx).toHaveBeenCalledWith('0xa')
  })

  it('refuses chain actions when the connected wallet is not the signed-in account', async () => {
    const { v } = minedVault()
    const other: WalletAdapter = { address: OTHER, chainId: 46630, isConnected: true, connect: vi.fn(async () => {}), switchChain: vi.fn(async () => {}), signMessage: vi.fn(async () => '0x' as const) }
    const h = harness(newPlayer(0), {}, other, v)
    h.render(<WalletPanel />)
    expect(screen.getByRole('alert')).toHaveTextContent(/differs from the signed-in account/i)
    await userEvent.type(screen.getByLabelText(/deposit amount/i), '1')
    for (const b of screen.getAllByRole('button', { name: /approve|^deposit|^enter/i })) expect(b).toBeDisabled()
  })
})

describe('I4: a finished battle cannot be submitted twice', () => {
  it('disables Submit and Undo after a result', async () => {
    const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
    const s8: PlayerState = { ...newPlayer(0), level: 8, defenceTeam: TEAM, dragons: TEAM.map(id => ({ id, speciesId: 'flame', level: 20, feeds: 0, habitatId: 'h1' })) }
    const api = { action: vi.fn(async () => ({ state: s8, effects: [], battle: { ok: true, winner: 'attacker', turns: 1, log: [], attacker: [1, 1, 1], defender: [0, 0, 0], attackerKos: 0 } })) }
    const h = harness(s8, api)
    const { result } = renderHook(() => useBattle(), { wrapper: h.wrapper })
    act(() => result.current.startPve(1, TEAM))
    act(() => result.current.choose({ kind: 'attack', move: 0 }))
    expect(result.current.canSubmit).toBe(true)
    await act(async () => { await result.current.submit() })
    expect(result.current.canSubmit).toBe(false)
    expect(result.current.canUndo).toBe(false)
  })
})

import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { ToastProvider } from '../src/ui/Toast'
import type { Api } from '../src/api/client'
import { sessionStore } from '../src/api/session'
import { VaultProvider, type VaultAdapter } from '../src/chain/vault'
import { WalletPanel } from '../src/panels/WalletPanel'
import { ME_KEY } from '../src/state/me'
import { WalletProvider, type WalletAdapter } from '../src/wallet/WalletProvider'

const E18 = 10n ** 18n
const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const

function vault(overrides: Partial<VaultAdapter> = {}): VaultAdapter {
  return {
    configured: true,
    entryFeeWei: 500_000_000_000_000n,
    walletBalanceWei: 100n * E18,
    allowanceWei: 0n,
    remainingPayoutWei: 50n * E18,
    enter: vi.fn(async () => '0xtx1' as const),
    approve: vi.fn(async () => '0xtx2' as const),
    deposit: vi.fn(async () => '0xtx3' as const),
    claim: vi.fn(async () => '0xtx4' as const),
    waitForTx: vi.fn(async () => 'success' as const),
    refetch: vi.fn(async () => {}),
    ...overrides,
  }
}
const wallet = (chainId = 46630): WalletAdapter => ({
  address: ADDRESS, chainId, isConnected: true, connect: vi.fn(async () => {}), switchChain: vi.fn(async () => {}), signMessage: vi.fn(async () => '0x' as const),
})

function harness(state: PlayerState, apiOverrides: Partial<Api> = {}, v = vault(), w = wallet(), earningUnlocked = false, balanceWei = 20n * E18) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(ME_KEY, { playerId: 'p1', address: ADDRESS, state, balanceWei, earningUnlocked, banned: false })
  sessionStore.set({ token: 't', playerId: 'p1', address: ADDRESS })
  let issued: { voucherId: string; cumulativeWei: bigint; grossWei: bigint; deadlineMs: number; signature: `0x${string}` } | null = null
  const api = {
    action: vi.fn(async () => ({ state, effects: [] })),
    withdraw: vi.fn(async (g: bigint) => (issued = { voucherId: 'v1', cumulativeWei: g, grossWei: g, deadlineMs: 3_600_000, signature: '0xsig' })),
    pendingWithdraw: vi.fn(async () => ({ voucher: issued })),
    ...apiOverrides,
  } as unknown as Api
  const wrap = (ui: ReactNode) => render(
    <QueryClientProvider client={qc}><ApiProvider api={api}><ToastProvider><WalletProvider adapter={w}><VaultProvider adapter={v}>{ui}</VaultProvider></WalletProvider></ToastProvider></ApiProvider></QueryClientProvider>,
  )
  return { wrap, api, v }
}

describe('WalletPanel', () => {
  it('disables chain actions on the wrong network and when unconfigured', async () => {
    const { wrap } = harness(newPlayer(0), {}, vault(), wallet(1))
    wrap(<WalletPanel />)
    expect(screen.getByRole('alert')).toHaveTextContent(/switch to robinhood chain testnet/i)
    expect(screen.getByRole('button', { name: /enter/i })).toBeDisabled()
    cleanup()
    const h2 = harness(newPlayer(0), {}, vault({ configured: false }))
    h2.wrap(<WalletPanel />)
    expect(screen.getAllByText(/vault address is not configured/i).length).toBeGreaterThan(0)
  })

  it('walks through approve then deposit, and never sends more than the wallet holds', async () => {
    const { wrap, v } = harness(newPlayer(0))
    wrap(<WalletPanel />)
    const amount = screen.getByLabelText(/deposit amount/i)
    await userEvent.clear(amount)
    await userEvent.type(amount, '10')
    const btn = screen.getByRole('button', { name: /^approve/i })
    expect(btn).toBeEnabled()
    expect(screen.getByText(/credited 9\.8 DRIS/i)).toBeInTheDocument()
    await userEvent.click(btn)
    expect(v.approve).toHaveBeenCalledWith(10n * E18)
    await userEvent.clear(amount)
    await userEvent.type(amount, '500')
    for (const b of screen.getAllByRole('button', { name: /^approve|^deposit/i })) expect(b).toBeDisabled()
    expect(screen.getAllByText(/not enough dris in your wallet/i).length).toBeGreaterThan(0)
  })

  it('shows Deposit once allowance covers the amount, and Enter until earning is unlocked', async () => {
    const { wrap, v } = harness(newPlayer(0), {}, vault({ allowanceWei: 1_000n * E18 }))
    wrap(<WalletPanel />)
    await userEvent.type(screen.getByLabelText(/deposit amount/i), '10')
    await userEvent.click(screen.getByRole('button', { name: /^deposit/i }))
    expect(v.deposit).toHaveBeenCalledWith(10n * E18)
    await userEvent.click(screen.getByRole('button', { name: /^enter/i }))
    expect(v.enter).toHaveBeenCalledWith(500_000_000_000_000n)
    cleanup()
    const h2 = harness(newPlayer(0), {}, vault(), wallet(), true)
    h2.wrap(<WalletPanel />)
    expect(screen.queryAllByRole('button', { name: /^enter/i })).toHaveLength(0)
  })

  it('requests a voucher within the game balance and offers Claim for a pending one', async () => {
    const { wrap, api } = harness(newPlayer(0))
    wrap(<WalletPanel />)
    const amount = screen.getByLabelText(/withdraw amount/i)
    await userEvent.type(amount, '25')
    expect(screen.getByRole('button', { name: /request withdrawal/i })).toBeDisabled()
    await userEvent.clear(amount)
    await userEvent.type(amount, '2')
    await userEvent.click(screen.getByRole('button', { name: /request withdrawal/i }))
    expect(api.withdraw).toHaveBeenCalledWith(2n * E18)
    expect(await screen.findByRole('button', { name: /claim on-chain/i })).toBeEnabled()
    expect(screen.getByText(/re-credited/i)).toBeInTheDocument()
  })
})

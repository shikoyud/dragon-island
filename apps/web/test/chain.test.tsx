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
import { HoardPanel } from '../src/panels/HoardPanel'
import { SeasonPanel } from '../src/panels/SeasonPanel'
import { WalletPanel } from '../src/panels/WalletPanel'
import { Verify } from '../src/pages/Verify'
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
  qc.setQueryData(ME_KEY, { playerId: 'p1', address: ADDRESS, state, balanceWei, earningUnlocked, banned: false, season: { id: 1, startsAtMs: 0, endsAtMs: 14 * 86_400_000, commitHash: '0xcc', revealedSecret: null } })
  sessionStore.set({ token: 't', playerId: 'p1', address: ADDRESS })
  let issued: { voucherId: string; cumulativeWei: bigint; grossWei: bigint; deadlineMs: number; signature: `0x${string}` } | null = null
  const api = {
    action: vi.fn(async () => ({ state, effects: [] })),
    withdraw: vi.fn(async (g: bigint) => (issued = { voucherId: 'v1', cumulativeWei: g, grossWei: g, deadlineMs: 3_600_000, signature: '0xsig' })),
    pendingWithdraw: vi.fn(async () => ({ voucher: issued })),
    sp: vi.fn(async () => ({ seasonId: 1, total: 30, today: 10, cap: 150 })),
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
    expect(screen.getByText(/credited 9\.8 WYRM/i)).toBeInTheDocument()
    await userEvent.click(btn)
    expect(v.approve).toHaveBeenCalledWith(10n * E18)
    await userEvent.clear(amount)
    await userEvent.type(amount, '500')
    for (const b of screen.getAllByRole('button', { name: /^approve|^deposit/i })) expect(b).toBeDisabled()
    expect(screen.getAllByText(/not enough wyrm in your wallet/i).length).toBeGreaterThan(0)
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

describe('HoardPanel', () => {
  it('is locked before entry, then shows the remaining daily limit and sells', async () => {
    const locked = harness(newPlayer(0))
    locked.wrap(<HoardPanel nowMs={0} />)
    expect(screen.getAllByText(/pay the one-time entry fee/i).length).toBeGreaterThan(0)
    cleanup()
    const s = { ...newPlayer(0), hoardLevel: 1, gold: 300_000, eligibleGold: 300_000, level: 5 }
    const { wrap, api } = harness(s, {}, vault(), wallet(), true)
    wrap(<HoardPanel nowMs={0} />)
    expect(screen.getByText(/\$1\.00 left today/i)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/gold to sell/i), '100000')
    expect(screen.getByText(/= \$0\.50/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /sell gold/i }))
    expect(api.action).toHaveBeenCalledWith({ type: 'sellGold', gold: 100_000 }, expect.any(String))
  })
})

describe('SeasonPanel', () => {
  it('shows season, SP and quests', async () => {
    const { wrap } = harness(newPlayer(0))
    wrap(<SeasonPanel nowMs={86_400_000} />)
    expect(await screen.findByText(/30 total/i)).toBeInTheDocument()
    expect(screen.getByText(/10 \/ 150 today/i)).toBeInTheDocument()
    expect(screen.getByText(/13 days left/i)).toBeInTheDocument()
    expect(screen.getByText(/breed once/i)).toBeInTheDocument()
  })
})

describe('Verify page', () => {
  // Vectors produced by the server's seed.ts with S = 0x07 × 32.
  const S = `0x${'07'.repeat(32)}` as const
  const commit = '0x7b062064095a97578a0f0cf535dd321f48f102ebc87a8ca16dd4b4c5fc6c4da8' as const
  const aSeed = '0x285eea5db62dcc549018b61753ba7e5c0709b41c0adeab87c88868243cf2b6aa' as const // p1:5
  const bSeed = '0x34d8c08c39455bdc347c947a6aabdf2f64054b7c99d6e568a2bd0afc0f223c95' as const // battle:offer-9

  it('marks each logged action verified or not after the reveal', async () => {
    const seasonById = vi.fn(async () => ({ id: 1, startsAtMs: 0, endsAtMs: 1, commitHash: commit, revealedSecret: S }))
    const seasonActions = vi.fn(async () => ({ actions: [
      { nonce: '5', seedHex: aSeed, seedLabel: 'p1:5', action: { type: 'collectGold', habitatId: 'h1' }, status: 200, createdAtMs: 600_000 },
      { nonce: '6', seedHex: bSeed, seedLabel: 'battle:offer-9', action: { type: 'pveBattle', stage: 1 }, status: 200, createdAtMs: 601_000 },
      { nonce: '7', seedHex: `0x${'ff'.repeat(32)}`, seedLabel: 'p1:7', action: { type: 'buyFarmPlot' }, status: 200, createdAtMs: 602_000 },
    ] }))
    const { wrap } = harness(newPlayer(0), { seasonById, seasonActions } as unknown as Partial<Api>)
    wrap(<Verify seasonId={1} />)
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(4))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('✓')
    expect(rows[1]).toHaveTextContent('✓')
    expect(rows[2]).toHaveTextContent('✗')
    expect(screen.getByText(/commit matches the revealed secret/i)).toBeInTheDocument()
  })

  it('explains when the secret is not yet revealed', async () => {
    const seasonById = vi.fn(async () => ({ id: 1, startsAtMs: 0, endsAtMs: 1, commitHash: '0xcc', revealedSecret: null }))
    const { wrap } = harness(newPlayer(0), { seasonById, seasonActions: vi.fn(async () => ({ actions: [] })) } as unknown as Partial<Api>)
    wrap(<Verify seasonId={1} />)
    expect(await screen.findByText(/secret not yet revealed/i)).toBeInTheDocument()
  })
})

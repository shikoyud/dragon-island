import { newPlayer } from '@wyrmhaven/game-core'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from '../src/panels/SettingsPanel'
import { WalletProvider, type WalletAdapter } from '../src/wallet/WalletProvider'
import { VaultProvider, type VaultAdapter } from '../src/chain/vault'
import { harness } from './harness'

const v = { configured: false, entryFeeWei: null, walletBalanceWei: null, allowanceWei: null, remainingPayoutWei: null } as unknown as VaultAdapter

const w: WalletAdapter = { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', chainId: 46630, isConnected: true, connect: vi.fn(async () => {}), switchChain: vi.fn(async () => {}), signMessage: vi.fn(async () => '0x' as const) }

describe('Settings tabs (UI rework Phase 3)', () => {
  const DAY = 86_400_000
  it('Account holds the Finals countdown, speed-ups and Sign out; Wallet holds deposit and withdraw', async () => {
    harness({ ...newPlayer(0), speedUps: { '15m': 2, '1h': 0, '3h': 1 } }).wrap(
      <WalletProvider adapter={w}><VaultProvider adapter={v}><SettingsPanel onClose={vi.fn()} nowMs={10 * DAY + 3_600_000} game={{ launchAtMs: 0, preset: 'flash14' }} /></VaultProvider></WalletProvider>)
    const frame = screen.getByRole('region', { name: 'Settings' })
    expect(within(frame).getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true')
    const account = screen.getByRole('tabpanel', { name: 'Account' })
    expect(within(account).getByRole('timer', { name: 'Terminal countdown' })).toHaveTextContent('Finals lock in 3d 23:00:00')
    expect(account).toHaveTextContent('Speed-ups')
    await userEvent.click(within(frame).getByRole('tab', { name: 'Wallet' }))
    const wallet = screen.getByRole('tabpanel', { name: 'Wallet' })
    expect(within(wallet).getByText(/game balance/i)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Wallet' })).toBeNull() // one frame, not a dialog in a dialog
  })
  it('opens on Wallet from the $DRIS plus', () => {
    harness(newPlayer(0)).wrap(<WalletProvider adapter={w}><VaultProvider adapter={v}><SettingsPanel onClose={vi.fn()} nowMs={0} tab="wallet" /></VaultProvider></WalletProvider>)
    expect(screen.getByRole('tab', { name: 'Wallet' })).toHaveAttribute('aria-selected', 'true')
  })
})

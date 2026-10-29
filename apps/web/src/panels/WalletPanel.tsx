import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from '../api/ApiProvider'
import { ApiError } from '../api/client'
import { messageFor } from '../api/errors'
import { useSession } from '../api/session'
import { depositCredited, parseTokenAmount, useVault } from '../chain/vault'
import { ME_KEY, useMe } from '../state/me'
import { formatWei, Tokens } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { TARGET_CHAIN_ID } from '../wallet/SignIn'
import { useWallet } from '../wallet/WalletProvider'

const EXPLORER = 'https://explorer.testnet.chain.robinhood.com/tx/'

type Step = 'enter' | 'approve' | 'deposit' | 'claim'

/** Enter (one-time fee), deposit (approve → deposit), withdraw (voucher → claim). */
export function WalletPanel({ onClose }: { onClose?: () => void }) {
  const api = useApi()
  const qc = useQueryClient()
  const me = useMe()
  const session = useSession()
  const wallet = useWallet()
  const vault = useVault()
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [tx, setTx] = useState<string | null>(null)
  const [busy, setBusy] = useState<Step | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const pending = useQuery({ queryKey: ['withdraw', 'pending'], queryFn: () => api.pendingWithdraw() })
  const wrongChain = wallet.chainId !== TARGET_CHAIN_ID
  const wrongAccount = Boolean(wallet.address && session && wallet.address.toLowerCase() !== session.address.toLowerCase())
  const chainReason = !vault.configured ? 'The vault address is not configured for this build'
    : wrongChain ? 'Switch to Robinhood Chain testnet'
    : wrongAccount ? 'The connected wallet differs from the signed-in account; sign out and sign in with it'
    : undefined
  const busyReason = busy ? 'Waiting for the previous transaction' : undefined

  /** One on-chain step: send, wait for the receipt, then refresh chain reads and /me. Buttons stay locked meanwhile. */
  const send = async (step: Step, label: string, fn: () => Promise<`0x${string}`>) => {
    if (busy) return
    setBusy(step)
    setErr(null)
    try {
      const hash = await fn()
      setTx(hash)
      const status = await vault.waitForTx(hash)
      if (status === 'reverted') setErr(`${label} reverted on-chain`)
      await vault.refetch()
      void qc.invalidateQueries({ queryKey: ME_KEY })
      void qc.invalidateQueries({ queryKey: ['withdraw'] })
    } catch (e) {
      setErr(`${label} failed: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const depositWei = parseTokenAmount(depositInput)
  const needApprove = depositWei !== null && (vault.allowanceWei ?? 0n) < depositWei
  const amountReason = chainReason ?? busyReason
    ?? (depositWei === null || depositWei === 0n ? 'Enter an amount' : vault.walletBalanceWei !== null && depositWei > vault.walletBalanceWei ? 'Not enough DRIS in your wallet' : undefined)
  const approveReason = amountReason ?? (needApprove ? undefined : 'Already approved')
  const depositReason = amountReason ?? (needApprove ? 'Approve first' : undefined)

  const withdrawWei = parseTokenAmount(withdrawInput)
  const gameBalance = me.data?.balanceWei ?? 0n
  const withdrawReason = withdrawWei === null || withdrawWei === 0n ? 'Enter an amount' : withdrawWei > gameBalance ? 'Not enough in your game balance' : pending.data?.voucher ? 'Claim or wait for your pending voucher first' : undefined
  const requestWithdrawal = useMutation({
    mutationFn: (wei: bigint) => api.withdraw(wei),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['withdraw'] }); void qc.invalidateQueries({ queryKey: ME_KEY }) },
    onError: e => setErr(e instanceof ApiError ? messageFor(e.code) : String(e)),
  })

  return (
    <Panel title="Wallet" onClose={onClose}>
      {chainReason && <p role="alert">{chainReason}.</p>}
      <p>Wallet: {vault.walletBalanceWei !== null ? <Tokens wei={vault.walletBalanceWei} /> : '—'} · Game balance: <Tokens wei={gameBalance} /></p>

      {!me.data?.earningUnlocked && (
        <section aria-label="Enter" style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: 12 }}>Unlock earning</h3>
          <p><small>A one-time entry fee of about $1 in ETH ({vault.entryFeeWei !== null ? `${formatWei(vault.entryFeeWei)} ETH` : '…'}) unlocks gold sell-back, Season Points and prizes.</small></p>
          <ActionButton id="enter" primary disabled={Boolean(chainReason ?? busyReason) || vault.entryFeeWei === null} reason={chainReason ?? busyReason ?? 'Loading fee'} onClick={() => vault.entryFeeWei !== null && void send('enter', 'Enter', () => vault.enter(vault.entryFeeWei!))}>
            {busy === 'enter' ? 'Entering…' : 'Enter · pay the fee'}
          </ActionButton>
        </section>
      )}

      <section aria-label="Deposit" style={{ marginTop: 12 }}>
        <h3 style={{ fontSize: 12 }}>Deposit DRIS</h3>
        <label>Deposit amount <input value={depositInput} onChange={e => setDepositInput(e.target.value)} inputMode="decimal" placeholder="0.0" disabled={busy !== null} /></label>
        {depositWei !== null && depositWei > 0n && <p><small>2% fee: credited {formatWei(depositCredited(depositWei))} DRIS to your game balance.</small></p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton id="approve" primary={needApprove} disabled={Boolean(approveReason)} reason={approveReason} onClick={() => depositWei !== null && void send('approve', 'Approve', () => vault.approve(depositWei))}>
            {busy === 'approve' ? 'Approving…' : 'Approve (step 1 of 2)'}
          </ActionButton>
          <ActionButton id="deposit" primary={!needApprove} disabled={Boolean(depositReason)} reason={depositReason} onClick={() => depositWei !== null && void send('deposit', 'Deposit', () => vault.deposit(depositWei))}>
            {busy === 'deposit' ? 'Depositing…' : 'Deposit (step 2 of 2)'}
          </ActionButton>
        </div>
      </section>

      <section aria-label="Withdraw" style={{ marginTop: 12 }}>
        <h3 style={{ fontSize: 12 }}>Withdraw DRIS</h3>
        {pending.data?.voucher ? (
          <div>
            <p>Pending voucher: {formatWei(pending.data.voucher.grossWei)} DRIS (5% fee on claim), valid until {new Date(pending.data.voucher.deadlineMs).toLocaleTimeString()}.</p>
            <p><small>If you don’t claim in time, the amount is re-credited to your game balance.</small></p>
            <ActionButton
              id="claim"
              primary
              disabled={Boolean(chainReason ?? busyReason)}
              reason={chainReason ?? busyReason}
              onClick={() => {
                const v = pending.data!.voucher!
                void send('claim', 'Claim', () => vault.claim(v.cumulativeWei, BigInt(Math.floor(v.deadlineMs / 1000)), v.signature))
              }}
            >
              {busy === 'claim' ? 'Claiming…' : 'Claim on-chain'}
            </ActionButton>
          </div>
        ) : (
          <>
            <label>Withdraw amount <input value={withdrawInput} onChange={e => setWithdrawInput(e.target.value)} inputMode="decimal" placeholder="0.0" /></label>
            {vault.remainingPayoutWei !== null && <p><small>Vault can still pay out {formatWei(vault.remainingPayoutWei)} DRIS today; one request takes at most 10%.</small></p>}
            <ActionButton id="withdraw" primary disabled={Boolean(withdrawReason) || requestWithdrawal.isPending} reason={withdrawReason} onClick={() => withdrawWei !== null && requestWithdrawal.mutate(withdrawWei)}>
              Request withdrawal
            </ActionButton>
          </>
        )}
      </section>

      {tx && <p><small>Transaction sent: <a href={`${EXPLORER}${tx}`} target="_blank" rel="noreferrer">{tx.slice(0, 10)}…</a>{busy ? ' · waiting for confirmation' : ''}</small></p>}
      {err && <p role="alert" style={{ color: 'var(--danger)' }}>{err}</p>}
    </Panel>
  )
}

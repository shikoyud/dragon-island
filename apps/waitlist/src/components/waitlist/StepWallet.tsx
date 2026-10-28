'use client'

import { useState } from 'react'
import { useAccount, useDisconnect, useSignMessage } from 'wagmi'
import { walletMessage } from '../../domain/walletMessage'
import { openWalletModal, walletConfigured } from '../../wallet/config'
import { isError, post } from './api'

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

function errorText(code: string): string {
  switch (code) {
    case 'WALLET_TAKEN':
      return 'This wallet is already linked to another X account. Try a different wallet.'
    case 'NONCE_INVALID':
    case 'INVALID_SIGNATURE':
      return 'The signature check failed. Please sign again.'
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a minute, then try again.'
    case 'REJECTED':
      return 'The signature request was cancelled in your wallet.'
    default:
      return 'Could not link this wallet. Please try again.'
  }
}

export function StepWallet({
  handle,
  onDone,
  onExpired,
}: {
  handle: string
  onDone(): Promise<void>
  /** Called before onDone when the server no longer accepts the session. */
  onExpired(): void
}) {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { disconnect } = useDisconnect()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  /** Errors that mean the panel's step is stale: re-resolve it from /api/me instead of dead-ending here. */
  async function recover(code: string): Promise<boolean> {
    if (code === 'UNAUTHORIZED') onExpired()
    else if (code !== 'BAD_REQUEST') return false
    await onDone()
    return true
  }

  async function sign() {
    if (!address) return
    setBusy(true)
    setErr(null)
    try {
      const nonceRes = await fetch('/api/wallet/nonce', { credentials: 'same-origin', cache: 'no-store' })
      const nonceBody = (await nonceRes.json().catch(() => ({}))) as { nonce?: string; error?: string }
      if (!nonceRes.ok || !nonceBody.nonce) {
        const code = nonceBody.error ?? 'NETWORK'
        if (!(await recover(code))) setErr(errorText(code))
        return
      }
      let signature: string
      try {
        signature = await signMessageAsync({ message: walletMessage(handle, address, nonceBody.nonce) })
      } catch {
        setErr(errorText('REJECTED'))
        return
      }
      const res = await post<{ wallet: string }>('/api/wallet', { address, signature, nonce: nonceBody.nonce })
      if (isError(res)) {
        if (!(await recover(res.error))) setErr(errorText(res.error))
        return
      }
      await onDone()
    } catch {
      setErr(errorText('NETWORK'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="step">
      <h3 className="step-title">Link your wallet</h3>
      <p className="step-text">
        Connect an EVM wallet and sign one message to prove it is yours. Signing is free: no gas and no transaction.
      </p>
      {!walletConfigured ? (
        <p className="notice notice-warn" role="alert">
          Wallet connection isn&apos;t available right now. Please check back soon.
        </p>
      ) : isConnected && address ? (
        <div className="wallet-row">
          <span className="wallet-addr">{short(address)}</span>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void sign()}>
            {busy ? 'Check your wallet…' : 'Sign message'}
          </button>
          <button type="button" className="btn-link" onClick={() => disconnect()}>
            Use another wallet
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={openWalletModal}>
          Connect wallet
        </button>
      )}
      {err ? (
        <p className="notice notice-warn" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  )
}

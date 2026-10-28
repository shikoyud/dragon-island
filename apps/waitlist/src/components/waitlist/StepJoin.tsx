'use client'

import { useState } from 'react'
import { isError, post } from './api'

export function StepJoin({ wallet, onDone }: { wallet: string; onDone(): Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function join() {
    setBusy(true)
    setErr(null)
    const res = await post<{ position: number }>('/api/join')
    if (isError(res) && res.error === 'RATE_LIMITED') setErr('Too many attempts. Wait a minute, then try again.')
    else if (isError(res) && res.error !== 'TASKS_INCOMPLETE' && res.error !== 'WALLET_REQUIRED')
      setErr('Could not join right now. Please try again.')
    // On success, or when a step turns out to be incomplete, the refreshed state picks the right step.
    await onDone()
    setBusy(false)
  }

  return (
    <div className="step">
      <h3 className="step-title">Claim your spot</h3>
      <p className="step-text">
        Tasks done and wallet <span className="wallet-addr">{`${wallet.slice(0, 6)}…${wallet.slice(-4)}`}</span>{' '}
        linked. Join to get your waitlist number and your card.
      </p>
      <button type="button" className="btn btn-primary btn-big" disabled={busy} onClick={() => void join()}>
        {busy ? 'Joining…' : 'Join the waitlist'}
      </button>
      {err ? (
        <p className="notice notice-warn" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  )
}

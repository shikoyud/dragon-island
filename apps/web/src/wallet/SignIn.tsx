import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createSiweMessage } from 'viem/siwe'
import { useApi } from '../api/ApiProvider'
import { ApiError } from '../api/client'
import { sessionStore, useSession } from '../api/session'
import { ME_KEY } from '../state/me'
import { useWallet } from './WalletProvider'

export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 46630)

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Connect → (switch network) → Sign in with Ethereum → session. */
export function SignIn() {
  const api = useApi()
  const wallet = useWallet()
  const session = useSession()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    if (!wallet.address) return
    setBusy(true)
    setError(null)
    try {
      const { nonce } = await api.nonce()
      const message = createSiweMessage({
        address: wallet.address,
        chainId: TARGET_CHAIN_ID,
        domain: location.host,
        uri: location.origin,
        nonce,
        version: '1',
        statement: 'Sign in to Dragon Island. This costs no gas.',
      })
      let signature: `0x${string}`
      try {
        signature = await wallet.signMessage(message)
      } catch {
        setError('Signature rejected.')
        return
      }
      const v = await api.verify(message, signature)
      sessionStore.set({ token: v.token, playerId: v.playerId, address: v.address })
      await qc.invalidateQueries({ queryKey: ME_KEY })
    } catch (e) {
      setError(e instanceof ApiError ? 'Sign-in failed. Please try again.' : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    try { await api.logout() } catch { /* already gone */ }
    sessionStore.clear()
    qc.removeQueries({ queryKey: ME_KEY })
  }

  if (session) {
    return (
      <div className="signin" data-state="signed-in">
        <span className="signin__address" title={session.address}>{shortAddress(session.address)}</span>
        <button type="button" className="btn btn--ghost" onClick={signOut}>Sign out</button>
      </div>
    )
  }

  if (!wallet.isConnected || !wallet.address) {
    return (
      <div className="signin" data-state="disconnected">
        <button type="button" className="btn" onClick={() => void wallet.connect()}>Connect wallet</button>
      </div>
    )
  }

  if (wallet.chainId !== TARGET_CHAIN_ID) {
    return (
      <div className="signin" data-state="wrong-chain">
        <p>Wrong network.</p>
        <button type="button" className="btn" onClick={() => void wallet.switchChain(TARGET_CHAIN_ID)}>
          Switch to Robinhood Chain testnet
        </button>
      </div>
    )
  }

  return (
    <div className="signin" data-state="connected">
      <span className="signin__address" title={wallet.address}>{shortAddress(wallet.address)}</span>
      <button type="button" className="btn" disabled={busy} onClick={() => void signIn()}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      {error && <p role="alert" className="signin__error">{error}</p>}
    </div>
  )
}

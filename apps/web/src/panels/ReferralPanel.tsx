import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from '../api/ApiProvider'
import { ApiError } from '../api/client'
import { messageFor } from '../api/errors'
import { Tokens } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

/** Spec §16: share your code, earn 5% of what the players you bring in spend; enter someone else's once, before your first purchase. */
export function ReferralPanel({ onClose }: { onClose?: () => void }) {
  const api = useApi()
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['referral', 'me'], queryFn: () => api.referralMe() })
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const claim = useMutation({
    mutationFn: (c: string) => api.claimReferral(c),
    onSuccess: () => { setErr(null); setCode(''); void qc.invalidateQueries({ queryKey: ['referral'] }) },
    onError: e => setErr(e instanceof ApiError ? messageFor(e.code) : String(e)),
  })

  const copy = async () => {
    if (!me.data) return
    try { await navigator.clipboard.writeText(me.data.code); setCopied(true) } catch { setCopied(false) }
  }
  const reason = me.data?.referrer ? 'You already entered a referral code' : code.trim().length === 0 ? 'Enter a code' : undefined

  return (
    <Panel title="Referral" onClose={onClose}>
      {me.data && (
        <>
          <p>Your code: <code style={{ fontSize: 16 }}>{me.data.code}</code> <button type="button" className="btn" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button></p>
          <p><small>{me.data.referredCount} referred · earned <Tokens wei={BigInt(me.data.earnedWei)} />. You get 5% of what they spend, paid to your game balance.</small></p>
        </>
      )}
      <label>Referral code <input value={code} onChange={e => setCode(e.target.value)} placeholder="8 characters" disabled={me.data?.referrer} /></label>
      <ActionButton id="claim-referral" primary disabled={Boolean(reason) || claim.isPending} reason={reason} onClick={() => claim.mutate(code.trim())}>
        Claim code
      </ActionButton>
      <p><small>Codes must be entered before your first purchase.</small></p>
      {err && <p role="alert" style={{ color: 'var(--danger)' }}>{err}</p>}
    </Panel>
  )
}

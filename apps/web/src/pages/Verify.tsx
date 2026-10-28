import { verifyCommit, verifySeed } from '@wyrmhaven/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { Hex } from 'viem'
import { useApi } from '../api/ApiProvider'
import { useSession } from '../api/session'
import { Panel } from '../ui/Panel'

type Row = { nonce: string; label: string; type: string; status: number; ok: boolean | null }

/**
 * Spec §17: after the season's secret is revealed, every logged action's seed is recomputed from
 * `HMAC-SHA256(S, seedLabel)` and the commit is checked against `keccak256(S)`.
 */
export function Verify({ seasonId, onClose }: { seasonId: number; onClose?: () => void }) {
  const api = useApi()
  const session = useSession()
  const season = useQuery({ queryKey: ['season', seasonId], queryFn: () => api.seasonById(seasonId) })
  const actions = useQuery({
    queryKey: ['season', seasonId, 'actions', session?.playerId],
    queryFn: () => api.seasonActions(seasonId, session!.playerId),
    enabled: Boolean(session),
  })
  const [rows, setRows] = useState<Row[] | null>(null)
  const secret = season.data?.revealedSecret ?? null
  const commitOk = season.data && secret ? verifyCommit(season.data.commitHash, secret) : null

  useEffect(() => {
    if (!season.data || !actions.data || !secret) return
    let cancelled = false
    ;(async () => {
      const out: Row[] = []
      for (const a of actions.data.actions) {
        const ok = await verifySeed(season.data!.commitHash, secret, a.seedLabel, a.seedHex as Hex)
        out.push({ nonce: a.nonce, label: a.seedLabel, type: (a.action as { type?: string }).type ?? '?', status: a.status, ok })
      }
      if (!cancelled) setRows(out)
    })()
    return () => { cancelled = true }
  }, [season.data, actions.data, secret])

  return (
    <Panel title={`Verify season ${seasonId}`} onClose={onClose}>
      {season.data && <p><small>Commit <code>{season.data.commitHash}</code></small></p>}
      {season.data && !secret && <p>Secret not yet revealed. Come back after the season ends; then every action below can be re-derived.</p>}
      {commitOk === true && <p role="status">✓ Commit matches the revealed secret.</p>}
      {commitOk === false && <p role="alert">✗ The revealed secret does not match the commit.</p>}
      {rows && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th>#</th><th style={{ textAlign: 'left' }}>Action</th><th style={{ textAlign: 'left' }}>Seed label</th><th>Status</th><th>Seed</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.nonce}>
                <td>{r.nonce}</td><td>{r.type}</td><td><code>{r.label}</code></td><td>{r.status}</td>
                <td aria-label={r.ok ? 'verified' : 'mismatch'}>{r.ok ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p><small>Seeds verified: HMAC-SHA256(secret, label) must equal the logged seed. Replaying each action with game-core and `createRng(first 4 bytes)` reproduces the stored result.</small></p>
    </Panel>
  )
}

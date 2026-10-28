import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/ApiProvider'
import { useMe } from '../state/me'
import { Panel } from '../ui/Panel'

/** Launch quest set (server ruling): breed once +7, harvest three crops +7, win one battle +6. */
export const DAILY_QUESTS = [
  { id: 'breedOnce', label: 'Breed once', points: 7 },
  { id: 'harvestThree', label: 'Harvest three crops', points: 7 },
  { id: 'winOneBattle', label: 'Win one battle', points: 6 },
] as const

export function SeasonPanel({ nowMs, onClose, onVerify }: { nowMs: number; onClose?: () => void; onVerify?: (seasonId: number) => void }) {
  const api = useApi()
  const me = useMe()
  const sp = useQuery({ queryKey: ['sp'], queryFn: () => api.sp() })
  const season = me.data?.season
  if (!season) return null
  const daysLeft = Math.max(0, Math.ceil((season.endsAtMs - nowMs) / 86_400_000))
  return (
    <Panel title={`Season ${season.id}`} onClose={onClose}>
      <p>{daysLeft} days left · ends {new Date(season.endsAtMs).toLocaleDateString()}</p>
      <p><small>Commit: <code>{season.commitHash.slice(0, 18)}…</code> {season.revealedSecret ? '· secret revealed' : '· secret revealed at season end'}</small></p>
      {sp.data && (
        <p>Season Points: <strong>{sp.data.total} total</strong> · {sp.data.today} / {sp.data.cap} today</p>
      )}
      {!me.data?.earningUnlocked && <p><small>Season Points start once you pay the entry fee.</small></p>}
      <h3 style={{ fontSize: 12 }}>Daily quests</h3>
      <ul>
        {DAILY_QUESTS.map(q => <li key={q.id}>{q.label} · +{q.points} SP</li>)}
      </ul>
      <p><small>PvP win vs an eligible opponent +10 (once per opponent per day) · PvE first clear +5</small></p>
      {onVerify && <button type="button" className="btn" onClick={() => onVerify(season.id)}>Verify my season log</button>}
    </Panel>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/ApiProvider'
import { useMe } from '../state/me'
import { Tokens } from '../ui/Money'
import { Panel } from '../ui/Panel'
import { shortAddress } from '../wallet/SignIn'

/** Launch quest set (server ruling): breed once +7, harvest three crops +7, win one battle +6. */
export const DAILY_QUESTS = [
  { id: 'breedOnce', label: 'Breed once', points: 7 },
  { id: 'harvestThree', label: 'Harvest three crops', points: 7 },
  { id: 'winOneBattle', label: 'Win one battle', points: 6 },
] as const

const TOP_SHOWN = 10

export function SeasonPanel({ nowMs, onClose, onVerify }: { nowMs: number; onClose?: () => void; onVerify?: (seasonId: number) => void }) {
  const api = useApi()
  const me = useMe()
  const season = me.data?.season
  const seasonId = season?.id
  const sp = useQuery({ queryKey: ['sp'], queryFn: () => api.sp() })
  const board = useQuery({ queryKey: ['leaderboard', seasonId], queryFn: () => api.leaderboard(seasonId!), enabled: seasonId !== undefined, staleTime: 30_000 })
  const previous = seasonId !== undefined && seasonId > 1 ? seasonId - 1 : null
  const lastPrize = useQuery({ queryKey: ['prize', previous], queryFn: () => api.prizeMe(previous!), enabled: previous !== null })
  if (!season) return null
  const daysLeft = Math.max(0, Math.ceil((season.endsAtMs - nowMs) / 86_400_000))
  const myId = me.data?.playerId

  return (
    <Panel title={`Season ${season.id}`} onClose={onClose}>
      <p>{daysLeft} days left · ends {new Date(season.endsAtMs).toLocaleDateString()}</p>
      <p><small>Commit: <code>{season.commitHash.slice(0, 18)}…</code> {season.revealedSecret ? '· secret revealed' : '· secret revealed at season end'}</small></p>
      {sp.data && (
        <p>Season Points: <strong>{sp.data.total} total</strong> · {sp.data.today} / {sp.data.cap} today</p>
      )}
      {!me.data?.earningUnlocked && <p><small>Season Points start once you pay the entry fee.</small></p>}

      {board.data && (
        <section aria-label="Leaderboard" style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: 12 }}>Leaderboard</h3>
          <p>Prize pool so far: <Tokens wei={BigInt(board.data.poolWei)} /> <small>(30% of what the vault keeps this season)</small></p>
          <p>{board.data.me ? (board.data.me.rank !== null ? `Your rank: #${board.data.me.rank}` : 'Unranked') : ''}{board.data.me ? ` · ${board.data.me.sp} SP` : ''}</p>
          <ol aria-label="Leaderboard" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {board.data.top.slice(0, TOP_SHOWN).map(r => (
              <li key={r.playerId} aria-current={r.playerId === myId ? 'true' : undefined} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: r.playerId === myId ? 700 : 400 }}>
                <span>#{r.rank} {r.playerId === myId ? 'You' : shortAddress(r.address)}</span><span>{r.sp} SP</span>
              </li>
            ))}
          </ol>
          {board.data.top.length === 0 && <p><small>No one has scored yet.</small></p>}
        </section>
      )}
      {lastPrize.data?.prize && (
        <p>Last season: you won <Tokens wei={BigInt(lastPrize.data.prize.wei)} />{lastPrize.data.prize.rank !== null ? ` (rank #${lastPrize.data.prize.rank})` : ''}. It is already in your game balance.</p>
      )}

      <h3 style={{ fontSize: 12 }}>Daily quests</h3>
      <ul>
        {DAILY_QUESTS.map(q => <li key={q.id}>{q.label} · +{q.points} SP</li>)}
      </ul>
      <p><small>PvP win vs an eligible opponent +10 (once per opponent per day) · PvE first clear +5</small></p>
      {onVerify && <button type="button" className="btn" onClick={() => onVerify(season.id)}>Verify my season log</button>}
    </Panel>
  )
}

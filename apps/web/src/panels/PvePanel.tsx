import { PVE_MIN_PLAYER_LEVEL, PVE_REPLAYS_PER_DAY, PVE_STAGES, stageLevel, stageRewards, utcDay, type TeamIds } from '@wyrmhaven/game-core'
import { useState } from 'react'
import { useMe } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

export function PvePanel({ onFight, onClose, nowMs = Date.now() }: { onFight: (stage: number, team: TeamIds) => void; onClose?: () => void; nowMs?: number }) {
  const me = useMe()
  const s = me.data?.state
  const [team, setTeam] = useState<string[]>(() => s?.defenceTeam ?? s?.dragons.slice(0, 3).map(d => d.id) ?? [])
  if (!s) return null
  const locked = s.level < PVE_MIN_PLAYER_LEVEL
  const replaysLeft = s.pve.replays.day === utcDay(nowMs) ? Math.max(0, PVE_REPLAYS_PER_DAY - s.pve.replays.count) : PVE_REPLAYS_PER_DAY
  const teamOk = team.length === 3 && new Set(team).size === 3
  const toggle = (id: string) => setTeam(t => (t.includes(id) ? t.filter(x => x !== id) : t.length < 3 ? [...t, id] : t))

  return (
    <Panel title="Campaign" onClose={onClose}>
      {locked && <p>The campaign unlocks at player level {PVE_MIN_PLAYER_LEVEL}.</p>}
      <p>Cleared {s.pve.cleared}/{PVE_STAGES} · Replays left: {replaysLeft}</p>
      <fieldset>
        <legend>Team (pick 3)</legend>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {s.dragons.map(d => (
            <button key={d.id} type="button" className={`btn ${team.includes(d.id) ? 'btn--primary' : ''}`} aria-pressed={team.includes(d.id)} onClick={() => toggle(d.id)}>
              {d.id} · {d.speciesId} L{d.level}
            </button>
          ))}
        </div>
      </fieldset>
      <ul aria-label="Stages" style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, marginTop: 8 }}>
        {Array.from({ length: PVE_STAGES }, (_, i) => i + 1).map(stage => {
          const cleared = stage <= s.pve.cleared
          const lockedStage = stage > s.pve.cleared + 1
          const reward = stageRewards(stage, !cleared)
          const reason = locked ? `Needs player level ${PVE_MIN_PLAYER_LEVEL}` : lockedStage ? 'Clear the previous stage first' : !teamOk ? 'Pick three dragons' : cleared && replaysLeft === 0 ? 'No replays left today' : ''
          return (
            <li key={stage}>
              <ActionButton id={`stage-${stage}`} disabled={Boolean(reason)} reason={reason} primary={!cleared && !lockedStage} onClick={() => onFight(stage, team as TeamIds)}>
                Stage {stage} · L{stageLevel(stage)}{cleared ? ' ✓' : ''} · {formatGold(reward.gold)} gold{reward.food ? ` · ${formatGold(reward.food)} food` : ''}
              </ActionButton>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

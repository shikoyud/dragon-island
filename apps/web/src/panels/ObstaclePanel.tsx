import { MAX_BUILDERS, OBSTACLES, clearCost, clearReward } from '@wyrmhaven/game-core'
import { timerLabel } from '../game/islandModel'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { ConstructionStatus } from './ConstructionStatus'

/** One obstacle: clear it for gold and a builder slot; it pays XP and food, never gold. */
export function ObstaclePanel({ obstacleId, nowMs, onClose }: { obstacleId: string; nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const s = me.data?.state
  const o = s?.islands.obstacles.find(x => x.id === obstacleId)
  if (!s || !o) return null
  const con = s.constructions.find(c => c.kind === 'clear' && c.obstacleId === o.id)
  const index = con ? s.constructions.indexOf(con) : -1
  const cost = clearCost(o)
  const reward = clearReward(o)
  const reason = s.gold < cost ? 'Not enough gold' : s.constructions.length >= MAX_BUILDERS ? 'Both builders are busy' : ''
  return (
    <Panel title={`Obstacle: ${o.kind}`} onClose={onClose}>
      <p style={{ margin: '4px 0' }}>Reward: +{formatGold(reward.xp * preset.xpMult)} XP, +{formatGold(reward.food)} food</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {con ? (
          <ConstructionStatus index={index} readyAtMs={con.readyAtMs} nowMs={nowMs} id={`clear-${o.id}`} label="Clearing" />
        ) : (
          <ActionButton id={`clear-${o.id}`} disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'clearObstacle', obstacleId: o.id })}>
            Clear · {formatGold(cost)} gold · {timerLabel(OBSTACLES[o.kind].timerMs, 0)}
          </ActionButton>
        )}
      </div>
    </Panel>
  )
}

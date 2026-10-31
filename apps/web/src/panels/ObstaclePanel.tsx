import { OBSTACLES, activeClears, clearCost, clearReward, clearTimerMs, MAX_CLEARS, type ObstacleDrop, type ObstacleKind, type SpeedUpToken } from '@wyrmhaven/game-core'
import { timerLabel } from '../game/islandModel'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { ConstructionStatus } from './ConstructionStatus'

const NAMES: Record<ObstacleKind, string> = {
  ancientTree: 'Ancient Tree', boulder: 'Boulder', largeRock: 'Large Rock', tree: 'Tree', smallRock: 'Small Rock', bush: 'Bush',
}
const TOKEN_NAMES: Record<SpeedUpToken, string> = { '15m': '15 min', '1h': '1 h', '3h': '3 h' }

/** §5.6's bonus drop as the player reads it, e.g. `10 % chance: 3 h speed-up`. */
function dropLabel(d: ObstacleDrop): string {
  const what = 'token' in d ? `${TOKEN_NAMES[d.token]} speed-up`
    : 'gold' in d ? `${formatGold(d.gold[0])}–${formatGold(d.gold[1])} gold`
    : `${formatGold(d.food[0])}–${formatGold(d.food[1])} food`
  return `${d.percent} % chance: ${what}`
}

/** One obstacle: clear it for gold and a clear slot; it pays XP and may drop a bonus. */
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
  const drop = OBSTACLES[o.kind].drop
  const reason = s.gold < cost ? 'Not enough gold' : activeClears(s) >= MAX_CLEARS ? 'Two clears are running' : ''
  return (
    <Panel title={`Obstacle: ${NAMES[o.kind]}`} onClose={onClose}>
      <p style={{ margin: '4px 0' }}>Reward: +{formatGold(reward.xp * preset.xpMult)} XP</p>
      {drop && <p style={{ margin: '4px 0' }}>{dropLabel(drop)}</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {con ? (
          <ConstructionStatus index={index} readyAtMs={con.readyAtMs} nowMs={nowMs} id={`clear-${o.id}`} label="Clearing" />
        ) : (
          <ActionButton id={`clear-${o.id}`} disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'clearObstacle', obstacleId: o.id })}>
            Clear · {formatGold(cost)} gold · {timerLabel(clearTimerMs(o.kind, preset), 0)}
          </ActionButton>
        )}
      </div>
    </Panel>
  )
}

import { ASCENSION_TIER, constructionFor, levelCap, ROOST_TIERS, unlockPl, upgradeInfo, type UnlockKey } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatDuration, formatGold, formatMicroUsd } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { ConstructionStatus } from './ConstructionStatus'
import { MoveTurn } from './MoveTurn'
import { upgradeBlockReason } from './UpgradeSection'

/**
 * The Dragon Roost (§4.2): its tier and dragon level cap, the next tier's price (Tiers 2 to 4 in Gold, Tier 5 as
 * Ascension: Gold plus $2.00 paid in DRIS), and its build or upgrade timer. The tier rises when the construction ends (R33).
 */
export function RoostPanel({ nowMs, onClose }: { nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const s = me.data?.state
  if (!s || !s.roostPlacement) return null

  const con = constructionFor(s, { type: 'roost' })
  const index = con ? s.constructions.indexOf(con) : -1
  const tier = s.roostTier
  const next = ROOST_TIERS[tier]
  const ascension = next !== undefined && next.tier === ASCENSION_TIER
  const info = upgradeInfo(s, { type: 'roost' }, preset)
  const nextMs = next ? Math.floor(next.classicMs / preset.timerDiv) : 0
  const price = next ? `${formatGold(next.gold)} gold${next.usdMicro !== null ? ` + ${formatMicroUsd(next.usdMicro)}` : ''}` : ''
  const minLevel = next ? unlockPl(`roost:${next.tier}` as UnlockKey) : 0
  const reason = !next ? '' : upgradeBlockReason(s, minLevel, next.gold)

  return (
    <Panel title="Dragon Roost" onClose={onClose}>
      <p>{tier === 0 ? `Not finished · cap ${levelCap(0)}` : `Tier ${tier} · cap ${levelCap(tier)}`}</p>
      <div className="upgrade-section" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
        {con ? (
          <ConstructionStatus index={index} readyAtMs={con.readyAtMs} nowMs={nowMs} id="roost" label={con.kind === 'build' ? 'Building' : `Upgrading to Tier ${tier + 1}`} />
        ) : next ? (
          <>
            <p style={{ flexBasis: '100%', margin: 0 }}>{`Next: Tier ${next.tier} · cap ${next.levelCap} · ${price} · ${formatDuration(nextMs)}`}</p>
            {ascension ? (
              <ActionButton id="ascend-roost" primary disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'buy', item: { kind: 'ascension' } })}>
                {`Ascend · ${price}`}
              </ActionButton>
            ) : info && (
              <ActionButton id="upgrade-roost" primary disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'startUpgrade', building: { type: 'roost' } })}>
                {`Upgrade to Tier ${next.tier} · ${price}`}
              </ActionButton>
            )}
          </>
        ) : <span>Max tier</span>}
        <MoveTurn target={{ type: 'roost' }} />
      </div>
    </Panel>
  )
}

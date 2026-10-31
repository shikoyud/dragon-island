import { constructionFor, GROVE_L3, MAX_BUILDERS, priceMicroUsd, unlockPl, upgradeInfo, type BuildingRef, type PlayerState } from '@wyrmhaven/game-core'
import { timerLabel } from '../game/islandModel'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatGold } from '../ui/Money'
import { ActionButton } from '../ui/Panel'
import { ConstructionStatus } from './ConstructionStatus'
import { MoveTurn } from './MoveTurn'

export function levelOf(s: PlayerState, b: BuildingRef): number {
  switch (b.type) {
    case 'habitat': return s.habitats.find(h => h.id === b.id)?.level ?? 1
    case 'farm': return s.farms[b.index]?.level ?? 1
    case 'breeder': return s.breeders[b.index]?.level ?? 1
    case 'hatchery': return s.hatcheryLevel
    case 'roost': return s.roostTier
  }
}

/** Level 4 habitats and farms stop here: level 5 is an instant Store purchase (§5.2, §5.3). A true level 5 is Max level. */
const pointsToStore = (s: PlayerState, b: BuildingRef): boolean =>
  (b.type === 'habitat' || b.type === 'farm') && levelOf(s, b) === 4 && priceMicroUsd(b.type === 'habitat' ? { kind: 'habitatL5', habitatId: b.id } : { kind: 'farmL5', index: b.index }, s, 0) !== null

/** What stands where the upgrade button was once the Gold levels run out. A Grove's last level is a Store purchase too (§5.4). */
function topLevelNote(s: PlayerState, b: BuildingRef): string {
  if (pointsToStore(s, b)) return 'Level 5 in the Store'
  if (b.type === 'breeder' && s.breeders[b.index]?.kind === 'grove' && levelOf(s, b) === GROVE_L3.level - 1) {
    return s.level >= unlockPl('grove:3') ? `Level ${GROVE_L3.level} in the Store` : `Level ${GROVE_L3.level} in the Store at player level ${unlockPl('grove:3')}`
  }
  return 'Max level'
}

/** Why an upgrade of `cost` Gold that opens at player level `minLevel` cannot start now; '' when it can. Shared with the Roost panel. */
export function upgradeBlockReason(s: PlayerState, minLevel: number, cost: number): string {
  return s.level < minLevel ? `Needs player level ${minLevel}`
    : s.gold < cost ? 'Not enough gold'
    : s.constructions.length >= MAX_BUILDERS ? 'Both builders are busy' : ''
}

const idOf = (b: BuildingRef): string => (b.type === 'habitat' ? b.id : b.type === 'hatchery' || b.type === 'roost' ? b.type : `${b.type}-${b.index}`)

/** Level, upgrade (or its timer, skip and manual finish), Move and Turn for one building. */
export function UpgradeSection({ building, nowMs }: { building: BuildingRef; nowMs: number }) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const s = me.data?.state
  const con = s ? constructionFor(s, building) : undefined
  const index = s && con ? s.constructions.indexOf(con) : -1
  if (!s) return null

  const level = levelOf(s, building)
  const info = upgradeInfo(s, building, preset)
  const id = idOf(building)

  const reason = !info ? '' : upgradeBlockReason(s, info.minLevel, info.cost)

  return (
    <div className="upgrade-section" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
      <span>Level {level}</span>
      {con ? (
        <>
          <ConstructionStatus index={index} readyAtMs={con.readyAtMs} nowMs={nowMs} id={id} label={con.kind === 'build' ? 'Building' : `Upgrading to ${level + 1}`} />
        </>
      ) : info ? (
        <ActionButton
          id={`upgrade-${id}`}
          disabled={pending || reason !== ''}
          reason={reason}
          onClick={() => void run({ type: 'startUpgrade', building })}
        >
          Upgrade to {level + 1} · {formatGold(info.cost)} gold · {timerLabel(info.timerMs, 0)}
        </ActionButton>
      ) : <span>{topLevelNote(s, building)}</span>}
      <MoveTurn target={building} />
    </div>
  )
}

import { constructionFor, MAX_BUILDERS, upgradeInfo, type BuildingRef, type PlayerState } from '@wyrmhaven/game-core'
import { timerLabel } from '../game/islandModel'
import { useAction } from '../state/actions'
import { useMe, usePreset } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton } from '../ui/Panel'
import { ConstructionStatus } from './ConstructionStatus'
import { MoveTurn } from './MoveTurn'

export function levelOf(s: PlayerState, b: BuildingRef): number {
  switch (b.type) {
    case 'habitat': return s.habitats.find(h => h.id === b.id)?.level ?? 1
    case 'farm': return s.farms[b.index]?.level ?? 1
    case 'nest': return s.nests[b.index]?.level ?? 1
    case 'hatchery': return s.hatcheryLevel
  }
}

const idOf = (b: BuildingRef): string => (b.type === 'habitat' ? b.id : b.type === 'hatchery' ? 'hatchery' : `${b.type}-${b.index}`)

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

  const reason = !info ? '' : s.level < info.minLevel ? `Needs player level ${info.minLevel}`
    : s.gold < info.cost ? 'Not enough gold'
    : s.constructions.length >= MAX_BUILDERS ? 'Both builders are busy' : ''

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
      ) : <span>Max level</span>}
      <MoveTurn target={building} />
    </div>
  )
}

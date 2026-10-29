import { constructionFor, MAX_BUILDERS, priceMicroUsd, upgradeInfo, type BuildingRef, type PlayerState } from '@wyrmhaven/game-core'
import { footprintOfMovable, placementOf } from '../game/buildingInfo'
import { timerLabel } from '../game/islandModel'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { useStartPlacing } from '../state/startPlacing'
import { formatGold, formatMicroUsd } from '../ui/Money'
import { ActionButton } from '../ui/Panel'
import { Timer } from '../ui/Timer'
import { useAutoFinish } from './useAutoFinish'

export function levelOf(s: PlayerState, b: BuildingRef): number {
  switch (b.type) {
    case 'habitat': return s.habitats.find(h => h.id === b.id)?.level ?? 1
    case 'farm': return s.farms[b.index]?.level ?? 1
    case 'nest': return s.nests[b.index]?.level ?? 1
    case 'hatchery': return s.hatcheryLevel
  }
}

const idOf = (b: BuildingRef): string => (b.type === 'habitat' ? b.id : b.type === 'hatchery' ? 'hatchery' : `${b.type}-${b.index}`)

/** Level, upgrade (or its timer, skip and auto-finish), Move and Turn for one building. */
export function UpgradeSection({ building, nowMs }: { building: BuildingRef; nowMs: number }) {
  const me = useMe()
  const { run, pending } = useAction()
  const startPlacing = useStartPlacing()
  const s = me.data?.state
  const con = s ? constructionFor(s, building) : undefined
  const index = s && con ? s.constructions.indexOf(con) : -1
  useAutoFinish(index, con?.readyAtMs, nowMs)
  if (!s) return null

  const level = levelOf(s, building)
  const info = upgradeInfo(s, building)
  const id = idOf(building)
  const here = placementOf(s, building)
  const skip = con && index >= 0 ? priceMicroUsd({ kind: 'skip', target: 'construction', index }, s, nowMs) : null

  const reason = !info ? '' : s.level < info.minLevel ? `Needs player level ${info.minLevel}`
    : s.gold < info.cost ? 'Not enough gold'
    : s.constructions.length >= MAX_BUILDERS ? 'Both builders are busy' : ''

  return (
    <div className="upgrade-section" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
      <span>Level {level}</span>
      {con ? (
        <>
          <span>{con.kind === 'build' ? 'Building' : `Upgrading to ${level + 1}`} · <Timer readyAtMs={con.readyAtMs} nowMs={nowMs} /></span>
          {nowMs >= con.readyAtMs && (
            <ActionButton id={`finish-construction-${id}`} primary disabled={pending} onClick={() => void run({ type: 'finishConstruction', index })}>
              Finish
            </ActionButton>
          )}
          {skip !== null && (
            <ActionButton id={`skip-construction-${id}`} disabled={pending} onClick={() => void run({ type: 'buy', item: { kind: 'skip', target: 'construction', index } })}>
              Skip · {formatMicroUsd(skip)}
            </ActionButton>
          )}
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
      {here && (
        <>
          <button type="button" className="btn" onClick={() => startPlacing({ kind: 'move', target: building }, footprintOfMovable(s, building), here)}>Move</button>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => void run({ type: 'moveBuilding', target: building, placement: { ...here, facing: ((here.facing + 1) % 4) as typeof here.facing } })}
          >
            Turn
          </button>
        </>
      )}
    </div>
  )
}

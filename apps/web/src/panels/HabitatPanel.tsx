import {
  canLiveIn, ELEMENTS, getSpecies, HABITAT_LEVELS, habitatBuildCost, habitatSlots, LAUNCH_CATALOG, maxHabitats, residents, storedGold,
  type Element,
} from '@wyrmhaven/game-core'
import { useState } from 'react'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

export function HabitatPanel({ habitatId, nowMs, onClose }: { habitatId: string; nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const [element, setElement] = useState<Element>('earth')
  const s = me.data?.state
  const h = s?.habitats.find(x => x.id === habitatId)
  if (!s || !h) return null
  const catalog = LAUNCH_CATALOG
  const live = residents(s, h.id)
  const gold = storedGold(h, live, catalog, nowMs)
  const level = HABITAT_LEVELS[h.level - 1]!
  const upgradeCost = level.upgradeCost
  const free = habitatSlots(h) - live.length
  const movable = s.dragons.filter(d => d.habitatId !== h.id && canLiveIn(getSpecies(catalog, d.speciesId), h))
  const canBuild = s.habitats.length < maxHabitats(s.level)
  const buildCost = habitatBuildCost(s, element)

  return (
    <Panel title={`${h.element} habitat ${h.id}`} onClose={onClose}>
      <p>Level {h.level} · {live.length}/{level.slots} dragons · cap {formatGold(level.cap)}</p>
      <p>{formatGold(gold)} gold stored</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton id={`collect-${h.id}`} primary disabled={pending || gold === 0} reason="Nothing to collect yet" onClick={() => void run({ type: 'collectGold', habitatId: h.id })}>
          Collect
        </ActionButton>
        <ActionButton
          id={`upgrade-${h.id}`}
          disabled={pending || upgradeCost === null || s.gold < upgradeCost}
          reason={upgradeCost === null ? 'Already at the maximum level' : 'Not enough gold'}
          onClick={() => void run({ type: 'upgradeHabitat', habitatId: h.id })}
        >
          Upgrade{upgradeCost !== null ? ` · ${formatGold(upgradeCost)} gold` : ''}
        </ActionButton>
      </div>

      <fieldset style={{ marginTop: 12 }}>
        <legend>Move a dragon here</legend>
        {movable.length === 0 && <p><small>No dragon of a matching element elsewhere.</small></p>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {movable.map(d => (
            <ActionButton
              key={d.id}
              id={`move-${d.id}-${h.id}`}
              disabled={pending || free <= 0}
              reason="No free slot"
              onClick={() => void run({ type: 'moveDragon', dragonId: d.id, habitatId: h.id })}
            >
              {d.id} · {d.speciesId} L{d.level}
            </ActionButton>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ marginTop: 12 }}>
        <legend>Build a new habitat</legend>
        <label>
          Element{' '}
          <select value={element} onChange={e => setElement(e.target.value as Element)}>
            {ELEMENTS.map(el => <option key={el} value={el}>{el}</option>)}
          </select>
        </label>{' '}
        <ActionButton
          id="build-habitat"
          disabled={pending || !canBuild || s.gold < buildCost}
          reason={!canBuild ? `Reach player level ${(s.habitats.length - 1) * 5} for another habitat` : 'Not enough gold'}
          onClick={() => void run({ type: 'buildHabitat', element })}
        >
          Build new habitat · {formatGold(buildCost)} gold
        </ActionButton>
      </fieldset>
    </Panel>
  )
}

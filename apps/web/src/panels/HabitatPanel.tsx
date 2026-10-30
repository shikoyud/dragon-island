import { canLiveIn, getSpecies, habitatCap, habitatSlots, isUnfinished, LAUNCH_CATALOG, residents, storedGold } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe, usePreset } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { UpgradeSection } from './UpgradeSection'

export function HabitatPanel({ habitatId, nowMs, onClose }: { habitatId: string; nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const s = me.data?.state
  const h = s?.habitats.find(x => x.id === habitatId)
  if (!s || !h) return null
  const catalog = LAUNCH_CATALOG
  const live = residents(s, h.id)
  const gold = storedGold(h, live, catalog, nowMs, preset)
  const free = habitatSlots(h) - live.length
  const building = isUnfinished(s, { type: 'habitat', id: h.id })
  const movable = s.dragons.filter(d => d.habitatId !== h.id && canLiveIn(getSpecies(catalog, d.speciesId), h))

  return (
    <Panel title={h.element === 'aerie' ? 'Golden Aerie' : `${h.element} habitat ${h.id}`} onClose={onClose}>
      <p>{live.length}/{habitatSlots(h)} dragons · cap {formatGold(habitatCap(h.element, h.level, preset))}</p>
      <p>{formatGold(gold)} gold stored</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton id={`collect-${h.id}`} primary disabled={pending || gold === 0} reason="Nothing to collect yet" onClick={() => void run({ type: 'collectGold', habitatId: h.id })}>
          Collect
        </ActionButton>
      </div>
      <UpgradeSection building={{ type: 'habitat', id: h.id }} nowMs={nowMs} />

      <fieldset style={{ marginTop: 12 }}>
        <legend>Move a dragon here</legend>
        {movable.length === 0 && <p><small>No dragon of a matching element elsewhere.</small></p>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {movable.map(d => (
            <ActionButton
              key={d.id}
              id={`move-${d.id}-${h.id}`}
              disabled={pending || free <= 0 || building}
              reason={building ? 'Still being built' : 'No free slot'}
              onClick={() => void run({ type: 'moveDragon', dragonId: d.id, habitatId: h.id })}
            >
              {d.id} · {d.speciesId} L{d.level}
            </ActionButton>
          ))}
        </div>
      </fieldset>

    </Panel>
  )
}

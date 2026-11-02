import { canLiveIn, getSpecies, habitatSlots, isUnfinished, LAUNCH_CATALOG, residents } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { ActionButton } from '../ui/Panel'
import { InfoDialog } from './InfoDialog'

/**
 * A habitat's Info (design, Phase 5): the Info layout, then the dragons that could move in. Collect, the residents and
 * Upgrade are on the action row (Phase 4).
 */
export function HabitatPanel({ habitatId, nowMs, onClose }: { habitatId: string; nowMs?: number; onClose?: () => void; onOpenDragon?: (dragonId: string) => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  const h = s?.habitats.find(x => x.id === habitatId)
  if (!s || !h) return null
  const catalog = LAUNCH_CATALOG
  const free = habitatSlots(h) - residents(s, h.id).length
  const building = isUnfinished(s, { type: 'habitat', id: h.id })
  const movable = s.dragons.filter(d => d.habitatId !== h.id && canLiveIn(getSpecies(catalog, d.speciesId), h))

  return (
    <InfoDialog target={{ type: 'habitat', id: h.id }} nowMs={nowMs} onClose={onClose}>
      {movable.length > 0 && (
        <fieldset className="info-extra">
          <legend>Move a dragon here</legend>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {movable.map(d => (
              <ActionButton
                key={d.id}
                id={`move-${d.id}-${h.id}`}
                disabled={pending || free <= 0 || building}
                reason={building ? 'Still being built' : 'No free slot'}
                onClick={() => void run({ type: 'moveDragon', dragonId: d.id, habitatId: h.id })}
              >
                {`${getSpecies(catalog, d.speciesId).name} · Lv ${d.level}`}
              </ActionButton>
            ))}
          </div>
        </fieldset>
      )}
    </InfoDialog>
  )
}

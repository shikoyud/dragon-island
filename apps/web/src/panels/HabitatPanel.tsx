import { canLiveIn, dragonRateX20, getSpecies, habitatCap, habitatSlots, isUnfinished, LAUNCH_CATALOG, residents, stageOf, storedGold } from '@wyrmhaven/game-core'
import { Icon } from '../hud/Icon'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatGold, formatPerMinuteX20 } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { UpgradeSection } from './UpgradeSection'

/** Every tap target is at least 44 px (mobile-first UI direction). */
const TAP = { minHeight: 44 } as const

export function HabitatPanel({ habitatId, nowMs, onClose, onOpenDragon }: {
  habitatId: string
  nowMs: number
  onClose?: () => void
  /** Opens the dragon panel for a resident. */
  onOpenDragon?: (dragonId: string) => void
}) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const s = me.data?.state
  const h = s?.habitats.find(x => x.id === habitatId)
  if (!s || !h) return null
  const catalog = LAUNCH_CATALOG
  const live = residents(s, h.id)
  const gold = storedGold(h, live, catalog, nowMs, preset)
  const cap = habitatCap(h.element, h.level, preset)
  const full = gold >= cap
  const perMinuteX20 = live.reduce((n, d) => {
    const sp = getSpecies(catalog, d.speciesId)
    return n + dragonRateX20(sp, d.level, h, preset)
  }, 0)
  const free = habitatSlots(h) - live.length
  const building = isUnfinished(s, { type: 'habitat', id: h.id })
  const movable = s.dragons.filter(d => d.habitatId !== h.id && canLiveIn(getSpecies(catalog, d.speciesId), h))

  return (
    <Panel title={h.element === 'aerie' ? 'Golden Aerie' : `${h.element} habitat ${h.id}`} onClose={onClose}>
      <p>
        {h.element !== 'aerie' && <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}><Icon name={h.element} size={16} label={h.element} /></span>}
        {`Level ${h.level} · ${live.length}/${habitatSlots(h)} dragons`}
      </p>
      <p>{`${formatPerMinuteX20(perMinuteX20)} gold/min`}</p>
      <p>
        <span>{`${formatGold(gold)} / ${formatGold(cap)}`}</span>
        {full && <strong style={{ marginLeft: 8 }}>FULL</strong>}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton id={`collect-${h.id}`} primary disabled={pending || gold === 0} reason="Nothing to collect yet" onClick={() => void run({ type: 'collectGold', habitatId: h.id })}>
          Collect
        </ActionButton>
      </div>

      <ul aria-label="Residents" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 6 }}>
        {live.map(d => {
          const sp = getSpecies(catalog, d.speciesId)
          return (
            <li key={d.id}>
              <button type="button" className="btn" style={{ ...TAP, width: '100%', textAlign: 'left' }} onClick={() => onOpenDragon?.(d.id)}>
                {`${sp.name} · Lv ${d.level} · ${stageOf(d.level)}`}
              </button>
            </li>
          )
        })}
      </ul>

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

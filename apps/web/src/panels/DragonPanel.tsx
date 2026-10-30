import {
  atkAt, canLiveIn, FEEDS_PER_LEVEL, foodPerFeed, getSpecies, goldPerMinuteX20, habitatSlots, hpAt, isUnfinished, LAUNCH_CATALOG, levelCap,
  residents, SELL_GOLD, stageOf, type Catalog, type Habitat,
} from '@wyrmhaven/game-core'
import { useState } from 'react'
import { Icon } from '../hud/Icon'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatGold, formatPerMinuteX20 } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

const STAGE_NAME = { baby: 'Baby', juvenile: 'Juvenile', adult: 'Adult' } as const

/** "Terra habitat", numbered in build order when the player has several of that element; "Golden Aerie" likewise. */
export function habitatName(all: readonly Habitat[], h: Habitat): string {
  const name = h.element === 'aerie' ? 'Golden Aerie' : `${h.element[0]!.toUpperCase()}${h.element.slice(1)} habitat`
  const same = all.filter(x => x.element === h.element)
  return same.length > 1 ? `${name} ${same.indexOf(h) + 1}` : name
}

/** Four pips, one per feed toward the next level (§4.1). Not a tap target. */
function FeedPips({ feeds }: { feeds: number }) {
  return (
    <span role="img" aria-label={`${feeds} of ${FEEDS_PER_LEVEL} feeds`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: FEEDS_PER_LEVEL }, (_, i) => (
        <span
          key={i}
          data-pip={i < feeds ? 'filled' : 'empty'}
          style={{ width: 10, height: 10, border: '2px solid var(--border)', background: i < feeds ? 'var(--accent)' : 'transparent', display: 'inline-block' }}
        />
      ))}
    </span>
  )
}

export function DragonPanel({ dragonId, onClose, catalog = LAUNCH_CATALOG }: { dragonId: string; onClose?: () => void; catalog?: Catalog }) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const [moving, setMoving] = useState(false)
  const s = me.data?.state
  const d = s?.dragons.find(x => x.id === dragonId)
  if (!s || !d) return null
  const species = getSpecies(catalog, d.speciesId)
  const maxed = d.level >= levelCap(s.roostTier)
  const foodCost = maxed ? 0 : foodPerFeed(d.level)
  const sellGold = SELL_GOLD[species.rarity]
  const inTeam = s.defenceTeam?.includes(d.id) ?? false
  // Hybrids live in any habitat of their elements; a full or unbuilt habitat, and the current one, are not offered.
  const destinations = s.habitats.filter(h =>
    h.id !== d.habitatId
    && canLiveIn(species, h)
    && residents(s, h.id).length < habitatSlots(h)
    && !isUnfinished(s, { type: 'habitat', id: h.id }))

  return (
    <Panel title={`${species.name} (${d.id})`} onClose={onClose}>
      <p style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', gap: 2 }}>
          {species.elements.map(el => <Icon key={el} name={el} size={16} label={el} />)}
        </span>
        <span style={{ textTransform: 'capitalize' }}>{species.rarity}</span>
      </p>
      <p>{`Level ${d.level} · ${STAGE_NAME[stageOf(d.level)]}`}</p>
      <p>{`${formatPerMinuteX20(goldPerMinuteX20(species.elements[0]!, species.rarity, d.level, preset))} gold/min`}</p>
      <p>{`HP ${hpAt(species.rarity, d.level)} · ATK ${atkAt(species.rarity, d.level)}`}</p>
      <p>{d.habitatId ? `Lives in ${d.habitatId}` : 'Waiting in the hatchery (no habitat has room)'}{inTeam ? ' · defence team' : ''}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {maxed ? (
          <ActionButton id={`feed-${d.id}`} primary disabled reason="Dragon Roost arrives in a later update">
            Upgrade Roost
          </ActionButton>
        ) : (
          <ActionButton
            id={`feed-${d.id}`}
            primary
            disabled={pending || s.food < foodCost}
            reason="Not enough food"
            onClick={() => void run({ type: 'feed', dragonId: d.id })}
          >
            {`Feed · ${formatGold(foodCost)} food`}
          </ActionButton>
        )}
        <FeedPips feeds={d.feeds} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <ActionButton id={`move-${d.id}`} onClick={() => setMoving(m => !m)}>
          Move
        </ActionButton>
        {sellGold !== null && (
          <ActionButton
            id={`sell-${d.id}`}
            danger
            disabled={pending || s.dragons.length <= 2}
            reason="Keep at least two dragons so you can still breed"
            onClick={() => void run({ type: 'sellDragon', dragonId: d.id })}
          >
            {`Sell · ${formatGold(sellGold)} gold`}
          </ActionButton>
        )}
      </div>
      {moving && (
        <fieldset style={{ marginTop: 8 }}>
          <legend>Move to</legend>
          {destinations.length === 0 && <p><small>No habitat of a matching element has a free slot.</small></p>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {destinations.map(h => (
              <ActionButton
                key={h.id}
                id={`move-${d.id}-${h.id}`}
                disabled={pending}
                onClick={() => { setMoving(false); void run({ type: 'moveDragon', dragonId: d.id, habitatId: h.id }) }}
              >
                {`${habitatName(s.habitats, h)} · ${residents(s, h.id).length}/${habitatSlots(h)}`}
              </ActionButton>
            ))}
          </div>
        </fieldset>
      )}
    </Panel>
  )
}

import {
  ASCENSION_TIER, atkAt, canLiveIn, dragonRateX20, FEEDS_PER_LEVEL, foodPerFeed, getSpecies, goldPerMinuteX20, habitatSlots, hpAt, isUnfinished, LAUNCH_CATALOG, levelCap,
  movesFor, moveUnlocked, residents, SELL_GOLD, stageOf, type Catalog, type Habitat,
} from '@wyrmhaven/game-core'
import { useState, type ReactNode } from 'react'
import { dragonLook } from '../game/islandModel'
import { ArtMark } from '../hud/ArtMark'
import { Icon } from '../hud/Icon'
import type { DialogKey } from '../hud/Hud'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { SpriteStill, useGameArt } from '../ui/GameArt'
import { FullScreenFrame } from '../ui/kit/frames'
import { ProgressBar, RarityShield, ResourcePill } from '../ui/kit/pieces'
import { formatGold, formatPerMinuteX20 } from '../ui/Money'
import { ActionButton } from '../ui/Panel'

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
    <span role="img" className="dragon-pips" aria-label={`${feeds} of ${FEEDS_PER_LEVEL} feeds`}>
      {Array.from({ length: FEEDS_PER_LEVEL }, (_, i) => <span key={i} className="dragon-pips__pip" data-pip={i < feeds ? 'filled' : 'empty'} />)}
    </span>
  )
}

/** One stat line: icon, name and value, and a bar to what it reaches at the level cap. */
function StatRow({ icon, label, value, max, maxLabel }: { icon: ReactNode; label: string; value: number; max: number; maxLabel: string }) {
  return (
    <li className="dragon-stat" aria-label={`${label} ${formatGold(value)}`}>
      <span className="dragon-stat__icon">{icon}</span>
      <span className="dragon-stat__name" aria-hidden="true">{label}</span>
      <span className="dragon-stat__value" aria-hidden="true">{formatGold(value)}</span>
      <span className="dragon-stat__bar"><ProgressBar value={value} max={max} name={`${label} toward the level cap`} /></span>
      <span className="dragon-stat__max" aria-hidden="true">{maxLabel}</span>
    </li>
  )
}

/**
 * Dragon detail (design, Phase 5: dragon-choosen): plank with the species and its rarity; where it lives; the dragon on
 * a backdrop with the level box left and Feed N under it; the stats card right with side tabs (Stats, Moves); Move and
 * Sell along the bottom. Move opens the habitats it can go to.
 */
export function DragonPanel({ dragonId, onClose, onOpen, catalog = LAUNCH_CATALOG }: { dragonId: string; onClose?: () => void; onOpen?: (k: DialogKey | null) => void; catalog?: Catalog }) {
  const me = useMe()
  const preset = usePreset()
  const art = useGameArt()
  const { run, pending } = useAction()
  const [moving, setMoving] = useState(false)
  const [tab, setTab] = useState<'stats' | 'moves'>('stats')
  const s = me.data?.state
  const d = s?.dragons.find(x => x.id === dragonId)
  if (!s || !d) return null
  const species = getSpecies(catalog, d.speciesId)
  const cap = levelCap(s.roostTier)
  const maxed = d.level >= cap
  const foodCost = maxed ? 0 : foodPerFeed(d.level)
  const sellGold = SELL_GOLD[species.rarity]
  const home = s.habitats.find(x => x.id === d.habitatId)
  const inTeam = s.defenceTeam?.includes(d.id) ?? false
  const capLevel = Math.max(cap, d.level)
  // Hybrids live in any habitat of their elements; a full or unbuilt habitat, and the current one, are not offered.
  const destinations = s.habitats.filter(h =>
    h.id !== d.habitatId
    && !h.stored
    && canLiveIn(species, h)
    && residents(s, h.id).length < habitatSlots(h)
    && !isUnfinished(s, { type: 'habitat', id: h.id }))
  const rate = home ? dragonRateX20(species, d.level, home, preset) : goldPerMinuteX20(species.elements[0]!, species.rarity, d.level, preset)
  const where = d.stored ? 'In Storage' : home ? `Lives in ${habitatName(s.habitats, home)}` : 'Waiting in the hatchery (no habitat has room)'

  return (
    <FullScreenFrame title={species.name} backdrop="scene" onClose={onClose}>
      <div className={`dragon-detail dragon-detail--${species.elements[0]}`}>
        <div className="dragon-detail__top">
          <ResourcePill icon={<Icon name="food" size={24} />} label="Food" value={formatGold(s.food)} />
          <span className="dragon-detail__marks">
            <RarityShield rarity={species.rarity} />
            <span className="dragon-detail__rarity">{species.rarity}</span>
            {species.elements.map(el => <Icon key={el} name={el} size={20} label={el} />)}
          </span>
          <p className="dragon-detail__where">{where}{inTeam ? ' · defence team' : ''}</p>
        </div>
        <div className="dragon-detail__main">
          <div className="dragon-detail__level" role="group" aria-label={`Level ${d.level} · ${STAGE_NAME[stageOf(d.level)]}`}>
            <span className="dragon-detail__stage" aria-hidden="true">{STAGE_NAME[stageOf(d.level)]}</span>
            <span className="dragon-detail__level-word" aria-hidden="true">Level</span>
            <span className="dragon-detail__level-num" aria-hidden="true">{d.level}</span>
          </div>
          <div className="dragon-detail__stage-art">
            <SpriteStill sprite={dragonLook(d.speciesId, d.level, art, catalog).sprite} height={200} />
            <FeedPips feeds={d.feeds} />
            {maxed ? (
              <ActionButton
                id={`feed-${d.id}`}
                primary
                disabled={s.roostTier >= ASCENSION_TIER}
                reason="Max level"
                // The Roost if it stands, else the Shop's Build tab where it is bought (§4.2).
                onClick={() => onOpen?.(s.roostPlacement ? { kind: 'upgrade', target: { type: 'roost' } } : { kind: 'panel', id: 'shop', tab: 'build' })}
              >
                Upgrade Roost
              </ActionButton>
            ) : (
              <span className="dragon-detail__feed">
                <ActionButton
                  id={`feed-${d.id}`}
                  primary
                  disabled={pending || s.food < foodCost || Boolean(d.stored)}
                  reason={d.stored ? 'Take it out of Storage first' : 'Not enough food'}
                  ariaLabel={`Feed · ${formatGold(foodCost)} food`}
                  onClick={() => void run({ type: 'feed', dragonId: d.id })}
                >
                  {`Feed ${formatGold(foodCost)}`}<Icon name="food" size={20} />
                </ActionButton>
              </span>
            )}
          </div>
          <div className="dragon-detail__card">
            <section className="dragon-card" aria-label={tab === 'stats' ? 'Stats' : 'Moves'}>
              <h3 className="dragon-card__title">{tab === 'stats' ? 'Stats' : 'Moves'}</h3>
              {tab === 'stats' ? (
                <ul className="dragon-card__list">
                  <StatRow icon={<ArtMark name="icon.health.32" size={32} />} label="Health" value={hpAt(species.rarity, d.level)} max={hpAt(species.rarity, capLevel)} maxLabel={formatGold(hpAt(species.rarity, capLevel))} />
                  <StatRow icon={<ArtMark name="icon.damage.32" size={32} />} label="Damage" value={atkAt(species.rarity, d.level)} max={atkAt(species.rarity, capLevel)} maxLabel={formatGold(atkAt(species.rarity, capLevel))} />
                  <li className="dragon-stat dragon-stat--gold">
                    <span className="dragon-stat__icon"><Icon name="gold" size={32} /></span>
                    <span className="dragon-stat__name">Income</span>
                    <span className="dragon-stat__value">{`${formatPerMinuteX20(rate)} gold/min`}</span>
                  </li>
                </ul>
              ) : (
                <ul className="dragon-card__list">
                  {movesFor(species).map(m => (
                    <li key={m.name} className={`dragon-move${moveUnlocked(m, d.level) ? '' : ' dragon-move--locked'}`}>
                      <span className="dragon-move__name">{m.name}</span>
                      <span className="dragon-move__el">{m.element === 'physical' ? 'Physical' : `${m.element.charAt(0).toUpperCase()}${m.element.slice(1)}`}</span>
                      <span className="dragon-move__power">{moveUnlocked(m, d.level) ? `Power ${m.multPct}` : `Level ${m.minLevel}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <div className="dragon-tabs" role="tablist" aria-label="Dragon sections" aria-orientation="vertical">
              <button type="button" role="tab" className="dragon-tabs__tab" aria-selected={tab === 'stats'} aria-label="Stats" onClick={() => setTab('stats')}><Icon name="xp" size={24} /></button>
              <button type="button" role="tab" className="dragon-tabs__tab" aria-selected={tab === 'moves'} aria-label="Moves" onClick={() => setTab('moves')}><Icon name="battle" size={24} /></button>
            </div>
          </div>
        </div>
        <div className="dragon-detail__bottom">
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
          <ActionButton id={`move-${d.id}`} onClick={() => setMoving(m => !m)}>
            Move
          </ActionButton>
        </div>
        {d.habitatId === null && sellGold === null && <p className="dragon-detail__note"><small>Needs room: upgrade a habitat or build a new one.</small></p>}
        {moving && (
          <fieldset className="dragon-detail__move">
            <legend>Move to</legend>
            {destinations.length === 0 && <p><small>No habitat of a matching element has a free slot.</small></p>}
            <div className="dragon-detail__move-list">
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
      </div>
    </FullScreenFrame>
  )
}

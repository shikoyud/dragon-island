import {
  activeLegendaries, BREED_MIN_LEVEL, breederBreedMs, breedingPool, breedTimerMs, breedValidity, FIRST_HYBRID_MS,
  gameDay, getSpecies, hatcherySlots, hatcheryUsed, isUnfinished, LAUNCH_CATALOG, priceMicroUsd, unlockPl, type Catalog, type Dragon, type Element, type Species,
} from '@wyrmhaven/game-core'
import { useState } from 'react'
import { dragonLook } from '../game/islandModel'
import { useHudSprite } from '../hud/ArtMark'
import { breederName } from '../hud/hudModel'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { SpriteStill, useGameArt } from '../ui/GameArt'
import { FullScreenFrame } from '../ui/kit/frames'
import { ElementRibbon, RarityShield } from '../ui/kit/pieces'
import { formatDuration, formatSkipPrice } from '../ui/Money'
import { ActionButton } from '../ui/Panel'
import { isReady, Timer } from '../ui/Timer'
import { SpeedUpButton } from './SpeedUpButton'

const pct = (weight: number, total: number) => `${((weight * 100) / total).toFixed(2)}%`
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

/**
 * One parent's column (design, Phase 5: breeding-screen): a search box, an element filter, and the dragons as cards
 * (portrait, rarity shield, level, element ribbons). The dragon picked on the other side can't be picked here.
 */
function ParentColumn({ side, label, placeholder, dragons, picked, other, onPick, catalog }: {
  side: 'a' | 'b'; label: string; placeholder: string; dragons: readonly Dragon[]; picked: string; other: string; onPick: (id: string) => void; catalog: Catalog
}) {
  const art = useGameArt()
  const [query, setQuery] = useState('')
  const [element, setElement] = useState<Element | null>(null)
  const elements = [...new Set(dragons.flatMap(d => getSpecies(catalog, d.speciesId).elements))]
  const q = query.trim().toLowerCase()
  const shown = dragons.filter(d => {
    const sp = getSpecies(catalog, d.speciesId)
    return (!q || sp.name.toLowerCase().includes(q)) && (!element || sp.elements.includes(element))
  })
  return (
    <div className={`breed-col breed-col--${side}`}>
      <input type="search" className="breed-col__search" aria-label={`Search ${placeholder}`} placeholder={placeholder} value={query} onChange={e => setQuery(e.target.value)} />
      <div className="breed-col__filter" role="group" aria-label={`${placeholder} element`}>
        <button type="button" className="breed-col__el breed-col__el--all" aria-pressed={element === null} onClick={() => setElement(null)}>All</button>
        {elements.map(el => (
          <button key={el} type="button" className="breed-col__el" aria-pressed={element === el} aria-label={cap(el)} onClick={() => setElement(element === el ? null : el)}>
            <ElementRibbon element={el} />
          </button>
        ))}
      </div>
      <div className="breed-col__list kit-scroll" role="radiogroup" aria-label={label}>
        {shown.map(d => {
          const sp = getSpecies(catalog, d.speciesId)
          return (
            <button key={d.id} type="button" role="radio" id={`parent-${side}-${d.id}`} className="breed-card" aria-checked={picked === d.id}
              aria-label={`${sp.name} · level ${d.level}`} disabled={other === d.id} onClick={() => onPick(d.id)}>
              <span className="breed-card__name" aria-hidden="true">{sp.name}</span>
              <span className="breed-card__portrait" aria-hidden="true">
                <SpriteStill sprite={dragonLook(d.speciesId, d.level, art, catalog).sprite} height={56} />
                <span className="breed-card__level">{d.level}</span>
              </span>
              <span className="breed-card__marks" aria-hidden="true">
                <RarityShield rarity={sp.rarity} />
                {sp.elements.map(el => <ElementRibbon key={el} element={el} />)}
              </span>
            </button>
          )
        })}
        {shown.length === 0 && <p className="breed-col__empty">No dragons match</p>}
      </div>
    </div>
  )
}

/**
 * The breeding screen (design, Phase 5: breeding-screen; §3.1-3.5): Parent 1 and Parent 2 down each side, the heart in the
 * middle with Breed, the public outcome list with exact odds and timers, and the breeding buildings with their eggs.
 * Upgrades live in the building's Upgrade dialog.
 */
export function BreedPanel({ nowMs, onClose }: { nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const preset = usePreset()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const backdrop = useHudSprite('bg.breeding')?.src
  const s = me.data?.state
  const game = me.data?.game
  if (!s || !game) return null
  const catalog = LAUNCH_CATALOG
  const pa = s.dragons.find(d => d.id === a)
  const pb = s.dragons.find(d => d.id === b)
  const ready = pa && pb && pa.id !== pb.id
  const lowLevel = Boolean(ready && (pa.level < BREED_MIN_LEVEL || pb.level < BREED_MIN_LEVEL))
  const sa = ready ? getSpecies(catalog, pa.speciesId) : null
  const sb = ready ? getSpecies(catalog, pb.speciesId) : null
  const invalid = sa && sb ? breedValidity(sa, sb) : null
  // startBreed takes the first finished empty building, so that building's reduction sets the timers.
  const freeIndex = s.breeders.findIndex((br, i) => br.egg === null && !isUnfinished(s, { type: 'breeder', index: i }))
  const timerBuilding = s.breeders[freeIndex >= 0 ? freeIndex : 0]
  const day = gameDay(game.launchAtMs, nowMs)

  const pool = sa && sb && !lowLevel && !invalid
    ? breedingPool(sa, sb, { activeLegendaries: activeLegendaries(day, preset), firstHybridPending: !s.firstHybridDone }, catalog)
    : null
  const total = pool ? pool.reduce((n, e) => n + e.weight, 0) : 0
  // By chance; equal chances list the first parent's line before the second's (Terra x Flame: Terra Basic, Flame Basic, Terra-Flame, Flame-Terra).
  const parentRank = (sp: Species): number => (sp.elements[0] === sa?.elements[0] ? 0 : 1)
  const rows = pool ? [...pool].sort((x, y) => y.weight - x.weight || parentRank(x.species) - parentRank(y.species)) : []
  // R25: while the first hybrid is pending, a hybrid result takes a flat minute with no building reduction.
  const timeOf = (sp: Species): number => {
    const scripted = !s.firstHybridDone && sp.elements.length >= 2 && sp.rarity !== 'legendary'
    if (scripted) return FIRST_HYBRID_MS
    const base = breedTimerMs(sp.rarity, sp.elements, preset)
    return timerBuilding ? breederBreedMs(base, timerBuilding) : base
  }

  const minPl = unlockPl('mountain:1')
  const reason = s.level < minPl ? `Unlocks at level ${minPl}`
    : !ready ? 'Pick two different dragons'
    : lowLevel ? `Both parents must be level ${BREED_MIN_LEVEL}`
    : invalid === 'OPPOSITE_BASICS' ? "Opposite Basics can't breed. Use a hybrid that carries one of them."
    : freeIndex < 0 ? 'Every breeding building is busy'
    : ''

  const hatcheryFull = hatcheryUsed(s) >= hatcherySlots(s.hatcheryLevel, s.hatcheryFifthSlot)
  // A dragon in Storage can't breed (S4).
  const parents = s.dragons.filter(d => !d.stored)
  const name = (d: Dragon) => getSpecies(catalog, d.speciesId).name

  return (
    <FullScreenFrame title="Breed" backdrop="scene" onClose={onClose}>
      <div className="breed-screen" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}>
        <ParentColumn side="a" label="First parent" placeholder="Parent 1" dragons={parents} picked={a} other={b} onPick={setA} catalog={catalog} />
        <ParentColumn side="b" label="Second parent" placeholder="Parent 2" dragons={parents} picked={b} other={a} onPick={setB} catalog={catalog} />
        <div className="breed-mid">
          <span className={`breed-heart${ready ? ' breed-heart--full' : ''}`} aria-hidden="true">♥</span>
          <p className="breed-mid__pair">{pa && pb && ready ? `${name(pa)} + ${name(pb)}` : 'Select your dragons!'}</p>
          <ActionButton
            id="breed"
            primary
            disabled={pending || reason !== ''}
            reason={reason}
            onClick={() => ready && void run({ type: 'startBreed', parentA: pa.id, parentB: pb.id })}
          >
            Breed
          </ActionButton>
          {pool && (
            <ul className="breed-outcomes kit-scroll" aria-label="Breeding outcomes">
              {rows.map(e => (
                <li key={e.species.id}>{`${e.species.name} · ${cap(e.species.rarity)} · ${pct(e.weight, total)} · ${formatDuration(timeOf(e.species))}`}</li>
              ))}
            </ul>
          )}
          <ul className="breed-buildings" aria-label="Breeding buildings">
            {s.breeders.map((br, i) => {
              if (br.stored) return null
              const egg = br.egg
              const done = egg ? isReady(egg.readyAtMs, nowMs) : false
              const price = egg && !done ? priceMicroUsd({ kind: 'skip', target: 'breeder', index: i }, s, nowMs) : null
              return (
                <li key={i} data-testid={`breeder-${i}`} className="breed-building">
                  <strong>{breederName(br.kind)}</strong>
                  {!egg && <span>{isUnfinished(s, { type: 'breeder', index: i }) ? 'being built' : 'idle'}</span>}
                  {egg && !done && <span>Egg · <Timer readyAtMs={egg.readyAtMs} nowMs={nowMs} /></span>}
                  {egg && done && <span>Egg ready</span>}
                  {price !== null && (
                    <ActionButton id={`skip-breeder-${i}`} disabled={pending} onClick={() => void run({ type: 'buy', item: { kind: 'skip', target: 'breeder', index: i } })}>
                      Skip · {formatSkipPrice(price)}
                    </ActionButton>
                  )}
                  {egg && !done && <SpeedUpButton id={`speedup-breeder-${i}`} target="breeder" index={i} readyAtMs={egg.readyAtMs} nowMs={nowMs} />}
                  {egg && done && (
                    <ActionButton id={`collect-egg-${i}`} primary disabled={pending || hatcheryFull} reason={hatcheryFull ? 'Hatchery is full' : ''} onClick={() => void run({ type: 'collectEgg', breeder: i })}>
                      Move to Hatchery
                    </ActionButton>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </FullScreenFrame>
  )
}

import {
  activeLegendaries, BREED_MIN_LEVEL, breederBreedMs, breedingPool, breedTimerMs, breedValidity, FIRST_HYBRID_MS,
  gameDay, getSpecies, hatcherySlots, hatcheryUsed, isUnfinished, LAUNCH_CATALOG, priceMicroUsd, unlockPl, type Species,
} from '@wyrmhaven/game-core'
import { useState } from 'react'
import { breederName } from '../hud/hudModel'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatDuration, formatSkipPrice } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { isReady, Timer } from '../ui/Timer'
import { UpgradeSection } from './UpgradeSection'

const pct = (weight: number, total: number) => `${((weight * 100) / total).toFixed(2)}%`
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
const tap = { minHeight: 44 } as const

/** The breeding buildings on top; below them two parents and the public outcome list with exact odds and timers (§3.1-3.5). */
export function BreedPanel({ nowMs, onClose }: { nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const preset = usePreset()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
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
  const options = s.dragons.map(d => (
    <option key={d.id} value={d.id}>{d.id} · {getSpecies(catalog, d.speciesId).name} L{d.level}</option>
  ))

  return (
    <Panel title="Breed" onClose={onClose}>
      <ul aria-label="Breeding buildings" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {s.breeders.map((br, i) => {
          const egg = br.egg
          const done = egg ? isReady(egg.readyAtMs, nowMs) : false
          const price = egg && !done ? priceMicroUsd({ kind: 'skip', target: 'breeder', index: i }, s, nowMs) : null
          return (
            <li key={i} data-testid={`breeder-${i}`} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{breederName(br.kind)}</strong>
                {!egg && <span>{isUnfinished(s, { type: 'breeder', index: i }) ? 'being built' : 'idle'}</span>}
                {egg && !done && <span>Egg · <Timer readyAtMs={egg.readyAtMs} nowMs={nowMs} /></span>}
                {egg && done && <span>Egg ready</span>}
                {price !== null && (
                  <ActionButton id={`skip-breeder-${i}`} disabled={pending} onClick={() => void run({ type: 'buy', item: { kind: 'skip', target: 'breeder', index: i } })}>
                    Skip · {formatSkipPrice(price)}
                  </ActionButton>
                )}
                {egg && done && (
                  <ActionButton id={`collect-egg-${i}`} primary disabled={pending || hatcheryFull} reason={hatcheryFull ? 'Hatchery is full' : ''} onClick={() => void run({ type: 'collectEgg', breeder: i })}>
                    Move to Hatchery
                  </ActionButton>
                )}
              </div>
              <UpgradeSection building={{ type: 'breeder', index: i }} nowMs={nowMs} />
            </li>
          )
        })}
      </ul>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        <label>First parent <select style={tap} value={a} onChange={e => setA(e.target.value)}><option value="">—</option>{options}</select></label>
        <label>Second parent <select style={tap} value={b} onChange={e => setB(e.target.value)}><option value="">—</option>{options}</select></label>
      </div>
      <div style={{ marginTop: 8 }}>
        <ActionButton
          id="breed"
          primary
          disabled={pending || reason !== ''}
          reason={reason}
          onClick={() => ready && void run({ type: 'startBreed', parentA: pa.id, parentB: pb.id })}
        >
          Breed
        </ActionButton>
      </div>
      {pool && (
        <ul aria-label="Breeding outcomes" style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
          {rows.map(e => (
            <li key={e.species.id} style={{ padding: '4px 0' }}>{`${e.species.name} · ${cap(e.species.rarity)} · ${pct(e.weight, total)} · ${formatDuration(timeOf(e.species))}`}</li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

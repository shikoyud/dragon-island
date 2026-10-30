import { activeLegendaries, BREED_MIN_LEVEL, breedingOdds, gameDay, getSpecies, isUnfinished, LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { useState } from 'react'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { ActionButton, Panel } from '../ui/Panel'

const pct = (p: number) => `${(p * 100).toFixed(2)}%`

/** Pick two parents; the exact odds table (spec §6) updates live. */
export function BreedPanel({ onClose }: { onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const preset = usePreset()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const s = me.data?.state
  if (!s) return null
  const catalog = LAUNCH_CATALOG
  const pa = s.dragons.find(d => d.id === a)
  const pb = s.dragons.find(d => d.id === b)
  const ready = pa && pb && pa.id !== pb.id
  const lowLevel = ready && (pa.level < BREED_MIN_LEVEL || pb.level < BREED_MIN_LEVEL)
  const breederFree = s.breeders.some((n, i) => n.egg === null && !isUnfinished(s, { type: 'breeder', index: i }))
  const day = gameDay(me.data?.game?.launchAtMs ?? 0, Date.now())
  const odds = ready && !lowLevel ? breedingOdds(getSpecies(catalog, pa.speciesId), getSpecies(catalog, pb.speciesId), { activeLegendaries: activeLegendaries(day, preset), firstHybridPending: !s.firstHybridDone }, catalog) : null
  const rows = odds ? Object.entries(odds).sort((x, y) => y[1] - x[1]) : []
  const reason = !ready ? 'Pick two different dragons' : lowLevel ? `Both parents must be level ${BREED_MIN_LEVEL}` : !breederFree ? 'Every breeding building is busy' : ''

  const options = s.dragons.map(d => (
    <option key={d.id} value={d.id}>{d.id} · {getSpecies(catalog, d.speciesId).name} L{d.level}</option>
  ))

  return (
    <Panel title="Breed" onClose={onClose}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label>First parent <select value={a} onChange={e => setA(e.target.value)}><option value="">—</option>{options}</select></label>
        <label>Second parent <select value={b} onChange={e => setB(e.target.value)}><option value="">—</option>{options}</select></label>
      </div>
      {odds && (
        <table aria-label="Breeding odds" style={{ marginTop: 8, borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ textAlign: 'left' }}>Result</th><th>Rarity</th><th style={{ textAlign: 'right' }}>Chance</th></tr></thead>
          <tbody>
            {rows.map(([id, p]) => {
              const sp = getSpecies(catalog, id)
              return <tr key={id}><td>{sp.name}</td><td>{sp.rarity}</td><td style={{ textAlign: 'right' }}>{pct(p)}</td></tr>
            })}
          </tbody>
        </table>
      )}
      <div style={{ marginTop: 12 }}>
        <ActionButton
          id="breed"
          primary
          disabled={pending || !ready || Boolean(lowLevel) || !breederFree}
          reason={reason}
          onClick={() => ready && void run({ type: 'startBreed', parentA: pa.id, parentB: pb.id })}
        >
          Breed
        </ActionButton>
      </div>
    </Panel>
  )
}

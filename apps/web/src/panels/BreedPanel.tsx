import { BREED_MIN_LEVEL, breedingOdds, getSpecies, LAUNCH_CATALOG, pairKey, PITY_THRESHOLD } from '@wyrmhaven/game-core'
import { useState } from 'react'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { ActionButton, Panel } from '../ui/Panel'

const pct = (p: number) => `${(p * 100).toFixed(2)}%`

/** Pick two parents; the exact odds table (spec §6) updates live, including boost and pity. */
export function BreedPanel({ onClose }: { onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const s = me.data?.state
  if (!s) return null
  const catalog = LAUNCH_CATALOG
  const pa = s.dragons.find(d => d.id === a)
  const pb = s.dragons.find(d => d.id === b)
  const boost = s.oddsBoosts > 0
  const ready = pa && pb && pa.id !== pb.id
  const lowLevel = ready && (pa.level < BREED_MIN_LEVEL || pb.level < BREED_MIN_LEVEL)
  const nestFree = s.nests.includes(null)
  const odds = ready && !lowLevel ? breedingOdds(pa, pb, { boost, pity: s.pity }, catalog) : null
  const rows = odds ? Object.entries(odds).sort((x, y) => y[1] - x[1]) : []
  const pityKeys = ready
    ? getSpecies(catalog, pa.speciesId).elements.flatMap(ea => getSpecies(catalog, pb.speciesId).elements.map(eb => pairKey(ea, eb)))
    : []
  const pityActive = pityKeys.some(k => (s.pity[k] ?? 0) >= PITY_THRESHOLD)
  const reason = !ready ? 'Pick two different dragons' : lowLevel ? `Both parents must be level ${BREED_MIN_LEVEL}` : !nestFree ? 'Every nest is busy' : ''

  const options = s.dragons.map(d => (
    <option key={d.id} value={d.id}>{d.id} · {getSpecies(catalog, d.speciesId).name} L{d.level}</option>
  ))

  return (
    <Panel title="Breed" onClose={onClose}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label>First parent <select value={a} onChange={e => setA(e.target.value)}><option value="">—</option>{options}</select></label>
        <label>Second parent <select value={b} onChange={e => setB(e.target.value)}><option value="">—</option>{options}</select></label>
      </div>
      {boost && <p>Odds boost active ({s.oddsBoosts} left): rare +10, epic +5.</p>}
      {pityActive && <p>Pity active: this pair can no longer produce a common.</p>}
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
          disabled={pending || !ready || Boolean(lowLevel) || !nestFree}
          reason={reason}
          onClick={() => ready && void run({ type: 'startBreed', parentA: pa.id, parentB: pb.id })}
        >
          Breed
        </ActionButton>
      </div>
    </Panel>
  )
}

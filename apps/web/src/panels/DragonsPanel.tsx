import { getSpecies, LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { useMe } from '../state/me'
import { Panel } from '../ui/Panel'

/** Every dragon the player owns, by habitat; a row opens that dragon's panel. */
export function DragonsPanel({ onSelect, onClose }: { onSelect: (dragonId: string) => void; onClose?: () => void }) {
  const me = useMe()
  const s = me.data?.state
  if (!s) return null
  return (
    <Panel title={`Dragons (${s.dragons.length})`} onClose={onClose}>
      {s.dragons.length === 0 && <p>No dragons yet. Breed two to get an egg.</p>}
      <ul className="list-rows">
        {s.dragons.map(d => {
          const sp = getSpecies(LAUNCH_CATALOG, d.speciesId)
          return (
            <li key={d.id}>
              <button type="button" className="row-button" onClick={() => onSelect(d.id)}>
                <span>{sp.name}</span>
                <small>Level {d.level} · {d.habitatId === null ? 'waiting in the hatchery' : `habitat ${d.habitatId}`}</small>
              </button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

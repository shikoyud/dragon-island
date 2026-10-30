import { getSpecies, LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { useMe } from '../state/me'

/** Every dragon the player owns, by habitat; a row opens that dragon's panel. The Dragon Book's `My dragons` tab. */
export function DragonsPanel({ onSelect }: { onSelect: (dragonId: string) => void }) {
  const me = useMe()
  const s = me.data?.state
  if (!s) return null
  return (
    <>
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
    </>
  )
}

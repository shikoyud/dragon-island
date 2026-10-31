import type { IslandId } from '@wyrmhaven/game-core'
import type { IslandChoice } from '../state/placing'

/** Turn / Confirm / Cancel while a building is being placed or moved, plus an Island button per island a mover may go to (R57). */
export function PlacementBar({ legal, pending, islands = [], onIsland, onTurn, onConfirm, onCancel }: {
  legal: boolean; pending?: boolean; islands?: readonly IslandChoice[]; onIsland?: (island: IslandId) => void
  onTurn: () => void; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="placement-bar" role="toolbar" aria-label="Placement">
      {islands.map(c => (
        <button
          key={c.island}
          type="button"
          className="btn"
          aria-label={`Move to ${c.name}`}
          aria-pressed={c.current}
          disabled={!c.room || pending}
          title={c.room ? undefined : `No room on ${c.name}`}
          onClick={() => onIsland?.(c.island)}
        >
          {c.name}
        </button>
      ))}
      <button type="button" className="btn" onClick={onTurn}>Turn</button>
      <button type="button" className="btn btn--primary" disabled={!legal || pending} onClick={onConfirm}>Confirm</button>
      <button type="button" className="btn" disabled={pending} onClick={onCancel}>Cancel</button>
      {!legal && <small>Can't build here</small>}
    </div>
  )
}

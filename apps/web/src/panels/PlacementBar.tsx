import type { IslandId } from '@wyrmhaven/game-core'
import { ArtMark, useHudSprite } from '../hud/ArtMark'
import type { IslandChoice } from '../state/placing'

/** A round button with its label beneath: the art for `art` when the manifest has it, until then a glyph made of CSS blocks. */
function GoButton({ name, label, kind, art, disabled, onClick }: { name: string; label: string; kind: 'cancel' | 'ok'; art: string; disabled?: boolean; onClick: () => void }) {
  const hasArt = Boolean(useHudSprite(art))
  return (
    <button type="button" className={`placement-go placement-go--${kind}`} aria-label={name} disabled={disabled} onClick={onClick}>
      <span className="placement-go__plate" aria-hidden="true">{hasArt ? <ArtMark name={art} size={40} /> : <span className="placement-go__glyph" />}</span>
      <span className="placement-go__label outlined">{label}</span>
    </button>
  )
}

/**
 * While a building is placed or moved: an Island button per island a mover may go to (R57) and Turn in a small row, over
 * Cancel and OK. It stands at the bottom centre, and only its buttons take pointer events: the rest of it is still island.
 */
export function PlacementBar({ legal, pending, islands = [], onIsland, onTurn, onConfirm, onCancel }: {
  legal: boolean; pending?: boolean; islands?: readonly IslandChoice[]; onIsland?: (island: IslandId) => void
  onTurn: () => void; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="placement-bar" role="toolbar" aria-label="Placement">
      {!legal && <small className="placement-bar__why">Can't build here</small>}
      <div className="placement-bar__row">
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
      </div>
      <div className="placement-bar__go">
        <GoButton name="Cancel" label="CANCEL" kind="cancel" art="ui.placement.cancel" disabled={pending} onClick={onCancel} />
        <GoButton name="OK" label="OK" kind="ok" art="ui.placement.ok" disabled={!legal || pending} onClick={onConfirm} />
      </div>
    </div>
  )
}

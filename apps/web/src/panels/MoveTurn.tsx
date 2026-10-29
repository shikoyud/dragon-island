import type { Facing, MovableRef } from '@wyrmhaven/game-core'
import { footprintOfMovable, placementOf } from '../game/buildingInfo'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { useStartPlacing } from '../state/startPlacing'

/** Move (placement mode from the current spot) and Turn (one facing step, sent at once) for anything on the grid. */
export function MoveTurn({ target }: { target: MovableRef }) {
  const me = useMe()
  const { run, pending } = useAction()
  const startPlacing = useStartPlacing()
  const s = me.data?.state
  const here = s ? placementOf(s, target) : null
  if (!s || !here) return null
  return (
    <>
      <button type="button" className="btn" onClick={() => startPlacing({ kind: 'move', target }, footprintOfMovable(s, target), here)}>Move</button>
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() => void run({ type: 'moveBuilding', target, placement: { ...here, facing: ((here.facing + 1) % 4) as Facing } })}
      >
        Turn
      </button>
    </>
  )
}

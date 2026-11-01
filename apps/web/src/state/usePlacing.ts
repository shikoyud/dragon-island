import type { IslandId, PlayerState } from '@wyrmhaven/game-core'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Bridge, Placing } from '../game/bridge'
import { nearestLegalCell, placingReducer, type PlacingEvent } from './placing'

/**
 * Placement mode state, mirrored into the bridge so the island scene draws the ghost. Cell events from the
 * scene (taps and drags of the ghost) feed the same reducer as the bar's buttons, except while `locked` (an action is on its
 * way, for the cell the ghost has). Also tracks the viewed island.
 */
export function usePlacing(bridge: Bridge, locked = false): {
  placing: Placing | null; view: IslandId; dispatch: (e: PlacingEvent) => void
  /** Shows another island with the ghost on its nearest legal cell (a move may change island, R57). */
  moveToIsland: (s: PlayerState, island: IslandId) => void
} {
  const [placing, setPlacing] = useState<Placing | null>(bridge.placing)
  const [view, setView] = useState<IslandId>(bridge.view)

  /** The island in view when placement began: Cancel goes back to it. Send `start` before changing the view. */
  const origin = useRef<IslandId | null>(null)
  const lockedNow = useRef(locked)
  lockedNow.current = locked

  const dispatch = useCallback((e: PlacingEvent) => {
    // A second start while placing (another Shop card) keeps the first one's origin: the view may have moved since.
    if (e.type === 'start' && origin.current === null) origin.current = bridge.view
    const next = placingReducer(bridge.placing, e)
    if (next !== bridge.placing) bridge.setPlacing(next)
    if (e.type === 'cancel' && origin.current && origin.current !== bridge.view) bridge.setView(origin.current)
    if (e.type === 'cancel' || e.type === 'done') origin.current = null
  }, [bridge])

  const moveToIsland = useCallback((s: PlayerState, island: IslandId) => {
    const p = bridge.placing
    if (!p || island === bridge.view) return
    const cell = nearestLegalCell(s, p.what, island, { col: p.col, row: p.row })
    if (!cell) return
    // The cell first: the scene reveals the ghost when the view changes.
    dispatch({ type: 'cell', ...cell })
    bridge.setView(island)
  }, [bridge, dispatch])

  useEffect(() => {
    const offs = [
      bridge.on('placing', e => setPlacing(e.placing)),
      bridge.on('view', e => setView(e.view)),
      bridge.on('cell', e => { if (!lockedNow.current) dispatch({ type: 'cell', col: e.col, row: e.row }) }),
    ]
    return () => offs.forEach(off => off())
  }, [bridge, dispatch])

  return { placing, view, dispatch, moveToIsland }
}

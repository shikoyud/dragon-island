import type { IslandId } from '@wyrmhaven/game-core'
import { useCallback, useEffect, useState } from 'react'
import type { Bridge, Placing } from '../game/bridge'
import { placingReducer, type PlacingEvent } from './placing'

/**
 * Placement mode state, mirrored into the bridge so the island scene draws the ghost. Cell events from the
 * scene (clicks and pointer moves) feed the same reducer as the bar's buttons. Also tracks the viewed island.
 */
export function usePlacing(bridge: Bridge): { placing: Placing | null; view: IslandId; dispatch: (e: PlacingEvent) => void } {
  const [placing, setPlacing] = useState<Placing | null>(bridge.placing)
  const [view, setView] = useState<IslandId>(bridge.view)

  const dispatch = useCallback((e: PlacingEvent) => {
    const next = placingReducer(bridge.placing, e)
    if (next === bridge.placing) return
    bridge.setPlacing(next)
  }, [bridge])

  useEffect(() => {
    const offs = [
      bridge.on('placing', e => setPlacing(e.placing)),
      bridge.on('view', e => setView(e.view)),
      bridge.on('cell', e => dispatch({ type: 'cell', col: e.col, row: e.row })),
    ]
    return () => offs.forEach(off => off())
  }, [bridge, dispatch])

  return { placing, view, dispatch }
}

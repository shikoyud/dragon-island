import type { Footprint, Placement } from '@wyrmhaven/game-core'
import { createContext, useContext } from 'react'
import type { Placing } from '../game/bridge'

/** Enters placement mode; a move passes the building's current spot as `from`. */
export type StartPlacing = (what: Placing['what'], size: Footprint, from?: Placement) => void

const StartPlacingContext = createContext<StartPlacing>(() => {})

/** Lets panels start placement without threading a callback through every panel. */
export const StartPlacingProvider = StartPlacingContext.Provider
export const useStartPlacing = (): StartPlacing => useContext(StartPlacingContext)

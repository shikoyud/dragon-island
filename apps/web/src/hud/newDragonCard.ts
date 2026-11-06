import {
  getSpecies, goldPerMinuteX20, HATCH_XP, LAUNCH_CATALOG, MOVE_NAMES, PHYSICAL_MOVE_NAME, SELL_GOLD,
  type Catalog, type Element, type PlayerState, type Preset, type Rarity,
} from '@wyrmhaven/game-core'
import { useEffect, useRef, useState } from 'react'

/** The dragon a successful hatch just added (the hatch count rose and one dragon id is new), or null. */
export function hatchedDragon(prev: PlayerState | undefined, next: PlayerState | undefined): string | null {
  if (!prev || !next || next.goalStats.hatches <= prev.goalStats.hatches) return null
  const known = new Set(prev.dragons.map(d => d.id))
  return next.dragons.find(d => !known.has(d.id))?.id ?? null
}

/** What the New dragon card says (design, Phase 5: new-dragon). */
export interface NewDragonCard {
  dragonId: string; name: string; speciesId: string; rarity: Rarity; elements: readonly Element[]
  /** The hatch XP of its rarity, before the first-hatch bonus. */
  xp: number
  /** The moves it starts with. */
  skills: string[]
  /** Gold a minute at level 1 in a habitat of its first element, in twentieths. */
  incomeX20: number
  /** Gold it sells for, or null for one that can't be sold. */
  sellGold: number | null
  /** The habitat it moved into, or null while it waits in the Hatchery. */
  habitatId: string | null
}

export function newDragonCard(s: PlayerState, dragonId: string, preset: Preset, catalog: Catalog = LAUNCH_CATALOG): NewDragonCard | null {
  const d = s.dragons.find(x => x.id === dragonId)
  if (!d) return null
  const sp = getSpecies(catalog, d.speciesId)
  const first = sp.elements[0]!
  return {
    dragonId: d.id, name: sp.name, speciesId: sp.id, rarity: sp.rarity, elements: sp.elements,
    xp: HATCH_XP[sp.rarity] * preset.xpMult,
    skills: [PHYSICAL_MOVE_NAME, MOVE_NAMES[first][1]],
    incomeX20: goldPerMinuteX20(first, sp.rarity, d.level, preset),
    sellGold: SELL_GOLD[sp.rarity],
    habitatId: d.habitatId,
  }
}

/** Watches the player state and returns the dragon a hatch just added until `dismiss`. */
export function useNewDragon(state: PlayerState | undefined): { dragonId: string | null; dismiss: () => void } {
  const prev = useRef<PlayerState | undefined>(undefined)
  const [dragonId, setDragonId] = useState<string | null>(null)
  useEffect(() => {
    const id = hatchedDragon(prev.current, state)
    prev.current = state
    if (id) setDragonId(id)
  }, [state])
  return { dragonId, dismiss: () => setDragonId(null) }
}

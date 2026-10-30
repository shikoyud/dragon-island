import { DEFAULT_PRESET, PRESETS, type Preset } from '@wyrmhaven/game-core'
import type { Me } from '../api/client'
import { useMe } from './me'

/** The soft-economy preset the server runs (`/me.game.preset`); Flash-14 until /me has loaded. */
export function presetOf(me: Pick<Me, 'game'> | undefined): Preset {
  return PRESETS[me?.game?.preset ?? DEFAULT_PRESET.id]
}

/** The player's preset: `PRESETS[me.data.game.preset]`. */
export function usePreset(): Preset {
  return presetOf(useMe().data)
}

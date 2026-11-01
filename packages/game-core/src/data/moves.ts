// GDD §6.1 move kit. Names are ours (R67), editable by shiko.
import type { Element } from './elements'

/** Slot order in a kit: Physical, then tiers 1 to 3. */
export type MoveTier = 'physical' | 1 | 2 | 3

/** §6.1 MoveMult in hundredths. */
export const MOVE_MULT_PCT: Record<MoveTier, number> = { physical: 52, 1: 85, 2: 100, 3: 162 }

/** §6.1: the dragon level that unlocks each slot. */
export const MOVE_MIN_LEVEL: Record<MoveTier, number> = { physical: 1, 1: 1, 2: 10, 3: 20 }

export const PHYSICAL_MOVE_NAME = 'Strike'

/** R67. */
export const MOVE_NAMES: Record<Element, { 1: string; 2: string; 3: string }> = {
  terra: { 1: 'Stone Toss', 2: 'Quake Stomp', 3: 'Mountain Fall' },
  flame: { 1: 'Cinder Spit', 2: 'Blaze Lash', 3: 'Inferno Crown' },
  sea: { 1: 'Spray Bolt', 2: 'Riptide Lash', 3: 'Abyss Surge' },
  nature: { 1: 'Thorn Flick', 2: 'Bramble Lash', 3: 'Verdant Wrath' },
  electric: { 1: 'Spark Jab', 2: 'Arc Burst', 3: 'Storm Lance' },
  ice: { 1: 'Frost Nip', 2: 'Rime Shard', 3: 'Glacier Break' },
  metal: { 1: 'Iron Tap', 2: 'Steel Rake', 3: 'Anvil Drop' },
  dark: { 1: 'Shade Nip', 2: 'Gloom Rend', 3: 'Umbral Maw' },
  light: { 1: 'Glint', 2: 'Radiant Slash', 3: 'Dawn Verdict' },
  war: { 1: 'Spear Jab', 2: 'War Cleave', 3: "Warlord's Decree" },
}

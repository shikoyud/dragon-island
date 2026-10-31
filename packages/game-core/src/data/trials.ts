// GDD §6.3 (the Elemental Trials): chapters, rewards, replay limits and stars. A18-A21, R71-R73.
// Every number of §6.3 is here; the functions that read them are in ../trials.ts. Gates are `trial:n` in ./unlocks.ts.
import type { Element } from '../elements'
import type { Rarity } from '../rarity'

export interface TrialChapter {
  chapter: number
  element: Element
  theme: string
  enemyMinLevel: number
  enemyMaxLevel: number
  /** One rarity, or two: nodes 1-5 use the first and nodes 6-10 the second (R72). */
  rarities: readonly [Rarity, Rarity?]
  /** The rarity of the Boss in slot 0 of node 10. */
  boss: Rarity
  /** The elements strong against the chapter's (§2.1), in element order. */
  counters: readonly [Element, Element]
  /**
   * The rarity of the off-element wildcards when it differs from the node's rarity.
   * A20: §6.3 lists Epic for Chapter 9 (Light Sanctum), but §3.4's grid has no Light-primary Epic, so its on-element
   * slots are Light Rares and only the wildcards are Epic. The catalog stays as §3.4 has it.
   */
  wildcardRarity?: Rarity
  /** A21: a fixed Boss species, for a Boss the grid cannot supply. Chapter 10's is the Trial Champion. */
  bossSpecies?: string
}

/** Index = chapter - 1. The Unlock PL of each is `unlockPl('trial:n')`. */
export const TRIAL_CHAPTERS: readonly TrialChapter[] = [
  { chapter: 1, element: 'terra', theme: 'Terra Wilds', enemyMinLevel: 1, enemyMaxLevel: 4, rarities: ['common'], boss: 'common', counters: ['metal', 'war'] },
  { chapter: 2, element: 'flame', theme: 'Flame Peaks', enemyMinLevel: 3, enemyMaxLevel: 7, rarities: ['common'], boss: 'common', counters: ['terra', 'sea'] },
  { chapter: 3, element: 'sea', theme: 'Sea Depths', enemyMinLevel: 6, enemyMaxLevel: 10, rarities: ['common', 'uncommon'], boss: 'uncommon', counters: ['nature', 'electric'] },
  { chapter: 4, element: 'nature', theme: 'Nature Grove', enemyMinLevel: 9, enemyMaxLevel: 13, rarities: ['common', 'uncommon'], boss: 'uncommon', counters: ['flame', 'ice'] },
  { chapter: 5, element: 'electric', theme: 'Electric Storm', enemyMinLevel: 12, enemyMaxLevel: 16, rarities: ['uncommon', 'rare'], boss: 'rare', counters: ['terra', 'light'] },
  { chapter: 6, element: 'ice', theme: 'Ice Wastes', enemyMinLevel: 15, enemyMaxLevel: 20, rarities: ['uncommon', 'rare'], boss: 'rare', counters: ['flame', 'metal'] },
  { chapter: 7, element: 'metal', theme: 'Metal Forge', enemyMinLevel: 19, enemyMaxLevel: 24, rarities: ['rare'], boss: 'rare', counters: ['electric', 'dark'] },
  { chapter: 8, element: 'dark', theme: 'Dark Hollow', enemyMinLevel: 23, enemyMaxLevel: 29, rarities: ['rare', 'epic'], boss: 'epic', counters: ['light', 'war'] },
  { chapter: 9, element: 'light', theme: 'Light Sanctum', enemyMinLevel: 28, enemyMaxLevel: 34, rarities: ['rare'], boss: 'rare', counters: ['nature', 'dark'], wildcardRarity: 'epic' },
  { chapter: 10, element: 'war', theme: 'War Citadel', enemyMinLevel: 33, enemyMaxLevel: 40, rarities: ['epic'], boss: 'legendary', counters: ['sea', 'ice'], bossSpecies: 'trial-champion' },
]

/** §6.3: 10 nodes, 9 battles and a Boss. */
export const NODES_PER_CHAPTER = 10
export const BOSS_NODE = 10

/** §6.3 "5 per node per day"; a replay pays 50 % of Gold and Food, no XP (R73). */
export const REPLAYS_PER_NODE_PER_DAY = 5
export const REPLAY_PCT = 50
/** §6.3 "Boss x3". */
export const BOSS_REWARD_MULT = 3

/** §6.3 stars: 3 = no KOs in 8 turns or fewer (A18: both sides' turns). */
export const THREE_STAR_TURNS = 8

/** §6.3 node rewards, first clear: Gold = 1,000 x ch², Food = 50 x ch², XP = 20 x ch (A19). */
export const TRIAL_REWARD = { goldPerChSq: 1000, foodPerChSq: 50, xpPerCh: 20 }

/** §6.3 "need 25% to fight" (R68: hp x 4 >= max). The regen rate is the preset's `healPctPerMin`. */
export const MIN_FIGHT_PCT = 25
/** §6.3, §7.4: a full heal-all costs $0.05 (R78). */
export const HEAL_ALL_MICRO_USD = 50_000

/** `chapter:node`, the key of a node's best stars in `state.pve.stars`. */
export type NodeKey = `${number}:${number}`

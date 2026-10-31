// GDD §6.3 (the Elemental Trials): enemy teams, rewards, stars and gates. A18-A21, R71-R73.
import type { BattleDragonSpec } from './battle/stats'
import type { Catalog, Species } from './catalog'
import {
  BOSS_NODE, BOSS_REWARD_MULT, NODES_PER_CHAPTER, REPLAY_PCT, THREE_STAR_TURNS, TRIAL_CHAPTERS, TRIAL_REWARD,
  type NodeKey, type TrialChapter,
} from './data/trials'
import { unlockPl, type UnlockKey } from './data/unlocks'
import { ELEMENTS, STRONG_AGAINST, type Element } from './elements'
import type { Rarity } from './rarity'
import { createRng } from './rng'
import type { PlayerState } from './state'

export const nodeKey = (chapter: number, node: number): NodeKey => `${chapter}:${node}`

const chapterOf = (chapter: number): TrialChapter => {
  const c = TRIAL_CHAPTERS[chapter - 1]
  if (!c) throw new Error('UNKNOWN_CHAPTER')
  return c
}

/** R72: linear steps through the chapter's range. */
export function nodeLevel(chapter: number, node: number): number {
  const c = chapterOf(chapter)
  return c.minLevel + Math.floor(((c.maxLevel - c.minLevel) * (node - 1)) / (NODES_PER_CHAPTER - 1))
}

/** R72: nodes 1-5 take the first rarity and nodes 6-10 the second, if the chapter has two. */
function nodeRarity(c: TrialChapter, node: number): Rarity {
  return node <= NODES_PER_CHAPTER / 2 ? c.rarities[0] : c.rarities[1] ?? c.rarities[0]
}

const byId = (a: Species, b: Species) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Species with this primary at this rarity, sorted by id. Legendaries are never drawn: a Boss is named, not drawn. */
function pool(c: Catalog, element: Element, rarity: Rarity): Species[] {
  return [...c.species.values()].filter(s => s.rarity === rarity && s.rarity !== 'legendary' && s.elements[0] === element).sort(byId)
}

/**
 * Fixed per node, seeded by `chapter x 100 + node`, and pure data: it never touches an action's Rng.
 * Slots 0 and 1 are on-element; slot 2 is a wildcard (R72) whose primary deals 2x to one of the chapter's counters, so
 * one counter can't sweep. Wildcards rotate by node through the elements strong against either counter, leaving out the
 * chapter's own and any element with no species at that rarity. A Boss node's slot 0 has the Boss rarity (or the named species).
 */
export function nodeTeam(chapter: number, node: number, c: Catalog): BattleDragonSpec[] {
  const ch = chapterOf(chapter)
  const level = nodeLevel(chapter, node)
  const rng = createRng(chapter * 100 + node)
  const rarity = nodeRarity(ch, node)
  const pick = (species: Species[]): string => {
    if (species.length === 0) throw new Error('NO_ENEMIES')
    return species[rng.int(species.length)]!.id
  }
  const onElement = pool(c, ch.element, rarity)
  const isBoss = node === BOSS_NODE
  const slot0 = isBoss && ch.bossSpecies ? ch.bossSpecies : pick(isBoss ? pool(c, ch.element, ch.boss) : onElement)
  const slot1 = pick(onElement)
  const wildRarity = ch.wildcardRarity ?? rarity
  const wildElements = ELEMENTS.filter(e => e !== ch.element
    && ch.counters.some(k => STRONG_AGAINST[e].includes(k))
    && pool(c, e, wildRarity).length > 0)
  if (wildElements.length === 0) throw new Error('NO_ENEMIES')
  const slot2 = pick(pool(c, wildElements[(node - 1) % wildElements.length]!, wildRarity))
  return [slot0, slot1, slot2].map(speciesId => ({ speciesId, level }))
}

/** §6.3: Gold = 1,000 x ch², Food = 50 x ch², XP = 20 x ch, Boss x3. A replay is 50 % of Gold and Food, floored, no XP (R73). */
export function nodeRewards(chapter: number, node: number, kind: 'first' | 'replay'): { gold: number; food: number; xp: number } {
  const mult = node === BOSS_NODE ? BOSS_REWARD_MULT : 1
  const gold = TRIAL_REWARD.goldPerChSq * chapter * chapter * mult
  const food = TRIAL_REWARD.foodPerChSq * chapter * chapter * mult
  if (kind === 'first') return { gold, food, xp: TRIAL_REWARD.xpPerCh * chapter * mult }
  return { gold: Math.floor((gold * REPLAY_PCT) / 100), food: Math.floor((food * REPLAY_PCT) / 100), xp: 0 }
}

/** R71: a chapter needs its PL and the previous Boss; nodes go in order; a cleared node (it has stars) can be replayed. */
export function nodeLocked(s: PlayerState, chapter: number, node: number): 'LEVEL' | 'PREVIOUS' | null {
  if (s.level < unlockPl(`trial:${chapter}` as UnlockKey)) return 'LEVEL'
  const stars = s.pve.stars
  if (stars[nodeKey(chapter, node)]) return null
  if (node > 1 && !stars[nodeKey(chapter, node - 1)]) return 'PREVIOUS'
  if (node === 1 && chapter > 1 && !stars[nodeKey(chapter - 1, BOSS_NODE)]) return 'PREVIOUS'
  return null
}

/** §6.3: 1 = win, 2 = no KOs, 3 = no KOs in 8 turns or fewer (A18: turns of both sides). */
export function starsFor(won: boolean, attackerKos: number, turns: number): 0 | 1 | 2 | 3 {
  if (!won) return 0
  if (attackerKos > 0) return 1
  return turns <= THREE_STAR_TURNS ? 3 : 2
}

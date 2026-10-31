// M5 Task 3: GDD §6.3 (the Elemental Trials), §2.1 (counters), §4.4 (gates); A18-A21, R71, R72.
import { describe, expect, it } from 'vitest'
import { getSpecies } from '../src/catalog'
import { breedingPool } from '../src/breeding'
import { LEGENDARY_EVENTS } from '../src/data/breeding'
import { LAUNCH_CATALOG as C } from '../src/data/launch-catalog'
import {
  BOSS_NODE, BOSS_REWARD_MULT, NODES_PER_CHAPTER, REPLAYS_PER_NODE_PER_DAY, REPLAY_PCT, THREE_STAR_TURNS, TRIAL_CHAPTERS, TRIAL_REWARD,
  type NodeKey,
} from '../src/data/trials'
import { unlockPl, unlocksAt, type UnlockKey } from '../src/data/unlocks'
import { ELEMENTS, STRONG_AGAINST, type Element } from '../src/elements'
import { BOT_RARITIES, generateBotTeam } from '../src/matchmaking'
import { SELL_GOLD } from '../src/data/sell'
import type { Rarity } from '../src/rarity'
import { createRng } from '../src/rng'
import { newPlayer, STATE_VERSION, type PlayerState } from '../src/state'
import { nodeLevel, nodeLocked, nodeRewards, nodeTeam, starsFor } from '../src/trials'

// GDD §6.3 table, copied literally, in chapter order: [theme, min, max, rarities, boss, PL, counters].
type Row = [string, number, number, Rarity[], Rarity, number, [Element, Element]]
const TABLE: Row[] = [
  ['Terra Wilds', 1, 4, ['common'], 'common', 4, ['metal', 'war']],
  ['Flame Peaks', 3, 7, ['common'], 'common', 5, ['terra', 'sea']],
  ['Sea Depths', 6, 10, ['common', 'uncommon'], 'uncommon', 6, ['nature', 'electric']],
  ['Nature Grove', 9, 13, ['common', 'uncommon'], 'uncommon', 8, ['flame', 'ice']],
  ['Electric Storm', 12, 16, ['uncommon', 'rare'], 'rare', 10, ['terra', 'light']],
  ['Ice Wastes', 15, 20, ['uncommon', 'rare'], 'rare', 13, ['flame', 'metal']],
  ['Metal Forge', 19, 24, ['rare'], 'rare', 16, ['electric', 'dark']],
  ['Dark Hollow', 23, 29, ['rare', 'epic'], 'epic', 19, ['light', 'war']],
  // A20: §6.3 says Epic; the catalog has no Light-primary Epic, so Light Rares on-element, Epic wildcards, a Rare Boss.
  ['Light Sanctum', 28, 34, ['rare'], 'rare', 23, ['nature', 'dark']],
  ['War Citadel', 33, 40, ['epic'], 'legendary', 28, ['sea', 'ice']],
]
const sp = (id: string) => getSpecies(C, id)
const primary = (id: string) => sp(id).elements[0]!
const nodes = Array.from({ length: NODES_PER_CHAPTER }, (_, i) => i + 1)
const stars = (entries: [number, number, 1 | 2 | 3][]): PlayerState['pve']['stars'] =>
  Object.fromEntries(entries.map(([c, n, v]) => [`${c}:${n}`, v])) as PlayerState['pve']['stars']
const at = (level: number, st: PlayerState['pve']['stars'] = {}): PlayerState => {
  const s = newPlayer(0)
  return { ...s, level, pve: { ...s.pve, stars: st } }
}

describe('the §6.3 chapter table', () => {
  it('has ten chapters, ten nodes each, the Boss last', () => {
    expect([TRIAL_CHAPTERS.length, NODES_PER_CHAPTER, BOSS_NODE]).toEqual([10, 10, 10])
    expect(TRIAL_CHAPTERS.map(c => c.element)).toEqual(['terra', 'flame', 'sea', 'nature', 'electric', 'ice', 'metal', 'dark', 'light', 'war'])
  })
  TABLE.forEach(([theme, min, max, rarities, boss, pl, counters], i) => {
    it(`chapter ${i + 1}: ${theme}`, () => {
      const c = TRIAL_CHAPTERS[i]!
      expect([c.chapter, c.theme, c.enemyMinLevel, c.enemyMaxLevel, [...c.rarities], c.boss, [...c.counters]]).toEqual([i + 1, theme, min, max, rarities, boss, counters])
      expect(unlockPl(`trial:${i + 1}` as UnlockKey)).toBe(pl)
      // §2.1: the counters are the elements strong against the chapter's.
      expect([...c.counters]).toEqual(ELEMENTS.filter(e => STRONG_AGAINST[e].includes(c.element)))
    })
  })
  it('the first chapter opens with the PvE gate; the others are in the §4.4 schedule', () => {
    expect(unlockPl('trial:1')).toBe(unlockPl('pve'))
    expect(unlocksAt(4)).toEqual(expect.arrayContaining(['trial:1', 'pve']))
  })
  it('pins the counts, rewards and stars', () => {
    expect([REPLAYS_PER_NODE_PER_DAY, REPLAY_PCT, BOSS_REWARD_MULT, THREE_STAR_TURNS]).toEqual([5, 50, 3, 8])
    expect(TRIAL_REWARD).toEqual({ goldPerChSq: 1000, foodPerChSq: 50, xpPerCh: 20 })
  })
})

describe('nodeLevel', () => {
  it('steps linearly through the chapter range', () => {
    expect([nodeLevel(1, 1), nodeLevel(1, 10), nodeLevel(10, 10), nodeLevel(10, 1)]).toEqual([1, 4, 40, 33])
    for (const c of TRIAL_CHAPTERS) {
      for (const n of nodes) expect(nodeLevel(c.chapter, n)).toBe(c.enemyMinLevel + Math.floor(((c.enemyMaxLevel - c.enemyMinLevel) * (n - 1)) / 9))
    }
    expect(nodeLevel(9, 10)).toBe(34)
  })
})

describe('nodeTeam', () => {
  const rarityAt = (ch: number, node: number): Rarity => {
    const c = TRIAL_CHAPTERS[ch - 1]!
    return node <= 5 ? c.rarities[0] : c.rarities[1] ?? c.rarities[0]
  }
  for (const c of TRIAL_CHAPTERS) {
    it(`chapter ${c.chapter}: three known species per node, fixed, on-element in slots 0 and 1 and a wildcard in slot 2`, () => {
      let wild = 0
      for (const n of nodes) {
        const team = nodeTeam(c.chapter, n, C)
        expect(nodeTeam(c.chapter, n, C)).toEqual(team)
        expect(team).toHaveLength(3)
        for (const d of team) {
          expect(C.species.has(d.speciesId)).toBe(true)
          expect(d.level).toBe(nodeLevel(c.chapter, n))
        }
        expect([primary(team[0]!.speciesId), primary(team[1]!.speciesId)]).toEqual([c.element, c.element])
        const w = primary(team[2]!.speciesId)
        expect(w).not.toBe(c.element)
        wild += 1
        // The wildcard deals 2x to one of the counters, so one counter cannot sweep.
        expect(c.counters.some(k => STRONG_AGAINST[w].includes(k)), `${c.chapter}:${n}`).toBe(true)
      }
      expect(wild).toBe(10) // 10 of 30 are off-element
    })
    it(`chapter ${c.chapter}: rarity splits at node 5/6 (R72), the Boss slot 0 is the Boss rarity`, () => {
      for (const n of nodes) {
        const team = nodeTeam(c.chapter, n, C)
        const r = rarityAt(c.chapter, n)
        const onRarity = c.chapter === 10 && n === BOSS_NODE ? 'epic' : r
        expect(sp(team[1]!.speciesId).rarity).toBe(onRarity)
        expect(sp(team[2]!.speciesId).rarity).toBe(c.wildcardRarity ?? r)
        expect(sp(team[0]!.speciesId).rarity).toBe(n === BOSS_NODE ? c.boss : r)
        // Never a Legendary except a Boss in slot 0.
        for (const [slot, d] of team.entries()) {
          if (sp(d.speciesId).rarity === 'legendary') expect([n, slot]).toEqual([BOSS_NODE, 0])
        }
      }
    })
  }
  it('Q4 (a): chapter 9 has Light Rares on-element and Epic wildcards, a Light Rare Boss at L34', () => {
    for (const n of nodes) {
      const t = nodeTeam(9, n, C)
      expect([sp(t[0]!.speciesId).rarity, sp(t[1]!.speciesId).rarity, sp(t[2]!.speciesId).rarity]).toEqual(['rare', 'rare', 'epic'])
    }
    expect(nodeTeam(9, 10, C)[0]).toMatchObject({ level: 34 })
    expect(TRIAL_CHAPTERS[8]!.wildcardRarity).toBe('epic')
  })
  it('Q5 (a): chapter 10 Boss is the Trial Champion, War/Metal Legendary; slots 1 and 2 are Epic', () => {
    const t = nodeTeam(10, 10, C)
    expect(t[0]).toEqual({ speciesId: 'trial-champion', level: 40 })
    expect(sp('trial-champion')).toMatchObject({ name: 'Trial Champion', elements: ['war', 'metal'], rarity: 'legendary' })
    expect(sp(t[1]!.speciesId).rarity).toBe('epic')
    expect(sp(t[2]!.speciesId).rarity).toBe('epic')
    expect(primary(t[2]!.speciesId)).not.toBe('war')
    for (const n of nodes.slice(0, 9)) expect(nodeTeam(10, n, C).some(d => d.speciesId === 'trial-champion')).toBe(false)
  })
  it('a chapter whose top rarity has one on-element species uses it twice (Dark-Terra, War-Sea)', () => {
    expect(nodeTeam(8, 7, C).slice(0, 2).map(d => d.speciesId)).toEqual(['dark-terra', 'dark-terra'])
    expect(nodeTeam(10, 3, C).slice(0, 2).map(d => d.speciesId)).toEqual(['war-sea', 'war-sea'])
    expect(nodeTeam(10, 10, C)[1]!.speciesId).toBe('war-sea')
  })
  it('wildcards rotate: a chapter shows more than one off-element', () => {
    for (const c of TRIAL_CHAPTERS) {
      const ws = new Set(nodes.map(n => primary(nodeTeam(c.chapter, n, C)[2]!.speciesId)))
      expect(ws.size, `chapter ${c.chapter}`).toBeGreaterThan(1)
    }
  })
})

describe('the Trial Champion is not a breed result (A21)', () => {
  it('has no event window, so no breeding pool holds it, whatever the day', () => {
    expect(LEGENDARY_EVENTS.some(e => e.speciesId === 'trial-champion')).toBe(false)
    const all = [...C.species.values()]
    const ctx = { activeLegendaries: LEGENDARY_EVENTS.map(e => e.speciesId), firstHybridPending: false }
    for (const a of all.filter(s => s.elements.length === 1)) {
      for (const b of all.filter(s => s.elements.length === 1)) {
        expect(breedingPool(a, b, ctx, C).some(e => e.species.id === 'trial-champion'), `${a.id} x ${b.id}`).toBe(false)
      }
    }
    const war = sp('war'), metal = sp('metal'), wm = sp('war-metal')
    for (const [a, b] of [[war, metal], [wm, wm], [wm, war], [wm, metal]] as const) {
      expect(breedingPool(a, b, ctx, C).some(e => e.species.id === 'trial-champion')).toBe(false)
    }
  })
  it('cannot be sold, and no PvP bot draws it', () => {
    expect(SELL_GOLD[sp('trial-champion').rarity]).toBeNull()
    expect(BOT_RARITIES).not.toContain('legendary')
    for (let seed = 0; seed < 200; seed++) {
      expect(generateBotTeam(30, C, createRng(seed)).some(d => d.speciesId === 'trial-champion')).toBe(false)
    }
  })
  it('makes the catalog 107', () => {
    expect(C.species.size).toBe(107)
  })
})

describe('nodeRewards', () => {
  it('first clears: 1,000 x ch² Gold, 50 x ch² Food, 20 x ch XP, the Boss x3 (A19)', () => {
    expect(nodeRewards(1, 1, 'first')).toEqual({ gold: 1000, food: 50, xp: 20 })
    expect(nodeRewards(10, 10, 'first')).toEqual({ gold: 300_000, food: 15_000, xp: 600 })
    expect(nodeRewards(2, 10, 'first')).toEqual({ gold: 12_000, food: 600, xp: 120 })
  })
  it('replays: half of the node reward, floored, no XP (R73)', () => {
    expect(nodeRewards(3, 2, 'replay')).toEqual({ gold: 4500, food: 225, xp: 0 })
    expect(nodeRewards(3, 10, 'replay')).toEqual({ gold: 13_500, food: 675, xp: 0 })
    expect(nodeRewards(1, 1, 'replay')).toEqual({ gold: 500, food: 25, xp: 0 })
  })
  it('is whole numbers everywhere', () => {
    for (const c of TRIAL_CHAPTERS) for (const n of nodes) for (const k of ['first', 'replay'] as const) {
      for (const v of Object.values(nodeRewards(c.chapter, n, k))) expect(Number.isInteger(v)).toBe(true)
    }
  })
})

describe('starsFor (A18: turns count both sides)', () => {
  it('0 for a loss, 1 for a win with a KO, 2 for no KOs, 3 for no KOs in 8 turns', () => {
    expect(starsFor(false, 0, 3)).toBe(0)
    expect(starsFor(true, 1, 3)).toBe(1)
    expect(starsFor(true, 0, 9)).toBe(2)
    expect(starsFor(true, 0, 8)).toBe(3)
    expect(starsFor(true, 1, 5)).toBe(1)
    expect(starsFor(true, 3, 30)).toBe(1)
  })
})

describe('nodeLocked (R71)', () => {
  it('a chapter needs its PL', () => {
    expect(nodeLocked(at(4, stars([[1, 10, 1]])), 2, 1)).toBe('LEVEL')
    expect(nodeLocked(at(3), 1, 1)).toBe('LEVEL')
    expect(nodeLocked(at(4), 1, 1)).toBeNull()
  })
  it('a chapter needs the previous Boss', () => {
    expect(nodeLocked(at(5), 2, 1)).toBe('PREVIOUS')
    expect(nodeLocked(at(5, stars([[1, 9, 3]])), 2, 1)).toBe('PREVIOUS')
    expect(nodeLocked(at(5, stars([[1, 10, 1]])), 2, 1)).toBeNull()
  })
  it('nodes go in order', () => {
    expect(nodeLocked(at(4), 1, 2)).toBe('PREVIOUS')
    expect(nodeLocked(at(4, stars([[1, 1, 1]])), 1, 2)).toBeNull()
    expect(nodeLocked(at(4, stars([[1, 1, 1]])), 1, 3)).toBe('PREVIOUS')
  })
  it('a cleared node can be replayed', () => {
    expect(nodeLocked(at(4, stars([[1, 1, 2]])), 1, 1)).toBeNull()
    expect(nodeLocked(at(4, stars([[1, 1, 2], [1, 2, 1]])), 1, 2)).toBeNull()
  })
})

describe('state', () => {
  it('starts with no stars on state version 11', () => {
    expect(STATE_VERSION).toBe(11)
    expect(newPlayer(0).pve.stars).toEqual({})
    const k: NodeKey = '1:1'
    expect(k).toBe('1:1')
  })
})

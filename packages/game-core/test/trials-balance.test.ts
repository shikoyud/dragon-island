// Task 6: the Trials' balance, measured (GDD §5.7, §6.2, §6.3; R40, R41, A18, A19). Nothing here tunes a number: the literals are what the
// GDD's own values give, on seeded battles, and TRIALS_REPORT=1 prints the tables behind them.
import { beforeAll, describe, expect, it } from 'vitest'
import type { BattleOutcome, PlayerMove } from '../src/battle/machine'
import type { BattleState } from '../src/battle/machine'
import { simulateBattle } from '../src/battle/sim'
import type { BattleDragonSpec } from '../src/battle/stats'
import { combatStats } from '../src/battle/stats'
import type { Species } from '../src/catalog'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { FLASH_14, FLASH_28 } from '../src/data/presets'
import { BOSS_NODE, NODES_PER_CHAPTER, TRIAL_CHAPTERS, type TrialChapter } from '../src/data/trials'
import { ELEMENTS, elementMultiplier, type Element } from '../src/elements'
import { RARITIES, type Rarity } from '../src/rarity'
import { createRng } from '../src/rng'
import { nodeKey, nodeLevel, nodeTeam, starsFor } from '../src/trials'
import { getSpecies } from '../src/catalog'
import { aiPlayer, casual, greedyChoice, playBattle, runBot, trialStrength, withTrials, type BotResult } from './helpers/xpBots'

const c = LAUNCH_CATALOG
const SEEDS = 100
const STAR_SEEDS = 30
const REPORT = process.env.TRIALS_REPORT === '1'
/** The value is a thunk, so a run with the report off does none of the work that only the report wants. */
const say = (label: string, v: () => unknown) => { if (REPORT) console.log(`${label} ${JSON.stringify(v())}`) }
/** A bot or a Boss sweep is the slow part: it runs under this, in `beforeAll`, not at collection time. */
const BOT_TIMEOUT_MS = 120_000

type Player = 'greedy' | 'ai'
const PLAYERS: readonly Player[] = ['greedy', 'ai']

/** Species with this primary at exactly this rarity, by id; Legendaries are never fielded (they are not bred). */
const poolAt = (element: Element, rarity: Rarity): Species[] =>
  [...c.species.values()].filter(s => s.rarity === rarity && s.rarity !== 'legendary' && s.elements[0] === element).sort((a, b) => (a.id < b.id ? -1 : 1))
/** The pool at `rarity`, or at the next rarity down that has one (Metal and Light have no Epic). */
const poolNear = (element: Element, rarity: Rarity): Species[] => {
  for (let i = RARITIES.indexOf(rarity); i >= 0; i--) {
    const p = poolAt(element, RARITIES[i]!)
    if (p.length > 0) return p
  }
  throw new Error(`no species for ${element}`)
}
/** Two of the chapter's first counter and one of its second, each the first species of its pool (the second of the first counter's if it has one). */
const counterTeam = (ch: TrialChapter, rarity: Rarity, level: number): BattleDragonSpec[] => {
  const [a, b] = ch.counters
  const pa = poolNear(a, rarity), pb = poolNear(b, rarity)
  return [pa[0]!, pb[0]!, pa[1] ?? pa[0]!].map(s => ({ speciesId: s.id, level }))
}
const nodeRarity = (ch: TrialChapter, node: number): Rarity => (node <= NODES_PER_CHAPTER / 2 ? ch.rarities[0] : ch.rarities[1] ?? ch.rarities[0])
/** A Legendary Boss is met by Epics: the highest rarity a player can breed. */
const bossRarity = (ch: TrialChapter): Rarity => (ch.boss === 'legendary' ? 'epic' : ch.boss)

/** One battle: the player's moves are chosen against `createRng(seed)`, then replayed by `simulateBattle` exactly as `finishTrial` would. */
function fight(att: readonly BattleDragonSpec[], def: readonly BattleDragonSpec[], seed: number, player: Player): Extract<BattleOutcome, { ok: true }> {
  const choose: (b: BattleState) => PlayerMove = player === 'greedy' ? greedyChoice : aiPlayer(seed + 7_000_000)
  const moves = playBattle(att, def, seed, choose)
  const out = simulateBattle(att, def, moves, createRng(seed), c)
  if (!out.ok) throw new Error(`illegal move list: ${out.error}`)
  return out
}

interface Tally { fights: number; wins: number; stars: [number, number, number]; turns: number; restFrac: number; restSlowFrac: number }
const empty = (): Tally => ({ fights: 0, wins: 0, stars: [0, 0, 0], turns: 0, restFrac: 0, restSlowFrac: 0 })
/** Fraction of max HP lost over the team's dragons after a battle (a KO returns at 1 HP, R68). */
function tally(t: Tally, att: readonly BattleDragonSpec[], o: Extract<BattleOutcome, { ok: true }>) {
  t.fights++
  t.turns += o.turns
  const lost = att.map((d, i) => { const max = combatStats(d, c).hp; return (max - Math.max(1, o.attacker[i]!)) / max })
  t.restFrac += lost.reduce((x, y) => x + y, 0) / 3
  t.restSlowFrac += Math.max(...lost)
  if (o.winner !== 'attacker') return
  t.wins++
  t.stars[starsFor(true, o.attackerKos, o.turns) - 1]!++
}

/** Every node of a chapter against a counter team of the node's rarity at the node's level plus `bonus`. */
function chapterRun(ch: TrialChapter, bonus: number, player: Player): Tally {
  const t = empty()
  for (let node = 1; node <= NODES_PER_CHAPTER; node++) {
    const att = counterTeam(ch, nodeRarity(ch, node), nodeLevel(ch.chapter, node) + bonus)
    const def = nodeTeam(ch.chapter, node, c)
    for (let i = 0; i < STAR_SEEDS; i++) tally(t, att, fight(att, def, 20_000 + ch.chapter * 1000 + node * 40 + i, player))
  }
  return t
}

/** Boss wins out of SEEDS for a counter team of `rarity` at the Boss's level. */
function bossWins(ch: TrialChapter, rarity: Rarity, player: Player): number {
  const att = counterTeam(ch, rarity, nodeLevel(ch.chapter, BOSS_NODE))
  const def = nodeTeam(ch.chapter, BOSS_NODE, c)
  let wins = 0
  for (let i = 0; i < SEEDS; i++) if (fight(att, def, 50_000 + ch.chapter * 1000 + i, player).winner === 'attacker') wins++
  return wins
}

describe('every Boss falls to a counter team (§6.3)', () => {
  let rows: { ch: number; top: [number, number]; equal: [number, number] }[]
  beforeAll(() => {
    rows = TRIAL_CHAPTERS.map(ch => ({
      ch: ch.chapter,
      top: PLAYERS.map(p => bossWins(ch, 'epic', p)) as [number, number],
      equal: PLAYERS.map(p => bossWins(ch, bossRarity(ch), p)) as [number, number],
    }))
    say('boss wins of 100 [greedy, ai] at top rarity (Epic, or the best the element has) / at the Boss rarity', () => rows)
  }, BOT_TIMEOUT_MS)

  it('at the chapter\'s top level and top rarity, a greedy player wins above 50 % in every chapter', () => {
    for (const r of rows) expect(r.top[0], `chapter ${r.ch}`).toBeGreaterThan(SEEDS / 2)
  })
  it('the same with the enemy\'s own AI as the player', () => {
    for (const r of rows) expect(r.top[1], `chapter ${r.ch}`).toBeGreaterThan(SEEDS / 2)
  })
  it('measured wins of 100 at top rarity, greedy then AI, by chapter', () => {
    expect(rows.map(r => r.top)).toEqual(MEASURED.bossTop)
  })
  it('measured wins of 100 at equal rarity, greedy then AI, by chapter', () => {
    expect(rows.map(r => r.equal)).toEqual(MEASURED.bossEqual)
  })
})

describe('stars, turns and rest at equal level and at +5 levels (A18, A19, §6.2, §6.3)', () => {
  const runs = (bonus: number, player: Player) => TRIAL_CHAPTERS.map(ch => chapterRun(ch, bonus, player))
  let equal: Tally[], plus5: Tally[], equalAi: Tally[]
  const row = (t: Tally) => [t.wins, ...t.stars]
  const sum = (ts: Tally[]) => ts.reduce((a, t) => ({ ...a, fights: a.fights + t.fights, turns: a.turns + t.turns, restFrac: a.restFrac + t.restFrac, restSlowFrac: a.restSlowFrac + t.restSlowFrac }), empty())
  const meanTurns = (ts: Tally[]) => { const s = sum(ts); return Math.round((s.turns * 100) / s.fights) }
  const rest = (ts: Tally[], pct: number) => { const s = sum(ts); return [Math.round((s.restFrac * 100 * 100) / s.fights / pct) / 100, Math.round((s.restSlowFrac * 100 * 100) / s.fights / pct) / 100] }
  beforeAll(() => {
    equal = runs(0, 'greedy')
    plus5 = runs(5, 'greedy')
    equalAi = runs(0, 'ai')
    say('equal level, greedy: [wins of 300, 1-star, 2-star, 3-star] by chapter', () => equal.map(row))
    say('+5 levels, greedy', () => plus5.map(row))
    say('equal level, ai', () => equalAi.map(row))
    say('mean turns x100 [equal greedy, +5 greedy, equal ai]', () => [meanTurns(equal), meanTurns(plus5), meanTurns(equalAi)])
    say('rest minutes per battle [mean over the team, slowest] at Flash-14 / Flash-28 (equal level, greedy)', () => [rest(equal, FLASH_14.healPctPerMin), rest(equal, FLASH_28.healPctPerMin)])
    say('rest minutes per battle at +5 levels', () => [rest(plus5, FLASH_14.healPctPerMin), rest(plus5, FLASH_28.healPctPerMin)])
  }, BOT_TIMEOUT_MS)

  it('measured [wins, 1-star, 2-star, 3-star] of 300 per chapter at equal level, greedy', () => {
    expect(equal.map(row)).toEqual(MEASURED.starsEqual)
  })
  it('measured [wins, 1-star, 2-star, 3-star] of 300 per chapter at +5 levels, greedy', () => {
    expect(plus5.map(row)).toEqual(MEASURED.starsPlus5)
  })
  it('mean turns per battle x100 (equal level, +5, AI player) against §6.2\'s 10-16', () => {
    expect([meanTurns(equal), meanTurns(plus5), meanTurns(equalAi)]).toEqual(MEASURED.turnsX100)
  })
  it('minutes of rest per battle x100 (mean, slowest) at Flash-14 and Flash-28', () => {
    expect([rest(equal, FLASH_14.healPctPerMin), rest(equal, FLASH_28.healPctPerMin)].map(r => r.map(x => Math.round(x * 100)))).toEqual(MEASURED.restX100)
  })
})

describe('a 1v1 between equals (§6.2: about 2 turns)', () => {
  /** Neutral both ways: every pair of Basics where neither element is strong, resisted or immune against the other. */
  const pairs = ELEMENTS.flatMap(a => ELEMENTS.filter(b => a < b && elementMultiplier(a, b) === 1 && elementMultiplier(b, a) === 1).map(b => [a, b] as const))
  const turns = (level: number) => {
    let sum = 0, n = 0
    for (const [a, b] of pairs) {
      for (let i = 0; i < 20; i++, n++) {
        const att = [{ speciesId: a, level }], def = [{ speciesId: b, level }]
        sum += fight(att, def, 80_000 + n, 'greedy').turns
      }
    }
    return { n, mean100: Math.round((sum * 100) / n) }
  }
  it('measured mean turns x100 at levels 10 and 40', () => {
    const measured = [turns(10).mean100, turns(40).mean100]
    say('1v1 neutral Basics: pairs and mean turns x100 at Lv 10 / Lv 40', () => [pairs.length, ...measured])
    expect(measured).toEqual(MEASURED.oneVOneX100)
  })
})

describe('Chapter 1 for a PL 4 starter team of Terra, Flame and the first hybrid', () => {
  const team = (level: number): BattleDragonSpec[] => ['terra', 'flame', 'terra-flame'].map(speciesId => ({ speciesId, level }))
  const nodeWins = (level: number, player: Player) => Array.from({ length: NODES_PER_CHAPTER }, (_, k) => {
    let wins = 0
    for (let i = 0; i < SEEDS; i++) if (fight(team(level), nodeTeam(1, k + 1, c), 90_000 + k * 200 + i, player).winner === 'attacker') wins++
    return wins
  })
  let l4: number[]
  beforeAll(() => {
    l4 = nodeWins(4, 'greedy')
    say('chapter 1 node wins of 100 for Lv 4 [greedy, ai], and Lv 3 / Lv 5 greedy', () => [l4, nodeWins(4, 'ai'), nodeWins(3, 'greedy'), nodeWins(5, 'greedy')])
  }, BOT_TIMEOUT_MS)

  it('node 1 has a Sea wildcard', () => {
    expect(nodeTeam(1, 1, c).map(d => d.speciesId)).toEqual(MEASURED.node1Team)
  })
  it('every node wins above 50 % at Lv 4, node 1 and its Sea wildcard included', () => {
    for (const [k, w] of l4.entries()) expect(w, `node ${k + 1}`).toBeGreaterThan(SEEDS / 2)
  })
  it('measured node wins of 100 at Lv 4, greedy', () => {
    expect(l4).toEqual(MEASURED.starterLv4)
  })
})

describe('the casual bot with Trials, on the Gold and Food the game gives', () => {
  const runs: Record<string, BotResult> = {}
  const share = (r: BotResult) => Math.round((r.trials.goldTrials * 10_000) / (r.trials.goldTrials + r.trials.goldOther)) // basis points
  beforeAll(() => {
    for (const [id, preset, days] of [['flash14', FLASH_14, 12], ['flash28', FLASH_28, 25]] as const) {
      runs[id] = runBot(withTrials(casual(preset, 50, days)))
    }
    for (const id of ['flash14', 'flash28']) {
      const r = runs[id]!
      say(`${id}: Boss first fell (chapter:day)`, () => [...r.trials.bossFell].map(([ch, d]) => `${ch}:${d.day}`))
      say(`${id}: fights, wins, Trials share of Gold in basis points (§5.7: 300), heal-alls wanted`, () => [r.trials.fights.length, r.trials.fights.filter(f => f.won).length, share(r), r.trials.healAllsWanted])
      // Where the bot stalls: its roster, strongest first (hp x atk, as fightTrials picks its three), and the first node it has not cleared. Seed 1.
      say(`${id}: roster at the end of the run, strongest first: [id, species, rarity, elements, level]; the first node not cleared`, () => ({
        roster: [...r.final.dragons].sort((a, b) => trialStrength(b) - trialStrength(a)).map(d => {
          const sp = getSpecies(c, d.speciesId)
          return [d.id, sp.id, sp.rarity, sp.elements.join('/'), d.level]
        }),
        firstUncleared: TRIAL_CHAPTERS.flatMap(ch => Array.from({ length: NODES_PER_CHAPTER }, (_, i) => nodeKey(ch.chapter, i + 1))).find(k => !r.final.pve.stars[k]) ?? null,
      }))
    }
  }, BOT_TIMEOUT_MS)
  it('measured: the day each Boss first falls (chapter, day) on Flash-14 and Flash-28', () => {
    expect(Object.fromEntries(Object.entries(runs).map(([id, r]) => [id, [...r.trials.bossFell].map(([ch, d]) => [ch, d.day])]))).toEqual(MEASURED.bossDays)
  })
  // Reported, not pinned: the share is one seed's, and Trials pay first clears only. It is a floor under §5.7's 300, never over it.
  it('Trials\' share of Gold earned is a real floor under §5.7\'s 3 %: above 0, at most 300 basis points', () => {
    for (const [id, r] of Object.entries(runs)) {
      expect(share(r), id).toBeGreaterThan(0)
      expect(share(r), id).toBeLessThanOrEqual(300)
    }
  })
})

/** From TRIALS_REPORT=1 runs; every number is what the GDD's values produce, with nothing tuned. */
const MEASURED = {
  // Chapter 8 (Dark Hollow) is the hardest Boss: its Epic Boss meets Light (no Epic exists) and War.
  bossTop: [[100, 100], [100, 100], [100, 100], [100, 100], [100, 100], [100, 98], [100, 100], [83, 62], [100, 99], [100, 100]],
  bossEqual: [[100, 100], [100, 100], [100, 97], [100, 95], [98, 84], [100, 95], [100, 100], [83, 62], [93, 85], [100, 100]],
  // Equal level: nearly every win costs a KO, so 3 stars (no KOs in 8 turns) is rare.
  starsEqual: [[300, 264, 35, 1], [300, 260, 38, 2], [300, 287, 12, 1], [281, 281, 0, 0], [281, 281, 0, 0], [285, 284, 0, 1], [272, 272, 0, 0], [184, 183, 0, 1], [289, 289, 0, 0], [300, 289, 1, 10]],
  starsPlus5: [[300, 111, 122, 67], [300, 93, 92, 115], [300, 145, 86, 69], [300, 267, 23, 10], [297, 289, 3, 5], [300, 270, 5, 25], [285, 278, 3, 4], [255, 254, 0, 1], [299, 299, 0, 0], [300, 275, 5, 20]],
  turnsX100: [1079, 880, 1164],
  restX100: [[1049, 1658], [1574, 2488]],
  oneVOneX100: [476, 311],
  node1Team: ['terra', 'terra', 'sea'],
  starterLv4: [100, 100, 100, 100, 100, 100, 100, 95, 96, 100],
  bossDays: {
    // Flash-14 gained [6, 3] with the UI rework's plot spawns (obstacle gap, U7): the bot's layout and clears shift, one seed, no rule broken. See task-1-report.md.
    flash14: [[1, 1], [2, 1], [3, 2], [4, 3], [5, 3], [6, 3]],
    flash28: [[1, 1], [2, 1], [3, 1], [4, 3], [5, 4], [6, 4]],
  } as Record<string, number[][]>,
}

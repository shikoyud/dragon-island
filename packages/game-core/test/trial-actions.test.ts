// §6.3, A8, R68-R70, R73, R78: Trials are frozen at the start, re-simulated at the end, and cost something to leave. Review Focus 2, 3 and 5.
import { describe, expect, it } from 'vitest'
import {
  applyAction, battlePreview, createRng, currentHp, FLASH_14, FLASH_28, HEAL_ALL_MICRO_USD, isValidAction, LAUNCH_CATALOG, legalMoves, levelLimit, maxHp, newPlayer,
  nodeRewards, nodeTeam, priceMicroUsd, simulateBattle, xpToNext,
  type Action, type ActionResult, type ActiveTrial, type BattleDragonSpec, type Dragon, type PlayerMove, type PlayerState, type Preset,
} from '../src/index'
import { err, ok } from './helpers'

const C = LAUNCH_CATALOG
const TEAM: [string, string, string] = ['d1', 'd2', 'd3']
const MIN = 60_000
const SEED = 7
const team = (speciesId: string, level: number, over: Partial<Dragon> = {}): Dragon[] => TEAM.map(id => ({ id, speciesId, level, feeds: 0, habitatId: null, ...over }))
const at = (level: number, dragons: Dragon[], pve: Partial<PlayerState['pve']> = {}): PlayerState => {
  const s = newPlayer(0)
  return { ...s, level, dragons, pve: { ...s.pve, ...pve } }
}
/** Sea L20 sweeps Chapter 1. */
const strong = at(4, team('sea', 20))
const run = (s: PlayerState, a: Action, t = 0, day = 1, preset: Preset = FLASH_14, seed = SEED) => applyAction(s, a, t, createRng(seed), C, preset, day)
const start = (chapter = 1, node = 1, ids = TEAM): Action => ({ type: 'startTrial', chapter, node, team: ids })
const activeOf = (s: PlayerState): ActiveTrial => s.pve.active!
const started = (s: PlayerState = strong, chapter = 1, node = 1, t = 0, day = 1) => ok(run(s, start(chapter, node), t, day))
const sim = (a: ActiveTrial, moves: readonly PlayerMove[], seed = SEED) => simulateBattle(a.specs, nodeTeam(a.chapter, a.node, C), moves, createRng(seed), C)

type Picker = (legal: PlayerMove[]) => PlayerMove
// Strike: Physical is never immune, and node 1's wildcard is Sea (immune to this team's Sea moves).
const strike: Picker = legal => legal.find(m => m.kind === 'attack' && m.move === 0) ?? legal[0]!
const swapOnly: Picker = legal => legal.find(m => m.kind === 'swap') ?? legal[0]!

/** A complete, legal list: asks the preview what's allowed, as the client does. */
function play(a: ActiveTrial, pick: Picker = strike, seed = SEED): PlayerMove[] {
  const moves: PlayerMove[] = []
  const enemies = nodeTeam(a.chapter, a.node, C)
  for (;;) {
    const p = battlePreview(a.specs, enemies, moves, createRng(seed), C)
    if (p.done) return moves
    moves.push(pick(legalMoves(p.state, 'attacker')))
  }
}
const finish = (s: PlayerState, pick: Picker = strike, t = 0, day = 1, preset: Preset = FLASH_14): ActionResult =>
  run(s, { type: 'finishTrial', moves: play(activeOf(s), pick) }, t, day, preset)
const win = (s: PlayerState = strong, chapter = 1, node = 1) => {
  const r = finish(started(s, chapter, node))
  if (!r.ok || r.trial?.won !== true) throw new Error('expected a win')
  return { r, state: r.state, trial: r.trial }
}
/** `n` wins of a node in one state line. */
const starsUpTo = (chapter: number, node: number) =>
  Object.fromEntries(Array.from({ length: node }, (_, i) => [`${chapter}:${i + 1}`, 1])) as PlayerState['pve']['stars']

describe('startTrial refusals, which change nothing', () => {
  const refused = (s: PlayerState, a: Action, error: Parameters<typeof err>[1]) => {
    const before = JSON.stringify(s)
    err(run(s, a), error)
    expect(JSON.stringify(s)).toBe(before)
  }

  it('LEVEL_TOO_LOW below the chapter PL', () => {
    refused(at(3, team('sea', 20)), start(), 'LEVEL_TOO_LOW')
    refused(at(4, team('sea', 20), { stars: { '1:10': 1 } }), start(2, 1), 'LEVEL_TOO_LOW')
  })

  it('STAGE_LOCKED for a locked node', () => {
    refused(strong, start(1, 2), 'STAGE_LOCKED')
    refused(at(5, team('sea', 20)), start(2, 1), 'STAGE_LOCKED')
  })

  it('INVALID_TEAM for fewer than 3 owned, or duplicates', () => {
    refused(at(4, newPlayer(0).dragons), start(1, 1, ['d1', 'd2', 'dX']), 'INVALID_TEAM')
    refused(strong, start(1, 1, ['d1', 'd1', 'd2']), 'INVALID_TEAM')
  })

  it('DRAGON_TIRED under 25 %, on any member', () => {
    const dragons = team('terra', 40)
    const s = at(4, [dragons[0]!, dragons[1]!, { ...dragons[2]!, fatigue: { hp: 1_999, atMs: 0 } }])
    refused(s, start(), 'DRAGON_TIRED')
    expect(ok(run({ ...s, dragons: [dragons[0]!, dragons[1]!, { ...dragons[2]!, fatigue: { hp: 2_000, atMs: 0 } }] }, start())).pve.active).not.toBeNull()
  })

  it('TRIAL_ACTIVE while one runs: a second start is refused and the seed stays the same', () => {
    refused(started(), start(), 'TRIAL_ACTIVE')
  })

  it('DAILY_CAP_REACHED at the 6th replay of a node in a game day', () => {
    let s: PlayerState = at(4, team('sea', 20), { stars: { '1:1': 1 } })
    for (let i = 0; i < 5; i++) s = rest(ok(run(ok(run(s, start())), { type: 'abandonTrial' })))
    expect(s.pve.replays.counts).toEqual({ '1:1': 5 })
    refused(s, start(), 'DAILY_CAP_REACHED')
  })
})

/** Clears fatigue, to test what comes after an abandon without the wait. */
const rest = (s: PlayerState): PlayerState => ({ ...s, dragons: s.dragons.map(({ fatigue: _, ...d }) => d) })

describe('malformed starts stop at the boundary', () => {
  it('chapter and node are integers in 1..10, ahead of nodeLocked', () => {
    for (const [chapter, node] of [[0, 1], [11, 1], [1, 0], [1, 11], [1.5, 1], [1, 1.5], ['1', 1], [null, 1]] as const) {
      expect(isValidAction({ type: 'startTrial', chapter, node, team: TEAM })).toBe(false)
      expect(run(strong, { type: 'startTrial', chapter, node, team: TEAM } as unknown as Action)).toEqual({ ok: false, error: 'INVALID_ACTION' })
    }
    expect(isValidAction(start(10, 10))).toBe(true)
  })
  it('a team of fewer than three ids is malformed', () => {
    expect(run(strong, { type: 'startTrial', chapter: 1, node: 1, team: ['d1', 'd2'] } as unknown as Action)).toEqual({ ok: false, error: 'INVALID_ACTION' })
  })
  it('finishTrial needs well-formed moves, and the pveBattle action is gone', () => {
    expect(isValidAction({ type: 'finishTrial', moves: [{ kind: 'nope' }] })).toBe(false)
    expect(isValidAction({ type: 'finishTrial', moves: [] })).toBe(true)
    expect(isValidAction({ type: 'abandonTrial' })).toBe(true)
    expect(isValidAction({ type: 'pveBattle', stage: 1, team: TEAM, moves: [] })).toBe(false)
  })
})

describe('startTrial success', () => {
  it('freezes node, team, levels and HP, and names the seed by `battles` (R69)', () => {
    const dragons = team('terra', 40)
    const s = at(4, [{ ...dragons[0]!, fatigue: { hp: 1, atMs: 0 } }, dragons[1]!, dragons[2]!], { battles: 6 })
    const a = ok(run(s, start(), 5 * MIN)).pve.active
    expect(a).toEqual({
      chapter: 1, node: 1, team: TEAM, index: 6, startedAtMs: 5 * MIN, replay: false,
      specs: [{ speciesId: 'terra', level: 40, hp: 2_401 }, { speciesId: 'terra', level: 40, hp: 8_000 }, { speciesId: 'terra', level: 40, hp: 8_000 }],
    })
  })

  it('a first attempt counts no replay; a replay counts now, at the start', () => {
    expect(started().pve.replays).toEqual({ day: 1, counts: {} })
    const s = started({ ...strong, pve: { ...strong.pve, stars: { '1:1': 2 } } }, 1, 1, 0, 3)
    expect(s.pve.replays).toEqual({ day: 3, counts: { '1:1': 1 } })
    expect(activeOf(s).replay).toBe(true)
  })

  it('the replay counter rolls on a new game day, and a clock stepping back does not reset it', () => {
    const s = { ...strong, pve: { ...strong.pve, stars: { '1:1': 1 } as PlayerState['pve']['stars'], replays: { day: 3, counts: { '1:1': 5 } } } }
    err(run(s, start(), 0, 3), 'DAILY_CAP_REACHED')
    err(run(s, start(), 0, 2), 'DAILY_CAP_REACHED')
    expect(ok(run(s, start(), 0, 4)).pve.replays).toEqual({ day: 4, counts: { '1:1': 1 } })
  })

  it('5 replays of node A leave node B alone', () => {
    const s = { ...strong, pve: { ...strong.pve, stars: starsUpTo(1, 2), replays: { day: 1, counts: { '1:1': 5 } } } }
    err(run(s, start(1, 1)), 'DAILY_CAP_REACHED')
    expect(ok(run(s, start(1, 2))).pve.replays.counts).toEqual({ '1:1': 5, '1:2': 1 })
  })
})

describe('finishTrial', () => {
  it('NO_ACTIVE_TRIAL with none', () => {
    err(run(strong, { type: 'finishTrial', moves: [] }), 'NO_ACTIVE_TRIAL')
  })

  it('a win pays a first clear per nodeRewards: 240 XP on Flash-14 Ch 1 node 1', () => {
    const { r, state, trial } = win()
    const reward = nodeRewards(1, 1, 'first')
    expect(reward).toEqual({ gold: 1_000, food: 50, xp: 20 })
    expect([state.gold, state.food, state.xp]).toEqual([strong.gold + 1_000, strong.food + 50, 240])
    expect(trial).toMatchObject({ won: true, gold: 1_000, food: 50, xp: 240, first: true })
    expect(state.pve.stars['1:1']).toBe(trial.stars)
    expect(state.pve.active).toBeNull()
    expect(state.pve.battles).toBe(1)
    expect(r.ok && r.battle?.winner).toBe('attacker')
    expect(r.ok && r.effects).toEqual([])
  })

  it('Gold and Food are flat across presets, and XP takes xpMult (R73)', () => {
    const s = ok(run(strong, start(), 0, 1, FLASH_28))
    const r = finish(s, strike, 0, 1, FLASH_28)
    const a = ok(r)
    expect([a.gold, a.food, a.xp]).toEqual([strong.gold + 1_000, strong.food + 50, 160])
    expect(r.ok && r.trial?.xp).toBe(160)
  })

  it('XP above the day\'s limit banks (R41, R73)', () => {
    const top = levelLimit(1, FLASH_14)!
    const s: PlayerState = { ...at(top, team('sea', 20)), xp: xpToNext(top) }
    const a = ok(finish(started(s)))
    expect([a.level, a.xp]).toEqual([top, xpToNext(top) + 240])
  })

  it('re-simulates exactly from `active`: same seed and moves give the client\'s outcome', () => {
    const s = started()
    const moves = play(activeOf(s))
    const r = run(s, { type: 'finishTrial', moves })
    expect(r.ok && r.battle).toEqual(sim(activeOf(s), moves))
  })

  it('a first clear is the first ever win: a replay pays 50 %, no XP, and stars stay at the best', () => {
    const cleared = win().state
    expect(cleared.pve.stars['1:1']).toBeGreaterThan(0)
    // Stay at the best: a record of 3 survives a replay whatever it scores.
    const replay = started({ ...cleared, pve: { ...cleared.pve, stars: { '1:1': 3 } } })
    expect(activeOf(replay).replay).toBe(true)
    const r = finish(replay)
    const a = ok(r)
    expect(r.ok && r.trial?.first).toBe(false)
    expect(nodeRewards(1, 1, 'replay')).toEqual({ gold: 500, food: 25, xp: 0 })
    expect([a.gold - replay.gold, a.food - replay.food, a.xp - replay.xp]).toEqual([500, 25, 0])
    expect(r.ok && r.trial).toMatchObject({ gold: 500, food: 25, xp: 0 })
    expect(a.pve.stars['1:1']).toBe(3)
  })

  it('a replay that does better raises the stars', () => {
    const s = started({ ...strong, pve: { ...strong.pve, stars: { '1:1': 1 } } })
    const r = finish(s)
    expect(r.ok && r.trial?.stars).toBeGreaterThan(1)
    expect(ok(r).pve.stars['1:1']).toBe(r.ok ? r.trial?.stars : 0)
  })

  it('a Boss pays ×3 and a replay half of that (R73)', () => {
    const s = at(4, team('sea', 30), { stars: starsUpTo(1, 9) })
    const { state, trial } = win(s, 1, 10)
    expect(trial).toMatchObject({ gold: 3_000, food: 150, xp: 720, first: true })
    expect(state.gold).toBe(s.gold + 3_000)
    const again = finish(started(rest(state), 1, 10))
    expect(again.ok && again.trial).toMatchObject({ gold: 1_500, food: 75, xp: 0, first: false })
  })

  it('a loss pays nothing and carries real HP, with the turn limit ending it (R70: a complete list is no forfeit)', () => {
    const s = at(4, team('terra', 40))
    const r = finish(started(s), swapOnly, 3 * MIN)
    const a = ok(r)
    if (!r.ok || !r.battle) throw new Error('expected a report')
    expect([r.battle.winner, r.battle.turns]).toEqual(['defender', 30])
    expect([a.gold, a.food, a.xp, a.pve.stars]).toEqual([s.gold, s.food, 0, {}])
    expect(r.trial).toEqual({ won: false, stars: 0, gold: 0, food: 0, xp: 0, first: false })
    expect([a.pve.active, a.pve.battles]).toEqual([null, 1])
    a.dragons.forEach((d, i) => {
      const hp = r.battle!.attacker[i]!
      expect(d.fatigue).toEqual(hp < 8_000 ? { hp, atMs: 3 * MIN } : undefined)
    })
    expect(r.battle.attacker.some(h => h < 8_000)).toBe(true)
  })

  it('KOs come back on 1 HP', () => {
    const s = at(40, team('terra', 1), { stars: { '9:10': 1 } })
    const r = finish(ok(run(s, start(10, 1))), strike, 2 * MIN)
    const a = ok(r)
    expect(r.ok && r.battle?.winner).toBe('defender')
    for (const d of a.dragons) expect(d.fatigue).toEqual({ hp: 1, atMs: 2 * MIN })
  })

  it('a short or illegal list is a loss with the whole team on 1 HP, and no report (R70)', () => {
    const s = started()
    const moves = play(activeOf(s))
    for (const bad of [moves.slice(0, -1), [], [{ kind: 'replace', to: 1 } as PlayerMove]]) {
      const r = run(s, { type: 'finishTrial', moves: bad }, 4 * MIN)
      const a = ok(r)
      expect(r.ok && r.battle).toBeUndefined()
      expect(r.ok && r.trial).toEqual({ won: false, stars: 0, gold: 0, food: 0, xp: 0, first: false })
      expect([a.gold, a.food, a.xp, a.pve.active, a.pve.battles, a.pve.stars]).toEqual([strong.gold, strong.food, 0, null, 1, {}])
      for (const d of a.dragons) expect(d.fatigue).toEqual({ hp: 1, atMs: 4 * MIN })
    }
  })

  it('a win at full HP leaves no fatigue, and a dragon hit keeps what it had', () => {
    const r = finish(started())
    const a = ok(r)
    if (!r.ok || !r.battle) throw new Error('expected a report')
    a.dragons.forEach((d, i) => {
      const max = activeOf(started()).specs[i]!.hp!
      if (r.battle!.attacker[i] === max) expect(d.fatigue).toBeUndefined()
      else expect(d.fatigue?.hp).toBe(Math.max(1, r.battle!.attacker[i]!))
    })
  })

  it('later level or HP changes do not touch the battle (R69)', () => {
    const s = started()
    const moved = { ...s, dragons: team('sea', 1, { fatigue: { hp: 1, atMs: 0 } }) }
    const moves = play(activeOf(s))
    const r = run(moved, { type: 'finishTrial', moves })
    expect(r.ok && r.battle).toEqual(sim(activeOf(s), moves))
  })

  it('a team dragon fed mid-Trial: the battle uses its old level, and it keeps the new one after, holding the fight\'s HP', () => {
    const s0 = { ...at(4, team('sea', 20, { feeds: 3 })), roostTier: 5 }
    const s = { ...started(s0), food: 1_000_000 }
    const fed = ok(run(s, { type: 'feed', dragonId: 'd1' }))
    expect(fed.dragons[0]!.level).toBe(21)
    expect(activeOf(fed).specs[0]!.level).toBe(20)
    const moves = play(activeOf(s))
    const r = run(fed, { type: 'finishTrial', moves }, MIN)
    if (!r.ok || !r.battle) throw new Error('expected a report')
    expect(r.battle).toEqual(sim(activeOf(s), moves))
    expect(r.state.dragons[0]!.level).toBe(21)
    expect(r.state.dragons[0]!.fatigue).toEqual({ hp: r.battle.attacker[0], atMs: MIN })
  })
})

describe('abandonTrial', () => {
  it('NO_ACTIVE_TRIAL with none', () => {
    err(run(strong, { type: 'abandonTrial' }), 'NO_ACTIVE_TRIAL')
  })
  it('costs the team: 1 HP each, `battles` + 1, so the next seed is a new one at a price (Review Focus 2, R70)', () => {
    const a = ok(run(started(), { type: 'abandonTrial' }, MIN))
    expect([a.pve.active, a.pve.battles, a.gold]).toEqual([null, 1, strong.gold])
    for (const d of a.dragons) expect(d.fatigue).toEqual({ hp: 1, atMs: MIN })
    err(run(a, start(), MIN), 'DRAGON_TIRED')
  })
})

describe('selling', () => {
  it('a dragon on the active team is IN_TRIAL; one off it can go', () => {
    const fourth: Dragon = { id: 'd4', speciesId: 'sea', level: 1, feeds: 0, habitatId: null }
    const s = started({ ...strong, dragons: [...strong.dragons, fourth] })
    err(run(s, { type: 'sellDragon', dragonId: 'd2' }), 'IN_TRIAL')
    expect(ok(run(s, { type: 'sellDragon', dragonId: 'd4' })).dragons).toHaveLength(3)
  })
})

describe('feeding a tired dragon (R68)', () => {
  it('a level-up leaves HP where regen had it, and max higher', () => {
    const d: Dragon = { id: 'd1', speciesId: 'terra', level: 39, feeds: 3, habitatId: null, fatigue: { hp: 1, atMs: 0 } }
    const s = { ...at(4, [d]), food: 1_000_000, roostTier: 5 }
    const a = ok(run(s, { type: 'feed', dragonId: 'd1' }, MIN))
    const after = a.dragons[0]!
    expect(after.level).toBe(40)
    expect(maxHp(after, C)).toBeGreaterThan(maxHp(d, C))
    // What regen had given at that moment is what it reads after: the higher max does not reprice the minute gone by.
    expect(after.fatigue).toEqual({ hp: currentHp(d, C, MIN, FLASH_14), atMs: MIN })
    expect(currentHp(after, C, MIN, FLASH_14)).toBe(currentHp(d, C, MIN, FLASH_14))
  })
})

describe('enemies and PvP', () => {
  it('enemy HP is always full', () => {
    for (const spec of nodeTeam(1, 1, C)) expect(spec.hp).toBeUndefined()
    const s = started()
    const p = battlePreview(activeOf(s).specs, nodeTeam(1, 1, C), [], createRng(1), C)
    for (const f of p.state.sides.defender.team) expect(f.hp).toBe(f.stats.hp)
  })

  it('PvP ignores fatigue, and pvpBattle does not change it (§6.4)', () => {
    const tired = team('terra', 20, { fatigue: { hp: 1, atMs: 0 } })
    const s: PlayerState = { ...at(8, tired), defenceTeam: TEAM }
    const specs: BattleDragonSpec[] = TEAM.map(() => ({ speciesId: 'terra', level: 20 }))
    const opponent = { playerId: null, trophies: 0, level: 8, team: TEAM.map(() => ({ speciesId: 'flame', level: 1 })) }
    const moves: PlayerMove[] = [{ kind: 'attack', move: 1 }, { kind: 'attack', move: 1 }, { kind: 'attack', move: 1 }]
    const r = run(s, { type: 'pvpBattle', team: TEAM, opponent, moves })
    const expected = simulateBattle(specs, opponent.team, moves, createRng(SEED), C)
    expect(r.ok && r.battle).toEqual(expected)
    expect(ok(r).dragons).toEqual(tired)
  })

  it('PvP is allowed during a Trial and leaves the snapshot alone', () => {
    const s = started({ ...at(8, team('sea', 20)), defenceTeam: TEAM })
    const opponent = { playerId: null, trophies: 0, level: 8, team: TEAM.map(() => ({ speciesId: 'flame', level: 1 })) }
    const a = ok(run(s, { type: 'pvpBattle', team: TEAM, opponent, moves: [] }))
    expect(a.pve.active).toEqual(s.pve.active)
    expect(a.dragons).toEqual(s.dragons)
  })
})

describe('healAll (R78)', () => {
  const hurt = at(4, team('terra', 40, { fatigue: { hp: 1, atMs: 0 } }))
  const heal: Action = { type: 'buy', item: { kind: 'healAll' } }

  it('is 50,000 micro-USD through the store path', () => {
    expect(HEAL_ALL_MICRO_USD).toBe(50_000)
    expect(priceMicroUsd({ kind: 'healAll' }, hurt, 0)).toBe(50_000)
  })

  it('charges the effect and clears every fatigue', () => {
    const r = run(hurt, heal)
    expect(r.ok && r.effects).toEqual([{ type: 'charge', microUsd: 50_000 }])
    for (const d of ok(r).dragons) expect(d.fatigue).toBeUndefined()
  })

  it('NOTHING_TO_HEAL when nobody is hurt, with nothing charged, even if an old fatigue has healed by now', () => {
    err(run(strong, heal), 'NOTHING_TO_HEAL')
    err(run(hurt, heal, 17 * MIN), 'NOTHING_TO_HEAL')
    expect(priceMicroUsd({ kind: 'healAll' }, strong, 0)).toBeNull()
  })

  it('IN_TRIAL while a Trial runs, because its snapshot would go stale', () => {
    const s = ok(run(at(4, team('terra', 40, { fatigue: { hp: 3_000, atMs: 0 } })), start()))
    err(run(s, heal), 'IN_TRIAL')
    expect(priceMicroUsd({ kind: 'healAll' }, s, 0)).toBeNull()
  })
})

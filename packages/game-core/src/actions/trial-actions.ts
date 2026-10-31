// GDD §6.3, A8, R68-R70, R73: a Trial is frozen when it starts, its seed is readable only then, and finishing re-simulates from the snapshot.
import { simulateBattle } from '../battle/sim'
import { breedTimerMs } from '../data/breeding-timers'
import { BOSS_EGGS, BOSS_NODE, BOSS_TOKENS, NODES_PER_CHAPTER, REPLAYS_PER_NODE_PER_DAY, TRIAL_CHAMPION_ID, TRIAL_CHAPTERS } from '../data/trials'
import { afterBattle, canFight, currentHp } from '../fatigue'
import { addXp } from '../progression'
import type { ActiveTrial, Dragon, PlayerState } from '../state'
import { nodeKey, nodeLocked, nodeRewards, nodeTeam, starsFor } from '../trials'
import { earnGold } from '../wallet'
import { resolveTeam } from './battle-actions'
import { discover } from './breed-actions'
import { failure, success, type ActionCtx, type Handler, type TrialResult } from './types'

const FORFEIT_HP = 1
const NO_REWARD: TrialResult = { won: false, stars: 0, gold: 0, food: 0, xp: 0, first: false }

export const startTrial: Handler<'startTrial'> = (s, a, ctx) => {
  if (s.pve.active) return failure('TRIAL_ACTIVE')
  const lock = nodeLocked(s, a.chapter, a.node)
  if (lock === 'LEVEL') return failure('LEVEL_TOO_LOW')
  if (lock === 'PREVIOUS') return failure('STAGE_LOCKED')
  if (!resolveTeam(s, a.team)) return failure('INVALID_TEAM')
  const dragons = a.team.map(id => s.dragons.find(d => d.id === id)!)
  if (!dragons.every(d => canFight(d, ctx.catalog, ctx.nowMs, ctx.preset))) return failure('DRAGON_TIRED')

  const key = nodeKey(a.chapter, a.node)
  const replay = s.pve.stars[key] !== undefined
  // Rolls forward only, so a clock stepping back never resets the count.
  const today = ctx.day > s.pve.replays.day ? { day: ctx.day, counts: {} } : s.pve.replays
  const used = today.counts[key] ?? 0
  if (replay && used >= REPLAYS_PER_NODE_PER_DAY) return failure('DAILY_CAP_REACHED')

  const active: ActiveTrial = {
    chapter: a.chapter, node: a.node, team: a.team, index: s.pve.battles, startedAtMs: ctx.nowMs, replay,
    specs: dragons.map(d => ({ speciesId: d.speciesId, level: d.level, hp: currentHp(d, ctx.catalog, ctx.nowMs, ctx.preset) })),
  }
  const replays = replay ? { ...today, counts: { ...today.counts, [key]: used + 1 } } : today
  return success({ ...s, pve: { ...s.pve, active, replays } })
}

/** Writes the team's HP back by id, in `active.team`'s order, and closes the Trial. Every settle takes one off the seed list. */
function settle(s: PlayerState, active: ActiveTrial, hp: (slot: number) => number, ctx: ActionCtx): PlayerState {
  const write = (d: Dragon): Dragon => {
    const slot = active.team.indexOf(d.id)
    return slot < 0 ? d : afterBattle(d, hp(slot), ctx.catalog, ctx.nowMs)
  }
  return { ...s, dragons: s.dragons.map(write), pve: { ...s.pve, active: null, battles: s.pve.battles + 1 } }
}

export const finishTrial: Handler<'finishTrial'> = (s, a, ctx) => {
  const active = s.pve.active
  if (!active) return failure('NO_ACTIVE_TRIAL')
  const outcome = simulateBattle(active.specs, nodeTeam(active.chapter, active.node, ctx.catalog), a.moves, ctx.rng, ctx.catalog)
  // R70: a short or illegal list is a loss with the team on 1 HP, or a revealed seed could be rerolled for free.
  if (!outcome.ok) return success(settle(s, active, () => FORFEIT_HP, ctx), [], undefined, NO_REWARD)

  const settled = settle(s, active, slot => outcome.attacker[slot]!, ctx)
  if (outcome.winner !== 'attacker') return success(settled, [], outcome, NO_REWARD)

  const reward = nodeRewards(active.chapter, active.node, active.replay ? 'replay' : 'first')
  const stars = starsFor(true, outcome.attackerKos, outcome.turns) as 1 | 2 | 3
  const key = nodeKey(active.chapter, active.node)
  const best = Math.max(stars, s.pve.stars[key] ?? 0) as 1 | 2 | 3
  const paid = addXp(earnGold({ ...settled, food: settled.food + reward.food }, reward.gold), reward.xp, ctx.preset, ctx.day)
  const starred: PlayerState = { ...paid, pve: { ...paid.pve, stars: { ...paid.pve.stars, [key]: best } } }
  const chest = chestPull(starred, active.chapter)
  const drops = active.replay || active.node !== BOSS_NODE ? { state: chest.state, result: {} } : bossDrops(chest.state, active.chapter, ctx)
  const result: TrialResult = {
    won: true, stars, gold: reward.gold, food: reward.food, xp: reward.xp * ctx.preset.xpMult, first: !active.replay,
    ...drops.result, ...(chest.saved ? { chestPull: true as const } : {}),
  }
  return success(drops.state, [], outcome, result)
}

/** R74: a chapter whose 10 nodes all stand at 3 stars saves one pull, once: the settle that completed it. */
function chestPull(s: PlayerState, chapter: number): { state: PlayerState; saved: boolean } {
  if (s.pve.starredChapters.includes(chapter)) return { state: s, saved: false }
  for (let node = 1; node <= NODES_PER_CHAPTER; node++) if (s.pve.stars[nodeKey(chapter, node)] !== 3) return { state: s, saved: false }
  return { state: { ...s, pve: { ...s.pve, chestPulls: s.pve.chestPulls + 1, starredChapters: [...s.pve.starredChapters, chapter] } }, saved: true }
}

/**
 * The first clear of a Boss (R75, R76, A21): tokens, then an egg, then the Trial Champion. The egg is the only draw, taken
 * from the action's Rng after the battle's own, and only when one is due.
 */
function bossDrops(s: PlayerState, chapter: number, ctx: ActionCtx): { state: PlayerState; result: Partial<TrialResult> } {
  let state = s
  const result: Partial<TrialResult> = {}
  const tokens = BOSS_TOKENS[chapter]
  if (tokens) {
    state = { ...state, speedUps: { ...state.speedUps, [tokens.token]: state.speedUps[tokens.token] + tokens.count } }
    result.tokens = { ...tokens }
  }
  const rarity = BOSS_EGGS[chapter]
  if (rarity) {
    const element = TRIAL_CHAPTERS[chapter - 1]!.element
    const pool = [...ctx.catalog.species.values()].filter(x => x.rarity === rarity && x.elements[0] === element).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const species = pool[ctx.rng.int(pool.length)]
    if (species) {
      // R76: it goes in whether or not the Hatchery has room; the slots only hold the eggs a breeder still waits to deliver.
      const egg = { speciesId: species.id, readyAtMs: ctx.nowMs + breedTimerMs(species.rarity, species.elements, ctx.preset), xpFree: false }
      state = { ...state, hatchery: [...state.hatchery, egg] }
      result.egg = { rarity, element }
    }
  }
  if (TRIAL_CHAPTERS[chapter - 1]!.bossSpecies === TRIAL_CHAMPION_ID &&!state.discovered.includes(TRIAL_CHAMPION_ID)) {
    const champion: Dragon = { id: `d${state.nextId}`, speciesId: TRIAL_CHAMPION_ID, level: 1, feeds: 0, habitatId: null }
    state = { ...state, dragons: [...state.dragons, champion], discovered: discover(state.discovered, TRIAL_CHAMPION_ID), nextId: state.nextId + 1 }
    result.champion = true
  }
  return { state, result }
}

export const abandonTrial: Handler<'abandonTrial'> = (s, _a, ctx) => {
  const active = s.pve.active
  if (!active) return failure('NO_ACTIVE_TRIAL')
  return success(settle(s, active, () => FORFEIT_HP, ctx))
}

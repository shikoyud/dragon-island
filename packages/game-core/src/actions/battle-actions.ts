import { simulateBattle } from '../battle/sim'
import type { BattleDragonSpec } from '../battle/stats'
import { addXp } from '../progression'
import {
  PVE_MIN_PLAYER_LEVEL, PVE_REPLAYS_PER_DAY, PVE_STAGES, PVP_ATTACKS_PER_DAY, PVP_MIN_PLAYER_LEVEL,
  stageRewards, stageTeam,
} from '../pve'
import type { PlayerState } from '../state'
import { dayCounterAt } from '../time'
import { applyTrophies, pvpWinGold, TROPHY } from '../trophy'
import { earnGold } from '../wallet'
import { failure, success, type BattleReport, type Handler, type TeamIds } from './types'

export const PVP_WIN_XP = 20

/** Three distinct owned dragons, or null. */
export function resolveTeam(s: PlayerState, ids: TeamIds): BattleDragonSpec[] | null {
  if (new Set(ids).size !== 3) return null
  const team: BattleDragonSpec[] = []
  for (const id of ids) {
    const d = s.dragons.find(x => x.id === id)
    if (!d) return null
    team.push({ speciesId: d.speciesId, level: d.level })
  }
  return team
}

export const setDefenceTeam: Handler<'setDefenceTeam'> = (s, a) => {
  if (!resolveTeam(s, a.dragonIds)) return failure('INVALID_TEAM')
  return success({ ...s, defenceTeam: [...a.dragonIds] })
}

/**
 * Once a battle is valid to start, a short or illegal move list is a forfeit
 * (counted attempt, loss), not a free cancel: otherwise a player could abandon
 * any battle that goes badly and reroll until they win.
 */
export const pvpBattle: Handler<'pvpBattle'> = (s, a, ctx) => {
  if (s.level < PVP_MIN_PLAYER_LEVEL) return failure('LEVEL_TOO_LOW')
  if (s.defenceTeam === null) return failure('NO_DEFENCE_TEAM')
  const team = resolveTeam(s, a.team)
  if (!team) return failure('INVALID_TEAM')
  if (!a.opponent.team.every(d => ctx.catalog.species.has(d.speciesId))) return failure('NOT_FOUND')
  const pvp = dayCounterAt(s.pvp, ctx.nowMs)
  if (pvp.count >= PVP_ATTACKS_PER_DAY) return failure('DAILY_CAP_REACHED')

  const outcome = simulateBattle(team, a.opponent.team, a.moves, ctx.rng, ctx.catalog)
  const won = outcome.ok && outcome.winner === 'attacker'

  let next: PlayerState = { ...s, pvp: { ...pvp, count: pvp.count + 1 } }
  // League gold uses trophies before the battle, so a boundary-crossing win pays the old league.
  if (won) next = addXp(earnGold(next, pvpWinGold(s.trophies)), PVP_WIN_XP, ctx.preset, ctx.day)
  next = { ...next, trophies: applyTrophies(s.trophies, won ? TROPHY.attackWin : TROPHY.attackLoss) }

  const effects = a.opponent.playerId === null ? [] : [{
    type: 'defenceResult' as const,
    playerId: a.opponent.playerId,
    trophyDelta: won ? TROPHY.defenceLoss : TROPHY.defenceWin,
  }]
  return success(next, effects, outcome.ok ? outcome : undefined)
}

export const pveBattle: Handler<'pveBattle'> = (s, a, ctx) => {
  if (s.level < PVE_MIN_PLAYER_LEVEL) return failure('LEVEL_TOO_LOW')
  if (a.stage < 1 || a.stage > PVE_STAGES) return failure('NOT_FOUND')
  if (a.stage > s.pve.cleared + 1) return failure('STAGE_LOCKED')
  const team = resolveTeam(s, a.team)
  if (!team) return failure('INVALID_TEAM')
  const firstClear = a.stage > s.pve.cleared
  const replays = dayCounterAt(s.pve.replays, ctx.nowMs)
  if (!firstClear && replays.count >= PVE_REPLAYS_PER_DAY) return failure('DAILY_CAP_REACHED')

  // The PvE seed is never revealed, so the client's plan can only be a guess: the AI finishes it.
  const outcome = simulateBattle(team, stageTeam(a.stage, ctx.catalog), a.moves, ctx.rng, ctx.catalog, { aiFallback: true })
  const report: BattleReport | undefined = outcome.ok ? outcome : undefined

  let next: PlayerState = firstClear ? s : { ...s, pve: { ...s.pve, replays: { ...replays, count: replays.count + 1 } } }
  if (outcome.ok && outcome.winner === 'attacker') {
    const reward = stageRewards(a.stage, firstClear)
    next = addXp(earnGold({ ...next, food: next.food + reward.food }, reward.gold), reward.xp, ctx.preset, ctx.day)
    if (firstClear) next = { ...next, pve: { ...next.pve, cleared: a.stage } }
  }
  return success(next, [], report)
}

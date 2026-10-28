import { simulateBattle, type BattleOutcome } from '../battle/sim'
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
import { failure, success, type ActionError, type Handler, type TeamIds } from './types'

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

const simError = (o: Extract<BattleOutcome, { ok: false }>): ActionError => o.error

export const pvpBattle: Handler<'pvpBattle'> = (s, a, ctx) => {
  if (s.level < PVP_MIN_PLAYER_LEVEL) return failure('LEVEL_TOO_LOW')
  const team = resolveTeam(s, a.team)
  if (!team) return failure('INVALID_TEAM')
  const pvp = dayCounterAt(s.pvp, ctx.nowMs)
  if (pvp.count >= PVP_ATTACKS_PER_DAY) return failure('DAILY_CAP_REACHED')

  const outcome = simulateBattle(team, a.opponent.team, a.moves, ctx.rng, ctx.catalog)
  if (!outcome.ok) return failure(simError(outcome))
  const won = outcome.winner === 'attacker'

  let next: PlayerState = { ...s, pvp: { ...pvp, count: pvp.count + 1 } }
  // League gold uses trophies before the battle, so a boundary-crossing win pays the old league.
  if (won) next = addXp(earnGold(next, pvpWinGold(s.trophies), true), PVP_WIN_XP)
  next = { ...next, trophies: applyTrophies(s.trophies, won ? TROPHY.attackWin : TROPHY.attackLoss) }

  const effects = a.opponent.playerId === null ? [] : [{
    type: 'defenceResult' as const,
    playerId: a.opponent.playerId,
    trophyDelta: won ? TROPHY.defenceLoss : TROPHY.defenceWin,
  }]
  return success(next, effects, outcome)
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

  const outcome = simulateBattle(team, stageTeam(a.stage, ctx.catalog), a.moves, ctx.rng, ctx.catalog)
  if (!outcome.ok) return failure(simError(outcome))

  let next: PlayerState = firstClear ? s : { ...s, pve: { ...s.pve, replays: { ...replays, count: replays.count + 1 } } }
  if (outcome.winner === 'attacker') {
    const reward = stageRewards(a.stage, firstClear)
    next = addXp(earnGold({ ...next, food: next.food + reward.food }, reward.gold, true), reward.xp)
    if (firstClear) next = { ...next, pve: { ...next.pve, cleared: a.stage } }
  }
  return success(next, [], outcome)
}

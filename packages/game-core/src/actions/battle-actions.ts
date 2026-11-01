import { simulateBattle } from '../battle/sim'
import type { BattleDragonSpec } from '../battle/stats'
import { TEAM_SIZE } from '../data/battle'
import { PVP_ATTACKS_PER_DAY, PVP_MIN_PLAYER_LEVEL, PVP_WIN_XP } from '../data/pvp'
import { addXp } from '../progression'
import type { PlayerState } from '../state'
import { dayCounterAt } from '../time'
import { applyTrophies, pvpWinGold, TROPHY } from '../trophy'
import { earnGold } from '../wallet'
import { failure, success, type Handler, type TeamIds } from './types'

/** Three distinct owned dragons at full HP, or null: PvP ignores fatigue (§6.4). */
export function resolveTeam(s: PlayerState, ids: TeamIds): BattleDragonSpec[] | null {
  if (new Set(ids).size !== TEAM_SIZE) return null
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

import { currentGoal, goalProgress } from '../goals'
import { addXp } from '../progression'
import { earnGold } from '../wallet'
import { failure, success, type Handler } from './types'

/** R37: a Claim tap pays the current Goal's XP (preset-multiplied) and Gold, then moves on to the next. */
export const claimGoal: Handler<'claimGoal'> = (s, _a, ctx) => {
  const g = currentGoal(s)
  if (!g) return failure('NO_GOAL')
  const p = goalProgress(s, g, ctx.catalog)
  if (p.have < p.need) return failure('GOAL_NOT_DONE')
  const paid = earnGold({ ...s, goalIndex: s.goalIndex + 1 }, g.gold)
  return success(addXp(paid, g.xp, ctx.preset, ctx.day))
}

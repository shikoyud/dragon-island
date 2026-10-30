import { isUnfinished } from '../construction'
import { HARVEST_XP_PER_TIER } from '../data/xp'
import { CROPS, cropFood, cropGrowMs, cropUnlocked } from '../farm'
import { addXp } from '../progression'
import { spendGold } from '../wallet'
import { failure, success, type Handler } from './types'

export const plant: Handler<'plant'> = (s, a, ctx) => {
  const plot = s.farms[a.plot]
  if (!plot) return failure('NOT_FOUND')
  if (isUnfinished(s, { type: 'farm', index: a.plot })) return failure('UNDER_CONSTRUCTION')
  if (plot.crop !== null) return failure('PLOT_BUSY')
  if (!cropUnlocked(a.crop, s.level)) return failure('LEVEL_TOO_LOW')
  const paid = spendGold(s, CROPS[a.crop].gold)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const farms = paid.farms.map((p, i) => i === a.plot ? { ...p, crop: a.crop, readyAtMs: ctx.nowMs + cropGrowMs(a.crop, ctx.preset) } : p)
  return success({ ...paid, farms })
}

export const harvest: Handler<'harvest'> = (s, a, ctx) => {
  const plot = s.farms[a.plot]
  if (!plot) return failure('NOT_FOUND')
  if (plot.crop === null) return failure('PLOT_EMPTY')
  if (ctx.nowMs < plot.readyAtMs) return failure('NOT_READY')
  const farms = s.farms.map((p, i) => i === a.plot ? { ...p, crop: null, readyAtMs: 0 } : p)
  const next = { ...s, food: s.food + cropFood(plot.crop, plot.level, ctx.preset), farms }
  return success(addXp(next, CROPS[plot.crop].tier * HARVEST_XP_PER_TIER, ctx.preset, ctx.day))
}

import { farmFood } from '../buildings'
import { isUnfinished } from '../construction'
import { CROPS } from '../farm'
import { spendGold } from '../wallet'
import { failure, success, type Handler } from './types'

export const plant: Handler<'plant'> = (s, a, ctx) => {
  const plot = s.farms[a.plot]
  if (!plot) return failure('NOT_FOUND')
  if (isUnfinished(s, { type: 'farm', index: a.plot })) return failure('UNDER_CONSTRUCTION')
  if (plot.crop !== null) return failure('PLOT_BUSY')
  const crop = CROPS[a.crop]
  const paid = spendGold(s, crop.cost)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const farms = paid.farms.map((p, i) => i === a.plot ? { ...p, crop: a.crop, readyAtMs: ctx.nowMs + crop.growMs } : p)
  return success({ ...paid, farms })
}

export const harvest: Handler<'harvest'> = (s, a, ctx) => {
  const plot = s.farms[a.plot]
  if (!plot) return failure('NOT_FOUND')
  if (plot.crop === null) return failure('PLOT_EMPTY')
  if (ctx.nowMs < plot.readyAtMs) return failure('NOT_READY')
  const farms = s.farms.map((p, i) => i === a.plot ? { ...p, crop: null, readyAtMs: 0 } : p)
  return success({ ...s, food: s.food + farmFood(CROPS[plot.crop].food, plot.level), farms })
}

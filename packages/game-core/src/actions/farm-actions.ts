import { CROPS, MAX_PLOTS, plotCost } from '../farm'
import { spendGold } from '../wallet'
import { failure, success, type Handler } from './types'

export const buyFarmPlot: Handler<'buyFarmPlot'> = s => {
  if (s.farms.length >= MAX_PLOTS) return failure('MAX_PLOTS')
  const paid = spendGold(s, plotCost(s.farms.length))
  if (!paid) return failure('INSUFFICIENT_GOLD')
  return success({ ...paid, farms: [...paid.farms, { crop: null, readyAtMs: 0 }] })
}

export const plant: Handler<'plant'> = (s, a, ctx) => {
  const plot = s.farms[a.plot]
  if (!plot) return failure('NOT_FOUND')
  if (plot.crop !== null) return failure('PLOT_BUSY')
  const crop = CROPS[a.crop]
  const paid = spendGold(s, crop.cost)
  if (!paid) return failure('INSUFFICIENT_GOLD')
  const farms = paid.farms.map((p, i) => i === a.plot ? { crop: a.crop, readyAtMs: ctx.nowMs + crop.growMs } : p)
  return success({ ...paid, farms })
}

export const harvest: Handler<'harvest'> = (s, a, ctx) => {
  const plot = s.farms[a.plot]
  if (!plot) return failure('NOT_FOUND')
  if (plot.crop === null) return failure('PLOT_EMPTY')
  if (ctx.nowMs < plot.readyAtMs) return failure('NOT_READY')
  const farms = s.farms.map((p, i) => i === a.plot ? { crop: null, readyAtMs: 0 } : p)
  return success({ ...s, food: s.food + CROPS[plot.crop].food, farms })
}

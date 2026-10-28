import type { Catalog } from '../catalog'
import { LAUNCH_CATALOG } from '../data/launch-catalog'
import type { Rng } from '../rng'
import type { PlayerState } from '../state'
import { pveBattle, pvpBattle, setDefenceTeam } from './battle-actions'
import { collectEgg, hatch, startBreed } from './breed-actions'
import { buy, sellGold } from './economy-actions'
import { buyFarmPlot, harvest, plant } from './farm-actions'
import { buildHabitat, collectGold, feed, moveDragon, sellDragon, upgradeHabitat } from './island-actions'
import { failure, type Action, type ActionCtx, type ActionResult } from './types'
import { isValidAction } from './validate'

/** Single entry point: pure, deterministic given (state, action, nowMs, rng, catalog). */
export function applyAction(
  s: PlayerState, a: Action, nowMs: number, rng: Rng, catalog: Catalog = LAUNCH_CATALOG,
): ActionResult {
  if (!isValidAction(a)) return failure('INVALID_ACTION')
  const ctx: ActionCtx = { nowMs, rng, catalog }
  switch (a.type) {
    case 'collectGold': return collectGold(s, a, ctx)
    case 'buildHabitat': return buildHabitat(s, a, ctx)
    case 'upgradeHabitat': return upgradeHabitat(s, a, ctx)
    case 'moveDragon': return moveDragon(s, a, ctx)
    case 'feed': return feed(s, a, ctx)
    case 'sellDragon': return sellDragon(s, a, ctx)
    case 'buyFarmPlot': return buyFarmPlot(s, a, ctx)
    case 'plant': return plant(s, a, ctx)
    case 'harvest': return harvest(s, a, ctx)
    case 'startBreed': return startBreed(s, a, ctx)
    case 'collectEgg': return collectEgg(s, a, ctx)
    case 'hatch': return hatch(s, a, ctx)
    case 'sellGold': return sellGold(s, a, ctx)
    case 'buy': return buy(s, a, ctx)
    case 'setDefenceTeam': return setDefenceTeam(s, a, ctx)
    case 'pvpBattle': return pvpBattle(s, a, ctx)
    case 'pveBattle': return pveBattle(s, a, ctx)
  }
}

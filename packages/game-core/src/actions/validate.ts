import { ELEMENTS } from '../elements'
import { CROPS } from '../farm'
import type { Action } from './types'

/**
 * Shape check at the engine boundary. Actions arrive as untyped JSON from
 * clients; the TypeScript types alone do not stop a `'constructor'` crop or a
 * `'0'` index from poisoning state. Returns true only for a well-formed Action.
 */
export function isValidAction(a: unknown): a is Action {
  if (typeof a !== 'object' || a === null) return false
  const x = a as Record<string, unknown>
  switch (x['type']) {
    case 'collectGold':
    case 'upgradeHabitat':
      return isId(x['habitatId'])
    case 'buildHabitat':
      return (ELEMENTS as readonly unknown[]).includes(x['element'])
    case 'moveDragon':
      return isId(x['dragonId']) && isId(x['habitatId'])
    case 'feed':
    case 'sellDragon':
      return isId(x['dragonId'])
    case 'buyFarmPlot':
      return true
    case 'plant':
      return isIndex(x['plot']) && typeof x['crop'] === 'string' && Object.hasOwn(CROPS, x['crop'])
    case 'harvest':
      return isIndex(x['plot'])
    case 'startBreed':
      return isId(x['parentA']) && isId(x['parentB'])
    case 'collectEgg':
      return isIndex(x['nest'])
    case 'hatch':
      return isIndex(x['slot'])
    case 'sellGold':
      return typeof x['gold'] === 'number'
    case 'buy':
      return isStoreItem(x['item'])
    default:
      return false
  }
}

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

function isStoreItem(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const item = v as Record<string, unknown>
  switch (item['kind']) {
    case 'skip':
      return ['nest', 'hatchery', 'farm'].includes(item['target'] as string) && isIndex(item['index'])
    case 'levelUp':
      return isId(item['dragonId'])
    case 'nest':
    case 'foodPack':
    case 'oddsBoost':
    case 'hoard':
      return true
    default:
      return false
  }
}

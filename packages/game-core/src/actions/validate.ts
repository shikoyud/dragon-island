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
    case 'setDefenceTeam':
      return isTeam(x['dragonIds'])
    case 'pvpBattle':
      return isTeam(x['team']) && isOpponent(x['opponent']) && isMoves(x['moves'])
    case 'pveBattle':
      return Number.isInteger(x['stage']) && isTeam(x['team']) && isMoves(x['moves'])
    default:
      return false
  }
}

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const isTeam = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(isId)
const isMoves = (v: unknown): boolean => Array.isArray(v) && v.every(m =>
  typeof m === 'object' && m !== null && isIndex((m as Record<string, unknown>)['move']) && isIndex((m as Record<string, unknown>)['target']))

function isOpponent(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  const team = o['team']
  return (o['playerId'] === null || isId(o['playerId']))
    && Number.isInteger(o['trophies']) && Number.isInteger(o['level'])
    && Array.isArray(team) && team.length === 3
    && team.every(d => typeof d === 'object' && d !== null
      && isId((d as Record<string, unknown>)['speciesId']) && isIndex((d as Record<string, unknown>)['level']))
}

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

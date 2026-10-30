import { makeCatalog, type Species } from '../src/catalog'
import type { Element } from '../src/elements'
import type { Rarity } from '../src/rarity'

const sp = (id: string, elements: Element[], rarity: Rarity): Species =>
  ({ id, name: id, elements, rarity })

export const FIXTURE_CATALOG = makeCatalog([
  sp('terra', ['terra'], 'common'),
  sp('flame', ['flame'], 'common'),
  sp('sea', ['sea'], 'common'),
  sp('ice', ['ice'], 'common'),
  sp('nature', ['nature'], 'common'),
  sp('fn-rare', ['flame', 'nature'], 'rare'),
  sp('wall', ['terra'], 'legendary'),
  sp('fw-common', ['flame', 'sea'], 'common'),
  sp('fw-rare', ['flame', 'sea'], 'rare'),
  sp('fw-epic', ['flame', 'sea'], 'epic'),
  sp('fw-legend', ['flame', 'sea'], 'legendary'),
])

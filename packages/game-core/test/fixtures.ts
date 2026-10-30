import { makeCatalog, type Species } from '../src/catalog'
import type { Element } from '../src/elements'
import type { Rarity } from '../src/rarity'

const sp = (id: string, elements: Element[], rarity: Rarity, recipeOnly = false): Species =>
  ({ id, name: id, elements, rarity, recipeOnly })

export const FIXTURE_CATALOG = makeCatalog(
  [
    sp('flame', ['flame'], 'common'),
    sp('sea', ['sea'], 'common'),
    sp('ice', ['ice'], 'common'),
    sp('nature', ['nature'], 'common'),
    sp('fn-rare', ['flame', 'nature'], 'rare'),
    { id: 'wall', name: 'wall', elements: ['terra'], rarity: 'legendary', recipeOnly: true },
    sp('fw-common', ['flame', 'sea'], 'common'),
    sp('fw-rare', ['flame', 'sea'], 'rare'),
    sp('fw-epic', ['flame', 'sea'], 'epic'),
    sp('fw-legend', ['flame', 'sea'], 'legendary', true),
  ],
  [{ parents: ['fw-rare', 'fw-epic'], legendaryId: 'fw-legend' }],
)

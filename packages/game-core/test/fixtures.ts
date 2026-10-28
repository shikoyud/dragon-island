import { makeCatalog, type Species } from '../src/catalog'
import type { Element } from '../src/elements'
import type { Rarity } from '../src/rarity'

const sp = (id: string, elements: Element[], rarity: Rarity, recipeOnly = false): Species =>
  ({ id, name: id, elements, rarity, baseSpeed: 50, recipeOnly })

export const FIXTURE_CATALOG = makeCatalog(
  [
    sp('fire', ['fire'], 'common'),
    sp('water', ['water'], 'common'),
    sp('ice', ['ice'], 'common'),
    sp('fw-common', ['fire', 'water'], 'common'),
    sp('fw-rare', ['fire', 'water'], 'rare'),
    sp('fw-epic', ['fire', 'water'], 'epic'),
    sp('fw-legend', ['fire', 'water'], 'legendary', true),
  ],
  [{ parents: ['fw-rare', 'fw-epic'], legendaryId: 'fw-legend' }],
)

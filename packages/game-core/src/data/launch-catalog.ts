import { makeCatalog, type Species } from '../catalog'
import type { Element } from '../elements'

// Placeholder names; the design team replaces them. Hybrids, epics and legendaries are later content.
const pure = (element: Element, name: string): Species =>
  ({ id: element, name, elements: [element], rarity: 'common', recipeOnly: false })

export const LAUNCH_CATALOG = makeCatalog([
  pure('terra', 'Terra Basic'),
  pure('flame', 'Flame Basic'),
  pure('sea', 'Sea Basic'),
  pure('nature', 'Nature Basic'),
  pure('electric', 'Electric Basic'),
  pure('ice', 'Ice Basic'),
  pure('metal', 'Metal Basic'),
  pure('dark', 'Dark Basic'),
  pure('light', 'Light Basic'),
  pure('war', 'War Basic'),
])

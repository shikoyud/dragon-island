import { makeCatalog, type Species } from '../catalog'
import type { Element } from '../elements'

// Placeholder names; the design team replaces them. Hybrids, epics and legendaries are later content.
const pure = (element: Element, name: string, baseSpeed: number): Species =>
  ({ id: element, name, elements: [element], rarity: 'common', baseSpeed, recipeOnly: false })

export const LAUNCH_CATALOG = makeCatalog([
  pure('terra', 'Terra Basic', 40),
  pure('flame', 'Flame Basic', 55),
  pure('sea', 'Sea Basic', 50),
  pure('nature', 'Nature Basic', 45),
  pure('electric', 'Electric Basic', 60),
  pure('ice', 'Ice Basic', 48),
  pure('metal', 'Metal Basic', 42),
  pure('dark', 'Dark Basic', 52),
  pure('light', 'Light Basic', 53),
  pure('war', 'War Basic', 50), // placeholder speed: B4 drops baseSpeed
])

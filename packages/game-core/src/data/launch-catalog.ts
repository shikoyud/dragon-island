import { makeCatalog, type Species } from '../catalog'
import type { Element } from '../elements'

// Placeholder names; the design team replaces them. Hybrids, epics and legendaries are later content.
const pure = (element: Element, name: string, baseSpeed: number): Species =>
  ({ id: element, name, elements: [element], rarity: 'common', baseSpeed, recipeOnly: false })

export const LAUNCH_CATALOG = makeCatalog([
  pure('fire', 'Fire Whelp', 55),
  pure('water', 'Water Whelp', 50),
  pure('earth', 'Earth Whelp', 40),
  pure('nature', 'Nature Whelp', 45),
  pure('electric', 'Electric Whelp', 60),
  pure('ice', 'Ice Whelp', 48),
  pure('metal', 'Metal Whelp', 42),
  pure('dark', 'Dark Whelp', 52),
  pure('light', 'Light Whelp', 53),
])

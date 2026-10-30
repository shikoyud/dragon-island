import { HABITATS, isOpposite, LEGENDARY_EVENTS, type Catalog, type Element, type Preset, type Species } from '@wyrmhaven/game-core'

/** Display-cased element name. */
export const elementName = (e: Element): string => e.charAt(0).toUpperCase() + e.slice(1)

const list = (names: string[]): string => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

/** How to get a species (§1.4, §3.4, §8.4); shown for found and unfound species alike. */
export function bookHint(sp: Species, preset: Preset, _c: Catalog): string {
  const names = sp.elements.map(elementName)
  if (sp.rarity === 'legendary') {
    const ev = LEGENDARY_EVENTS.find(e => e.speciesId === sp.id)
    if (!ev) return 'Not bred'
    const [from, to] = ev.days[preset.id]
    return `Breeding event, days ${from}–${to}: ${names.join(' and ')} parents`
  }
  if (sp.elements.length === 1) return `Buy in the Shop at level ${HABITATS[sp.elements[0]!].unlockPl}`
  if (sp.elements.length === 2) {
    const [a, b] = sp.elements as [Element, Element]
    return isOpposite(a, b)
      ? `Two Basics can't make this. Breed a hybrid carrying ${names[0]} with one carrying ${names[1]}`
      : `Breed a ${names[0]} parent with a ${names[1]} parent`
  }
  return `Breed parents carrying ${list(names)}, one with a ${names[0]} primary`
}

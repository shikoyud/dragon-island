import { describe, expect, it } from 'vitest'
import { makeCatalog, validateCatalog, type Species } from '../src/catalog'
import { LAUNCH_CATALOG } from '../src/data/launch-catalog'
import { SPECIES_ROWS } from '../src/data/species-rows'
import { ELEMENTS, type Element } from '../src/elements'
import type { Rarity } from '../src/rarity'

// GDD §3.4, copied literally: rows are primary, columns secondary (C basic, U neutral, R counter, E opposite).
const GRID_COLUMNS: Element[] = ['terra', 'flame', 'sea', 'nature', 'electric', 'ice', 'metal', 'dark', 'light', 'war']
const GRID: Record<Element, string> = {
  terra:    'C R U U R U R E U R',
  flame:    'R C R R U E U U U U',
  sea:      'U R C R R U U U U E',
  nature:   'U R R C E R U U R U',
  electric: 'R U R E C U R U R U',
  ice:      'U E U R U C R U U R',
  metal:    'R U U U R R C R U U',
  dark:     'E U U U U U R C R R',
  light:    'U U U R R U U R C U',
  war:      'R U E U U R U R U C',
}
const RARITY_OF: Record<string, Rarity> = { C: 'common', U: 'uncommon', R: 'rare', E: 'epic' }

const LEGENDARIES: [string, Element[]][] = [
  ['magma-sovereign', ['terra', 'flame']],
  ['glacier-warlord', ['ice', 'war']],
  ['radiant-aegis', ['light', 'metal']],
  ['last-light', ['light', 'war']],
  ['final-dawn', ['light', 'terra']],
]

const all = [...LAUNCH_CATALOG.species.values()]
const sp = (id: string, elements: Element[], rarity: Rarity): Species => ({ id, name: id, elements, rarity })

describe('species rows (§3.4)', () => {
  it('has exactly one species per ordered pair, at the grid rarity', () => {
    for (const p of ELEMENTS) {
      const cells = GRID[p].split(' ')
      expect(cells).toHaveLength(10)
      GRID_COLUMNS.forEach((s, i) => {
        const found = all.filter(x => x.rarity !== 'legendary' && x.elements.length <= 2
          && x.elements[0] === p && (x.elements[1] ?? p) === s)
        expect(found, `${p}/${s}`).toHaveLength(1)
        expect(found[0]!.rarity, `${p}/${s}`).toBe(RARITY_OF[cells[i]!])
      })
    }
  })

  it('has the §3.4 rarity counts', () => {
    const n = (r: Rarity) => all.filter(s => s.rarity === r).length
    expect(n('common')).toBe(10)
    expect(n('uncommon')).toBe(48)
    expect(n('rare')).toBe(34)
    expect(n('epic')).toBe(8 + 1)
    expect(n('legendary')).toBe(5)
    expect(all).toHaveLength(106)
    expect(SPECIES_ROWS).toHaveLength(106)
  })

  it('ids are the elements joined by a dash, except Legendaries', () => {
    for (const s of all.filter(x => x.rarity !== 'legendary')) expect(s.id).toBe(s.elements.join('-'))
    for (const [id, elements] of LEGENDARIES) {
      expect(LAUNCH_CATALOG.species.get(id)).toMatchObject({ id, elements, rarity: 'legendary' })
    }
  })

  it('names Basics and placeholders as the brief says', () => {
    expect(LAUNCH_CATALOG.species.get('terra-flame')!.name).toBe('Terra-Flame')
    expect(LAUNCH_CATALOG.species.get('flame-ice-sea')!.name).toBe('Flame-Ice-Sea')
    expect(LAUNCH_CATALOG.species.get('magma-sovereign')!.name).toBe('Magma Sovereign')
    expect(LAUNCH_CATALOG.species.get('terra')!.name).toBe('Terra Basic')
  })

  it('has one epic tri-hybrid, Flame/Ice/Sea', () => {
    const tri = all.filter(s => s.elements.length === 3)
    expect(tri.map(s => s.id)).toEqual(['flame-ice-sea'])
    for (const s of tri) {
      expect(s.rarity).toBe('epic')
      expect(new Set(s.elements).size).toBe(3)
    }
  })

  it('validates the launch catalog', () => {
    expect(validateCatalog(LAUNCH_CATALOG)).toEqual([])
  })
})

describe('validateCatalog', () => {
  it('flags 0, 4 or repeated elements', () => {
    expect(validateCatalog(makeCatalog([...all, sp('none', [], 'rare')]))).toContain('BAD_ELEMENTS:none')
    expect(validateCatalog(makeCatalog([...all, sp('four', ['flame', 'sea', 'nature', 'ice'], 'epic')]))).toContain('BAD_ELEMENTS:four')
    expect(validateCatalog(makeCatalog([...all, sp('rep', ['flame', 'sea', 'flame'], 'epic')]))).toContain('BAD_ELEMENTS:rep')
  })

  it('flags two rows with the same ordered elements', () => {
    expect(validateCatalog(makeCatalog([...all, sp('dup', ['terra', 'flame'], 'rare')]))).toContain('DUPLICATE_ELEMENTS:terra-flame')
  })

  it('flags a missing Basic', () => {
    expect(validateCatalog(makeCatalog(all.filter(s => s.id !== 'ice')))).toContain('MISSING_BASIC:ice')
  })

  it('flags a hybrid that disagrees with the grid rule', () => {
    const swap = (id: string, rarity: Rarity) => makeCatalog(all.map(s => (s.id === id ? { ...s, rarity } : s)))
    expect(validateCatalog(swap('flame-ice', 'rare'))).toContain('HYBRID_RARITY:flame-ice') // opposite must be epic
    expect(validateCatalog(swap('terra-flame', 'uncommon'))).toContain('HYBRID_RARITY:terra-flame') // counter must be rare
    expect(validateCatalog(swap('terra-sea', 'rare'))).toContain('HYBRID_RARITY:terra-sea') // neutral must be uncommon
  })
})

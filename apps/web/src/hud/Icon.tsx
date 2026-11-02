import type { Element } from '@wyrmhaven/game-core'
import { createContext, memo, useContext, type ReactElement } from 'react'
import type { GameArtSet, Sprite } from '../art/types'

export type IconName =
  | 'food' | 'gold' | 'dris' | 'xp' | 'timer' | 'build' | 'map' | 'settings'
  | 'dragons' | 'breed' | 'battle' | 'store' | 'admin' | 'quests' | 'wings' | 'inbox'
  | 'book' | 'goals' | 'shop'
  | 'getEgg' | 'collect' | 'upgrade' | 'info' | 'move' | 'hatch' | 'growFood' | 'speedUp' | 'clear'

/** HUD art from the manifest (`art.hud`), keyed `icon.<name>.16` / `icon.<name>.32`; provided once by the App. */
export const HudArtContext = createContext<Record<string, Sprite>>({})

/**
 * What the App provides through `HudArtContext`: `art.hud` plus the element icons (`art.elementIcon`, manifest keys
 * `icon.flame`, `icon.terra`, ...) that have a file, so `Icon` finds them by name.
 */
export function hudArtOf(art: GameArtSet): Record<string, Sprite> {
  const icons = Object.entries(art.elementIcon).filter(([, s]) => s.src).map(([el, s]) => [`icon.${el}`, s] as const)
  return { ...Object.fromEntries(icons), ...art.hud }
}

const C: Record<string, string> = {
  k: '#141627', W: '#f2efe6', R: '#c0563a', r: '#e88a6a', Y: '#f4d03f', y: '#b89a1a', P: '#9b6bd6', p: '#d9c2ff',
  B: '#5aa9f0', b: '#cfe6ff', S: '#9aa5b1', s: '#d0d6dc', T: '#e9d8a6', G: '#4caf50', E: '#f2efe6', e: '#c9bb9c',
  N: '#8b6136', K: '#f2c59a', V: '#3a86c8',
}

/** 12x12 placeholder glyphs until the icon.* art exists ('.' is transparent, letters index C). */
const GLYPHS: Record<Exclude<IconName, 'book' | 'goals' | 'shop' | 'getEgg' | 'collect' | 'upgrade' | 'info' | 'move' | 'hatch' | 'growFood' | 'speedUp' | 'clear'>, string[]> & Partial<Record<IconName, string[]>> = {
  food: ['............', '.......kkk..', '......kRRRk.', '.....kRRrRk.', '....kRRRRRk.', '...kRRRRRk..', '..kWkRRRk...', '.kWWkkkk....', 'kWWk........', 'kWk.........', '.k..........', '............'],
  gold: ['....kkkk....', '..kkYYYYkk..', '.kYYyyyyYYk.', '.kYyYYYYyYk.', 'kYyYYkkYYyYk', 'kYyYkYYYYyYk', 'kYyYkYYYYyYk', 'kYyYYkkYYyYk', '.kYyYYYYyYk.', '.kYYyyyyYYk.', '..kkYYYYkk..', '....kkkk....'],
  dris: ['............', '...kkkkkk...', '..kPPpPPPk..', '.kPPpPPPPPk.', 'kkkkkkkkkkkk', 'kPPPpPPPPPPk', '.kPPPpPPPPk.', '..kPPPpPPk..', '...kPPpPk...', '....kPPk....', '.....kk.....', '............'],
  xp: ['.....kk.....', '....kBBk....', '....kBBk....', 'kkkkkBBkkkkk', 'kBBBBbBBBBBk', '.kBBBbBBBBk.', '..kBBBBBBk..', '..kBBkkBBk..', '.kBBk..kBBk.', '.kBk....kBk.', '.kk......kk.', '............'],
  timer: ['.kkkkkkkkkk.', '.kWWWWWWWWk.', '..kYYYYYYk..', '...kYYYYk...', '....kYYk....', '.....kk.....', '....kWWk....', '...kWYYWk...', '..kYYYYYYk..', '.kWWWWWWWWk.', '.kkkkkkkkkk.', '............'],
  build: ['............', '..kkkkkk....', '.kSSSSSSk...', '.kSssSSSk...', '..kkkkSSk...', '.....kNk....', '....kNk.....', '...kNk......', '..kNk.......', '.kNk........', '.kk.........', '............'],
  map: ['............', '.kkkkkkkkkk.', 'kTTkTTTTkTTk', 'kTTkTGTTkTTk', 'kTTkGGGTkTTk', 'kTTkTGRTkTTk', 'kTTkTTRTkTTk', 'kTTkTTTTkTTk', 'kTTkTTTTkTTk', '.kkkkkkkkkk.', '............', '............'],
  settings: ['....kkkk....', '..k.kSSk.k..', '.kSkkSSkkSk.', '..kSSSSSSk..', 'kkSSSkkSSSkk', 'kSSSk..kSSSk', 'kSSSk..kSSSk', 'kkSSSkkSSSkk', '..kSSSSSSk..', '.kSkkSSkkSk.', '..k.kSSk.k..', '....kkkk....'],
  dragons: ['............', '..k.....k...', '.kGk...kGk..', '.kGGkkkGGk..', '..kGGGGGGk..', '.kGWkGGGGGkk', 'kGGkkGGGGGGk', 'kGGGGGGGkkk.', '.kRRkGGGGk..', '..kkkGGGGk..', '.....kkkk...', '............'],
  breed: ['....kk.kk...', '...kRRkRRk..', '...kRRRRRk..', '....kRRRk...', '.....kRk....', '.kkk...kkk..', 'kEEEk.kEEEk.', 'kEeEk.kEeEk.', 'kEEEk.kEEEk.', 'kEEEk.kEEEk.', '.kkk...kkk..', '............'],
  battle: ['k..........k', 'kSk......kSk', '.kSk....kSk.', '..kSk..kSk..', '...kSkkSk...', '....kSSk....', '....kSSk....', '...kNkkNk...', '..kNk..kNk..', '.kYk....kYk.', 'kYk......kYk', 'kk........kk'],
  store: ['............', 'kkkkkkkkkkkk', 'kRRWWRRWWRRk', 'kRRWWRRWWRRk', '.kkkkkkkkkk.', '.kTTTTTTTTk.', '.kTkkTTkkTk.', '.kTkWTTkWTk.', '.kTkkTTkkTk.', '.kTTTTTTTTk.', '.kkkkkkkkkk.', '............'],
  admin: ['............', '.kkkkkkkkkk.', '.kSSSSSSSSk.', '.kSSSkkSSSk.', '.kSSkYYkSSk.', '.kSSkYYkSSk.', '..kSSkkSSk..', '..kSSSSSSk..', '...kSSSSk...', '....kSSk....', '.....kk.....', '............'],
  quests: ['............', '.kkkkkkkkk..', '.kTTTTTTTk..', '.kTkkkkkTk..', '.kTTTTTTTk..', '.kTkkkkTTk..', '.kTTTTTGGk..', '.kTkkTGGTk..', '.kTGTGGTTk..', '.kTTGGTTTk..', '.kkkkkkkkk..', '............'],
  wings: ['............', 'kk........kk', 'kBkk....kkBk', 'kBBBk..kBBBk', 'kBbBBkkBBbBk', '.kBbBBBBbBk.', '..kBBBBBBk..', '...kBBBBk...', '....kBBk....', '.....kk.....', '............', '............'],
  inbox: ['............', '............', 'kkkkkkkkkkkk', 'kWkWWWWWWkWk', 'kWWkWWWWkWWk', 'kWWWkWWkWWWk', 'kWWWWkkWWWWk', 'kWWWWWWWWWWk', 'kWWWWWWWWWWk', 'kkkkkkkkkkkk', '............', '............'],
}

/** Phase 3 HUD names share a glyph until their art loads (icon.book.32, icon.goals.32, icon.shop.32 exist). */
GLYPHS.book = GLYPHS.dragons
GLYPHS.goals = GLYPHS.quests
GLYPHS.shop = GLYPHS.store
/** Phase 4 action row names: a stand-in glyph each until their icon.<name>.32 loads (all exist in v1). */
GLYPHS.getEgg = GLYPHS.breed
GLYPHS.hatch = GLYPHS.breed
GLYPHS.collect = GLYPHS.gold
GLYPHS.upgrade = GLYPHS.build
GLYPHS.clear = GLYPHS.build
GLYPHS.info = GLYPHS.quests
GLYPHS.move = GLYPHS.map
GLYPHS.growFood = GLYPHS.food
GLYPHS.speedUp = GLYPHS.timer

const glyphCache = new Map<string, ReactElement[]>()

/** A glyph's pixels as React elements, made once per glyph: the same elements every time cost React nothing to render again. */
export function glyphRects(name: string): ReactElement[] | undefined {
  const rows = (GLYPHS as Partial<Record<string, string[]>>)[name]
  if (!rows) return undefined
  let rects = glyphCache.get(name)
  if (!rects) {
    rects = rows.flatMap((row, y) => [...row].flatMap((ch, x) => (C[ch] ? [<rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={C[ch]} />] : [])))
    glyphCache.set(name, rects)
  }
  return rects
}

/**
 * A HUD icon: the manifest's `icon.<name>.32` (or .16) when it exists, else a built-in pixel glyph.
 * Element names (`flame`, `war`, ...) are accepted too and read the element's own icon (`icon.<element>`, from `hudArtOf`);
 * with none they draw a diamond in the element colour.
 * Decorative unless `label` is given, which makes it an image with that accessible name.
 */
export const Icon = memo(function Icon({ name, size = 24, label }: { name: IconName | Element; size?: number; label?: string }) {
  const art = useContext(HudArtContext)
  const sprite = art[`icon.${name}.${size > 16 ? 32 : 16}`] ?? art[`icon.${name}.32`] ?? art[`icon.${name}.16`] ?? art[`icon.${name}`]
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const }
  if (sprite?.src) return <img className="pixel hud-icon" src={sprite.src} width={size} height={size} alt={label ?? ''} {...(label ? {} : a11y)} />
  const rects = glyphRects(name)
  if (!rects) {
    return (
      <svg className="hud-icon" width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" data-icon={name} {...a11y}>
        <path d="M6 0 L12 6 L6 12 L0 6 Z" fill="#141627" />
        <path d="M6 2 L10 6 L6 10 L2 6 Z" fill={`var(--el-${name})`} />
      </svg>
    )
  }
  return (
    <svg className="hud-icon" width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" data-icon={name} {...a11y}>
      {rects}
    </svg>
  )
})

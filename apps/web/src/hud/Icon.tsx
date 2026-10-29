import { createContext, useContext } from 'react'
import type { Sprite } from '../art/types'

export type IconName =
  | 'food' | 'gold' | 'dris' | 'xp' | 'timer' | 'build' | 'map' | 'season' | 'leaderboard' | 'referral' | 'settings'
  | 'dragons' | 'breed' | 'battle' | 'hoard' | 'store' | 'admin' | 'quests'

/** HUD art from the manifest (`art.hud`), keyed `icon.<name>.16` / `icon.<name>.32`; provided once by the App. */
export const HudArtContext = createContext<Record<string, Sprite>>({})

const C: Record<string, string> = {
  k: '#141627', W: '#f2efe6', R: '#c0563a', r: '#e88a6a', Y: '#f4d03f', y: '#b89a1a', P: '#9b6bd6', p: '#d9c2ff',
  B: '#5aa9f0', b: '#cfe6ff', S: '#9aa5b1', s: '#d0d6dc', T: '#e9d8a6', G: '#4caf50', E: '#f2efe6', e: '#c9bb9c',
  N: '#8b6136', K: '#f2c59a', V: '#3a86c8',
}

/** 12x12 placeholder glyphs until the icon.* art exists ('.' is transparent, letters index C). */
const GLYPHS: Record<IconName, string[]> = {
  food: ['............', '.......kkk..', '......kRRRk.', '.....kRRrRk.', '....kRRRRRk.', '...kRRRRRk..', '..kWkRRRk...', '.kWWkkkk....', 'kWWk........', 'kWk.........', '.k..........', '............'],
  gold: ['....kkkk....', '..kkYYYYkk..', '.kYYyyyyYYk.', '.kYyYYYYyYk.', 'kYyYYkkYYyYk', 'kYyYkYYYYyYk', 'kYyYkYYYYyYk', 'kYyYYkkYYyYk', '.kYyYYYYyYk.', '.kYYyyyyYYk.', '..kkYYYYkk..', '....kkkk....'],
  dris: ['............', '...kkkkkk...', '..kPPpPPPk..', '.kPPpPPPPPk.', 'kkkkkkkkkkkk', 'kPPPpPPPPPPk', '.kPPPpPPPPk.', '..kPPPpPPk..', '...kPPpPk...', '....kPPk....', '.....kk.....', '............'],
  xp: ['.....kk.....', '....kBBk....', '....kBBk....', 'kkkkkBBkkkkk', 'kBBBBbBBBBBk', '.kBBBbBBBBk.', '..kBBBBBBk..', '..kBBkkBBk..', '.kBBk..kBBk.', '.kBk....kBk.', '.kk......kk.', '............'],
  timer: ['.kkkkkkkkkk.', '.kWWWWWWWWk.', '..kYYYYYYk..', '...kYYYYk...', '....kYYk....', '.....kk.....', '....kWWk....', '...kWYYWk...', '..kYYYYYYk..', '.kWWWWWWWWk.', '.kkkkkkkkkk.', '............'],
  build: ['............', '..kkkkkk....', '.kSSSSSSk...', '.kSssSSSk...', '..kkkkSSk...', '.....kNk....', '....kNk.....', '...kNk......', '..kNk.......', '.kNk........', '.kk.........', '............'],
  map: ['............', '.kkkkkkkkkk.', 'kTTkTTTTkTTk', 'kTTkTGTTkTTk', 'kTTkGGGTkTTk', 'kTTkTGRTkTTk', 'kTTkTTRTkTTk', 'kTTkTTTTkTTk', 'kTTkTTTTkTTk', '.kkkkkkkkkk.', '............', '............'],
  season: ['.kk.........', '.kWk........', '.kWkkkkkkk..', '.kWkRRRRRRk.', '.kWkRRYRRRk.', '.kWkRYYYRRk.', '.kWkRRYRRRk.', '.kWkRRRRRRk.', '.kWkRRkkRRk.', '.kWkRk..kRk.', '.kWkk....kk.', '.kWk........'],
  leaderboard: ['............', '.kkkkkkkkkk.', 'kYkYYYYYYkYk', 'kYkYYyYYYkYk', '.kkYYyYYYkk.', '...kYYYYk...', '....kYYk....', '.....kk.....', '....kYYk....', '...kkkkkk...', '...kNNNNk...', '...kkkkkk...'],
  referral: ['............', '..kk....kk..', '.kKKk..kKKk.', '.kKKk..kKKk.', '..kk....kk..', '.kVVk..kGGk.', 'kVVVVkkGGGGk', 'kVVVVkkGGGGk', 'kVVVVkkGGGGk', '.kkkk..kkkk.', '............', '............'],
  settings: ['....kkkk....', '..k.kSSk.k..', '.kSkkSSkkSk.', '..kSSSSSSk..', 'kkSSSkkSSSkk', 'kSSSk..kSSSk', 'kSSSk..kSSSk', 'kkSSSkkSSSkk', '..kSSSSSSk..', '.kSkkSSkkSk.', '..k.kSSk.k..', '....kkkk....'],
  dragons: ['............', '..k.....k...', '.kGk...kGk..', '.kGGkkkGGk..', '..kGGGGGGk..', '.kGWkGGGGGkk', 'kGGkkGGGGGGk', 'kGGGGGGGkkk.', '.kRRkGGGGk..', '..kkkGGGGk..', '.....kkkk...', '............'],
  breed: ['....kk.kk...', '...kRRkRRk..', '...kRRRRRk..', '....kRRRk...', '.....kRk....', '.kkk...kkk..', 'kEEEk.kEEEk.', 'kEeEk.kEeEk.', 'kEEEk.kEEEk.', 'kEEEk.kEEEk.', '.kkk...kkk..', '............'],
  battle: ['k..........k', 'kSk......kSk', '.kSk....kSk.', '..kSk..kSk..', '...kSkkSk...', '....kSSk....', '....kSSk....', '...kNkkNk...', '..kNk..kNk..', '.kYk....kYk.', 'kYk......kYk', 'kk........kk'],
  hoard: ['............', '..kkkkkkkk..', '.kNNNNNNNNk.', 'kNNNNNNNNNNk', 'kkkkkYYkkkkk', 'kNNNkYYkNNNk', 'kNNNNkkNNNNk', 'kNNNNNNNNNNk', 'kNNNNNNNNNNk', 'kkkkkkkkkkkk', '............', '............'],
  store: ['............', 'kkkkkkkkkkkk', 'kRRWWRRWWRRk', 'kRRWWRRWWRRk', '.kkkkkkkkkk.', '.kTTTTTTTTk.', '.kTkkTTkkTk.', '.kTkWTTkWTk.', '.kTkkTTkkTk.', '.kTTTTTTTTk.', '.kkkkkkkkkk.', '............'],
  admin: ['............', '.kkkkkkkkkk.', '.kSSSSSSSSk.', '.kSSSkkSSSk.', '.kSSkYYkSSk.', '.kSSkYYkSSk.', '..kSSkkSSk..', '..kSSSSSSk..', '...kSSSSk...', '....kSSk....', '.....kk.....', '............'],
  quests: ['............', '.kkkkkkkkk..', '.kTTTTTTTk..', '.kTkkkkkTk..', '.kTTTTTTTk..', '.kTkkkkTTk..', '.kTTTTTGGk..', '.kTkkTGGTk..', '.kTGTGGTTk..', '.kTTGGTTTk..', '.kkkkkkkkk..', '............'],
}

/** A HUD icon: the manifest's `icon.<name>.32` (or .16) when it exists, else a built-in pixel glyph. */
export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const art = useContext(HudArtContext)
  const sprite = art[`icon.${name}.${size > 16 ? 32 : 16}`] ?? art[`icon.${name}.32`] ?? art[`icon.${name}.16`]
  if (sprite?.src) return <img className="pixel hud-icon" src={sprite.src} width={size} height={size} alt="" aria-hidden="true" />
  const rows = GLYPHS[name]
  return (
    <svg className="hud-icon" width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true" data-icon={name}>
      {rows.flatMap((row, y) => [...row].map((ch, x) => (C[ch] ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={C[ch]} /> : null)))}
    </svg>
  )
}

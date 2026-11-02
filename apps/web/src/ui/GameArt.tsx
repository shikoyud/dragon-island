import { createContext, useContext } from 'react'
import { FALLBACK_ART } from '../art/slots'
import type { GameArtSet, Sprite } from '../art/types'

/** The island art for dialogs that show a building or dragon picture; the App provides the loaded set. */
export const GameArtContext = createContext<GameArtSet>(FALLBACK_ART)
export const useGameArt = (): GameArtSet => useContext(GameArtContext)

/**
 * The first frame of a sprite (sheet) scaled to `height` px, pixelated; a plain tinted box when the sprite has no file yet.
 * Decorative: the dialog names the thing in text.
 */
export function SpriteStill({ sprite, height, className, dim }: { sprite: Sprite; height: number; className?: string; dim?: boolean }) {
  const scale = height / sprite.h
  const w = Math.round(sprite.w * scale)
  const style = {
    width: w, height, imageRendering: 'pixelated' as const, display: 'block',
    ...(sprite.src
      ? { backgroundImage: `url("${sprite.src}")`, backgroundSize: `${w * sprite.frames}px ${height}px`, backgroundPosition: '0 0', backgroundRepeat: 'no-repeat' }
      : { background: 'rgba(0,0,0,0.15)', borderRadius: 8 }),
    ...(dim ? { filter: 'brightness(0)' } : {}),
  }
  return <span aria-hidden="true" className={className} data-testid="sprite-still" style={style} />
}

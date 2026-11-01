import { useContext } from 'react'
import type { Sprite } from '../art/types'
import { HudArtContext } from './Icon'

/** The HUD art for a manifest key when it exists and has a file, else undefined: callers keep their text or CSS look. */
export function useHudSprite(key: string): Sprite | undefined {
  const sprite = useContext(HudArtContext)[key]
  return sprite?.src ? sprite : undefined
}

/** A decorative still from the HUD art, drawn at `size` px square (pixelated); nothing when the manifest lacks the key. */
export function ArtMark({ name, size, className }: { name: string; size: number; className?: string }) {
  const sprite = useHudSprite(name)
  if (!sprite) return null
  return <img className={`pixel hud-mark${className ? ` ${className}` : ''}`} src={sprite.src} width={size} height={size} alt="" aria-hidden="true" />
}

/**
 * `filled` of `total` stars: `ui.star` and `ui.star.empty` when the manifest has them, else the ★ and ☆ glyphs. The group
 * says the count (`aria-label`), so the marks themselves are decorative.
 */
export function Stars({ filled, total = filled, className }: { filled: number; total?: number; className?: string }) {
  const on = useHudSprite('ui.star')
  const off = useHudSprite('ui.star.empty')
  const marks = Array.from({ length: total }, (_, i) => {
    const sprite = i < filled ? on : off
    if (sprite) return <img key={i} className="pixel hud-star" src={sprite.src} width={12} height={12} alt="" aria-hidden="true" />
    return <span key={i} aria-hidden="true">{i < filled ? '★' : '☆'}</span>
  })
  return <span className={className} aria-label={`${filled} stars`}>{marks}</span>
}

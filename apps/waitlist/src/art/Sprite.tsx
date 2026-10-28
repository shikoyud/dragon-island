import type { CSSProperties } from 'react'
import { ELEMENT_COLORS, type Element } from '../domain/elements'
import type { Sprite as SpriteData } from './types'

export interface SpriteProps {
  sprite: SpriteData
  element: Element
  /** Whole-number pixel scale. */
  scale: number
  animate?: boolean
}

export function Sprite({ sprite, element, scale, animate = true }: SpriteProps) {
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`Sprite scale must be a positive integer, got ${scale}`)
  const { src, w, h, frames, fps } = sprite
  const width = w * scale
  const height = h * scale

  if (!src) {
    return (
      <div
        className="wh-sprite wh-sprite-fallback"
        role="img"
        aria-label={`${element} placeholder`}
        style={{ width, height, backgroundColor: ELEMENT_COLORS[element].base, imageRendering: 'pixelated' }}
      />
    )
  }

  const style: CSSProperties & Record<'--wh-sheet-w', string> = {
    width,
    height,
    backgroundImage: `url(${src})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${width * frames}px ${height}px`,
    backgroundPosition: '0 0',
    imageRendering: 'pixelated',
    '--wh-sheet-w': `${width * frames}px`,
  }
  if (animate && frames > 1) {
    style.animationName = 'wh-sprite-play'
    style.animationDuration = `${frames / fps}s`
    style.animationTimingFunction = `steps(${frames})`
    style.animationIterationCount = 'infinite'
  }
  return <div className="wh-sprite" aria-hidden="true" style={style} />
}

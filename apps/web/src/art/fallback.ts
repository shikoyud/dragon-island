import type { Element } from '@wyrmhaven/game-core'

/** Element colours (same values as styles/tokens.css) with a darker outline and lighter highlight. */
export const FALLBACK_PALETTE: Record<Element, { base: string; dark: string; light: string }> = {
  fire: { base: '#e4572e', dark: '#8c2f14', light: '#f7a07a' },
  water: { base: '#3a86c8', dark: '#1f4f7a', light: '#8fc3ea' },
  earth: { base: '#a0683b', dark: '#5e3a1d', light: '#d1a373' },
  nature: { base: '#4caf50', dark: '#276a2b', light: '#9ad99c' },
  electric: { base: '#f4d03f', dark: '#9a7f12', light: '#fbe99a' },
  ice: { base: '#9ad7f0', dark: '#4d8aa8', light: '#d6f0fa' },
  metal: { base: '#9aa5b1', dark: '#555e68', light: '#d0d6dc' },
  dark: { base: '#5b4b8a', dark: '#2d2447', light: '#9d8fc9' },
  light: { base: '#f7f0c8', dark: '#b5a86a', light: '#fffbe6' },
}
const OUTLINE = '#141627'
const WOOD = '#6b4a2b'
const SOIL = '#4a3522'
const STONE = '#4d5566'
const PANEL = '#1b2140'
const PANEL_EDGE = '#3b4680'

export type FallbackSlot =
  | 'egg' | 'hatchling' | 'dragon' | 'habitat' | 'nest' | 'hatchery' | 'farmPlot' | 'crop' | 'hoard'
  | 'icon' | 'panel' | 'button' | 'cursor' | 'island'
  | 'nexus' | 'decoration' | 'obstacle' | 'locked' | 'sign' | 'map' | 'fx'

export const fallbackKey = (slot: FallbackSlot, element?: Element): string =>
  element ? `fallback:${slot}:${element}` : `fallback:${slot}`

type Ctx = Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect' | 'clearRect'>

/**
 * Deterministic programmatic pixel art for a slot, so the game is playable before PixelLab assets
 * exist. Shapes are drawn with whole-pixel rectangles only; every pixel stays inside (0,0)–(w,h).
 */
export function drawFallback(ctx: Ctx, slot: FallbackSlot, element: Element, w: number, h: number): void {
  const p = FALLBACK_PALETTE[element]
  const px = (x: number, y: number, rw: number, rh: number, color: string) => {
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y))
    const x1 = Math.min(w, Math.round(x + rw)), y1 = Math.min(h, Math.round(y + rh))
    if (x1 <= x0 || y1 <= y0) return
    ctx.fillStyle = color
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  }
  /** Filled ellipse by scanlines, outlined. */
  const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const t = (y + 0.5 - cy) / ry
      if (Math.abs(t) > 1) continue
      const half = rx * Math.sqrt(1 - t * t)
      px(cx - half - 1, y, 2 * half + 2, 1, OUTLINE)
      px(cx - half, y, 2 * half, 1, fill)
    }
  }
  ctx.clearRect(0, 0, w, h)
  switch (slot) {
    case 'egg': {
      ellipse(w / 2, h * 0.55, w * 0.3, h * 0.4, p.base)
      px(w * 0.38, h * 0.3, w * 0.12, h * 0.12, p.light)
      px(w * 0.5, h * 0.6, w * 0.1, h * 0.08, p.dark)
      return
    }
    case 'hatchling':
    case 'dragon': {
      const s = slot === 'dragon' ? 1 : 0.8
      ellipse(w / 2, h * 0.62, w * 0.28 * s, h * 0.22 * s, p.base) // body
      ellipse(w * 0.66, h * 0.4, w * 0.16 * s, h * 0.14 * s, p.base) // head
      px(w * 0.7, h * 0.36, 2, 2, OUTLINE) // eye
      ellipse(w * 0.5, h * 0.66, w * 0.16 * s, h * 0.1 * s, p.light) // belly
      px(w * 0.3, h * 0.32, w * 0.18 * s, h * 0.06, p.dark) // wing
      px(w * 0.18, h * 0.6, w * 0.14, h * 0.05, p.dark) // tail
      px(w * 0.4, h * 0.8, w * 0.08, h * 0.08, OUTLINE) // feet
      px(w * 0.56, h * 0.8, w * 0.08, h * 0.08, OUTLINE)
      return
    }
    case 'habitat': {
      ellipse(w / 2, h * 0.7, w * 0.46, h * 0.22, STONE) // platform
      px(w * 0.1, h * 0.7, w * 0.8, h * 0.12, SOIL)
      px(w * 0.08, h * 0.46, w * 0.84, h * 0.08, p.base) // element band
      px(w * 0.2, h * 0.3, w * 0.1, h * 0.2, p.dark) // totem
      px(w * 0.7, h * 0.3, w * 0.1, h * 0.2, p.dark)
      return
    }
    case 'nest': {
      ellipse(w / 2, h * 0.65, w * 0.42, h * 0.22, WOOD)
      ellipse(w / 2, h * 0.6, w * 0.3, h * 0.12, SOIL)
      return
    }
    case 'hatchery': {
      px(w * 0.1, h * 0.35, w * 0.8, h * 0.5, STONE)
      px(w * 0.1, h * 0.35, w * 0.8, 2, OUTLINE)
      px(w * 0.05, h * 0.2, w * 0.9, h * 0.18, p.dark) // roof
      for (let i = 0; i < 3; i++) px(w * (0.18 + i * 0.25), h * 0.5, w * 0.14, h * 0.25, PANEL) // three slots
      return
    }
    case 'farmPlot': {
      px(0, h * 0.3, w, h * 0.7, SOIL)
      px(0, h * 0.3, w, 2, OUTLINE)
      for (let i = 0; i < 4; i++) px(w * (0.1 + i * 0.22), h * 0.5, w * 0.12, h * 0.15, '#3a2a1a')
      return
    }
    case 'crop': {
      px(w * 0.45, h * 0.3, w * 0.1, h * 0.6, '#276a2b')
      ellipse(w * 0.5, h * 0.3, w * 0.25, h * 0.2, '#4caf50')
      return
    }
    case 'hoard': {
      ellipse(w / 2, h * 0.7, w * 0.42, h * 0.2, '#9a7f12') // gold pile
      ellipse(w / 2, h * 0.55, w * 0.3, h * 0.16, '#f4d03f')
      px(w * 0.3, h * 0.2, w * 0.4, h * 0.3, WOOD) // chest
      px(w * 0.3, h * 0.2, w * 0.4, 2, OUTLINE)
      return
    }
    case 'icon': {
      ellipse(w / 2, h / 2, w * 0.4, h * 0.4, p.base)
      px(w * 0.35, h * 0.3, w * 0.15, h * 0.15, p.light)
      return
    }
    case 'panel': {
      px(0, 0, w, h, PANEL_EDGE)
      px(2, 2, w - 4, h - 4, PANEL)
      return
    }
    case 'button': {
      px(0, 0, w, h, OUTLINE)
      px(1, 1, w - 2, h - 2, '#232b52')
      px(1, 1, w - 2, 1, PANEL_EDGE)
      return
    }
    case 'cursor': {
      px(0, 0, w, 1, '#ffffff'); px(0, 0, 1, h, '#ffffff')
      px(0, h - 1, w, 1, '#ffffff'); px(w - 1, 0, 1, h, '#ffffff')
      return
    }
    case 'nexus': {
      // Same platform as a habitat, banded in every element colour.
      ellipse(w / 2, h * 0.7, w * 0.46, h * 0.22, STONE)
      px(w * 0.1, h * 0.7, w * 0.8, h * 0.12, SOIL)
      const bands = Object.values(FALLBACK_PALETTE)
      bands.forEach((b, i) => px(w * 0.08 + (i * w * 0.84) / bands.length, h * 0.46, (w * 0.84) / bands.length + 1, h * 0.08, b.base))
      return
    }
    case 'decoration': {
      // A box the size of its footprint, tinted by the element argument (nature = ordinary, light = Dawnspire).
      px(0, 0, w, h, OUTLINE)
      px(1, 1, w - 2, h - 2, p.base)
      px(1, 1, w - 2, 2, p.light)
      px(1, h - 3, w - 2, 2, p.dark)
      return
    }
    case 'obstacle': {
      px(0, 0, w, h, OUTLINE)
      px(1, 1, w - 2, h - 2, p.dark)
      px(2, 2, w - 4, Math.max(1, Math.floor(h / 3)), p.base)
      return
    }
    case 'locked': {
      px(0, 0, w, h, '#0b0f1c')
      px(w * 0.35, h * 0.45, w * 0.3, h * 0.3, PANEL_EDGE) // padlock body
      px(w * 0.42, h * 0.25, w * 0.16, h * 0.2, PANEL_EDGE) // shackle
      return
    }
    case 'sign': {
      px(w * 0.45, h * 0.5, w * 0.1, h * 0.5, WOOD) // post
      px(w * 0.1, h * 0.1, w * 0.8, h * 0.45, OUTLINE)
      px(w * 0.14, h * 0.16, w * 0.72, h * 0.33, WOOD)
      px(w * 0.25, h * 0.3, w * 0.5, h * 0.05, p.light)
      return
    }
    case 'map': {
      ellipse(w / 2, h * 0.7, w * 0.42, h * 0.14, '#5e3a1d')
      ellipse(w / 2, h * 0.6, w * 0.4, h * 0.14, p.base)
      return
    }
    case 'fx': {
      // Dust puffs and a small hammer: reads as work going on, or a burst, until the animated sheets exist.
      ellipse(w * 0.3, h * 0.78, w * 0.16, h * 0.1, '#d8cbb0')
      ellipse(w * 0.68, h * 0.8, w * 0.14, h * 0.09, '#c9bb9c')
      px(w * 0.47, h * 0.25, w * 0.08, h * 0.45, WOOD) // handle
      px(w * 0.34, h * 0.18, w * 0.34, h * 0.12, STONE) // head
      px(w * 0.36, h * 0.2, w * 0.3, h * 0.04, p.light)
      return
    }
    case 'island': {
      px(0, 0, w, h, '#0f1324') // night sky
      for (let i = 0; i < 40; i++) px((i * 97) % w, (i * 53) % Math.floor(h * 0.5), 1, 1, '#f7f0c8') // stars, deterministic
      px(0, h * 0.78, w, h * 0.22, '#1f4f7a') // sea
      ellipse(w / 2, h * 0.72, w * 0.42, h * 0.1, '#5e3a1d') // island underside
      ellipse(w / 2, h * 0.66, w * 0.4, h * 0.09, '#4caf50') // grass
      return
    }
  }
}

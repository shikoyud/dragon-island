import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { ACTIVE_ART } from '../art/slots'
import type { Sprite } from '../art/types'
import { ELEMENT_COLORS } from '../domain/elements'
import type { CardData } from '../server/entrants'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 675

export interface RenderOpts {
  fetchImage?: (url: string) => Promise<ArrayBuffer | null>
}

let fontData: Buffer | undefined
/** Silkscreen latin-400 .woff from the npm package (satori reads ttf/otf/woff, not woff2). */
function loadFont(): Buffer {
  if (!fontData) {
    const require = createRequire(import.meta.url)
    const pkg = require.resolve('@fontsource/silkscreen/package.json')
    fontData = readFileSync(path.join(path.dirname(pkg), 'files', 'silkscreen-latin-400-normal.woff'))
  }
  return fontData
}

async function defaultFetchImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

function sniffMime(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf.subarray(0, 3).toString() === 'GIF') return 'image/gif'
  if (buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return 'image/png'
}

const dataUrl = (buf: Buffer, mime = sniffMime(buf)) => `data:${mime};base64,${buf.toString('base64')}`

/** Sprite as a data URL read from public/, or null when the slot is empty or unreadable. */
function spriteDataUrl(s: Sprite): string | null {
  if (!s.src) return null
  try {
    return dataUrl(readFileSync(path.join(process.cwd(), 'public', s.src)), 'image/png')
  } catch {
    return null
  }
}

/** Frame 0 of a sprite sheet at an integer scale; a flat colour block when the slot has no art. */
function SpriteBox({ sprite, size, color }: { sprite: Sprite; size: number; color: string }) {
  const url = spriteDataUrl(sprite)
  if (!url) return <div style={{ display: 'flex', width: size, height: size, background: color }} />
  const scale = Math.max(1, Math.floor(size / sprite.h))
  const w = sprite.w * scale
  const h = sprite.h * scale
  return (
    <div style={{ display: 'flex', width: w, height: h, overflow: 'hidden' }}>
      <img src={url} width={w * sprite.frames} height={h} style={{ imageRendering: 'pixelated', maxWidth: 'none' }} />
    </div>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function siteHost(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
  if (!raw) return ''
  try {
    return new URL(raw).host
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  }
}

/** 1200x675 share card. Avatar fetch failure or an empty avatar falls back to the hatchling sprite. */
export async function renderCard(data: CardData, opts: RenderOpts = {}): Promise<Response> {
  const fetchImage = opts.fetchImage ?? defaultFetchImage
  const colors = ELEMENT_COLORS[data.element]
  const egg = ACTIVE_ART.egg[data.element]
  const hatchling = ACTIVE_ART.hatchling[data.element]

  let avatar: string | null = null
  if (data.avatarUrl) {
    try {
      const buf = await fetchImage(data.avatarUrl)
      if (buf && buf.byteLength > 0) avatar = dataUrl(Buffer.from(buf))
    } catch {
      avatar = null
    }
  }

  const font = loadFont()
  const text = { fontFamily: 'Silkscreen', color: '#f3f0ff', display: 'flex' } as const

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 56,
          background: '#0d1024',
          borderTop: `16px solid ${colors.base}`,
        }}
      >
        <div style={{ ...text, fontSize: 44, color: colors.light, letterSpacing: 6 }}>WYRMHAVEN</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', width: 128, height: 128, border: `6px solid ${colors.base}`, overflow: 'hidden' }}>
                {avatar ? (
                  <img src={avatar} width={116} height={116} />
                ) : (
                  <SpriteBox sprite={hatchling} size={116} color={colors.base} />
                )}
              </div>
              <div style={{ ...text, fontSize: 52, marginLeft: 28 }}>{`@${data.handle}`}</div>
            </div>
            <div style={{ ...text, fontSize: 96, marginTop: 40, color: colors.light }}>{`#${data.position}`}</div>
            <div style={{ ...text, fontSize: 36, marginTop: 16 }}>{`Starting element: ${cap(data.element)}`}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <SpriteBox sprite={egg} size={176} color={colors.dark} />
            <div style={{ display: 'flex', marginLeft: 32 }}>
              <SpriteBox sprite={hatchling} size={240} color={colors.base} />
            </div>
          </div>
        </div>

        <div style={{ ...text, fontSize: 28, color: colors.light }}>{siteHost()}</div>
      </div>
    ),
    { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: [{ name: 'Silkscreen', data: font, style: 'normal', weight: 400 }] },
  )
}

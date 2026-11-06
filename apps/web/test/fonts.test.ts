import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')
const stack = (css: string, name: string) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1] ?? ''

describe('pixel fonts (UI rework P1)', () => {
  it('loads no font from Google', () => {
    expect(read('index.html')).not.toMatch(/fonts\.googleapis\.com/)
  })
  it('uses Silkscreen for display and Pixelify Sans for body, with no browser default family in the stack', () => {
    const css = read('src/styles/tokens.css')
    const display = stack(css, '--font-display')
    const body = stack(css, '--font-body')
    expect(display).toMatch(/^'Silkscreen'/)
    expect(body).toMatch(/^'Pixelify Sans'/)
    for (const s of [display, body]) expect(s).not.toMatch(/Inter|Courier New|system-ui|sans-serif/)
  })
  it('bundles the font files', () => {
    const src = read('src/styles/fonts.ts')
    expect(src).toMatch(/@fontsource\/silkscreen/)
    expect(src).toMatch(/@fontsource\/pixelify-sans/)
    expect(read('src/main.tsx')).toMatch(/styles\/fonts/)
  })
})

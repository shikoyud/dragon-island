// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Faq } from '../src/components/Faq'
import { Pillars } from '../src/components/Pillars'

afterEach(cleanup)

const SRC = join(__dirname, '..', 'src')
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? (f === 'art' ? [] : files(p)) : /\.(tsx?|css)$/.test(f) ? [p] : []
  })

// GDD M1 Q3: the game runs once for 14 or 28 days and shuts down. There are no seasons and no Season Points.
describe('waitlist copy (GDD §1, §1.5)', () => {
  it('no page source mentions seasons or Season Points', () => {
    for (const f of files(SRC)) {
      const text = readFileSync(f, 'utf8')
      for (const banned of ['Season Points', '14-day season', 'Battle for the season', 'Seasons']) {
        expect(text, `${f} contains "${banned}"`).not.toContain(banned)
      }
    }
  })

  it('the FAQ and the pillars say the game runs once and then shuts down', () => {
    const faq = render(<Faq xHandle="dragonisland" />).container.textContent!
    expect(faq).toMatch(/14 or 28 days/)
    expect(faq).toMatch(/shuts down/)
    cleanup()
    const pillars = render(<Pillars />).container.textContent!
    expect(pillars).toMatch(/14 or 28 days/)
    expect(pillars).toMatch(/ranked/i)
    expect(pillars).toMatch(/legal review/i)
    expect(pillars).not.toMatch(/season/i)
  })
})

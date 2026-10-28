// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ACTIVE_ART } from '../src/art/slots'
import { CardView } from '../src/components/CardView'
import { Faq } from '../src/components/Faq'

afterEach(cleanup)

describe('<CardView> (/c/[code])', () => {
  it('shows the wordmark, the versioned card in a pixel panel and a big Join button carrying the ref', () => {
    const { container } = render(<CardView code="ABC123" handle="ember" position={7} />)
    expect(screen.getByRole('link', { name: /wyrmhaven home/i }).getAttribute('href')).toBe('/')
    const img = screen.getByRole('img', { name: 'Wyrmhaven card for @ember, #7' })
    expect(img.getAttribute('src')).toBe(`/api/card/ABC123.png?v=${encodeURIComponent(ACTIVE_ART.version)}`)
    expect(img.closest('.px-frame, .px-frame-art')).toBeTruthy()
    const join = screen.getByRole('link', { name: 'Join the waitlist' })
    expect(join.getAttribute('href')).toBe('/?ref=ABC123#join')
    expect(join.className).toMatch(/btn-primary/)
    expect(join.className).toMatch(/btn-big/)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/@ember is #7/)
    expect(container.querySelector('main')).toBeTruthy()
  })
})

describe('<Faq>', () => {
  it('lists the X account creation date and the referral link among what we store', () => {
    render(<Faq xHandle="wyrmhaven" />)
    const answer = screen.getByText(/we never post for you/i).textContent!
    expect(answer).toMatch(/creation date/i)
    expect(answer).toMatch(/referral link/i)
  })
})

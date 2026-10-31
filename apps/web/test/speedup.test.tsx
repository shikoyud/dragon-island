import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { messageFor } from '../src/api/errors'
import { ConstructionStatus } from '../src/panels/ConstructionStatus'
import { FarmPanel } from '../src/panels/FarmPanel'
import { BreedPanel } from '../src/panels/BreedPanel'
import { HatcheryPanel } from '../src/panels/HatcheryPanel'
import { pickToken, SpeedUpButton } from '../src/panels/SpeedUpButton'
import { useAutoFinish } from '../src/panels/useAutoFinish'
import { harness } from './harness'

const base = newPlayer(0)
const H = 3_600_000
const own = (a: number, b: number, c: number) => ({ '15m': a, '1h': b, '3h': c })
const egg = (readyAtMs: number) => ({ speciesId: 'flame', readyAtMs, hatchMs: 7, xpFree: false })

describe('pickToken', () => {
  it('is the largest token not longer than the time left, else the smallest owned', () => {
    expect(pickToken(own(1, 1, 1), 4 * H)).toBe('3h')
    expect(pickToken(own(1, 1, 1), 3 * H)).toBe('3h')
    expect(pickToken(own(1, 1, 1), 2 * H)).toBe('1h')
    expect(pickToken(own(1, 1, 1), 30 * 60_000)).toBe('15m')
    expect(pickToken(own(0, 1, 1), 30 * 60_000)).toBe('1h') // no 15m owned: the smallest owned
    expect(pickToken(own(0, 0, 2), 10 * 60_000)).toBe('3h')
    expect(pickToken(own(0, 0, 0), 5 * H)).toBeNull()
  })
})

describe('SpeedUpButton', () => {
  it('is hidden with no tokens and appears when one is gained', async () => {
    const none = harness({ ...base, speedUps: own(0, 0, 0) })
    none.wrap(<SpeedUpButton id="su" target="farm" index={0} readyAtMs={3 * H} nowMs={0} />)
    expect(screen.queryByRole('button')).toBeNull()
    none.setState({ ...base, speedUps: own(1, 1, 1) })
    expect(await screen.findByRole('button')).toBeInTheDocument()
  })
  it('does not render for a finished timer', () => {
    harness({ ...base, speedUps: own(1, 1, 1) }).wrap(<SpeedUpButton id="su" target="farm" index={0} readyAtMs={5} nowMs={5} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('labels the pick and the count left, and fires useSpeedUp', async () => {
    const h = harness({ ...base, speedUps: own(0, 2, 1) })
    h.wrap(<SpeedUpButton id="su" target="breeder" index={0} readyAtMs={2 * H} nowMs={0} />)
    const b = screen.getByRole('button', { name: 'Use 1 h · 2 left' })
    await userEvent.click(b)
    expect(h.action).toHaveBeenCalledWith({ type: 'useSpeedUp', token: '1h', target: 'breeder', index: 0 }, expect.any(String))
  })
  it('takes the smallest owned when every token is longer than the time left', () => {
    harness({ ...base, speedUps: own(0, 0, 3) }).wrap(<SpeedUpButton id="su" target="farm" index={0} readyAtMs={600_000} nowMs={0} />)
    expect(screen.getByRole('button', { name: 'Use 3 h · 3 left' })).toBeInTheDocument()
  })
})

describe('panels with a timer', () => {
  const tokens = own(0, 1, 0)
  it('Breed, Hatchery, Farm and ConstructionStatus offer the token beside the $DRIS skip', async () => {
    const b = harness({ ...base, speedUps: tokens, breeders: [{ ...base.breeders[0]!, egg: egg(2 * H) }] }, 0, undefined, { launchAtMs: 0 })
    b.wrap(<BreedPanel nowMs={0} />)
    await userEvent.click(screen.getByRole('button', { name: 'Use 1 h · 1 left' }))
    expect(b.action).toHaveBeenCalledWith({ type: 'useSpeedUp', token: '1h', target: 'breeder', index: 0 }, expect.any(String))
    expect(screen.getByRole('button', { name: /Skip/ })).toBeInTheDocument()
  })
  it('Hatchery', async () => {
    const h = harness({ ...base, speedUps: tokens, hatchery: [{ speciesId: 'flame', readyAtMs: 2 * H }] })
    h.wrap(<HatcheryPanel nowMs={0} />)
    await userEvent.click(screen.getByRole('button', { name: 'Use 1 h · 1 left' }))
    expect(h.action).toHaveBeenCalledWith({ type: 'useSpeedUp', token: '1h', target: 'hatchery', index: 0 }, expect.any(String))
  })
  it('Farm', async () => {
    const h = harness({ ...base, speedUps: tokens, farms: [{ ...base.farms[0]!, crop: 'dragonBush', readyAtMs: 2 * H }] })
    h.wrap(<FarmPanel index={0} nowMs={0} />)
    await userEvent.click(screen.getByRole('button', { name: 'Use 1 h · 1 left' }))
    expect(h.action).toHaveBeenCalledWith({ type: 'useSpeedUp', token: '1h', target: 'farm', index: 0 }, expect.any(String))
  })
  it('ConstructionStatus', async () => {
    const h = harness({ ...base, speedUps: tokens, constructions: [{ kind: 'upgrade', building: { type: 'habitat', id: 'h1' }, readyAtMs: 2 * H }] })
    h.wrap(<ConstructionStatus index={0} readyAtMs={2 * H} nowMs={0} id="c0" label="Upgrading" />)
    await userEvent.click(screen.getByRole('button', { name: 'Use 1 h · 1 left' }))
    expect(h.action).toHaveBeenCalledWith({ type: 'useSpeedUp', token: '1h', target: 'construction', index: 0 }, expect.any(String))
  })
})

function Finisher({ nowMs }: { nowMs: number }) {
  useAutoFinish(nowMs)
  return null
}

describe('after a token', () => {
  const clear = (readyAtMs: number) => ({ kind: 'clear' as const, obstacleId: 'o1', readyAtMs })
  it('a clear a token brought to zero is completed by the existing auto-finish', async () => {
    const h = harness({ ...base, speedUps: own(0, 0, 0), constructions: [clear(1_000)] })
    h.wrap(<Finisher nowMs={1_000} />)
    await waitFor(() => expect(h.action).toHaveBeenCalledWith({ type: 'finishConstruction', index: 0 }, expect.any(String)))
  })
  it('toasts a speed-up the finished clear dropped', async () => {
    const before: PlayerState = { ...base, speedUps: own(0, 0, 0), constructions: [clear(0)] }
    const h = harness(before)
    h.action.mockImplementation(async () => ({ state: { ...before, constructions: [], speedUps: own(0, 0, 1) }, effects: [] }))
    h.wrap(<Finisher nowMs={5} />)
    expect(await screen.findByText('Found a 3 h speed-up')).toBeInTheDocument()
  })
  it('words NO_TOKEN', () => {
    expect(messageFor('NO_TOKEN')).toBe('You have no speed-up token of that kind.')
  })
})

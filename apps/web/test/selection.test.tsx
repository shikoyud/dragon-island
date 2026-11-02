import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { newPlayer } from '@wyrmhaven/game-core'
import { afterEach, describe, expect, it } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { harness, TestHost } from './harness'

afterEach(cleanup)
const base = newPlayer(0)
const row = () => screen.queryByRole('region', { name: /actions$/ })

describe('a tap selects (UI rework ruling A1)', () => {
  it('a habitat tap shows its row and tells the scene; the same tap again, or empty land, deselects', () => {
    const bridge = createBridge()
    harness(base).wrap(<TestHost bridge={bridge} />)
    act(() => bridge.emit({ type: 'select', target: { kind: 'habitat', id: 'h1' } }))
    expect(row()).toHaveAccessibleName('Terra Habitat actions')
    expect(bridge.selection).toEqual({ kind: 'habitat', id: 'h1' })
    expect(screen.queryByRole('region', { name: /habitat h1/i })).toBeNull() // no dialog
    act(() => bridge.emit({ type: 'select', target: { kind: 'habitat', id: 'h1' } }))
    expect(row()).toBeNull()
    expect(bridge.selection).toBeNull()
    act(() => bridge.emit({ type: 'select', target: { kind: 'farm', plot: 0 } }))
    expect(row()).toHaveAccessibleName('Farm actions')
    act(() => bridge.emit({ type: 'select', target: { kind: 'empty' } }))
    expect(row()).toBeNull()
  })

  it('a dragon tap selects its habitat', () => {
    const bridge = createBridge()
    harness(base).wrap(<TestHost bridge={bridge} />)
    act(() => bridge.emit({ type: 'select', target: { kind: 'dragon', id: 'd2' } }))
    expect(row()).toHaveAccessibleName('Flame Habitat actions')
  })

  it('a plot for sale still opens its panel and selects nothing', () => {
    const bridge = createBridge()
    harness(base).wrap(<TestHost bridge={bridge} />)
    act(() => bridge.emit({ type: 'select', target: { kind: 'habitat', id: 'h1' } }))
    act(() => bridge.emit({ type: 'select', target: { kind: 'plot', island: 'home', plot: 2 } }))
    expect(row()).toBeNull()
    expect(bridge.selection).toBeNull()
    expect(screen.getByRole('button', { name: /Buy plot/ })).toBeInTheDocument()
  })

  it('Info opens the panel over the row; closing it brings the row back with the selection kept (review focus 1)', () => {
    const bridge = createBridge()
    harness(base).wrap(<TestHost bridge={bridge} />)
    act(() => bridge.emit({ type: 'select', target: { kind: 'farm', plot: 0 } }))
    fireEvent.click(screen.getByRole('button', { name: 'Info' }))
    expect(row()).toBeNull()
    expect(screen.getByRole('region', { name: 'Farm' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(row()).toHaveAccessibleName('Farm actions')
    expect(bridge.selection).toEqual({ kind: 'farm', plot: 0 })
  })

  it('a selected thing that goes away (a cleared obstacle) drops the selection', async () => {
    const bridge = createBridge()
    const h = harness(base)
    h.wrap(<TestHost bridge={bridge} />)
    const id = base.islands.obstacles[0]!.id
    act(() => bridge.emit({ type: 'select', target: { kind: 'obstacle', id } }))
    expect(row()).not.toBeNull()
    h.setState({ ...base, islands: { ...base.islands, obstacles: base.islands.obstacles.slice(1) } })
    await waitFor(() => expect(row()).toBeNull())
    expect(bridge.selection).toBeNull()
  })
})

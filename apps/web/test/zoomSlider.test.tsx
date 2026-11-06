import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { ZoomSlider } from '../src/hud/ZoomSlider'

afterEach(cleanup)

function mounted(zoom: { zoom: number; min: number; max: number } | null = { zoom: 2, min: 1, max: 4 }) {
  const bridge = createBridge()
  bridge.zoom = zoom
  const setZoom = vi.spyOn(bridge, 'setZoom').mockImplementation(() => {})
  render(<ZoomSlider bridge={bridge} />)
  return { bridge, setZoom }
}

describe('the zoom slider', () => {
  it('reflects the scene zoom and range', () => {
    const { bridge } = mounted()
    const track = screen.getByRole('slider', { name: 'Zoom' })
    expect(track).toHaveAttribute('min', '1')
    expect(track).toHaveAttribute('max', '4')
    expect(track).toHaveAttribute('step', '1')
    expect(track).toHaveAttribute('orient', 'vertical')
    expect(track).toHaveValue('2')
    act(() => { bridge.zoom = { zoom: 3, min: 1, max: 5 }; bridge.emit({ type: 'zoom' }) })
    expect(track).toHaveValue('3')
    expect(track).toHaveAttribute('max', '5')
  })

  it('plus and minus step by one and stop at the ends (disabled)', async () => {
    const { bridge, setZoom } = mounted()
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(setZoom).toHaveBeenLastCalledWith(3)
    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(setZoom).toHaveBeenLastCalledWith(1)
    act(() => { bridge.zoom = { zoom: 4, min: 1, max: 4 }; bridge.emit({ type: 'zoom' }) })
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled()
    act(() => { bridge.zoom = { zoom: 1, min: 1, max: 4 }; bridge.emit({ type: 'zoom' }) })
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled()
  })

  it('plus is on top of the track and minus below it', () => {
    mounted()
    const order = [...document.querySelectorAll('.zoom-slider > *')].map(e => e.getAttribute('aria-label'))
    expect(order).toEqual(['Zoom in', 'Zoom', 'Zoom out'])
  })

  it('dragging the track sets a whole zoom', () => {
    const { setZoom } = mounted()
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '3' } })
    expect(setZoom).toHaveBeenLastCalledWith(3)
  })

  it('is hidden before the scene reports a zoom', () => {
    mounted()
    expect(screen.getByRole('slider', { name: 'Zoom' })).toBeInTheDocument()
    cleanup()
    mounted(null)
    expect(screen.queryByRole('slider', { name: 'Zoom' })).toBeNull()
  })
})

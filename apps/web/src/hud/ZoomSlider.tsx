import { memo, useEffect, useState, type CSSProperties } from 'react'
import type { Bridge } from '../game/bridge'
import { ArtMark, useHudSprite } from './ArtMark'

type Zoom = NonNullable<Bridge['zoom']>

/**
 * The island's zoom at the right edge: plus on top, a vertical track, minus below. It follows the island scene's zoom and range
 * through the bridge's `zoom` event, and asks the scene to zoom through `setZoom`. It is memoised on the
 * bridge alone and never reads the clock, so the HUD's 1 s tick doesn't render it.
 */
export const ZoomSlider = memo(function ZoomSlider({ bridge }: { bridge: Bridge }) {
  const [zoom, setZoom] = useState<Zoom | null>(bridge.zoom)
  const thumb = useHudSprite('ui.zoom.thumb')
  useEffect(() => {
    // The scene may have reported between the first render and this subscription.
    setZoom(bridge.zoom)
    return bridge.on('zoom', () => setZoom(bridge.zoom))
  }, [bridge])

  if (!zoom) return null
  const style = thumb ? { '--zoom-thumb': `url("${thumb.src}")` } as CSSProperties : undefined
  return (
    <div className="zoom-slider" role="group" aria-label="Zoom controls" style={style}>
      <button type="button" className="zoom-slider__btn" aria-label="Zoom in" disabled={zoom.zoom >= zoom.max} onClick={() => bridge.setZoom(zoom.zoom + 1)}>
        <ArtMark name="ui.zoom.plus" size={32} />
        <span className="zoom-slider__glyph" aria-hidden="true">+</span>
      </button>
      <input className="zoom-slider__track" type="range" aria-label="Zoom" min={zoom.min} max={zoom.max} step={1} value={zoom.zoom}
        {...{ orient: 'vertical' }} onChange={e => bridge.setZoom(Number(e.currentTarget.value))} />
      <button type="button" className="zoom-slider__btn" aria-label="Zoom out" disabled={zoom.zoom <= zoom.min} onClick={() => bridge.setZoom(zoom.zoom - 1)}>
        <ArtMark name="ui.zoom.minus" size={32} />
        <span className="zoom-slider__glyph" aria-hidden="true">&minus;</span>
      </button>
    </div>
  )
})

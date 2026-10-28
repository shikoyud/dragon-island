import type { CSSProperties, ReactNode } from 'react'
import { ACTIVE_ART } from '../art/slots'

/**
 * A framed box. Uses the `ui.panel` 9-slice when the art set has one,
 * otherwise a stepped CSS pixel border (`.px-frame` in globals.css).
 */
export function Panel({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  const frame = ACTIVE_ART.ui.panel
  if (!frame.src) {
    return (
      <div id={id} className={`px-frame ${className}`}>
        {children}
      </div>
    )
  }
  const slice = Math.floor(Math.min(frame.w, frame.h) / 3)
  const style: CSSProperties = {
    borderStyle: 'solid',
    borderWidth: slice * 3,
    borderImage: `url(${frame.src}) ${slice} fill / ${slice * 3}px stretch`,
    imageRendering: 'pixelated',
  }
  return (
    <div id={id} className={`px-frame-art ${className}`} style={style}>
      {children}
    </div>
  )
}

import type { ReactNode } from 'react'
import { Icon } from '../../hud/Icon'
import { formatGold, formatMicroUsd } from '../Money'

/** Pill colours (UI rework Phase 2): blue buy/upgrade/select, yellow go/battle/place, green claim/feed/confirm, purple premium, grey unavailable, red offer. */
export type PillColor = 'blue' | 'yellow' | 'green' | 'purple' | 'grey' | 'red'

/**
 * A pill button. Disabled pills turn grey, keep the native `disabled` attribute and show their reason under them, which
 * also describes the button for screen readers.
 */
export function PillButton({
  color = 'blue', children, onClick, disabled, reason, id, ariaLabel, small, className,
}: {
  color?: PillColor; children: ReactNode; onClick?: () => void; disabled?: boolean; reason?: string; id?: string
  ariaLabel?: string; small?: boolean; className?: string
}) {
  const descId = id ? `${id}-why` : undefined
  const button = (
    <button
      type="button"
      id={id}
      className={`kit-pill kit-pill--${disabled ? 'grey' : color}${small ? ' kit-pill--small' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={disabled && reason && descId ? descId : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
  if (!(disabled && reason)) return button
  return (
    <span className="kit-pill-wrap">
      {button}
      <small id={descId} className="kit-why">{reason}</small>
    </span>
  )
}

export type Currency = 'gold' | 'food' | 'dris' | 'usd'

/** A price inside a button: the number and its currency icon; the number turns red when the player can't afford it. */
export function PriceTag({ amount, currency, affordable }: { amount: number; currency: Currency; affordable?: boolean }) {
  const text = currency === 'usd' ? formatMicroUsd(amount) : formatGold(amount)
  return (
    <span className={`kit-price${affordable === false ? ' kit-price--short' : ''}`}>
      <span className="kit-price__n">{text}</span>
      {currency !== 'usd' && <Icon name={currency} size={16} />}
    </span>
  )
}

function Square({ kind, label, onClick, glyph }: { kind: 'close' | 'back' | 'help'; label: string; onClick: () => void; glyph: ReactNode }) {
  return (
    <button type="button" className={`kit-square kit-square--${kind}`} aria-label={label} onClick={onClick}>
      <span className="kit-square__glyph" aria-hidden="true">{glyph}</span>
    </button>
  )
}

/** Round red close button with a white X: one square sprite, so it never squishes (review image-6). */
export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return <Square kind="close" label={label} onClick={onClick} glyph={<PixelGlyph rows={X_ROWS} />} />
}
/** Orange rounded square with a white left arrow. */
export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return <Square kind="back" label={label} onClick={onClick} glyph={<PixelGlyph rows={ARROW_ROWS} />} />
}
/** Blue rounded square with a white question mark. */
export function HelpButton({ onClick, label = 'Help' }: { onClick: () => void; label?: string }) {
  return <Square kind="help" label={label} onClick={onClick} glyph={<PixelGlyph rows={HELP_ROWS} />} />
}

// 8x8 white glyphs with an ink edge ('#' white, 'k' ink), drawn as SVG rects so they stay crisp at any integer scale.
const X_ROWS = ['##....##', '###..###', '.######.', '..####..', '..####..', '.######.', '###..###', '##....##']
const ARROW_ROWS = ['...#....', '..##....', '.#######', '########', '########', '.#######', '..##....', '...#....']
const HELP_ROWS = ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '...##...', '........', '...##...']

function PixelGlyph({ rows }: { rows: string[] }) {
  return (
    <svg viewBox="0 0 8 8" width="100%" height="100%" shapeRendering="crispEdges">
      {rows.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === '#' ? [<rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="#fff" />] : [])))}
    </svg>
  )
}

import type { Element, Rarity } from '@wyrmhaven/game-core'
import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'

/**
 * Round action button (Phase 4's action row): white rounded square, orange ring, big icon, outlined label below; an
 * optional timer chip above, a corner badge ("New") and a lock badge.
 */
export function RoundAction({
  icon, label, onClick, timer, locked, badge, disabled,
}: { icon: ReactNode; label: string; onClick?: () => void; timer?: string; locked?: boolean; badge?: string; disabled?: boolean }) {
  return (
    <button type="button" className={`kit-round${locked ? ' kit-round--locked' : ''}`} onClick={onClick} disabled={disabled} aria-label={label}>
      {timer && <span className="kit-round__timer" aria-hidden="true">{timer}</span>}
      <span className="kit-round__plate" aria-hidden="true">
        {icon}
        {badge && <span className="kit-round__badge">{badge}</span>}
        {locked && <span className="kit-round__lock"><LockGlyph /></span>}
      </span>
      <span className="kit-round__label" aria-hidden="true">{label}</span>
    </button>
  )
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 8 8" width="100%" height="100%" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 1h4v1h1v2H6V2H2v2H1V2h1z M1 4h6v4H1z" fill="#fff" />
      <rect x="3.5" y="5" width="1" height="2" fill="#4a4f5c" />
    </svg>
  )
}

const ELEMENT_NAME = (e: Element) => e.charAt(0).toUpperCase() + e.slice(1)
const RARITY_LETTER: Record<Rarity, string> = { common: 'C', uncommon: 'U', rare: 'R', epic: 'E', legendary: 'L' }
const RARITY_NAME: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

/** A hanging element banner in the element's colour. */
export function ElementRibbon({ element }: { element: Element }) {
  return <span className={`kit-ribbon kit-ribbon--${element}`} role="img" aria-label={ELEMENT_NAME(element)} style={{ ['--el' as string]: `var(--el-${element})` }} />
}

/** A rarity shield with its letter (ruling P6: C, U, R, E, L). */
export function RarityShield({ rarity }: { rarity: Rarity }) {
  return <span className={`kit-shield kit-shield--${rarity}`} role="img" aria-label={RARITY_NAME[rarity]}>{RARITY_LETTER[rarity]}</span>
}

/**
 * Shop and storage card: scale-pattern header, title, element ribbons, rarity shield, art and a footer (the price button).
 * Locked (`lockedLevel`): greyed, a lock and "Required level N" in place of the footer.
 */
export function KitCard({
  title, elements, rarity, art, footer, lockedLevel, children,
}: { title: string; elements?: readonly Element[]; rarity?: Rarity; art?: ReactNode; footer?: ReactNode; lockedLevel?: number; children?: ReactNode }) {
  const locked = lockedLevel !== undefined
  return (
    <article className={`kit-card${locked ? ' kit-card--locked' : ''}`} aria-label={title}>
      <header className="kit-card__head">
        <h3 className="kit-card__title">{title}</h3>
      </header>
      {(elements?.length || rarity) && (
        <div className="kit-card__marks">
          <span className="kit-card__ribbons">{elements?.map(e => <ElementRibbon key={e} element={e} />)}</span>
          {rarity && <RarityShield rarity={rarity} />}
        </div>
      )}
      {art && <div className="kit-card__art">{art}</div>}
      {children}
      <footer className="kit-card__foot">
        {locked
          ? <span className="kit-card__locked"><span className="kit-card__lock"><LockGlyph /></span>Required level {lockedLevel}</span>
          : footer}
      </footer>
    </article>
  )
}

/** Resource pill: icon, dark number field, green plus. */
export function ResourcePill({ icon, value, onPlus, plusLabel = 'Get more' }: { icon: ReactNode; value: string; onPlus?: () => void; plusLabel?: string }) {
  return (
    <span className="kit-resource">
      <span className="kit-resource__icon">{icon}</span>
      <span className="kit-resource__value">{value}</span>
      {onPlus && <button type="button" className="kit-resource__plus" aria-label={plusLabel} onClick={onPlus}><span aria-hidden="true">+</span></button>}
    </span>
  )
}

/** Dark rounded bar with a green fill and the time left centred. `value` is clamped to [0, max]. */
export function ProgressBar({ value, max, label, name }: { value: number; max: number; label?: string; name?: string }) {
  const v = Math.min(max, Math.max(0, value))
  const pct = max > 0 ? Math.round((v / max) * 100) : 0
  return (
    <span className="kit-bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={v} aria-label={name}>
      <span className="kit-bar__fill" style={{ width: `${pct}%` }} />
      {label && <span className="kit-bar__label">{label}</span>}
    </span>
  )
}

/** White speech bubble with a dark outline, a tail and one icon; a button when tappable. */
export function Bubble({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  if (!onClick) return <span className="kit-bubble" role="img" aria-label={label}>{icon}</span>
  return <button type="button" className="kit-bubble" aria-label={label} onClick={onClick}>{icon}</button>
}

/** A small rounded panel in the body font, shown on hover or focus; it also describes its child for screen readers. */
export function Tooltip({ text, children }: { text: string; children: ReactElement<{ 'aria-describedby'?: string }> }) {
  const id = useId()
  return (
    <span className="kit-tip-host">
      {cloneElement(children, { 'aria-describedby': id })}
      <span role="tooltip" id={id} className="kit-tip">{text}</span>
    </span>
  )
}

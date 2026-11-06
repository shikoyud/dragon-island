import type { ReactNode } from 'react'
import { BackButton, CloseButton, HelpButton } from './buttons'

/** The frame's accessible name says the badge too: "Hatchery · 2/4". */
const nameOf = (title: string, badge?: string) => (badge === undefined ? title : `${title} · ${badge}`)

function Plank({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="kit-plank-row">
      <h2 className="kit-plank" title={title}>{title}</h2>
      {badge !== undefined && <span className="kit-badge">{badge}</span>}
    </div>
  )
}

/**
 * The light dialog frame: grey bevelled border, a wooden plank title on the top edge with an optional dark count badge,
 * a round close button on the top-right corner, and a body that scrolls with the pixel scrollbar.
 */
export function DialogFrame({ title, badge, onClose, children, wide }: { title: string; badge?: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`kit-frame panel${wide ? ' kit-frame--wide' : ''}`} aria-label={nameOf(title, badge)}>
      <Plank title={title} badge={badge} />
      {onClose && <span className="kit-frame__close"><CloseButton onClick={onClose} /></span>}
      <div className="kit-frame__body kit-scroll">{children}</div>
    </section>
  )
}

export type Backdrop = 'scene' | 'wood' | 'parchment'

/** A full-screen frame (Shop, Storage, Breeding, Book, Quests, battle): backdrop, plank top centre, back/help/close top right. */
export function FullScreenFrame({
  title, badge, onClose, onBack, onHelp, backdrop = 'scene', children,
}: { title: string; badge?: string; onClose?: () => void; onBack?: () => void; onHelp?: () => void; backdrop?: Backdrop; children: ReactNode }) {
  return (
    <section className={`kit-full kit-full--${backdrop} panel`} aria-label={nameOf(title, badge)}>
      <header className="kit-full__top">
        <Plank title={title} badge={badge} />
        <span className="kit-full__buttons">
          {onHelp && <HelpButton onClick={onHelp} />}
          {onBack && <BackButton onClick={onBack} />}
          {onClose && <CloseButton onClick={onClose} />}
        </span>
      </header>
      <div className="kit-full__body kit-scroll">{children}</div>
    </section>
  )
}

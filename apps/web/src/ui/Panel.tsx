import { PillButton } from './kit/buttons'
import { DialogFrame } from './kit/frames'
import type { ReactNode } from 'react'

/** A dialog's frame: the kit's light frame with a plank title, an optional count badge and a close button. */
export function Panel({ title, children, onClose, badge }: { title: string; children: ReactNode; onClose?: () => void; badge?: string }) {
  return <DialogFrame title={title} badge={badge} onClose={onClose}>{children}</DialogFrame>
}

/** The old action button API, drawn as a kit pill: primary is yellow (go/place), danger red, the rest blue. */
export function ActionButton({
  id, children, onClick, disabled, reason, primary, danger, ariaLabel,
}: { id: string; children: ReactNode; onClick?: () => void; disabled?: boolean; reason?: string; primary?: boolean; danger?: boolean; ariaLabel?: string }) {
  return (
    <span className="action-button">
      <PillButton id={id} color={danger ? 'red' : primary ? 'yellow' : 'blue'} disabled={disabled} reason={reason} onClick={onClick} ariaLabel={ariaLabel}>
        {children}
      </PillButton>
    </span>
  )
}

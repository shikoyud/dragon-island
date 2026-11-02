import { getSpecies, LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { memo } from 'react'
import { RoundAction } from '../ui/kit/pieces'
import type { ActionRow, RowButton, RowIntent } from './actionRow'
import { Icon } from './Icon'

/** A resident's portrait: its first element's icon until Phase 5 draws dragon heads. */
function ButtonIcon({ b }: { b: RowButton }) {
  if (b.portrait) return <Icon name={getSpecies(LAUNCH_CATALOG, b.portrait.speciesId).elements[0]!} size={32} />
  return <Icon name={b.icon === 'breed' ? 'breed' : b.icon === 'dragon' ? 'dragons' : b.icon} size={32} />
}

/**
 * The selected thing's round action buttons, bottom right (UI rework Phase 4): its name in a label over the last button,
 * a timer or amount over a button that has one, a lock on a gated Upgrade (it still opens Info, which says why).
 */
export const ActionBar = memo(function ActionBar({ row, onIntent }: { row: ActionRow; onIntent: (i: RowIntent) => void }) {
  return (
    <section className="action-bar" aria-label={`${row.name} actions`}>
      <ul className="action-bar__row">
        {row.buttons.map((b, i) => (
          <li key={`${b.icon}:${i}`} className="action-bar__item">
            {i === row.buttons.length - 1 && <span className="action-bar__name">{row.name}</span>}
            <RoundAction
              icon={<ButtonIcon b={b} />}
              label={b.label}
              timer={b.above}
              badge={b.badge === 'new' ? 'New' : undefined}
              locked={Boolean(b.locked)}
              disabled={Boolean(b.disabled)}
              reason={b.locked ?? b.disabled}
              onClick={() => onIntent(b.intent)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
})

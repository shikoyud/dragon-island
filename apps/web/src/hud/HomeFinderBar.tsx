import { PillButton } from '../ui/kit/buttons'

/** While a waiting dragon's home is chosen (ruling A5): what to do, and Cancel, bottom right where the action row goes. */
export function HomeFinderBar({ name, onCancel }: { name: string; onCancel: () => void }) {
  return (
    <section className="action-bar home-finder" aria-label="Choose a home">
      <p className="action-bar__name home-finder__text">{`Tap a glowing habitat for ${name}`}</p>
      <PillButton color="red" onClick={onCancel}>Cancel</PillButton>
    </section>
  )
}

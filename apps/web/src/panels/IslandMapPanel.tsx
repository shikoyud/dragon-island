import { ISLAND_ORDER, LAUNCH_CATALOG, OUTER_ISLANDS, getSpecies, type IslandId } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

const NAMES: Record<IslandId, string> = { home: 'Home island', isle2: 'Second island', isle3: 'Third island', isle4: 'Fourth island', isle5: 'Fifth island', dawnspire: 'Dawnspire' }

/** Switch between unlocked islands and unlock the next one (in order, for gold). */
export function IslandMapPanel({ view, onView, onClose }: { view: IslandId; onView: (id: IslandId) => void; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  if (!s) return null
  const unlocked = new Set(s.islands.unlocked)
  const nextId = ISLAND_ORDER.find(id => !unlocked.has(id))
  return (
    <Panel title="Islands" onClose={onClose}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {ISLAND_ORDER.map(id => {
          if (unlocked.has(id)) {
            return (
              <li key={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{NAMES[id]}</span>
                <button type="button" className={`btn ${view === id ? 'btn--primary' : ''}`} aria-label={`Go to ${NAMES[id]}`} aria-pressed={view === id} onClick={() => onView(id)}>Go</button>
              </li>
            )
          }
          const req = OUTER_ISLANDS[id as Exclude<IslandId, 'home'>]
          if (id !== nextId) return <li key={id}>{NAMES[id]} · <span>Locked · level {req.minLevel}</span></li>
          // Same order as game-core's unlockIsland: level, then legendary (Dawnspire), then gold.
          const legendary = s.dragons.some(d => getSpecies(LAUNCH_CATALOG, d.speciesId).rarity === 'legendary')
          const reason = s.level < req.minLevel ? `Needs player level ${req.minLevel}`
            : id === 'dawnspire' && !legendary ? 'Own a legendary dragon first'
            : s.gold < req.cost ? 'Not enough gold' : ''
          return (
            <li key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{NAMES[id]}</span>
              <ActionButton id={`unlock-${id}`} disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'unlockIsland' })}>
                Unlock · {formatGold(req.cost)} gold
              </ActionButton>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

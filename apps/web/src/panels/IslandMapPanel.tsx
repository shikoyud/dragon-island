import { ISLAND_ORDER, LAUNCH_CATALOG, OUTER_ISLANDS, getSpecies, unlockPl, type IslandId } from '@wyrmhaven/game-core'
import type { GameArtSet } from '../art/types'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

const NAMES: Record<IslandId, string> = { home: 'Home island', isle2: 'Second island', isle3: 'Third island', isle4: 'Fourth island', isle5: 'Fifth island', dawnspire: 'Dawnspire' }

/** The island's map icon, or nothing until the art set has one. */
function MapIcon({ art, id }: { art?: GameArtSet | null; id: IslandId }) {
  const s = art?.map[id]
  if (!s?.src) return null
  return <img src={s.src} width={s.w} height={s.h} alt="" style={{ imageRendering: 'pixelated' }} />
}

/** Switch between unlocked islands and unlock the next one (in order, for gold). */
export function IslandMapPanel({ view, onView, onClose, art }: { view: IslandId; onView: (id: IslandId) => void; onClose?: () => void; art?: GameArtSet | null }) {
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  if (!s) return null
  const unlocked = new Set(s.islands.unlocked)
  const nextId = ISLAND_ORDER.find(id => !unlocked.has(id))
  const backdrop = art?.hud['map.backdrop']?.src
  return (
    <Panel title="Islands" onClose={onClose}>
      <div className="map-chart" data-testid="map-chart" style={backdrop ? { backgroundImage: `url("${backdrop}")` } : undefined}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {ISLAND_ORDER.map(id => {
          if (unlocked.has(id)) {
            return (
              <li key={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <MapIcon art={art} id={id} />
                <span>{NAMES[id]}</span>
                <button type="button" className={`btn ${view === id ? 'btn--primary' : ''}`} aria-label={`Go to ${NAMES[id]}`} aria-pressed={view === id} onClick={() => onView(id)}>Go</button>
              </li>
            )
          }
          const req = OUTER_ISLANDS[id as Exclude<IslandId, 'home'>]
          const gate = unlockPl(`island:${id as Exclude<IslandId, 'home'>}`)
          if (id !== nextId) return <li key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: 0.6 }}><MapIcon art={art} id={id} />{NAMES[id]} · <span>Locked · level {gate}</span></li>
          // Same order as game-core's unlockIsland: level, then legendary (Dawnspire), then gold.
          const legendary = s.dragons.some(d => getSpecies(LAUNCH_CATALOG, d.speciesId).rarity === 'legendary')
          const reason = s.level < gate ? `Needs player level ${gate}`
            : id === 'dawnspire' && !legendary ? 'Own a legendary dragon first'
            : s.gold < req.cost ? 'Not enough gold' : ''
          return (
            <li key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <MapIcon art={art} id={id} />
              <span>{NAMES[id]}</span>
              <ActionButton id={`unlock-${id}`} disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'unlockIsland' })}>
                Unlock · {formatGold(req.cost)} gold
              </ActionButton>
            </li>
          )
        })}
      </ul>
      </div>
    </Panel>
  )
}

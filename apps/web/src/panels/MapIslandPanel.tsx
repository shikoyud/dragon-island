import { bridgeError, ISLANDS, ISLAND_ORDER, unlockPl, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import type { GameArtSet } from '../art/types'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

type OuterIsland = Exclude<IslandId, 'home'>

/** The island's map icon, or nothing until the art set has one. */
function MapIcon({ art, id }: { art?: GameArtSet | null; id: IslandId }) {
  const s = art?.map[id]
  if (!s?.src) return null
  return <img src={s.src} width={s.w} height={s.h} alt="" style={{ imageRendering: 'pixelated' }} />
}

/** Why the Bridge can't be bought, in the handler's order (`buyBridge`); '' when it can. */
function bridgeRefusal(s: PlayerState, id: OuterIsland): string {
  switch (bridgeError(s, id)) {
    case 'PLOT_OWNED': return 'Already open'
    case 'ISLAND_LOCKED': return `Needs the Bridge to ${ISLANDS[ISLAND_ORDER[ISLAND_ORDER.indexOf(id) - 1]!].name}`
    case 'LEVEL_TOO_LOW': return `Needs player level ${unlockPl(`island:${id}`)}`
    default: return s.gold < ISLANDS[id].bridgeGold! ? 'Not enough gold' : ''
  }
}

/** The six islands as a plain list: go to an open one, or buy the next Bridge (§5.5). The Map scene replaces the list's looks in Task 8. */
export function MapIslandPanel({ view, onView, onClose, art }: { view: IslandId; onView: (id: IslandId) => void; onClose?: () => void; art?: GameArtSet | null }) {
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  if (!s) return null
  const backdrop = art?.hud['map.backdrop']?.src
  return (
    <Panel title="Islands" onClose={onClose}>
      <div className="map-chart" data-testid="map-chart" style={backdrop ? { backgroundImage: `url("${backdrop}")` } : undefined}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {ISLAND_ORDER.map(id => {
            if (id === 'home' || s.islands.unlocked.includes(id)) {
              return (
                <li key={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <MapIcon art={art} id={id} />
                  <span>{ISLANDS[id].name}</span>
                  <button type="button" className={`btn ${view === id ? 'btn--primary' : ''}`} aria-label={`Go to ${ISLANDS[id].name}`} aria-pressed={view === id} onClick={() => onView(id)}>Go</button>
                </li>
              )
            }
            const reason = bridgeRefusal(s, id)
            return (
              <li key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <MapIcon art={art} id={id} />
                <span>{ISLANDS[id].name}</span>
                <small>Level {unlockPl(`island:${id}`)}</small>
                <ActionButton id={`bridge-${id}`} disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'buyBridge', island: id })}>
                  Bridge · {formatGold(ISLANDS[id].bridgeGold!)} gold
                </ActionButton>
              </li>
            )
          })}
        </ul>
      </div>
    </Panel>
  )
}

import { bridgeError, ISLANDS, ISLAND_ORDER, ownedPlots, PLOTS_PER_SIDE, unlockPl, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
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
export function bridgeRefusal(s: PlayerState, id: OuterIsland): string {
  switch (bridgeError(s, id)) {
    case 'PLOT_OWNED': return 'Already open'
    case 'ISLAND_LOCKED': return `Needs the Bridge to ${ISLANDS[ISLAND_ORDER[ISLAND_ORDER.indexOf(id) - 1]!].name}`
    case 'LEVEL_TOO_LOW': return `Needs player level ${unlockPl(`island:${id}`)}`
    default: return s.gold < ISLANDS[id].bridgeGold! ? 'Not enough gold' : ''
  }
}

/** One island tapped on the Map (§5.5): go there when it's open, or buy its Bridge. Buying turns the panel to Go. */
export function MapIslandPanel({ island, view, onView, onClose, art }: { island: IslandId; view: IslandId; onView: (id: IslandId) => void; onClose?: () => void; art?: GameArtSet | null }) {
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  if (!s) return null
  const backdrop = art?.hud['map.backdrop']?.src
  const name = ISLANDS[island].name
  const reason = island === 'home' ? '' : bridgeRefusal(s, island)
  return (
    <Panel title={name} onClose={onClose}>
      <div className="map-chart map-island" data-testid="map-chart" style={backdrop ? { backgroundImage: `url("${backdrop}")` } : undefined}>
        <MapIcon art={art} id={island} />
        {island === 'home' || s.islands.unlocked.includes(island)
          ? <>
            <span>{ownedPlots(s, island).length} / {PLOTS_PER_SIDE * PLOTS_PER_SIDE} plots</span>
            <button type="button" className={`btn ${view === island ? 'btn--primary' : ''}`} aria-label={`Go to ${name}`} aria-pressed={view === island} onClick={() => onView(island)}>Go</button>
          </>
          : <>
            <small>Level {unlockPl(`island:${island}`)}</small>
            <ActionButton id={`bridge-${island}`} disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'buyBridge', island })}>
              Bridge · {formatGold(ISLANDS[island].bridgeGold!)} gold
            </ActionButton>
          </>}
      </div>
    </Panel>
  )
}

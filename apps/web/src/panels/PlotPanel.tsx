import { ISLAND_ORDER, ISLANDS, ownedPlots, plotError, plotPrice, plotsBought, unlockPl, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { ArtMark } from '../hud/ArtMark'
import { Icon } from '../hud/Icon'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold, formatWei } from '../ui/Money'
import { KitCard, ResourcePill } from '../ui/kit/pieces'
import { ActionButton, Panel } from '../ui/Panel'
import { bridgeRefusal } from './MapIslandPanel'

/** Why the plot can't be bought, in the handler's order (`buyPlot`); '' when it can. */
function refusal(s: PlayerState, island: IslandId, plot: number, price: number | null): string {
  switch (plotError(s, island, plot)) {
    case 'ISLAND_LOCKED': return 'Open this island first'
    case 'PLOT_NOT_ADJACENT': return 'It must touch land you own'
    case 'PLOT_NOT_OFFERED': return 'Not for sale yet'
    case 'MAX_PLOTS': return 'Every plot is bought'
    case 'LEVEL_TOO_LOW': return `Needs player level ${unlockPl(`home:${plotsBought(s, island)}`)}`
    default: return price !== null && s.gold < price ? 'Not enough gold' : ''
  }
}

type OuterIsland = Exclude<IslandId, 'home'>
/** The first island whose Bridge is not bought yet, or null when all are open. */
const nextIsland = (s: PlayerState): OuterIsland | null =>
  (ISLAND_ORDER.find(id => id !== 'home' && !s.islands.unlocked.includes(id)) as OuterIsland | undefined) ?? null

/**
 * Expand (design, Phase 5: locked-land-selected): three cards, the plot for gold, the plot for premium (plots are sold for
 * gold only, so it says Unavailable), and the next island's Bridge ("Unavailable" with the reason while gated); the
 * resources along the bottom. Once the plot is owned there is no sign, and nothing to show.
 */
export function PlotPanel({ island, plot, onClose }: { island: IslandId; plot: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const data = me.data
  const s = data?.state
  if (!s || ownedPlots(s, island).includes(plot)) return null
  const price = plotPrice(island, plotsBought(s, island))
  const reason = refusal(s, island, plot, price)
  const next = nextIsland(s)
  const bridgeWhy = next ? bridgeRefusal(s, next) : 'Every island is open'
  const buy = async () => {
    if (await run({ type: 'buyPlot', island, plot })) onClose?.()
  }
  return (
    <Panel title="Expand" onClose={onClose}>
      <p className="expand-where">{`${ISLANDS[island].name} plot`}</p>
      <div className="expand-cards">
        <KitCard title="More land" art={<ArtMark name="ui.expand.gold" size={72} />}
          footer={(
            <ActionButton id="buy-plot" disabled={pending || reason !== ''} reason={reason} onClick={() => void buy()}>
              Buy plot · {price === null ? 'none left' : `${formatGold(price)} gold`}
            </ActionButton>
          )}>
          <p className="expand-note">Clears a new square of land next to yours.</p>
        </KitCard>
        <KitCard title="Premium land" art={<ArtMark name="ui.expand.dris" size={72} />}
          footer={<ActionButton id="buy-plot-premium" disabled reason="Plots are sold for gold only">Unavailable</ActionButton>}>
          <p className="expand-note">Land for DRIS is not on sale.</p>
        </KitCard>
        <KitCard title={next ? `Open ${ISLANDS[next].name}` : 'Every island'} art={<ArtMark name="ui.expand.island" size={72} />}
          footer={next && bridgeWhy === '' ? (
            <ActionButton id={`expand-bridge-${next}`} disabled={pending} onClick={() => void run({ type: 'buyBridge', island: next }).then(ok => { if (ok) onClose?.() })}>
              Bridge · {formatGold(ISLANDS[next].bridgeGold!)} gold
            </ActionButton>
          ) : <ActionButton id="expand-bridge" disabled reason={bridgeWhy}>Unavailable</ActionButton>}>
          <p className="expand-note">A new island with its own land and dragons.</p>
        </KitCard>
      </div>
      <footer className="expand-foot" aria-label="Resources">
        <ResourcePill icon={<Icon name="gold" size={24} />} label="Gold" value={formatGold(s.gold)} />
        <ResourcePill icon={<Icon name="dris" size={24} />} label="DRIS" value={formatWei(BigInt(data?.balanceWei ?? 0), 18, 2)} />
      </footer>
    </Panel>
  )
}

import { ISLANDS, ownedPlots, plotError, plotPrice, plotsBought, unlockPl, type IslandId, type PlayerState } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

/** Why the plot can't be bought, in the handler's order (`buyPlot`); '' when it can. */
function refusal(s: PlayerState, island: IslandId, plot: number, price: number | null): string {
  switch (plotError(s, island, plot)) {
    case 'ISLAND_LOCKED': return 'Open this island first'
    case 'PLOT_NOT_ADJACENT': return 'It must touch land you own'
    case 'MAX_PLOTS': return 'Every plot is bought'
    case 'LEVEL_TOO_LOW': return `Needs player level ${unlockPl(`home:${plotsBought(s, island)}`)}`
    default: return price !== null && s.gold < price ? 'Not enough gold' : ''
  }
}

/** The sign on an unowned plot: buy it (§5.5). Once it is owned there is no sign, and nothing to show. */
export function PlotPanel({ island, plot, onClose }: { island: IslandId; plot: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  if (!s || ownedPlots(s, island).includes(plot)) return null
  const price = plotPrice(island, plotsBought(s, island))
  const reason = refusal(s, island, plot, price)
  const buy = async () => {
    if (await run({ type: 'buyPlot', island, plot })) onClose?.()
  }
  return (
    <Panel title={`${ISLANDS[island].name} plot`} onClose={onClose}>
      <ActionButton id="buy-plot" disabled={pending || reason !== ''} reason={reason} onClick={() => void buy()}>
        Buy plot · {price === null ? 'none left' : `${formatGold(price)} gold`}
      </ActionButton>
    </Panel>
  )
}

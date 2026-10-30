import { foodPerFeed, getSpecies, goldPerMinuteX20, LAUNCH_CATALOG, levelCap, SELL_GOLD } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatGold } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

export function DragonPanel({ dragonId, onClose }: { dragonId: string; onClose?: () => void }) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const s = me.data?.state
  const d = s?.dragons.find(x => x.id === dragonId)
  if (!s || !d) return null
  const species = getSpecies(LAUNCH_CATALOG, d.speciesId)
  const maxed = d.level >= levelCap(s.roostTier)
  const foodCost = maxed ? 0 : foodPerFeed(d.level)
  const sellGold = SELL_GOLD[species.rarity]
  const inTeam = s.defenceTeam?.includes(d.id) ?? false

  return (
    <Panel title={`${species.name} (${d.id})`} onClose={onClose}>
      <p>{species.rarity} · {species.elements.join(' / ')} · level {d.level} · {Math.floor(goldPerMinuteX20(species.elements[0]!, species.rarity, d.level, preset) / 20)} gold/min</p>
      <p>{d.habitatId ? `Lives in ${d.habitatId}` : 'Waiting in the hatchery (no habitat has room)'}{inTeam ? ' · defence team' : ''}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton
          id={`feed-${d.id}`}
          primary
          disabled={pending || maxed || s.food < foodCost}
          reason={maxed ? 'Upgrade your Roost to level up further' : 'Not enough food'}
          onClick={() => void run({ type: 'feed', dragonId: d.id })}
        >
          Feed{maxed ? '' : ` · ${formatGold(foodCost)} food`}
        </ActionButton>
        <ActionButton
          id={`sell-${d.id}`}
          danger
          disabled={pending || s.dragons.length <= 2 || sellGold === null}
          reason={sellGold === null ? 'Legendary dragons cannot be sold' : 'Keep at least two dragons so you can still breed'}
          onClick={() => void run({ type: 'sellDragon', dragonId: d.id })}
        >
          {sellGold === null ? 'Cannot be sold' : `Sell · ${formatGold(sellGold)} gold`}
        </ActionButton>
      </div>
    </Panel>
  )
}

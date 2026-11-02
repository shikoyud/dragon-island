import { useEffect } from 'react'
import { dragonLook } from '../game/islandModel'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { SpriteStill, useGameArt } from '../ui/GameArt'
import { PillButton } from '../ui/kit/buttons'
import { ElementRibbon, RarityShield } from '../ui/kit/pieces'
import { formatGold, formatPerMinuteX20 } from '../ui/Money'
import { ArtMark } from './ArtMark'
import { newDragonCard } from './newDragon'

/**
 * The New dragon screen after a hatch (design, Phase 5: new-dragon): a glow over the island, the dragon bottom left with
 * the "New" burst, and its card: XP, rarity, elements, skills, income a minute. Sell for N, or Place in Habitat (ruling
 * S8: the home finder when a habitat has room, else it is already home or waits in the Hatchery, and the screen closes).
 */
export function NewDragon({ dragonId, canPlace, onPlace, onClose }: {
  dragonId: string
  /** A habitat has room for it now (the home finder will open). */
  canPlace: boolean
  onPlace: () => void
  onClose: () => void
}) {
  const me = useMe()
  const preset = usePreset()
  const art = useGameArt()
  const { run, pending } = useAction()
  const s = me.data?.state
  const card = s ? newDragonCard(s, dragonId, preset) : null
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => { if (s && !card) onClose() }, [s, card, onClose])
  if (!card) return null
  const sellable = card.sellGold !== null && (s?.dragons.length ?? 0) > 2
  return (
    <div className="new-dragon" role="dialog" aria-modal="true" aria-label="New dragon">
      <span className="new-dragon__glow" aria-hidden="true"><ArtMark name="fx.glow" size={640} /></span>
      <div className="new-dragon__hero">
        <span className="new-dragon__burst" aria-hidden="true"><ArtMark name="fx.newBurst" size={120} /><b>New</b></span>
        <SpriteStill sprite={dragonLook(card.speciesId, 1, art).sprite} height={180} />
      </div>
      <section className="new-dragon__card" aria-label={card.name}>
        <h2 className="kit-plank">{card.name}</h2>
        <p className="new-dragon__xp" aria-label={`XP +${formatGold(card.xp)}`}><ArtMark name="ui.xpStar" size={24} /><span aria-hidden="true">{`+${formatGold(card.xp)}`}</span></p>
        <div className="new-dragon__marks">
          <RarityShield rarity={card.rarity} />
          {card.elements.map(e => <ElementRibbon key={e} element={e} />)}
        </div>
        <dl className="new-dragon__facts">
          <div><dt>Skills</dt><dd>{card.skills.join(', ')}</dd></div>
          <div><dt>Income</dt><dd>{`${formatPerMinuteX20(card.incomeX20)} gold/min`}</dd></div>
        </dl>
        <div className="new-dragon__buttons">
          {card.sellGold !== null && (
            <PillButton id="new-dragon-sell" color="red" disabled={pending || !sellable} reason={sellable ? undefined : 'Keep at least two dragons'}
              onClick={() => void run({ type: 'sellDragon', dragonId: card.dragonId }).then(ok => { if (ok) onClose() })}>
              {`Sell for ${formatGold(card.sellGold)}`}
            </PillButton>
          )}
          <PillButton id="new-dragon-place" color="yellow" onClick={() => (canPlace ? onPlace() : onClose())}>
            {canPlace ? 'Place in Habitat' : card.habitatId ? 'Done' : 'Keep in Hatchery'}
          </PillButton>
        </div>
      </section>
    </div>
  )
}

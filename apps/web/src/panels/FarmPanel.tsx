import { CROPS, cropFood, cropGrowMs, cropUnlocked, HARVEST_XP_PER_TIER, isUnfinished, priceMicroUsd, unlockPl, type CropId } from '@wyrmhaven/game-core'
import { useHudSprite } from '../hud/ArtMark'
import { SpriteStill, useGameArt } from '../ui/GameArt'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatDuration, formatGold, formatSkipPrice } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { isReady, Timer } from '../ui/Timer'
import { SpeedUpButton } from './SpeedUpButton'

/** Crops in tier order (the order of the CROPS table). */
const CROP_IDS = Object.keys(CROPS) as CropId[]

/** One farm: an empty plot is a parchment board of crop cards (design, Phase 5: grow-food-choosen); a planted one shows the growing timer, then Harvest when ripe. */
export function FarmPanel({ index, nowMs, onClose }: { index: number; nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const preset = usePreset()
  const art = useGameArt()
  const board = useHudSprite('bg.parchment')
  const { run, pending } = useAction()
  const s = me.data?.state
  const plot = s?.farms[index]
  if (!s || !plot) return null

  const building = isUnfinished(s, { type: 'farm', index })
  const skip = priceMicroUsd({ kind: 'skip', target: 'farm', index }, s, nowMs)
  const ripe = plot.crop !== null && isReady(plot.readyAtMs, nowMs)

  return (
    <Panel title="Farm" onClose={onClose}>
      {plot.crop ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{CROPS[plot.crop].name} · {ripe ? 'ripe' : <Timer readyAtMs={plot.readyAtMs} nowMs={nowMs} />}</span>
          {ripe ? (
            <ActionButton id={`harvest-${index}`} primary disabled={pending} onClick={() => void run({ type: 'harvest', plot: index })}>
              Harvest · {formatGold(cropFood(plot.crop, plot.level, preset))} food
            </ActionButton>
          ) : (
            <>
              <SpeedUpButton id={`speedup-farm-${index}`} target="farm" index={index} readyAtMs={plot.readyAtMs} nowMs={nowMs} />
              {skip !== null && (
                <ActionButton id={`skip-farm-${index}`} disabled={pending} onClick={() => void run({ type: 'buy', item: { kind: 'skip', target: 'farm', index } })}>
                  Skip · {formatSkipPrice(skip)}
                </ActionButton>
              )}
            </>
          )}
        </div>
      ) : (
        <ul aria-label="Crops" className="farm-board" style={board ? { backgroundImage: `url("${board.src}")` } : undefined}>
          {CROP_IDS.map(crop => {
            const info = CROPS[crop]
            const locked = !cropUnlocked(crop, s.level)
            const reason = building ? 'Still being built' : locked ? `Level ${unlockPl(`crop:${crop}`)}` : s.gold < info.gold ? 'Not enough gold' : ''
            return (
              <li key={crop} className={`farm-card${locked ? ' farm-card--locked' : ''}`}>
                <h3 className="farm-card__name">{info.name}</h3>
                <div className="farm-card__body">
                  <SpriteStill sprite={art.building.cropStage[crop]} height={48} dim={locked} />
                  <dl className="farm-card__facts">
                    <div><dt>Food</dt><dd>{formatGold(cropFood(crop, plot.level, preset))}</dd></div>
                    <div><dt>XP</dt><dd>{formatGold(info.tier * HARVEST_XP_PER_TIER * preset.xpMult)}</dd></div>
                    <div><dt>Ready in</dt><dd>{formatDuration(cropGrowMs(crop, preset))}</dd></div>
                  </dl>
                </div>
                <ActionButton id={`plant-${index}-${crop}`} disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'plant', plot: index, crop })}
                  ariaLabel={`${info.name} · ${formatDuration(cropGrowMs(crop, preset))} · ${formatGold(info.gold)} gold → ${formatGold(cropFood(crop, plot.level, preset))} food`}>
                  {`${formatGold(info.gold)} gold`}
                </ActionButton>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

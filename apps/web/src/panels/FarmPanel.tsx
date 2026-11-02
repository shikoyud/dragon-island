import { CROPS, cropFood, cropGrowMs, cropUnlocked, isUnfinished, priceMicroUsd, unlockPl, type CropId } from '@wyrmhaven/game-core'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatDuration, formatGold, formatSkipPrice } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { isReady, Timer } from '../ui/Timer'
import { SpeedUpButton } from './SpeedUpButton'

/** Crops in tier order (the order of the CROPS table). */
const CROP_IDS = Object.keys(CROPS) as CropId[]

/** One farm: an empty plot lists the crops to plant; a planted one shows the growing timer, then Harvest when ripe. */
export function FarmPanel({ index, nowMs, onClose }: { index: number; nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const preset = usePreset()
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
        <ul aria-label="Crops" className="crop-list" style={{ listStyle: 'none', padding: 0, margin: '0 0 6px', display: 'grid', gap: 6 }}>
          {CROP_IDS.map(crop => {
            const info = CROPS[crop]
            const locked = !cropUnlocked(crop, s.level)
            const reason = building ? 'Still being built' : locked ? `Level ${unlockPl(`crop:${crop}`)}` : s.gold < info.gold ? 'Not enough gold' : ''
            return (
              <li key={crop}>
                <ActionButton id={`plant-${index}-${crop}`} disabled={pending || reason !== ''} reason={reason} onClick={() => void run({ type: 'plant', plot: index, crop })}>
                  {`${info.name} · ${formatDuration(cropGrowMs(crop, preset))} · ${formatGold(info.gold)} gold → ${formatGold(cropFood(crop, plot.level, preset))} food`}
                </ActionButton>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

import { CROPS, cropFood, cropGrowMs, cropUnlocked, isUnfinished, priceMicroUsd, type CropId } from '@wyrmhaven/game-core'
import { useState } from 'react'
import { useAction } from '../state/actions'
import { useMe, usePreset } from '../state/me'
import { formatGold, formatMicroUsd } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { isReady, Timer } from '../ui/Timer'
import { timerLabel } from '../game/islandModel'
import { UpgradeSection } from './UpgradeSection'

const CROP_IDS = Object.keys(CROPS) as CropId[]

export function FarmPanel({ nowMs, onClose }: { nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const [choice, setChoice] = useState<Record<number, CropId>>({})
  const s = me.data?.state
  if (!s) return null

  return (
    <Panel title="Farm" onClose={onClose}>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {s.farms.map((plot, i) => {
          const crop = choice[i] ?? 'dragonBush'
          const info = CROPS[crop]
          const building = isUnfinished(s, { type: 'farm', index: i })
          const skip = priceMicroUsd({ kind: 'skip', target: 'farm', index: i }, s, nowMs)
          return (
            <li key={i} style={{ marginBottom: 6 }}>
             <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Plot {i + 1}:</span>
              {plot.crop ? (
                <>
                  <span>{plot.crop} · <Timer readyAtMs={plot.readyAtMs} nowMs={nowMs} /></span>
                  <ActionButton id={`harvest-${i}`} primary disabled={pending || !isReady(plot.readyAtMs, nowMs)} reason="Still growing" onClick={() => void run({ type: 'harvest', plot: i })}>
                    Harvest · {formatGold(cropFood(plot.crop, plot.level, preset))} food
                  </ActionButton>
                  {skip !== null && (
                    <ActionButton id={`skip-farm-${i}`} disabled={pending} onClick={() => void run({ type: 'buy', item: { kind: 'skip', target: 'farm', index: i } })}>
                      Skip · {formatMicroUsd(skip)}
                    </ActionButton>
                  )}
                </>
              ) : (
                <>
                  <label>
                    Crop{' '}
                    <select value={crop} onChange={e => setChoice({ ...choice, [i]: e.target.value as CropId })}>
                      {CROP_IDS.map(c => (
                        <option key={c} value={c}>{CROPS[c].name} · {formatGold(CROPS[c].gold)}g → {formatGold(cropFood(c, plot.level, preset))} food · {timerLabel(cropGrowMs(c, preset), 0)}</option>
                      ))}
                    </select>
                  </label>
                  <ActionButton id={`plant-${i}`} primary disabled={pending || building || s.gold < info.gold || !cropUnlocked(crop, s.level)} reason={building ? 'Still being built' : !cropUnlocked(crop, s.level) ? `Level ${info.unlockPl}` : 'Not enough gold'} onClick={() => void run({ type: 'plant', plot: i, crop })}>
                    Plant
                  </ActionButton>
                </>
              )}
             </div>
             <UpgradeSection building={{ type: 'farm', index: i }} nowMs={nowMs} />
            </li>
          )
        })}
      </ul>
      <p><small>New plots come from the Build shop.</small></p>
    </Panel>
  )
}

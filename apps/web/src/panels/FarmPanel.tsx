import { CROPS, MAX_PLOTS, plotCost, priceMicroUsd, type CropId } from '@wyrmhaven/game-core'
import { useState } from 'react'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold, formatMicroUsd } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { isReady, Timer } from '../ui/Timer'
import { timerLabel } from '../game/islandModel'

const CROP_IDS = Object.keys(CROPS) as CropId[]

export function FarmPanel({ nowMs, onClose }: { nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const [choice, setChoice] = useState<Record<number, CropId>>({})
  const s = me.data?.state
  if (!s) return null
  const nextPlotCost = plotCost(s.farms.length)

  return (
    <Panel title="Farm" onClose={onClose}>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {s.farms.map((plot, i) => {
          const crop = choice[i] ?? 'sprout'
          const info = CROPS[crop]
          const skip = priceMicroUsd({ kind: 'skip', target: 'farm', index: i }, s, nowMs)
          return (
            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span>Plot {i + 1}:</span>
              {plot.crop ? (
                <>
                  <span>{plot.crop} · <Timer readyAtMs={plot.readyAtMs} nowMs={nowMs} /></span>
                  <ActionButton id={`harvest-${i}`} primary disabled={pending || !isReady(plot.readyAtMs, nowMs)} reason="Still growing" onClick={() => void run({ type: 'harvest', plot: i })}>
                    Harvest · {formatGold(CROPS[plot.crop].food)} food
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
                        <option key={c} value={c}>{c} · {formatGold(CROPS[c].cost)}g → {formatGold(CROPS[c].food)} food · {timerLabel(CROPS[c].growMs, 0)}</option>
                      ))}
                    </select>
                  </label>
                  <ActionButton id={`plant-${i}`} primary disabled={pending || s.gold < info.cost} reason="Not enough gold" onClick={() => void run({ type: 'plant', plot: i, crop })}>
                    Plant
                  </ActionButton>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <ActionButton
        id="buy-plot"
        disabled={pending || s.farms.length >= MAX_PLOTS || s.gold < nextPlotCost}
        reason={s.farms.length >= MAX_PLOTS ? 'Maximum plots reached' : 'Not enough gold'}
        onClick={() => void run({ type: 'buyFarmPlot' })}
      >
        Buy plot · {formatGold(nextPlotCost)} gold
      </ActionButton>
    </Panel>
  )
}

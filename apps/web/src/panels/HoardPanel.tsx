import { HOARD, HOARD_MIN_PLAYER_LEVEL, MICRO_USD_PER_GOLD, priceMicroUsd, remainingSellMicroUsd } from '@wyrmhaven/game-core'
import { useState } from 'react'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold, formatMicroUsd } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

/** Gold sell-back (spec §14): needs the entry fee paid and a Hoard; limit and remaining from game-core. */
export function HoardPanel({ nowMs, onClose }: { nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const { run, pending } = useAction()
  const [input, setInput] = useState('')
  const s = me.data?.state
  if (!me.data || !s) return null
  const unlocked = me.data.earningUnlocked
  const gold = /^\d+$/.test(input) ? Number(input) : 0
  const value = gold * MICRO_USD_PER_GOLD
  const remaining = remainingSellMicroUsd({ ...s, earningUnlocked: unlocked }, nowMs)
  const hoardPrice = priceMicroUsd({ kind: 'hoard' }, s, nowMs)
  const reason = !unlocked ? 'Pay the one-time entry fee to unlock earning' : s.hoardLevel === 0 ? 'Build the Hoard first' : gold <= 0 ? 'Enter an amount of gold' : gold > s.eligibleGold ? 'Only gold from habitats and battles can be sold' : value > remaining ? 'Above today’s sell limit' : undefined

  return (
    <Panel title="Hoard" onClose={onClose}>
      {!unlocked && <p>Pay the one-time entry fee (Wallet panel) to unlock earning.</p>}
      <p>Hoard level {s.hoardLevel}{s.hoardLevel > 0 ? ` · daily limit ${formatMicroUsd(HOARD[s.hoardLevel - 1]!.limitMicroUsd)}` : ''}</p>
      {s.hoardLevel > 0 && <p>{formatMicroUsd(remaining)} left today</p>}
      <p>Eligible gold: {formatGold(s.eligibleGold)} of {formatGold(s.gold)} · rate 10,000 gold = $0.05</p>
      <label>Gold to sell <input value={input} onChange={e => setInput(e.target.value)} inputMode="numeric" placeholder="0" /></label>
      {gold > 0 && <span> = {formatMicroUsd(value)}</span>}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton id="sell-gold" primary disabled={pending || Boolean(reason)} reason={reason} onClick={() => void run({ type: 'sellGold', gold })}>
          Sell gold
        </ActionButton>
        <ActionButton
          id="buy-hoard"
          disabled={pending || hoardPrice === null || s.level < HOARD_MIN_PLAYER_LEVEL}
          reason={s.level < HOARD_MIN_PLAYER_LEVEL ? `Needs player level ${HOARD_MIN_PLAYER_LEVEL}` : 'Hoard is at its maximum level'}
          onClick={() => void run({ type: 'buy', item: { kind: 'hoard' } })}
        >
          {s.hoardLevel === 0 ? 'Build Hoard' : 'Upgrade Hoard'}{hoardPrice !== null ? ` · ${formatMicroUsd(hoardPrice)}` : ''}
        </ActionButton>
      </div>
    </Panel>
  )
}

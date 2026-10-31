import { BOSS_NODE, THREE_STAR_TURNS, TRIAL_CHAPTERS, type BattleState, type Fighter, type PlayerMove, type Side } from '@wyrmhaven/game-core'
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Bridge } from '../game/bridge'
import { battleLine, battleView, pipState, turnLabel, type BattleView } from '../game/battleModel'
import { BATTLE_CONTROLS_H, battleStage } from '../game/layout'
import { Icon } from '../hud/Icon'
import { moveCard, pvpForfeitCost, TRIAL_ABANDON_COST, useBattlePlayback, type BattleHook } from '../state/battle'
import { formatGold } from '../ui/Money'
import { AbandonConfirm } from './AbandonConfirm'
import { BattleResult } from './BattleResult'

/** The stage's place on screen, shared with the scene's camera through `battleStage`. */
function useStageBox() {
  const read = () => battleStage(window.innerWidth, window.innerHeight)
  const [box, setBox] = useState(read)
  useEffect(() => {
    const onResize = () => setBox(read())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return box
}

const hpText = (hp: number, max: number): string => `${formatGold(hp)} / ${formatGold(max)}`

function Plate({ label, state, side, view, boss }: { label: 'Enemy' | 'Yours'; state: BattleState; side: Side; view: BattleView; boss: boolean }) {
  const { team } = state.sides[side]
  const active = view.active[side]
  const f = team[active]!
  const hp = view.hp[side][active]!
  const pct = Math.ceil((hp * 100) / f.stats.hp)
  return (
    <div role="group" aria-label={label} className={`battle__plate battle__plate--${side}`}>
      <div className="battle__plate-head">
        <Icon name={f.species.elements[0]!} size={16} />
        <span className="battle__name">{f.species.name}</span>
        <span className="battle__level">L{f.spec.level}</span>
        {boss && <span className="battle__boss">Boss</span>}
      </div>
      <div className="battle__hp" role="progressbar" aria-label="HP" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className={`battle__hp-fill${pct <= 25 ? ' battle__hp-fill--low' : ''}`} style={{ transform: `scaleX(${hp / f.stats.hp})` }} />
      </div>
      <div className="battle__plate-foot">
        <span className="battle__hp-text">{hpText(hp, f.stats.hp)}</span>
        <span className="battle__pips">
          {team.map((b, slot) => {
            if (slot === active) return null
            const pip = pipState(view.hp[side][slot]!, b.stats.hp)
            return <span key={slot} className={`battle__pip battle__pip--${pip}`} role="img" aria-label={`${b.species.name}: ${pip === 'ko' ? 'KO' : pip}`} />
          })}
        </span>
      </div>
    </div>
  )
}

function Moves({ state, disabled, onMove, onSwap, canSwap }: { state: BattleState; disabled: boolean; onMove: (m: PlayerMove) => void; onSwap: () => void; canSwap: boolean }) {
  const actor = state.sides.attacker.team[state.sides.attacker.active]!
  return (
    <>
      <div role="group" aria-label="Move" className="battle__moves">
        {actor.moves.map((_, slot) => {
          const card = moveCard(state, slot)
          return (
            <button key={slot} type="button" className={`btn battle__move battle__move--${card.hint === 'IMMUNE' ? 'immune' : card.hint === '2x' ? 'super' : card.hint === '0.5x' ? 'weak' : 'even'}`}
              disabled={disabled || card.disabledReason !== null} onClick={() => onMove({ kind: 'attack', move: slot })}>
              <span className="battle__move-name">
                <Icon name={card.element === 'physical' ? 'battle' : card.element} size={16} />
                <span>{card.name}</span>
              </span>
              <span className="battle__move-hint">
                {card.disabledReason ?? <>{card.tier === 'physical' ? 'Physical' : `Tier ${card.tier}`} · <b>{card.hint}</b></>}
              </span>
            </button>
          )
        })}
      </div>
      <button type="button" className="btn battle__tap battle__swap" disabled={disabled || !canSwap} onClick={onSwap}>Swap</button>
    </>
  )
}

/** The bench: Swap's list, with a way back; a KO's list, with none (§6.1: the owner chooses who enters). */
function Bench({ state, mode, onPick, onBack }: { state: BattleState; mode: 'swap' | 'replace'; onPick: (m: PlayerMove) => void; onBack?: () => void }) {
  const { team, active } = state.sides.attacker
  const bench: { f: Fighter; to: number }[] = team.flatMap((f, to) => (to === active ? [] : [{ f, to }]))
  return (
    <div role="group" aria-label={mode === 'swap' ? 'Swap' : 'Replacement'} className="battle__bench">
      <div className="battle__bench-head">
        <span>{mode === 'swap' ? 'Swap to' : 'Send in your next dragon'}</span>
        {onBack && <button type="button" className="btn btn--ghost battle__tap" onClick={onBack}>Back</button>}
      </div>
      {bench.map(({ f, to }) => (
        <button key={to} type="button" className="btn battle__tap battle__bench-row" disabled={f.hp <= 0} onClick={() => onPick({ kind: mode, to })}>
          <Icon name={f.species.elements[0]!} size={16} />
          <span className="battle__name">{f.species.name}</span>
          <span className="battle__level">L{f.spec.level}</span>
          <span className="battle__hp-text">{f.hp <= 0 ? 'KO' : hpText(f.hp, f.stats.hp)}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * The portrait battle screen (R80): React's plates over the scene's stage, the controls under it, the same column on any
 * screen. The truth is `battlePreview`, recomputed from the moves; what shows is `battleView` at the event being played, so
 * neither HP nor the buttons can spoil a hit. Memoised, and a clock tick changes none of its props: battles have no clock.
 */
export const BattlePanel = memo(function BattlePanel({ battle, bridge, onClose }: { battle: BattleHook; bridge: Bridge; onClose: () => void }) {
  const { shown, busy, sendFailed, retry } = useBattlePlayback(battle, bridge)
  const box = useStageBox()
  const [sheet, setSheet] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const { preview, setup, result } = battle
  // During playback the buttons stay on the state the player chose from: the future isn't theirs to read yet.
  const settled = useRef<BattleState | null>(null)
  if (preview && (!busy || !settled.current)) settled.current = preview.state
  const over = Boolean(preview?.done)

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    setSheet(open => {
      if (!open) setConfirm(true)
      return false
    })
  }, [])
  useEffect(() => {
    if (over || result) return
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [over, result, onKey])
  const cancelConfirm = useCallback(() => setConfirm(false), [])

  if (!preview || !setup) return null
  const state = preview.state
  const view = battleView(state, shown)
  const trial = setup.mode === 'pve' ? setup.trial : null
  const title = trial
    ? `${TRIAL_CHAPTERS[trial.chapter - 1]!.theme} · Node ${trial.node}${trial.node === BOSS_NODE ? ' · Boss' : ''}`
    : 'Arena'
  // A Boss node's slot 0 is the Boss.
  const bossUp = trial?.node === BOSS_NODE && view.active.defender === 0
  const line = view.last ? battleLine(state, view.last) : ''
  const shownState = settled.current ?? state
  const replacing = !busy && !preview.done && state.awaiting === 'replace'
  const canSwap = shownState.sides.attacker.team.some((f, i) => f.hp > 0 && i !== shownState.sides.attacker.active)

  const choose = (m: PlayerMove) => {
    if (busy) return
    setSheet(false)
    battle.choose(m)
  }
  const abandon = () => {
    void battle.abandon().then(ok => {
      setConfirm(false)
      if (ok && trial) onClose()
    })
  }

  const stageStyle: CSSProperties = { left: Math.max(0, box.x), top: box.y, width: Math.min(box.w, window.innerWidth), height: box.h }
  const controlsStyle: CSSProperties = result ? {} : { height: BATTLE_CONTROLS_H }

  return (
    <section className="battle" aria-label="Battle">
      <div className="battle__stage" style={stageStyle}>
        <header className="battle__head">
          <h2 className="battle__title">{title}</h2>
          {!over && !result && <button type="button" className="btn btn--ghost battle__tap battle__exit" aria-label="Exit battle" onClick={() => setConfirm(true)}>Exit</button>}
        </header>
        <Plate label="Enemy" state={state} side="defender" view={view} boss={bossUp} />
        <Plate label="Yours" state={state} side="attacker" view={view} boss={false} />
        <p className="battle__line" role="status" aria-label="Last move">{line}</p>
      </div>

      <div className={`battle__controls${result ? ' battle__controls--result' : ''}`} style={{ ...controlsStyle, width: `min(100%, ${Math.min(box.w, 480)}px)` }}>
        <p className="battle__turn">
          <span>{turnLabel(view.turn, over && !busy)}</span>
          {trial && <span className="battle__goal">3★: {THREE_STAR_TURNS} turns, no KOs</span>}
        </p>
        {result ? (
          <div className="battle__result">
            <BattleResult result={result} />
            <button type="button" className="btn btn--primary battle__tap" autoFocus onClick={onClose}>Continue</button>
          </div>
        ) : preview.done && !preview.done.ok ? (
          <p role="alert">This battle can't go on. Exit to abandon it.</p>
        ) : over && !busy ? (
          sendFailed
            ? <div className="battle__sending"><p>The result didn't reach the server.</p><button type="button" className="btn btn--primary battle__tap" disabled={battle.pending} onClick={retry}>Try again</button></div>
            : <p className="battle__sending">Saving the result</p>
        ) : replacing ? (
          <Bench state={state} mode="replace" onPick={choose} />
        ) : sheet && !busy ? (
          <Bench state={state} mode="swap" onPick={choose} onBack={() => setSheet(false)} />
        ) : (
          <Moves state={shownState} disabled={busy || battle.pending} onMove={choose} onSwap={() => setSheet(true)} canSwap={canSwap} />
        )}
      </div>

      {confirm && <AbandonConfirm cost={trial ? TRIAL_ABANDON_COST : pvpForfeitCost(battle.trophies)} pending={battle.pending} onConfirm={abandon} onCancel={cancelConfirm} />}
    </section>
  )
})

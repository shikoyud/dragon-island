import { BOSS_NODE, THREE_STAR_TURNS, TRIAL_CHAPTERS, type BattleState, type Fighter, type PlayerMove, type Side } from '@wyrmhaven/game-core'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { messageFor } from '../api/errors'
import type { Bridge } from '../game/bridge'
import { battleLine, battleView, INPUT_GUARD_MS, pipState, turnLabel, type BattleView } from '../game/battleModel'
import { dragonLook } from '../game/islandModel'
import { ArtMark } from '../hud/ArtMark'
import { Icon } from '../hud/Icon'
import { isFinalRefusal, moveCard, pvpForfeitCost, TRIAL_ABANDON_COST, useBattlePlayback, type BattleHook } from '../state/battle'
import { SpriteStill, useGameArt } from '../ui/GameArt'
import { formatGold } from '../ui/Money'
import { AbandonConfirm } from './AbandonConfirm'
import { BattleResult } from './BattleResult'

/** A send with no answer after this long offers Leave as well: a fetch can hang for minutes on a bad network. */
export const SEND_PATIENCE_MS = 5_000

const hpText = (hp: number, max: number): string => `${formatGold(hp)} / ${formatGold(max)}`

/** The active dragon's corner plate (R98): portrait, name, level, HP bar and numbers; the Boss badge over it. */
function Plate({ label, state, side, view, boss }: { label: 'Enemy' | 'Yours'; state: BattleState; side: Side; view: BattleView; boss: boolean }) {
  const art = useGameArt()
  const { team } = state.sides[side]
  const active = view.active[side]
  const f = team[active]!
  const hp = view.hp[side][active]!
  const pct = Math.ceil((hp * 100) / f.stats.hp)
  return (
    <div role="group" aria-label={label} className={`battle__plate battle__plate--${side}`}>
      <span className="battle__portrait"><SpriteStill sprite={dragonLook(f.spec.speciesId, f.spec.level, art).sprite} height={48} /><span className="battle__portrait-level">{f.spec.level}</span></span>
      <div className="battle__plate-body">
        {boss && <div className="battle__plate-boss"><span className="battle__boss"><ArtMark name="battle.boss.marker" size={16} className="battle__crown" />Boss</span></div>}
        <div className="battle__plate-head">
          <Icon name={f.species.elements[0]!} size={16} />
          <span className="battle__name">{f.species.name}</span>
          <span className="battle__level">L{f.spec.level}</span>
        </div>
        <div className="battle__hp" role="progressbar" aria-label="HP" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span className={`battle__hp-fill${pct <= 25 ? ' battle__hp-fill--low' : ''}`} style={{ transform: `scaleX(${hp / f.stats.hp})` }} />
          <span className="battle__hp-text">{hpText(hp, f.stats.hp)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * A side's bench down its screen edge (R101): every dragon not fighting, with its level and HP. Yours are buttons that swap
 * (or, after a KO, send in) that dragon; the enemy's are pictures.
 */
function BenchColumn({ state, side, view, pick }: { state: BattleState; side: Side; view: BattleView; pick: ((to: number) => void) | null }) {
  const art = useGameArt()
  const { team } = state.sides[side]
  const active = view.active[side]
  const mine = side === 'attacker'
  return (
    <div role="group" aria-label={mine ? 'Your bench' : 'Enemy bench'} className={`battle__side battle__side--${side}`}>
      {team.map((f, slot) => {
        if (slot === active) return null
        const hp = view.hp[side][slot]!
        const pip = pipState(hp, f.stats.hp)
        const body = (
          <>
            <SpriteStill sprite={dragonLook(f.spec.speciesId, f.spec.level, art).sprite} height={40} dim={pip === 'ko'} />
            <span className="battle__portrait-level">{f.spec.level}</span>
            <span className="battle__side-hp"><span className={`battle__hp-fill${pip === 'ko' ? ' battle__hp-fill--low' : ''}`} style={{ transform: `scaleX(${Math.max(0, hp) / f.stats.hp})` }} /></span>
          </>
        )
        return mine
          ? <button key={slot} type="button" className={`btn battle__tap battle__bench-card battle__bench-card--${pip}`} aria-label={`Swap to ${f.species.name}`} title={`${f.species.name} · ${pip === 'ko' ? 'KO' : hpText(hp, f.stats.hp)}`} disabled={!pick || hp <= 0} onClick={() => pick?.(slot)}>{body}</button>
          : <span key={slot} role="img" className={`battle__bench-card battle__bench-card--${pip}`} aria-label={`${f.species.name}: ${pip === 'ko' ? 'KO' : pip}`}>{body}</span>
      })}
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
                {card.disabledReason ?? <>{card.tier === 'physical' ? 'Physical' : <><ArtMark name={`ui.tier.${card.tier}`} size={12} className="battle__tier" />{`Tier ${card.tier}`}</>} · <b>{card.hint}</b></>}
              </span>
            </button>
          )
        })}
      </div>
      <button type="button" className="btn battle__tap battle__swap" disabled={disabled || !canSwap} onClick={onSwap}><Icon name="move" size={16} />Swap Dragon</button>
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

/** The one thing left to do on a screen that can't go on: go back. A Trial still active is on the Trials banner. */
function LeaveButton({ onLeave }: { onLeave: () => void }) {
  return <button type="button" className="btn battle__tap" onClick={onLeave}>Leave</button>
}

/**
 * The landscape battle screen (R98, over R80): React's HUD over the whole viewport, the scene's stage under it. Plates with
 * portraits in the top corners, VS and the turn between them, both benches down the sides (R101), the moves along the bottom. The truth is `battlePreview`, recomputed from the moves; what shows is `battleView` at the event being played, so
 * neither HP nor the buttons can spoil a hit. Memoised, and a clock tick changes none of its props: battles have no clock.
 * The HUD is gone during a battle, so every state here has its own way out: Exit while it can be fought, Continue after a
 * result, Leave when the server refused, can't be reached, or there's no battle to draw.
 */
export const BattlePanel = memo(function BattlePanel({ battle, bridge, onClose }: { battle: BattleHook; bridge: Bridge; onClose: () => void }) {
  const { shown, busy, sendFailed, retry } = useBattlePlayback(battle, bridge)
  const [sheet, setSheet] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [exitFailed, setExitFailed] = useState(false)
  const { preview, setup, result } = battle
  // During playback the buttons stay on the state the player chose from: the future isn't theirs to read yet.
  const [settled, setSettled] = useState(preview?.state ?? null)
  if (preview && !busy && settled !== preview.state) setSettled(preview.state)
  const lastInput = useRef(-Infinity)
  const illegal = preview?.done?.ok === false
  const over = Boolean(preview?.done)
  // Exit is for a fight that can still be given up: not one that's decided, unless its list was illegal and it can't be sent.
  const canExit = Boolean(preview) && !result && (!over || illegal)

  const [slowSend, setSlowSend] = useState(false)
  const saving = over && !illegal && !busy && !result && !sendFailed
  useEffect(() => {
    setSlowSend(false)
    if (!saving) return
    const t = setTimeout(() => setSlowSend(true), SEND_PATIENCE_MS)
    return () => clearTimeout(t)
  }, [saving])

  useEffect(() => {
    if (!canExit) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (sheet) setSheet(false)
      else setConfirm(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canExit, sheet])
  const cancelConfirm = useCallback(() => setConfirm(false), [])

  if (!setup) return null
  if (!preview) {
    return (
      <section className="battle" aria-label="Battle">
        <div className="battle__controls battle__sending">
          <p role="alert">This battle can't go on: your team has changed.</p>
          <LeaveButton onLeave={onClose} />
        </div>
      </section>
    )
  }
  const state = preview.state
  const view = battleView(state, shown)
  const trial = setup.mode === 'pve' ? setup.trial : null
  const title = trial
    ? `${TRIAL_CHAPTERS[trial.chapter - 1]!.theme} · Node ${trial.node}${trial.node === BOSS_NODE ? ' · Boss' : ''}`
    : 'Arena'
  // A Boss node's slot 0 is the Boss.
  const bossUp = trial?.node === BOSS_NODE && view.active.defender === 0
  const line = view.last ? battleLine(state, view.last) : ''
  const shownState = settled ?? state
  const replacing = !busy && !preview.done && state.awaiting === 'replace'
  const canSwap = shownState.sides.attacker.team.some((f, i) => f.hp > 0 && i !== shownState.sides.attacker.active)

  const tooSoon = () => performance.now() - lastInput.current < INPUT_GUARD_MS
  const choose = (m: PlayerMove) => {
    if (busy || tooSoon()) return
    lastInput.current = performance.now()
    setSheet(false)
    battle.choose(m)
  }
  const openSheet = () => {
    lastInput.current = performance.now()
    setSheet(true)
  }
  const abandon = () => {
    setExitFailed(false)
    void battle.abandon().then(outcome => {
      setConfirm(false)
      if (outcome === 'failed') setExitFailed(true)
      // A forfeit's result shows here; a Trial's has no battle to report, and a refusal has nothing to show.
      else if (outcome === 'gone' || trial) onClose()
    })
  }

  // A bench tap is the Swap list's pick (R101): a swap on your turn, the replacement after a KO; never mid-playback or once decided.
  const benchPick = busy || battle.pending || result || over
    ? null
    : replacing ? (to: number) => choose({ kind: 'replace', to }) : canSwap ? (to: number) => choose({ kind: 'swap', to }) : null

  return (
    <section className="battle battle--wide" aria-label="Battle">
      <header className="battle__top">
        <Plate label="Yours" state={state} side="attacker" view={view} boss={false} />
        {/* VS and the turn between the plates (R98, combat.png's layout). */}
        <div className="battle__mid">
          <span className="battle__vs" aria-hidden="true"><ArtMark name="ui.battle.vs" size={48} /></span>
          <span className="battle__vs-turn">{turnLabel(view.turn, over && !busy).split(' / ')[0]}</span>
          <h2 className="battle__title">{title}</h2>
        </div>
        <Plate label="Enemy" state={state} side="defender" view={view} boss={bossUp} />
        <span className="battle__head-actions">
          {canExit && exitFailed && <LeaveButton onLeave={onClose} />}
          {canExit && <button type="button" className="btn btn--ghost battle__tap battle__exit" aria-label="Exit battle" onClick={() => setConfirm(true)}>✕</button>}
        </span>
      </header>
      <BenchColumn state={state} side="attacker" view={view} pick={benchPick} />
      <BenchColumn state={state} side="defender" view={view} pick={null} />
      <p className="battle__line" role="status" aria-label="Last move">{line}</p>

      <div className={`battle__controls${result ? ' battle__controls--result' : ''}`}>
        <p className="battle__turn">
          <span>{turnLabel(view.turn, over && !busy)}</span>
          {trial && <span className="battle__goal">3★: {THREE_STAR_TURNS} turns, no KOs</span>}
        </p>
        {result ? (
          <div className="battle__result">
            <BattleResult result={result} />
            <button type="button" className="btn btn--primary battle__tap" autoFocus onClick={onClose}>Continue</button>
          </div>
        ) : illegal ? (
          <p role="alert">This battle can't go on. Exit to abandon it.</p>
        ) : over && !busy ? (
          sendFailed ? (
            <div className="battle__sending">
              <p role="alert">{battle.refused ? messageFor(battle.refused.code) : "The result didn't reach the server."}</p>
              {/* A refusal (a 4xx but a limit or a timeout) will say the same forever; anything else may pass, and the same key makes trying again safe. */}
              {!(battle.refused && isFinalRefusal(battle.refused)) && <button type="button" className="btn btn--primary battle__tap" disabled={battle.pending} onClick={retry}>Try again</button>}
              <LeaveButton onLeave={onClose} />
            </div>
          ) : (
            <div className="battle__sending">
              <p>Saving the result</p>
              {slowSend && <LeaveButton onLeave={onClose} />}
            </div>
          )
        ) : replacing ? (
          <Bench state={state} mode="replace" onPick={choose} />
        ) : sheet && !busy ? (
          <Bench state={state} mode="swap" onPick={choose} onBack={() => setSheet(false)} />
        ) : (
          <Moves state={shownState} disabled={busy || battle.pending} onMove={choose} onSwap={openSheet} canSwap={canSwap} />
        )}
      </div>

      {confirm && canExit && <AbandonConfirm cost={trial ? TRIAL_ABANDON_COST : pvpForfeitCost(battle.trophies)} pending={battle.pending} onConfirm={abandon} onCancel={cancelConfirm} />}
    </section>
  )
})

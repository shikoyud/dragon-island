import { TRIAL_CHAPTERS, TURN_LIMIT, type Fighter, type PlayerMove } from '@wyrmhaven/game-core'
import type { CSSProperties } from 'react'
import type { BattleHook } from '../state/battle'
import { BattleResult } from './BattleResult'
import { ActionButton, Panel } from '../ui/Panel'

const TAP: CSSProperties = { minHeight: 44 }

/** Plain buttons for the player's move, with the live preview and the result. The full battle screen is Task 8. */
export function BattlePanel({ battle, onClose }: { battle: BattleHook; onClose?: () => void }) {
  const p = battle.preview
  if (!battle.setup || !p) return null
  const { sides, turn, awaiting } = p.state
  const mine = sides.attacker
  const actor = mine.team[mine.active]!
  const done = p.done
  const trial = battle.setup.mode === 'pve' ? battle.setup.trial : null
  const title = trial ? `${TRIAL_CHAPTERS[trial.chapter - 1]!.theme} · Node ${trial.node}` : 'Battle'
  const can = (m: PlayerMove) => battle.legal.some(x => JSON.stringify(x) === JSON.stringify(m))
  const replacing = !done && awaiting === 'replace'
  const bench = mine.team.flatMap((f, to) => (f.hp > 0 && to !== mine.active ? [{ f, to }] : []))

  return (
    <Panel title={title} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Team label="Your team" fighters={mine.team} active={mine.active} />
        <Team label="Opponent" fighters={sides.defender.team} active={sides.defender.active} />
      </div>
      <p>Turn {turn} of {TURN_LIMIT}{done ? '' : ` · ${replacing ? 'Send in your next dragon' : `${actor.species.name} to act`}`}</p>

      {!done && !replacing && (
        <>
          <div role="group" aria-label="Move" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {actor.moves.map((m, move) => (
              <button key={move} type="button" className="btn" style={TAP} disabled={!can({ kind: 'attack', move })} onClick={() => battle.choose({ kind: 'attack', move })}>
                {m.name}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Swap" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {bench.map(({ f, to }) => (
              <button key={to} type="button" className="btn" style={TAP} disabled={!can({ kind: 'swap', to })} onClick={() => battle.choose({ kind: 'swap', to })}>
                Swap to {f.species.name}
              </button>
            ))}
          </div>
        </>
      )}

      {replacing && (
        <div role="group" aria-label="Replacement" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {bench.map(({ f, to }) => (
            <button key={to} type="button" className="btn" style={TAP} disabled={!can({ kind: 'replace', to })} onClick={() => battle.choose({ kind: 'replace', to })}>
              Send in {f.species.name}
            </button>
          ))}
        </div>
      )}

      {done && done.ok && <p role="status" style={{ fontFamily: 'var(--font-display)' }}>{done.winner === 'attacker' ? 'You win!' : 'You lose.'} ({done.turns} turns)</p>}
      {done && !done.ok && <p role="alert">That move is not legal. Undo and pick again.</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <ActionButton id="battle-undo" disabled={!battle.canUndo || battle.pending} onClick={battle.undo}>Undo</ActionButton>
        <ActionButton id="battle-submit" primary disabled={!battle.canSubmit || battle.pending} reason="Finish the battle first" onClick={() => void battle.submit()}>
          Submit
        </ActionButton>
      </div>

      {battle.result && <BattleResult result={battle.result} />}
    </Panel>
  )
}

function Team({ label, fighters, active }: { label: string; fighters: readonly Fighter[]; active: number }) {
  return (
    <div>
      <h3 style={{ fontSize: 12 }}>{label}</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {fighters.map((f, i) => (
          <li key={i} aria-current={i === active ? 'true' : undefined}>
            {i === active ? '> ' : ''}{f.species.name} L{f.spec.level} · <span aria-label={`hp ${f.hp} of ${f.stats.hp}`}>{f.hp}/{f.stats.hp}</span>
            <div style={{ height: 4, background: 'var(--bg-panel-2)', marginTop: 2 }}>
              <div style={{ height: 4, width: `${Math.round((100 * f.hp) / f.stats.hp)}%`, background: f.hp > 0 ? 'var(--ok)' : 'var(--danger)' }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

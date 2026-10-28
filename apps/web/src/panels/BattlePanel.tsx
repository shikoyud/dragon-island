import { useState } from 'react'
import type { BattleHook } from '../state/battle'
import { ActionButton, Panel } from '../ui/Panel'

/** Move/target picker for the attacker whose turn it is, with the live preview and the result. */
export function BattlePanel({ battle, onClose }: { battle: BattleHook; onClose?: () => void }) {
  const [pendingMove, setPendingMove] = useState<number | null>(null)
  const p = battle.preview
  if (!battle.setup || !p) return null
  const legal = battle.legalMoves()
  const actor = p.next ? p.attacker[p.next.slot] : null
  const moveNames = actor ? actor.moves.map(m => m.name) : []
  const legalMoveIdx = new Set(legal.map(m => m.move))
  const legalTargets = pendingMove === null ? new Set<number>() : new Set(legal.filter(m => m.move === pendingMove).map(m => m.target))
  const done = p.done
  const title = battle.setup.mode === 'pvp' ? 'Battle' : `Stage ${battle.setup.stage}`

  return (
    <Panel title={title} onClose={onClose}>
      {!battle.exactPreview && <p><small>Preview only: the server rolls the real battle, so damage may differ.</small></p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Team label="Your team" fighters={p.attacker} />
        <Team label="Opponent" fighters={p.defender} />
      </div>
      <p>Round {p.round}{p.next ? ` · ${actor?.species.name} (slot ${p.next.slot + 1}) to act` : ''}</p>

      {p.next && !done && (
        <>
          <div role="group" aria-label="Move" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {moveNames.map((name, i) => (
              <button key={name} type="button" className={`btn ${pendingMove === i ? 'btn--primary' : ''}`} disabled={!legalMoveIdx.has(i)} aria-pressed={pendingMove === i} onClick={() => setPendingMove(i)}>
                {name}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Target" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {p.defender.map((d, i) => (
              <button
                key={i} type="button" className="btn"
                disabled={pendingMove === null || !legalTargets.has(i)}
                onClick={() => { if (pendingMove !== null) { battle.choose(pendingMove, i); setPendingMove(null) } }}
              >
                Target {i + 1}{d.hp === 0 ? ' (KO)' : ''}
              </button>
            ))}
          </div>
        </>
      )}

      {done && done.ok && <p role="status" style={{ fontFamily: 'var(--font-display)' }}>{done.winner === 'attacker' ? 'You win!' : 'You lose.'} ({done.rounds} rounds)</p>}
      {done && !done.ok && <p role="alert">That move is not legal. Undo and pick again.</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <ActionButton id="battle-undo" disabled={battle.moves.length === 0 || battle.pending} onClick={battle.undo}>Undo</ActionButton>
        <ActionButton id="battle-submit" primary disabled={!battle.canSubmit || battle.pending} reason={battle.setup.mode === 'pvp' ? 'Finish the battle first' : 'Pick at least one move'} onClick={() => void battle.submit()}>
          Submit
        </ActionButton>
      </div>

      {battle.result && (
        <p role="status">
          Result: {battle.report ? (battle.report.winner === 'attacker' ? 'victory' : 'defeat') : 'forfeit'} · trophies {battle.result.state.trophies}
          {battle.result.sp ? ` · +${battle.result.sp.awarded} SP` : ''}
        </p>
      )}
    </Panel>
  )
}

function Team({ label, fighters }: { label: string; fighters: BattleHook['preview'] extends infer P ? (P extends { attacker: infer A } ? A : never) : never }) {
  return (
    <div>
      <h3 style={{ fontSize: 12 }}>{label}</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {fighters.map((f, i) => (
          <li key={i}>
            {f.species.name} L{f.spec.level} · <span aria-label={`hp ${f.hp} of ${f.stats.hp}`}>{f.hp}/{f.stats.hp}</span>
            <div style={{ height: 4, background: 'var(--bg-panel-2)', marginTop: 2 }}>
              <div style={{ height: 4, width: `${Math.round((100 * f.hp) / f.stats.hp)}%`, background: f.hp > 0 ? 'var(--ok)' : 'var(--danger)' }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

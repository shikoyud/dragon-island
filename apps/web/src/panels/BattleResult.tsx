import type { ActionResponse } from '@wyrmhaven/shared'
import { formatGold } from '../ui/Money'
import { TOKEN_NAMES } from './SpeedUpButton'

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * What a settled battle gave (§6.3). A Trial lists its stars and rewards, and the Boss drops only when it paid them: tokens,
 * an egg (rarity and element only, R20), the Trial Champion and a saved Dragon Chest pull. A PvP battle shows its trophies.
 */
export function BattleResult({ result }: { result: ActionResponse }) {
  const won = result.battle ? result.battle.winner === 'attacker' : false
  const trial = result.trial
  return (
    <div role="status" aria-label="Battle result">
      <p style={{ fontFamily: 'var(--font-display)' }}>{won ? 'Victory' : 'Defeat'}</p>
      {trial ? (
        trial.won ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><span aria-label={`${trial.stars} stars`}>{'★'.repeat(trial.stars)}</span></li>
            <li>{formatGold(trial.gold)} gold · {formatGold(trial.food)} food · {formatGold(trial.xp)} XP</li>
            {trial.tokens && <li>{trial.tokens.count} × {TOKEN_NAMES[trial.tokens.token]} speed-up</li>}
            {trial.egg && <li>{capital(trial.egg.rarity)} {capital(trial.egg.element)} egg</li>}
            {trial.champion && <li>Trial Champion joined you</li>}
            {trial.chestPull && <li>Dragon Chest pull saved</li>}
          </ul>
        ) : (
          <p>The team rests</p>
        )
      ) : (
        <p>Trophies {result.state.trophies}</p>
      )}
    </div>
  )
}

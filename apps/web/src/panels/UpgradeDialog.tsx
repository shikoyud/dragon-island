import { constructionFor, upgradeInfo, type BuildingRef } from '@wyrmhaven/game-core'
import { ArtMark } from '../hud/ArtMark'
import { buildingSprite } from '../game/islandModel'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { useGameArt, SpriteStill } from '../ui/GameArt'
import { formatGold } from '../ui/Money'
import { Panel } from '../ui/Panel'
import { infoOf, upgradeBenefits, upgradeXp } from './infoModel'
import { levelOf, UpgradeSection } from './UpgradeSection'

/**
 * The Upgrade dialog (design, Phase 5: habitat-upgrade): plank "Upgrade <building> level N+1"; level N and N+1 side by
 * side with the XP bubble over them; Benefits right (value now and the green increase); the price button under, or a lock
 * with "Requires level N" when the player is below it. A running build or upgrade shows its timer and skip there instead.
 */
export function UpgradeDialog({ building, nowMs, onClose }: { building: BuildingRef; nowMs: number; onClose?: () => void }) {
  const me = useMe()
  const preset = usePreset()
  const art = useGameArt()
  const s = me.data?.state
  const info = s ? infoOf(s, building, preset) : null
  if (!s || !info) return null
  const level = levelOf(s, building)
  const step = upgradeInfo(s, building, preset)
  const running = constructionFor(s, building)
  const benefits = upgradeBenefits(s, building, preset)
  const xp = upgradeXp(s, building, preset)
  const locked = step !== null && !running && s.level < step.minLevel
  return (
    <Panel title={step ? `Upgrade ${info.name} level ${level + 1}` : `${info.name} level ${level}`} onClose={onClose}>
      <div className="upgrade-grid">
        <div className="upgrade-grid__levels">
          {xp > 0 && (
            <p className="upgrade-xp" aria-label={`XP +${formatGold(xp)}`}>
              <ArtMark name="ui.xpStar" size={28} />
              <span aria-hidden="true">{`+${formatGold(xp)}`}</span>
            </p>
          )}
          <figure className="upgrade-level">
            <SpriteStill sprite={buildingSprite(s, art, building)} height={96} />
            <figcaption>{`LVL ${level}`}</figcaption>
          </figure>
          {step && (
            <figure className="upgrade-level">
              <SpriteStill sprite={buildingSprite(s, art, building, level + 1)} height={108} />
              <figcaption>{`LVL ${level + 1}`}</figcaption>
            </figure>
          )}
        </div>
        {benefits.length > 0 && (
          <section className="upgrade-benefits" aria-label="Benefits">
            <h3>Benefits</h3>
            <ul>
              {benefits.map(b => (
                <li key={b.label}>
                  <span className="upgrade-benefits__label">{b.label}</span>
                  <span className="upgrade-benefits__value">{b.now} <span className="upgrade-benefits__plus">{b.plus}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {locked ? (
        <div className="upgrade-lock" role="note">
          <ArtMark name="ui.kit.lock" size={32} />
          <strong>{`Requires level ${step.minLevel}`}</strong>
        </div>
      ) : (
        <div className="upgrade-go"><UpgradeSection building={building} nowMs={nowMs} moveTurn={false} /></div>
      )}
    </Panel>
  )
}

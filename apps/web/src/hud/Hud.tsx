import { xpToNext } from '@wyrmhaven/game-core'
import type { ClientAction } from '@wyrmhaven/shared'
import { useEffect, useRef, type ReactNode } from 'react'
import type { Bridge, Target } from '../game/bridge'
import { timerLabel } from '../game/islandModel'
import { TOKEN_KEY as ADMIN_TOKEN_KEY } from '../pages/Admin'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold, formatMicroUsd, formatWei } from '../ui/Money'
import { attentionItems, sellLeftMicroUsd, xpFraction, type AttentionItem } from './hudModel'
import { Icon, type IconName } from './Icon'

export type PanelId = 'build' | 'map' | 'breed' | 'store' | 'hoard' | 'dragons' | 'battle' | 'season' | 'ranks' | 'referral' | 'settings' | 'quests'
/** What the one dialog shows: a named panel, or the panel of something clicked on the island. */
export type DialogKey = { kind: 'panel'; id: PanelId } | { kind: 'target'; target: Target }

/** The operator console keeps its token in this tab's sessionStorage; only then does the HUD offer the Admin button. */
const hasAdminToken = (): boolean => { try { return Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY)) } catch { return false } }

const isPanel = (open: DialogKey | null, id: PanelId) => open?.kind === 'panel' && open.id === id

/** A round HUD button: icon in a plate, label under it (or only for screen readers), optional badge. */
function RoundButton({ icon, label, onClick, active, badge, size = 'large', showLabel = true }: {
  icon: IconName; label: string; onClick: () => void; active?: boolean; badge?: ReactNode; size?: 'large' | 'small'; showLabel?: boolean
}) {
  return (
    <button type="button" className={`hud-round hud-round--${size}${active ? ' hud-round--active' : ''}`} aria-label={label} aria-pressed={active} onClick={onClick}>
      <span className="hud-round__plate"><Icon name={icon} size={size === 'large' ? 28 : 22} /></span>
      {badge !== undefined && badge !== null && <span className="hud-round__badge">{badge}</span>}
      {showLabel && <span className="hud-round__label" aria-hidden="true">{label}</span>}
    </button>
  )
}

function Pill({ icon, label, value, sub, plusLabel, onPlus }: { icon: IconName; label: string; value: ReactNode; sub?: string; plusLabel: string; onPlus: () => void }) {
  return (
    <div className="hud-pill" title={label}>
      <Icon name={icon} size={22} />
      <span className="hud-pill__text">
        <span className="hud-pill__value" aria-label={label}>{value}</span>
        {sub && <span className="hud-pill__sub">{sub}</span>}
      </span>
      <button type="button" className="hud-pill__plus" aria-label={plusLabel} onClick={onPlus}>+</button>
    </div>
  )
}

const ACTION_VERB: Partial<Record<ClientAction['type'], string>> = { finishConstruction: 'Finish', collectEgg: 'Collect', harvest: 'Harvest' }

function Shortcut({ item, nowMs, onOpen }: { item: AttentionItem; nowMs: number; onOpen: (k: DialogKey) => void }) {
  const { run, pending } = useAction()
  const open = () => onOpen(item.panel.kind === 'quests' ? { kind: 'panel', id: 'quests' } : { kind: 'target', target: item.panel })
  const icon: IconName = item.id === 'quests' ? 'quests' : item.id.startsWith('construction') ? 'build' : item.id === 'crops' ? 'food' : 'breed'
  return (
    <li className={`hud-shortcut${item.ready ? ' hud-shortcut--ready' : ''}`}>
      <button type="button" className="hud-shortcut__open" onClick={open}>
        <Icon name={icon} size={20} />
        <span className="hud-shortcut__label">{item.label}</span>
        {!item.ready && item.readyAtMs !== undefined && <span className="hud-shortcut__timer"><Icon name="timer" size={12} /> {timerLabel(item.readyAtMs, nowMs)}</span>}
      </button>
      {item.ready && item.action && (
        <button type="button" className="btn btn--primary hud-shortcut__act" disabled={pending} onClick={() => void run(item.action!)}>
          {ACTION_VERB[item.action.type] ?? 'Go'}
        </button>
      )}
    </li>
  )
}

/**
 * The game's HUD over the full-screen island: player badge and resources on top, island menu on the right,
 * what needs attention on the left, the main menu at the bottom (or the placement strip while placing, which
 * the App renders in `bottom`). Reports how much screen its top and bottom take so the camera frames around it.
 */
export function Hud({ bridge, nowMs, open, onOpen, placing, bottom, battle = false }: {
  bridge: Bridge; nowMs: number; open: DialogKey | null; onOpen: (k: DialogKey) => void; placing: boolean; bottom?: ReactNode
  /** During a battle only the top bar stays (resources update as the fight pays out); the menus step aside. */
  battle?: boolean
}) {
  const me = useMe()
  const top = useRef<HTMLElement>(null)
  const foot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const measure = () => {
      const t = top.current?.getBoundingClientRect()
      const b = foot.current?.getBoundingClientRect()
      if (!t || !b) return
      const next = { top: Math.round(t.bottom), bottom: Math.round(window.innerHeight - b.top) }
      if (next.top !== bridge.insets.top || next.bottom !== bridge.insets.bottom) bridge.setInsets(next)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    if (top.current) ro.observe(top.current)
    if (foot.current) ro.observe(foot.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [bridge, placing])

  const data = me.data
  if (!data) return null
  const s = data.state
  const sellLeft = sellLeftMicroUsd(s, nowMs)
  const daysLeft = data.season ? Math.max(0, Math.ceil((data.season.endsAtMs - nowMs) / 86_400_000)) : null
  const panel = (id: PanelId) => () => onOpen({ kind: 'panel', id })

  return (
    <div className="hud">
      <header className="hud-top" ref={top}>
        <div className="hud-avatar">
          <span className="hud-avatar__badge" aria-label={`Level ${s.level}`}>{s.level}</span>
          <div className="hud-xp" role="progressbar" aria-label="Experience" aria-valuemin={0} aria-valuemax={xpToNext(s.level)} aria-valuenow={s.xp}>
            <span className="hud-xp__fill" style={{ width: `${Math.round(xpFraction(s) * 100)}%` }} />
            <span className="hud-xp__text">{formatGold(s.xp)} / {formatGold(xpToNext(s.level))} XP</span>
          </div>
        </div>
        <div className="hud-pills" role="status" aria-label="Resources">
          <Pill icon="food" label="Food" value={formatGold(s.food)} plusLabel="Buy food" onPlus={panel('store')} />
          <Pill icon="gold" label="Gold" value={formatGold(s.gold)} sub={sellLeft !== null ? `sell ${formatMicroUsd(sellLeft)} today` : undefined} plusLabel="Get gold" onPlus={panel('store')} />
          <Pill icon="dris" label="DRIS" value={`${formatWei(BigInt(data.balanceWei), 18, 2)}`} plusLabel="Add DRIS" onPlus={panel('settings')} />
        </div>
        <RoundButton icon="settings" label="Settings" size="small" showLabel={false} active={isPanel(open, 'settings')} onClick={panel('settings')} />
      </header>

      {!battle && <>
      <nav className="hud-right" aria-label="Island menu">
        <RoundButton icon="season" label="Season" size="small" badge={daysLeft !== null ? `${daysLeft}d` : undefined} active={isPanel(open, 'season')} onClick={panel('season')} />
        <RoundButton icon="leaderboard" label="Ranks" size="small" active={isPanel(open, 'ranks')} onClick={panel('ranks')} />
        <RoundButton icon="map" label="Map" size="small" active={isPanel(open, 'map')} onClick={panel('map')} />
        <RoundButton icon="referral" label="Referral" size="small" active={isPanel(open, 'referral')} onClick={panel('referral')} />
        {hasAdminToken() && <a className="hud-round hud-round--small" href="#/admin" aria-label="Admin"><span className="hud-round__plate"><Icon name="admin" size={22} /></span><span className="hud-round__label" aria-hidden="true">Admin</span></a>}
      </nav>

      <aside className="hud-left" aria-label="Needs attention">
        <ul>
          {attentionItems(s, nowMs).map(item => <Shortcut key={item.id} item={item} nowMs={nowMs} onOpen={onOpen} />)}
        </ul>
      </aside>

      <div className="hud-bottom" ref={foot}>
        {bottom ?? (
          <nav className="hud-bar" aria-label="Main menu">
            <RoundButton icon="dragons" label="Dragons" active={isPanel(open, 'dragons')} onClick={panel('dragons')} />
            <RoundButton icon="breed" label="Breed" active={isPanel(open, 'breed')} onClick={panel('breed')} />
            <RoundButton icon="battle" label="Battle" active={isPanel(open, 'battle')} onClick={panel('battle')} />
            <RoundButton icon="hoard" label="Hoard" active={isPanel(open, 'hoard')} onClick={panel('hoard')} />
            <RoundButton icon="build" label="Build" active={placing || isPanel(open, 'build')} onClick={panel('build')} />
            <RoundButton icon="store" label="Store" active={isPanel(open, 'store')} onClick={panel('store')} />
          </nav>
        )}
      </div>
      </>}
    </div>
  )
}

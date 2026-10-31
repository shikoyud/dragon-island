import { gameDay, xpToNext } from '@wyrmhaven/game-core'
import type { ClientAction } from '@wyrmhaven/shared'
import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Bridge, Target } from '../game/bridge'
import { timerLabel } from '../game/islandModel'
import { FALLBACK_ART } from '../art/slots'
import { buildMapModel } from '../game/mapModel'
import { TOKEN_KEY as ADMIN_TOKEN_KEY } from '../pages/Admin'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { useToasts } from '../ui/Toast'
import { presetOf } from '../state/preset'
import { formatGold, formatWei } from '../ui/Money'
import { attentionItems, goalClaimable, XP_LIMIT_SHORT, xpBarText, xpFraction, type AttentionItem } from './hudModel'
import { Icon, type IconName } from './Icon'
import { TerminalClock } from './TerminalClock'

export type PanelId = 'shop' | 'breed' | 'book' | 'battle' | 'wings' | 'quests' | 'inbox' | 'map' | 'settings'
/** What the one dialog shows: a named panel (the Shop can open on its Store tab, Battle on a chapter's nodes), or the panel of something clicked on the island. */
export type DialogKey = { kind: 'panel'; id: PanelId; tab?: 'build' | 'store'; chapter?: number } | { kind: 'target'; target: Target }

/** The operator console keeps its token in this tab's sessionStorage; only then does the HUD offer the Admin button. */
const hasAdminToken = (): boolean => { try { return Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY)) } catch { return false } }

const isPanel = (open: DialogKey | null, id: PanelId) => open?.kind === 'panel' && open.id === id

/** The Map's scene shows for the Map itself and for an island panel over it; any other dialog closes it. */
export const isMapDialog = (open: DialogKey | null): boolean => isPanel(open, 'map') || (open?.kind === 'target' && open.target.kind === 'mapIsland')

/** A round HUD button: icon in a plate, label under it (or only for screen readers), optional badge. */
const COMING_LATER = 'Coming in a later milestone'

function RoundButton({ icon, label, onClick, active, badge, size = 'large', showLabel = true, disabledReason, description }: {
  icon: IconName; label: string; onClick?: () => void; active?: boolean; badge?: ReactNode; size?: 'large' | 'small'; showLabel?: boolean
  /** Makes the button inert and says why (as its tooltip and accessible description). */
  disabledReason?: string
  /** A state the button's name does not carry (Quests: a Goal is ready), read after the name; the name stays the label. */
  description?: string
}) {
  const descId = description ? `hud-desc-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined
  return (
    <button type="button" className={`hud-round hud-round--${size}${active ? ' hud-round--active' : ''}`} aria-label={label} aria-pressed={active} onClick={onClick}
      disabled={disabledReason !== undefined} title={disabledReason} aria-describedby={descId}>
      {description && <span id={descId} hidden>{description}</span>}
      <span className="hud-round__plate"><Icon name={icon} size={size === 'large' ? 28 : 22} /></span>
      {badge !== undefined && badge !== null && <span className="hud-round__badge">{badge}</span>}
      {showLabel && <span className="hud-round__label" aria-hidden="true">{label}</span>}
    </button>
  )
}

function Pill({ icon, label, value, sub, plusLabel, onPlus }: { icon: IconName; label: string; value: ReactNode; sub?: string; plusLabel?: string; onPlus?: () => void }) {
  return (
    <div className="hud-pill" title={label}>
      <Icon name={icon} size={22} />
      <span className="hud-pill__text">
        <span className="hud-pill__value" aria-label={label}>{value}</span>
        {sub && <span className="hud-pill__sub">{sub}</span>}
      </span>
      {plusLabel && <button type="button" className="hud-pill__plus" aria-label={plusLabel} onClick={onPlus}>+</button>}
    </div>
  )
}

const ACTION_VERB: Partial<Record<ClientAction['type'], string>> = { finishConstruction: 'Finish', collectEgg: 'Collect', harvest: 'Harvest', claimGoal: 'Claim' }

function Shortcut({ item, nowMs, onOpen }: { item: AttentionItem; nowMs: number; onOpen: (k: DialogKey) => void }) {
  const { run, pending } = useAction()
  const open = () => onOpen(item.open ?? { kind: 'target', target: item.panel })
  const icon: IconName = item.id.startsWith('construction') ? 'build' : item.id === 'crops' ? 'food' : item.id === 'goal' ? 'quests' : item.id === 'trial' ? 'battle' : 'breed'
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
export function Hud({ bridge, nowMs, open, onOpen, placing, bottom }: {
  bridge: Bridge; nowMs: number; open: DialogKey | null; onOpen: (k: DialogKey | null) => void; placing: boolean; bottom?: ReactNode
}) {
  const me = useMe()
  const toasts = useToasts()
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

  const mapOpen = isMapDialog(open)
  const playerState = me.data?.state
  // The HUD renders on every clock tick; the list changes only with the state.
  const mapIslands = useMemo(
    () => (mapOpen && playerState ? buildMapModel(playerState, bridge.art ?? FALLBACK_ART, bridge.view).islands : []),
    [mapOpen, playerState, bridge.art, bridge.view],
  )

  // The HUD renders on every clock tick (the countdown, the XP day limit, the attention timers). What doesn't read the clock
  // keeps its elements, so React skips it: on a throttled phone a whole-HUD render a second was the longest task there is.
  const food = playerState?.food ?? 0
  const gold = playerState?.gold ?? 0
  const balanceWei = me.data?.balanceWei
  const pills = useMemo(() => (
    <div className="hud-pills" role="status" aria-label="Resources">
      <Pill icon="food" label="Food" value={formatGold(food)} plusLabel="Buy food" onPlus={() => onOpen({ kind: 'panel', id: 'shop', tab: 'store' })} />
      {/* No "+" until the Store sells Gold. */}
      <Pill icon="gold" label="Gold" value={formatGold(gold)} />
      <Pill icon="dris" label="DRIS" value={`${formatWei(BigInt(balanceWei ?? 0), 18, 2)}`} plusLabel="Add DRIS" onPlus={() => onOpen({ kind: 'panel', id: 'settings' })} />
    </div>
  ), [food, gold, balanceWei, onOpen])
  const settingsOpen = isPanel(open, 'settings')
  const settings = useMemo(
    () => <RoundButton icon="settings" label="Settings" size="small" showLabel={false} active={settingsOpen} onClick={() => onOpen({ kind: 'panel', id: 'settings' })} />,
    [settingsOpen, onOpen],
  )
  const islandMenu = useMemo(() => (
    <nav className="hud-right" aria-label="Island menu">
      <RoundButton icon="map" label="Map" size="small" active={mapOpen} onClick={mapOpen ? () => onOpen(null) : () => onOpen({ kind: 'panel', id: 'map' })} disabledReason={placing ? 'Finish placing first' : undefined} />
      {hasAdminToken() && <a className="hud-round hud-round--small" href="#/admin" aria-label="Admin"><span className="hud-round__plate"><Icon name="admin" size={22} /></span><span className="hud-round__label" aria-hidden="true">Admin</span></a>}
    </nav>
  ), [mapOpen, placing, onOpen])
  const goalReady = playerState ? goalClaimable(playerState) : false
  const shopOpen = isPanel(open, 'shop')
  const breedOpen = isPanel(open, 'breed')
  const bookOpen = isPanel(open, 'book')
  const battleOpen = isPanel(open, 'battle')
  const questsOpen = isPanel(open, 'quests')
  const mainMenu = useMemo(() => {
    const panel = (id: PanelId) => () => onOpen({ kind: 'panel', id })
    return (
      <nav className="hud-bar" aria-label="Main menu">
        <RoundButton icon="store" label="Shop" active={placing || shopOpen} onClick={panel('shop')} />
        <RoundButton icon="breed" label="Breed" active={breedOpen} onClick={panel('breed')} />
        <RoundButton icon="dragons" label="Dragon Book" active={bookOpen} onClick={panel('book')} />
        <RoundButton icon="battle" label="Battle" active={battleOpen} onClick={panel('battle')} />
        <RoundButton icon="wings" label="Wings" disabledReason={COMING_LATER} />
        <RoundButton icon="quests" label="Quests" active={questsOpen} onClick={panel('quests')}
          description={goalReady ? 'Goal ready' : undefined}
          badge={goalReady ? <span className="hud-dot" aria-hidden="true" /> : undefined} />
        <RoundButton icon="inbox" label="Inbox" disabledReason={COMING_LATER} />
      </nav>
    )
  }, [placing, shopOpen, breedOpen, bookOpen, battleOpen, questsOpen, goalReady, onOpen])

  const data = me.data
  if (!data) return null
  const s = data.state
  const barText = xpBarText(s, formatGold, data.game ? { preset: presetOf(data), day: gameDay(data.game.launchAtMs, nowMs) } : undefined)
  // At the day's limit the sentence is too long for the bar on a phone: the bar shows a short label, the sentence stays its title and value text, and a tap shows it.
  const limited = barText.startsWith(XP_LIMIT_SHORT)

  return (
    <div className="hud">
      <header className="hud-top" ref={top}>
        <div className="hud-avatar">
          <span className="hud-avatar__badge" aria-label={`Level ${s.level}`}>{s.level}</span>
          <div className={`hud-xp${limited ? ' hud-xp--limit' : ''}`} role="progressbar" aria-label="Experience" aria-valuemin={0} aria-valuemax={Number.isFinite(xpToNext(s.level)) ? xpToNext(s.level) : s.xp} aria-valuenow={Number.isFinite(xpToNext(s.level)) ? Math.min(s.xp, xpToNext(s.level)) : s.xp}
            {...(limited ? { title: barText, 'aria-valuetext': barText, tabIndex: 0, onClick: () => toasts.info(barText), onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toasts.info(barText) } } } : {})}>
            <span className="hud-xp__fill" style={{ width: `${Math.round(xpFraction(s) * 100)}%` }} />
            {limited
              ? <>
                <span className="hud-xp__text hud-xp__text--short" aria-hidden="true">{XP_LIMIT_SHORT}</span>
                <span className="hud-xp__text hud-xp__text--full">{barText}</span>
              </>
              : <span className="hud-xp__text">{barText}</span>}
          </div>
        </div>
        {pills}
        {settings}
        {data.game && <TerminalClock game={data.game} nowMs={nowMs} />}
      </header>

      {islandMenu}

      {/* R60: the Map's canvas is invisible to the keyboard and to screen readers. These stay out of sight until focused. */}
      {mapOpen && (
        <nav className="map-list" aria-label="Islands">
          <ul>
            {mapIslands.map(i => (
              <li key={i.id}><button type="button" className="btn" aria-current={i.state === 'current' ? 'true' : undefined} onClick={() => onOpen({ kind: 'target', target: { kind: 'mapIsland', id: i.id } })}>{i.label}</button></li>
            ))}
          </ul>
        </nav>
      )}

      <aside className="hud-left" aria-label="Needs attention">
        <ul>
          {attentionItems(s, nowMs).map(item => <Shortcut key={item.id} item={item} nowMs={nowMs} onOpen={onOpen} />)}
        </ul>
      </aside>

      <div className="hud-bottom" ref={foot}>
        {bottom ?? mainMenu}
      </div>
    </div>
  )
}

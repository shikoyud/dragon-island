import { gameDay, xpToNext } from '@wyrmhaven/game-core'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ResourcePill } from '../ui/kit/pieces'
import type { Bridge, Target } from '../game/bridge'
import { FALLBACK_ART } from '../art/slots'
import { buildMapModel } from '../game/mapModel'
import { TOKEN_KEY as ADMIN_TOKEN_KEY } from '../pages/Admin'
import { useMe } from '../state/me'
import { useToasts } from '../ui/Toast'
import { presetOf } from '../state/preset'
import { formatGold, formatWei } from '../ui/Money'
import { bookCount, goalClaimable, goalsBubble, newBookEntries, XP_LIMIT_SHORT, xpBarText, xpFraction } from './hudModel'
import { Icon, type IconName } from './Icon'
import { ZoomSlider } from './ZoomSlider'

export type PanelId = 'shop' | 'breed' | 'book' | 'battle' | 'wings' | 'quests' | 'inbox' | 'map' | 'settings'
/** What the one dialog shows: a named panel (the Shop can open on its Store tab, Battle on a chapter's nodes), or the panel of something clicked on the island. */
export type DialogKey = { kind: 'panel'; id: PanelId; tab?: 'build' | 'store' | 'account' | 'wallet'; chapter?: number } | { kind: 'target'; target: Target }

/** The operator console keeps its token in this tab's sessionStorage; only then does the HUD offer the Admin button. */
const hasAdminToken = (): boolean => { try { return Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY)) } catch { return false } }

const readSeen = (key: string): string[] | null => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as string[]) : null } catch { return null }
}
const writeSeen = (key: string, ids: readonly string[]): void => { try { localStorage.setItem(key, JSON.stringify(ids)) } catch { /* private mode */ } }

const isPanel = (open: DialogKey | null, id: PanelId) => open?.kind === 'panel' && open.id === id

/** The Map's scene shows for the Map itself and for an island panel over it; any other dialog closes it. */
export const isMapDialog = (open: DialogKey | null): boolean => isPanel(open, 'map') || (open?.kind === 'target' && open.target.kind === 'mapIsland')

/** A round HUD button: icon in a plate, label under it (or only for screen readers), optional badge. */
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


/**
 * The game's HUD over the full-screen island: player badge and resources on top, island menu on the right,
 * the main menu at the bottom (or the placement strip while placing, which
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
  // $DRIS first (its plus opens the deposit), then Gold, then Food (design: Currencies).
  const pills = useMemo(() => (
    <div className="hud-pills" role="status" aria-label="Resources">
      <ResourcePill icon={<Icon name="dris" size={32} />} label="DRIS" value={formatWei(BigInt(balanceWei ?? 0), 18, 2)} plusLabel="Add DRIS" onPlus={() => onOpen({ kind: 'panel', id: 'settings', tab: 'wallet' })} />
      {/* No plus until the Store sells Gold. */}
      <ResourcePill icon={<Icon name="gold" size={32} />} label="Gold" value={formatGold(gold)} />
      <ResourcePill icon={<Icon name="food" size={32} />} label="Food" value={formatGold(food)} plusLabel="Buy food" onPlus={() => onOpen({ kind: 'panel', id: 'shop', tab: 'store' })} />
    </div>
  ), [food, gold, balanceWei, onOpen])
  const settingsOpen = isPanel(open, 'settings')
  // Top right: Settings, and the Map under it (Phase 3 ruling Q7).
  const islandMenu = useMemo(() => (
    <nav className="hud-right" aria-label="Island menu">
      <RoundButton icon="settings" label="Settings" size="small" showLabel={false} active={settingsOpen} onClick={() => onOpen({ kind: 'panel', id: 'settings' })} />
      <RoundButton icon="map" label="Map" size="small" active={mapOpen} onClick={mapOpen ? () => onOpen(null) : () => onOpen({ kind: 'panel', id: 'map' })} disabledReason={placing ? 'Finish placing first' : undefined} />
      {hasAdminToken() && <a className="hud-round hud-round--small" href="#/admin" aria-label="Admin"><span className="hud-round__plate"><Icon name="admin" size={22} /></span><span className="hud-round__label" aria-hidden="true">Admin</span></a>}
    </nav>
  ), [settingsOpen, mapOpen, placing, onOpen])
  const goalReady = playerState ? goalClaimable(playerState) : false
  const shopOpen = isPanel(open, 'shop')
  const bookOpen = isPanel(open, 'book')
  const battleOpen = isPanel(open, 'battle')
  const questsOpen = isPanel(open, 'quests')
  // Bottom left Battle (Storage joins it in Phase 5), bottom right Shop; the centre stays free for the action and Move bars.
  const mainMenu = useMemo(() => {
    const panel = (id: PanelId) => () => onOpen({ kind: 'panel', id })
    return (
      <nav className="hud-corners" aria-label="Main menu">
        <span className="hud-corner hud-corner--left"><RoundButton icon="battle" label="Battle" active={battleOpen} onClick={panel('battle')} /></span>
        <span className="hud-corner hud-corner--right"><RoundButton icon="shop" label="Shop" active={placing || shopOpen} onClick={panel('shop')} /></span>
      </nav>
    )
  }, [placing, shopOpen, battleOpen, onOpen])

  // The Book's red badge: species found since this device last opened it (ruling Q4).
  const playerId = me.data?.playerId
  const seenKey = `dris.bookSeen.${playerId ?? '-'}`
  const [seen, setSeen] = useState<string[] | null>(() => readSeen(seenKey))
  useEffect(() => { setSeen(readSeen(seenKey)) }, [seenKey])
  const discovered = playerState?.discovered
  useEffect(() => {
    if (!bookOpen || !discovered) return
    writeSeen(seenKey, discovered)
    setSeen([...discovered])
  }, [bookOpen, discovered, seenKey])

  // Memoised like the menus: the clock tick must not render them again.
  const bubble = playerState ? goalsBubble(playerState) : null
  const goalsNav = useMemo(() => (
    <nav className="hud-goals" aria-label="Goals">
      <RoundButton icon="goals" label="Goals" active={questsOpen} onClick={() => onOpen({ kind: 'panel', id: 'quests' })}
        description={goalReady ? 'Goal ready' : undefined} />
      {bubble && <span className={`hud-goals__bubble${bubble === 'Claim!' ? ' hud-goals__bubble--claim' : ''}`} aria-hidden="true">{bubble}</span>}
    </nav>
  ), [questsOpen, goalReady, bubble, onOpen])
  const level = playerState?.level ?? 0
  const book = playerState ? bookCount(playerState) : { found: 0, total: 0 }
  const fresh = playerState ? newBookEntries(playerState, seen) : 0
  const avatar = useMemo(() => (
    <div className="hud-avatar">
      <span className="hud-avatar__frame" aria-hidden="true"><Icon name="dragons" size={32} /></span>
      <span className="hud-avatar__badge" aria-label={`Level ${level}`}>{level}</span>
    </div>
  ), [level])
  const bookButton = useMemo(() => (
    <button type="button" className="hud-book" aria-label="Dragon Book" aria-pressed={bookOpen} aria-describedby={fresh > 0 ? 'hud-book-new' : undefined} onClick={() => onOpen({ kind: 'panel', id: 'book' })}>
      <Icon name="book" size={32} />
      <span className="hud-book__count">{book.found}/{book.total}</span>
      {fresh > 0 && <span className="hud-book__new" id="hud-book-new"><span aria-hidden="true">{fresh}</span><span className="sr-only">{`${fresh} new`}</span></span>}
    </button>
  ), [bookOpen, fresh, book.found, book.total, onOpen])

  const data = me.data
  if (!data) return null
  const s = data.state
  const barText = xpBarText(s, formatGold, data.game ? { preset: presetOf(data), day: gameDay(data.game.launchAtMs, nowMs) } : undefined)
  // At the day's limit the sentence is too long for the bar on a phone: the bar shows a short label, the sentence stays its title and value text, and a tap shows it.
  const limited = barText.startsWith(XP_LIMIT_SHORT)


  return (
    <div className="hud">
      <header className="hud-top" ref={top}>
        <div className="hud-player" role="group" aria-label="Player">
          {avatar}
          <div className="hud-player__side">
            {bookButton}
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
        </div>
        {pills}
        <span className="hud-top__spacer" aria-hidden="true" />
      </header>

      {goalsNav}

      {islandMenu}
      {/* Memoised on the bridge and fed by its zoom event: the clock tick doesn't render it. */}
      <ZoomSlider bridge={bridge} />

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

      <div className="hud-bottom" ref={foot}>
        {bottom ?? mainMenu}
      </div>
    </div>
  )
}

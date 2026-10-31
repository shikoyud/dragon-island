import {
  anyHurt, BOSS_NODE, canFight, currentHp, elementMultiplier, gameDay, getSpecies, HEAL_ALL_MICRO_USD, LAUNCH_CATALOG, maxHp, MIN_FIGHT_PCT,
  NODES_PER_CHAPTER, nodeKey, nodeLevel, nodeLocked, nodeRewards, nodeTeam, REPLAYS_PER_NODE_PER_DAY, TRIAL_CHAPTERS, unlockPl,
  type Catalog, type Dragon, type Preset, type TeamIds, type UnlockKey,
} from '@wyrmhaven/game-core'
import { useState, type CSSProperties } from 'react'
import { Icon } from '../hud/Icon'
import { useAction } from '../state/actions'
import { clearTrialDraft } from '../state/battle'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatGold, formatMicroUsd } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

const TAP: CSSProperties = { minHeight: 44 }
const STARS_PER_CHAPTER = NODES_PER_CHAPTER * 3
const MS_PER_MINUTE = 60_000
const NEED_THREE = 'Need 3 dragons'
const FINISH_FIRST = 'Finish the Trial in progress first'

const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)

/** Milliseconds until `d` can fight (0 if it can now): the first moment regen has brought it to the 25 % line. */
export function fightsInMs(d: Dragon, c: Catalog, nowMs: number, preset: Preset): number {
  if (canFight(d, c, nowMs, preset) || !d.fatigue) return 0
  const max = maxHp(d, c)
  const need = Math.ceil((max * MIN_FIGHT_PCT) / 100) - d.fatigue.hp
  const elapsed = Math.ceil((need * 100 * MS_PER_MINUTE) / (max * preset.healPctPerMin))
  return Math.max(0, d.fatigue.atMs + elapsed - nowMs)
}

/** "3m" or "1h 5m": whole minutes, rounded up, never "0m". */
function waitLabel(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / MS_PER_MINUTE))
  return m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`
}

const teamKey = (playerId: string): string => `dris.trialTeam.${playerId}`
function loadTeam(playerId: string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(teamKey(playerId)) ?? 'null')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}
function saveTeam(playerId: string, team: readonly string[]): void {
  try { localStorage.setItem(teamKey(playerId), JSON.stringify(team)) } catch { /* a convenience, never needed */ }
}

type View = { screen: 'chapters' } | { screen: 'nodes'; chapter: number } | { screen: 'team'; chapter: number; node: number }

/** The Elemental Trials (§6.3): chapters, then a chapter's nodes, then the team to send; three screens with a back button. */
export function TrialsPanel({ nowMs, onFight, onResume, onClose }: {
  nowMs: number; onFight: (chapter: number, node: number, team: TeamIds) => void; onResume: () => void; onClose?: () => void
}) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const c = LAUNCH_CATALOG
  const s = me.data?.state
  const playerId = me.data?.playerId ?? ''
  const usable = (d: Dragon) => canFight(d, c, nowMs, preset)
  const [view, setView] = useState<View>({ screen: 'chapters' })
  const [picked, setPicked] = useState<string[] | null>(null)
  if (!s) return null

  const active = s.pve.active
  const rested = s.dragons.filter(usable)
  const enough = rested.length >= 3
  // The team: what the player has picked here, else the last team sent, else the defence team, else the first rested three.
  const initial = (): string[] => {
    const fit = (ids: readonly string[]) => ids.filter((id, i) => ids.indexOf(id) === i && rested.some(d => d.id === id)).slice(0, 3)
    for (const ids of [loadTeam(playerId), s.defenceTeam ?? []]) if (fit(ids).length === 3) return fit(ids)
    return rested.slice(0, 3).map(d => d.id)
  }
  const team = (picked ?? initial()).filter(id => rested.some(d => d.id === id))
  const toggle = (id: string) => setPicked(team.includes(id) ? team.filter(x => x !== id) : team.length < 3 ? [...team, id] : team)

  const hurt = anyHurt(s, c, nowMs, preset)
  const game = me.data?.game
  const day = game ? gameDay(game.launchAtMs, nowMs) : s.pve.replays.day
  const replaysUsed = (key: `${number}:${number}`) => (day > s.pve.replays.day ? 0 : s.pve.replays.counts[key] ?? 0)
  const pl = (n: number) => unlockPl(`trial:${n}` as UnlockKey)
  const chapterStars = (n: number) => Array.from({ length: NODES_PER_CHAPTER }, (_, i) => s.pve.stars[nodeKey(n, i + 1)] ?? 0).reduce<number>((a, b) => a + b, 0)
  const abandon = () => {
    if (!active) return
    void run({ type: 'abandonTrial' }).then(res => { if (res) clearTrialDraft(me.data!.playerId, active.index) })
  }

  /** Why a chapter is closed, or '' when it is open to play. */
  const chapterReason = (n: number): string => {
    if (s.level < pl(n)) return `Needs player level ${pl(n)}`
    if (n > 1 && !s.pve.stars[nodeKey(n - 1, BOSS_NODE)]) return `Beat the ${TRIAL_CHAPTERS[n - 2]!.theme} Boss first`
    return ''
  }
  /** Why a node can't be started now ('' if it can); the lock first, then the Trial in progress, the dragons, the day's replays. */
  const nodeReason = (chapter: number, node: number): string => {
    const lock = nodeLocked(s, chapter, node)
    if (lock === 'LEVEL') return `Needs player level ${pl(chapter)}`
    if (lock === 'PREVIOUS') return node === 1 ? `Beat the ${TRIAL_CHAPTERS[chapter - 2]!.theme} Boss first` : 'Clear the previous node first'
    if (active) return FINISH_FIRST
    if (!enough) {
      if (s.dragons.length < 3) return NEED_THREE
      const waits = s.dragons.map(d => fightsInMs(d, c, nowMs, preset)).filter(w => w > 0).sort((a, b) => a - b)
      return `Need 3 rested dragons · next fights in ${waitLabel(waits[2 - rested.length]!)}`
    }
    const key = nodeKey(chapter, node)
    if (s.pve.stars[key] && replaysUsed(key) >= REPLAYS_PER_NODE_PER_DAY) return 'No replays left today'
    return ''
  }

  const heal = (
    <ActionButton
      id="trial-heal-all"
      disabled={pending || active !== null || !hurt}
      reason={active ? FINISH_FIRST : 'Everyone is healthy'}
      onClick={() => void run({ type: 'buy', item: { kind: 'healAll' } })}
    >
      Heal all · {formatMicroUsd(HEAL_ALL_MICRO_USD)}
    </ActionButton>
  )

  const banner = active && (
    <div role="status" aria-label="Trial in progress" className="trials__banner">
      <p>Trial in progress: {TRIAL_CHAPTERS[active.chapter - 1]!.theme} · Node {active.node}. Resume to finish it. Abandoning counts as a loss and leaves the team on 1 HP.</p>
      <div className="trials__row">
        <ActionButton id="trial-resume" primary onClick={onResume}>Resume</ActionButton>
        <ActionButton id="trial-abandon" danger disabled={pending} onClick={abandon}>Abandon</ActionButton>
      </div>
    </div>
  )

  const back = (label: string, to: View) => (
    <button type="button" className="btn btn--ghost trials__back" style={TAP} aria-label={`Back to ${label}`} onClick={() => setView(to)}>‹ {label}</button>
  )

  /* ---- screen 1: chapters ---- */
  if (view.screen === 'chapters') {
    return (
      <Panel title="Elemental Trials" onClose={onClose}>
        <div className="trials">
          {banner}
          {s.level < unlockPl('pve') && <p>The Trials unlock at player level {unlockPl('pve')}.</p>}
          <ul aria-label="Chapters" className="trials__list">
            {TRIAL_CHAPTERS.map(ch => {
              const reason = chapterReason(ch.chapter)
              return (
                <li key={ch.chapter}>
                  <button type="button" className={`btn trials__chapter${reason ? ' trials__chapter--locked' : ''}`} style={TAP} onClick={() => setView({ screen: 'nodes', chapter: ch.chapter })}>
                    <Icon name={ch.element} size={28} />
                    <span className="trials__main">
                      <span className="trials__name">{ch.theme}</span>
                      <span className="trials__sub">PL {pl(ch.chapter)} · ★ {chapterStars(ch.chapter)} / {STARS_PER_CHAPTER}</span>
                      {reason && <span className="trials__why">{reason}</span>}
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="trials__heal">{heal}</div>
        </div>
      </Panel>
    )
  }

  const ch = TRIAL_CHAPTERS[view.chapter - 1]!

  /* ---- screen 2: a chapter's nodes ---- */
  if (view.screen === 'nodes') {
    const nodeNumbers = Array.from({ length: NODES_PER_CHAPTER }, (_, i) => i + 1)
    const next = nodeNumbers.find(n => !s.pve.stars[nodeKey(ch.chapter, n)] && !nodeReason(ch.chapter, n))
    return (
      <Panel title="Elemental Trials" onClose={onClose}>
        <div className="trials">
          {banner}
          <div className="trials__head">
            {back('Chapters', { screen: 'chapters' })}
            <h3 className="trials__title"><Icon name={ch.element} size={20} /> {ch.theme}</h3>
          </div>
          <ul aria-label="Nodes" className="trials__list">
            {nodeNumbers.map(n => {
              const key = nodeKey(ch.chapter, n)
              const stars = s.pve.stars[key] ?? 0
              const reward = nodeRewards(ch.chapter, n, stars ? 'replay' : 'first')
              const reason = nodeReason(ch.chapter, n)
              const enemies = nodeTeam(ch.chapter, n, c)
              return (
                <li key={n}>
                  <ActionButton id={`trial-node-${n}`} disabled={Boolean(reason)} reason={reason} primary={n === next} onClick={() => setView({ screen: 'team', chapter: ch.chapter, node: n })}>
                    <span className={`trials__node${n === next ? ' trials__node--next' : ''}`}>
                      <span className="trials__node-head">
                        <span>Node {n}{n === BOSS_NODE ? ' · Boss' : ''} · L{nodeLevel(ch.chapter, n)}</span>
                        {stars > 0 && <span className="trials__stars" aria-label={`${stars} stars`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</span>}
                      </span>
                      <span className="trials__enemies">
                        {enemies.map((e, i) => {
                          const el = getSpecies(c, e.speciesId).elements[0]!
                          return <Icon key={i} name={el} size={20} label={i === 2 ? `${cap(el)} (wildcard)` : cap(el)} />
                        })}
                      </span>
                      <span className="trials__reward">
                        {formatGold(reward.gold)} gold · {formatGold(reward.food)} food{reward.xp ? ` · ${formatGold(reward.xp * preset.xpMult)} XP` : ''}
                      </span>
                      {stars > 0 && <span className="trials__replays">Replays left {Math.max(0, REPLAYS_PER_NODE_PER_DAY - replaysUsed(key))}</span>}
                    </span>
                  </ActionButton>
                </li>
              )
            })}
          </ul>
        </div>
      </Panel>
    )
  }

  /* ---- screen 3: the team ---- */
  const node = view.node
  const reason = nodeReason(ch.chapter, node)
  const teamReason = reason || (team.length === 3 ? '' : 'Pick 3 dragons')
  const fight = () => {
    saveTeam(playerId, team)
    onFight(ch.chapter, node, team as TeamIds)
  }
  return (
    <Panel title="Elemental Trials" onClose={onClose}>
      <div className="trials">
        {banner}
        <div className="trials__head">
          {back(ch.theme, { screen: 'nodes', chapter: ch.chapter })}
          <h3 className="trials__title"><Icon name={ch.element} size={20} /> Node {node}{node === BOSS_NODE ? ' · Boss' : ''} · L{nodeLevel(ch.chapter, node)}</h3>
        </div>
        <ol aria-label="Team slots" className="trials__slots">
          {[0, 1, 2].map(i => {
            const d = s.dragons.find(x => x.id === team[i])
            return (
              <li key={i}>
                <button type="button" className="btn trials__slot" style={TAP} disabled={!d} aria-label={d ? `${i === 0 ? 'Lead' : `Slot ${i + 1}`}: ${getSpecies(c, d.speciesId).name}, tap to remove` : `${i === 0 ? 'Lead' : `Slot ${i + 1}`}: empty`} onClick={() => d && toggle(d.id)}>
                  <span className="trials__slot-n">{i === 0 ? 'Lead' : i + 1}</span>
                  <span>{d ? <><Icon name={getSpecies(c, d.speciesId).elements[0]!} size={16} /> {getSpecies(c, d.speciesId).name}</> : 'Empty'}</span>
                </button>
              </li>
            )
          })}
        </ol>
        {!enough && <p>{NEED_THREE} with at least {MIN_FIGHT_PCT} % HP.</p>}
        <div role="group" aria-label="Your dragons" className="trials__cards">
          {s.dragons.map(d => {
            const sp = getSpecies(c, d.speciesId)
            const max = maxHp(d, c)
            const hp = currentHp(d, c, nowMs, preset)
            const pct = Math.floor((hp * 100) / max)
            const ready = usable(d)
            const slot = team.indexOf(d.id)
            const counter = elementMultiplier(sp.elements[0]!, ch.element) === 2
            return (
              <button key={d.id} type="button" className={`btn trials__card${slot >= 0 ? ' trials__card--picked' : ''}`} style={TAP} disabled={!ready} aria-pressed={slot >= 0} onClick={() => toggle(d.id)}>
                <span className="trials__card-top">
                  <Icon name={sp.elements[0]!} size={20} />
                  <span className="trials__name">{sp.name}</span>
                </span>
                <span className="trials__card-meta">
                  <span>L{d.level}</span>
                  {counter && <span className="trials__counter" title={`Hits ${cap(ch.element)} for 2x`}>2x</span>}
                  {slot >= 0 && <span className="trials__slot-badge">{slot === 0 ? 'Lead' : slot + 1}</span>}
                </span>
                <span className="trials__hp" role="progressbar" aria-label="HP" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <span className={`trials__hp-fill${ready ? '' : ' trials__hp-fill--low'}`} style={{ width: `${pct}%` }} />
                </span>
                <span className="trials__sub">{ready ? `${pct} %` : `Fights in ${waitLabel(fightsInMs(d, c, nowMs, preset))} · ${pct} %`}</span>
              </button>
            )
          })}
        </div>
        <div className="trials__row trials__actions">
          <ActionButton id="trial-fight" primary disabled={Boolean(teamReason) || pending} reason={teamReason} onClick={fight}>Fight</ActionButton>
          {heal}
        </div>
      </div>
    </Panel>
  )
}

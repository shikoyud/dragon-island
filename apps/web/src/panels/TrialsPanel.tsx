import {
  anyHurt, BOSS_NODE, canFight, currentHp, gameDay, getSpecies, HEAL_ALL_MICRO_USD, LAUNCH_CATALOG, maxHp, NODES_PER_CHAPTER, nodeKey, nodeLevel, nodeLocked, nodeRewards, REPLAYS_PER_NODE_PER_DAY,
  TRIAL_CHAPTERS, unlockPl, type Dragon, type TeamIds, type UnlockKey,
} from '@wyrmhaven/game-core'
import { useState, type CSSProperties } from 'react'
import { useAction } from '../state/actions'
import { clearTrialDraft } from '../state/battle'
import { useMe } from '../state/me'
import { usePreset } from '../state/preset'
import { formatGold, formatMicroUsd } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'

const TAP: CSSProperties = { minHeight: 44 }
const STARS_PER_CHAPTER = NODES_PER_CHAPTER * 3
const NEED_THREE = 'Need 3 dragons'

/** Functional, not final (Task 7 finishes it): chapters, nodes, the team with its HP, heal-all, and Resume or Abandon. */
export function TrialsPanel({ nowMs, onFight, onResume, onClose }: {
  nowMs: number; onFight: (chapter: number, node: number, team: TeamIds) => void; onResume: () => void; onClose?: () => void
}) {
  const me = useMe()
  const preset = usePreset()
  const { run, pending } = useAction()
  const s = me.data?.state
  const c = LAUNCH_CATALOG
  const usable = (d: Dragon) => canFight(d, c, nowMs, preset)
  const [chapter, setChapter] = useState(1)
  const [picked, setPicked] = useState<string[]>(() => (s?.defenceTeam ?? s?.dragons.slice(0, 3).map(d => d.id) ?? []).filter(id => {
    const d = s?.dragons.find(x => x.id === id)
    return d !== undefined && usable(d)
  }))
  if (!s) return null

  const active = s.pve.active
  const team = picked.filter(id => { const d = s.dragons.find(x => x.id === id); return d !== undefined && usable(d) })
  const enough = s.dragons.filter(usable).length >= 3
  const teamOk = team.length === 3
  const toggle = (id: string) => setPicked(t => (t.includes(id) ? t.filter(x => x !== id) : team.length < 3 ? [...team, id] : t))
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

  const nodeReason = (node: number): string => {
    if (active) return 'Finish the Trial in progress first'
    const lock = nodeLocked(s, chapter, node)
    if (lock === 'LEVEL') return `Needs player level ${pl(chapter)}`
    if (lock === 'PREVIOUS') return node === 1 ? 'Beat the previous Boss first' : 'Clear the previous node first'
    if (!enough) return NEED_THREE
    if (!teamOk) return 'Pick 3 dragons'
    const key = nodeKey(chapter, node)
    if (s.pve.stars[key] && replaysUsed(key) >= REPLAYS_PER_NODE_PER_DAY) return 'No replays left today'
    return ''
  }

  return (
    <Panel title="Elemental Trials" onClose={onClose}>
      {active && (
        <div role="status" aria-label="Trial in progress" style={{ marginBottom: 8 }}>
          <p>Trial in progress: {TRIAL_CHAPTERS[active.chapter - 1]!.theme} · Node {active.node}. Abandoning is a loss, with the team on 1 HP.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton id="trial-resume" primary onClick={onResume}>Resume</ActionButton>
            <ActionButton id="trial-abandon" danger disabled={pending} onClick={abandon}>Abandon</ActionButton>
          </div>
        </div>
      )}
      {s.level < unlockPl('pve') && <p>The Trials unlock at player level {unlockPl('pve')}.</p>}

      <fieldset>
        <legend>Team (pick 3)</legend>
        {!enough && <p>{NEED_THREE} with at least 25 % HP.</p>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {s.dragons.map(d => {
            const pct = Math.floor((currentHp(d, c, nowMs, preset) * 100) / maxHp(d, c))
            const ready = usable(d)
            return (
              <button key={d.id} type="button" className={`btn ${team.includes(d.id) ? 'btn--primary' : ''}`} style={TAP} disabled={!ready} aria-pressed={team.includes(d.id)} onClick={() => toggle(d.id)}>
                {getSpecies(c, d.speciesId).name} L{d.level} · {ready ? `${pct} %` : `Resting: ${pct} %`}
              </button>
            )
          })}
        </div>
      </fieldset>
      <ActionButton
        id="trial-heal-all"
        disabled={pending || active !== null || !hurt}
        reason={active ? 'Finish the Trial in progress first' : 'Nobody is hurt'}
        onClick={() => void run({ type: 'buy', item: { kind: 'healAll' } })}
      >
        Heal all · {formatMicroUsd(HEAL_ALL_MICRO_USD)}
      </ActionButton>

      <ul aria-label="Chapters" style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginTop: 8 }}>
        {TRIAL_CHAPTERS.map(ch => (
          <li key={ch.chapter}>
            <button type="button" className={`btn ${ch.chapter === chapter ? 'btn--primary' : ''}`} style={{ ...TAP, width: '100%' }} aria-pressed={ch.chapter === chapter} onClick={() => setChapter(ch.chapter)}>
              {ch.theme} · PL {pl(ch.chapter)} · ★ {chapterStars(ch.chapter)}/{STARS_PER_CHAPTER}
            </button>
          </li>
        ))}
      </ul>

      <ul aria-label="Nodes" style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6, marginTop: 8 }}>
        {Array.from({ length: NODES_PER_CHAPTER }, (_, i) => i + 1).map(node => {
          const key = nodeKey(chapter, node)
          const stars = s.pve.stars[key]
          const reward = nodeRewards(chapter, node, stars ? 'replay' : 'first')
          const reason = nodeReason(node)
          return (
            <li key={node}>
              <ActionButton id={`trial-node-${node}`} disabled={Boolean(reason)} reason={reason} primary={!stars && !reason} onClick={() => onFight(chapter, node, team as TeamIds)}>
                Node {node}{node === BOSS_NODE ? ' (Boss)' : ''} · L{nodeLevel(chapter, node)}{stars ? ` · ${'★'.repeat(stars)}` : ''} · {formatGold(reward.gold)} gold · {formatGold(reward.food)} food
                {reward.xp ? ` · ${formatGold(reward.xp * preset.xpMult)} XP` : ''}
                {stars ? ` · ${Math.max(0, REPLAYS_PER_NODE_PER_DAY - replaysUsed(key))} replays left` : ''}
              </ActionButton>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

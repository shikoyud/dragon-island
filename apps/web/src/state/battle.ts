import {
  applyTrophies, battlePreview, battleSeed32, createRng, elementMultiplier, LAUNCH_CATALOG, legalMoves, moveUnlocked, nodeTeam, TROPHY, type ActiveTrial, type BattleDragonSpec,
  type BattleEvent, type BattlePreview, type BattleReport, type BattleState, type Catalog, type MoveElement, type MoveTier, type PlayerMove, type TeamIds,
} from '@wyrmhaven/game-core'
import type { ActionResponse, ClientAction, Offer } from '@wyrmhaven/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '../api/ApiProvider'
import { ApiError } from '../api/client'
import { PLAYBACK_STEP_MS, playbackQueue } from '../game/battleModel'
import type { Bridge } from '../game/bridge'
import { useToasts } from '../ui/Toast'
import { useAction } from './actions'
import { ME_KEY, useMe } from './me'

type Setup =
  | { mode: 'pvp'; offer: Offer; team: TeamIds; seed32: number }
  | { mode: 'pve'; trial: ActiveTrial; seed32: number }

export const trialDraftKey = (playerId: string, index: number): string => `dris.trialDraft.${playerId}.${index}`

/** R70, on the confirm of every way out of a Trial. */
export const TRIAL_ABANDON_COST = 'The team falls to 1 HP'

/** What a PvP forfeit costs from `trophies`: never more than the player has (trophies floor at 0). */
export function pvpForfeitCost(trophies: number): string {
  const lost = trophies - applyTrophies(trophies, TROPHY.attackLoss)
  return lost === 0 ? 'It counts as a loss' : `You lose ${lost} ${lost === 1 ? 'trophy' : 'trophies'}`
}

export interface MoveCard {
  name: string
  element: MoveElement
  tier: MoveTier
  /** Against the enemy active's primary element only (§2.3); Physical is always 1x (§6.2). */
  hint: '2x' | '1x' | '0.5x' | 'IMMUNE'
  /** Why it can't be used now, or null. An immune move can: the player may have a reason. */
  disabledReason: string | null
}

/** The move in kit slot `m` of the player's active dragon, as its button shows it. */
export function moveCard(b: BattleState, m: number): MoveCard {
  const me = b.sides.attacker
  const actor = me.team[me.active]!
  const move = actor.moves[m]!
  const foe = b.sides.defender.team[b.sides.defender.active]!
  const mult = elementMultiplier(move.element, foe.species.elements[0]!)
  const disabledReason = !moveUnlocked(move, actor.spec.level) ? `Lv ${move.minLevel}` : move.tier === 3 && actor.t3Cooling ? 'Rests this turn' : null
  return { name: move.name, element: move.element, tier: move.tier, hint: mult === 0 ? 'IMMUNE' : `${mult}x`, disabledReason }
}

/** Storage can throw or come back empty (private windows, blocked site data): a draft is a convenience, never needed. */
function saveDraft(key: string, moves: readonly PlayerMove[]): void {
  try {
    if (moves.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(moves))
  } catch { /* the draft is lost, not the battle */ }
}
export function clearTrialDraft(playerId: string, index: number): void {
  saveDraft(trialDraftKey(playerId, index), [])
}

/** Drops this player's drafts for any Trial but the active one: settled in another tab, or lost with its reply, they can never resume. */
function clearStaleDrafts(playerId: string, activeIndex: number | null): void {
  const keep = activeIndex === null ? null : trialDraftKey(playerId, activeIndex)
  const prefix = trialDraftKey(playerId, 0).slice(0, -1)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix) && key !== keep) localStorage.removeItem(key)
    }
  } catch { /* a draft left behind is dropped next time, or by loadDraft */ }
}

/** How a way out of a fight went. */
export type AbandonOutcome =
  /** The server settled it. */
  | 'settled'
  /** The server says there's nothing left to give up (a 409: the offer expired, the Trial is over). */
  | 'gone'
  /** No answer, or an error that may pass; the fight stands. */
  | 'failed'

/** The draft in storage if `legalMoves` still accepts every move on this seed; anything else is dropped. */
function loadDraft(key: string, trial: ActiveTrial, seed32: number, catalog: Catalog): PlayerMove[] {
  let raw: string | null = null
  try { raw = localStorage.getItem(key) } catch { return [] }
  if (raw === null) return []
  try {
    const moves = JSON.parse(raw) as PlayerMove[]
    if (Array.isArray(moves)) {
      const { done } = battlePreview(trial.specs, nodeTeam(trial.chapter, trial.node, catalog), moves, createRng(seed32), catalog)
      if (!done || done.ok) return moves
    }
  } catch { /* unreadable: dropped below */ }
  saveDraft(key, [])
  return []
}

/**
 * Builds a battle turn by turn on a revealed seed, so the preview is exact (A8). PvP's seed comes with the offer. A Trial is
 * started first, because its seed can be read only once it's frozen (R69); it's played from that snapshot, and its draft
 * stays in storage by player and `active.index`, so a reload can resume. Moves are final: the seed is known, so an undo would
 * replay the future. The result is one object while nothing changes, so a clock tick above it skips the battle screen.
 * Sending and giving up each keep one idempotency key per battle: a try after a lost reply gets that reply. Any refusal refetches
 * `/me`, since the client's picture of this fight was wrong.
 */
export function useBattle(catalog: Catalog = LAUNCH_CATALOG) {
  const me = useMe()
  const api = useApi()
  const toasts = useToasts()
  const qc = useQueryClient()
  const { run, pending, error } = useAction()
  const [setup, setSetup] = useState<Setup | null>(null)
  const [moves, setMoves] = useState<PlayerMove[]>([])
  const [result, setResult] = useState<ActionResponse | null>(null)
  /** Why the server refused the last send; null if it never answered. */
  const [refused, setRefused] = useState<ApiError | null>(null)
  const keys = useRef<{ submit?: string; abandon?: string }>({})
  const state = me.data?.state
  const playerId = me.data?.playerId
  const trophies = state?.trophies ?? 0

  const attackers = useMemo((): BattleDragonSpec[] | null => {
    if (!setup) return null
    if (setup.mode === 'pve') return setup.trial.specs
    if (!state) return null
    const specs: BattleDragonSpec[] = []
    for (const id of setup.team) {
      const d = state.dragons.find(x => x.id === id)
      if (!d) return null
      specs.push({ speciesId: d.speciesId, level: d.level })
    }
    return specs
  }, [setup, state])

  const defenders = useMemo((): BattleDragonSpec[] | null => {
    if (!setup) return null
    return setup.mode === 'pvp' ? [...setup.offer.opponent.team] : nodeTeam(setup.trial.chapter, setup.trial.node, catalog)
  }, [setup, catalog])

  const preview = useMemo((): BattlePreview | null => {
    if (!setup || !attackers || !defenders) return null
    return battlePreview(attackers, defenders, moves, createRng(setup.seed32), catalog)
  }, [setup, attackers, defenders, moves, catalog])

  const draftKey = setup?.mode === 'pve' && playerId ? trialDraftKey(playerId, setup.trial.index) : null
  const activeIndex = state ? state.pve.active?.index ?? null : undefined
  const fightIndex = setup?.mode === 'pve' ? setup.trial.index : null
  useEffect(() => {
    if (draftKey) saveDraft(draftKey, result || activeIndex !== fightIndex ? [] : moves)
  }, [draftKey, moves, result, activeIndex, fightIndex])
  useEffect(() => {
    if (playerId && activeIndex !== undefined) clearStaleDrafts(playerId, activeIndex)
  }, [playerId, activeIndex])

  const begin = useCallback(() => {
    setResult(null)
    setRefused(null)
    keys.current = {}
  }, [])

  const startPvp = useCallback((offer: Offer, team: TeamIds) => {
    setSetup({ mode: 'pvp', offer, team, seed32: battleSeed32(offer.seedHex) })
    setMoves([])
    begin()
  }, [begin])

  /** Reads the revealed seed and enters the Trial, with its draft if one is still good. False if the seed couldn't be read: `/me`'s banner still offers it. */
  const enterTrial = useCallback(async (trial: ActiveTrial, owner: string): Promise<boolean> => {
    try {
      const seed32 = battleSeed32((await api.pveSeed()).seedHex)
      setMoves(loadDraft(trialDraftKey(owner, trial.index), trial, seed32, catalog))
      begin()
      setSetup({ mode: 'pve', trial, seed32 })
      return true
    } catch (e) {
      toasts.error(e)
      return false
    }
  }, [api, catalog, toasts, begin])

  const startTrial = useCallback(async (chapter: number, node: number, team: TeamIds): Promise<boolean> => {
    if (!playerId) return false
    const res = await run({ type: 'startTrial', chapter, node, team })
    const trial = res?.state.pve.active
    return trial ? enterTrial(trial, playerId) : false
  }, [run, enterTrial, playerId])

  const activeTrial = state?.pve.active
  const resumeTrial = useCallback(async (): Promise<boolean> => {
    return activeTrial && playerId ? enterTrial(activeTrial, playerId) : false
  }, [enterTrial, playerId, activeTrial])

  /** What the player may do now: empty once the battle is decided or a move was illegal. */
  const legal = useMemo((): PlayerMove[] => (preview && !preview.done ? legalMoves(preview.state, 'attacker') : []), [preview])

  const choose = useCallback((m: PlayerMove) => { setMoves(prev => [...prev, m]) }, [])
  const reset = useCallback(() => { setSetup(null); setMoves([]); begin() }, [begin])

  /** Runs a battle's action under `key`; a refusal refetches `/me` and comes back as the error. */
  const send = useCallback(async (action: ClientAction, key: string): Promise<{ res: ActionResponse | null; failure: unknown }> => {
    let failure: unknown = null
    const res = await run(action, { key, onError: e => { failure = e } })
    if (failure instanceof ApiError) void qc.invalidateQueries({ queryKey: ME_KEY })
    return { res, failure }
  }, [run, qc])

  const submit = useCallback(async (): Promise<ActionResponse | null> => {
    if (!setup || result) return null
    setRefused(null)
    keys.current.submit ??= crypto.randomUUID()
    const { res, failure } = await send(
      setup.mode === 'pvp' ? { type: 'pvpBattle', offerId: setup.offer.offerId, team: setup.team, moves } : { type: 'finishTrial', moves },
      keys.current.submit,
    )
    if (res) setResult(res)
    if (failure instanceof ApiError) setRefused(failure)
    return res
  }, [setup, moves, send, result])

  /**
   * Gives up: a Trial is abandoned (R70) and its draft dropped; a PvP battle sends the moves so far, which the server settles
   * as a loss with its trophies, and comes back as a result.
   */
  const abandon = useCallback(async (): Promise<AbandonOutcome> => {
    if (!setup || result) return 'failed'
    keys.current.abandon ??= crypto.randomUUID()
    const { res, failure } = await send(
      setup.mode === 'pvp' ? { type: 'pvpBattle', offerId: setup.offer.offerId, team: setup.team, moves } : { type: 'abandonTrial' },
      keys.current.abandon,
    )
    const gone = failure instanceof ApiError && failure.status === 409
    if (!res && !gone) return 'failed'
    if (setup.mode === 'pve' && playerId) clearTrialDraft(playerId, setup.trial.index)
    if (res && setup.mode === 'pvp') setResult(res)
    return gone ? 'gone' : 'settled'
  }, [setup, moves, send, result, playerId])

  return useMemo(() => ({
    setup, moves, preview, legal, result, refused, catalog, trophies,
    exactPreview: true,
    canSubmit: setup !== null && result === null && preview?.done?.ok === true,
    pending,
    error,
    startPvp, startTrial, resumeTrial, choose, reset, submit, abandon,
    report: result?.battle as BattleReport | undefined,
  }), [setup, moves, preview, legal, result, refused, catalog, trophies, pending, error, startPvp, startTrial, resumeTrial, choose, reset, submit, abandon])
}

export type BattleHook = ReturnType<typeof useBattle>

const now = (): number => performance.now()

/**
 * Plays the log out one event at a time: your action at once, the enemy's a step later, and a step after the last before the
 * player can act, so a hit or a KO is seen before what comes next. With reduced motion it all lands at once. When a finished
 * battle has played it sends its action, once. React runs this clock; the scene follows `bridge.battleShown`.
 */
export function useBattlePlayback(battle: BattleHook, bridge: Bridge): { shown: number; busy: boolean; sendFailed: boolean; retry: () => void } {
  const { canSubmit, submit } = battle
  const log = battle.preview?.state.log ?? NO_EVENTS
  const reduced = bridge.reducedMotion
  // A battle opens on what has already happened (a resumed draft), with nothing to replay. The panel lives for one battle.
  const [played, setPlayed] = useState<readonly BattleEvent[]>(log)
  const shown = played.length
  const [idleAt, setIdleAt] = useState(log.length)
  const lastPlay = useRef(-Infinity)

  useEffect(() => {
    const [next] = playbackQueue(played, log)
    if (!next) return
    if (reduced) { setPlayed(log); return }
    const play = () => { lastPlay.current = now(); setPlayed(p => [...p, next]) }
    const wait = lastPlay.current + PLAYBACK_STEP_MS - now()
    if (wait <= 0) { play(); return }
    const t = setTimeout(play, wait)
    return () => clearTimeout(t)
  }, [log, played, reduced])

  useEffect(() => {
    if (shown < log.length || idleAt === log.length) return
    if (reduced) { setIdleAt(log.length); return }
    const t = setTimeout(() => setIdleAt(log.length), Math.max(0, lastPlay.current + PLAYBACK_STEP_MS - now()))
    return () => clearTimeout(t)
  }, [shown, log.length, idleAt, reduced])

  useEffect(() => { bridge.setBattleShown(shown) }, [bridge, shown])

  const busy = shown < log.length || idleAt !== log.length
  const [sendFailed, setSendFailed] = useState(false)
  const sent = useRef(false)
  const send = useCallback(() => {
    setSendFailed(false)
    void submit().then(res => { if (!res) setSendFailed(true) })
  }, [submit])
  useEffect(() => {
    if (busy || !canSubmit || sent.current) return
    sent.current = true
    send()
  }, [busy, canSubmit, send])

  return { shown, busy, sendFailed, retry: send }
}

const NO_EVENTS: readonly BattleEvent[] = []

import {
  battlePreview, battleSeed32, createRng, LAUNCH_CATALOG, legalMoves, nodeTeam, type ActiveTrial, type BattleDragonSpec, type BattlePreview,
  type BattleReport, type Catalog, type PlayerMove, type TeamIds,
} from '@wyrmhaven/game-core'
import type { ActionResponse, Offer } from '@wyrmhaven/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../api/ApiProvider'
import { useToasts } from '../ui/Toast'
import { useAction } from './actions'
import { useMe } from './me'

type Setup =
  | { mode: 'pvp'; offer: Offer; team: TeamIds; seed32: number }
  | { mode: 'pve'; trial: ActiveTrial; seed32: number }

export const trialDraftKey = (playerId: string, index: number): string => `dris.trialDraft.${playerId}.${index}`

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
 * stays in storage by player and `active.index`, so a reload can resume.
 */
export function useBattle(catalog: Catalog = LAUNCH_CATALOG) {
  const me = useMe()
  const api = useApi()
  const toasts = useToasts()
  const action = useAction()
  const [setup, setSetup] = useState<Setup | null>(null)
  const [moves, setMoves] = useState<PlayerMove[]>([])
  const [result, setResult] = useState<ActionResponse | null>(null)
  const state = me.data?.state
  const playerId = me.data?.playerId

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
  useEffect(() => {
    if (draftKey) saveDraft(draftKey, result ? [] : moves)
  }, [draftKey, moves, result])

  const startPvp = useCallback((offer: Offer, team: TeamIds) => {
    setSetup({ mode: 'pvp', offer, team, seed32: battleSeed32(offer.seedHex) })
    setMoves([])
    setResult(null)
  }, [])

  /** Reads the revealed seed and enters the Trial, with its draft if one is still good. False if the seed couldn't be read: `/me`'s banner still offers it. */
  const enterTrial = useCallback(async (trial: ActiveTrial, owner: string): Promise<boolean> => {
    try {
      const seed32 = battleSeed32((await api.pveSeed()).seedHex)
      setMoves(loadDraft(trialDraftKey(owner, trial.index), trial, seed32, catalog))
      setResult(null)
      setSetup({ mode: 'pve', trial, seed32 })
      return true
    } catch (e) {
      toasts.error(e)
      return false
    }
  }, [api, catalog, toasts])

  const startTrial = useCallback(async (chapter: number, node: number, team: TeamIds): Promise<boolean> => {
    if (!playerId) return false
    const res = await action.run({ type: 'startTrial', chapter, node, team })
    const trial = res?.state.pve.active
    return trial ? enterTrial(trial, playerId) : false
  }, [action, enterTrial, playerId])

  const resumeTrial = useCallback(async (): Promise<boolean> => {
    const trial = state?.pve.active
    return trial && playerId ? enterTrial(trial, playerId) : false
  }, [enterTrial, playerId, state])

  /** What the player may do now: empty once the battle is decided or a move was illegal. */
  const legal = useMemo((): PlayerMove[] => (preview && !preview.done ? legalMoves(preview.state, 'attacker') : []), [preview])

  const choose = useCallback((m: PlayerMove) => { setMoves(prev => [...prev, m]) }, [])
  const undo = useCallback(() => setMoves(prev => prev.slice(0, -1)), [])
  const reset = useCallback(() => { setSetup(null); setMoves([]); setResult(null) }, [])

  const submit = useCallback(async (): Promise<ActionResponse | null> => {
    if (!setup || result) return null
    const res = setup.mode === 'pvp'
      ? await action.run({ type: 'pvpBattle', offerId: setup.offer.offerId, team: setup.team, moves })
      : await action.run({ type: 'finishTrial', moves })
    if (res) setResult(res)
    return res
  }, [setup, moves, action, result])

  return {
    setup, moves, preview, legal, result, catalog,
    exactPreview: true,
    canSubmit: setup !== null && result === null && preview?.done?.ok === true,
    canUndo: moves.length > 0 && result === null,
    pending: action.pending,
    error: action.error,
    startPvp, startTrial, resumeTrial, choose, undo, reset, submit,
    report: result?.battle as BattleReport | undefined,
  }
}

export type BattleHook = ReturnType<typeof useBattle>

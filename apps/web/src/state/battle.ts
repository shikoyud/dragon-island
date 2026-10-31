import {
  battlePreview, battleSeed32, createRng, LAUNCH_CATALOG, legalMoves, stageTeam, type BattleDragonSpec, type BattlePreview,
  type BattleReport, type Catalog, type PlayerMove, type TeamIds,
} from '@wyrmhaven/game-core'
import type { ActionResponse, Offer } from '@wyrmhaven/shared'
import { useCallback, useMemo, useState } from 'react'
import { useAction } from './actions'
import { useMe } from './me'

type Setup =
  | { mode: 'pvp'; offer: Offer; team: TeamIds; seed32: number }
  | { mode: 'pve'; stage: number; team: TeamIds; seed32: number }

/**
 * Builds a battle turn by turn. PvP previews are exact (the offer carries the revealed seed); PvE
 * seeds are known only to the server, so that preview is a best guess (`exactPreview === false`).
 */
export function useBattle(catalog: Catalog = LAUNCH_CATALOG) {
  const me = useMe()
  const action = useAction()
  const [setup, setSetup] = useState<Setup | null>(null)
  const [moves, setMoves] = useState<PlayerMove[]>([])
  const [result, setResult] = useState<ActionResponse | null>(null)
  const state = me.data?.state

  const attackers = useMemo((): BattleDragonSpec[] | null => {
    if (!setup || !state) return null
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
    return setup.mode === 'pvp' ? [...setup.offer.opponent.team] : stageTeam(setup.stage, catalog)
  }, [setup, catalog])

  const preview = useMemo((): BattlePreview | null => {
    if (!setup || !attackers || !defenders) return null
    return battlePreview(attackers, defenders, moves, createRng(setup.seed32), catalog)
  }, [setup, attackers, defenders, moves, catalog])

  const startPvp = useCallback((offer: Offer, team: TeamIds) => {
    setSetup({ mode: 'pvp', offer, team, seed32: battleSeed32(offer.seedHex) })
    setMoves([])
    setResult(null)
  }, [])

  const startPve = useCallback((stage: number, team: TeamIds) => {
    setSetup({ mode: 'pve', stage, team, seed32: 0 })
    setMoves([])
    setResult(null)
  }, [])

  /** What the player may do now: empty once the battle is decided or a move was illegal. */
  const legal = useMemo((): PlayerMove[] => (preview && !preview.done ? legalMoves(preview.state, 'attacker') : []), [preview])

  const choose = useCallback((m: PlayerMove) => { setMoves(prev => [...prev, m]) }, [])
  const undo = useCallback(() => setMoves(prev => prev.slice(0, -1)), [])
  const reset = useCallback(() => { setSetup(null); setMoves([]); setResult(null) }, [])

  const submit = useCallback(async (): Promise<ActionResponse | null> => {
    if (!setup || result) return null
    const res = setup.mode === 'pvp'
      ? await action.run({ type: 'pvpBattle', offerId: setup.offer.offerId, team: setup.team, moves })
      : await action.run({ type: 'pveBattle', stage: setup.stage, team: setup.team, moves })
    if (res) setResult(res)
    return res
  }, [setup, moves, action, result])

  return {
    setup, moves, preview, legal, result, catalog,
    exactPreview: setup?.mode === 'pvp',
    // PvE: the server's AI finishes any turns the plan does not cover, so one move is enough to send.
    canSubmit: setup !== null && result === null && (setup.mode === 'pve' ? moves.length > 0 : preview?.done?.ok === true),
    canUndo: moves.length > 0 && result === null,
    pending: action.pending,
    error: action.error,
    startPvp, startPve, choose, undo, reset, submit,
    report: result?.battle as BattleReport | undefined,
  }
}

export type BattleHook = ReturnType<typeof useBattle>

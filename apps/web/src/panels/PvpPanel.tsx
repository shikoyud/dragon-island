import { LAUNCH_CATALOG, PVP_MIN_PLAYER_LEVEL, type TeamIds } from '@wyrmhaven/game-core'
import type { Offer } from '@wyrmhaven/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from '../api/ApiProvider'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { ActionButton, Panel } from '../ui/Panel'

const nameOf = (speciesId: string): string => LAUNCH_CATALOG.species.get(speciesId)?.name ?? speciesId

/** Opponent offers from the server (a new fetch retires the old set), team pick, defence team. */
export function PvpPanel({ onFight, onClose }: { onFight: (offer: Offer, team: TeamIds) => void; onClose?: () => void }) {
  const api = useApi()
  const me = useMe()
  const { run, pending } = useAction()
  const s = me.data?.state
  const [team, setTeam] = useState<string[]>(() => s?.defenceTeam ?? [])
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => api.offers(), enabled: false })
  if (!s) return null
  const locked = s.level < PVP_MIN_PLAYER_LEVEL
  const teamOk = team.length === 3 && new Set(team).size === 3
  const toggle = (id: string) => setTeam(t => (t.includes(id) ? t.filter(x => x !== id) : t.length < 3 ? [...t, id] : t))

  return (
    <Panel title="Arena" onClose={onClose}>
      {locked && <p>PvP unlocks at player level {PVP_MIN_PLAYER_LEVEL}.</p>}
      <fieldset>
        <legend>Attack team (pick 3)</legend>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {s.dragons.map(d => (
            <button key={d.id} type="button" className={`btn ${team.includes(d.id) ? 'btn--primary' : ''}`} aria-pressed={team.includes(d.id)} onClick={() => toggle(d.id)}>
              {nameOf(d.speciesId)} L{d.level}
            </button>
          ))}
        </div>
        <ActionButton id="save-defence" disabled={pending || !teamOk} reason="Pick three different dragons" onClick={() => void run({ type: 'setDefenceTeam', dragonIds: team as TeamIds })}>
          Save as defence team
        </ActionButton>
        {!s.defenceTeam && <p><small>You need a saved defence team before you can attack.</small></p>}
      </fieldset>
      <div style={{ marginTop: 12 }}>
        <ActionButton id="find-opponents" disabled={locked || offers.isFetching} onClick={() => void offers.refetch()}>
          {offers.data ? 'Refresh opponents' : 'Find opponents'}
        </ActionButton>
      </div>
      {offers.data && (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }} aria-label="Opponents">
          {offers.data.offers.map(o => (
            <li key={o.offerId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span>{o.opponent.playerId ? 'Player' : 'Bot'} · Lv {o.opponent.level} · 🏆 {o.opponent.trophies} · {o.opponent.team.map(t => `${nameOf(t.speciesId)} L${t.level}`).join(', ')}</span>
              <ActionButton id={`fight-${o.offerId}`} primary disabled={!teamOk || !s.defenceTeam} reason={!s.defenceTeam ? 'Save a defence team first' : 'Pick three dragons'} onClick={() => onFight(o, team as TeamIds)}>
                Fight
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

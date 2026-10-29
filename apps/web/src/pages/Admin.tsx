import { useEffect, useState, type ReactNode } from 'react'
import { createAdminApi, type AdminApi, type AdminPlayer, type AdminSeasonSummary, type AdminStats } from '../api/admin'
import { ApiError } from '../api/client'
import { formatWei } from '../ui/Money'

const TOKEN_KEY = 'dris.admin'
const JOBS = ['indexer', 'voucherExpiry', 'burnBatch', 'season', 'seasonClose']
const TABS = ['Player', 'Season', 'Inflows', 'Price', 'Beta', 'Jobs'] as const
type Tab = (typeof TABS)[number]

const readToken = (): string => { try { return sessionStorage.getItem(TOKEN_KEY) ?? '' } catch { return '' } }
const saveToken = (t: string) => { try { sessionStorage.setItem(TOKEN_KEY, t) } catch { /* private mode */ } }
const describe = (e: unknown) => (e instanceof ApiError ? `${e.status} ${e.code}` : e instanceof Error ? e.message : String(e))

/**
 * Operator console over the `x-admin-token` routes. The token is typed once per tab and kept in
 * sessionStorage only. Every mutation shows the server's reply or its error code.
 */
export function Admin({ makeApi = token => createAdminApi(import.meta.env.VITE_API_URL ?? '/api', token) }: { makeApi?: (token: string) => AdminApi }) {
  const [token, setToken] = useState(readToken)
  const [draft, setDraft] = useState('')
  if (!token) {
    return (
      <main style={{ padding: 16, maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Dragon Island admin</h1>
        <label>Admin token <input type="password" value={draft} onChange={e => setDraft(e.target.value)} autoComplete="off" /></label>
        <button type="button" className="btn btn--primary" disabled={draft.length < 32} onClick={() => { saveToken(draft); setToken(draft) }}>Unlock</button>
      </main>
    )
  }
  return <Console api={makeApi(token)} onLock={() => { saveToken(''); setToken('') }} />
}

function Console({ api, onLock }: { api: AdminApi; onLock: () => void }) {
  const [tab, setTab] = useState<Tab>('Player')
  return (
    <main style={{ padding: 16, maxWidth: 720 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Dragon Island admin</h1>
        <button type="button" className="btn" onClick={onLock}>Lock</button>
      </header>
      <div role="tablist" className="toolbar" style={{ margin: '8px 0' }}>
        {TABS.map(t => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} className={`btn ${tab === t ? 'btn--primary' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'Player' && <PlayerTab api={api} />}
        {tab === 'Season' && <SeasonTab api={api} />}
        {tab === 'Inflows' && <InflowsTab api={api} />}
        {tab === 'Price' && <PriceTab api={api} />}
        {tab === 'Beta' && <BetaTab api={api} />}
        {tab === 'Jobs' && <JobsTab api={api} />}
      </div>
    </main>
  )
}

/** Runs one admin call and shows its reply or error below the form. */
function useResult() {
  const [out, setOut] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try { setOut({ ok: true, text: JSON.stringify(await fn(), null, 1) }) } catch (e) { setOut({ ok: false, text: describe(e) }) } finally { setBusy(false) }
  }
  const view = out && <pre role={out.ok ? 'status' : 'alert'} style={{ whiteSpace: 'pre-wrap', color: out.ok ? 'inherit' : 'var(--danger)' }}>{out.text}</pre>
  return { run, busy, view }
}

function PlayerTab({ api }: { api: AdminApi }) {
  const [q, setQ] = useState('')
  const [p, setP] = useState<AdminPlayer | null>(null)
  const [reason, setReason] = useState('')
  const r = useResult()
  const fetchPlayer = async () => (/^0x[0-9a-fA-F]{40}$/.test(q.trim()) ? api.playerByAddress(q.trim()) : api.player(q.trim()))
  const lookup = () => r.run(async () => { const res = await fetchPlayer(); setP(res); return { found: res.player.id } })
  /** Runs a ban/unban, then reloads the player so the Banned row reflects it; the reply stays visible. */
  const mutate = (fn: () => Promise<unknown>) => r.run(async () => { const reply = await fn(); setP(await api.player(p!.player.id)); return reply })
  return (
    <section>
      <label>Player id or address <input value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%' }} /></label>
      <button type="button" className="btn btn--primary" disabled={!q.trim() || r.busy} onClick={() => void lookup()}>Look up</button>
      {p && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 12px', marginTop: 8 }}>
          <Row k="Id" v={p.player.id} /><Row k="Address" v={p.player.address} /><Row k="Level / trophies" v={`${p.player.level} / ${p.player.trophies}`} />
          <Row k="Earning unlocked" v={String(p.player.earningUnlocked)} /><Row k="Referrer" v={p.player.referrerId ?? '—'} />
          <Row k="Banned" v={p.player.bannedAt ? `${new Date(p.player.bannedAt).toISOString()} (${p.player.banReason ?? ''})` : 'no'} />
          {p.balance && <>
            <Row k="Balance" v={`${formatWei(BigInt(p.balance.tokenWei))} DRIS`} /><Row k="Deposited / withdrawn" v={`${formatWei(BigInt(p.balance.depositedWei))} / ${formatWei(BigInt(p.balance.withdrawnWei))} DRIS`} />
            <Row k="Spent" v={`${formatWei(BigInt(p.balance.spentWei))} DRIS`} /><Row k="Earned" v={`${formatWei(BigInt(p.balance.earnedWei))} DRIS`} />
          </>}
          <Row k="SP" v={`${p.sp.total} total · ${p.sp.today} today`} />
        </dl>
      )}
      {p && (
        <div style={{ marginTop: 8 }}>
          <label>Reason <input value={reason} onChange={e => setReason(e.target.value)} /></label>
          <button type="button" className="btn btn--danger" disabled={!reason.trim() || r.busy || p.player.bannedAt !== null} onClick={() => void mutate(() => api.ban(p.player.id, reason.trim()))}>Ban</button>
          <button type="button" className="btn" disabled={r.busy || p.player.bannedAt === null} onClick={() => void mutate(() => api.unban(p.player.id))}>Unban</button>
        </div>
      )}
      {r.view}
    </section>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <><dt><small>{k}</small></dt><dd style={{ margin: 0, wordBreak: 'break-all' }}>{v}</dd></>
}

function SeasonTab({ api }: { api: AdminApi }) {
  const [id, setId] = useState('')
  const [s, setS] = useState<AdminSeasonSummary | null>(null)
  const [confirm, setConfirm] = useState(false)
  const r = useResult()
  const n = Number(id)
  const load = () => r.run(async () => { const res = await api.seasonSummary(n); setS(res); return { loaded: res.season.id } })
  /** Runs close/reveal, then refreshes the summary; the reply from the action stays visible. */
  const act = (fn: () => Promise<unknown>) => r.run(async () => { const reply = await fn(); setS(await api.seasonSummary(s!.season.id)); return reply })
  return (
    <section>
      <label>Season id <input value={id} onChange={e => setId(e.target.value)} inputMode="numeric" /></label>
      <button type="button" className="btn btn--primary" disabled={!Number.isInteger(n) || n <= 0 || r.busy} onClick={() => void load()}>Load</button>
      {s && (
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 12px', marginTop: 8 }}>
          <Row k="Window" v={`${new Date(s.season.startsAtMs).toISOString()} → ${new Date(s.season.endsAtMs).toISOString()}`} />
          <Row k="Closed" v={s.closedAt ? new Date(s.closedAt).toISOString() : 'no'} />
          <Row k="Inflows" v={`${formatWei(BigInt(s.inflows.totalWei))} DRIS (${Object.entries(s.inflows.bySource).map(([k, v]) => `${k} ${formatWei(BigInt(v))}`).join(', ')})`} />
          <Row k="Prize pool" v={`${formatWei(BigInt(s.poolWei))} DRIS`} />
          <Row k="Players ranked" v={s.standingsCount} /><Row k="Prizes paid" v={`${formatWei(BigInt(s.prizesPaidWei))} DRIS`} />
          <Row k="Secret" v={s.season.revealedSecret ?? 'not revealed'} />
        </dl>
      )}
      {s && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!confirm
            ? <button type="button" className="btn btn--danger" disabled={r.busy || s.closedAt !== null} onClick={() => setConfirm(true)}>Close now</button>
            : <>
                <span>Credit prizes, reset trophies and reveal the secret for season {s.season.id}?</span>
                <button type="button" className="btn btn--danger" onClick={() => { setConfirm(false); void act(() => api.closeSeason(s.season.id)) }}>Yes, close</button>
                <button type="button" className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              </>}
          <button type="button" className="btn" disabled={r.busy || s.season.revealedSecret !== null} onClick={() => void act(() => api.revealSeason(s.season.id))}>Reveal</button>
        </div>
      )}
      {r.view}
    </section>
  )
}

function InflowsTab({ api }: { api: AdminApi }) {
  const [wei, setWei] = useState('')
  const [ref, setRef] = useState('')
  const r = useResult()
  return (
    <section>
      <p><small>Record a buyback the treasury made (wei of DRIS that entered the vault). Other inflows are recorded automatically.</small></p>
      <label>Amount (wei) <input value={wei} onChange={e => setWei(e.target.value)} inputMode="numeric" /></label>
      <label>Reference (tx hash or date) <input value={ref} onChange={e => setRef(e.target.value)} /></label>
      <button type="button" className="btn btn--primary" disabled={!/^[0-9]+$/.test(wei) || !ref.trim() || r.busy} onClick={() => void r.run(() => api.recordInflow('buyback', wei, ref.trim()))}>Record buyback</button>
      {r.view}
    </section>
  )
}

function PriceTab({ api }: { api: AdminApi }) {
  const [price, setPrice] = useState('')
  const r = useResult()
  return (
    <section>
      <label>Micro-USD per token <input value={price} onChange={e => setPrice(e.target.value)} inputMode="numeric" /></label>
      <p><small>50,000 = $0.05 per DRIS. Used until the pool TWAP exists.</small></p>
      <button type="button" className="btn btn--primary" disabled={!/^[0-9]+$/.test(price) || r.busy} onClick={() => void r.run(() => api.setPrice(price))}>Set price</button>
      {r.view}
    </section>
  )
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
/** One address per line, or a waitlist CSV export (header has a `wallet` column). Blank and malformed cells are skipped. */
export function parseWallets(text: string): string[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const header = lines[0]?.split(',').map(c => c.trim().toLowerCase()) ?? []
  const col = header.indexOf('wallet')
  const cells = col >= 0
    ? lines.slice(1).map(l => (l.split(',')[col] ?? '').trim().replace(/^"|"$/g, ''))
    : lines.flatMap(l => l.split(/[\s,;]+/))
  return [...new Set(cells.filter(c => ADDRESS.test(c)))]
}

function BetaTab({ api }: { api: AdminApi }) {
  const [text, setText] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const r = useResult()
  useEffect(() => { void api.betaCount().then(c => setCount(c.count)).catch(() => undefined) }, [api])
  const wallets = parseWallets(text)
  const submit = () => r.run(async () => {
    let added = 0
    for (let i = 0; i < wallets.length; i += 500) added += (await api.betaAllow(wallets.slice(i, i + 500))).added
    setCount((await api.betaCount()).count)
    return { added }
  })
  return (
    <section>
      <p>{count === null ? 'Loading�' : `${count} wallets allowed`}</p>
      <label>Wallets <textarea value={text} onChange={e => setText(e.target.value)} rows={8} style={{ width: '100%' }} placeholder="One 0x address per line, or paste the waitlist CSV" /></label>
      <p><small>{wallets.length} valid addresses found.</small></p>
      <button type="button" className="btn btn--primary" disabled={wallets.length === 0 || r.busy} onClick={() => void submit()}>Allow wallets</button>
      {r.view}
    </section>
  )
}

function JobsTab({ api }: { api: AdminApi }) {
  const r = useResult()
  const [stats, setStats] = useState<AdminStats | null>(null)
  return (
    <section>
      <div className="toolbar">
        {JOBS.map(j => <button key={j} type="button" className="btn" disabled={r.busy} onClick={() => void r.run(() => api.runJob(j))}>Run {j}</button>)}
        <button type="button" className="btn btn--primary" disabled={r.busy} onClick={() => void r.run(async () => { const s = await api.stats(); setStats(s); return s })}>Stats</button>
      </div>
      {stats && <p>{stats.players} players · {stats.earningUnlocked} unlocked · {stats.banned} banned · {stats.actions24h} actions in 24h · {stats.openVouchers} open vouchers</p>}
      {r.view}
    </section>
  )
}

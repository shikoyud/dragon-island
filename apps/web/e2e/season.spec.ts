import { expect, test } from '@playwright/test'
import { computePrizes, prizePoolWei } from '@wyrmhaven/game-core'
import { ADMIN_TOKEN, grant, openPanel, resetPlayer, SERVER, setServerClock, signIn, TEST_ADDRESS } from './helpers'

const DAY = 86_400_000
const E18 = 10n ** 18n
/** Same as the web's formatWei: whole part grouped, up to 4 fraction digits, trailing zeros trimmed. */
const fmt = (wei: bigint) => {
  const frac = (wei % E18).toString().padStart(18, '0').slice(0, 4).replace(/0+$/, '')
  const whole = (wei / E18).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${whole}.${frac}` : whole
}

test.afterEach(async ({ request }) => { await setServerClock(request, 0) })

test('a season closes: prizes land in the balance and the next season shows the win', async ({ page, request }) => {
  // Season 1: an unlocked player with 300 SP and a vault that kept 1,000 WYRM.
  await resetPlayer(request, {}, { earningUnlocked: true })
  await grant(request, { sp: 300 })
  const inflow = await request.post(`${SERVER}/admin/inflow`, { headers: { 'x-admin-token': ADMIN_TOKEN }, data: { source: 'buyback', wei: (1_000n * E18).toString(), ref: `e2e:${Date.now()}` } })
  expect(inflow.ok(), await inflow.text()).toBe(true)
  const { seasonId } = (await inflow.json()) as { seasonId: number }

  // Fifteen days later the close job runs.
  await setServerClock(request, 15 * DAY)
  const run = await request.post(`${SERVER}/admin/jobs/seasonClose/run`, { headers: { 'x-admin-token': ADMIN_TOKEN } })
  expect(run.ok(), await run.text()).toBe(true)
  expect((await run.json()).result).toHaveLength(1)

  await signIn(page)
  await openPanel(page, 'Season')
  const panel = page.getByRole('region', { name: /^season 2$/i })
  await expect(panel).toBeVisible()
  await expect(panel.getByText(/last season: you won/i)).toContainText('WYRM')
  await expect(panel.getByText(/no one has scored yet/i)).toBeVisible() // season 2 is fresh
  // Earlier specs in the same run (e.g. build.spec's paid construction skip) add store inflows to this
  // season, so the expected prize comes from the season's actual pool and standings, not a constant.
  // With only this spec's 1,000 WYRM: pool 300, tier-200 share 21 + rank 1 of the placement pot (300 x 0.3 x 100/5050) = 22.7821 WYRM.
  const board = await request.get(`${SERVER}/season/${seasonId}/leaderboard`)
  expect(board.ok(), await board.text()).toBe(true)
  const { poolWei, top, closed } = (await board.json()) as { poolWei: string; closed: boolean; top: { playerId: string; address: string; sp: number }[] }
  expect(closed).toBe(true)
  expect(BigInt(poolWei)).toBeGreaterThanOrEqual(prizePoolWei(1_000n * E18)) // our buyback is in the pool
  const mine = top.find(r => r.address.toLowerCase() === TEST_ADDRESS.toLowerCase())!
  expect(mine.sp).toBeGreaterThanOrEqual(300)
  const award = computePrizes(BigInt(poolWei), top.map(r => ({ playerId: r.playerId, sp: r.sp }))).awards.find(a => a.playerId === mine.playerId)!
  expect(award.wei).toBeGreaterThanOrEqual(22_782_178_217_821_782_178n) // never less than this spec's own inflow pays
  await openPanel(page, 'Wallet')
  await expect(page.getByRole('region', { name: /^wallet$/i }).getByText(/game balance/i).first()).toContainText(`${fmt(award.wei)} WYRM`)
})

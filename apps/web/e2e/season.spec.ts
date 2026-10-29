import { expect, test } from '@playwright/test'
import { ADMIN_TOKEN, grant, openPanel, resetPlayer, SERVER, setServerClock, signIn } from './helpers'

const DAY = 86_400_000

test.afterEach(async ({ request }) => { await setServerClock(request, 0) })

test('a season closes: prizes land in the balance and the next season shows the win', async ({ page, request }) => {
  // Season 1: an unlocked player with 300 SP and a vault that kept 1,000 WYRM.
  await resetPlayer(request, {}, { earningUnlocked: true })
  await grant(request, { sp: 300 })
  const inflow = await request.post(`${SERVER}/admin/inflow`, { headers: { 'x-admin-token': ADMIN_TOKEN }, data: { source: 'buyback', wei: (1_000n * 10n ** 18n).toString(), ref: `e2e:${Date.now()}` } })
  expect(inflow.ok(), await inflow.text()).toBe(true)

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
  // Prize = tier-200 share (300 × 0.7 × 0.1 = 21) + rank 1 of the placement pot (300 × 0.3 × 100/5050 ≈ 1.78) ≈ 22.78 WYRM, in the game balance.
  await openPanel(page, 'Wallet')
  await expect(page.getByRole('region', { name: /^wallet$/i }).getByText(/game balance/i).first()).toContainText('22.78')
})

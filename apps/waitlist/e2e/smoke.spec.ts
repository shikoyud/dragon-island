import { expect, test } from '@playwright/test'
import { E2E_CARD_CODE } from './constants'

test('home page shows the hero, nine element icons and the waitlist panel', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('ul.elements li')).toHaveCount(9)
  await expect(page.locator('.waitlist-panel')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Connect X' })).toBeVisible()
})

test('no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Connect X' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('fake X sign-in reaches the tasks step and a task can be opened and confirmed', async ({ page, context }) => {
  // The Open links point at x.com; keep the test offline.
  await context.route(/https:\/\/(x|twitter)\.com\/.*/, (route) => route.abort())
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('link', { name: 'Connect X' }).click()
  await expect(page.getByRole('heading', { name: 'Do the X tasks' })).toBeVisible()
  await expect(page.getByText('@wyrm_tester')).toBeVisible()

  const follow = page.getByTestId('task-follow')
  const confirm = follow.getByRole('button', { name: /Confirm/ })
  await expect(confirm).toBeDisabled()
  await follow.getByRole('link', { name: 'Open' }).click()
  await expect(confirm).toBeDisabled()

  // The browser clock drives the countdown, but the server enforces the 15 s delay on its own real clock,
  // so move the page clock and also let real time pass before confirming.
  await page.clock.fastForward(15_000)
  await expect(confirm).toBeEnabled()
  await page.waitForTimeout(15_500)
  await confirm.click()
  await expect(follow.getByText('Done')).toBeVisible()
  await expect(page.getByText('1 of 4 done')).toBeVisible()
})

test('a joined entrant card page carries the social preview tags', async ({ page }) => {
  await page.goto(`/c/${E2E_CARD_CODE}`)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`/api/card/${E2E_CARD_CODE}\.png$`))
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  const res = await page.request.get(`/api/card/${E2E_CARD_CODE}.png`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
})

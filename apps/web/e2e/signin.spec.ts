import { expect, test } from '@playwright/test'
import { openPanel, resetPlayer, signIn } from './helpers'

test('signs in with the test wallet and shows the starting resources', async ({ page, request }) => {
  await resetPlayer(request)
  await signIn(page, { fresh: true })
  const resources = page.getByRole('status', { name: /resources/i })
  await expect(resources).toContainText('1,000')
  await expect(resources).toContainText('50')
  await expect(page.locator('canvas')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('status', { name: /resources/i })).toBeVisible() // session persisted
  await openPanel(page, 'Wallet') // Settings holds the account and Sign out
  await page.getByRole('button', { name: /sign out/i }).click()
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()
})

test('fits a 360px phone without horizontal scrolling', async ({ page, request }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await resetPlayer(request)
  await signIn(page)
  await expect(page.locator('canvas')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)
})

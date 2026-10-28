import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

test('signs in with the test wallet and shows the starting resources', async ({ page }) => {
  await signIn(page)
  const resources = page.getByRole('status', { name: /resources/i })
  await expect(resources).toContainText('1,000')
  await expect(resources).toContainText('100')
  await expect(page.locator('canvas')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('status', { name: /resources/i })).toBeVisible() // session persisted
  await page.getByRole('button', { name: /sign out/i }).click()
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()
})

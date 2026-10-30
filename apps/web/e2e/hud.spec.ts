import { expect, test, type Page } from '@playwright/test'
import { openPanel, resetPlayer, signIn } from './helpers'

/**
 * The HUD over the full-screen island, at a desktop and a phone size: resources, menus, dialogs, the placement
 * strip with the ghost in view, the attention column and the automatic finish of a ready build.
 */
type B = { state: { constructions: unknown[]; farms: unknown[] } | null; placing: { col: number; row: number; size: number } | null; cellToScreen: ((c: number, r: number) => { x: number; y: number }) | null }
const bridge = <T>(page: Page, fn: (b: B) => T) => page.evaluate(`(${fn.toString()})(window.__bridge)`) as Promise<T>

for (const size of [{ name: 'desktop', width: 1280, height: 720 }, { name: 'phone', width: 390, height: 844 }]) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } })

    test('HUD shows the player, resources and menus over a full-screen island, no horizontal scroll', async ({ page, request }) => {
      await signIn(page)
      await resetPlayer(request, { gold: 5_000, level: 4, xp: 400 })
      await page.reload()
      const canvas = page.locator('.game-canvas canvas')
      await expect(canvas).toHaveCount(1) // StrictMode's discarded first game is gone
      await expect(canvas).toBeVisible()
      const box = (await canvas.boundingBox())!
      expect(box.width).toBe(size.width)
      expect(box.height).toBe(size.height)
      await expect(page.getByLabel('Level 4')).toBeVisible()
      await expect(page.getByRole('progressbar', { name: 'Experience' })).toBeVisible()
      const res = page.getByRole('status', { name: 'Resources' })
      await expect(res.getByLabel('Gold', { exact: true })).toHaveText('5,000')
      await expect(res.getByLabel('Food', { exact: true })).toHaveText('50')
      for (const b of ['Dragons', 'Breed', 'Battle', 'Build', 'Store']) await expect(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: b, exact: true })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Island menu' }).getByRole('button', { name: 'Map', exact: true })).toBeVisible()
      for (const b of ['Hoard', 'Season', 'Ranks', 'Referral']) await expect(page.getByRole('button', { name: b, exact: true })).toHaveCount(0)
      await expect(page.getByRole('complementary', { name: 'Needs attention' }).getByRole('button', { name: /daily quests/i })).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
      await page.screenshot({ path: `test-results/hud-${size.name}.png` })
    })

    test('dialogs open from the HUD and close by button, Escape and scrim; + opens the store', async ({ page, request }) => {
      await signIn(page)
      await resetPlayer(request)
      await page.reload()
      await page.getByRole('button', { name: 'Buy food' }).click()
      const store = page.getByRole('dialog', { name: 'Store' })
      await expect(store).toBeVisible()
      await store.getByRole('button', { name: 'Close' }).click()
      await expect(store).toBeHidden()
      await openPanel(page, 'Dragons')
      await expect(page.getByRole('dialog', { name: 'Dragons' })).toContainText('Level 1')
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await openPanel(page, 'Campaign')
      await expect(page.getByRole('tab', { name: 'Campaign' })).toHaveAttribute('aria-selected', 'true')
      await page.getByTestId('dialog-scrim').click({ position: { x: 5, y: 5 } })
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })

    test('Build places a plot with the ghost on screen above the placement strip', async ({ page, request }) => {
      await signIn(page)
      await resetPlayer(request, { gold: 5_000, level: 3 })
      await page.reload()
      await page.waitForFunction(() => Boolean((window as unknown as { __bridge?: B }).__bridge?.cellToScreen))
      await openPanel(page, 'Build')
      await page.locator('#shop-farm').click()
      const strip = page.getByRole('toolbar', { name: 'Placement' })
      await expect(strip).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Main menu' })).toHaveCount(0)
      const confirm = strip.getByRole('button', { name: 'Confirm' })
      await expect(confirm).toBeEnabled() // opens on a free cell
      // The ghost's footprint is on screen and not under the strip.
      const stripTop = (await strip.boundingBox())!.y
      const ghost = await bridge(page, b => b.cellToScreen!(b.placing!.col, b.placing!.row))
      expect(ghost.x).toBeGreaterThan(0)
      expect(ghost.x).toBeLessThan(size.width)
      expect(ghost.y).toBeGreaterThan(0)
      expect(ghost.y).toBeLessThan(stripTop)
      await confirm.click()
      await expect(strip).toBeHidden()
      await expect.poll(() => bridge(page, b => b.state!.constructions.length)).toBe(1)
      await expect(page.getByRole('complementary', { name: 'Needs attention' })).toContainText(/Building Farm plot 2/)
    })

    test('a build whose timer has run out finishes by itself', async ({ page, request }) => {
      await signIn(page)
      const now = Date.now()
      await resetPlayer(request, { constructions: [{ kind: 'upgrade', building: { type: 'farm', index: 0 }, readyAtMs: now - 1000 }] })
      await page.reload()
      await page.waitForFunction(() => Boolean((window as unknown as { __bridge?: B }).__bridge?.state))
      await expect.poll(() => bridge(page, b => b.state?.constructions.length ?? -1), { timeout: 15_000 }).toBe(0)
    })
  })
}

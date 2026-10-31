import { expect, test, type Page } from '@playwright/test'
import { dismissLevelUp, openPanel, resetPlayer, setServerClock, signIn } from './helpers'

/**
 * The HUD over the full-screen island, at a desktop and a phone size: resources, menus, dialogs, the placement
 * strip with the ghost in view, the attention column and the automatic finish of a ready build.
 */
type B = { state: { constructions: unknown[]; farms: unknown[] } | null; placing: { col: number; row: number; size: number } | null; cellToScreen: ((c: number, r: number) => { x: number; y: number }) | null }
const bridge = <T>(page: Page, fn: (b: B) => T) => page.evaluate(`(${fn.toString()})(window.__bridge)`) as Promise<T>

test('the countdown follows the server clock, not the device', async ({ page, request }) => {
  const days = async () => Number(/(\d+)d /.exec(await page.getByRole('timer', { name: 'Terminal countdown' }).innerText())![1])
  await signIn(page)
  await resetPlayer(request)
  await setServerClock(request, 0)
  await page.reload()
  await expect(page.getByRole('timer', { name: 'Terminal countdown' })).toBeVisible()
  const before = await days()
  try {
    await setServerClock(request, 86_400_000)
    await page.reload()
    await expect(page.getByRole('timer', { name: 'Terminal countdown' })).toBeVisible()
    expect(await days()).toBe(before - 1)
  } finally {
    await setServerClock(request, 0)
  }
})

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
      const bar = page.getByRole('navigation', { name: 'Main menu' })
      for (const b of ['Shop', 'Breed', 'Dragon Book', 'Battle', 'Wings', 'Quests', 'Inbox']) {
        await expect(bar.getByRole('button', { name: b, exact: true })).toBeVisible()
        expect((await bar.getByRole('button', { name: b, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
      for (const b of ['Wings', 'Inbox']) await expect(bar.getByRole('button', { name: b, exact: true })).toBeDisabled()
      await expect(bar.getByRole('button', { name: 'Quests', exact: true })).toBeEnabled()
      await expect(page.getByRole('timer', { name: 'Terminal countdown' })).toContainText(/^(Launch in|Finals lock in) \d+d \d\d:\d\d:\d\d$/)
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
      const store = page.getByRole('dialog', { name: 'Shop' })
      await expect(store).toBeVisible()
      await expect(store.getByRole('tab', { name: 'Store' })).toHaveAttribute('aria-selected', 'true')
      await store.getByRole('button', { name: 'Close' }).click()
      await expect(store).toBeHidden()
      await openPanel(page, 'Dragon Book')
      await expect(page.getByRole('dialog', { name: 'Dragon Book' })).toContainText('found')
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await openPanel(page, 'Campaign')
      await expect(page.getByRole('tab', { name: 'Campaign' })).toHaveAttribute('aria-selected', 'true')
      await page.getByTestId('dialog-scrim').click({ position: { x: 5, y: 5 } })
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })

    test('Shop and Battle tab labels contrast with the tab art; the clock and disabled labels stay readable', async ({ page, request }) => {
      await signIn(page)
      await resetPlayer(request)
      await page.reload()
      const res = page.getByRole('status', { name: 'Resources' })
      await expect(res).toBeVisible()
      // WCAG contrast of the tab's text colour on the centre pixel of its art, both under the tab's brightness filter.
      const contrast = (tab: ReturnType<Page['getByRole']>) => tab.evaluate(async el => {
        const css = getComputedStyle(el)
        const art = /url\("?([^")]+)"?\)/.exec(getComputedStyle(el.closest('.game-root')!).getPropertyValue('--ui-tab'))![1]!
        const img = new Image()
        img.src = art
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const bg = [...ctx.getImageData(img.width >> 1, img.height >> 1, 1, 1).data].slice(0, 3)
        const fg = /rgba?\((\d+), (\d+), (\d+)/.exec(css.color)!.slice(1).map(Number)
        const dim = Number(/brightness\(([\d.]+)\)/.exec(css.filter)?.[1] ?? 1)
        const lum = (c: number[]) => {
          const [r, g, b] = c.map(v => { const x = Math.min(255, v * dim) / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 })
          return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
        }
        const [hi, lo] = [lum(bg), lum(fg)].sort((a, b) => b - a)
        return (hi! + 0.05) / (lo! + 0.05)
      })
      const checkTabs = async (names: string[]) => {
        for (const name of names) {
          const tab = page.getByRole('tab', { name, exact: true })
          await expect(tab).toBeVisible()
          await expect(tab).toHaveText(name)
          expect(await contrast(tab), name).toBeGreaterThanOrEqual(4.5)
        }
      }
      await openPanel(page, 'Shop')
      await checkTabs(['Build', 'Store'])
      await page.keyboard.press('Escape')
      await openPanel(page, 'Campaign')
      await checkTabs(['Campaign', 'Arena'])
      await page.keyboard.press('Escape')

      const clock = page.getByRole('timer', { name: 'Terminal countdown' })
      expect(Number.parseFloat(await clock.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12)
      for (const name of ['Wings', 'Quests', 'Inbox']) {
        const button = page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name, exact: true })
        expect(await button.evaluate(el => getComputedStyle(el).opacity)).toBe('1')
      }
    })

    test('Build places a plot with the ghost on screen above the placement strip', async ({ page, request }) => {
      await signIn(page)
      await resetPlayer(request, { gold: 5_000, level: 3 })
      await page.reload()
      await page.waitForFunction(() => Boolean((window as unknown as { __bridge?: B }).__bridge?.cellToScreen))
      await openPanel(page, 'Shop')
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

    test('a real Bush clear finishing with its panel open closes the dialog and scrim, and the Shop opens with one tap', async ({ page, request }) => {
      test.setTimeout(60_000)
      await signIn(page)
      await resetPlayer(request, { gold: 5_000, level: 3 })
      await page.reload()
      await page.waitForFunction(() => Boolean((window as unknown as { __bridge?: B }).__bridge?.cellToScreen))
      await dismissLevelUp(page)
      const id = await page.evaluate(() => (window as unknown as { __bridge: { state: { islands: { obstacles: { id: string; kind: string }[] } } } }).__bridge.state.islands.obstacles.find(o => o.kind === 'bush')!.id)
      await page.evaluate(i => (window as unknown as { __bridge: { emit(e: unknown): void } }).__bridge.emit({ type: 'select', target: { kind: 'obstacle', id: i } }), id)
      const dialog = page.getByRole('dialog', { name: 'obstacle' })
      await dialog.getByRole('button', { name: /^Clear · / }).click()
      await expect(dialog).toContainText('Clearing')
      // The clear finishes by itself while the panel stays open.
      await expect(dialog).toHaveCount(0, { timeout: 30_000 })
      await expect(page.getByTestId('dialog-scrim')).toHaveCount(0)
      expect(await page.evaluate(i => (window as unknown as { __bridge: { state: { islands: { obstacles: { id: string }[] } } } }).__bridge.state.islands.obstacles.some(o => o.id === i), id)).toBe(false)
      await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'Shop', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Shop' })).toBeVisible()
    })

    test('toasts sit above the bottom menu', async ({ page, request }) => {
      await signIn(page)
      await resetPlayer(request)
      await page.reload()
      const nav = (await page.getByRole('navigation', { name: 'Main menu' }).boundingBox())!
      const toasts = (await page.locator('.toasts').boundingBox())!
      expect(toasts.y + toasts.height).toBeLessThanOrEqual(nav.y)
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

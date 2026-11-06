import { expect, test, type Page } from '@playwright/test'
import { dismissLevelUp, resetPlayer, signIn } from './helpers'

/** Every island in one scene (R99, R100), clicked for real. The scene exposes `islandToScreen` as it does `cellToScreen`. */
type TestBridge = {
  islandToScreen: ((id: string) => { x: number; y: number }) | null
  cellToScreen: ((col: number, row: number) => { x: number; y: number }) | null
  view: string
  state: { islands: { unlocked: string[] } } | null
}
const B = 'window.__bridge'

async function canvasPoint(page: Page, expr: string) {
  const box = (await page.locator('.game-canvas canvas').boundingBox())!
  const p = await page.evaluate(expr) as { x: number; y: number }
  return { x: box.x + p.x, y: box.y + p.y }
}

test.use({ viewport: { width: 1920, height: 1080 } })

test('Home and the locked islands share one scene; a caption buys the Bridge, Go brings the island to the middle, and a pan hands the view back', async ({ page, request }) => {
  await signIn(page)
  await resetPlayer(request, { level: 12, gold: 200_000 })
  await page.reload()
  await page.waitForFunction(() => { const b = (window as unknown as { __bridge?: TestBridge }).__bridge; return Boolean(b?.islandToScreen && b.state) })
  await dismissLevelUp(page)
  // No Map anywhere: the islands are all on the island.
  await expect(page.getByRole('button', { name: 'Map' })).toHaveCount(0)

  // Opened zoomed out: Home and Ember Reach's caption are both on screen.
  for (const id of ['home', 'isle2']) {
    const p = await canvasPoint(page, `${B}.islandToScreen('${id}')`)
    expect(p.x).toBeGreaterThan(0)
    expect(p.x).toBeLessThan(1920)
    expect(p.y).toBeGreaterThan(0)
    expect(p.y).toBeLessThan(1080)
  }

  // A real click on Ember Reach's caption opens it; the Bridge buys it, without a reload it turns into land.
  const caption = await canvasPoint(page, `${B}.islandToScreen('isle2')`)
  await page.mouse.click(caption.x, caption.y)
  const panel = page.getByRole('dialog', { name: 'Ember Reach' })
  await expect(panel).toBeVisible()
  await panel.locator('#bridge-isle2').click()
  await expect(panel.getByRole('button', { name: 'Go to Ember Reach' })).toBeVisible()
  await page.waitForFunction(() => (window as unknown as { __bridge: TestBridge }).__bridge.state!.islands.unlocked.includes('isle2'))

  // Go: the view is Ember Reach and its land is in the middle of the screen.
  await panel.getByRole('button', { name: 'Go to Ember Reach' }).click()
  await expect(panel).toBeHidden()
  expect(await page.evaluate(`${B}.view`)).toBe('isle2')
  const land = await canvasPoint(page, `${B}.islandToScreen('isle2')`)
  expect(Math.abs(land.x - 960)).toBeLessThan(200)
  expect(Math.abs(land.y - 540)).toBeLessThan(250)

  // A real drag back to Home: the view follows the camera.
  const home = await canvasPoint(page, `${B}.islandToScreen('home')`)
  await page.mouse.move(960, 540)
  await page.mouse.down()
  await page.mouse.move(960 + (960 - home.x), 540 + (540 - home.y), { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => page.evaluate(`${B}.view`)).toBe('home')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

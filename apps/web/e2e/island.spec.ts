import { expect, test, type Page } from '@playwright/test'
import { dismissLevelUp, resetPlayer, signIn } from './helpers'

/**
 * The island canvas, clicked for real: the isometric projection, the camera and the placement ghost. The scene exposes
 * `cellToScreen` on the test bridge so a spec can aim at a cell's centre without copying the projection.
 */
type TestBridge = {
  on(type: string, h: (e: unknown) => void): () => void
  cellToScreen: ((col: number, row: number) => { x: number; y: number }) | null
  placing: { col: number; row: number } | null
}
declare global { interface Window { __bridge?: TestBridge; __seen?: unknown[] } }

async function cellPoint(page: Page, col: number, row: number) {
  const box = (await page.locator('.game-canvas canvas').boundingBox())!
  const p = await page.evaluate(([c, r]) => window.__bridge!.cellToScreen!(c!, r!), [col, row])
  return { x: box.x + p.x, y: box.y + p.y }
}

test.beforeEach(async ({ page, request }) => {
  await signIn(page)
  await resetPlayer(request, { gold: 50_000, level: 6 })
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__bridge?.cellToScreen && (window.__bridge as unknown as { state: unknown }).state))
  await dismissLevelUp(page)
  await page.evaluate(() => {
    window.__seen = []
    for (const t of ['cell', 'select']) window.__bridge!.on(t, e => window.__seen!.push(e))
  })
})

test('a click on a cell centre is that cell, and on a building selects it', async ({ page }) => {
  // Free cells of the starting island, then one in the fog: a ghost may go there, red (R58).
  for (const [col, row] of [[14, 14], [23, 23], [20, 14], [9, 19], [2, 16]] as const) {
    const p = await cellPoint(page, col, row)
    await page.evaluate(() => { window.__seen!.length = 0 })
    await page.mouse.click(p.x, p.y)
    await expect.poll(() => page.evaluate(() => window.__seen!)).toContainEqual({ type: 'cell', col, row })
  }
  const h1 = await cellPoint(page, 10, 10)
  await page.mouse.click(h1.x, h1.y)
  await expect.poll(() => page.evaluate(() => window.__seen!)).toContainEqual({ type: 'select', target: { kind: 'habitat', id: 'h1' } })
})

test('clicks still land on the right cell after the page layout shifts the canvas', async ({ page }) => {
  // The canvas moves on the page (something above it grew) without changing size, so Phaser sees no resize.
  await page.evaluate(() => { (document.querySelector('.game-canvas') as HTMLElement).style.transform = 'translate(13px, 37px)' })
  const p = await cellPoint(page, 20, 14)
  await page.mouse.click(p.x, p.y)
  await expect.poll(() => page.evaluate(() => window.__seen!)).toContainEqual({ type: 'cell', col: 20, row: 14 })
})

test('wheel zoom stays anchored on the pointer and a drag pans without a jump', async ({ page }) => {
  const a = await cellPoint(page, 14, 14)
  await page.mouse.move(a.x, a.y)
  await page.mouse.wheel(0, -100)
  await page.mouse.wheel(0, -100)
  await expect.poll(async () => { const b = await cellPoint(page, 14, 14); return Math.hypot(b.x - a.x, b.y - a.y) }).toBeLessThan(10)
  const before = await cellPoint(page, 14, 14)
  await page.mouse.move(before.x, before.y)
  await page.mouse.down()
  await page.mouse.move(before.x + 3, before.y) // under the click threshold: nothing moves yet, but the grab point is kept
  await page.mouse.move(before.x + 20, before.y + 10, { steps: 4 })
  await page.mouse.up()
  const after = await cellPoint(page, 14, 14)
  expect(Math.abs(after.x - before.x - 20)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.y - before.y - 10)).toBeLessThanOrEqual(2)
  // A drag is never a click.
  expect(await page.evaluate(() => window.__seen!.length)).toBe(0)
})

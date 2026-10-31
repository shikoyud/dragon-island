import { expect, test, type Page } from '@playwright/test'
import { dismissLevelUp, resetPlayer, signIn, startingState } from './helpers'

/**
 * The island canvas, clicked for real: the isometric projection, the camera and the placement ghost. The scene exposes
 * `cellToScreen` on the test bridge so a spec can aim at a cell's centre without copying the projection.
 */
type TestBridge = {
  on(type: string, h: (e: unknown) => void): () => void
  emit(e: unknown): void
  cellToScreen: ((col: number, row: number) => { x: number; y: number }) | null
  placing: { col: number; row: number } | null
  view: string
  state: { habitats: { id: string; placement: { island: string; col: number; row: number } }[] } | null
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
  // Free cells of the starting island, clear of its obstacles (R50), then one in the fog, away from any plot sign (a sign's box takes the tap): a ghost may go there, red (R58).
  for (const [col, row] of [[14, 13], [22, 13], [18, 13], [15, 14], [3, 3]] as const) {
    const p = await cellPoint(page, col, row)
    await page.evaluate(() => { window.__seen!.length = 0 })
    await page.mouse.click(p.x, p.y)
    await expect.poll(() => page.evaluate(() => window.__seen!)).toContainEqual({ type: 'cell', col, row })
  }
  const h1 = await cellPoint(page, 15, 10)
  await page.mouse.click(h1.x, h1.y)
  await expect.poll(() => page.evaluate(() => window.__seen!)).toContainEqual({ type: 'select', target: { kind: 'habitat', id: 'h1' } })
})

test('a real click on the starting Farm opens the Farm, not a Bush whose tap box covers it (390x844)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  const farm = { type: 'select', target: { kind: 'farm', plot: 0 } }
  // Zoom 2 is the phone's opening view; the Farm's middle is a drag away, so pan it in first.
  await page.mouse.move(150, 700)
  await page.mouse.down()
  await page.mouse.move(40, 700, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(150)
  for (const zoomOut of [false, true]) {
    if (zoomOut) {
      await page.keyboard.press('Escape') // the Farm panel from the first click
      await page.mouse.move(195, 420)
      await page.mouse.wheel(0, 100)
      await page.waitForTimeout(100)
      await page.mouse.wheel(0, 100)
      await page.waitForTimeout(250)
    }
    await page.evaluate(() => { window.__seen!.length = 0 })
    const p = await cellPoint(page, 22, 9) // the Farm at (21,8) is 3x3: its middle cell
    await page.mouse.click(p.x, p.y)
    await expect.poll(() => page.evaluate(() => window.__seen!), `zoom ${zoomOut ? 1 : 2}`).toContainEqual(farm)
  }
})

test('clicks still land on the right cell after the page layout shifts the canvas', async ({ page }) => {
  // The canvas moves on the page (something above it grew) without changing size, so Phaser sees no resize.
  await page.evaluate(() => { (document.querySelector('.game-canvas') as HTMLElement).style.transform = 'translate(13px, 37px)' })
  const p = await cellPoint(page, 16, 13)
  await page.mouse.click(p.x, p.y)
  await expect.poll(() => page.evaluate(() => window.__seen!)).toContainEqual({ type: 'cell', col: 16, row: 13 })
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

/** A dragon stands on its habitat, so a canvas click lands on the dragon; select the habitat the way the scene would. */
const selectH1 = (page: Page) => page.evaluate(() => window.__bridge!.emit({ type: 'select', target: { kind: 'habitat', id: 'h1' } }))

test('a real drag moves a habitat across a plot border, and Confirm keeps it free', async ({ page }) => {
  // h1 stands at (13, 8). Click it, press Move, then sweep the pointer to a spot whose footprint spans the border at col 16 and row 16.
  const from = await cellPoint(page, 14, 9)
  await selectH1(page)
  await page.getByRole('button', { name: /^move$/i }).click()
  await expect.poll(() => page.evaluate(() => window.__bridge!.placing)).toMatchObject({ col: 13, row: 8 })
  const to = await cellPoint(page, 15, 14) // the pointer holds the footprint's centre: top-left lands on (14, 13)
  await page.mouse.move(from.x, from.y)
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await expect.poll(() => page.evaluate(() => window.__bridge!.placing)).toMatchObject({ col: 14, row: 13 })
  const bar = page.getByRole('toolbar', { name: /placement/i })
  await expect(bar.getByRole('button', { name: 'Confirm' })).toBeEnabled()
  await bar.getByRole('button', { name: 'Confirm' }).click()
  await expect(bar).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.__bridge!.state!.habitats.find(h => h.id === 'h1')!.placement)).toMatchObject({ island: 'home', col: 14, row: 13 })
})

test('Move to Ember Reach switches the view, and Cancel brings it back', async ({ page, request }) => {
  const base = startingState() as { islands: { unlocked: string[]; plots: Record<string, number[]> } }
  await resetPlayer(request, { gold: 50_000, level: 6, islands: { ...base.islands, unlocked: ['home', 'isle2'], plots: { ...base.islands.plots, isle2: [5, 6, 9, 10] } } })
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__bridge?.cellToScreen && window.__bridge.state))
  await dismissLevelUp(page)
  await selectH1(page)
  await page.getByRole('button', { name: /^move$/i }).click()
  const bar = page.getByRole('toolbar', { name: /placement/i })
  await bar.getByRole('button', { name: 'Move to Ember Reach' }).click()
  await expect.poll(() => page.evaluate(() => window.__bridge!.view)).toBe('isle2')
  await bar.getByRole('button', { name: 'Cancel' }).click()
  await expect.poll(() => page.evaluate(() => window.__bridge!.view)).toBe('home')
  // Again, and this time Confirm: the habitat lands on Ember Reach with the view following it.
  await selectH1(page)
  await page.getByRole('button', { name: /^move$/i }).click()
  await bar.getByRole('button', { name: 'Move to Ember Reach' }).click()
  await expect(bar.getByRole('button', { name: 'Confirm' })).toBeEnabled()
  await bar.getByRole('button', { name: 'Confirm' }).click()
  await expect(bar).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.__bridge!.state!.habitats.find(h => h.id === 'h1')!.placement.island)).toBe('isle2')
  expect(await page.evaluate(() => window.__bridge!.view)).toBe('isle2')
})

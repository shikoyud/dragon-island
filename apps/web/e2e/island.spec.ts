import { expect, test, type Page } from '@playwright/test'
import { offeredPlots, ownedPlots, plotOfTile, plotOrigin, TILES_PER_PLOT, type PlayerState } from '@wyrmhaven/game-core'
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
  // Free cells of the starting island, clear of its obstacles (U6), then one on a plot for sale (plot 2), clear of its sign and obstacles (a sign's box takes the tap): a ghost may go there, red (R58). (3, 3) is on a plot not offered, so it is no cell any more.
  for (const [col, row] of [[14, 13], [22, 13], [18, 13], [15, 14], [22, 6]] as const) {
    const p = await cellPoint(page, col, row)
    await page.evaluate(() => { window.__seen!.length = 0 })
    await page.mouse.click(p.x, p.y)
    await expect.poll(() => page.evaluate(() => window.__seen!)).toContainEqual({ type: 'cell', col, row })
  }
  const h1 = await cellPoint(page, 15, 10)
  await page.mouse.click(h1.x, h1.y)
  await expect.poll(() => page.evaluate(() => window.__seen!)).toContainEqual({ type: 'select', target: { kind: 'habitat', id: 'h1' } })
})

test('a real click on the starting Farm opens the Farm, not a Bush whose tap box covers it (390x844)', async ({ page, request }) => {
  // The start no longer keeps Bushes in front of the Farm (U6): lay two there, on the row just below it, so their 44 px boxes cover its middle.
  const start = startingState() as { islands: { obstacles: unknown[] } }
  const bushes = [{ id: 'e2e1', kind: 'bush', island: 'home', col: 22, row: 11 }, { id: 'e2e2', kind: 'bush', island: 'home', col: 23, row: 11 }]
  await resetPlayer(request, { gold: 50_000, level: 6, islands: { ...start.islands, obstacles: [...start.islands.obstacles, ...bushes] } })
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__bridge?.cellToScreen && (window.__bridge as unknown as { state: unknown }).state))
  await dismissLevelUp(page)
  await page.evaluate(() => {
    window.__seen = []
    for (const t of ['cell', 'select']) window.__bridge!.on(t, e => window.__seen!.push(e))
  })
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

/** Press Move on h1, which stands at (13, 8). */
async function moveH1(page: Page) {
  await selectH1(page)
  await page.getByRole('button', { name: /^move$/i }).click()
  await expect.poll(() => page.evaluate(() => window.__bridge!.placing)).toMatchObject({ col: 13, row: 8 })
  return page.getByRole('toolbar', { name: /placement/i })
}
const placing = (page: Page) => page.evaluate(() => { const p = window.__bridge!.placing!; return { col: p.col, row: p.row } })
const h1Placement = (page: Page) => page.evaluate(() => window.__bridge!.state!.habitats.find(h => h.id === 'h1')!.placement)

test('Move: hover does nothing, a tap moves it, and OK is reachable', async ({ page }) => {
  const bar = await moveH1(page)
  // Sweep the mouse over the island with no button: the building stays put.
  for (const [col, row] of [[14, 13], [18, 13], [22, 13], [15, 14]] as const) {
    const p = await cellPoint(page, col, row)
    await page.mouse.move(p.x, p.y, { steps: 6 })
  }
  await page.waitForTimeout(100)
  expect(await placing(page)).toEqual({ col: 13, row: 8 })
  // On to OK, across whatever lies between: still there, and the click lands. A move to where it stands is a free no-op action.
  const ok = bar.getByRole('button', { name: 'OK' })
  const box = (await ok.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
  expect(await placing(page)).toEqual({ col: 13, row: 8 })
  const sent = page.waitForRequest(r => r.url().includes('/actions') && r.method() === 'POST')
  await page.mouse.down()
  await page.mouse.up()
  await sent
  await expect(bar).toBeHidden()
  expect(await h1Placement(page)).toMatchObject({ island: 'home', col: 13, row: 8 })
})

test('Move: a tap on land carries the footprint there, across a plot border, and leaves the camera alone', async ({ page }) => {
  const bar = await moveH1(page)
  const to = await cellPoint(page, 15, 14) // the pointer holds the footprint's centre: top-left lands on (14, 13)
  await page.mouse.click(to.x, to.y)
  await expect.poll(() => placing(page)).toEqual({ col: 14, row: 13 })
  await page.waitForTimeout(100)
  const after = await cellPoint(page, 15, 14)
  expect(Math.hypot(after.x - to.x, after.y - to.y)).toBeLessThan(1)
  await bar.getByRole('button', { name: 'OK' }).click()
  await expect(bar).toBeHidden()
  await expect.poll(() => h1Placement(page)).toMatchObject({ island: 'home', col: 14, row: 13 })
})

test('Move: a drag from the footprint carries it; a drag elsewhere pans', async ({ page }) => {
  await moveH1(page)
  // Grabbed one cell in from the top-left, that cell stays under the pointer.
  const from = await cellPoint(page, 14, 9)
  const to = await cellPoint(page, 15, 14)
  const anchorCell = await cellPoint(page, 20, 20)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => placing(page)).toEqual({ col: 14, row: 13 })
  const still = await cellPoint(page, 20, 20)
  expect(Math.hypot(still.x - anchorCell.x, still.y - anchorCell.y)).toBeLessThan(1)
  // Well away from the footprint, now at (14, 13): a pan, and the ghost keeps its cell.
  const off = await cellPoint(page, 21, 14)
  await page.mouse.move(off.x, off.y)
  await page.mouse.down()
  await page.mouse.move(off.x + 30, off.y + 15, { steps: 6 })
  await page.mouse.up()
  const panned = await cellPoint(page, 21, 14)
  expect(Math.abs(panned.x - off.x - 30)).toBeLessThanOrEqual(2)
  expect(await placing(page)).toEqual({ col: 14, row: 13 })
})

test('Move: a tap on a sign or an obstacle while placing is a cell, not a dialog', async ({ page }) => {
  const selects = () => page.evaluate(() => window.__seen!.filter(e => (e as { type: string }).type === 'select'))
  const state = await page.evaluate(() => window.__bridge!.state as unknown) as PlayerState
  const land = [...ownedPlots(state, 'home'), ...offeredPlots(state, 'home')]
  const obstacle = state.islands.obstacles.find(o => o.island === 'home' && land.includes(plotOfTile(o.col, o.row)!))!
  const plot = plotOrigin(offeredPlots(state, 'home')[0]!)
  const onSign = async () => {
    const p = await cellPoint(page, plot.col + TILES_PER_PLOT / 2, plot.row + TILES_PER_PLOT / 2)
    return { x: p.x, y: p.y - 6 } // inside the sign's box, which stands on that point
  }
  // First, with nothing being placed, each of those taps opens something: so the tap below really lands on it.
  for (const at of [await onSign(), await cellPoint(page, obstacle.col, obstacle.row)]) {
    await page.evaluate(() => { window.__seen!.length = 0 })
    await page.mouse.click(at.x, at.y)
    await expect.poll(selects).toHaveLength(1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  await moveH1(page)
  await page.evaluate(() => { window.__seen!.length = 0 })
  const sign = await onSign()
  await page.mouse.click(sign.x, sign.y)
  await expect.poll(() => placing(page)).not.toEqual({ col: 13, row: 8 })
  const on = await cellPoint(page, obstacle.col, obstacle.row)
  await page.mouse.click(on.x, on.y)
  await expect.poll(() => placing(page)).toEqual({ col: obstacle.col - 1, row: obstacle.row - 1 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await selects()).toEqual([])
})

test('Move: a drag that leaves the land keeps the last good cell, and the next tap still works', async ({ page }) => {
  const bar = await moveH1(page)
  const from = await cellPoint(page, 14, 9)
  const good = await cellPoint(page, 15, 14)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(good.x, good.y, { steps: 6 })
  await expect.poll(() => placing(page)).toEqual({ col: 14, row: 13 })
  // Off the land into the sky at one jump (a slow sweep would cross other land), then over the bar, and let go there.
  await page.mouse.move(4, 360)
  await page.waitForTimeout(50)
  expect(await placing(page)).toEqual({ col: 14, row: 13 })
  const barBox = (await bar.boundingBox())!
  await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2, { steps: 4 })
  await page.mouse.up()
  expect(await placing(page)).toEqual({ col: 14, row: 13 })
  // Nothing is held: a sweep does nothing, and a tap moves it.
  const tap = await cellPoint(page, 21, 14)
  await page.mouse.move(tap.x, tap.y, { steps: 4 })
  expect(await placing(page)).toEqual({ col: 14, row: 13 })
  await page.mouse.click(tap.x, tap.y)
  await expect.poll(() => placing(page)).toEqual({ col: 20, row: 13 })
  // That spot was sky: a tap there is nothing.
  await page.mouse.click(4, 360)
  await page.waitForTimeout(50)
  expect(await placing(page)).toEqual({ col: 20, row: 13 })
})

test('Move: the wheel zooms and leaves the ghost on its cell', async ({ page }) => {
  await moveH1(page)
  const from = await cellPoint(page, 14, 9)
  await page.mouse.move(from.x, from.y)
  await page.mouse.wheel(0, -100)
  await page.waitForTimeout(100)
  expect(await placing(page)).toEqual({ col: 13, row: 8 })
})

test('Move: a wheel mid-drag zooms and moves nothing, also once the press is let go', async ({ page }) => {
  await moveH1(page)
  // A cell other than the one a tap would centre on where it stands, so a stray tap or carry would show.
  const grab = await cellPoint(page, 16, 11)
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 6, grab.y, { steps: 2 }) // past the click threshold, still in that cell
  await page.mouse.wheel(0, -100)
  await page.waitForTimeout(100)
  expect(await placing(page)).toEqual({ col: 13, row: 8 })
  await page.mouse.up()
  await page.waitForTimeout(50)
  expect(await placing(page)).toEqual({ col: 13, row: 8 })
})

test('Move: press, wheel, release is no tap', async ({ page }) => {
  await moveH1(page)
  const grab = await cellPoint(page, 16, 11) // a tap here would centre the footprint on it: (15, 10)
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.wheel(0, -100)
  await page.waitForTimeout(100)
  await page.mouse.up()
  await page.waitForTimeout(50)
  expect(await placing(page)).toEqual({ col: 13, row: 8 })
  // Off the footprint too: no tap.
  const off = await cellPoint(page, 21, 14)
  await page.mouse.move(off.x, off.y)
  await page.mouse.down()
  await page.mouse.wheel(0, 100)
  await page.waitForTimeout(100)
  await page.mouse.up()
  await page.waitForTimeout(50)
  expect(await placing(page)).toEqual({ col: 13, row: 8 })
})

test('Move: while OK is being sent, a tap on the island moves nothing, and Turn is shut', async ({ page }) => {
  const bar = await moveH1(page)
  const to = await cellPoint(page, 15, 14)
  await page.mouse.click(to.x, to.y)
  await expect.poll(() => placing(page)).toEqual({ col: 14, row: 13 })
  // Hold the action's reply back until the taps are done.
  let release = () => {}
  const held = new Promise<void>(r => { release = r })
  await page.route('**/actions', async route => { await held; await route.continue() })
  await bar.getByRole('button', { name: 'OK' }).click()
  await expect(bar.getByRole('button', { name: 'Turn' })).toBeDisabled()
  const other = await cellPoint(page, 21, 14)
  await page.mouse.click(other.x, other.y)
  const own = await cellPoint(page, 15, 14)
  await page.mouse.move(own.x, own.y)
  await page.mouse.down()
  await page.mouse.move(other.x, other.y, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(50)
  expect(await placing(page)).toEqual({ col: 14, row: 13 })
  release()
  await expect(bar).toBeHidden()
  await expect.poll(() => h1Placement(page)).toMatchObject({ island: 'home', col: 14, row: 13 })
})

test('Move, OK and Cancel keep the zoom and the view', async ({ page }) => {
  const mark = async () => { const a = await cellPoint(page, 18, 13); const b = await cellPoint(page, 19, 13); return { a, cell: b.x - a.x } }
  // Zoom in, on a spot that keeps h1 on screen.
  const h1 = await cellPoint(page, 15, 12)
  await page.mouse.move(h1.x, h1.y)
  await page.mouse.wheel(0, -100)
  await page.waitForTimeout(150)
  const before = await mark()
  const bar = await moveH1(page)
  await page.waitForTimeout(200)
  const moving = await mark()
  expect(moving.cell).toBe(before.cell)
  expect(Math.hypot(moving.a.x - before.a.x, moving.a.y - before.a.y)).toBeLessThan(1)
  await bar.getByRole('button', { name: 'Cancel' }).click()
  await expect(bar).toBeHidden()
  await page.waitForTimeout(200)
  const after = await mark()
  expect(after.cell).toBe(before.cell)
  expect(Math.hypot(after.a.x - before.a.x, after.a.y - before.a.y)).toBeLessThan(1)
})

test('Move: Cancel leaves the building where it was', async ({ page }) => {
  const bar = await moveH1(page)
  const to = await cellPoint(page, 15, 14)
  await page.mouse.click(to.x, to.y)
  await expect.poll(() => placing(page)).toEqual({ col: 14, row: 13 })
  await bar.getByRole('button', { name: 'Cancel' }).click()
  await expect(bar).toBeHidden()
  expect(await page.evaluate(() => window.__bridge!.placing)).toBeNull()
  expect(await h1Placement(page)).toMatchObject({ island: 'home', col: 13, row: 8 })
})

test('Move: Cancel and OK are round buttons at the bottom centre with the ghost clear of them', async ({ page }) => {
  for (const size of [{ width: 1920, height: 1080, plate: 64 }, { width: 844, height: 390, plate: 56 }]) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.waitForTimeout(300)
    if (!(await page.evaluate(() => window.__bridge!.placing))) await moveH1(page)
    const bar = page.getByRole('toolbar', { name: /placement/i })
    const cancel = (await bar.getByRole('button', { name: 'Cancel' }).boundingBox())!
    const ok = (await bar.getByRole('button', { name: 'OK' }).boundingBox())!
    expect(cancel.y + cancel.height).toBeLessThanOrEqual(size.height)
    expect(ok.y + ok.height).toBeLessThanOrEqual(size.height)
    expect(cancel.x + cancel.width).toBeLessThanOrEqual(ok.x)
    expect(Math.abs((cancel.x + ok.x + ok.width) / 2 - size.width / 2)).toBeLessThanOrEqual(2)
    expect(await bar.locator('.placement-go__plate').first().evaluate(el => el.getBoundingClientRect().width)).toBe(size.plate)
    // The ghost's footprint stands above the bar.
    const barTop = (await bar.boundingBox())!.y
    const p = await cellPoint(page, 13 + 4, 8 + 4)
    expect(p.y).toBeLessThan(barTop)
  }
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
  // Again, and this time OK: the habitat lands on Ember Reach with the view following it.
  await selectH1(page)
  await page.getByRole('button', { name: /^move$/i }).click()
  await bar.getByRole('button', { name: 'Move to Ember Reach' }).click()
  await expect(bar.getByRole('button', { name: 'OK' })).toBeEnabled()
  await bar.getByRole('button', { name: 'OK' }).click()
  await expect(bar).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.__bridge!.state!.habitats.find(h => h.id === 'h1')!.placement.island)).toBe('isle2')
  expect(await page.evaluate(() => window.__bridge!.view)).toBe('isle2')
})

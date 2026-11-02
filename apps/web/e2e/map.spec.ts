import { expect, test, type Page } from '@playwright/test'
import { dismissLevelUp, openPanel, resetPlayer, signIn } from './helpers'

/** The Map canvas, clicked for real (§5.5, R60). The scene exposes `mapIslandToScreen` as the island scene does `cellToScreen`. */
type TestBridge = {
  on(type: string, h: (e: unknown) => void): () => void
  cellToScreen: ((col: number, row: number) => { x: number; y: number }) | null
  mapIslandToScreen: ((id: string) => { x: number; y: number }) | null
  mapOpen: boolean
  view: string
  state: { islands: { unlocked: string[] } } | null
}
const W = () => (window as unknown as { __bridge: TestBridge }).__bridge

const canvasBox = async (page: Page) => (await page.locator('.game-canvas canvas').boundingBox())!

async function islandPoint(page: Page, id: string) {
  const box = await canvasBox(page)
  const p = await page.evaluate(i => (window as unknown as { __bridge: TestBridge }).__bridge.mapIslandToScreen!(i), id)
  return { x: box.x + p.x, y: box.y + p.y }
}

async function cellPoint(page: Page, col: number, row: number) {
  const box = await canvasBox(page)
  const p = await page.evaluate(([c, r]) => (window as unknown as { __bridge: TestBridge }).__bridge.cellToScreen!(c!, r!), [col, row])
  return { x: box.x + p.x, y: box.y + p.y }
}

async function load(page: Page, request: Parameters<typeof resetPlayer>[0], extra: Record<string, unknown>) {
  await signIn(page)
  await resetPlayer(request, extra)
  await page.reload()
  await page.waitForFunction(() => { const b = (window as unknown as { __bridge?: TestBridge }).__bridge; return Boolean(b?.cellToScreen && b.state) })
  await dismissLevelUp(page)
}

const openMap = async (page: Page) => {
  await openPanel(page, 'Map')
  await page.waitForFunction(() => { const b = (window as unknown as { __bridge: TestBridge }).__bridge; return b.mapOpen && Boolean(b.mapIslandToScreen) })
  // The scene comes up on the next frame, and re-centres when it does.
  await page.waitForTimeout(150)
}

test('open the Map, drag, zoom, click Ember Reach, buy its Bridge, Go, and stand on it', async ({ page, request }) => {
  await load(page, request, { level: 12, gold: 200_000 })
  await openMap(page)

  // A real drag pans, and it is no click: no panel opens.
  const a = await islandPoint(page, 'home')
  const start = { x: a.x + 300, y: a.y - 200 } // open water beside the chain
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 30, start.y + 60, { steps: 5 })
  await page.mouse.up()
  const b = await islandPoint(page, 'home')
  expect(Math.round(b.y - a.y)).toBe(60)
  await expect(page.getByTestId('dialog-scrim')).toBeHidden()

  // The wheel zooms by whole numbers, about the pointer.
  await page.mouse.move(b.x, b.y)
  await page.mouse.wheel(0, -100)
  await expect.poll(async () => { const c = await islandPoint(page, 'isle2'); const d = await islandPoint(page, 'home'); return Math.round(d.y - c.y) }).toBe(600)
  await page.mouse.wheel(0, 100)
  await expect.poll(async () => { const c = await islandPoint(page, 'isle2'); const d = await islandPoint(page, 'home'); return Math.round(d.y - c.y) }).toBe(300)

  // Open water does nothing.
  const home = await islandPoint(page, 'home')
  await page.mouse.click(home.x + 300, home.y)
  await expect(page.getByTestId('dialog-scrim')).toBeHidden()

  // A real click on Ember Reach opens its panel. Its plots are on screen after the pan above.
  const isle2 = await islandPoint(page, 'isle2')
  await page.mouse.click(isle2.x, isle2.y)
  const panel = page.getByRole('dialog', { name: 'Ember Reach' })
  await panel.getByRole('button', { name: /Bridge · 150,000 gold/ }).click()
  const go = panel.getByRole('button', { name: 'Go to Ember Reach' })
  await expect(go).toBeVisible()
  await expect(panel).toContainText('4 / 16 plots')
  await go.click()

  // Back on the island, it's Ember Reach: the Map is closed, a real click reaches a plot sign on the island's own land.
  await expect(panel).toBeHidden()
  await expect.poll(() => page.evaluate(() => { const br = (window as unknown as { __bridge: TestBridge }).__bridge; return [br.mapOpen, br.view] })).toEqual([false, 'isle2'])
  await page.waitForTimeout(300)
  // Plot 4 touches the centre 2x2 on its left: its sign stands on the cell by the plot's centre (R58, `signSpot`), or a tap there opens it as bare ground for sale.
  const sign = await cellPoint(page, 3, 11)
  await page.mouse.click(sign.x, sign.y)
  await expect(page.getByRole('dialog', { name: 'plot' })).toContainText(/Buy plot · 100,000 gold/)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('dialog-scrim')).toBeHidden()
})

test('Escape and the scrim close the island panel to the Map; the Map button and Escape close the Map; Shop closes it too', async ({ page, request }) => {
  await load(page, request, { level: 5, gold: 1_000 })
  await openMap(page)
  const list = page.getByRole('navigation', { name: 'Islands' })
  // The list is out of sight until focused: the keyboard is how it's used.
  const homeButton = list.getByRole('button', { name: /Home Isle/ })
  await homeButton.focus()
  await page.keyboard.press('Enter')
  const panel = page.getByRole('dialog', { name: 'Home Isle' })
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __bridge: TestBridge }).__bridge.mapOpen)).toBe(true)

  await homeButton.focus()
  await page.keyboard.press('Enter')
  await page.getByTestId('dialog-scrim').click({ position: { x: 5, y: 200 } })
  await expect(panel).toBeHidden()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __bridge: TestBridge }).__bridge.mapOpen)).toBe(true)

  // Go on the island you're on just closes the Map.
  const home = await islandPoint(page, 'home')
  await page.mouse.click(home.x, home.y)
  await panel.getByRole('button', { name: 'Go to Home Isle' }).click()
  await expect.poll(() => page.evaluate(() => { const b = (window as unknown as { __bridge: TestBridge }).__bridge; return [b.mapOpen, b.view] })).toEqual([false, 'home'])

  await page.getByRole('navigation', { name: 'Island menu' }).getByRole('button', { name: 'Map', exact: true }).click()
  await expect(list).toBeAttached()
  await page.keyboard.press('Escape')
  await expect(list).not.toBeAttached()

  await page.getByRole('navigation', { name: 'Island menu' }).getByRole('button', { name: 'Map', exact: true }).click()
  await expect(list).toBeAttached()
  await page.getByRole('navigation', { name: 'Island menu' }).getByRole('button', { name: 'Map', exact: true }).click()
  await expect(list).not.toBeAttached()

  // Shop from the Map closes the Map's scene: anything placed from it goes on the island.
  await page.getByRole('navigation', { name: 'Island menu' }).getByRole('button', { name: 'Map', exact: true }).click()
  await expect(list).toBeAttached()
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'Shop', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Shop' })).toBeVisible()
  await expect(list).not.toBeAttached()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __bridge: TestBridge }).__bridge.mapOpen)).toBe(false)
})

test('on a phone the focused island list sits clear of the pills and the clock', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await load(page, request, { level: 5, gold: 1_000 })
  await openMap(page)
  await page.getByRole('navigation', { name: 'Islands' }).getByRole('button', { name: /Home Isle/ }).focus()
  const list = (await page.getByRole('navigation', { name: 'Islands' }).boundingBox())!
  const pills = (await page.getByRole('status', { name: 'Resources' }).boundingBox())!
  const clock = (await page.getByRole('timer', { name: 'Terminal countdown' }).boundingBox())!
  expect(list.y).toBeGreaterThanOrEqual(pills.y + pills.height)
  expect(list.y).toBeGreaterThanOrEqual(clock.y + clock.height)
  expect(list.x + list.width).toBeLessThanOrEqual(390)
})

test('coming back from the Map, the island\'s camera is where it was and its land is baked, even after a lost context', async ({ page, request }) => {
  await load(page, request, { level: 6, gold: 50_000 })
  const grass = async () => {
    const png = (await page.screenshot()).toString('base64')
    return page.evaluate(async b64 => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const d = g.getImageData(Math.floor(img.width / 4), Math.floor(img.height / 3), Math.floor(img.width / 2), Math.floor(img.height / 3)).data
      let n = 0
      for (let i = 0; i < d.length; i += 4) if (d[i + 1]! > d[i]! + 40 && d[i + 1]! > d[i + 2]! + 40) n++
      return n / (d.length / 4)
    }, png)
  }
  // Pan the island a little, so "where it was" isn't the opening view.
  const box = await canvasBox(page)
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(mid.x, mid.y)
  await page.mouse.down()
  await page.mouse.move(mid.x + 40, mid.y + 20, { steps: 4 })
  await page.mouse.up()
  const cellBefore = await cellPoint(page, 16, 16)
  await page.waitForTimeout(500)
  const before = await grass()
  expect(before).toBeGreaterThan(0.05)

  await openMap(page)
  // The context goes and comes back while the island sleeps.
  const cycled = await page.evaluate(async () => {
    const canvas = document.querySelector('.game-canvas canvas') as HTMLCanvasElement
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    const ext = gl?.getExtension('WEBGL_lose_context')
    if (!ext) return false
    ext.loseContext()
    await new Promise(r => setTimeout(r, 400))
    ext.restoreContext()
    await new Promise(r => setTimeout(r, 1200))
    return true
  })
  expect(cycled).toBe(true)

  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __bridge: TestBridge }).__bridge.mapOpen)).toBe(false)
  await page.waitForTimeout(800)
  const cellAfter = await cellPoint(page, 16, 16)
  expect(cellAfter).toEqual(cellBefore)
  expect(await grass()).toBeGreaterThan(before * 0.7)
})

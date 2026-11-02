import { expect, test, type Page } from '@playwright/test'
import { dismissLevelUp, resetPlayer, signIn } from './helpers'

/**
 * Home's ground is baked into one canvas texture. A lost WebGL context empties it, and only a re-bake on Phaser's
 * restore event brings the land back (without the hook the sky shows alone).
 */

/** Share of the pixels in the middle of the screenshot that are grass green. */
async function grassShare(page: Page): Promise<number> {
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
    const w = Math.floor(img.width / 2)
    const h = Math.floor(img.height / 3)
    const d = g.getImageData(Math.floor(img.width / 4), Math.floor(img.height / 3), w, h).data
    let grass = 0
    for (let i = 0; i < d.length; i += 4) if (d[i + 1]! > d[i]! + 40 && d[i + 1]! > d[i + 2]! + 40) grass++
    return grass / (d.length / 4)
  }, png)
}

test('the baked ground comes back after the WebGL context is lost and restored', async ({ page, request }) => {
  await signIn(page)
  await resetPlayer(request, { gold: 50_000, level: 6 })
  await page.reload()
  await page.waitForFunction(() => Boolean((window as unknown as { __bridge?: { cellToScreen: unknown; state: unknown } }).__bridge?.cellToScreen && (window as unknown as { __bridge?: { state: unknown } }).__bridge?.state))
  await dismissLevelUp(page)
  await page.waitForTimeout(1000)
  const before = await grassShare(page)
  expect(before).toBeGreaterThan(0.05)
  const cycled = await page.evaluate(async () => {
    const canvas = document.querySelector('.game-canvas canvas') as HTMLCanvasElement
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    const ext = gl?.getExtension('WEBGL_lose_context')
    if (!ext) return false
    ext.loseContext()
    await new Promise(r => setTimeout(r, 500))
    ext.restoreContext()
    await new Promise(r => setTimeout(r, 1500))
    return true
  })
  expect(cycled).toBe(true)
  expect(await grassShare(page)).toBeGreaterThan(before * 0.7)
})

import { expect, test } from '@playwright/test'
import { expectPixelFonts } from './helpers'

/** The UI kit gallery (#/kit): fonts, the square close button, a frame whose body scrolls under its plank, focus rings. */
for (const v of [{ name: '1920', width: 1920, height: 1080 }, { name: '844', width: 844, height: 390 }]) {
  test.describe(v.name, () => {
    test.use({ viewport: { width: v.width, height: v.height } })

    test('kit gallery: pixel fonts, square buttons, scrolling body under the plank, visible focus', async ({ page }) => {
      await page.goto('/#/kit')
      await expect(page.locator('.kit-gallery')).toBeVisible()
      await expectPixelFonts(page)

      for (const name of ['Close', 'Back', 'Help']) {
        const box = (await page.locator('.kit-gallery__row').getByRole('button', { name, exact: true }).first().boundingBox())!
        expect(Math.round(box.width), name).toBe(Math.round(box.height))
      }

      const short = page.locator('.kit-gallery__short .kit-frame')
      await short.scrollIntoViewIfNeeded()
      const body = short.locator('.kit-frame__body')
      expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
      await body.evaluate(el => { el.scrollTop = el.scrollHeight })
      const plank = short.locator('.kit-plank')
      await expect(plank).toBeInViewport()
      await expect(short.getByRole('button', { name: 'Close' })).toBeInViewport()
      expect(await plank.evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === 'ellipsis')).toBe(true)

      const first = page.locator('.kit-pill').first()
      await first.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      expect(await first.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid')

      if (process.env.KIT_SHOTS) await page.screenshot({ path: `${process.env.KIT_SHOTS}/ui-p2-kit-${v.name}.png`, fullPage: true })
    })
  })
}

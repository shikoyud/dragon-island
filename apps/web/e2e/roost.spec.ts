import { expect, test, type Page } from '@playwright/test'
import { resetPlayer, signIn } from './helpers'

type TestBridge = {
  emit(e: unknown): void
  state: { constructions: unknown[]; gold: number; roostTier: number; roostPlacement: unknown } | null
}
const bridge = <T>(page: Page, fn: (b: TestBridge) => T) =>
  page.evaluate(`(${fn.toString()})(window.__bridge)`) as Promise<T>

const ready = async (page: Page) => {
  await page.reload()
  await page.waitForFunction(() => Boolean((window as unknown as { __bridge?: { state: unknown } }).__bridge?.state))
}

test('builds the Roost, skips the build, reads its tier, then Ascends through the paid path', async ({ page, request }) => {
  await signIn(page)
  await resetPlayer(request, { gold: 20_000, level: 5, xp: 0 }, { tokenWei: (100n * 10n ** 18n).toString() })
  await ready(page)

  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'Shop', exact: true }).click()
  await page.locator('#shop-roost').click()
  await bridge(page, b => b.emit({ type: 'cell', col: 7, row: 7 }))
  const placement = page.getByRole('toolbar', { name: /placement/i })
  await placement.getByRole('button', { name: /confirm/i }).click()
  await expect(placement).toBeHidden()
  await expect.poll(() => bridge(page, b => b.state!.constructions.length)).toBe(1)
  expect(await bridge(page, b => b.state!.roostTier)).toBe(0)

  await bridge(page, b => b.emit({ type: 'select', target: { kind: 'roost' } }))
  const roost = page.getByRole('region', { name: /dragon roost/i })
  await roost.locator('#skip-construction-roost').click()
  await expect.poll(() => bridge(page, b => b.state!.roostTier)).toBe(1)
  await expect(roost.getByText('Tier 1 · cap 10')).toBeVisible()

  // Ascension: Tier 4 at PL 30 with the Gold; the $2.00 is charged in the same action.
  const at = { island: 'home', col: 7, row: 7, facing: 0 }
  await resetPlayer(request, { gold: 10_000_000, level: 30, xp: 0, roostTier: 4, roostPlacement: at }, { tokenWei: (100n * 10n ** 18n).toString() })
  await ready(page)
  await bridge(page, b => b.emit({ type: 'select', target: { kind: 'roost' } }))
  const panel = page.getByRole('region', { name: /dragon roost/i })
  await expect(panel).toContainText('10,000,000 gold + $2.00')
  await panel.locator('#ascend-roost').click()
  await expect.poll(() => bridge(page, b => b.state!.gold)).toBe(0)
  await expect.poll(() => bridge(page, b => b.state!.constructions.length)).toBe(1)
  await expect(panel.getByText(/Upgrading to Tier 5/)).toBeVisible()
})

import { expect, test, type Page } from '@playwright/test'
import { openInfo, openPanel, resetPlayer, signIn } from './helpers'

/**
 * The Phaser canvas is not pixel-clicked: with the test wallet the app exposes its bridge as `window.__bridge`,
 * and the specs emit the same events the island scene emits on a click (`cell`, `select`). Everything else
 * (Build shop, placement bar, panels, the store charge path) is driven through the real DOM.
 */
type TestBridge = {
  emit(e: unknown): void
  state: { constructions: { kind: string }[]; farms: unknown[]; habitats: { id: string; level: number; placement: { col: number; row: number; facing: number } }[]; gold: number } | null
}
const bridge = <T>(page: Page, fn: (b: TestBridge) => T) =>
  page.evaluate(`(${fn.toString()})(window.__bridge)`) as Promise<T>

test('builds, skips, upgrades, moves and turns a building, and the map shows Ember Reach locked', async ({ page, request }) => {
  await signIn(page)
  // Gold for a plot and an upgrade, level 5, and game balance for the paid skips.
  await resetPlayer(request, { gold: 50_000, level: 5, xp: 0 }, { tokenWei: (100n * 10n ** 18n).toString() })
  await page.reload()
  await expect(page.getByRole('status', { name: /resources/i })).toContainText('50,000')
  await page.waitForFunction(() => Boolean((window as unknown as { __bridge?: { state: unknown } }).__bridge?.state))

  // Shop (Build tab) -> Farm plot -> ghost on the free cell (20,16) -> OK.
  await openPanel(page, 'Shop')
  await page.locator('#shop-farm').click()
  await bridge(page, b => b.emit({ type: 'cell', col: 20, row: 16 }))
  const placement = page.getByRole('toolbar', { name: /placement/i })
  await expect(placement.getByRole('button', { name: 'OK' })).toBeEnabled()
  await placement.getByRole('button', { name: 'OK' }).click()
  await expect(placement).toBeHidden()

  // The construction badge: the scene draws it from the state's construction; the plot's panel shows the same timer.
  await expect.poll(() => bridge(page, b => b.state!.constructions.length)).toBe(1)
  await openInfo(page, { kind: 'farm', plot: 1 })
  const farm = page.getByRole('region', { name: /farm/i })
  await expect(farm.getByText(/^Building · /)).toBeVisible()

  // Skip through the store charge path (a micro-USD price paid from the game balance).
  await farm.locator('#skip-construction-farm-1').click()
  await expect.poll(() => bridge(page, b => b.state!.constructions.length)).toBe(0)
  await expect.poll(() => bridge(page, b => b.state!.farms.length)).toBe(2)

  // Upgrade h1.
  await openInfo(page, { kind: 'habitat', id: 'h1' })
  const habitat = page.getByRole('region', { name: /terra habitat h1/i })
  await habitat.locator('#upgrade-h1').click()
  await expect(habitat.getByText(/^Upgrading to 2 · /)).toBeVisible()
  await expect.poll(() => bridge(page, b => b.state!.constructions.length)).toBe(1)

  // Move h1 to open land: (8,8) -> (13,12). Its neighbours box it in where it stands.
  await habitat.getByRole('button', { name: /^move$/i }).click()
  await bridge(page, b => b.emit({ type: 'cell', col: 13, row: 12 }))
  await expect(placement.getByRole('button', { name: 'OK' })).toBeEnabled()
  await placement.getByRole('button', { name: 'OK' }).click()
  await expect(placement).toBeHidden()
  await expect.poll(() => bridge(page, b => b.state!.habitats.find(h => h.id === 'h1')!.placement.row)).toBe(12)

  // Turn it.
  await openInfo(page, { kind: 'habitat', id: 'h1' })
  await page.getByRole('region', { name: /terra habitat h1/i }).getByRole('button', { name: /^turn$/i }).click()
  await expect.poll(() => bridge(page, b => b.state!.habitats.find(h => h.id === 'h1')!.placement.facing)).toBe(1)

  // The island map: at level 5 every Bridge is still shut, each with its reason.
  await openPanel(page, 'Map')
  const islands = page.getByRole('navigation', { name: 'Islands' })
  await islands.getByRole('button', { name: /Ember Reach/ }).focus()
  await page.keyboard.press('Enter')
  const ember = page.getByRole('dialog', { name: 'Ember Reach' })
  await expect(ember.locator('#bridge-isle2')).toBeDisabled()
  await expect(ember.getByRole('button', { name: /go to ember reach/i })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await islands.getByRole('button', { name: /Frostspire/ }).focus()
  await page.keyboard.press('Enter')
  const frost = page.getByRole('dialog', { name: 'Frostspire' })
  await expect(frost.locator('#bridge-isle3')).toBeDisabled()
  await expect(frost).toContainText('Needs the Bridge to Ember Reach')
})

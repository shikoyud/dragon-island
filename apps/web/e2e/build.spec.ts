import { expect, test, type Page } from '@playwright/test'
import { openPanel, resetPlayer, signIn } from './helpers'

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

test('builds, skips, upgrades, moves and turns a building, and the map shows isle2 locked', async ({ page, request }) => {
  await signIn(page)
  // Gold for a plot and an upgrade, level 5, and game balance for the paid skips.
  await resetPlayer(request, { gold: 50_000, level: 5, xp: 0 }, { tokenWei: (100n * 10n ** 18n).toString() })
  await page.reload()
  await expect(page.getByRole('status', { name: /resources/i })).toContainText('50,000')
  await page.waitForFunction(() => Boolean((window as unknown as { __bridge?: { state: unknown } }).__bridge?.state))

  // Build -> Farm plot -> ghost on the free cell (6,8) -> Confirm.
  await openPanel(page, 'Build')
  await page.locator('#shop-farm').click()
  await bridge(page, b => b.emit({ type: 'cell', col: 6, row: 8 }))
  const placement = page.getByRole('toolbar', { name: /placement/i })
  await expect(placement.getByRole('button', { name: /confirm/i })).toBeEnabled()
  await placement.getByRole('button', { name: /confirm/i }).click()
  await expect(placement).toBeHidden()

  // The construction badge: the scene draws it from the state's construction; the plot's panel shows the same timer.
  await expect.poll(() => bridge(page, b => b.state!.constructions.length)).toBe(1)
  await bridge(page, b => b.emit({ type: 'select', target: { kind: 'farm', plot: 2 } }))
  const farm = page.getByRole('region', { name: /farm/i })
  await expect(farm.getByText(/^Building · /)).toBeVisible()

  // Skip through the store charge path (a micro-USD price paid from the game balance).
  await farm.locator('#skip-construction-farm-2').click()
  await expect.poll(() => bridge(page, b => b.state!.constructions.length)).toBe(0)
  await expect.poll(() => bridge(page, b => b.state!.farms.length)).toBe(3)

  // Upgrade h1.
  await bridge(page, b => b.emit({ type: 'select', target: { kind: 'habitat', id: 'h1' } }))
  const habitat = page.getByRole('region', { name: /flame habitat h1/i })
  await habitat.locator('#upgrade-h1').click()
  await expect(habitat.getByText(/^Upgrading to 2 · /)).toBeVisible()
  await expect.poll(() => bridge(page, b => b.state!.constructions.length)).toBe(1)

  // Move h1 one cell down: (0,0) -> (0,1). (One cell right would overlap h2 at (5,0).)
  await habitat.getByRole('button', { name: /^move$/i }).click()
  await bridge(page, b => b.emit({ type: 'cell', col: 0, row: 1 }))
  await expect(placement.getByRole('button', { name: /confirm/i })).toBeEnabled()
  await placement.getByRole('button', { name: /confirm/i }).click()
  await expect(placement).toBeHidden()
  await expect.poll(() => bridge(page, b => b.state!.habitats.find(h => h.id === 'h1')!.placement.row)).toBe(1)

  // Turn it.
  await bridge(page, b => b.emit({ type: 'select', target: { kind: 'habitat', id: 'h1' } }))
  await page.getByRole('region', { name: /flame habitat h1/i }).getByRole('button', { name: /^turn$/i }).click()
  await expect.poll(() => bridge(page, b => b.state!.habitats.find(h => h.id === 'h1')!.placement.facing)).toBe(1)

  // The island map: at level 5 isle2 is still locked. It is the next island in order, so the panel shows a disabled
  // Unlock button (not the word "Locked"); that label appears on the islands after it (isle3 here).
  await openPanel(page, 'Map')
  const map = page.getByRole('region', { name: /islands/i })
  await expect(map.locator('#unlock-isle2')).toBeDisabled()
  await expect(map.getByRole('button', { name: /go to second island/i })).toHaveCount(0)
  await expect(map).toContainText(/Third island\s*·\s*Locked/)
})

import { expect, test, type Page } from '@playwright/test'
import { dismissLevelUp, openInfo, resetPlayer, signIn } from './helpers'

type TestBridge = { emit(e: unknown): void; state: { farms: { stored?: unknown }[] } | null }
const bridge = <T>(page: Page, fn: (b: TestBridge) => T) => page.evaluate(`(${fn.toString()})(window.__bridge)`) as Promise<T>

test('stores a farm from its Info, lists it in Storage, and Use puts it back with the Move placement', async ({ page, request }) => {
  await signIn(page)
  await resetPlayer(request, { gold: 5_000, level: 5, xp: 0 })
  await page.reload()
  await page.waitForFunction(() => Boolean((window as unknown as { __bridge?: { state: unknown } }).__bridge?.state))
  await dismissLevelUp(page)

  await openInfo(page, { kind: 'farm', plot: 0 })
  await page.locator('#store-farm-0').click()
  await expect.poll(() => bridge(page, b => Boolean(b.state!.farms[0]!.stored))).toBe(true)

  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'Storage' }).click()
  const storage = page.getByRole('region', { name: 'Storage · 1' })
  await expect(storage).toBeVisible()
  const card = storage.getByRole('article', { name: 'Farm' })
  await card.getByRole('button', { name: 'Use' }).click()
  await expect(storage).toBeHidden()

  await bridge(page, b => b.emit({ type: 'cell', col: 20, row: 16 }))
  const placement = page.getByRole('toolbar', { name: /placement/i })
  await expect(placement.getByRole('button', { name: 'OK' })).toBeEnabled()
  await placement.getByRole('button', { name: 'OK' }).click()
  await expect(placement).toBeHidden()
  await expect.poll(() => bridge(page, b => b.state!.farms[0]!.stored === undefined)).toBe(true)

  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'Storage' }).click()
  await expect(page.getByText('Storage is empty')).toBeVisible()
})

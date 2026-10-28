import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const SERVER = 'http://localhost:3000'
/** Anvil dev account 0 (the VITE_TEST_WALLET adapter signs with its key). */
export const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

/** Creates/patches the test player on the E2E server. */
export async function grant(request: APIRequestContext, patch: { tokenWei?: string; earningUnlocked?: boolean; state?: Record<string, unknown> }) {
  const r = await request.post(`${SERVER}/e2e/grant`, { data: { address: TEST_ADDRESS, ...patch } })
  expect(r.ok(), await r.text()).toBe(true)
}

/** Sign in through the UI with the test wallet (auto-connected). */
export async function signIn(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByRole('status', { name: /resources/i })).toBeVisible()
}

export const openPanel = (page: Page, label: string) => page.getByRole('navigation', { name: /panels/i }).getByRole('button', { name: label }).click()

export const fireTeam = (level: number) => ['d1', 'd2', 'd3'].map(id => ({ id, speciesId: 'fire', level, habitatId: 'h1' }))
export const waterTeam = (level: number) => ['d1', 'd2', 'd3'].map(id => ({ id, speciesId: 'water', level, habitatId: 'h2' }))

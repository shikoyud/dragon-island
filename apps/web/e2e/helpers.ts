import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { newPlayer } from '@wyrmhaven/game-core'

export const SERVER = 'http://localhost:3000'
/** Anvil dev account 0 (the VITE_TEST_WALLET adapter signs with its key). */
export const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

/** Must match playwright.config.ts. */
export const ADMIN_TOKEN = 'e2e-admin-token-0123456789abcdef-32'

/** Creates/patches the test player on the E2E server. */
export async function grant(request: APIRequestContext, patch: { tokenWei?: string; earningUnlocked?: boolean; state?: Record<string, unknown> }) {
  const r = await request.post(`${SERVER}/e2e/grant`, { data: { address: TEST_ADDRESS, ...patch } })
  expect(r.ok(), await r.text()).toBe(true)
}

/** Shifts the E2E server's clock by `offsetMs` from real time (0 restores it). */
export async function setServerClock(request: APIRequestContext, offsetMs: number) {
  const r = await request.post(`${SERVER}/e2e/clock`, { data: { offsetMs } })
  expect(r.ok(), await r.text()).toBe(true)
}

/** The starting state exactly as the server creates it (game-core's newPlayer), so every spec starts from the same place. */
export function startingState(nowMs = Date.now()): Record<string, unknown> {
  return newPlayer(nowMs) as unknown as Record<string, unknown>
}

/** Resets the shared e2e player to the starting state plus `extra`, with no tokens and earning locked. */
export async function resetPlayer(request: APIRequestContext, extra: Record<string, unknown> = {}, opts: { tokenWei?: string; earningUnlocked?: boolean } = {}) {
  await grant(request, { tokenWei: opts.tokenWei ?? '0', earningUnlocked: opts.earningUnlocked ?? false, state: { ...startingState(), ...extra } })
}

const SESSION_KEY = 'dris.session' // src/api/session.ts
/** The last session a spec signed in with (workers = 1, so specs run one after another in this process). */
let lastSession: string | null = null

/**
 * Sign in with the test wallet (auto-connected). The server allows 20 auth requests per IP a minute (two per
 * sign-in), so a spec reuses the previous spec's session when the server still accepts it and signs in through
 * the UI only otherwise (first spec, after a sign-out, or with `fresh` to test the sign-in itself).
 */
export async function signIn(page: Page, opts: { fresh?: boolean } = {}) {
  if (lastSession && !opts.fresh) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k!)) localStorage.setItem(k!, v!) }, [SESSION_KEY, lastSession])
  await page.goto('/')
  const resources = page.getByRole('status', { name: /resources/i })
  const signInButton = page.getByRole('button', { name: /^sign in$/i })
  await expect(resources.or(signInButton).first()).toBeVisible({ timeout: 15_000 })
  if (!(await resources.isVisible())) {
    await signInButton.click()
    // Sign-in plus the first /me can take a few seconds while the in-memory server is busy with earlier specs.
    await expect(resources).toBeVisible({ timeout: 15_000 })
  }
  lastSession = await page.evaluate(k => localStorage.getItem(k), SESSION_KEY)
}

/**
 * Opens a panel through the HUD the way a player would: the main menu at the bottom, the island menu on the right,
 * Settings for the wallet, Battle's tabs for Campaign and Arena, and a click on the hatchery or a plot for Nests and
 * Farm. Any dialog already open is closed first (its scrim covers the HUD).
 */
export async function openPanel(page: Page, label: string) {
  if (await page.getByTestId('dialog-scrim').isVisible().catch(() => false)) await page.keyboard.press('Escape')
  const main = (name: string) => page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name, exact: true }).click()
  const side = (name: string) => page.getByRole('navigation', { name: 'Island menu' }).getByRole('button', { name, exact: true }).click()
  const select = (target: unknown) => page.evaluate(t => (window as unknown as { __bridge: { emit(e: unknown): void } }).__bridge.emit({ type: 'select', target: t }), target)
  switch (label) {
    case 'Campaign':
    case 'Arena':
      await main('Battle')
      return page.getByRole('tab', { name: label }).click()
    case 'Map':
      return side(label)
    case 'Wallet':
      return page.getByRole('button', { name: 'Settings' }).click()
    case 'Nests':
      return select({ kind: 'hatcheryBuilding' })
    case 'Farm':
      return select({ kind: 'farm', plot: 0 })
    default:
      return main(label)
  }
}

export const flameTeam = (level: number) => ['d1', 'd2', 'd3'].map(id => ({ id, speciesId: 'flame', level, habitatId: 'h1' }))
export const seaTeam = (level: number) => ['d1', 'd2', 'd3'].map(id => ({ id, speciesId: 'sea', level, habitatId: 'h2' }))

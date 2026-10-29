import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const SERVER = 'http://localhost:3000'
/** Anvil dev account 0 (the VITE_TEST_WALLET adapter signs with its key). */
export const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

/** Must match playwright.config.ts. */
export const ADMIN_TOKEN = 'e2e-admin-token-0123456789abcdef-32'

/** Creates/patches the test player on the E2E server; `sp` adds Season Points in the current season. */
export async function grant(request: APIRequestContext, patch: { tokenWei?: string; earningUnlocked?: boolean; state?: Record<string, unknown>; sp?: number }) {
  const r = await request.post(`${SERVER}/e2e/grant`, { data: { address: TEST_ADDRESS, ...patch } })
  expect(r.ok(), await r.text()).toBe(true)
}

/** Shifts the E2E server's clock by `offsetMs` from real time (0 restores it). */
export async function setServerClock(request: APIRequestContext, offsetMs: number) {
  const r = await request.post(`${SERVER}/e2e/clock`, { data: { offsetMs } })
  expect(r.ok(), await r.text()).toBe(true)
}

/** The spec §9 starting state (mirrors game-core's newPlayer) so every spec starts from the same place. */
export function startingState(nowMs = Date.now()): Record<string, unknown> {
  const day = Math.floor(nowMs / 86_400_000)
  return {
    gold: 1000, eligibleGold: 0, food: 100, xp: 0, level: 1,
    dragons: [
      { id: 'd1', speciesId: 'fire', level: 1, habitatId: 'h1' },
      { id: 'd2', speciesId: 'water', level: 1, habitatId: 'h2' },
    ],
    habitats: [
      { id: 'h1', element: 'fire', level: 1, lastCollectedMs: nowMs },
      { id: 'h2', element: 'water', level: 1, lastCollectedMs: nowMs },
    ],
    nests: [null], hatchery: [], farms: [{ crop: null, readyAtMs: 0 }, { crop: null, readyAtMs: 0 }],
    pity: {}, oddsBoosts: 0, hoardLevel: 0, earningUnlocked: false,
    sell: { day, soldTodayMicroUsd: 0 }, ledger: { depositedMicroUsd: 0, withdrawnMicroUsd: 0, soldMicroUsd: 0 },
    tutorial: { breedDone: false, hatchDone: false }, nextId: 3,
    defenceTeam: null, trophies: 0, pvp: { day, count: 0 }, pve: { cleared: 0, replays: { day, count: 0 } },
  }
}

/** Resets the shared e2e player to the starting state plus `extra`, with no tokens and earning locked. */
export async function resetPlayer(request: APIRequestContext, extra: Record<string, unknown> = {}, opts: { tokenWei?: string; earningUnlocked?: boolean } = {}) {
  await grant(request, { tokenWei: opts.tokenWei ?? '0', earningUnlocked: opts.earningUnlocked ?? false, state: { ...startingState(), ...extra } })
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
